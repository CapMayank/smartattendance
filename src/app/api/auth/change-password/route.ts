import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { currentPassword?: string; newPassword?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current password and new password are required" }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
  }

  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: "New password must be different from your current password" },
      { status: 400 }
    )
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || user.disabledAt !== null || !user.password) {
    return NextResponse.json({ error: "Account not found or disabled" }, { status: 403 })
  }

  const isLegacyHash = /^[a-f0-9]{64}$/.test(user.password)
  let validCurrent = false
  if (isLegacyHash) {
    const legacyHash = crypto.createHash("sha256").update(currentPassword).digest("hex")
    validCurrent = user.password === legacyHash
  } else {
    validCurrent = await bcrypt.compare(currentPassword, user.password)
  }

  if (!validCurrent) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 })
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  })

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "PASSWORD_CHANGE",
      targetType: "User",
      targetId: user.id,
      details: JSON.stringify({ changedAt: new Date().toISOString() }),
    },
  })

  return NextResponse.json({ success: true })
}
