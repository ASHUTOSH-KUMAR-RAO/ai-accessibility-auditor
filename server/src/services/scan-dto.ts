import type { Prisma } from "../generated/prisma/client.js"
import { prisma } from "./prisma.js"
import { emitToUser, type ScanEvent } from "./realtime.js"

/** Everything the API ever returns about a scan. No userId, no queue bookkeeping, no image bytes. */
export const scanSelect = {
  id: true,
  url: true,
  normalizedUrl: true,
  finalUrl: true,
  status: true,
  progress: true,
  stage: true,
  score: true,
  criticalCount: true,
  seriousCount: true,
  moderateCount: true,
  minorCount: true,
  passesCount: true,
  incompleteCount: true,
  pageTitle: true,
  viewport: true,
  durationMs: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  screenshot: { select: { scanId: true } },
} satisfies Prisma.ScanSelect

type ScanRow = Prisma.ScanGetPayload<{ select: typeof scanSelect }>

export function toScanDto({ screenshot, ...scan }: ScanRow) {
  return { ...scan, hasScreenshot: screenshot !== null }
}
export type ScanDto = ReturnType<typeof toScanDto>

/** Re-reads the scan and pushes the full summary to its owner's sockets. */
export async function publishScan(userId: string, event: ScanEvent, scanId: string) {
  const row = await prisma.scan.findUnique({ where: { id: scanId }, select: scanSelect })
  if (row) emitToUser(userId, event, toScanDto(row))
}
