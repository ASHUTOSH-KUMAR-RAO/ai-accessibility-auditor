import { History, LayoutDashboard, LogOut } from "lucide-react"
import { Link } from "react-router-dom"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { User } from "@/context/auth-store"
import { initials, useSignOut } from "@/lib/user"

export function UserMenu({ user }: { user: User }) {
  const signOut = useSignOut()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${user.name}`}
        className="cursor-pointer rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-[3px] focus-visible:ring-offset-background"
      >
        <Avatar className="size-11">
          {/* initials are drawn via CSS so they are not text content (WCAG 2.5.3 label-in-name) */}
          <AvatarFallback data-initials={initials(user.name)} className="bg-foreground text-sm font-semibold text-background after:content-[attr(data-initials)]" />
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" landmarkLabel="Account">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2">
            <span className="block truncate text-base font-semibold text-foreground">{user.name}</span>
            <span className="block truncate text-sm font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/dashboard" />}><LayoutDashboard aria-hidden="true" />Dashboard</DropdownMenuItem>
        <DropdownMenuItem render={<Link to="/scans" />}><History aria-hidden="true" />All scans</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void signOut()}><LogOut aria-hidden="true" />Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
