import type { Page } from "playwright"

// Presses Tab through the page and records where keyboard focus goes. Everything below runs after axe and the screenshot,
// so pressing keys can't change what those saw, and every network/SSRF guard of the scan context still applies.

export const TAB_MAX_STOPS = 100
export const TAB_BUDGET_MS = 8_000
/** Extra key presses allowed for focus travelling inside iframes (their contents are not readable) */
const EXTRA_PRESSES = 40

export interface TabStop {
  /** 1-based position in the tab sequence */
  n: number
  selector: string
  tag: string
  role: string
  name: string
  /** document coordinates in CSS px (same space as issue bounding boxes) */
  box: { x: number; y: number; width: number; height: number }
  focusVisible: boolean
  /** The element took focus and lost it again straight away (script blurred it or moved focus elsewhere) */
  focusLost?: boolean
  offscreen: boolean
}

export type TabWarningType = "focus-jump" | "invisible-focus" | "focus-lost" | "offscreen" | "trap" | "unreachable"
export interface TabWarning {
  type: TabWarningType
  /** the stop the warning is about (1-based); absent for page-level warnings */
  stop?: number
  message: string
}
export interface Unreachable { selector: string; tag: string; role: string; name: string; box: { x: number; y: number; width: number; height: number } }

export interface TabOrder {
  stops: TabStop[]
  /** Focus came back to the first element (or left the page): we saw the whole loop */
  complete: boolean
  /** Stopped at the stop limit */
  truncated: boolean
  trap: { stop: number; selector: string } | null
  unreachable: Unreachable[]
  page: { width: number; height: number; viewportHeight: number }
  warnings: TabWarning[]
}

type RawStop = Omit<TabStop, "n">
interface Snapshot { key: string; isBody: boolean; isFrame: boolean; stop: RawStop | null }
declare global { interface Window { __alFocus?: Element | null } }

