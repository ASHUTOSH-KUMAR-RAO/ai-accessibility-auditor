import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { useMotionScale } from "@/lib/motion"

/**
 * Scroll reveal. Reduced-motion visitors get the same reveal at a third of the distance and a calmer pace:
 * never a static layout, never hidden content.
 */
export function Reveal({ children, delay = 0, y = 32, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "li" | "section" }) {
  const { distance, speed } = useMotionScale()
  const Tag = motion[as]
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: y * distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ delay: delay * speed, duration: 0.7 * speed, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  )
}
