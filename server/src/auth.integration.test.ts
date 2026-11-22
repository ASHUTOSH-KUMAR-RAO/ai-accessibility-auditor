// Integration test: needs the local Postgres (docker compose up -d) and a valid server/.env.
import assert from "node:assert/strict"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import { after, before, test } from "node:test"
import { app } from "./app.js"
import { env } from "./config/env.js"
import { prisma } from "./services/prisma.js"

const email = `it-${Date.now()}@example.com`
const password = "Sup3rSecret99"
const origin = env.CLIENT_URL[0]!
let server: Server
let base: string

const call = (path: string, init: RequestInit & { cookie?: string; token?: string; origin?: string } = {}) =>
  fetch(base + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Origin: init.origin ?? origin,
      ...(init.cookie && { Cookie: init.cookie }),
      ...(init.token && { Authorization: `Bearer ${init.token}` }),
    },
  })
const post = (path: string, body?: unknown, extra: object = {}) => call(path, { method: "POST", body: JSON.stringify(body ?? {}), ...extra })
const refreshCookie = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith("refresh_token="))
const cookiePair = (c: string) => c.split(";")[0]!

before(async () => {
  server = app.listen(0)
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})
after(async () => {
  await prisma.user.deleteMany({ where: { email } })
  await prisma.$disconnect()
  server.close()
})

test("auth lifecycle: register → login → me → rotate → reuse detection → logout", async () => {
  // validation
  const bad = await post("/auth/register", { name: "A", email: "nope", password: "short" })
  assert.equal(bad.status, 400)

  // register
  const reg = await post("/auth/register", { name: "Test User", email: email.toUpperCase(), password })
  assert.equal(reg.status, 201)
  const regBody = await reg.json()
  assert.ok(regBody.data.accessToken)
  assert.equal(regBody.data.user.email, email) // normalised
  assert.ok(!JSON.stringify(regBody).match(/password|hash/i), "no secrets in response")
  const cookie = refreshCookie(reg)!
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=Lax/i)
  assert.match(cookie, /Path=\/api\/auth/)

  // duplicate
  assert.equal((await post("/auth/register", { name: "Dup", email, password })).status, 409)

  // generic login failure (no enumeration)
  const wrongPw = await post("/auth/login", { email, password: "WrongPass1" })
  const noUser = await post("/auth/login", { email: "ghost@example.com", password: "WrongPass1" })
  assert.equal(wrongPw.status, 401)
  assert.equal(noUser.status, 401)
  assert.deepEqual(await wrongPw.json(), await noUser.json())

  // login + me
  const login = await post("/auth/login", { email, password })
  assert.equal(login.status, 200)
  const { accessToken } = (await login.json()).data
  assert.equal((await call("/auth/me")).status, 401)
  const me = await call("/auth/me", { token: accessToken })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).data.user.email, email)
  assert.equal((await call("/auth/me", { token: "garbage" })).status, 401)

  // CSRF origin check
  assert.equal((await post("/auth/refresh", {}, { cookie: cookiePair(refreshCookie(login)!), origin: "https://evil.example" })).status, 403)

  // rotation
  const first = cookiePair(refreshCookie(login)!)
  const rotated = await post("/auth/refresh", {}, { cookie: first })
  assert.equal(rotated.status, 200)
  const second = cookiePair(refreshCookie(rotated)!)
  assert.notEqual(first, second)

  // replaying the old token = theft: rejected AND every session revoked
  assert.equal((await post("/auth/refresh", {}, { cookie: first })).status, 401)
  assert.equal((await post("/auth/refresh", {}, { cookie: second })).status, 401)

  // logout clears the cookie
  const again = await post("/auth/login", { email, password })
  const out = await post("/auth/logout", {}, { cookie: cookiePair(refreshCookie(again)!) })
  assert.equal(out.status, 200)
  assert.match(refreshCookie(out) ?? "", /refresh_token=;/)
  assert.equal((await post("/auth/refresh", {}, { cookie: cookiePair(refreshCookie(again)!) })).status, 401)
})
