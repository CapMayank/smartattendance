import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { getToSchoolData } from "@/lib/to-school";
import { istDateKey } from "@/lib/dashboard-calc";
import { ToSchoolClient } from "./ToSchoolClient";
import { Card, PageHeader } from "@/components/ui";

export default async function ToSchoolPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const auth = await requireRole(session, ["EMPLOYEE", "APPROVER", "ADMIN"]);
  if (auth.errorResponse) {
    redirect("/login");
  }

  const sp = await searchParams;
  const requestedStaffId = typeof sp.staffId === "string" ? sp.staffId : undefined;
  const userStaffId = auth.user.staffId ?? auth.user.staff?.id;

  let targetStaffId: string | null = null;

  if (auth.user.role === "EMPLOYEE") {
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
                title="ToSchool Calendar"
                subtitle="View monthly attendance calendar and compliance index."
              />
              <Card className="mt-6 p-8 text-center">
                <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                  Forbidden: You do not have permission to view attendance records for staff members outside your assigned departments.
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
    // ADMIN
    targetStaffId = requestedStaffId ?? userStaffId ?? null;
  }

  if (!targetStaffId) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <PageHeader
          title="ToSchool Calendar"
          subtitle="View monthly attendance calendar and compliance index."
        />
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm text-muted">
            No linked staff profile found for your account. Please contact an administrator.
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

  const now = new Date();
  const todayKey = istDateKey(now);
  const [curYearStr, curMonthStr] = todayKey.split("-");
  const defaultYear = parseInt(curYearStr, 10);
  const defaultMonth = parseInt(curMonthStr, 10);

  const yearParam = typeof sp.year === "string" ? parseInt(sp.year, 10) : defaultYear;
  const monthParam = typeof sp.month === "string" ? parseInt(sp.month, 10) : defaultMonth;

  const year = !Number.isNaN(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : defaultYear;
  const month = !Number.isNaN(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : defaultMonth;

  const data = await getToSchoolData(targetStaffId, year, month, now);

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <PageHeader
          title="ToSchool Calendar"
          subtitle="View monthly attendance calendar and compliance index."
        />
        <Card className="mt-6 p-8 text-center">
          <p className="text-sm text-muted">
            Staff record could not be loaded. Please check that the profile exists and is active.
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

  return <ToSchoolClient initialData={data} staffId={targetStaffId} />;
}
