// Everything the UI may do to data. Replace this file and ./fake with Supabase calls later;
// the checks below mimic RLS for realistic behaviour and are not real security.
import { canWithdraw } from '@/lib/media'
import { searchClips } from '@/lib/search'
import type { Category, Clip, ClipCardRow, ClipInput, Profile, Role } from '@/lib/types'
import { db, save } from './fake/db'

const SESSION = 'fake-session'
const wait = () => new Promise((r) => setTimeout(r, import.meta.env.MODE === 'test' ? 0 : 150))

export function me(): Profile | null {
  const id = localStorage.getItem(SESSION)
  return db().profiles.find((p) => p.id === id) ?? null
}

function need(role?: Role) {
  const u = me()
  if (!u) throw new Error('กรุณาเข้าสู่ระบบ')
  if (role && u.role !== role) throw new Error('ไม่มีสิทธิ์ทำรายการนี้')
  return u
}

const live = () => db().clips.filter((c) => !c.deleted_at)
const uid = () => crypto.randomUUID()
const stamp = () => new Date().toISOString()
const nextPosition = (date: string) => Math.max(-1, ...live().filter((c) => c.date === date).map((c) => c.position)) + 1
const toCard = (c: Clip): ClipCardRow => ({
  ...c,
  imageCount: db().media.filter((m) => m.clip_id === c.id && m.purpose === 'reference' && m.kind === 'image').length,
})
const clipOf = (id: string) => {
  const c = db().clips.find((x) => x.id === id)
  if (!c) throw new Error('ไม่พบคลิป')
  return c
}

// Auth
export async function login(email: string, password: string) {
  await wait()
  const user = db().profiles.find((p) => p.email === email.trim().toLowerCase())
  if (!user || db().passwords[user.email] !== password) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  localStorage.setItem(SESSION, user.id)
  return user
}
export const logout = () => localStorage.removeItem(SESSION)

// Clips
export async function listClips(from: string, to: string) {
  await wait()
  need()
  return live()
    .filter((c) => c.date >= from && c.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.position - b.position)
    .map(toCard)
}

export async function listRecent(limit: number) {
  await wait()
  need()
  return [...live()].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit)
}

export async function getClip(id: string) {
  await wait()
  need()
  return live().find((c) => c.id === id) ?? null
}

export async function createClip(input: ClipInput) {
  await wait()
  const u = need('owner')
  const clip: Clip = {
    ...input, id: uid(), position: nextPosition(input.date), created_by: u.id, updated_at: stamp(),
    status: 'todo', revision_note: '', deleted_at: null,
  }
  db().clips.push(clip)
  save()
  return clip
}

export async function updateClip(id: string, patch: Partial<ClipInput>) {
  await wait()
  need('owner')
  const c = clipOf(id)
  if (patch.date && patch.date !== c.date) c.position = nextPosition(patch.date)
  Object.assign(c, patch, { updated_at: stamp() })
  save()
  return c
}

export async function softDeleteClip(id: string) {
  await wait()
  need('owner')
  clipOf(id).deleted_at = stamp()
  save()
}

export async function restoreClip(id: string) {
  await wait()
  need('owner')
  clipOf(id).deleted_at = null
  save()
}

export async function moveClip(id: string, dir: -1 | 1) {
  await wait()
  need('owner')
  const c = clipOf(id)
  const day = live().filter((x) => x.date === c.date).sort((a, b) => a.position - b.position)
  const other = day[day.findIndex((x) => x.id === id) + dir]
  if (!other) return
  ;[c.position, other.position] = [other.position, c.position]
  save()
}

export async function copyClip(id: string, date: string) {
  await wait()
  const u = need('owner')
  const src = clipOf(id)
  const copy: Clip = {
    ...src, id: uid(), date, position: nextPosition(date), created_by: u.id, updated_at: stamp(),
    status: 'todo', revision_note: '',
  }
  db().clips.push(copy)
  const refs = db().media.filter((m) => m.clip_id === id && m.purpose === 'reference')
  db().media.push(...refs.map((m) => ({ ...m, id: uid(), clip_id: copy.id })))
  save()
  return copy
}

