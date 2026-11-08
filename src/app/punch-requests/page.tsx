import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { PunchRequestsClient } from "./PunchRequestsClient";
import { Card, PageHeader } from "@/components/ui";

export default async function PunchRequestsPage({
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
  } else {
    // APPROVER or ADMIN
    targetStaffId = requestedStaffId ?? userStaffId ?? null;
  }

  if (!targetStaffId && auth.user.role === "EMPLOYEE") {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <PageHeader
          title="My Punches & Requests"
          subtitle="View biometric attendance records and manage missed punch requests."
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

  return (
    <PunchRequestsClient
      userRole={auth.user.role}
      staffId={targetStaffId}
    />
  );
}
