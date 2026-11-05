import type { ClipInput } from './types'

const key = (clipId?: string) => (clipId ? `clip-draft-${clipId}` : 'clip-draft')

export function readDraft(clipId?: string): ClipInput | null {
  try {
    return JSON.parse(localStorage.getItem(key(clipId)) ?? 'null')
  } catch {
    return null
  }
}

export const writeDraft = (form: ClipInput, clipId?: string) => localStorage.setItem(key(clipId), JSON.stringify(form))
export const clearDraft = (clipId?: string) => localStorage.removeItem(key(clipId))

export const sameBrief = (a: ClipInput, b: ClipInput) =>
  a.date === b.date && a.category_id === b.category_id && a.title.trim() === b.title.trim()
  && a.script === b.script && a.note === b.note

export const isBlank = (f: ClipInput) => !(f.title || f.script || f.note)
