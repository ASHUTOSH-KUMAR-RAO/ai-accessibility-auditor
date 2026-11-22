import { Link } from "react-router-dom"
import { H2, LegalPage } from "@/components/pages/legal-page"
import { ROUTE_META } from "@/lib/seo-routes"

// These pages describe what the application actually does. If the behaviour changes, change the text.

export function Privacy() {
  return (
    <LegalPage {...ROUTE_META.privacy}>
      <p>This page explains, in plain words, what data AccessLens handles when you use it.</p>

      <H2>What we store</H2>
      <ul>
        <li><strong>Your account:</strong> your name, your email address and a bcrypt hash of your password (never the password itself).</li>
        <li><strong>Your scans:</strong> the address you scanned, the date, the score, every accessibility issue found with the HTML of the affected element and axe-core&apos;s explanation, the keyboard tab-order recording, and a full-page screenshot.</li>
        <li><strong>AI results:</strong> fixes and summaries written for your scans, so the same answer is not paid for twice. A saved fix does not contain your page&apos;s HTML, only the generated explanation and code. Fixes are shared between users when the same element appears, so never put secrets in a page you scan.</li>
        <li><strong>Feedback:</strong> if you mark a fix as helpful or not (and an optional reason), we keep it to improve the prompts.</li>
        <li><strong>Usage counters:</strong> a record of each AI generation (to apply the hourly limit) and of scans (to apply scan limits).</li>
      </ul>

      <H2>What leaves our servers</H2>
      <ul>
        <li><strong>The websites you scan.</strong> A headless browser on our server loads the page you ask for. It never uses your cookies or your browser.</li>
        <li><strong>AI processing (Groq).</strong> To write a fix, a short snippet of the failing element&apos;s HTML and axe-core&apos;s failure text are sent to Groq. Before sending we remove scripts, event handlers, input values, tokens in URLs and data: URIs, and we truncate the text. The snippet is sent as data, never as instructions. For the scan summary we send rule names, counts and your page&apos;s host name and title. Groq processes this under its own terms and privacy policy.</li>
        <li><strong>PDF reports</strong> are created on our server with no network access.</li>
      </ul>

      <H2>Share links</H2>
      <p>You can create a read-only link to a scan. Anyone who has the link can see that report (and its screenshot unless you hide it) without an account. The link contains a random 256-bit token. We store only a hash of it, so we cannot show the link again. Links can expire and you can revoke them at any time; a revoked or expired link stops working at once. Shared pages are marked noindex and are not sent to search engines.</p>

      <H2>Cookies and browser storage</H2>
      <p>AccessLens uses one essential cookie (a sign-in refresh token) and a few browser storage keys. We do not use advertising or analytics cookies. The full list is on the <Link to="/cookies">cookies page</Link>.</p>

      <H2>How long we keep things</H2>
      <p>Data stays until you delete it. Deleting a scan hides it immediately and removes it permanently after about a week. It still counts toward your hourly scan limit until then. To delete your whole account, contact the maintainer; deleting an account removes its scans, screenshots, usage records and feedback.</p>

      <H2>Security</H2>
      <p>Passwords are hashed. Sessions use short-lived access tokens and single-use refresh tokens. Scans can only reach public websites: private networks, localhost and unusual ports are blocked. No system is perfectly secure, and this is a portfolio project, so please do not scan or upload anything sensitive.</p>

      <H2>Your choices</H2>
      <p>You can look at, export (CSV, JSON, PDF) and delete your scans at any time. If you have a question or a request about your data, contact the maintainer through the portfolio this project is part of.</p>
    </LegalPage>
  )
}

