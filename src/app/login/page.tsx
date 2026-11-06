'use client'

import { signIn, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button, Card, Field, Input } from "@/components/ui"

export default function LoginPage() {
  const { status } = useSession()
  const [email, setEmail] = useState("")
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
    setSubmitting(true)

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (res?.error) {
        setError("Invalid credentials")
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
      <Card className="w-full max-w-[400px] p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="mb-4 grid size-9 place-items-center rounded-[10px] bg-gradient-to-br from-acc-2 to-acc-3 text-[13px] font-semibold text-ground"
          >
            SE
          </span>
          <h1 className="text-xl font-semibold text-text">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted">Sign in to access your Attendance Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Email" htmlFor="login-email">
            <Input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </Field>

          <Field label="Password" htmlFor="login-password">
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <Button type="submit" variant="primary" loading={submitting} className="w-full">
            Sign In
          </Button>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-[10px] border border-absent/30 px-3 py-2.5 text-sm text-absent"
            >
              <AlertCircle size={16} aria-hidden="true" className="flex-none" />
              {error}
            </div>
          )}
        </form>
      </Card>
    </div>
  )
}
