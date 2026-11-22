/** Title and description of every public page. Used by the pages (while navigating) AND by the build-time prerender (in the HTML). */
export interface RouteMeta { title: string; description: string; path: string }

export const ROUTE_META = {
  home: { path: "/", title: "AccessLens: AI website accessibility auditor", description: "Scan any website for WCAG accessibility problems. See exactly where they are, get plain-English explanations and AI-written fixes that are verified with axe-core." },
  features: { path: "/features", title: "Features", description: "WCAG scanning, verified AI fixes, a screenshot issue map, vision simulator, keyboard tab-order map, PDF reports, share links, comparisons and trends." },
  sample: { path: "/sample", title: "Sample accessibility report", description: "Explore a real AccessLens report without an account: issue map, vision simulator, keyboard path and AI fixes for a deliberately inaccessible page." },
  privacy: { path: "/privacy", title: "Privacy policy", description: "What AccessLens stores, what it sends to its AI provider, how share links work and how to delete your data." },
  terms: { path: "/terms", title: "Terms of service", description: "The rules for using AccessLens: acceptable use, scanning only sites you may test, AI output, limits and liability." },
  cookies: { path: "/cookies", title: "Cookies and storage", description: "The essential cookie and browser storage keys AccessLens uses. No advertising, no analytics, no tracking." },
} as const satisfies Record<string, RouteMeta>

export const PRERENDERED_PATHS: string[] = Object.values(ROUTE_META).map((m) => m.path)