// ───────── in-page code (serialised into the browser: no imports, no TypeScript-only runtime) ─────────
/* eslint-disable */
function inPageProbe(): Snapshot {
  const deepActive = (): Element | null => {
    let a: Element | null = document.activeElement
    while (a && (a as HTMLElement).shadowRoot?.activeElement) a = (a as HTMLElement).shadowRoot!.activeElement
    return a
  }
  let el = deepActive()
  let lost = false
  if (!el || el === document.body || el === document.documentElement) {
    // Nothing has focus now. If something took it a moment ago and gave it back (onfocus="blur()"), we still saw it.
    const f = window.__alFocus
    window.__alFocus = null
    if (!(f instanceof Element) || !f.isConnected || f === document.body || f === document.documentElement) return { key: "", isBody: true, isFrame: false, stop: null }
    el = f
    lost = true
  }
  window.__alFocus = null

  const esc = (v: string) => (window.CSS && CSS.escape ? CSS.escape(v) : v.replace(/[^a-zA-Z0-9_-]/g, "\\$&"))
  const selectorOf = (node: Element): string => {
    const parts: string[] = []
    let cur: Element | null = node
    while (cur && cur.nodeType === 1 && parts.length < 8) {
      if (cur.id && document.querySelectorAll("#" + esc(cur.id)).length === 1) {
        parts.unshift("#" + esc(cur.id))
        break
      }
      const parent: Element | null = cur.parentElement
      let part = cur.tagName.toLowerCase()
      if (parent) {
        const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName)
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`
      }
      parts.unshift(part)
      cur = parent
    }
    return parts.join(" > ").slice(0, 300)
  }

  const tag = el.tagName.toLowerCase()
  const type = (el.getAttribute("type") || "").toLowerCase()
  const implicit = (): string => {
    if (tag === "a" || tag === "area") return el.hasAttribute("href") ? "link" : "generic"
    if (tag === "button" || tag === "summary") return "button"
    if (tag === "select") return "combobox"
    if (tag === "textarea") return "textbox"
    if (tag === "input") return type === "checkbox" ? "checkbox" : type === "radio" ? "radio" : type === "range" ? "slider" : ["button", "submit", "reset", "image"].includes(type) ? "button" : type === "search" ? "searchbox" : "textbox"
    if (tag === "iframe") return "frame"
    return "generic"
  }
  const role = (el.getAttribute("role") || implicit()).split(" ")[0]!

  const text = (s: string | null | undefined) => (s || "").replace(/\s+/g, " ").trim()
  const labelledBy = el.getAttribute("aria-labelledby")
  const byIds = labelledBy ? text(labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ")) : ""
  const labels = (el as HTMLInputElement).labels ? text(Array.from((el as HTMLInputElement).labels!).map((l) => l.textContent).join(" ")) : ""
  const name = text(
    byIds || el.getAttribute("aria-label") || labels || (tag === "img" ? el.getAttribute("alt") : "") ||
      (tag === "input" && ["button", "submit", "reset"].includes(type) ? (el as HTMLInputElement).value : "") ||
      (tag === "input" && type === "image" ? el.getAttribute("alt") : "") || (el as HTMLElement).innerText || el.textContent ||
      el.getAttribute("title") || el.getAttribute("placeholder"),
  ).slice(0, 100)

  const r = el.getBoundingClientRect()
  const sx = window.scrollX
  const sy = window.scrollY
  const box = { x: Math.round(r.x + sx), y: Math.round(r.y + sy), width: Math.round(r.width), height: Math.round(r.height) }
  const docW = Math.max(document.documentElement.scrollWidth, window.innerWidth)
  const docH = Math.max(document.documentElement.scrollHeight, window.innerHeight)
  const cs = getComputedStyle(el)
  const offscreen =
    (r.width === 0 && r.height === 0) || cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0 ||
    box.x + box.width <= 0 || box.y + box.height <= 0 || box.x >= docW || box.y >= docH

  // Focus indicator: anything that differs between focused and blurred counts (outline, shadow, border, colours, underline).
  const snap = () => {
    const c = getComputedStyle(el)
    const alpha = (col: string) => (/rgba?\(([^)]+)\)/.exec(col)?.[1]?.split(",")[3]?.trim() ?? "1")
    const outline = c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0 && Number(alpha(c.outlineColor)) > 0 ? `${c.outlineStyle}|${c.outlineWidth}|${c.outlineColor}|${c.outlineOffset}` : "none"
    return [outline, c.boxShadow, c.borderTopColor, c.borderTopWidth, c.backgroundColor, c.color, c.textDecorationLine, c.transform, c.filter].join("¦")
  }
  const focusedSnap = snap()
  const hasOutline = !focusedSnap.startsWith("none¦")
  let focusVisible = lost ? false : hasOutline
  try {
    if (lost) throw new Error("already blurred");
    (el as HTMLElement).blur()
    const blurredSnap = snap()
    ;(el as HTMLElement).focus({ preventScroll: true }) // keyboard position stays on this element
    focusVisible = hasOutline || focusedSnap !== blurredSnap
  } catch {
    /* keep the outline-only answer */
  }

  window.__alFocus = null // the blur/focus test above fires focus events of its own
  const key = selectorOf(el)
  return { key, isBody: false, isFrame: tag === "iframe" || tag === "frame", stop: { selector: key, tag, role, name, box, focusVisible, ...(lost && { focusLost: true }), offscreen } }
}

interface CandidateInfo { selector: string; tag: string; role: string; name: string; box: { x: number; y: number; width: number; height: number } }
function inPageInteractive(): CandidateInfo[] {
  const sel = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [onclick], [role="button"], [role="link"], [role="checkbox"], [role="menuitem"], [role="tab"], [role="switch"], [role="option"], [role="combobox"], [role="slider"], [contenteditable=""], [contenteditable="true"]'
  const out: CandidateInfo[] = []
  const esc = (v: string) => (window.CSS && CSS.escape ? CSS.escape(v) : v.replace(/[^a-zA-Z0-9_-]/g, "\\$&"))
  for (const el of Array.from(document.querySelectorAll(sel))) {
    if (out.length >= 200) break
    const h = el as HTMLElement
    const tabindex = h.getAttribute("tabindex")
    if (tabindex !== null && Number(tabindex) < 0) continue // deliberately out of the tab order
    if ((h as HTMLInputElement).disabled || h.closest("[inert], [aria-hidden='true'], fieldset:disabled, details:not([open]) > :not(summary)")) continue
    const cs = getComputedStyle(h)
    const r = h.getBoundingClientRect()
    if (cs.visibility === "hidden" || cs.display === "none" || r.width < 2 || r.height < 2) continue
    if (h.tagName === "INPUT" && (h as HTMLInputElement).type === "radio" && !(h as HTMLInputElement).checked && (h as HTMLInputElement).name) {
      // radios in a group share one tab stop
      const group = document.querySelectorAll(`input[type="radio"][name="${esc((h as HTMLInputElement).name)}"]`)
      if (Array.from(group).some((g) => (g as HTMLInputElement).checked)) continue
    }
    const text = (h.innerText || h.getAttribute("aria-label") || h.getAttribute("title") || h.getAttribute("alt") || (h as HTMLInputElement).value || "").replace(/\s+/g, " ").trim().slice(0, 100)
    const id = h.id && document.querySelectorAll("#" + esc(h.id)).length === 1 ? "#" + esc(h.id) : ""
    out.push({
      selector: id || h.tagName.toLowerCase() + (h.className && typeof h.className === "string" ? "." + h.className.trim().split(/\s+/).slice(0, 2).map(esc).join(".") : ""),
      tag: h.tagName.toLowerCase(),
      role: h.getAttribute("role") || "",
      name: text,
      box: { x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), width: Math.round(r.width), height: Math.round(r.height) },
    })
  }
  return out
}
/* eslint-enable */

export interface RecordOptions {
  maxStops?: number
  budgetMs?: number
  signal?: AbortSignal
}

export async function recordTabOrder(page: Page, opts: RecordOptions = {}): Promise<TabOrder> {
  const maxStops = opts.maxStops ?? TAB_MAX_STOPS
  const deadline = Date.now() + (opts.budgetMs ?? TAB_BUDGET_MS)
  const stops: TabStop[] = []
  const seen = new Map<string, number>()
  let complete = false
  let truncated = false
  let trap: TabOrder["trap"] = null

  await page.evaluate("window.__name = window.__name || ((f) => f)").catch(() => {}) // esbuild (tsx) wraps inner functions in __name()
  // Remember the element that last received focus, even if a script takes focus away again immediately.
  await page.evaluate("document.addEventListener('focus', (e) => { window.__alFocus = e.target }, true); window.__alFocus = null").catch(() => {})
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.()).catch(() => {})
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})

  let lastKey = ""
  let repeats = 0
  let pendingBody = false
  const presses = maxStops + EXTRA_PRESSES
  for (let i = 0; i < presses; i++) {
    if (opts.signal?.aborted || Date.now() > deadline) {
      truncated = true
      break
    }
    await page.keyboard.press("Tab")
    const snap = await page.evaluate(inPageProbe)

    if (snap.isBody) {
      if (stops.length === 0) {
        if (++repeats >= 3) break // nothing focusable at all
        continue
      }
      // Focus left the document. Usually that is the end of the loop (the next Tab wraps to the first element),
      // but some pages drop focus mid-way, so one more press decides.
      if (pendingBody) {
        complete = true
        break
      }
      pendingBody = true
      continue
    }
    const afterBody = pendingBody
    pendingBody = false
    if (snap.isFrame) {
      if (snap.key === lastKey) continue // focus is travelling inside the frame
      lastKey = snap.key
    }

    if (afterBody && stops[0] && snap.key === stops[0].selector) {
      complete = true // body, then back to the first element: the loop is closed
      break
    }
    if (seen.has(snap.key) && !snap.isFrame) {
      // Chromium leaves the page (document.body) after the last element, so meeting an element again WITHOUT that
      // means focus is looping inside the page: a keyboard trap.
      if (snap.key === lastKey && ++repeats < 2) continue // one repeat can be a slow handler; two is a trap
      trap = { stop: seen.get(snap.key)!, selector: snap.key }
      break
    }
    repeats = 0
    lastKey = snap.key
    if (snap.stop && !seen.has(snap.key)) {
      stops.push({ n: stops.length + 1, ...snap.stop })
      seen.set(snap.key, stops.length)
    }
    if (stops.length >= maxStops) {
      truncated = true
      break
    }
  }

  const dims = await page
    .evaluate(() => ({ width: Math.max(document.documentElement.scrollWidth, innerWidth), height: Math.max(document.documentElement.scrollHeight, innerHeight), viewportHeight: innerHeight }))
    .catch(() => ({ width: 0, height: 0, viewportHeight: 0 }))

  // Interactive elements that never received focus (only meaningful when we saw the whole loop)
  let unreachable: Unreachable[] = []
  if (complete && !trap) {
    const reached = new Set(stops.map((s) => s.selector))
    const candidates = await page.evaluate(inPageInteractive).catch(() => [] as Unreachable[])
    unreachable = candidates.filter((c) => !reached.has(c.selector) && !stops.some((s) => overlaps(s.box, c.box))).slice(0, 25)
  }

  const order: TabOrder = { stops, complete, truncated, trap, unreachable, page: dims, warnings: [] }
  order.warnings = analyzeTabOrder(order)
  return order
}

const overlaps = (a: TabStop["box"], b: TabStop["box"]) => {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return ix * iy >= 0.6 * Math.min(a.width * a.height, b.width * b.height) // the same control found under another selector
}

/** A jump up the page of more than this, or down by more than this, between two stops is flagged. */
export const JUMP_UP_PX = 300
export const JUMP_DOWN_PX = 1200

const label = (s: Pick<TabStop, "role" | "name" | "tag" | "n">) => `${s.role !== "generic" ? s.role : s.tag}${s.name ? ` “${s.name.slice(0, 40)}”` : ""}`

/** Pure: turns the recording into human-readable warnings (unit tested). */
export function analyzeTabOrder(o: Pick<TabOrder, "stops" | "trap" | "unreachable" | "truncated" | "complete">): TabWarning[] {
  const w: TabWarning[] = []
  if (o.trap) {
    const at = o.stops[o.trap.stop - 1]
    w.push({ type: "trap", stop: o.trap.stop, message: `Keyboard focus gets stuck${at ? ` around ${label(at)}` : ""}: pressing Tab keeps cycling and never reaches the rest of the page.` })
  }
  o.stops.forEach((s, i) => {
    if (s.focusLost) w.push({ type: "focus-lost", stop: s.n, message: `Stop ${s.n} (${label(s)}) loses keyboard focus the moment it receives it (a script blurs it or moves focus away), so keyboard users can't use it.` })
    else if (!s.focusVisible) w.push({ type: "invisible-focus", stop: s.n, message: `Stop ${s.n} (${label(s)}) shows no visible focus indicator.` })
    if (s.offscreen) w.push({ type: "offscreen", stop: s.n, message: `Stop ${s.n} (${label(s)}) takes focus but is off-screen or hidden.` })
    const prev = o.stops[i - 1]
    if (prev && !s.offscreen && !prev.offscreen) {
      const dy = s.box.y - prev.box.y
      if (dy < -JUMP_UP_PX) w.push({ type: "focus-jump", stop: s.n, message: `Focus jumps back up the page by about ${Math.round(-dy)} px from stop ${prev.n} to stop ${s.n} (${label(s)}).` })
      else if (dy > JUMP_DOWN_PX) w.push({ type: "focus-jump", stop: s.n, message: `Focus jumps down the page by about ${Math.round(dy)} px from stop ${prev.n} to stop ${s.n} (${label(s)}), skipping content in between.` })
    }
  })
  if (o.unreachable.length > 0) {
    const u = o.unreachable[0]!
    w.push({ type: "unreachable", message: `${o.unreachable.length} interactive ${o.unreachable.length === 1 ? "element" : "elements"} can't be reached with the Tab key (for example ${u.name ? label({ ...u, n: 0 }) : u.selector}).` })
  }
  return w
}
