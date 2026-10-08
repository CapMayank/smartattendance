'use client'

import { signIn, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

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
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md p-8 rounded-2xl bg-white/[0.025] backdrop-blur-xl border border-white/[0.07] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-100">
            Welcome Back
          </h1>
          <p className="text-slate-500 mt-2 text-sm">
            Sign in to access your Attendance Dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-rose-400 bg-rose-400/[0.08] border border-rose-400/20 rounded-lg text-center">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.07] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 text-slate-200 transition-all placeholder:text-slate-600"
              placeholder="admin@example.com"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.07] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 text-slate-200 transition-all placeholder:text-slate-600"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all duration-200 active:scale-[0.98]"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
