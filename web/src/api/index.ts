// Everything the UI may do to data, on Supabase. Permissions are enforced by RLS, triggers and
// RPCs in supabase/migrations; checks here only give friendlier Thai errors.
import { FunctionsHttpError, type PostgrestError } from '@supabase/supabase-js'
import { isIsoDate } from '@/lib/dates'
import type { Category, Clip, ClipCardRow, ClipInput, ClipMedia, Profile } from '@/lib/types'
import { supabase } from './supabase'

// Postgres errors raised by our functions are already Thai; map the rest.
function thai(e: PostgrestError): Error {
  if (e.code === 'P0001') return new Error(e.message)
  if (e.code === '42501' || e.code === 'PGRST301') return new Error('ไม่มีสิทธิ์ทำรายการนี้')
  if (e.code === '23503') return new Error('ข้อมูลที่อ้างถึงไม่มีอยู่แล้ว')
  if (e.code === '23514') return new Error('ข้อมูลไม่ถูกต้อง')
  console.error(e)
  return new Error('เกิดข้อผิดพลาด ลองอีกครั้ง')
}

function ok<T>({ data, error }: { data: T; error: PostgrestError | null }): T {
  if (error) throw thai(error)
  return data
}

// An update RLS refuses matches no rows instead of failing; treat that as not found.
function one<T>(r: { data: T[] | null; error: PostgrestError | null }, missing = 'ไม่พบคลิป'): T {
  const rows = ok(r) ?? []
  if (!rows.length) throw new Error(missing)
  return rows[0]
}

const stamp = () => new Date().toISOString()
const checkDate = (d: string) => {
  if (!isIsoDate(d)) throw new Error('วันที่ไม่ถูกต้อง')
}

// Auth
export async function me(): Promise<Profile | null> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) return null
  return ok(await supabase.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null
}

export async function login(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  return me()
}

export async function logout() {
  await supabase.auth.signOut()
}

// Clips
// Cards show the number of reference images; counted in the same request.
const CARD = '*, images:clip_media(count)'
type CardRow = Clip & { images: { count: number }[] }
const toCard = ({ images, ...c }: CardRow): ClipCardRow => ({ ...c, imageCount: images[0]?.count ?? 0 })

export async function listClips(from: string, to: string): Promise<ClipCardRow[]> {
  const rows = ok(
    await supabase
      .from('clips')
      .select(CARD)
      .gte('date', from)
      .lte('date', to)
      .is('deleted_at', null)
      .eq('images.purpose', 'reference')
      .eq('images.kind', 'image')
      .order('date')
      .order('position'),
  )
  return (rows as CardRow[]).map(toCard)
}

export async function listRecent(limit: number): Promise<Clip[]> {
  return ok(
    await supabase.from('clips').select('*').is('deleted_at', null).order('updated_at', { ascending: false }).limit(limit),
  ) as Clip[]
}

export async function getClip(id: string): Promise<Clip | null> {
  return ok(await supabase.from('clips').select('*').eq('id', id).is('deleted_at', null).maybeSingle()) as Clip | null
}

export async function createClip(input: ClipInput): Promise<Clip> {
  checkDate(input.date)
  return ok(await supabase.from('clips').insert(input).select().single()) as Clip
}

// Only brief fields are editable here; status changes go through reviewClip.
const EDITABLE = ['date', 'category_id', 'title', 'script', 'note'] as const
export async function updateClip(id: string, patch: Partial<ClipInput>): Promise<Clip> {
  if (patch.date !== undefined) checkDate(patch.date)
  const changes: Partial<ClipInput> = Object.fromEntries(EDITABLE.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]]))
  return one(await supabase.from('clips').update(changes).eq('id', id).select()) as Clip
}

export async function softDeleteClip(id: string) {
  one(await supabase.from('clips').update({ deleted_at: stamp() }).eq('id', id).select('id'))
}

export async function restoreClip(id: string) {
  one(await supabase.from('clips').update({ deleted_at: null }).eq('id', id).select('id'))
}

