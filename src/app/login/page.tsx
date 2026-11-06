'use client'

import { signIn, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Activity } from "lucide-react"
import { Button, Card, Field, Input } from "@/components/ui"

export default function LoginPage() {
  const { status } = useSession()
  const [email, setEmail] = useState("admin@example.com")
  const [password, setPassword] = useState("admin")
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/')
    }
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    if (res?.error) {
      setError("Invalid credentials")
    } else {
      window.location.href = "/"
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-md bg-accent text-white">
            <Activity className="w-5 h-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-fg leading-tight">SEHSS Lakhnadon</p>
            <p className="text-xs text-subtle leading-tight">Attendance &amp; Payroll</p>
          </div>
        </div>

        <Card className="p-6">
          <h1 className="text-xl font-semibold text-fg tracking-tight">Sign in</h1>
          <p className="text-sm text-muted mt-1 mb-6">Use your administrator account to continue.</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="p-3 text-sm text-danger bg-danger-soft rounded-md">
                {error}
              </div>
            )}

            <Field label="Email">
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            <Button type="submit" variant="primary" className="w-full">
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
