// Vision simulations. Colour-blindness uses the Machado, Oliveira & Fernandes (2009) matrices for severity 1.0
// (full dichromacy). They are defined for LINEAR RGB, which is exactly the space SVG filters use by default
// (color-interpolation-filters: linearRGB), so they go into <feColorMatrix> unchanged.

export type Matrix3 = readonly [number, number, number, number, number, number, number, number, number]

export type VisionId = "none" | "protanopia" | "deuteranopia" | "tritanopia" | "achromatopsia" | "low-vision" | "cataract"

export const MACHADO: Record<"protanopia" | "deuteranopia" | "tritanopia", Matrix3> = {
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
}

/** Rec. 709 luminance weights: what a person with no cone function (rod monochromacy) perceives as brightness. */
const L = [0.2126, 0.7152, 0.0722] as const
export const ACHROMATOPSIA: Matrix3 = [...L, ...L, ...L]

/** A 3×3 as the 20 values of a feColorMatrix (rows R, G, B, A; alpha untouched). */
export const matrixValues = (m: Matrix3): string => {
  const [a, b, c, d, e, f, g, h, i] = m
  return `${a} ${b} ${c} 0 0  ${d} ${e} ${f} 0 0  ${g} ${h} ${i} 0 0  0 0 0 1 0`
}

export const applyMatrix = (m: Matrix3, rgb: readonly [number, number, number]): [number, number, number] => [
  m[0] * rgb[0] + m[1] * rgb[1] + m[2] * rgb[2],
  m[3] * rgb[0] + m[4] * rgb[1] + m[5] * rgb[2],
  m[6] * rgb[0] + m[7] * rgb[1] + m[8] * rgb[2],
]

/** Cataract-like clouding: slightly yellowed, lower contrast, a little glare-like haze (applied on top of the blur). */
export const CATARACT_TINT = `0.93 0.05 0 0 0.04  0.04 0.86 0.02 0 0.035  0 0.05 0.55 0 0.02  0 0 0 1 0`
export const CATARACT_CONTRAST = { slope: 0.68, intercept: 0.16 }

/** Gaussian blur radius in screenshot pixels at 100% zoom (about 20/200 acuity on a desktop screen) and for cataract haze. */
export const BLUR_PX: Record<"low-vision" | "cataract", number> = { "low-vision": 5, cataract: 2.2 }

export interface VisionInfo {
  id: Exclude<VisionId, "none">
  label: string
  /** One sentence: what it is */
  what: string
  /** How common, honestly hedged */
  prevalence: string
  /** What designers should take from it */
  tip: string
}

export const VISION_TYPES: VisionInfo[] = [
  {
    id: "protanopia",
    label: "Protanopia (red-blind)",
    what: "The red-sensitive cones are missing, so reds look dark and are confused with greens and browns.",
    prevalence: "About 1% of men and 0.01% of women.",
    tip: "Don't separate states with red vs green alone. Add an icon, text or pattern.",
  },
  {
    id: "deuteranopia",
    label: "Deuteranopia (green-blind)",
    what: "The green-sensitive cones are missing: reds, greens and oranges become similar yellowish-brown tones.",
    prevalence: "About 1% of men and 0.01% of women, the most common severe type.",
    tip: "Charts and status colours that rely on a red/green pair become unreadable.",
  },
  {
    id: "tritanopia",
    label: "Tritanopia (blue-blind)",
    what: "The blue-sensitive cones are missing, so blues and greens blur together and yellows look pale pink.",
    prevalence: "Rare: roughly 1 in 10,000 people, men and women equally.",
    tip: "Avoid telling blue from green, or yellow from pink, by hue alone.",
  },
  {
    id: "achromatopsia",
    label: "Achromatopsia (no color)",
    what: "No working cones: the world is seen in shades of grey, usually with light sensitivity and low sharpness.",
    prevalence: "Very rare: about 1 in 30,000 people.",
    tip: "If the page still makes sense in greyscale, it doesn't depend on colour. Contrast carries everything.",
  },
  {
    id: "low-vision",
    label: "Low vision (blur)",
    what: "Fine detail is lost: small text blurs and thin lines vanish. Glasses can't fully correct it.",
    prevalence: "WHO counts 2.2 billion people with some vision impairment, including uncorrected needs for glasses.",
    tip: "Use larger text, strong contrast and simple shapes, and let people zoom.",
  },
  {
    id: "cataract",
    label: "Cataract-like (low contrast)",
    what: "The eye's lens clouds, which dims and yellows the view, lowers contrast and adds a hazy glare.",
    prevalence: "Around 94 million people live with cataract (WHO, 2019). It is the leading cause of blindness.",
    tip: "Pale grey text on white that looks fine to you can disappear. Aim well above the minimum contrast.",
  },
]

export const visionInfo = (id: VisionId) => VISION_TYPES.find((v) => v.id === id) ?? null
