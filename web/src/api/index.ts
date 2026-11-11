// Everything the UI may do to data, on Supabase. Permissions are enforced by RLS, triggers and
// RPCs in supabase/migrations; checks here only give friendlier Thai errors.
import { FunctionsHttpError, type PostgrestError } from '@supabase/supabase-js'
import { addDays } from 'date-fns'
import { attentionOf, type Attention } from '@/lib/attention'
import { isIsoDate, todayIso } from '@/lib/dates'
import { daysLeft, uploadProblem, WARN_DAYS } from '@/lib/media'
import type { Category, Clip, ClipCardRow, ClipDayCount, ClipInput, ClipMedia, ClipRecent, ClipSearchRow, ClipStatus, Profile, Role } from '@/lib/types'
import { ok } from './errors'
import { supabase } from './supabase'

export { changePassword, login, logout, me } from './auth'

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

// Clips
// Each list selects only the columns it shows (the typed client checks them against the row types in
// lib/types.ts). Cards show the number of reference images; counted in the same request.
const CARD = 'id, date, position, category_id, status, title, script, note, images:clip_media(count)'
const ATTENTION = 'id, date, position, category_id, status, title, script, note, round, revision_note, images:clip_media(count)'
type CardDb = Omit<ClipCardRow, 'imageCount'> & { images: { count: number }[] }
type AttentionDb = CardDb & Pick<Clip, 'round' | 'revision_note'>
const withCount = ({ images, ...c }: CardDb): ClipCardRow => ({ ...c, imageCount: images[0]?.count ?? 0 })

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
  return (rows as CardDb[]).map(withCount)
}

// Month view: only what a day count needs.
export async function listDayCounts(from: string, to: string): Promise<ClipDayCount[]> {
  const rows = ok(
    await supabase.from('clips').select('id, date, category_id, status').gte('date', from).lte('date', to).is('deleted_at', null),
  )
  return rows as ClipDayCount[]
}

// brief_updated_at moves only when the brief itself changes, not on review or reorder.
export async function listRecent(limit: number): Promise<ClipRecent[]> {
  return ok(
    await supabase.from('clips').select('id, title, category_id, brief_updated_at').is('deleted_at', null).order('brief_updated_at', { ascending: false }).limit(limit),
  ) as ClipRecent[]
}

// Owner: work waiting for review. Creator: changes requested, or todo past its date.
const RANK: Record<Attention, number> = { revision: 0, review: 1, overdue: 2 }
export type AttentionRow = ClipCardRow & Pick<Clip, 'round' | 'revision_note'> & { attention: Attention }
export async function listAttention(role: Role): Promise<AttentionRow[]> {
  const today = todayIso()
  let q = supabase.from('clips').select(ATTENTION).is('deleted_at', null).eq('images.purpose', 'reference').eq('images.kind', 'image')
  q = role === 'owner' ? q.eq('status', 'submitted') : q.or(`status.eq.revision,and(status.eq.todo,date.lt.${today})`)
  const rows = (ok(await q) as AttentionDb[]).flatMap((c) => {
    const attention = attentionOf(c, role, today)
    if (!attention) return []
    return [{ ...withCount(c), round: c.round, revision_note: c.revision_note, attention }]
  })
  return rows.sort((a, b) => RANK[a.attention] - RANK[b.attention] || a.date.localeCompare(b.date) || a.position - b.position)
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

// Undo of a review: put back the earlier status and note (owner, plain update; the round
// trigger keeps rounds right).
export async function restoreReview(id: string, status: ClipStatus, note: string) {
  one(await supabase.from('clips').update({ status, revision_note: note }).eq('id', id).select('id'))
}

// Pages of 50 at most: the caller asks for `limit` rows and shows "ดูเพิ่ม" for more.
export async function search(q: string, limit: number): Promise<ClipSearchRow[]> {
  if (!q.trim()) return []
  return ok(await supabase.rpc('search_clips', { p_q: q }).select('id, date, category_id, title, script, note').range(0, limit - 1)) as ClipSearchRow[]
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

// Owner: files R2 will delete within WARN_DAYS, on live clips, soonest first.
export async function listExpiring() {
  const until = addDays(new Date(), WARN_DAYS).toISOString()
  const rows = ok(
    await supabase
      .from('clip_media')
      .select('id, file_name, expires_at, clip:clips!inner(id, title, deleted_at)')
      .lte('expires_at', until)
      .eq('status', 'ready')
      .is('clip.deleted_at', null)
      .order('expires_at'),
  ) as { id: string; file_name: string; expires_at: string; clip: { id: string; title: string } }[]
  return rows.map((m) => ({ id: m.id, file_name: m.file_name, clip_id: m.clip.id, clip_title: m.clip.title, days: daysLeft(m.expires_at) }))
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

// Edge Functions answer errors as { error: '<Thai message>' } with an HTTP status.
async function callFunction<T>(name: string, body: object): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new Error(payload?.error ?? 'เกิดข้อผิดพลาด ลองอีกครั้ง')
    }
    throw new Error('เชื่อมต่อไม่สำเร็จ ลองอีกครั้ง')
  }
  return data as T
}