export function Terms() {
  return (
    <LegalPage {...ROUTE_META.terms}>
      <p>By creating an account or using AccessLens you agree to these terms. They are short on purpose.</p>

      <H2>What AccessLens is</H2>
      <p>AccessLens scans public web pages for accessibility problems, explains them and suggests fixes. It is a portfolio project provided free and as is, with no promise that it will stay available or that features will not change.</p>

      <H2>Acceptable use</H2>
      <ul>
        <li>Scan only websites you own, or that you have permission to test, or that are public demo pages.</li>
        <li>Do not try to reach private networks, bypass the scanner&apos;s safeguards, overload the service or scan at a rate meant to harm a site. Limits apply per hour and per user.</li>
        <li>Do not use AccessLens to break the law, to harass anyone, or to store content you have no right to store.</li>
        <li>Keep your sign-in details private. You are responsible for what happens under your account.</li>
      </ul>

      <H2>Results and AI output</H2>
      <p>Automated checks find only part of the accessibility problems on a page, and a passing scan does not mean a site is accessible or legally compliant. AI-written explanations and code can be wrong. A fix labelled Verified passed an automatic axe-core re-check on an isolated snippet. It may still be incomplete or unsuitable for your site. Always review code and test with real assistive technology before you ship it.</p>

      <H2>Share links and exports</H2>
      <p>If you share a report you decide who sees it. You are responsible for sharing only what you are allowed to share. You can revoke a link at any time.</p>

      <H2>Your content</H2>
      <p>You keep all rights to your content. You allow AccessLens to process and store the scans you request so that the product works, as described in the <Link to="/privacy">privacy policy</Link>.</p>

      <H2>No warranty, limited liability</H2>
      <p>AccessLens is provided without warranties of any kind. To the extent the law allows, the maintainer is not liable for losses arising from using it, including losses from relying on a scan, a score or an AI-written fix.</p>

      <H2>Changes and ending</H2>
      <p>These terms and the service may change, and accounts may be removed for misuse. When the terms change materially, the date at the top of this page changes.</p>
    </LegalPage>
  )
}

const STORAGE: Array<{ name: string; kind: string; purpose: string; lifetime: string }> = [
  { name: "Refresh token cookie", kind: "Cookie (HTTP-only)", purpose: "Keeps you signed in. It cannot be read by scripts and is only sent to the AccessLens API.", lifetime: "Up to 7 days, replaced every time it is used" },
  { name: "accesslens:session", kind: "localStorage", purpose: "A flag saying you probably have a session, so signed-out visitors do not trigger a pointless sign-in check and other tabs notice a sign-out. It holds no personal data.", lifetime: "Until you sign out" },
  { name: "theme", kind: "localStorage", purpose: "Remembers light, dark or system colour theme.", lifetime: "Until you clear it" },
  { name: "accesslens:cookie-notice", kind: "localStorage", purpose: "Remembers that you dismissed the cookie notice.", lifetime: "Until you clear it" },
  { name: "accesslens:sidebar-collapsed", kind: "localStorage", purpose: "Remembers whether you collapsed the sidebar.", lifetime: "Until you clear it" },
  { name: "accesslens:pending-url", kind: "localStorage", purpose: "If you type an address on the home page before signing up, it is kept so it can be scanned once you are in.", lifetime: "Used once, expires after an hour" },
]

export function Cookies() {
  return (
    <LegalPage {...ROUTE_META.cookies}>
      <p>AccessLens uses only what it needs to work. There are <strong>no advertising cookies, no analytics and no tracking</strong>, so there is nothing to opt out of. If your browser blocks storage, the site still works, but you will not stay signed in and your choices will not be remembered.</p>
      <div className="relative overflow-x-auto rounded-2xl border border-border bg-card/90" tabIndex={0} role="region" aria-label="Cookies and storage keys, scrolls sideways on small screens">
        <table className="w-full min-w-[40rem] border-collapse text-left text-base">
          <caption className="sr-only">Cookies and browser storage keys used by AccessLens</caption>
          <thead><tr className="border-b-2 border-border bg-muted/60"><th scope="col" className="p-3">Name</th><th scope="col" className="p-3">Type</th><th scope="col" className="p-3">What it is for</th><th scope="col" className="p-3">How long</th></tr></thead>
          <tbody>
            {STORAGE.map((s) => (
              <tr key={s.name} className="border-b border-border align-top">
                <th scope="row" className="p-3 font-mono text-sm font-semibold">{s.name}</th><td className="p-3">{s.kind}</td><td className="p-3">{s.purpose}</td><td className="p-3">{s.lifetime}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <H2>Fonts and third parties</H2>
      <p>Fonts are served from AccessLens itself. Pages do not load scripts, fonts or images from third parties. Your browser contacts only AccessLens. The AI provider (Groq) is contacted by our server, not by your browser. See the <Link to="/privacy">privacy policy</Link>.</p>
      <H2>Clearing it</H2>
      <p>Signing out removes the sign-in cookie and flag. You can remove everything else in your browser&apos;s site settings.</p>
    </LegalPage>
  )
}
