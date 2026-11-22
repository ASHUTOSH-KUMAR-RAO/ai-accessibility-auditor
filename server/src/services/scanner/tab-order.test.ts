// Records focus order on local pages (setContent: no network). Needs the Playwright Chromium.
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import type { BrowserContext } from "playwright"
import "../../config/env.js"
import { closeBrowser, getBrowser } from "./browser.js"
import { analyzeTabOrder, recordTabOrder, type TabOrder } from "./tab-order.js"

let context: BrowserContext
before(async () => {
  context = await (await getBrowser()).newContext({ proxy: { server: "http://127.0.0.1:9" }, viewport: { width: 800, height: 600 } })
})
after(async () => {
  await context.close()
  await closeBrowser()
})
const record = async (html: string, maxStops?: number): Promise<TabOrder> => {
  const page = await context.newPage() // fresh page: the sequential-focus starting point must not leak between tests
  try {
    await page.setContent(`<!doctype html><html lang="en"><head><title>t</title><style>body{margin:0}</style></head><body>${html}</body></html>`)
    return await recordTabOrder(page, { maxStops })
  } finally {
    await page.close()
  }
}

describe("recordTabOrder", () => {
  it("records order, role, accessible name and box, and sees the whole loop", async () => {
    const o = await record(`<a href="/a">Home</a> <button>Save</button> <label for="q">Search</label><input id="q"> <button aria-label="Close dialog">x</button>`)
    assert.deepEqual(o.stops.map((s) => [s.role, s.name]), [["link", "Home"], ["button", "Save"], ["textbox", "Search"], ["button", "Close dialog"]])
    assert.equal(o.complete, true)
    assert.equal(o.trap, null)
    assert.equal(o.stops[0]!.n, 1)
    assert.ok(o.stops[0]!.box.width > 0)
    assert.equal(o.stops.every((s) => s.focusVisible), true) // default browser focus ring
    assert.deepEqual(o.warnings, [])
  })

  it("flags invisible focus (outline removed, nothing in its place) but not a custom indicator", async () => {
    const o = await record(`<style>.bad:focus{outline:none}.ok:focus{outline:none;box-shadow:0 0 0 3px #00f}</style><button class="bad">Bad</button><button class="ok">Fine</button>`)
    assert.deepEqual(o.stops.map((s) => s.focusVisible), [false, true])
    assert.deepEqual(o.warnings.map((w) => [w.type, w.stop]), [["invisible-focus", 1]])
  })

  it("flags focus that lands off-screen", async () => {
    const o = await record(`<a href="#a">Visible</a><a href="#b" style="position:absolute;left:-9999px">Hidden skip</a><a href="#c">After</a>`)
    assert.equal(o.stops[1]!.offscreen, true)
    assert.ok(o.warnings.some((w) => w.type === "offscreen" && w.stop === 2))
  })

  it("flags big focus jumps (positive tabindex sends focus to the bottom, then back to the top)", async () => {
    const o = await record(`<a href="#a">Top</a><div style="height:2500px"></div><a href="#z" tabindex="1">Far below</a>`)
    // tabindex=1 comes first in the order, so the sequence is: Far below (y≈2500) → Top (y≈0)
    assert.deepEqual(o.stops.map((s) => s.name), ["Far below", "Top"])
    assert.ok(o.warnings.some((w) => w.type === "focus-jump" && w.stop === 2), JSON.stringify(o.warnings))
  })

  it("detects a keyboard trap", async () => {
    const o = await record(`<button id="a">Before</button>
      <div id="modal"><button id="m1">One</button><button id="m2">Two</button></div>
      <button id="z">After</button>
      <script>
        const ring=[document.getElementById('m1'),document.getElementById('m2')];
        document.getElementById('modal').addEventListener('keydown',e=>{ if(e.key==='Tab'){ e.preventDefault(); const i=ring.indexOf(document.activeElement); ring[(i+1)%2].focus() } })
      </script>`)
    assert.ok(o.trap, "trap expected")
    assert.equal(o.complete, false)
    assert.deepEqual(o.stops.map((s) => s.name), ["Before", "One", "Two"])
    assert.ok(o.warnings.some((w) => w.type === "trap"))
    assert.ok(!o.stops.some((s) => s.name === "After")) // never reached
  })

  it("lists interactive elements that can't be reached by keyboard", async () => {
    const o = await record(`<button>Real button</button><div onclick="void 0" style="cursor:pointer;padding:10px">Fake button</div><button tabindex="-1">Programmatic only</button>`)
    assert.deepEqual(o.unreachable.map((u) => u.name), ["Fake button"])
    assert.ok(o.warnings.some((w) => w.type === "unreachable"))
  })

  it("catches links that blur themselves (onfocus=blur()) instead of skipping them", async () => {
    const o = await record(`<a href="#a">Normal</a><a href="#b" onfocus="blur()">Blurs itself</a><a href="#c">After</a>`)
    assert.deepEqual(o.stops.map((s) => s.name), ["Normal", "Blurs itself", "After"])
    assert.equal(o.stops[1]!.focusLost, true)
    assert.equal(o.complete, true)
    assert.equal(o.unreachable.length, 0) // it IS reachable: that is not the problem
    assert.ok(o.warnings.some((w) => w.type === "focus-lost" && w.stop === 2), JSON.stringify(o.warnings))
  })

  it("respects the stop cap", async () => {
    const o = await record(Array.from({ length: 30 }, (_, i) => `<a href="#${i}">L${i}</a>`).join(" "), 10)
    assert.equal(o.stops.length, 10)
    assert.equal(o.truncated, true)
    assert.equal(o.complete, false)
    assert.equal(o.unreachable.length, 0) // not judged on a partial walk
  })

  it("a page with nothing focusable returns an empty, harmless result", async () => {
    const o = await record(`<p>Just text</p>`)
    assert.deepEqual(o.stops, [])
  })
})

describe("analyzeTabOrder", () => {
  const stop = (n: number, y: number, over: Record<string, unknown> = {}) => ({ n, selector: `s${n}`, tag: "a", role: "link", name: `L${n}`, box: { x: 0, y, width: 50, height: 20 }, focusVisible: true, offscreen: false, ...over })
  it("only flags jumps over the thresholds", () => {
    const w = analyzeTabOrder({ stops: [stop(1, 0), stop(2, 250), stop(3, 100), stop(4, 100), stop(5, 1000)], trap: null, unreachable: [], truncated: false, complete: true })
    assert.deepEqual(w, [])
    const jump = analyzeTabOrder({ stops: [stop(1, 1000), stop(2, 100)], trap: null, unreachable: [], truncated: false, complete: true })
    assert.equal(jump[0]!.type, "focus-jump")
  })
})
