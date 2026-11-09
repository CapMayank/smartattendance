import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const AADHAAR_REGEX = /^\d{12}$/;
const MOBILE_REGEX = /^\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await requireRole(session, ["EMPLOYEE", "APPROVER", "ADMIN"]);
  if (auth.errorResponse) return auth.errorResponse;

  const staffId = auth.user.staffId ?? auth.user.staff?.id;
  if (!staffId) {
    return NextResponse.json(
      { error: "No linked staff profile found for this user account" },
      { status: 400 }
    );
  }

  const requests = await prisma.profileChangeRequest.findMany({
    where: { staffId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ["EMPLOYEE", "APPROVER", "ADMIN"]);
    if (auth.errorResponse) return auth.errorResponse;

    const staffId = auth.user.staffId ?? auth.user.staff?.id;
    if (!staffId) {
      return NextResponse.json(
        { error: "No linked staff profile found for this user account" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawData = (body.requestedData ?? {}) as Record<string, unknown>;
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";

    const cleanRequestedData: Record<string, string> = {};
    for (const [key, val] of Object.entries(rawData)) {
      if (typeof val === "string" && val.trim().length > 0) {
        cleanRequestedData[key] = val.trim();
      }
    }

    if (Object.keys(cleanRequestedData).length === 0) {
      return NextResponse.json(
        { error: "At least one field must be modified to submit a change request" },
        { status: 400 }
      );
    }

    // Validate PAN
    if (cleanRequestedData.pan) {
      cleanRequestedData.pan = cleanRequestedData.pan.toUpperCase();
      if (!PAN_REGEX.test(cleanRequestedData.pan)) {
        return NextResponse.json(
          { error: "Invalid PAN format: Must be 10 characters (e.g. ABCDE1234F)" },
          { status: 400 }
        );
      }
    }

    // Validate IFSC
    if (cleanRequestedData.ifsc) {
      cleanRequestedData.ifsc = cleanRequestedData.ifsc.toUpperCase();
      if (!IFSC_REGEX.test(cleanRequestedData.ifsc)) {
        return NextResponse.json(
          { error: "Invalid IFSC code format: Must be 11 characters (e.g. SBIN0001234)" },
          { status: 400 }
        );
      }
    }

    // Validate Aadhaar
    if (cleanRequestedData.aadhaar) {
      if (!AADHAAR_REGEX.test(cleanRequestedData.aadhaar)) {
        return NextResponse.json(
          { error: "Invalid Aadhaar format: Must be exactly 12 digits" },
          { status: 400 }
        );
      }
    }

    // Validate Mobile
    if (cleanRequestedData.mobileNumber) {
      if (!MOBILE_REGEX.test(cleanRequestedData.mobileNumber)) {
        return NextResponse.json(
          { error: "Invalid mobile number format: Must be exactly 10 digits" },
          { status: 400 }
        );
      }
    }

    // Validate Email & Collision
    if (cleanRequestedData.email) {
      cleanRequestedData.email = cleanRequestedData.email.toLowerCase();
      if (!EMAIL_REGEX.test(cleanRequestedData.email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: cleanRequestedData.email },
      });
      if (existingUser && existingUser.staffId !== staffId) {
        return NextResponse.json(
          { error: "Email is already in use by another account" },
          { status: 400 }
        );
      }
    }

    // Snapshot current staff info
    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: { payrollInfo: true, user: true },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    const info = staff.payrollInfo;
    const currentDataSnapshot: Record<string, string> = {
      name: staff.name ?? "",
      email: staff.user?.email ?? info?.email ?? "",
      mobileNumber: info?.mobileNumber ?? "",
      dob: info?.dob
        ? typeof info.dob === "string"
          ? info.dob
          : info.dob.toISOString().split("T")[0]
        : "",
      gender: info?.gender ?? "",
      fatherHusbandName: info?.fatherHusbandName ?? "",
      bankAccount: info?.bankAccount ?? "",
      ifsc: info?.ifsc ?? "",
      nameAsPerBank: info?.nameAsPerBank ?? "",
      pan: info?.pan ?? "",
      aadhaar: info?.aadhaar ?? "",
      uan: info?.uan ?? "",
    };

    const request = await prisma.profileChangeRequest.create({
      data: {
        staffId,
        status: "PENDING",
        requestedData: JSON.stringify(cleanRequestedData),
        currentData: JSON.stringify(currentDataSnapshot),
        reason: reason || null,
      },
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    console.error("[profile-requests] error creating request:", err);
    return NextResponse.json(
      { error: "Internal server error submitting change request" },
      { status: 500 }
    );
  }
}
