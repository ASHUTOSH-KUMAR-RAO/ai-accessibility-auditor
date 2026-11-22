import { ACHROMATOPSIA, BLUR_PX, CATARACT_CONTRAST, CATARACT_TINT, MACHADO, matrixValues } from "@/lib/vision"

/**
 * Colour matrices and blur are applied by SVG filters in the visitor's browser: no server work, nothing uploaded.
 * `scale` converts "pixels of the original page" to "pixels on screen" so the blur looks the same at any panel width.
 */
export function VisionFilters({ id, scale }: { id: string; scale: number }) {
  const blur = (px: number) => Math.max(0.4, px * scale)
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="absolute">
      <defs>
        {(["protanopia", "deuteranopia", "tritanopia"] as const).map((k) => (
          <filter key={k} id={`${id}-${k}`} colorInterpolationFilters="linearRGB"><feColorMatrix type="matrix" values={matrixValues(MACHADO[k])} /></filter>
        ))}
        <filter id={`${id}-achromatopsia`} colorInterpolationFilters="linearRGB"><feColorMatrix type="matrix" values={matrixValues(ACHROMATOPSIA)} /></filter>
        <filter id={`${id}-low-vision`} colorInterpolationFilters="sRGB"><feGaussianBlur stdDeviation={blur(BLUR_PX["low-vision"])} /></filter>
        <filter id={`${id}-cataract`} colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation={blur(BLUR_PX.cataract)} />
          <feColorMatrix type="matrix" values={CATARACT_TINT} />
          <feComponentTransfer>
            <feFuncR type="linear" slope={CATARACT_CONTRAST.slope} intercept={CATARACT_CONTRAST.intercept} />
            <feFuncG type="linear" slope={CATARACT_CONTRAST.slope} intercept={CATARACT_CONTRAST.intercept} />
            <feFuncB type="linear" slope={CATARACT_CONTRAST.slope} intercept={CATARACT_CONTRAST.intercept} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  )
}

