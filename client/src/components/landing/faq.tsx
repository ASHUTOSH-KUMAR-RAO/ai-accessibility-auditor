import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Link } from "react-router-dom"
import { Reveal } from "./reveal"

const FAQ_ITEMS: Array<{ q: string; a: React.ReactNode; text: string }> = [
  { q: "What is WCAG?", text: "WCAG, the Web Content Accessibility Guidelines, is the international standard for making web content usable by people with disabilities. It is published by the W3C. Level AA of version 2.2 is what most laws and policies refer to.", a: <>WCAG, the Web Content Accessibility Guidelines, is the international standard for making web content usable by people with disabilities. It is published by the W3C. Level AA of version 2.2 is what most laws and policies refer to.</> },
  { q: "Is my data stored?", text: "Yes, only what the product needs. Your account, the scans you run and their screenshots are stored so you can open them again, and you can delete any scan. To write fixes, short cleaned HTML snippets of the problem elements (never cookies or form values) are sent to Groq, our AI provider. Share links are read-only and can be revoked. See the privacy policy for details.", a: <>Yes, only what the product needs. Your account, the scans you run and their screenshots are stored so you can open them again, and you can delete any scan. To write fixes, short cleaned HTML snippets of the problem elements (never cookies or form values) are sent to Groq, our AI provider. Share links are read-only and can be revoked. See the <Link to="/privacy" className="font-medium text-link underline underline-offset-4">privacy policy</Link> for details.</> },
  { q: "How accurate is it?", text: "The checks come from axe-core, the engine behind many accessibility tools, so what it reports as a failure is reliable. Automated tools can only test some rules, which is why we also list items that need a human look. AI fixes are re-checked with axe where possible and labelled Verified, Not verified or Needs page context.", a: <>The checks come from axe-core, the engine behind many accessibility tools, so what it reports as a failure is reliable. Automated tools can only test some rules, which is why we also list items that need a human look. AI fixes are re-checked with axe where possible and labelled Verified, Not verified or Needs page context.</> },
  { q: "Does AI replace manual testing?", text: "No. Automated scanning and AI help you find and fix common problems fast, but only people can judge things like whether alt text is meaningful, whether the reading order makes sense, or whether a flow is usable with a screen reader. Treat AccessLens as the first pass and test with real assistive technology and real users.", a: <>No. Automated scanning and AI help you find and fix common problems fast, but only people can judge things like whether alt text is meaningful, whether the reading order makes sense, or whether a flow is usable with a screen reader. Treat AccessLens as the first pass and test with real assistive technology and real users.</> },
  { q: "Which websites can I scan?", text: "Any public web page. Private networks, localhost and unusual ports are blocked on purpose, so AccessLens can never be used to reach internal systems.", a: <>Any public web page. Private networks, localhost and unusual ports are blocked on purpose, so AccessLens can never be used to reach internal systems.</> },
  { q: "What if the AI is unavailable?", text: "Everything still works. You get guided fixes written from built-in rules for the most common problems, clearly labelled as such.", a: <>Everything still works. You get guided fixes written from built-in rules for the most common problems, clearly labelled as such.</> },
]

export function Faq() {
  return (
    <section aria-labelledby="faq-title" className="container-page py-8 sm:py-12">
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <Reveal><p className="eyebrow">Questions</p><h2 id="faq-title" className="mt-3 text-4xl font-semibold sm:text-5xl">Straight answers.</h2></Reveal>
        <Reveal delay={0.08}>
          <Accordion className="gap-3">
            {FAQ_ITEMS.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="rounded-2xl border border-border bg-card/90 shadow-soft not-last:border-b">
                <AccordionTrigger className="items-center rounded-2xl p-5 text-lg font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="px-5 pb-5 text-base text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  )
}
