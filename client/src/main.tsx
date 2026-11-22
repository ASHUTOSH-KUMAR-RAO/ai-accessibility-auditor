import { StrictMode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { AppRoutes } from "./app-routes.tsx"
import { Providers } from "./providers.tsx"
import "./index.css"

const tree = (
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Providers>
  </StrictMode>
)

const root = document.getElementById("root")!
// Public pages ship as prerendered HTML (see scripts/prerender.mjs): React takes that markup over instead of rebuilding it.
// Every other URL gets the empty app shell. If markup for a different page ever lands here, it is discarded, not hydrated.
if (root.dataset.prerendered === location.pathname.replace(/\/$/, "") || (root.dataset.prerendered === "/" && location.pathname === "/")) {
  hydrateRoot(root, tree)
} else {
  root.replaceChildren()
  createRoot(root).render(tree)
}
