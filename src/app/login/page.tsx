'use client'

import { signIn, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, IdCard } from "lucide-react"
import { IntimeMark, SchoolBadge } from "@/components/brand/Brand"
import { APP_NAME, APP_TAGLINE } from "@/lib/brand"
import { Button, Card, Field, Input } from "@/components/ui"

export default function LoginPage() {
  const { status } = useSession()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/')
    }
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!identifier.trim() || !password) {
      setError("Enter your Employee ID (or email) and password.")
      return
    }
    setSubmitting(true)

    try {
      const res = await signIn("credentials", {
        identifier: identifier.trim(),
        email: identifier.trim(),
        password,
        redirect: false,
      })

      if (res?.error) {
        setError("Invalid Employee ID / email or password.")
        setSubmitting(false)
      } else {
        window.location.href = "/"
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ground px-4 py-8">
      <Card className="w-full max-w-[420px] p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <IntimeMark size={44} className="mb-4" />
          <h1 className="text-xl font-semibold text-text">Sign in to {APP_NAME}</h1>
          <p className="mt-1.5 text-sm text-muted">{APP_TAGLINE}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field
            label="Employee ID or email"
            htmlFor="login-identifier"
            helper="Example: SAR-2024-001 (spaces or hyphens optional) or admin email"
          >
            <Input
              id="login-identifier"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="SAR-2024-001 or admin@school.edu"
              required
            />
          </Field>

          <Field
            label="Password"
            htmlFor="login-password"
            helper="First-time sign in? Use the temporary password given by your administrator."
          >
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>

          <Button type="submit" variant="primary" loading={submitting} className="w-full">
            Sign in
          </Button>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-[10px] border border-absent/30 bg-absent/10 px-3 py-2.5 text-sm text-absent"
            >
              <AlertCircle size={16} aria-hidden="true" className="flex-none" />
              {error}
            </div>
          )}
        </form>

        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-line-soft bg-canvas p-3 text-xs text-muted">
          <IdCard size={16} className="mt-0.5 flex-none text-acc-2" aria-hidden="true" />
          <span>
            Forgot your password or don&apos;t have your Employee ID yet? Ask the school office administrator to issue or reset your temporary password from the Staff page.
          </span>
        </div>

        <div className="mt-7 border-t border-line-soft pt-5">
          <SchoolBadge centered />
        </div>
      </Card>
    </div>
  )
}
