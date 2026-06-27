import { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "./prisma"

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Check if there are any users in the database
        const userCount = await prisma.user.count()
        
        // If DB is empty, use default and auto-create the admin user
        const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com"
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin"

        if (userCount === 0 && credentials.email === defaultEmail && credentials.password === defaultPassword) {
          const crypto = require('crypto')
          const hash = crypto.createHash('sha256').update(defaultPassword).digest('hex')
          const admin = await prisma.user.create({
            data: {
              name: "Super Admin",
              email: defaultEmail,
              password: hash
            }
          })
          return { id: admin.id, name: admin.name, email: admin.email }
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        })

        if (user && user.password) {
          const crypto = require('crypto')
          const hash = crypto.createHash('sha256').update(credentials.password).digest('hex')
          
          if (user.password === hash) {
            return { id: user.id, name: user.name, email: user.email }
          }
        }

        return null
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    }
  },
  pages: {
    signIn: '/login'
  }
}
