const endsWith = (lines: string[], tail: string[]) => tail.length <= lines.length && tail.every((line, i) => line === lines[lines.length - tail.length + i])

/** The newest (at most four) lines of a capped log that the last update wrote. The log drops its oldest
 * lines once full and a batched order rewrites its last line, so neither length nor the last line alone tells. */
export function freshLines(before: string[], after: string[]): string[] {
  if (before === after) return []
  if (after.length === before.length && after.every((line, i) => line === before[i])) return []
  for (let added = 1; added <= after.length; added++) {
    const kept = after.slice(0, after.length - added)
    if (endsWith(before, kept) || endsWith(before.slice(0, -1), kept)) return after.slice(-Math.min(added, 4))
  }
  return after.slice(-4)
}
