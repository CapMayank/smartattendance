import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  PunchRequestsAdminClient,
  type AdminPunchRequestItem,
} from "./PunchRequestsAdminClient";

export default async function PunchRequestsAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
    return null;
  }

  // If user is EMPLOYEE, redirect to employee portal punch requests page
  const role = (session.user as { role?: string }).role;
  if (role === "EMPLOYEE") {
    redirect("/punch-requests");
    return null;
  }

  const auth = await requireRole(session, ["ADMIN", "APPROVER"]);
  if (auth.errorResponse) {
    if (auth.user?.role === "EMPLOYEE") {
      redirect("/punch-requests");
      return null;
    }
    redirect("/login");
    return null;
  }

  const userRole = auth.user.role as "ADMIN" | "APPROVER";
  const allowedDeptIds = getApproverDepartmentIds(auth.user);

  const where: Prisma.PunchRequestWhereInput = {};
  if (userRole === "APPROVER" && allowedDeptIds !== null) {
    where.staff = {
      departmentId: { in: allowedDeptIds },
    };
  }

  const [rawRequests, rawDepartments, maxDaysSetting] = await Promise.all([
    prisma.punchRequest.findMany({
      where,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        staff: {
          include: {
            department: true,
            designation: true,
          },
        },
      },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.systemSetting.findUnique({
      where: { key: "PUNCH_REQUEST_MAX_DAYS" },
    }),
  ]);

  const departments =
    userRole === "APPROVER" && allowedDeptIds !== null
      ? rawDepartments.filter((d) => allowedDeptIds.includes(d.id))
      : rawDepartments;

  const cutoffDays = maxDaysSetting?.value ? parseInt(maxDaysSetting.value, 10) : 0;

  const initialRequests: AdminPunchRequestItem[] = rawRequests.map((r) => ({
    id: r.id,
    staffId: r.staffId,
    date: r.date,
    punchType: r.punchType,
    requestedTime: r.requestedTime,
    requestedInTime: r.requestedInTime,
    requestedOutTime: r.requestedOutTime,
    reason: r.reason,
    explanation: r.explanation,
    status: r.status,
    decidedByUserId: r.decidedByUserId,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    decisionRemarks: r.decisionRemarks,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    staff: {
      id: r.staff.id,
      name: r.staff.name,
      employeeCode: r.staff.employeeCode,
      machineId: r.staff.machineId,
      departmentId: r.staff.departmentId,
      profilePhotoId: r.staff.profilePhotoId,
      department: r.staff.department
        ? { id: r.staff.department.id, name: r.staff.department.name }
        : null,
      designation: r.staff.designation
        ? { id: r.staff.designation.id, name: r.staff.designation.name }
        : null,
    },
  }));

  return (
    <PunchRequestsAdminClient
      initialRequests={initialRequests}
      departments={departments}
      userRole={userRole}
      currentCutoffDays={cutoffDays}
    />
  );
}
