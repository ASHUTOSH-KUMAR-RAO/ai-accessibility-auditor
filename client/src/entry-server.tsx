import { renderToString } from "react-dom/server"
import { StaticRouter } from "react-router-dom"
import { AppRoutes } from "./app-routes"
import { Providers } from "./providers"

/** Build-time only: the HTML of one public route (see scripts/prerender.mjs). */
export function render(url: string) {
  return renderToString(
    <Providers>
      <StaticRouter location={url}>
        <AppRoutes />
      </StaticRouter>
    </Providers>,
  )
}

export { ROUTE_META } from "./lib/seo-routes"
