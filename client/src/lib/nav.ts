/** Single source for header/footer links and the placeholder routes they point to. */
export interface NavItem { to: string; label: string; description: string }

export const PRODUCT_LINKS: NavItem[] = [
  { to: "/features", label: "Features", description: "WCAG scanning, severity scoring and AI-written fixes." },
  { to: "/how-it-works", label: "How it works", description: "From URL to a fixed-code report in four steps." },
]

export const LEGAL_LINKS: NavItem[] = [
  { to: "/privacy", label: "Privacy policy", description: "How we handle the URLs you scan and your account data." },
  { to: "/terms", label: "Terms of service", description: "The rules for using AccessLens." },
  { to: "/accessibility", label: "Accessibility statement", description: "Our own WCAG 2.2 AA commitment." },
]

export const AUTH_LINKS: NavItem[] = [
  { to: "/login", label: "Log in", description: "Accounts arrive with the auth phase." },
  { to: "/signup", label: "Sign up", description: "Accounts arrive with the auth phase." },
]

export const PLACEHOLDER_ROUTES: NavItem[] = [...PRODUCT_LINKS, ...LEGAL_LINKS, ...AUTH_LINKS]
