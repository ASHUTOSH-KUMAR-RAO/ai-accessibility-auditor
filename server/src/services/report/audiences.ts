export type Audience = "screen-reader" | "keyboard" | "low-vision" | "color-blind" | "cognitive" | "motor"

const SR: Audience[] = ["screen-reader"]
const NAME: Audience[] = ["screen-reader", "motor"] // a missing accessible name also breaks voice control
const FORM: Audience[] = ["screen-reader", "cognitive", "motor"]
const STRUCTURE: Audience[] = ["screen-reader", "keyboard"]
const CONTRAST: Audience[] = ["low-vision", "color-blind", "cognitive"]
const FOCUS: Audience[] = ["keyboard", "motor", "screen-reader"]
const LANG: Audience[] = ["screen-reader", "cognitive"]

/** Maintained map: who is hurt when a given axe rule fails. Anything not listed falls back to its axe category tags. */
const BY_RULE: Record<string, Audience[]> = {
  "image-alt": SR, "input-image-alt": NAME, "area-alt": SR, "role-img-alt": SR, "svg-img-alt": SR, "object-alt": SR, "image-redundant-alt": SR,
  "link-name": NAME, "button-name": NAME, "input-button-name": NAME, "summary-name": NAME, "aria-command-name": NAME, "aria-input-field-name": NAME,
  "aria-toggle-field-name": NAME, "aria-meter-name": SR, "aria-progressbar-name": SR, "aria-tooltip-name": SR, "aria-treeitem-name": SR, "aria-dialog-name": SR,
  "label": FORM, "select-name": FORM, "form-field-multiple-labels": FORM, "label-title-only": FORM, "autocomplete-valid": FORM, "label-content-name-mismatch": ["motor", "screen-reader"],
  "color-contrast": CONTRAST, "color-contrast-enhanced": CONTRAST, "link-in-text-block": ["color-blind", "low-vision"],
  "html-has-lang": LANG, "html-lang-valid": LANG, "valid-lang": LANG, "html-xml-lang-mismatch": LANG, "document-title": LANG,
  "page-has-heading-one": STRUCTURE, "heading-order": STRUCTURE, "empty-heading": STRUCTURE, "landmark-one-main": STRUCTURE, "landmark-unique": STRUCTURE,
  "landmark-no-duplicate-banner": STRUCTURE, "landmark-no-duplicate-contentinfo": STRUCTURE, "landmark-banner-is-top-level": STRUCTURE, "landmark-main-is-top-level": STRUCTURE,
  "landmark-complementary-is-top-level": STRUCTURE, "landmark-contentinfo-is-top-level": STRUCTURE, "landmark-no-duplicate-main": STRUCTURE, "region": STRUCTURE,
  "bypass": ["keyboard", "screen-reader", "motor"], "skip-link": ["keyboard", "screen-reader"],
  "tabindex": FOCUS, "focus-order-semantics": FOCUS, "scrollable-region-focusable": FOCUS, "nested-interactive": FOCUS, "accesskeys": ["keyboard"],
  "aria-hidden-focus": STRUCTURE, "frame-focusable-content": STRUCTURE, "frame-title": SR, "frame-title-unique": SR,
  "meta-viewport": ["low-vision"], "meta-viewport-large": ["low-vision"], "target-size": ["motor", "low-vision"], "css-orientation-lock": ["motor", "low-vision"],
  "meta-refresh": ["cognitive", "screen-reader", "keyboard"], "blink": ["cognitive", "low-vision"], "marquee": ["cognitive", "low-vision"],
  "video-caption": ["cognitive"], "audio-caption": ["cognitive"], "video-description": ["screen-reader", "low-vision"], "no-autoplay-audio": ["screen-reader", "cognitive"],
  "list": SR, "listitem": SR, "definition-list": SR, "dlitem": SR,
  "td-headers-attr": SR, "th-has-data-cells": SR, "scope-attr-valid": SR, "td-has-header": SR, "table-duplicate-name": SR, "table-fake-caption": SR, "empty-table-header": SR,
  "duplicate-id": SR, "duplicate-id-active": SR, "duplicate-id-aria": SR,
}

const BY_CATEGORY: Array<[string, Audience[]]> = [
  ["cat.color", CONTRAST],
  ["cat.keyboard", ["keyboard", "motor"]],
  ["cat.forms", FORM],
  ["cat.language", LANG],
  ["cat.time-and-media", ["cognitive"]],
  ["cat.sensory-and-visual-cues", ["low-vision", "color-blind"]],
  ["cat.text-alternatives", SR],
  ["cat.name-role-value", SR],
  ["cat.aria", SR],
  ["cat.structure", STRUCTURE],
  ["cat.semantics", SR],
  ["cat.tables", SR],
  ["cat.parsing", SR],
]

/** Sensible fallback so every rule says who it affects, even rules newer than this map. */
export function audiencesFor(ruleId: string, tags: string[]): Audience[] {
  const direct = BY_RULE[ruleId]
  if (direct) return direct
  const merged = new Set<Audience>()
  for (const [tag, who] of BY_CATEGORY) if (tags.includes(tag)) who.forEach((a) => merged.add(a))
  return merged.size ? [...merged] : ["screen-reader"]
}
