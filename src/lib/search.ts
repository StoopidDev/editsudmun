import type { Clip } from './types'

export function searchClips<T extends Pick<Clip, 'title' | 'script' | 'note'>>(clips: T[], q: string) {
  const needle = q.trim().toLowerCase()
  if (!needle) return []
  return clips.filter((c) => `${c.title}\n${c.script}\n${c.note}`.toLowerCase().includes(needle))
}

export function snippet(text: string, q: string, radius = 40) {
  const needle = q.trim().toLowerCase()
  const i = needle ? text.toLowerCase().indexOf(needle) : -1
  if (i < 0) return { before: text.slice(0, radius * 2), match: '', after: '' }
  const start = Math.max(0, i - radius)
  const end = Math.min(text.length, i + needle.length + radius)
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, i),
    match: text.slice(i, i + needle.length),
    after: text.slice(i + needle.length, end) + (end < text.length ? '…' : ''),
  }
}
