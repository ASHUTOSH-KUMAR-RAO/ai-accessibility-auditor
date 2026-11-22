import { createContext, useContext } from "react"

export interface User {
  id: string
  name: string
  email: string
  createdAt: string
}

export type AuthStatus = "loading" | "authenticated" | "anonymous"

export interface Credentials { email: string; password: string }
export interface Registration extends Credentials { name: string }

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  login: (values: Credentials) => Promise<void>
  register: (values: Registration) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
