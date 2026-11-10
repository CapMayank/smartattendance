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
    const action = body.action as "APPROVE" | "REJECT" | "SELECTIVE";
    const rawRemarks =
      typeof body.remarks === "string"
        ? body.remarks.trim()
        : typeof body.decisionRemarks === "string"
        ? body.decisionRemarks.trim()
        : "";

    if (action !== "APPROVE" && action !== "REJECT" && action !== "SELECTIVE") {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVE, REJECT, or SELECTIVE" },
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
            decisionRemarks: rawRemarks || null,
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
              decisionRemarks: rawRemarks || null,
            }),
          },
        });

        return pcr;
      });

      return NextResponse.json({ success: true, request: updated });
    }

    // Handle APPROVE or SELECTIVE
    const requestedData = JSON.parse(request.requestedData || "{}") as Record<string, string>;
    const allKeys = Object.keys(requestedData);

    let approvedKeys: string[] = [];
    let rejectedKeys: string[] = [];
    let finalStatus: "APPROVED" | "REJECTED" | "PARTIALLY_APPROVED" = "APPROVED";
    let finalRemarks: string | null = rawRemarks || null;

    if (action === "APPROVE") {
      approvedKeys = allKeys;
      rejectedKeys = [];
      finalStatus = "APPROVED";
    } else {
      // action === "SELECTIVE"
      const reqApproved = Array.isArray(body.approvedFields)
        ? (body.approvedFields as string[])
        : [];
      approvedKeys = reqApproved.filter((k) => allKeys.includes(k));

      const reqRejected = Array.isArray(body.rejectedFields)
        ? (body.rejectedFields as string[])
        : [];
      rejectedKeys =
        reqRejected.length > 0
          ? reqRejected.filter((k) => allKeys.includes(k))
          : allKeys.filter((k) => !approvedKeys.includes(k));

      if (approvedKeys.length === 0) {
        finalStatus = "REJECTED";
      } else if (rejectedKeys.length === 0) {
        finalStatus = "APPROVED";
      } else {
        finalStatus = "PARTIALLY_APPROVED";
      }

      finalRemarks = JSON.stringify({
        note: rawRemarks || undefined,
        approvedFields: approvedKeys,
        rejectedFields: rejectedKeys,
        fieldRemarks:
          typeof body.fieldRemarks === "object" && body.fieldRemarks !== null
            ? body.fieldRemarks
            : {},
      });
    }

    if (finalStatus === "REJECTED") {
      const updated = await prisma.$transaction(async (tx) => {
        const pcr = await tx.profileChangeRequest.update({
          where: { id: requestId },
          data: {
            status: "REJECTED",
            decidedByUserId,
            decidedAt: now,
            decisionRemarks: finalRemarks,
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
              decisionRemarks: finalRemarks,
            }),
          },
        });

        return pcr;
      });

      return NextResponse.json({ success: true, request: updated });
    }

    // Filter requestedData to approved keys only
    const approvedData: Record<string, string> = {};
    for (const key of approvedKeys) {
      if (key in requestedData) {
        approvedData[key] = requestedData[key];
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update Staff if name changed and was approved
      if (approvedData.name) {
        await tx.staff.update({
          where: { id: request.staffId },
          data: { name: approvedData.name },
        });
      }

      // 2. Build StaffPayrollInfo update payload for approved fields
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
        if (field in approvedData) {
          payrollUpdate[field] = approvedData[field];
        }
      }

      if (approvedData.dob) {
        payrollUpdate.dob = new Date(approvedData.dob);
      }
      if (approvedData.passportValidFrom) {
        payrollUpdate.passportValidFrom = new Date(approvedData.passportValidFrom);
      }
      if (approvedData.passportValidTill) {
        payrollUpdate.passportValidTill = new Date(approvedData.passportValidTill);
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
        if (approvedData.name) {
          userUpdate.name = approvedData.name;
        }
        if (approvedData.email) {
          userUpdate.email = approvedData.email;
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
          status: finalStatus,
          decidedByUserId,
          decidedAt: now,
          decisionRemarks: finalRemarks,
        },
      });

      // 5. Create AuditLog entry
      const auditAction =
        finalStatus === "APPROVED"
          ? "PROFILE_CHANGE_APPROVED"
          : "PROFILE_CHANGE_PARTIALLY_APPROVED";

      await tx.auditLog.create({
        data: {
          actorUserId: decidedByUserId,
          action: auditAction,
          targetType: "Staff",
          targetId: request.staffId,
          details: JSON.stringify({
            requestId,
            appliedChanges: approvedData,
            decisionRemarks: finalRemarks,
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
