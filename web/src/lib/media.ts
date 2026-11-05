import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ClipMedia } from './types'

const WITHDRAW_MS = 10 * 60 * 1000
export const WARN_DAYS = 7

export const daysLeft = (expires_at: string, now = new Date()) =>
  Math.max(0, differenceInCalendarDays(parseISO(expires_at), now))

export const withdrawMinutesLeft = (m: ClipMedia, now = new Date()) =>
  Math.max(0, Math.ceil((parseISO(m.created_at).getTime() + WITHDRAW_MS - now.getTime()) / 60000))

export const canWithdraw = (m: ClipMedia, userId: string, now = new Date()) =>
  m.purpose === 'submission' && m.uploaded_by === userId && withdrawMinutesLeft(m, now) > 0

export const isPlayable = (mime: string) => mime === 'video/mp4' || mime === 'video/webm'

// shortcut: one file = one round, because the spec has no round column. Frame 103:2528 shows two
// files in round 1; ask Buddy for a round column if that grouping is wanted.
export const withRounds = (subs: ClipMedia[]) =>
  [...subs]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m, i) => ({ ...m, round: i + 1 }))
    .reverse()

export const formatSize = (bytes: number) => {
  if (bytes < 1024 ** 2) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes >= 1024 ** 3) return `${+(bytes / 1024 ** 3).toFixed(1)} GB`
  const mb = Math.round(bytes / 1024 ** 2)
  return mb >= 1024 ? '1 GB' : `${mb} MB` // rounding up to 1024 MB reads better as 1 GB
}

// R2 lifecycle counts from upload, so a brief planned far ahead can lose its files first.
export const expiresBeforeClip = (expires_at: string, clipDate: string) => expires_at.slice(0, 10) < clipDate
