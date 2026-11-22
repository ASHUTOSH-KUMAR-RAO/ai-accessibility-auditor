/** axe's failureSummary → groups of checklist items ("Fix any of the following:" / "Fix all of the following:"). */
export function parseFailureSummary(text: string): Array<{ title: string; items: string[] }> {
  const groups: Array<{ title: string; items: string[] }> = []
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue
    if (/^\s/.test(raw)) groups.at(-1)?.items.push(raw.trim())
    else groups.push({ title: raw.trim().replace(/:$/, ""), items: [] })
  }
  return groups.filter((g) => g.items.length > 0)
}
