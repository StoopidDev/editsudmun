import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ClipMedia } from './types'

export const WITHDRAW_MS = 10 * 60 * 1000
export const WARN_DAYS = 7

// Mirrors supabase/functions/_shared/media.ts so the UI can refuse a file before uploading;
// the server checks again and is the one that decides.
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/x-m4v']
export const MAX_IMAGE_BYTES = 50 * 1024 ** 2
export const MAX_VIDEO_BYTES = 2 * 1024 ** 3
export const ACCEPT = [...IMAGE_TYPES, ...VIDEO_TYPES].join(',')

// Thai reason the file cannot be uploaded, or null.
export function uploadProblem(file: { type: string; size: number }) {
  const type = file.type.toLowerCase()
  const image = IMAGE_TYPES.includes(type)
  if (!image && !VIDEO_TYPES.includes(type)) return 'ไม่รองรับไฟล์ชนิดนี้'
  if (file.size <= 0) return 'ไฟล์ว่างเปล่า'
  if (file.size > (image ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) return image ? 'รูปใหญ่เกิน 50 MB' : 'วิดีโอใหญ่เกิน 2 GB'
  return null
}

export const daysLeft = (expires_at: string, now = new Date()) =>
  Math.max(0, differenceInCalendarDays(parseISO(expires_at), now))

// The window starts when the upload finished (ready_at); a pending upload can always be cancelled.
// Mirrors the clip_media delete policy in supabase/migrations.
export const withdrawMinutesLeft = (m: ClipMedia, now = new Date()) =>
  m.ready_at
    ? Math.min(WITHDRAW_MS / 60000, Math.max(0, Math.ceil((parseISO(m.ready_at).getTime() + WITHDRAW_MS - now.getTime()) / 60000)))
    : WITHDRAW_MS / 60000

export const canWithdraw = (m: ClipMedia, userId: string, now = new Date()) =>
  m.purpose === 'submission' && m.uploaded_by === userId && (m.status === 'pending' || withdrawMinutesLeft(m, now) > 0)

export const isPlayable = (mime: string) => mime === 'video/mp4' || mime === 'video/webm'

// Submissions newest first. round comes from the server: files sent before a revision request
// share a round (frame 103:2528 shows two files in round 1).
export const withRounds = (subs: ClipMedia[]) =>
  [...subs].sort((a, b) => b.created_at.localeCompare(a.created_at))

export const roundCount = (subs: ClipMedia[]) => new Set(subs.map((m) => m.round)).size

export const formatSize = (bytes: number) => {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes >= 1024 ** 3) return `${+(bytes / 1024 ** 3).toFixed(1)} GB`
  const mb = Math.round(bytes / 1024 ** 2)
  return mb >= 1024 ? '1 GB' : `${mb} MB` // rounding up to 1024 MB reads better as 1 GB
}

// R2 lifecycle counts from upload, so a brief planned far ahead can lose its files first.
export const expiresBeforeClip = (expires_at: string, clipDate: string) => expires_at.slice(0, 10) < clipDate

export const progressLabel = (sent: number, size: number) =>
  `${formatSize(sent)} / ${formatSize(size)} · ${size ? Math.floor((sent / size) * 100) : 0}%`

// Which row style an in-flight upload gets. Offline or any automatic retry reads as retrying (orange).
export const uploadStatus = (r: { error: string | null; paused: boolean; retries: number; offline: boolean }) =>
  r.error ? 'failed' : r.paused ? 'paused' : r.offline || r.retries > 0 ? 'retrying' : 'uploading'

// Uploader part rules. Must equal MULTIPART_THRESHOLD and PART_BYTES in supabase/functions/_shared/media.ts,
// or the server's part_count will not match the parts Uppy sends (lib.test.ts checks this).
export const MULTIPART_AT = 100 * 1024 ** 2
export const PART_BYTES = 50 * 1024 ** 2
// Part numbers 1..n for a file of `size` bytes, as Uppy cuts it into PART_BYTES chunks.
export const partNumbers = (size: number) => Array.from({ length: Math.max(1, Math.ceil(size / PART_BYTES)) }, (_, i) => i + 1)

// Ready files only: the server marks a row ready after it checked the object, and only those have a playable URL.
export const readyIds = (files: ClipMedia[]) => files.filter((f) => f.status === 'ready').map((f) => f.id)

// Splits a list into runs of `size` (the API takes at most 100 ids per call).
export const chunk = <T,>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size))

// m:ss, or h:mm:ss from an hour up. Empty when the duration is unknown.
export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
