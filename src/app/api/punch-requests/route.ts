import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac"
import {
  createPunchRequest,
  listPunchRequests,
  PunchRequestError,
} from "@/lib/punch-request-service"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const auth = await requireRole(session, ["ADMIN", "APPROVER", "EMPLOYEE"])
    if (auth.errorResponse) return auth.errorResponse

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status") ?? undefined
    const date = searchParams.get("date") ?? undefined
    const month = searchParams.get("month") ?? undefined
    const requestedStaffId = searchParams.get("staffId") ?? undefined

    const userRole = auth.user.role
    const userStaffId = auth.user.staffId ?? auth.user.staff?.id

    let effectiveStaffId: string | undefined = requestedStaffId
    let allowedDepartmentIds: string[] | null = null

    if (userRole === "EMPLOYEE") {
      if (!userStaffId) {
        return NextResponse.json([], { status: 200 })
      }
      if (requestedStaffId && requestedStaffId !== userStaffId) {
        return NextResponse.json([], { status: 200 })
      }
      effectiveStaffId = userStaffId
    } else if (userRole === "APPROVER") {
      allowedDepartmentIds = getApproverDepartmentIds(auth.user)
    }

    const requests = await listPunchRequests({
      staffId: effectiveStaffId,
      status,
      date,
      month,
      allowedDepartmentIds,
    })

    return NextResponse.json(requests)
  } catch (error: unknown) {
    if (error instanceof PunchRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("GET /api/punch-requests error:", error)
    return NextResponse.json({ error: "Failed to fetch punch requests" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const auth = await requireRole(session, ["ADMIN", "APPROVER", "EMPLOYEE"])
    if (auth.errorResponse) return auth.errorResponse

    const body = await req.json()
    const userStaffId = auth.user.staffId ?? auth.user.staff?.id
    const targetStaffId =
      auth.user.role === "ADMIN" && body.staffId ? body.staffId : userStaffId

    if (!targetStaffId) {
      return NextResponse.json(
        { error: "User is not linked to a staff record" },
        { status: 400 }
      )
    }

    const created = await createPunchRequest(targetStaffId, body)
    return NextResponse.json(created, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof PunchRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }
    console.error("POST /api/punch-requests error:", error)
    return NextResponse.json({ error: "Failed to create punch request" }, { status: 500 })
  }
}
