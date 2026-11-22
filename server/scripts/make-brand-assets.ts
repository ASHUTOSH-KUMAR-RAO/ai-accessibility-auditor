// Developer tool: renders the favicon PNGs, apple-touch icon, web-app icons and the 1200x630 social card into client/public.
//   npx tsx scripts/make-brand-assets.ts
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, "../../client/public")
const fonts = resolve(here, "../../client/node_modules/@fontsource-variable")
const b64 = (p: string) => readFileSync(p).toString("base64")
const frauncesNormal = b64(`${fonts}/fraunces/files/fraunces-latin-full-normal.woff2`)
const frauncesItalic = b64(`${fonts}/fraunces/files/fraunces-latin-full-italic.woff2`)
const atkinson = b64(`${fonts}/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2`)

const MARK = (size: number, radius = 12) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}"><rect width="48" height="48" rx="${radius}" fill="#1d1a16"/><g fill="#f3ecdd"><circle cx="18" cy="14" r="3.4" fill="#f58a0b"/><circle cx="30" cy="24" r="3.4" fill="#f58a0b"/><circle cx="18" cy="34" r="3.4"/><circle cx="30" cy="14" r="3.4" opacity=".28"/><circle cx="18" cy="24" r="3.4" opacity=".28"/><circle cx="30" cy="34" r="3.4" opacity=".28"/></g></svg>`

const FONT_CSS = `
@font-face{font-family:"Fraunces";src:url(data:font/woff2;base64,${frauncesNormal}) format("woff2");font-weight:100 900;font-style:normal}
@font-face{font-family:"Fraunces";src:url(data:font/woff2;base64,${frauncesItalic}) format("woff2");font-weight:100 900;font-style:italic}
@font-face{font-family:"Atkinson";src:url(data:font/woff2;base64,${atkinson}) format("woff2");font-weight:200 800}`

const CARD = `<!doctype html><html><head><meta charset="utf-8"><style>${FONT_CSS}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#faf5eb;color:#1d1a16;font-family:Atkinson,sans-serif;position:relative;overflow:hidden}
.dots{position:absolute;inset:0;opacity:.14;background-image:radial-gradient(#1d1a16 2.2px,transparent 2.6px);background-size:26px 26px}
.wrap{position:relative;display:grid;grid-template-columns:1fr 400px;gap:50px;height:100%;padding:70px 80px}
.brand{display:flex;align-items:center;gap:16px;font:600 34px Fraunces,serif}
h1{font:600 76px/1.04 Fraunces,serif;letter-spacing:-.02em;margin-top:46px}
h1 i{position:relative;font-style:italic}
h1 i::after{content:"";position:absolute;left:0;right:0;bottom:-6px;height:8px;border-radius:6px;background:#f58a0b}
p.sub{font-size:30px;color:#5c5448;margin-top:34px;max-width:560px;line-height:1.35}
.card{align-self:center;background:#fffdf8;border:2px solid #ddd1bb;border-radius:32px;padding:34px;box-shadow:0 30px 60px -20px rgba(60,40,10,.35)}
.score{display:flex;align-items:baseline;gap:14px}.score b{font:600 120px/1 Fraunces,serif}.score span{font:600 40px Fraunces,serif;background:#f58a0b;border-radius:14px;padding:2px 18px}
.row{display:flex;align-items:center;gap:12px;margin-top:16px;font-size:24px;font-weight:600}
.pill{width:30px;height:30px;border-radius:8px;border:3px solid;display:grid;place-items:center;font-size:17px;font-weight:700;background:#fff}
</style></head><body><div class="dots"></div><div class="wrap"><div>
<div class="brand">${MARK(56, 12)}<span>Access<i style="font-style:italic">Lens</i></span></div>
<h1>Make the web usable for <i>everyone.</i></h1>
<p class="sub">AI website accessibility auditor: WCAG scan, verified fixes, keyboard and vision tests.</p></div>
<div class="card"><div class="score"><b>62</b><span>D</span></div>
<div class="row"><span class="pill" style="border-color:#d55e00">1</span>33 images without alt text</div>
<div class="row"><span class="pill" style="border-color:#cc79a7">2</span>Text contrast too low</div>
<div class="row"><span class="pill" style="border-color:#d55e00">3</span>Button has no name</div>
<div class="row"><span class="pill" style="border-color:#0072b2">4</span>Missing landmark</div></div></div></body></html>`

const browser = await chromium.launch()
const page = await browser.newPage()
const shot = async (html: string, w: number, h: number, file: string, transparent = false) => {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  writeFileSync(resolve(pub, file), await page.screenshot({ type: "png", omitBackground: transparent }))
}

await shot(CARD, 1200, 630, "og-image.png")
const icon = (size: number, pad: number) => `<!doctype html><body style="margin:0;background:transparent;width:${size}px;height:${size}px;display:grid;place-items:center">${MARK(size - pad * 2, 12 * ((size - pad * 2) / 48))}</body>`
await shot(icon(32, 0), 32, 32, "favicon-32.png", true)
await shot(icon(180, 0), 180, 180, "apple-touch-icon.png")
await shot(icon(192, 0), 192, 192, "icon-192.png", true)
await shot(icon(512, 0), 512, 512, "icon-512.png", true)
await browser.close()
console.log("brand assets written to client/public")