export async function reviewClip(id: string, status: 'approved' | 'revision', note = '') {
  await wait()
  need('owner')
  if (status === 'revision' && !note.trim()) throw new Error('กรุณาระบุเหตุผลที่ขอแก้ไข')
  const c = clipOf(id)
  c.status = status
  c.revision_note = status === 'revision' ? note.trim() : ''
  c.updated_at = stamp()
  save()
  return c
}

export async function search(q: string) {
  await wait()
  need()
  return searchClips(live(), q).sort((a, b) => b.date.localeCompare(a.date))
}

// Media
export async function listMedia(clipId: string) {
  await wait()
  need()
  return db().media.filter((m) => m.clip_id === clipId)
}

function dropMedia(id: string) {
  const d = db()
  const m = d.media.find((x) => x.id === id)
  if (!m) return
  d.media = d.media.filter((x) => x.id !== id)
  const left = d.media.some((x) => x.clip_id === m.clip_id && x.purpose === 'submission')
  if (m.purpose === 'submission' && !left) clipOf(m.clip_id).status = 'todo'
  save()
}

export async function deleteMedia(id: string) {
  await wait()
  need('owner')
  dropMedia(id)
}

export async function withdrawMedia(id: string) {
  await wait()
  const u = need('creator')
  const m = db().media.find((x) => x.id === id)
  if (!m || !canWithdraw(m, u.id)) throw new Error('หมดเวลาถอนไฟล์นี้แล้ว')
  dropMedia(id)
}

export async function storageUsedBytes() {
  await wait()
  need('owner')
  return db().media.reduce((sum, m) => sum + m.size_bytes, 0)
}

// Categories
export async function listCategories() {
  await wait()
  need()
  return [...db().categories].sort((a, b) => a.position - b.position)
}

export async function categoryCounts() {
  await wait()
  need()
  const counts: Record<string, number> = {}
  for (const c of live()) counts[c.category_id] = (counts[c.category_id] ?? 0) + 1
  return counts
}

export async function createCategory(name: string, color: string) {
  await wait()
  need('owner')
  const cat: Category = { id: uid(), name, color, position: db().categories.length }
  db().categories.push(cat)
  save()
  return cat
}

export async function updateCategory(id: string, patch: Pick<Category, 'name' | 'color'>) {
  await wait()
  need('owner')
  Object.assign(db().categories.find((c) => c.id === id) ?? {}, patch)
  save()
}

export async function deleteCategory(id: string) {
  await wait()
  need('owner')
  if (live().some((c) => c.category_id === id)) throw new Error('ลบไม่ได้ ยังมีคลิปในประเภทนี้')
  db().categories = db().categories.filter((c) => c.id !== id)
  save()
}

// Users (the real version calls the create-creator Edge Function)
const tempPassword = () => Math.random().toString(36).slice(2, 10)

export async function listUsers() {
  await wait()
  need('owner')
  return db().profiles
}

export async function createCreator(display_name: string, rawEmail: string) {
  await wait()
  need('owner')
  const email = rawEmail.trim().toLowerCase()
  if (db().profiles.some((p) => p.email === email)) throw new Error('อีเมลนี้มีบัญชีอยู่แล้ว')
  const user: Profile = { id: uid(), role: 'creator', display_name, email, created_at: stamp() }
  const password = tempPassword()
  db().profiles.push(user)
  db().passwords[email] = password
  save()
  return { user, tempPassword: password }
}

export async function resetPassword(id: string) {
  await wait()
  need('owner')
  const user = db().profiles.find((p) => p.id === id)
  if (!user) throw new Error('ไม่พบผู้ใช้')
  const password = tempPassword()
  db().passwords[user.email] = password
  save()
  return password
}

export async function deleteUser(id: string) {
  await wait()
  need('owner')
  const user = db().profiles.find((p) => p.id === id)
  if (user?.role === 'owner') throw new Error('ลบบัญชีเจ้าของไม่ได้')
  db().profiles = db().profiles.filter((p) => p.id !== id)
  save()
}
