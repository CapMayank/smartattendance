'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft, LogOut } from "lucide-react"
import { IntimeMark, SchoolBadge } from "@/components/brand/Brand"
import { Button, Card, Field, Input } from "@/components/ui"

export default function ChangePasswordPage() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const mustChange = Boolean(session?.user?.mustChangePassword)
  const employeeCode = session?.user?.employeeCode

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.")
      return
    }

    if (newPassword === currentPassword) {
      setError("Please choose a password different from your temporary or current password.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Could not update password.")
        setSubmitting(false)
        return
      }

      await update({ mustChangePassword: false })
      setSuccess(true)
      setTimeout(() => {
        window.location.href = "/"
      }, 900)
    } catch {
      setError("Network error while updating password.")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground px-4 py-8">
      <Card className="w-full max-w-[440px] p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <IntimeMark size={44} className="mb-3" />
          <h1 className="text-xl font-semibold text-text">
            {mustChange ? "Set your personal password" : "Change your password"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {mustChange
              ? "You signed in with a one-time temporary password. Choose a new password to unlock your account."
              : "Update the password you use with your Employee ID or email."}
          </p>
          {employeeCode && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-line bg-card-hi px-3 py-1 text-xs">
              <span className="text-muted">Employee ID</span>
              <span className="num font-semibold text-acc-1">{employeeCode}</span>
            </div>
          )}
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-present/30 bg-present/10 p-5 text-center">
            <CheckCircle2 size={28} className="text-present" />
            <p className="text-sm font-medium text-text">Password updated! Redirecting to your dashboard...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label={mustChange ? "Temporary password" : "Current password"}
              htmlFor="current-password"
            >
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current / temporary password"
                required
              />
            </Field>

            <Field
              label="New password"
              htmlFor="new-password"
              helper="Minimum 8 characters. Must be different from your temporary password."
            >
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </Field>

            <Field label="Confirm new password" htmlFor="confirm-password">
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
              />
            </Field>

            {error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-[10px] border border-absent/30 bg-absent/10 px-3 py-2.5 text-sm text-absent"
              >
                <AlertCircle size={16} aria-hidden="true" className="flex-none" />
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              <Button type="submit" variant="primary" icon={KeyRound} loading={submitting} className="w-full">
                Save new password
              </Button>
              {!mustChange ? (
                <Button type="button" variant="secondary" icon={ArrowLeft} onClick={() => router.push("/")} className="w-full">
                  Back to dashboard
                </Button>
              ) : (
                <Button type="button" variant="secondary" icon={LogOut} onClick={() => signOut({ callbackUrl: "/login" })} className="w-full">
                  Sign out
                </Button>
              )}
            </div>
          </form>
        )}

        <div className="mt-7 border-t border-line-soft pt-5">
          <SchoolBadge centered />
        </div>
      </Card>
    </div>
  )
}
