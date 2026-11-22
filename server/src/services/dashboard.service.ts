import { prisma } from "./prisma.js"

/** Everything the dashboard shows, in one round trip. Soft-deleted and unfinished scans never count. */
export async function getDashboard(userId: string) {
  const done = { userId, deletedAt: null, status: "COMPLETED" as const }
  const [totalScans, completed, hosts, aiVerified, recent, top] = await Promise.all([
    prisma.scan.count({ where: { userId, deletedAt: null } }),
    prisma.scan.aggregate({ where: done, _avg: { score: true }, _count: true }),
    prisma.scan.groupBy({ by: ["host"], where: { ...done, host: { not: "" } }, _count: true }),
    prisma.aiUsage.count({ where: { userId, verification: "VERIFIED" } }),
    prisma.scan.findMany({
      where: { ...done, host: { not: "" } },
      orderBy: { createdAt: "desc" },
      take: 400,
      select: { id: true, host: true, score: true, createdAt: true, favicon: true },
    }),
    prisma.$queryRaw<Array<{ ruleId: string; help: string; impact: string; scans: bigint; elements: bigint }>>`
      SELECT i."ruleId", min(i."help") AS help, min(i."impact"::text) AS impact,
             count(DISTINCT i."scanId") AS scans, count(*) AS elements
      FROM "Issue" i JOIN "Scan" s ON s."id" = i."scanId"
      WHERE s."userId" = ${userId}::uuid AND s."deletedAt" IS NULL AND s."status" = 'COMPLETED'
      GROUP BY i."ruleId"
      ORDER BY scans DESC, elements DESC, i."ruleId" ASC
      LIMIT 5`,
  ])

  // newest first → per site: latest, previous and the last 8 scores in time order (sparkline)
  const bySite = new Map<string, typeof recent>()
  for (const s of recent) bySite.set(s.host, [...(bySite.get(s.host) ?? []), s])
  const sites = [...bySite]
    .map(([host, scans]) => ({
      host,
      favicon: scans.find((s) => s.favicon)?.favicon ?? null,
      scanCount: hosts.find((h) => h.host === host)?._count ?? scans.length,
      latest: { id: scans[0]!.id, score: scans[0]!.score ?? 0, createdAt: scans[0]!.createdAt },
      previousScore: scans[1]?.score ?? null,
      trend: scans.slice(0, 8).reverse().map((s) => s.score ?? 0),
    }))
    .sort((a, b) => +b.latest.createdAt - +a.latest.createdAt)
    .slice(0, 6)

  return {
    totals: {
      scans: totalScans,
      completed: completed._count,
      averageScore: completed._avg.score === null ? null : Math.round(completed._avg.score),
      sites: hosts.length,
      aiFixesVerified: aiVerified,
    },
    sites,
    topIssues: top.map((t) => ({ ruleId: t.ruleId, help: t.help, impact: t.impact.toLowerCase(), scans: Number(t.scans), elements: Number(t.elements) })),
  }
}
