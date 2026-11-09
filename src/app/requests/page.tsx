import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { RequestsHubClient } from "./RequestsHubClient";
import type { AdminPunchRequestItem } from "../punches/requests/PunchRequestsAdminClient";
import type { AdminProfileRequestItem } from "./ProfileRequestsTab";

interface RequestsPageProps {
  searchParams?: {
    tab?: string;
  };
}

export default async function RequestsHubPage({ searchParams }: RequestsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
    return null;
  }

  const role = (session.user as { role?: string }).role;
  if (role === "EMPLOYEE") {
    redirect("/punch-requests");
    return null;
  }

  const auth = await requireRole(session, ["ADMIN", "APPROVER"]);
  if (auth.errorResponse) {
    if ((session.user as { role?: string })?.role === "EMPLOYEE") {
      redirect("/punch-requests");
      return null;
    }
    redirect("/login");
    return null;
  }

  const userRole = auth.user.role as "ADMIN" | "APPROVER";
  const allowedDeptIds = getApproverDepartmentIds(auth.user);

  const punchWhere: Prisma.PunchRequestWhereInput = {};
  const profileWhere: Prisma.ProfileChangeRequestWhereInput = {};

  if (userRole === "APPROVER" && allowedDeptIds !== null) {
    punchWhere.staff = {
      departmentId: { in: allowedDeptIds },
    };
    profileWhere.staff = {
      departmentId: { in: allowedDeptIds },
    };
  }

  const [rawPunches, rawProfileRequests, rawDepartments, maxDaysSetting] = await Promise.all([
    prisma.punchRequest.findMany({
      where: punchWhere,
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
    prisma.profileChangeRequest.findMany({
      where: profileWhere,
      orderBy: { createdAt: "desc" },
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

  const initialPunchRequests: AdminPunchRequestItem[] = rawPunches.map((r) => ({
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

  const initialProfileRequests: AdminProfileRequestItem[] = rawProfileRequests.map((p) => ({
    id: p.id,
    staffId: p.staffId,
    status: p.status as "PENDING" | "APPROVED" | "REJECTED",
    requestedData: p.requestedData,
    currentData: p.currentData,
    reason: p.reason,
    decisionRemarks: p.decisionRemarks,
    decidedByUserId: p.decidedByUserId,
    decidedAt: p.decidedAt ? p.decidedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt ? p.updatedAt.toISOString() : undefined,
    staff: {
      id: p.staff.id,
      name: p.staff.name,
      employeeCode: p.staff.employeeCode,
      machineId: p.staff.machineId,
      departmentId: p.staff.departmentId,
      profilePhotoId: p.staff.profilePhotoId,
      department: p.staff.department
        ? { id: p.staff.department.id, name: p.staff.department.name }
        : null,
      designation: p.staff.designation
        ? { id: p.staff.designation.id, name: p.staff.designation.name }
        : null,
    },
  }));

  const initialTab =
    searchParams?.tab === "punches" || searchParams?.tab === "profile"
      ? (searchParams.tab as "punches" | "profile")
      : "all";

  return (
    <RequestsHubClient
      userRole={userRole}
      initialPunchRequests={initialPunchRequests}
      initialProfileRequests={initialProfileRequests}
      departments={departments}
      cutoffDays={cutoffDays}
      initialTab={initialTab}
    />
  );
}
