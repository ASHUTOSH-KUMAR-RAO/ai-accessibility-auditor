import { analyzeContrast } from "./contrast.js"
import type { Effort, FixContent } from "./schemas.js"

// "Guided fix (no AI)": rule-based fixes for the most common axe rules. Used when AI is off, slow, rate limited or wrong.

type Test = FixContent["test"][number]
interface Edit { html?: string; css?: string }
interface RuleGuide {
  /** What is wrong, why it matters, who is affected (<= ~80 words) */
  why: string
  steps: string[]
  test: Test[]
  effort: Effort
  /** Mechanical change to the failing element, when one exists */
  edit?: (html: string) => Edit
}

// ── tiny HTML helpers (operate on the first/opening tag only) ──
const OPEN_TAG = /^<([a-z][a-z0-9-]*)((?:\s[^<>]*?)?)(\s*\/?)>/i
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
const attrRe = (name: string) => new RegExp(`\\s${name}(?:\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+))?(?=[\\s/>]|$)`, "i")

export function getAttr(html: string, name: string): string | null {
  const m = OPEN_TAG.exec(html.trim())
  const a = m && attrRe(name).exec(m[2]!)
  return a ? (a[1] ?? "").replace(/^["']|["']$/g, "") : null
}
export function setAttr(html: string, name: string, value: string): string {
  const src = html.trim()
  const m = OPEN_TAG.exec(src)
  if (!m) return html
  const next = ` ${name}="${esc(value)}"`
  const attrs = attrRe(name).test(m[2]!) ? m[2]!.replace(attrRe(name), next) : m[2]! + next
  return `<${m[1]}${attrs}${m[3]}>` + src.slice(m[0].length)
}
export function removeAttr(html: string, name: string): string {
  const src = html.trim()
  const m = OPEN_TAG.exec(src)
  return m ? `<${m[1]}${m[2]!.replace(attrRe(name), "")}${m[3]}>` + src.slice(m[0].length) : html
}

const VOID = new Set(["img", "input", "br", "hr", "meta", "link", "area", "col", "source", "track", "wbr"])
/** HTML → JSX for simple snippets. Returns null when a faithful conversion is not mechanical (inline styles, comments). */
export function toJsx(html: string): string | null {
  if (/\sstyle\s*=|<!--/.test(html)) return null
  const names: Record<string, string> = { class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength", colspan: "colSpan", rowspan: "rowSpan", "accept-charset": "acceptCharset" }
  return html
    .replace(/<([a-z][a-z0-9-]*)((?:\s[^<>]*?)?)(\s*\/?)>/gi, (_m, tag: string, attrs: string, close: string) => {
      const fixed = attrs.replace(/\s([a-z][a-z-]*)(?==)/gi, (_a, n: string) => ` ${names[n.toLowerCase()] ?? n}`)
      return `<${tag}${fixed}${close.trim() === "/" || VOID.has(tag.toLowerCase()) ? " /" : ""}>`
    })
}

// ── test snippets ──
const kb = (text: string): Test => ({ method: "keyboard", text })
const sr = (text: string): Test => ({ method: "screen-reader", text })
const visual = (text: string): Test => ({ method: "visual", text })
const nameStep = (what: string) => [
  `Decide what ${what} does or shows for someone who cannot see it.`,
  "Add that text as visible content, or as an aria-label when a visible label is not possible.",
  "Keep it short and specific: avoid words like “click here” or “image”.",
]
const nameTest = [sr("Tab to the element with a screen reader on: it should announce a meaningful name and its role.")]

const GUIDES: Record<string, RuleGuide> = {
  "image-alt": {
    why: "This image has no text alternative, so screen readers skip it or read out the file name. Blind and low-vision visitors miss whatever the image shows, and images used as links or buttons become unusable.",
    steps: ["Describe what the image conveys in the page's context, in a short phrase.", "Put it in the alt attribute (replace the bracketed text below).", 'If the image is purely decorative, use alt="" instead.'],
    test: [sr("Move over the image with a screen reader: it should read your description, not a file name."), visual("Turn off images in the browser: the alt text should appear in its place.")],
    effort: "quick",
    edit: (h) => ({ html: setAttr(h, "alt", "[Describe the image]") }),
  },
  "input-image-alt": {
    why: "An image button without alternative text has no name, so screen-reader and voice-control users cannot tell what it does.",
    steps: nameStep("this image button"),
    test: nameTest,
    effort: "quick",
    edit: (h) => ({ html: setAttr(h, "alt", "[What the button does]") }),
  },
  "role-img-alt": { why: "An element exposed as an image has no text alternative, so assistive technology cannot describe it.", steps: nameStep("this graphic"), test: nameTest, effort: "quick", edit: (h) => ({ html: setAttr(h, "aria-label", "[Describe the graphic]") }) },
  "svg-img-alt": { why: "This SVG is marked as an image but has no accessible text, so screen readers cannot describe it.", steps: nameStep("this graphic"), test: nameTest, effort: "quick", edit: (h) => ({ html: setAttr(h, "aria-label", "[Describe the graphic]") }) },
  "button-name": {
    why: "This button has no accessible name, so a screen reader just says “button”. Blind users and voice-control users cannot tell what it does or how to activate it.",
    steps: nameStep("this button"),
    test: [...nameTest, kb("Tab to the button and press Enter or Space: it should still work.")],
    effort: "quick",
    edit: (h) => ({ html: setAttr(h, "aria-label", "[What the button does]") }),
  },
  "input-button-name": { why: "This input button has no value or label, so its purpose is unknown to assistive technology.", steps: nameStep("this button"), test: nameTest, effort: "quick", edit: (h) => ({ html: setAttr(h, "value", "[What the button does]") }) },
  "link-name": {
    why: "This link has no discernible text, so a screen reader announces only “link”. Blind and keyboard users cannot tell where it goes, and voice-control users cannot say its name.",
    steps: nameStep("this link"),
    test: [...nameTest, kb("Tab to the link: focus should be visible and Enter should follow it.")],
    effort: "quick",
    edit: (h) => ({ html: setAttr(h, "aria-label", "[Where the link goes]") }),
  },
  label: {
    why: "This form field has no label. Screen readers cannot say what to type, voice-control users cannot target it, and anyone with a small click target loses the label's larger hit area.",
    steps: ["Add a visible <label> next to the field.", "Connect them: the label's for must equal the field's id.", "Avoid using placeholder text as the only label."],
    test: [sr("Tab into the field: the label text should be announced."), visual("Click the label: the field should receive focus.")],
    effort: "quick",
    edit: (h) => {
      const id = getAttr(h, "id") || "field-name"
      return { html: `<label for="${esc(id)}">[Field name]</label>\n${getAttr(h, "id") ? h.trim() : setAttr(h, "id", id)}` }
    },
  },
  "select-name": { why: "This dropdown has no label, so screen-reader and voice-control users cannot tell what it chooses.", steps: ["Add a visible <label> for the select.", "Match the label's for to the select's id."], test: nameTest, effort: "quick", edit: (h) => ({ html: `<label for="${esc(getAttr(h, "id") || "select-name")}">[What you are choosing]</label>\n${getAttr(h, "id") ? h.trim() : setAttr(h, "id", "select-name")}` }) },
  "frame-title": { why: "An iframe without a title is announced as an unnamed frame, so screen-reader users must enter it to learn what it contains.", steps: ["Add a title attribute that describes the frame's content."], test: nameTest, effort: "quick", edit: (h) => ({ html: setAttr(h, "title", "[Describe the frame content]") }) },
  "html-has-lang": {
    why: "The page does not declare its language, so screen readers may read it in the wrong accent and unintelligibly. It also breaks automatic translation and hyphenation.",
    steps: ["Add a lang attribute to the <html> element with the page's main language.", "Use a valid BCP 47 code such as en, fr or pt-BR."],
    test: [sr("Open the page with a screen reader: the voice should match the page language.")],
    effort: "quick",
    edit: (h) => ({ html: setAttr(h, "lang", "en") }),
  },
  "html-lang-valid": { why: "The lang attribute on <html> is not a valid language code, so screen readers cannot pick the right voice.", steps: ["Replace it with a valid BCP 47 code such as en or de-AT."], test: [sr("Open the page with a screen reader: pronunciation should match the language.")], effort: "quick", edit: (h) => ({ html: setAttr(h, "lang", "en") }) },
  "valid-lang": { why: "A lang attribute inside the page holds an invalid code, so screen readers may mispronounce that passage.", steps: ["Use a valid BCP 47 language code on that element."], test: [sr("Read the passage with a screen reader: it should switch to the right voice.")], effort: "quick", edit: (h) => ({ html: setAttr(h, "lang", "en") }) },
  "document-title": {
    why: "The page has no <title>. It is the first thing a screen reader announces and the label of the browser tab, history and bookmarks, so people cannot tell pages apart.",
    steps: ["Add a <title> inside <head>.", "Make it unique and descriptive: page name first, then site name."],
    test: [sr("Load the page: the title should be announced first."), visual("Check the browser tab text.")],
    effort: "quick",
    edit: () => ({ html: "<title>[Page name] – [Site name]</title>" }),
  },
  "meta-viewport": { why: "The viewport tag blocks zooming, so low-vision users cannot enlarge the page on mobile.", steps: ["Remove user-scalable=no and any maximum-scale below 5."], test: [visual("Pinch-zoom on a phone: the page should scale.")], effort: "quick", edit: () => ({ html: '<meta name="viewport" content="width=device-width, initial-scale=1">' }) },
  tabindex: {
    why: "A positive tabindex forces this element ahead of the natural tab order, which confuses keyboard users and screen-reader users who expect a logical sequence.",
    steps: ["Remove the positive tabindex.", "Reorder the HTML instead so the source order matches the visual order."],
    test: [kb("Press Tab through the page: focus should move in reading order.")],
    effort: "quick",
    edit: (h) => ({ html: removeAttr(h, "tabindex") }),
  },
  "link-in-text-block": {
    why: "Links inside text are told apart only by colour, so colour-blind and low-vision visitors cannot see them.",
    steps: ["Underline links within text, or add another non-colour cue such as bold weight."],
    test: [visual("View the page in greyscale: the links should still stand out.")],
    effort: "quick",
    edit: () => ({ css: "a {\n  text-decoration: underline;\n}" }),
  },
  "target-size": { why: "This control is smaller than 24 × 24 CSS pixels, which is hard to hit for people with tremors, large fingers or on touch screens.", steps: ["Give the control at least 24 × 24 px of clickable area (padding counts)."], test: [visual("Tap the control on a phone: it should be easy to hit without catching neighbours.")], effort: "quick", edit: () => ({ css: ".target {\n  min-width: 24px;\n  min-height: 24px;\n}" }) },
  "heading-order": { why: "Heading levels skip (for example h2 straight to h4). Screen-reader users navigate by headings, so gaps make the page outline misleading.", steps: ["Change the heading to the next level after its parent (h2 → h3).", "Style with CSS instead of picking a level for its size."], test: [sr("List the headings (e.g. NVDA: Insert+F7): levels should descend one step at a time.")], effort: "medium" },
  "empty-heading": { why: "An empty heading adds a blank stop to the page outline for screen-reader users.", steps: ["Add meaningful text to the heading, or remove the element if it is only for spacing."], test: [sr("List headings: none should be blank.")], effort: "quick" },
  "page-has-heading-one": { why: "The page has no main heading, so screen-reader users cannot jump to its start or tell what it is about.", steps: ["Add one <h1> that names the page's main topic."], test: [sr("Press H in browse mode: the first heading should be the page's h1.")], effort: "quick" },
  "landmark-one-main": { why: "The page has no <main> landmark, so keyboard and screen-reader users cannot skip straight to the content.", steps: ["Wrap the page's primary content in a single <main> element."], test: [sr("Open the landmark list: “main” should be present once.")], effort: "quick" },
  region: { why: "Some content sits outside any landmark, so screen-reader users navigating by region will miss it.", steps: ["Place the content inside <header>, <nav>, <main>, <aside> or <footer> as appropriate."], test: [sr("Open the landmark list: all visible content should sit within one.")], effort: "medium" },
  bypass: { why: "There is no way to skip repeated navigation, so keyboard users must tab through every menu link on every page.", steps: ["Add a “Skip to main content” link as the first focusable element.", "Point it at the id of <main>."], test: [kb("Press Tab once on page load: the skip link should appear and Enter should jump past the menu.")], effort: "quick" },
  "color-contrast": {
    why: "The text colour is too close to its background, so people with low vision, colour blindness, or anyone in bright sunlight struggle to read it.",
    steps: ["Replace the text or background colour with the suggested accessible colour.", "Apply it in your stylesheet or design tokens so every use of this pair is fixed.", "Re-check hover, focus and disabled states."],
    test: [{ method: "contrast", text: "Check the new pair in a contrast checker: it must reach the required ratio." }, visual("Zoom to 200%: the text should remain easy to read.")],
    effort: "quick",
  },
  "aria-hidden-focus": { why: "A focusable element sits inside aria-hidden content, so keyboard users can land on something screen readers cannot see.", steps: ["Remove aria-hidden, or make the content unfocusable (tabindex=\"-1\", disabled, or hidden)."], test: [kb("Tab through the region: focus must not enter hidden content.")], effort: "medium" },
  "nested-interactive": { why: "Interactive controls are nested inside one another, which many screen readers cannot announce or operate.", steps: ["Make the controls siblings instead of parent and child."], test: [sr("Tab through: each control should be announced separately.")], effort: "medium" },
  "scrollable-region-focusable": { why: "A scrolling area cannot be reached by keyboard, so keyboard users cannot read its overflow.", steps: ["Add tabindex=\"0\" to the scrollable container (and a label if it holds distinct content)."], test: [kb("Tab to the area, then scroll with the arrow keys.")], effort: "quick" },
  "aria-required-attr": { why: "This ARIA role is missing attributes it must have, so assistive technology reports an incomplete widget.", steps: ["Add the required aria-* attributes listed in the failure details.", "Prefer native HTML elements over custom ARIA roles."], test: [sr("Navigate to the widget: its state should be announced.")], effort: "medium" },
  "aria-valid-attr-value": { why: "An ARIA attribute has an invalid value, such as a pointer to an id that does not exist, so assistive technology ignores it.", steps: ["Correct the value, or the id it points at."], test: [sr("Check the control is announced with the intended name or state.")], effort: "quick" },
  "aria-valid-attr": { why: "An aria-* attribute is misspelled or unknown, so it does nothing.", steps: ["Fix the attribute name or remove it."], test: [sr("Check the control announces correctly.")], effort: "quick" },
  "aria-allowed-attr": { why: "An ARIA attribute is not allowed on this role, so it is ignored or announced wrongly.", steps: ["Remove the attribute or change the role."], test: [sr("Check the control announces correctly.")], effort: "quick" },
  "aria-roles": { why: "The role value is not a valid ARIA role, so assistive technology falls back to a generic element.", steps: ["Use a valid role, or better, a native element."], test: [sr("Check the control is announced with the right role.")], effort: "quick" },
  "aria-input-field-name": { why: "This custom input has no accessible name, so screen-reader users cannot tell what to enter.", steps: nameStep("this field"), test: nameTest, effort: "quick", edit: (h) => ({ html: setAttr(h, "aria-label", "[Field name]") }) },
  "duplicate-id": { why: "Two elements share one id, so labels, anchors and ARIA references can point at the wrong element.", steps: ["Make every id on the page unique."], test: [sr("Check labelled controls announce their own label.")], effort: "quick" },
  list: { why: "A list contains elements that are not list items, so screen readers announce the wrong number of items.", steps: ["Make only <li> elements direct children of <ul>/<ol>."], test: [sr("Navigate to the list: it should announce the correct item count.")], effort: "quick" },
  listitem: { why: "A list item is outside a list, so it is not announced as part of one.", steps: ["Wrap it in <ul> or <ol>."], test: [sr("Navigate to the item: it should announce “list”.")], effort: "quick" },
}

const GENERIC: RuleGuide = {
  why: "axe-core found this element breaks a WCAG rule, so some visitors using assistive technology may be blocked or confused.",
  steps: ["Read the rule description and failure details for this element.", "Apply the suggested change in your source.", "Re-scan the page to confirm the issue is gone."],
  test: [kb("Use the page with only the keyboard (Tab, Shift+Tab, Enter, Space)."), sr("Check the element is announced clearly with a screen reader.")],
  effort: "medium",
}

export const effortFor = (ruleId: string): Effort => (GUIDES[ruleId] ?? GENERIC).effort
export const whyFor = (ruleId: string): string | null => GUIDES[ruleId]?.why ?? null
export const hasGuide = (ruleId: string) => ruleId in GUIDES

export interface GuidedInput { ruleId: string; help: string; html: string; failureSummary: string }

export function guidedFix({ ruleId, help, html, failureSummary }: GuidedInput): FixContent {
  const guide = GUIDES[ruleId] ?? { ...GENERIC, why: `${help}. ${GENERIC.why}` }
  const edit = guide.edit?.(html)
  const contrast = ruleId === "color-contrast" ? analyzeContrast(failureSummary) : null
  const best = contrast?.suggestions[0]
  let cssFix = edit?.css ?? null
  let fixedHtml = edit?.html ?? null
  let steps = guide.steps
  if (contrast) {
    fixedHtml = html
    cssFix = contrast.suggestions.map((s) => `${s.kind === "foreground" ? "color" : "background-color"}: ${s.color}; /* option: ${s.ratio}:1 */`).join("\n")
    if (best) steps = [`Change the ${best.kind} colour from ${best.kind === "foreground" ? contrast.foreground : contrast.background} to ${best.color} (${best.ratio}:1).`, ...guide.steps.slice(1)]
  }
  return {
    explanation: guide.why,
    fixedHtml,
    cssFix,
    jsx: fixedHtml && ruleId !== "color-contrast" ? toJsx(fixedHtml) : null,
    steps,
    test: guide.test,
    wcag: [],
    confidence: edit || contrast ? "medium" : "low",
    effort: guide.effort,
  }
}
