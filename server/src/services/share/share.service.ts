import { createHash, randomBytes } from "node:crypto"
import { AppError } from "../../utils/AppError.js"
import { prisma } from "../prisma.js"

export const EXPIRIES = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, never: null } as const
export type Expiry = keyof typeof EXPIRIES
export const MAX_ACTIVE_SHARES = 10

/** 32 random bytes as base64url: 43 characters, 256 bits of entropy. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex")

const gone = () => new AppError("This link is invalid or has expired.", 404, "LINK_NOT_FOUND")

const shareSelect = { id: true, expiresAt: true, hideScreenshot: true, views: true, lastViewedAt: true, createdAt: true } as const
export type ShareDto = { id: string; expiresAt: Date | null; hideScreenshot: boolean; views: number; lastViewedAt: Date | null; createdAt: Date }

const active = (now = new Date()) => ({ revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] })

async function ownedCompletedScan(userId: string, scanId: string) {
  const scan = await prisma.scan.findFirst({ where: { id: scanId, userId, deletedAt: null }, select: { id: true, status: true } })
  if (!scan) throw new AppError("Scan not found", 404, "NOT_FOUND")
  if (scan.status !== "COMPLETED") throw new AppError("Only finished scans can be shared.", 409, "NOT_COMPLETED")
}

/** The plain token is returned exactly once, here. Only its hash is stored. */
export async function createShare(userId: string, scanId: string, input: { expiry: Expiry; hideScreenshot: boolean }) {
  await ownedCompletedScan(userId, scanId)
  const activeCount = await prisma.shareLink.count({ where: { scanId, ...active() } })
  if (activeCount >= MAX_ACTIVE_SHARES) throw new AppError(`You can have up to ${MAX_ACTIVE_SHARES} active links per scan. Revoke one first.`, 409, "TOO_MANY_LINKS")
  const token = randomBytes(32).toString("base64url")
  const ms = EXPIRIES[input.expiry]
  const share = await prisma.shareLink.create({
    data: { scanId, tokenHash: hashToken(token), hideScreenshot: input.hideScreenshot, expiresAt: ms === null ? null : new Date(Date.now() + ms) },
    select: shareSelect,
  })
  return { share: share as ShareDto, token }
}

export async function listShares(userId: string, scanId: string): Promise<ShareDto[]> {
  await ownedCompletedScan(userId, scanId)
  return prisma.shareLink.findMany({ where: { scanId, ...active() }, orderBy: { createdAt: "desc" }, select: shareSelect })
}

export async function revokeShare(userId: string, scanId: string, shareId: string) {
  const { count } = await prisma.shareLink.updateMany({ where: { id: shareId, scanId, scan: { userId }, revokedAt: null }, data: { revokedAt: new Date() } })
  if (count === 0) throw new AppError("Link not found", 404, "NOT_FOUND")
}

export interface ResolvedShare { shareId: string; scanId: string; hideScreenshot: boolean; expiresAt: Date | null }

/** Wrong, malformed, expired, revoked and deleted-scan tokens all look the same from outside: 404. */
export async function resolveShare(token: string, opts: { countView?: boolean } = {}): Promise<ResolvedShare> {
  if (!TOKEN_RE.test(token)) throw gone()
  const share = await prisma.shareLink.findFirst({
    where: { tokenHash: hashToken(token), ...active(), scan: { deletedAt: null, status: "COMPLETED" } },
    select: { id: true, scanId: true, hideScreenshot: true, expiresAt: true },
  })
  if (!share) throw gone()
  if (opts.countView) void prisma.shareLink.update({ where: { id: share.id }, data: { views: { increment: 1 }, lastViewedAt: new Date() } }).catch(() => {})
  return { shareId: share.id, scanId: share.scanId, hideScreenshot: share.hideScreenshot, expiresAt: share.expiresAt }
}
