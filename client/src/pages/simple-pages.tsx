import { Link } from "react-router-dom"
import { ArrowLeft, SearchX } from "lucide-react"
import { motion } from "framer-motion"
import { buttonVariants } from "@/components/ui/button"
import { useMotionScale } from "@/lib/motion"

function Notice({ icon, eyebrow, title, body }: { icon: React.ReactNode; eyebrow: string; title: string; body: string }) {
  const { distance, speed } = useMotionScale()
  return (
    <section className="container-page grid min-h-[60dvh] place-items-center py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 * distance }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6 * speed, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-lg text-center"
      >
        <div className="mx-auto grid size-16 place-items-center rounded-2xl border border-border bg-card shadow-soft" aria-hidden="true">{icon}</div>
        <p className="eyebrow mt-6">{eyebrow}</p>
        <h1 className="mt-3 text-5xl font-semibold">{title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{body}</p>
        <Link to="/" className={`${buttonVariants({ size: "lg" })} mt-8`}><ArrowLeft aria-hidden="true" />Back to home</Link>
      </motion.div>
    </section>
  )
}

export function NotFound() {
  return <Notice icon={<SearchX className="size-8" />} eyebrow="Error 404" title="This page isn't here." body="The link may be broken or the page may have moved. Head back home and try again." />
}
