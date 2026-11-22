import { cn } from "@/lib/utils"

// Standard English Braille (grade 1): dot numbers per letter.
const DOTS: Record<string, string> = {
  a: "1", b: "12", c: "14", d: "145", e: "15", f: "124", g: "1245", h: "125", i: "24", j: "245",
  k: "13", l: "123", m: "134", n: "1345", o: "135", p: "1234", q: "12345", r: "1235", s: "234",
  t: "2345", u: "136", v: "1236", w: "2456", x: "1346", y: "13456", z: "1356",
}

/**
 * Text as real Braille cells. Raised dots pop in one after another, then breathe. It is pure CSS (transform and opacity
 * only, so it runs on the compositor and costs the main thread nothing). Reduced motion: same animation, gentler.
 */
export function BrailleText({ text, className }: { text: string; className?: string }) {
  let n = 0 // running index of raised dots, for the stagger
  return (
    <span role="img" aria-label={`"${text}" in Braille`} className={cn("inline-flex items-center gap-3", className)}>
      {[...text.toLowerCase()].map((ch, i) => {
        const raised = DOTS[ch] ?? ""
        return (
          <span key={i} aria-hidden="true" className="grid h-9 w-6 grid-flow-col grid-cols-2 grid-rows-3 place-items-center">
            {[1, 4, 2, 5, 3, 6].map((dot) => {
              const on = raised.includes(String(dot))
              const k = on ? n++ : 0
              return on ? (
                <i key={dot} className="braille-on size-2.5 rounded-full bg-primary" style={{ ["--k" as string]: k }} />
              ) : (
                <i key={dot} className="size-2.5 rounded-full bg-foreground opacity-[0.14]" />
              )
            })}
          </span>
        )
      })}
    </span>
  )
}
