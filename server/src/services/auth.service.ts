import bcrypt from "bcryptjs"
import { Prisma } from "../generated/prisma/client.js"
import { AppError } from "../utils/AppError.js"
import { logger } from "../utils/logger.js"
import type { LoginInput, RegisterInput } from "../validators/auth.schemas.js"
import { prisma } from "./prisma.js"
import { sha256, signAccessToken, signRefreshToken, verifyRefreshToken } from "./token.service.js"

const COST = 12

// Compared against when the email is unknown so a miss costs the same as a wrong password.
const DUMMY_HASH = bcrypt.hashSync("accesslens-timing-equalizer", COST)

const publicUser = { id: true, name: true, email: true, createdAt: true } as const
export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUser }>

export interface Session {
  user: PublicUser
  accessToken: string
  refreshToken: string
  refreshExpiresAt: Date
}

async function issueSession(user: PublicUser): Promise<Session> {
  const { token, expiresAt } = signRefreshToken(user.id)
  await prisma.refreshToken.create({ data: { tokenHash: sha256(token), userId: user.id, expiresAt } })
  return { user, accessToken: signAccessToken(user.id), refreshToken: token, refreshExpiresAt: expiresAt }
}

export async function register(input: RegisterInput): Promise<Session> {
  const password = await bcrypt.hash(input.password, COST)
  try {
    const user = await prisma.user.create({ data: { name: input.name, email: input.email, password }, select: publicUser })
    return issueSession(user)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError("An account with this email already exists", 409, "EMAIL_TAKEN", [{ path: ["email"], message: "An account with this email already exists" }])
    }
    throw err
  }
}

export async function login(input: LoginInput): Promise<Session> {
  const found = await prisma.user.findUnique({ where: { email: input.email } })
  const ok = await bcrypt.compare(input.password, found?.password ?? DUMMY_HASH)
  if (!found || !ok) throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS")

  // Opportunistic cleanup of this user's expired tokens.
  await prisma.refreshToken.deleteMany({ where: { userId: found.id, expiresAt: { lt: new Date() } } })
  const { id, name, email, createdAt } = found
  return issueSession({ id, name, email, createdAt })
}

/** Single-use rotation. A validly-signed token that is no longer stored was already used: treat as theft. */
export async function refresh(rawToken: string | undefined): Promise<Session> {
  const fail = () => new AppError("Please sign in again", 401, "INVALID_REFRESH")
  if (!rawToken) throw fail()

  const userId = verifyRefreshToken(rawToken)
  if (!userId) throw fail()

  // Atomic consume: only one concurrent request can delete the row.
  const consumed = await prisma.refreshToken.deleteMany({ where: { tokenHash: sha256(rawToken), expiresAt: { gt: new Date() } } })
  if (consumed.count === 0) {
    const { count } = await prisma.refreshToken.deleteMany({ where: { userId } })
    logger.warn("Refresh token reuse detected, all sessions revoked", { userId, revoked: count })
    throw fail()
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUser })
  if (!user) throw fail()
  return issueSession(user)
}

export async function logout(rawToken: string | undefined) {
  if (!rawToken) return
  await prisma.refreshToken.deleteMany({ where: { tokenHash: sha256(rawToken) } })
}

export const findPublicUser = (id: string) => prisma.user.findUnique({ where: { id }, select: publicUser })
