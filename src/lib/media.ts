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
  const gb = bytes / 1024 ** 3
  return gb >= 1 ? `${+gb.toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`
}
