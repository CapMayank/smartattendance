import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { MyPayslipsClient } from "./MyPayslipsClient";
import { Card, PageHeader } from "@/components/ui";

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
    return null;
  }

  const auth = await requireRole(session, ["EMPLOYEE", "APPROVER", "ADMIN"]);
  if (auth.errorResponse) {
    redirect("/login");
    return null;
  }

  const sp = await searchParams;
  const requestedStaffId = typeof sp.staffId === "string" ? sp.staffId : undefined;
  const userStaffId = auth.user.staffId ?? auth.user.staff?.id ?? session.user.staffId;

  let targetStaffId: string | null = null;

  if (auth.user.role === "EMPLOYEE") {
    // Strictly session.user.staffId (ignores ?staffId= parameter)
    targetStaffId = userStaffId ?? null;
  } else if (auth.user.role === "APPROVER") {
    const allowedDeptIds = getApproverDepartmentIds(auth.user);
    if (requestedStaffId) {
      if (allowedDeptIds !== null) {
        const targetStaff = await prisma.staff.findUnique({
          where: { id: requestedStaffId },
          select: { departmentId: true },
        });
        if (
          !targetStaff ||
          !targetStaff.departmentId ||
          !allowedDeptIds.includes(targetStaff.departmentId)
        ) {
          return (
            <div className="mx-auto max-w-4xl p-6">
              <PageHeader
                title="My Payslips"
                subtitle="Monthly salary statements and detailed breakdown."
              />
              <Card className="mt-6 p-8 text-center">
                <p className="text-sm font-medium text-rose-400">
                  Forbidden: You do not have permission to view salary slips for staff members outside your assigned departments.
                </p>
                <div className="mt-4">
                  <Link
                    href="/"
                    className="text-xs font-semibold text-acc-2 hover:underline"
                  >
                    ← Back to Dashboard
                  </Link>
                </div>
              </Card>
            </div>
          );
        }
      }
      targetStaffId = requestedStaffId;
    } else {
      targetStaffId = userStaffId ?? null;
    }
  } else {
    // ADMIN: defaults to own staffId or allows ?staffId=
    targetStaffId = requestedStaffId ?? userStaffId ?? null;
  }

  if (!targetStaffId && auth.user.role === "EMPLOYEE") {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <PageHeader
          title="My Payslips"
          subtitle="Monthly salary statements and detailed breakdown."
        />
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm text-muted">
            No linked staff profile found for your account. Please contact an administrator to link your profile.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="text-xs font-semibold text-acc-2 hover:underline"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!targetStaffId) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <PageHeader
          title="My Payslips"
          subtitle="Monthly salary statements and detailed breakdown."
        />
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm text-muted">
            Please specify a valid staff ID to view salary slips.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="text-xs font-semibold text-acc-2 hover:underline"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const payslips = await prisma.monthlyPayroll.findMany({
    where: { staffId: targetStaffId },
    include: {
      staff: {
        include: {
          department: true,
          designation: true,
          payrollInfo: true,
        },
      },
    },
    orderBy: [
      { year: "desc" },
      { month: "desc" },
    ],
  });

  return (
    <MyPayslipsClient
      payslips={payslips}
      userRole={auth.user.role}
      staffId={targetStaffId}
    />
  );
}
