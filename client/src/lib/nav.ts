/** Single source for header/footer links. */
export interface NavItem { to: string; label: string; description: string }

export const PRODUCT_LINKS: NavItem[] = [
  { to: "/features", label: "Features", description: "Everything AccessLens does, in detail." },
  { to: "/sample", label: "Sample report", description: "A real report you can open without an account." },
  { to: "/#how-it-works", label: "How it works", description: "From URL to a fixed-code report in four steps." },
  { to: "/#faq", label: "FAQ", description: "Short answers to common questions." },
]

export const LEGAL_LINKS: NavItem[] = [
  { to: "/privacy", label: "Privacy policy", description: "How we handle the URLs you scan and your account data." },
  { to: "/terms", label: "Terms of service", description: "The rules for using AccessLens." },
  { to: "/cookies", label: "Cookies and storage", description: "What AccessLens stores in your browser." },
]

export const AUTH_LINKS: NavItem[] = [
  { to: "/login", label: "Log in", description: "Sign in to your account." },
  { to: "/signup", label: "Sign up", description: "Create your account." },
]

/** Sidebar of the signed-in app. */
export const APP_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/scans", label: "All scans", icon: "history" },
  { to: "/sites", label: "My sites", icon: "globe" },
  { to: "/sample", label: "Sample report", icon: "sample" },
] as const
