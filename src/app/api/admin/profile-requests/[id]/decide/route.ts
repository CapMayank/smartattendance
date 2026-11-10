import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ["ADMIN"]);
    if (auth.errorResponse) return auth.errorResponse;

    const { id: requestId } = await props.params;
    const body = await req.json().catch(() => ({}));
    const action = body.action as "APPROVE" | "REJECT";
    const remarks = typeof body.remarks === "string" ? body.remarks.trim() : "";

    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE or REJECT" },
        { status: 400 }
      );
    }

    const request = await prisma.profileChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        staff: {
          include: {
            payrollInfo: true,
            user: true,
          },
        },
      },
    });

    if (!request) {
      return NextResponse.json(
        { error: "Profile change request not found" },
        { status: 404 }
      );
    }

    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: `Request has already been decided (${request.status})` },
        { status: 400 }
      );
    }

    const now = new Date();
    const decidedByUserId = auth.user.id;

    if (action === "REJECT") {
      const updated = await prisma.$transaction(async (tx) => {
        const pcr = await tx.profileChangeRequest.update({
          where: { id: requestId },
          data: {
            status: "REJECTED",
            decidedByUserId,
            decidedAt: now,
            decisionRemarks: remarks || null,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: decidedByUserId,
            action: "PROFILE_CHANGE_REJECTED",
            targetType: "Staff",
            targetId: request.staffId,
            details: JSON.stringify({
              requestId,
              reason: request.reason,
              decisionRemarks: remarks || null,
            }),
          },
        });

        return pcr;
      });

      return NextResponse.json({ success: true, request: updated });
    }

    // Action === "APPROVE"
    const requestedData = JSON.parse(request.requestedData || "{}") as Record<string, string>;

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Staff if name changed
      if (requestedData.name) {
        await tx.staff.update({
          where: { id: request.staffId },
          data: { name: requestedData.name },
        });
      }

      // 2. Build StaffPayrollInfo update payload
      const payrollUpdate: Record<string, unknown> = {};
      const payrollFields = [
        "email",
        "mobileNumber",
        "bankAccount",
        "ifsc",
        "nameAsPerBank",
        "pan",
        "nameOnPan",
        "aadhaar",
        "nameOnAadhaar",
        "uan",
        "nameOnUan",
        "gender",
        "fatherHusbandName",
        "relationship",
        "maritalStatus",
        "nationality",
        "qualification",
        "previousMemberId",
        "isInternationalWorker",
        "countryOfOrigin",
        "passportNumber",
        "isPhysicalHandicap",
        "locomotive",
        "hearing",
        "visual",
      ];

      for (const field of payrollFields) {
        if (field in requestedData) {
          payrollUpdate[field] = requestedData[field];
        }
      }

      if (requestedData.dob) {
        payrollUpdate.dob = new Date(requestedData.dob);
      }
      if (requestedData.passportValidFrom) {
        payrollUpdate.passportValidFrom = new Date(requestedData.passportValidFrom);
      }
      if (requestedData.passportValidTill) {
        payrollUpdate.passportValidTill = new Date(requestedData.passportValidTill);
      }

      if (Object.keys(payrollUpdate).length > 0) {
        await tx.staffPayrollInfo.upsert({
          where: { staffId: request.staffId },
          create: {
            staffId: request.staffId,
            ...payrollUpdate,
          },
          update: payrollUpdate,
        });
      }

      // 3. Update linked User record if exists (e.g. name, login email)
      const linkedUser =
        request.staff?.user ??
        (await tx.user.findFirst({ where: { staffId: request.staffId } }));

      if (linkedUser) {
        const userUpdate: Record<string, string> = {};
        if (requestedData.name) {
          userUpdate.name = requestedData.name;
        }
        if (requestedData.email) {
          userUpdate.email = requestedData.email;
        }
        if (Object.keys(userUpdate).length > 0) {
          await tx.user.update({
            where: { id: linkedUser.id },
            data: userUpdate,
          });
        }
      }

      // 4. Update request status
      const pcr = await tx.profileChangeRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          decidedByUserId,
          decidedAt: now,
          decisionRemarks: remarks || null,
        },
      });

      // 5. Create AuditLog entry
      await tx.auditLog.create({
        data: {
          actorUserId: decidedByUserId,
          action: "PROFILE_CHANGE_APPROVED",
          targetType: "Staff",
          targetId: request.staffId,
          details: JSON.stringify({
            requestId,
            appliedChanges: requestedData,
            decisionRemarks: remarks || null,
          }),
        },
      });

      return pcr;
    });

    return NextResponse.json({ success: true, request: updated });
  } catch (err) {
    console.error("[profile-requests-decide] error deciding request:", err);
    return NextResponse.json(
      { error: "Internal server error deciding request" },
      { status: 500 }
    );
  }
}
