import { useEffect } from "react"

const SITE = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || window.location.origin
export const siteOrigin = SITE

export interface Seo {
  title: string
  description: string
  /** path for canonical + og:url, e.g. "/features" */
  path?: string
  noindex?: boolean
}

function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement("meta")
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

/**
 * Per-page title, description, canonical, Open Graph and Twitter tags. index.html carries the same tags statically
 * (for crawlers and link previews that don't run JavaScript); this keeps them correct while navigating.
 */
export function useSeo({ title, description, path, noindex }: Seo) {
  useEffect(() => {
    const full = title.includes("AccessLens") ? title : `${title} | AccessLens`
    const url = `${SITE}${path ?? window.location.pathname}`
    document.title = full
    setMeta('meta[name="description"]', "name", "description", description)
    setMeta('meta[property="og:title"]', "property", "og:title", full)
    setMeta('meta[property="og:description"]', "property", "og:description", description)
    setMeta('meta[property="og:url"]', "property", "og:url", url)
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", full)
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description)
    setMeta('meta[name="robots"]', "name", "robots", noindex ? "noindex, nofollow" : "index, follow")
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement("link")
      link.rel = "canonical"
      document.head.appendChild(link)
    }
    link.href = url
  }, [title, description, path, noindex])
}
