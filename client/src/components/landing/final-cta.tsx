import { ArrowRight, FileSearch } from "lucide-react"
import { Link } from "react-router-dom"
import { buttonVariants } from "@/components/ui/button"
import { useAuth } from "@/context/auth-store"
import { Reveal } from "./reveal"

export function FinalCta() {
  const { status } = useAuth()
  return (
    <section aria-labelledby="cta-title" className="container-page py-8 sm:py-12">
      <Reveal className="mx-auto max-w-3xl text-center">
        <h2 id="cta-title" className="text-4xl font-semibold sm:text-6xl">Find out who your site <span className="italic">leaves out.</span></h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">Your first scan takes about fifteen seconds. No card, no install.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to={status === "authenticated" ? "/dashboard" : "/signup"} className={`${buttonVariants({ size: "lg" })} h-14 px-8 text-lg`}>{status === "authenticated" ? "Go to your dashboard" : "Create a free account"}<ArrowRight aria-hidden="true" /></Link>
          <Link to="/sample" className={`${buttonVariants({ variant: "outline", size: "lg" })} h-14 px-8 text-lg`}><FileSearch aria-hidden="true" />See a sample report</Link>
        </div>
      </Reveal>
    </section>
  )
}
