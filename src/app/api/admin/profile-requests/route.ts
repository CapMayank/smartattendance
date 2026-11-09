import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ["ADMIN", "APPROVER"]);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const departmentIdParam = searchParams.get("departmentId");
    const staffIdParam = searchParams.get("staffId");

    const where: Prisma.ProfileChangeRequestWhereInput = {};

    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam;
    }

    if (staffIdParam) {
      where.staffId = staffIdParam;
    }

    const userRole = auth.user.role;
    if (userRole === "APPROVER") {
      const allowedDeptIds = getApproverDepartmentIds(auth.user);
      if (allowedDeptIds !== null) {
        if (departmentIdParam) {
          if (!allowedDeptIds.includes(departmentIdParam)) {
            return NextResponse.json(
              { error: "Forbidden: You may not view requests outside your department scope" },
              { status: 403 }
            );
          }
          where.staff = { departmentId: departmentIdParam };
        } else {
          where.staff = { departmentId: { in: allowedDeptIds } };
        }
      } else if (departmentIdParam) {
        where.staff = { departmentId: departmentIdParam };
      }
    } else if (departmentIdParam) {
      where.staff = { departmentId: departmentIdParam };
    }

    const requests = await prisma.profileChangeRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        staff: {
          include: {
            department: true,
            designation: true,
          },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (err) {
    console.error("[admin-profile-requests] error fetching requests:", err);
    return NextResponse.json(
      { error: "Failed to retrieve profile change requests" },
      { status: 500 }
    );
  }
}
