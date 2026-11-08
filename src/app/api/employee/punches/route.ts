import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { istDateKey, istDayStart } from "@/lib/dashboard-calc";
import { formatTime } from "@/lib/format";

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ["EMPLOYEE", "APPROVER", "ADMIN"]);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const requestedStaffId = searchParams.get("staffId");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const limitParam = searchParams.get("limit");

    const userRole = auth.user.role;
    const userStaffId = auth.user.staffId ?? auth.user.staff?.id;

    let targetStaffId: string | null = null;

    if (userRole === "EMPLOYEE") {
      if (!userStaffId) {
        return NextResponse.json(
          { error: "No staff profile linked to this user account" },
          { status: 400 }
        );
      }
      if (requestedStaffId && requestedStaffId !== userStaffId) {
        return NextResponse.json(
          { error: "Forbidden: You may only view your own punches" },
          { status: 403 }
        );
      }
      targetStaffId = userStaffId;
    } else if (userRole === "APPROVER") {
      const allowedDeptIds = getApproverDepartmentIds(auth.user);
      if (requestedStaffId) {
        if (allowedDeptIds !== null) {
          const targetStaff = await prisma.staff.findUnique({
            where: { id: requestedStaffId },
            select: { departmentId: true },
          });
          if (!targetStaff) {
            return NextResponse.json(
              { error: "Staff member not found" },
              { status: 404 }
            );
          }
          if (
            !targetStaff.departmentId ||
            !allowedDeptIds.includes(targetStaff.departmentId)
          ) {
            return NextResponse.json(
              { error: "Forbidden: Staff member outside your assigned departments" },
              { status: 403 }
            );
          }
        }
        targetStaffId = requestedStaffId;
      } else {
        targetStaffId = userStaffId ?? null;
        if (!targetStaffId) {
          return NextResponse.json(
            { error: "staffId parameter required for approver without linked staff profile" },
            { status: 400 }
          );
        }
      }
    } else {
      // ADMIN
      targetStaffId = requestedStaffId || (userStaffId ?? null);
      if (!targetStaffId) {
        return NextResponse.json(
          { error: "staffId parameter required" },
          { status: 400 }
        );
      }
    }

    // Parse and validate date filters
    const timestampFilter: { gte?: Date; lt?: Date } = {};

    if (fromParam) {
      if (!DATE_REGEX.test(fromParam)) {
        return NextResponse.json(
          { error: "Invalid from date format: must be YYYY-MM-DD" },
          { status: 400 }
        );
      }
      timestampFilter.gte = istDayStart(new Date(`${fromParam}T12:00:00Z`));
    }

    if (toParam) {
      if (!DATE_REGEX.test(toParam)) {
        return NextResponse.json(
          { error: "Invalid to date format: must be YYYY-MM-DD" },
          { status: 400 }
        );
      }
      const toDayStart = istDayStart(new Date(`${toParam}T12:00:00Z`));
      timestampFilter.lt = new Date(toDayStart.getTime() + 24 * 3600 * 1000);
    }

    let limit = 100;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 500);
      }
    }

    const logs = await prisma.attendanceLog.findMany({
      where: {
        staffId: targetStaffId,
        ...(Object.keys(timestampFilter).length > 0 ? { timestamp: timestampFilter } : {}),
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    const punches = logs.map((log) => {
      const d = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
      return {
        id: log.id,
        timestamp: d.toISOString(),
        type: log.type === "OUT" ? ("OUT" as const) : ("IN" as const),
        dateKey: istDateKey(d),
        timeStr: formatTime(d),
      };
    });

    return NextResponse.json({ success: true, punches });
  } catch (error: unknown) {
    console.error("GET /api/employee/punches error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
