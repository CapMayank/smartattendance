'use client'

import { signIn, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { IntimeMark, SchoolBadge } from "@/components/brand/Brand"
import { APP_NAME, APP_TAGLINE } from "@/lib/brand"
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
          <IntimeMark size={44} className="mb-4" />
          <h1 className="text-xl font-semibold text-text">Sign in to {APP_NAME}</h1>
          <p className="mt-1.5 text-sm text-muted">{APP_TAGLINE}</p>
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

        <div className="mt-8 border-t border-line-soft pt-5">
          <SchoolBadge centered />
        </div>
      </Card>
    </div>
  )
}
