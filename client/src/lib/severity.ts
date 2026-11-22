import { Circle, Info, OctagonAlert, TriangleAlert, type LucideIcon } from "lucide-react"

export const SEVERITIES = ["critical", "serious", "moderate", "minor"] as const
export type Severity = (typeof SEVERITIES)[number]

interface SeverityMeta {
  label: string
  /** Distinct icon shape per level: colour is never the only signal. */
  icon: LucideIcon
  /** CSS variable holding the validated mark colour */
  cssVar: string
  /** Fill-pattern utility class (see index.css): the third channel after colour and icon */
  pattern: string
  /** Outline style for boxes drawn on the screenshot */
  border: "solid" | "dashed" | "dotted" | "double"
  /** Static class strings so Tailwind can see them */
  chip: string
  iconClass: string
  bar: string
}

export const SEVERITY: Record<Severity, SeverityMeta> = {
  critical: { label: "Critical", icon: OctagonAlert, cssVar: "--sev-critical", pattern: "pat-critical", border: "solid", chip: "border-sev-critical/70 bg-sev-critical/12", iconClass: "text-sev-critical", bar: "bg-sev-critical" },
  serious: { label: "Serious", icon: TriangleAlert, cssVar: "--sev-serious", pattern: "pat-serious", border: "dashed", chip: "border-sev-serious/70 bg-sev-serious/12", iconClass: "text-sev-serious", bar: "bg-sev-serious" },
  moderate: { label: "Moderate", icon: Info, cssVar: "--sev-moderate", pattern: "pat-moderate", border: "dotted", chip: "border-sev-moderate/70 bg-sev-moderate/12", iconClass: "text-sev-moderate", bar: "bg-sev-moderate" },
  minor: { label: "Minor", icon: Circle, cssVar: "--sev-minor", pattern: "pat-minor", border: "double", chip: "border-sev-minor/70 bg-sev-minor/12", iconClass: "text-sev-minor", bar: "bg-sev-minor" },
}

export const severityRank = (s: Severity) => SEVERITIES.indexOf(s)
