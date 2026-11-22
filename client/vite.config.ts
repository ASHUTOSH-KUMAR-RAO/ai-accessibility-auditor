import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'


const PUBLIC_PAGES = ['/', '/features', '/sample', '/privacy', '/terms', '/cookies']

/** robots.txt and sitemap.xml from VITE_SITE_URL, plus a preload for the body font (the large display font is left to load lazily with font-display: swap). */
function seoFiles(): Plugin {
  let site = 'http://localhost:5173'
  const NL = String.fromCharCode(10)
  const robots = () => ['User-agent: *', 'Allow: /', 'Disallow: /dashboard', 'Disallow: /scans', 'Disallow: /sites', 'Disallow: /compare', 'Disallow: /r/', 'Disallow: /login', 'Disallow: /signup', '', `Sitemap: ${site}/sitemap.xml`, ''].join(NL)
  const sitemap = () =>
    ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...PUBLIC_PAGES.map((p) => `  <url><loc>${site}${p}</loc></url>`), '</urlset>', ''].join(NL)
  return {
    name: 'accesslens-seo-files',
    configResolved(c) {
      site = (loadEnv(c.mode, c.root, 'VITE_').VITE_SITE_URL || site).replace(/\/$/, '')
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/robots.txt') return void res.setHeader('Content-Type', 'text/plain').end(robots())
        if (req.url === '/sitemap.xml') return void res.setHeader('Content-Type', 'application/xml').end(sitemap())
        next()
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots() })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() })
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        const fonts = Object.keys(ctx.bundle).filter((f) => /atkinson-hyperlegible-next-latin-wght-normal.*\.woff2$/.test(f))
        const tags = fonts.map((f) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/${f}">`).join('')
        return html.replace('</head>', `${tags}</head>`)
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoFiles()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    rolldownOptions: {
      output: {
        // Stable, cacheable vendor chunks; route code is split via React.lazy.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//, priority: 30 },
            { name: 'motion', test: /node_modules\/(framer-motion|motion-dom|motion-utils)\//, priority: 25 },
            { name: 'gsap', test: /node_modules\/gsap\//, priority: 25 },
            { name: 'forms', test: /node_modules\/(react-hook-form|@hookform|zod)\//, priority: 25 },
            { name: 'ui', test: /node_modules\/(@base-ui|sonner|lucide-react|tailwind-merge|clsx|class-variance-authority)\//, priority: 20 },
            { name: 'data', test: /node_modules\/(axios|@tanstack)\//, priority: 20 },
          ],
        },
      },
    },
  },
  server: {
    // Mirrors the production Vercel rewrite: the browser only ever talks to its own origin,
    // so the refresh cookie is first-party in dev and prod alike.
    proxy: {
      '/api': { target: 'http://localhost:4000' },
      '/socket.io': { target: 'http://localhost:4000', ws: true }, // live scan progress
    },
  },
})

