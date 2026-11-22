import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/context/auth-store"

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("")

/** Shared sign-out flow: leave the protected area first so no redirect-to-login flash happens. */
export function useSignOut() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return async () => {
    navigate("/")
    await logout()
    toast.success("You're signed out")
  }
}