export async function moveClip(id: string, dir: -1 | 1) {
  ok(await supabase.rpc('move_clip', { p_id: id, p_dir: dir }))
}

export async function copyClip(id: string, date: string): Promise<Clip> {
  checkDate(date)
  return ok(await supabase.rpc('copy_clip', { p_id: id, p_date: date })) as Clip
}

export async function reviewClip(id: string, status: 'approved' | 'revision', note = ''): Promise<Clip> {
  if (status === 'revision' && !note.trim()) throw new Error('กรุณาระบุเหตุผลที่ขอแก้ไข')
  const revision_note = status === 'revision' ? note.trim() : ''
  return one(await supabase.from('clips').update({ status, revision_note }).eq('id', id).select()) as Clip
}

export async function search(q: string): Promise<Clip[]> {
  if (!q.trim()) return []
  return ok(await supabase.rpc('search_clips', { p_q: q })) as Clip[]
}

// Media
export async function listMedia(clipId: string): Promise<ClipMedia[]> {
  return ok(await supabase.from('clip_media').select('*').eq('clip_id', clipId).order('created_at')) as ClipMedia[]
}

export async function deleteMedia(id: string) {
  one(await supabase.from('clip_media').delete().eq('id', id).select('id'), 'ไม่พบไฟล์')
}

// RLS allows it only for the uploader, while pending or within 10 minutes of finishing.
export async function withdrawMedia(id: string) {
  one(await supabase.from('clip_media').delete().eq('id', id).select('id'), 'หมดเวลาถอนไฟล์นี้แล้ว')
}

export async function storageUsedBytes(): Promise<number> {
  const row = ok(await supabase.from('storage_usage').select('total_bytes').single()) as { total_bytes: number }
  return row.total_bytes
}

// Categories
export async function listCategories(): Promise<Category[]> {
  return ok(await supabase.from('categories').select('*').order('position')) as Category[]
}

// shortcut: counts in the browser from one column; move to a grouped view if clips grow past ~50k.
export async function categoryCounts(): Promise<Record<string, number>> {
  const rows = ok(await supabase.from('clips').select('category_id').is('deleted_at', null)) as { category_id: string }[]
  const counts: Record<string, number> = {}
  for (const r of rows) counts[r.category_id] = (counts[r.category_id] ?? 0) + 1
  return counts
}

export async function createCategory(name: string, color: string): Promise<Category> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('กรุณากรอกชื่อประเภท')
  const last = ok(await supabase.from('categories').select('position').order('position', { ascending: false }).limit(1))
  const position = ((last as { position: number }[])[0]?.position ?? -1) + 1
  return ok(await supabase.from('categories').insert({ name: trimmed, color, position }).select().single()) as Category
}

export async function updateCategory(id: string, patch: Pick<Category, 'name' | 'color'>) {
  const name = patch.name.trim()
  if (!name) throw new Error('กรุณากรอกชื่อประเภท')
  one(await supabase.from('categories').update({ ...patch, name }).eq('id', id).select('id'), 'ไม่พบประเภท')
}

export async function deleteCategory(id: string) {
  ok(await supabase.rpc('delete_category', { p_id: id }))
}

// Users (owner): the manage-users Edge Function holds the service role.
async function manageUsers<T>(body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-users', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new Error(payload?.error ?? 'เกิดข้อผิดพลาด ลองอีกครั้ง')
    }
    throw new Error('เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง')
  }
  return data as T
}

export async function listUsers(): Promise<Profile[]> {
  return ok(await supabase.from('profiles').select('*').order('created_at')) as Profile[]
}

export async function createCreator(display_name: string, email: string) {
  if (!display_name.trim()) throw new Error('กรุณากรอกชื่อ')
  return manageUsers<{ user: Profile; tempPassword: string }>({ action: 'create', display_name, email })
}

export async function resetPassword(id: string): Promise<string> {
  return (await manageUsers<{ tempPassword: string }>({ action: 'reset_password', id })).tempPassword
}

export async function deleteUser(id: string) {
  await manageUsers({ action: 'delete', id })
}
