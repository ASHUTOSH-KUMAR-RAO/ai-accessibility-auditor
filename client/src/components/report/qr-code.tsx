import { useEffect, useState } from "react"
import QRCode from "qrcode"

/** QR code as an <img> with a text alternative (a data: URL from our own encoder, no injected markup). */
export default function QrCode({ value }: { value: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void QRCode.toDataURL(value, { margin: 1, width: 288, color: { dark: "#1d1a16", light: "#ffffff" } }).then((s) => live && setSrc(s))
    return () => { live = false }
  }, [value])
  if (!src) return <div className="size-36 rounded-xl bg-muted" aria-hidden="true" />
  return <img src={src} alt="QR code for the share link" width={144} height={144} className="size-36 shrink-0 rounded-xl border border-border bg-white p-1" />
}
