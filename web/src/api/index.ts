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
  const rows = ok(r)
  if (!rows?.length) throw new Error(missing)
  return rows[0]
}

const stamp = () => new Date().toISOString()
const checkDate = (d: string) => {
  if (!isIsoDate(d)) throw new Error('วันที่ไม่ถูกต้อง')
}

// The generated DB types make status, kind, purpose and role plain strings (SQL check constraints).
// These narrow just those fields; the rest of each row is checked by tsc against the select string.
const narrowClip = <T extends { status: string }>(r: T) => ({ ...r, status: r.status as ClipStatus })
const narrowMedia = <T extends { kind: string; purpose: string; status: string }>(r: T) => ({
  ...r, kind: r.kind as ClipMedia['kind'], purpose: r.purpose as ClipMedia['purpose'], status: r.status as ClipMedia['status'],
})
const narrowProfile = <T extends { role: string }>(r: T) => ({ ...r, role: r.role as Role })

// Clips
// Each list selects only the columns it shows; the typed client checks each select string against the
// generated DB types. Cards show the reference image count, counted in the same request.
// Cards read the generated script_preview and has_note instead of the full script and note.
const CARD = 'id, date, position, category_id, status, title, script_preview, has_note, images:clip_media(count)'
const ATTENTION = 'id, date, position, category_id, status, title, script_preview, has_note, round, revision_note, images:clip_media(count)'
// Generated columns come back typed as nullable; they never are null (script and note are not null).
type CardDb = Omit<ClipCardRow, 'imageCount' | 'script_preview' | 'has_note'> & {
  script_preview: string | null
  has_note: boolean | null
  images: { count: number }[]
}
const withCount = ({ images, script_preview, has_note, ...c }: CardDb): ClipCardRow => ({
  ...c, script_preview: script_preview ?? '', has_note: has_note ?? false, imageCount: images[0]?.count ?? 0,
})

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
  return rows.map((r) => withCount(narrowClip(r)))
}

// Month view: clips per day and category, grouped in the database (one row per day and category,
// so 50-70 clips a day do not hit PostgREST's 1000-row cap).
export async function listDayCounts(from: string, to: string): Promise<ClipDayCount[]> {
  return ok(await supabase.rpc('clip_day_counts', { p_from: from, p_to: to }))
}

// brief_updated_at moves only when the brief itself changes, not on review or reorder.
export async function listRecent(limit: number): Promise<ClipRecent[]> {
  return ok(
    await supabase.from('clips').select('id, title, category_id, brief_updated_at').is('deleted_at', null).order('brief_updated_at', { ascending: false }).limit(limit),
  )
}

// Owner: work waiting for review. Creator: changes requested, or todo past its date.
const RANK: Record<Attention, number> = { revision: 0, review: 1, overdue: 2 }
export type AttentionRow = ClipCardRow & Pick<Clip, 'round' | 'revision_note'> & { attention: Attention }
export async function listAttention(role: Role): Promise<AttentionRow[]> {
  const today = todayIso()
  let q = supabase.from('clips').select(ATTENTION).is('deleted_at', null).eq('images.purpose', 'reference').eq('images.kind', 'image')
  q = role === 'owner' ? q.eq('status', 'submitted') : q.or(`status.eq.revision,and(status.eq.todo,date.lt.${today})`)
  const rows = ok(await q).flatMap((r) => {
    const c = narrowClip(r)
    const attention = attentionOf(c, role, today)
    if (!attention) return []
    return [{ ...withCount(c), round: c.round, revision_note: c.revision_note, attention }]
  })
  return rows.sort((a, b) => RANK[a.attention] - RANK[b.attention] || a.date.localeCompare(b.date) || a.position - b.position)
}

export async function getClip(id: string): Promise<Clip | null> {
  const row = ok(await supabase.from('clips').select('*').eq('id', id).is('deleted_at', null).maybeSingle())
  return row && narrowClip(row)
}

export async function createClip(input: ClipInput): Promise<Clip> {
  checkDate(input.date)
  const row = narrowClip(ok(await supabase.from('clips').insert(input).select('*').single()))
  return row
}

// Only brief fields are editable here; status changes go through reviewClip.
const EDITABLE = ['date', 'category_id', 'title', 'script', 'note'] as const
export async function updateClip(id: string, patch: Partial<ClipInput>): Promise<Clip> {
  if (patch.date !== undefined) checkDate(patch.date)
  const changes: Partial<ClipInput> = Object.fromEntries(EDITABLE.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]]))
  const row = narrowClip(one(await supabase.from('clips').update(changes).eq('id', id).select('*')))
  return row
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
  return narrowClip(ok(await supabase.rpc('copy_clip', { p_id: id, p_date: date })))
}

export async function reviewClip(id: string, status: 'approved' | 'revision', note = ''): Promise<Clip> {
  if (status === 'revision' && !note.trim()) throw new Error('กรุณาระบุเหตุผลที่ขอแก้ไข')
  const revision_note = status === 'revision' ? note.trim() : ''
  const row = narrowClip(one(await supabase.from('clips').update({ status, revision_note }).eq('id', id).select('*')))
  return row
}

// Undo of a review: put back the earlier status and note (owner, plain update; the round
// trigger keeps rounds right).
export async function restoreReview(id: string, status: ClipStatus, note: string) {
  one(await supabase.from('clips').update({ status, revision_note: note }).eq('id', id).select('id'))
}

// One page of search results, newest day first, with the total number of matches.
export const SEARCH_PAGE = 50
export async function search(q: string, offset = 0): Promise<{ rows: ClipSearchRow[]; total: number }> {
  if (!q.trim()) return { rows: [], total: 0 }
  const r = await supabase
    .rpc('search_clips', { p_q: q }, { count: 'exact' })
    .select('id, date, category_id, title, script, note')
    .range(offset, offset + SEARCH_PAGE - 1)
  return { rows: ok(r), total: r.count ?? 0 }
}

// Media
export async function listMedia(clipId: string): Promise<ClipMedia[]> {
  return ok(await supabase.from('clip_media').select('*').eq('clip_id', clipId).order('created_at')).map(narrowMedia)
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
  )
  return rows.map((m) => ({ id: m.id, file_name: m.file_name, clip_id: m.clip.id, clip_title: m.clip.title, days: daysLeft(m.expires_at) }))
}

export async function storageUsedBytes(): Promise<number> {
  const row = ok(await supabase.from('storage_usage').select('total_bytes').single())
  return row.total_bytes ?? 0
}

// Categories
export async function listCategories(): Promise<Category[]> {
  return ok(await supabase.from('categories').select('*').order('position'))
}

// Live clips per category, grouped in the database.
export async function categoryCounts(): Promise<Record<string, number>> {
  const rows = ok(await supabase.rpc('category_counts'))
  return Object.fromEntries(rows.map((r) => [r.category_id, r.n]))
}

export async function createCategory(name: string, color: string): Promise<Category> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('กรุณากรอกชื่อประเภท')
  const last = ok(await supabase.from('categories').select('position').order('position', { ascending: false }).limit(1))
  const position = (last[0]?.position ?? -1) + 1
  return ok(await supabase.from('categories').insert({ name: trimmed, color, position }).select().single())
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
  return ok(await supabase.from('profiles').select('*').order('created_at')).map(narrowProfile)
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
