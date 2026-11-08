import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac"
import {
  approvePunchRequest,
  cancelPunchRequest,
  rejectPunchRequest,
  PunchRequestError,
} from "@/lib/punch-request-service"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const auth = await requireRole(session, ["ADMIN", "APPROVER", "EMPLOYEE"])
    if (auth.errorResponse) return auth.errorResponse

    const body = await req.json()
    const { action, decisionRemarks } = body

    if (action === "CANCEL") {
      const userStaffId = auth.user.staffId ?? auth.user.staff?.id
      if (!userStaffId) {
        return NextResponse.json(
          { error: "User is not linked to a staff record" },
          { status: 400 }
        )
      }
      const cancelled = await cancelPunchRequest({
        requestId: id,
        staffId: userStaffId,
      })
      return NextResponse.json(cancelled)
    }

    if (action === "APPROVE") {
      if (auth.user.role === "EMPLOYEE") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const allowedDeptIds = getApproverDepartmentIds(auth.user)
      const approved = await approvePunchRequest({
        requestId: id,
        reviewerUserId: auth.user.id,
        reviewerDepartmentIds: allowedDeptIds,
        isApproverRole: auth.user.role === "APPROVER",
        decisionRemarks,
      })
      return NextResponse.json(approved)
    }

    if (action === "REJECT") {
      if (auth.user.role === "EMPLOYEE") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const allowedDeptIds = getApproverDepartmentIds(auth.user)
      const rejected = await rejectPunchRequest({
        requestId: id,
        reviewerUserId: auth.user.id,
        reviewerDepartmentIds: allowedDeptIds,
        isApproverRole: auth.user.role === "APPROVER",
        decisionRemarks,
      })
      return NextResponse.json(rejected)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (error: unknown) {
    if (error instanceof PunchRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("PATCH /api/punch-requests/[id] error:", error)
    return NextResponse.json({ error: "Failed to update punch request" }, { status: 500 })
  }
}
