import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getToSchoolData } from "@/lib/to-school";
import { istDateKey } from "@/lib/dashboard-calc";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ["EMPLOYEE", "APPROVER", "ADMIN"]);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const requestedStaffId = searchParams.get("staffId");
    const monthParam = searchParams.get("month");
    const yearParam = searchParams.get("year");

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
          { error: "Forbidden: You may only view your own calendar" },
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

    // Parse month & year with defaults to current IST date
    const now = new Date();
    const todayKey = istDateKey(now);
    const [curYearStr, curMonthStr] = todayKey.split("-");
    const defaultYear = parseInt(curYearStr, 10);
    const defaultMonth = parseInt(curMonthStr, 10);

    let year = defaultYear;
    let month = defaultMonth;

    if (yearParam) {
      const parsedYear = parseInt(yearParam, 10);
      if (Number.isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
        return NextResponse.json(
          { error: "Invalid year parameter" },
          { status: 400 }
        );
      }
      year = parsedYear;
    }

    if (monthParam) {
      const parsedMonth = parseInt(monthParam, 10);
      if (Number.isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
        return NextResponse.json(
          { error: "Invalid month parameter" },
          { status: 400 }
        );
      }
      month = parsedMonth;
    }

    const data = await getToSchoolData(targetStaffId, year, month, now);
    if (!data) {
      return NextResponse.json(
        { error: "Staff member not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error: unknown) {
    console.error("GET /api/employee/to-school error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
