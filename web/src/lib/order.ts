// Swaps a clip with its neighbour in the same day. Renumbers the day 0..n-1 first, as move_clip does on the server.
// Result is sorted by day, then position.
export function swapInDay<T extends { id: string; date: string; position: number }>(rows: T[], id: string, dir: -1 | 1): T[] {
  const me = rows.find((r) => r.id === id)
  if (!me) return rows
  const day = rows.filter((r) => r.date === me.date).sort((a, b) => a.position - b.position)
  const i = day.findIndex((r) => r.id === id)
  const other = day[i + dir]
  if (!other) return rows
  const slot = new Map(day.map((r, k) => [r.id, k]))
  slot.set(me.id, i + dir)
  slot.set(other.id, i)
  return rows
    .map((r) => {
      const n = slot.get(r.id)
      return n === undefined ? r : { ...r, position: n }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
}
