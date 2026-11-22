import { useReducedMotion } from "framer-motion"

/**
 * Motion is never switched off. Users who prefer reduced motion get the same
 * choreography at ~35% distance and a calmer pace — still visible, much gentler.
 */
export function useMotionScale() {
  const reduced = useReducedMotion()
  return { reduced: !!reduced, distance: reduced ? 0.35 : 1, speed: reduced ? 1.5 : 1 }
}