// Uploads (media-upload Edge Function). The browser sends the bytes straight to R2:
//   1. startUpload: the server checks type/size and permission, creates the pending row
//   2a. mode 'single': PUT the file to `url` with `headers` (Content-Type must match)
//   2b. mode 'multipart': split into part_size chunks, get URLs from signUploadParts (one call
//       for all parts), PUT each chunk and keep the ETag response header of each part
//   3. completeUpload: the server checks the file in R2 and marks it ready
// abortUpload cancels; listUploadParts returns the parts R2 already has, to resume.
// Fits Uppy's AwsS3 plugin: getUploadParameters / createMultipartUpload / signPart /
// listParts / completeMultipartUpload / abortMultipartUpload.
export type UploadStart =
  | { media: ClipMedia; mode: 'single'; url: string; headers: Record<string, string> }
  | { media: ClipMedia; mode: 'multipart'; upload_id: string; part_size: number; part_count: number }
export type UploadedPart = { part_number: number; etag: string }

export async function startUpload(
  clipId: string,
  purpose: ClipMedia['purpose'],
  file: { name: string; type: string; size: number },
  opts: { multipart?: boolean } = {},
): Promise<UploadStart> {
  const problem = uploadProblem(file)
  if (problem) throw new Error(problem)
  return callFunction('media-upload', {
    action: 'init', clip_id: clipId, purpose, file_name: file.name, mime: file.type, size: file.size, multipart: opts.multipart,
  })
}

export async function signUploadParts(mediaId: string, uploadId: string, partNumbers: number[]): Promise<Record<number, string>> {
  return (await callFunction<{ urls: Record<number, string> }>('media-upload', {
    action: 'sign-parts', media_id: mediaId, upload_id: uploadId, part_numbers: partNumbers,
  })).urls
}

export async function listUploadParts(mediaId: string, uploadId: string): Promise<(UploadedPart & { size: number })[]> {
  return (await callFunction<{ parts: (UploadedPart & { size: number })[] }>('media-upload', {
    action: 'list-parts', media_id: mediaId, upload_id: uploadId,
  })).parts
}

export async function completeUpload(mediaId: string, multipart?: { uploadId: string; parts: UploadedPart[] }): Promise<ClipMedia> {
  return (await callFunction<{ media: ClipMedia }>('media-upload', {
    action: 'complete', media_id: mediaId, upload_id: multipart?.uploadId, parts: multipart?.parts,
  })).media
}

export async function abortUpload(mediaId: string, uploadId?: string) {
  await callFunction('media-upload', { action: 'abort', media_id: mediaId, upload_id: uploadId })
}

// Presigned GET URLs, valid 1 hour, for files the caller may see (others are left out).
// Call when a clip is opened or a video is played, not for every card on the week page.
// download: true makes the browser save the file under its original name.
export async function viewUrls(mediaIds: string[], opts: { download?: boolean } = {}): Promise<Record<string, string>> {
  if (!mediaIds.length) return {}
  return (await callFunction<{ urls: Record<string, string> }>('media-view', { media_ids: mediaIds, download: opts.download })).urls
}

// Users (owner): the manage-users Edge Function holds the service role.
const manageUsers = <T>(body: object) => callFunction<T>('manage-users', body)

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
