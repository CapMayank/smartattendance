import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmployeePortalData } from "@/lib/employee-portal";
import { EmployeeProfileClient, type ProfileRequestItem } from "./EmployeeProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
    return null;
  }

  const user = session.user as { staffId?: string | null; staff?: { id: string } };
  const staffId = user.staffId ?? user.staff?.id;
  if (!staffId) {
    redirect("/login");
    return null;
  }

  const [portalData, rawRequests] = await Promise.all([
    getEmployeePortalData(staffId),
    prisma.profileChangeRequest.findMany({
      where: { staffId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!portalData) {
    redirect("/login");
    return null;
  }

  const requests: ProfileRequestItem[] = rawRequests.map((r) => ({
    id: r.id,
    staffId: r.staffId,
    status: r.status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "PARTIALLY_APPROVED",
    requestedData: r.requestedData,
    currentData: r.currentData,
    reason: r.reason,
    decidedByUserId: r.decidedByUserId,
    decidedAt: r.decidedAt
      ? typeof r.decidedAt === "string"
        ? r.decidedAt
        : r.decidedAt.toISOString()
      : null,
    decisionRemarks: r.decisionRemarks,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : r.createdAt.toISOString(),
  }));

  return (
    <EmployeeProfileClient
      initialData={{
        profile: portalData.profile,
        requests,
      }}
    />
  );
}
