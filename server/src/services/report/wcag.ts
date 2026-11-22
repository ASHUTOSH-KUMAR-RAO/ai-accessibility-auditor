export type Principle = "perceivable" | "operable" | "understandable" | "robust"
export type Level = "A" | "AA" | "AAA"
/** What a rule is filed under in the report: a WCAG level, or axe's non-normative best practices. */
export type RuleLevel = "A" | "AA" | "best-practice"

export const PRINCIPLES: Array<{ id: Principle; name: string }> = [
  { id: "perceivable", name: "Perceivable" },
  { id: "operable", name: "Operable" },
  { id: "understandable", name: "Understandable" },
  { id: "robust", name: "Robust" },
]
const PRINCIPLE_BY_DIGIT: Record<string, Principle> = { "1": "perceivable", "2": "operable", "3": "understandable", "4": "robust" }

// WCAG 2.2 success criteria: "id name level".
const TABLE = `
1.1.1 Non-text Content A
1.2.1 Audio-only and Video-only (Prerecorded) A
1.2.2 Captions (Prerecorded) A
1.2.3 Audio Description or Media Alternative (Prerecorded) A
1.2.4 Captions (Live) AA
1.2.5 Audio Description (Prerecorded) AA
1.2.6 Sign Language (Prerecorded) AAA
1.2.7 Extended Audio Description (Prerecorded) AAA
1.2.8 Media Alternative (Prerecorded) AAA
1.2.9 Audio-only (Live) AAA
1.3.1 Info and Relationships A
1.3.2 Meaningful Sequence A
1.3.3 Sensory Characteristics A
1.3.4 Orientation AA
1.3.5 Identify Input Purpose AA
1.3.6 Identify Purpose AAA
1.4.1 Use of Color A
1.4.2 Audio Control A
1.4.3 Contrast (Minimum) AA
1.4.4 Resize Text AA
1.4.5 Images of Text AA
1.4.6 Contrast (Enhanced) AAA
1.4.7 Low or No Background Audio AAA
1.4.8 Visual Presentation AAA
1.4.9 Images of Text (No Exception) AAA
1.4.10 Reflow AA
1.4.11 Non-text Contrast AA
1.4.12 Text Spacing AA
1.4.13 Content on Hover or Focus AA
2.1.1 Keyboard A
2.1.2 No Keyboard Trap A
2.1.3 Keyboard (No Exception) AAA
2.1.4 Character Key Shortcuts A
2.2.1 Timing Adjustable A
2.2.2 Pause, Stop, Hide A
2.2.3 No Timing AAA
2.2.4 Interruptions AAA
2.2.5 Re-authenticating AAA
2.2.6 Timeouts AAA
2.3.1 Three Flashes or Below Threshold A
2.3.2 Three Flashes AAA
2.3.3 Animation from Interactions AAA
2.4.1 Bypass Blocks A
2.4.2 Page Titled A
2.4.3 Focus Order A
2.4.4 Link Purpose (In Context) A
2.4.5 Multiple Ways AA
2.4.6 Headings and Labels AA
2.4.7 Focus Visible AA
2.4.8 Location AAA
2.4.9 Link Purpose (Link Only) AAA
2.4.10 Section Headings AAA
2.4.11 Focus Not Obscured (Minimum) AA
2.4.12 Focus Not Obscured (Enhanced) AAA
2.4.13 Focus Appearance AAA
2.5.1 Pointer Gestures A
2.5.2 Pointer Cancellation A
2.5.3 Label in Name A
2.5.4 Motion Actuation A
2.5.5 Target Size (Enhanced) AAA
2.5.6 Concurrent Input Mechanisms AAA
2.5.7 Dragging Movements AA
2.5.8 Target Size (Minimum) AA
3.1.1 Language of Page A
3.1.2 Language of Parts AA
3.1.3 Unusual Words AAA
3.1.4 Abbreviations AAA
3.1.5 Reading Level AAA
3.1.6 Pronunciation AAA
3.2.1 On Focus A
3.2.2 On Input A
3.2.3 Consistent Navigation AA
3.2.4 Consistent Identification AA
3.2.5 Change on Request AAA
3.2.6 Consistent Help A
3.3.1 Error Identification A
3.3.2 Labels or Instructions A
3.3.3 Error Suggestion AA
3.3.4 Error Prevention (Legal, Financial, Data) AA
3.3.5 Help AAA
3.3.6 Error Prevention (All) AAA
3.3.7 Redundant Entry A
3.3.8 Accessible Authentication (Minimum) AA
3.3.9 Accessible Authentication (Enhanced) AAA
4.1.1 Parsing A
4.1.2 Name, Role, Value A
4.1.3 Status Messages AA
`

export interface Criterion {
  id: string
  name: string
  level: Level
  principle: Principle
  /** W3C "Understanding" page for this criterion */
  url: string
}

const slug = (name: string) => name.toLowerCase().replace(/[()',]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

const CRITERIA = new Map<string, Criterion>(
  TABLE.trim()
    .split("\n")
    .map((line) => {
      const [id, ...rest] = line.split(" ")
      const level = rest.pop() as Level
      const name = rest.join(" ")
      return [id!, { id: id!, name, level, principle: PRINCIPLE_BY_DIGIT[id![0]!]!, url: `https://www.w3.org/WAI/WCAG22/Understanding/${slug(name)}.html` }]
    }),
)

/** axe tags "wcag143" / "wcag2411" → "1.4.3" / "2.4.11". Level tags such as "wcag2aa" don't match. */
export function criterionIds(tags: string[]): string[] {
  return tags.flatMap((t) => {
    const m = /^wcag(\d)(\d)(\d{1,2})$/.exec(t)
    return m ? [`${m[1]}.${m[2]}.${m[3]}`] : []
  })
}

export function criteriaFor(tags: string[]): Criterion[] {
  return criterionIds(tags).flatMap((id) => {
    const c = CRITERIA.get(id)
    return c ? [c] : []
  })
}

/** A principle for the rule: that of its first WCAG criterion. Best-practice rules have none. */
export const principleFor = (criteria: Criterion[]): Principle | null => criteria[0]?.principle ?? null

/**
 * The level a rule is filed under, straight from axe's own tags: the lowest WCAG level it carries
 * (A before AA), or "best-practice" when it maps to no WCAG criterion.
 */
export function levelFor(tags: string[]): RuleLevel {
  if (tags.includes("wcag2a") || tags.includes("wcag21a") || tags.includes("wcag22a")) return "A"
  if (tags.includes("wcag2aa") || tags.includes("wcag21aa") || tags.includes("wcag22aa")) return "AA"
  return "best-practice"
}
