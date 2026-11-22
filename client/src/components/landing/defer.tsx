import { useEffect, useRef, useState, type ReactNode } from "react"

/** Renders `children` (and so loads their code) only when the spot is about to scroll into view. `minHeight` avoids layout jumps. */
export function Defer({ children, minHeight = 480, id }: { children: ReactNode; minHeight?: number; id?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || show) return
    if (!("IntersectionObserver" in window)) return setShow(true)
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && (setShow(true), io.disconnect()), { rootMargin: "700px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [show])
  // the id lives on the wrapper so #anchors work before the section has been rendered
  return <div ref={ref} id={id} style={show ? undefined : { minHeight }} className="scroll-mt-24">{show ? children : null}</div>
}
