'use client'

import { useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, IdCard } from "lucide-react"
import { IntimeMark, SchoolBadge } from "@/components/brand/Brand"
import { APP_NAME, APP_TAGLINE } from "@/lib/brand"
import { Button, Card, Field, Input } from "@/components/ui"

/**
 * Credentials sign-in against the NextAuth endpoints.
 *
 * next-auth's own `signIn(..., { redirect: false })` parses the URL in the response with
 * `new URL(url)`, which throws for relative URLs. Our `redirect` callback returns relative
 * URLs on purpose (so users are never sent to the server's internal address), which made
 * every sign-in, successful or not, end in a thrown error. Posting the form ourselves lets
 * the URL be resolved against the current origin instead.
 */
async function signInWithCredentials(identifier: string, password: string): Promise<"ok" | "invalid"> {
  const csrfRes = await fetch("/api/auth/csrf")
  if (!csrfRes.ok) throw new Error("csrf request failed")
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  const res = await fetch("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken,
      identifier,
      email: identifier,
      password,
      callbackUrl: "/",
      json: "true",
    }),
  })
  // Wrong credentials answer 401; anything else unexpected is a server problem
  if (res.status === 401) return "invalid"
  if (!res.ok) throw new Error(`sign-in failed with status ${res.status}`)

  const data = (await res.json().catch(() => ({}))) as { url?: string }
  const error = data.url ? new URL(data.url, window.location.origin).searchParams.get("error") : null
  return error ? "invalid" : "ok"
}

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
      const result = await signInWithCredentials(identifier.trim(), password)

      if (result === "invalid") {
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
