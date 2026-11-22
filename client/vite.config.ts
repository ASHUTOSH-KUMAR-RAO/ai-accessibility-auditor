import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    proxy: { '/api': { target: 'http://localhost:4000' } },
  },
})

