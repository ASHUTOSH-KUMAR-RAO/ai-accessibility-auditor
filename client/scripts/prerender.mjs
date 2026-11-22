// Build step: turns the public routes into real HTML (so they paint before any JavaScript arrives and carry their own SEO tags),
// and keeps an empty shell (app.html) for every signed-in route. Run after `vite build` and `vite build --ssr`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { loadEnv } from "vite"

const root = resolve(import.meta.dirname, "..")
const dist = join(root, "dist")
const site = (loadEnv("production", root, "VITE_").VITE_SITE_URL || "http://localhost:5173").replace(/\/$/, "")
const { render, ROUTE_META } = await import(pathToFileURL(join(root, "dist-ssr/entry-server.js")).href)

const template = readFileSync(join(dist, "index.html"), "utf8")
if (!template.includes('<div id="root"></div>')) throw new Error("dist/index.html has no empty #root: was it already prerendered?")
writeFileSync(join(dist, "app.html"), template) // empty shell: the SPA fallback for /dashboard, /scans/..., /login, ...

// Critical CSS: the one stylesheet is small, so inline it and remove a render-blocking request from the prerendered pages.
const cssLink = /<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/.exec(template)
const css = cssLink ? readFileSync(join(dist, cssLink[1]), "utf8") : ""

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")
const setMeta = (html, selector, value) => html.replace(selector, (_m, pre, _old, post) => `${pre}${esc(value)}${post}`)

for (const meta of Object.values(ROUTE_META)) {
  const title = meta.title.includes("AccessLens") ? meta.title : `${meta.title} | AccessLens`
  const url = `${site}${meta.path}`
  let html = template.replace('<div id="root"></div>', `<div id="root" data-prerendered="${meta.path}">${render(meta.path)}</div>`)
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
  html = setMeta(html, /(<meta name="description" content=")([^"]*)(")/, meta.description)
  html = setMeta(html, /(<meta property="og:title" content=")([^"]*)(")/, title)
  html = setMeta(html, /(<meta property="og:description" content=")([^"]*)(")/, meta.description)
  html = setMeta(html, /(<meta property="og:url" content=")([^"]*)(")/, url)
  html = setMeta(html, /(<meta name="twitter:title" content=")([^"]*)(")/, title)
  html = setMeta(html, /(<meta name="twitter:description" content=")([^"]*)(")/, meta.description)
  html = setMeta(html, /(<link rel="canonical" href=")([^"]*)(")/, url)
  if (css && cssLink) html = html.replace(cssLink[0], `<style>${css}</style>`)
  // The entry script goes to the end of <body>: the browser (and Lighthouse) can then paint the prerendered HTML without waiting for it.
  const entry = /<script type="module"[^>]*src="\/assets\/[^"]+\.js"[^>]*><\/script>/.exec(html)
  if (entry) html = html.replace(entry[0], "").replace("</body>", `${entry[0]}</body>`)
  const file = meta.path === "/" ? join(dist, "index.html") : join(dist, meta.path, "index.html")
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, html)
  console.log(`prerendered ${meta.path.padEnd(10)} ${(html.length / 1024).toFixed(1)} KB`)
}
