// Moves a clip to another place in its day (drag and drop). Renumbers the day 0..n-1, like swapInDay.
export function moveInDay<T extends { id: string; date: string; position: number }>(rows: T[], id: string, to: number): T[] {
  const me = rows.find((r) => r.id === id)
  if (!me) return rows
  const day = rows.filter((r) => r.date === me.date && r.id !== id).sort((a, b) => a.position - b.position)
  day.splice(Math.max(0, Math.min(to, day.length)), 0, me)
  const slot = new Map(day.map((r, k) => [r.id, k]))
  return rows
    .map((r) => {
      const n = slot.get(r.id)
      return n === undefined ? r : { ...r, position: n }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
}

// Moves a clip to the end of another day (drag between day columns), as the server does when a clip's date changes.
export function moveToDay<T extends { id: string; date: string; position: number }>(rows: T[], id: string, date: string): T[] {
  const last = Math.max(-1, ...rows.filter((r) => r.date === date && r.id !== id).map((r) => r.position))
  return rows
    .map((r) => (r.id === id ? { ...r, date, position: last + 1 } : r))
    .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
}

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
