/// <reference types="node" />
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { dayLabel, isIsoDate, monthGrid, rangeLabel, weekDays } from './dates'
import { canWithdraw, daysLeft, expiresBeforeClip, formatSize, isPlayable, MULTIPART_AT, PART_BYTES, partNumbers, progressLabel, roundCount, uploadProblem, uploadStatus, withdrawMinutesLeft, withRounds } from './media'
import { searchClips, snippet } from './search'
import { attentionOf } from './attention'
import { contrast, nextColor, readableOn } from './color'
import { clearDraft, isBlank, readDraft, sameBrief, writeDraft } from './draft'
import type { Clip, ClipMedia } from './types'

const media = (over: Partial<ClipMedia>): ClipMedia => ({
  id: 'm', clip_id: 'c', kind: 'video', purpose: 'submission', r2_key: 'k', file_name: 'f.mp4',
  mime: 'video/mp4', size_bytes: 1, status: 'ready', round: 1, uploaded_by: 'u1', uploader_name: 'ครีเอเตอร์',
  created_at: '2026-10-29T09:30:00.000Z', ready_at: '2026-10-29T10:00:00.000Z', expires_at: '2026-11-28T10:00:00.000Z', ...over,
})

describe('dates', () => {
  it('starts weeks on Monday, even from a Sunday', () => {
    const days = weekDays(new Date(2026, 10, 1))
    expect(days[0].getDate()).toBe(26)
    expect(days).toHaveLength(7)
  })
  it('accepts only real yyyy-MM-dd dates', () => {
    expect(isIsoDate('2026-10-29')).toBe(true)
    expect(isIsoDate('2026-13-40')).toBe(false)
    expect(isIsoDate('abc')).toBe(false)
    expect(isIsoDate('12345-01-01')).toBe(false)
  })
  it('labels days and ranges in Thai', () => {
    expect(dayLabel(new Date(2026, 9, 29))).toBe('พฤหัส')
    expect(rangeLabel(new Date(2026, 9, 29))).toBe('26 ต.ค. – 1 พ.ย. 2026')
  })
  it('builds a month grid of whole weeks', () => {
    const grid = monthGrid(new Date(2026, 9, 15))
    expect(grid.length % 7).toBe(0)
    expect(grid[0].getDate()).toBe(28)
  })
})

describe('media', () => {
  const now = new Date('2026-10-29T10:03:00.000Z')
  it('counts days left and never goes negative', () => {
    expect(daysLeft('2026-11-03T10:00:00.000Z', now)).toBe(5)
    expect(daysLeft('2026-01-01T10:00:00.000Z', now)).toBe(0)
  })
  it('allows withdraw only for the uploader inside 10 minutes', () => {
    expect(withdrawMinutesLeft(media({}), now)).toBe(7)
    expect(canWithdraw(media({}), 'u1', now)).toBe(true)
    expect(canWithdraw(media({}), 'u2', now)).toBe(false)
    expect(canWithdraw(media({}), 'u1', new Date('2026-10-29T10:10:00.000Z'))).toBe(false)
    expect(canWithdraw(media({ purpose: 'reference' }), 'u1', now)).toBe(false)
    expect(canWithdraw(media({ uploaded_by: null }), 'u1', now)).toBe(false)
  })
  it('lets the uploader cancel a pending upload however long it took', () => {
    const pending = media({ status: 'pending', ready_at: null, created_at: '2026-10-29T08:00:00.000Z' })
    expect(canWithdraw(pending, 'u1', now)).toBe(true)
    expect(withdrawMinutesLeft(pending, now)).toBe(10)
  })
  it('lists newest first and counts rounds from the server, not files', () => {
    const list = withRounds([
      media({ id: 'a', round: 1, created_at: '2026-10-28T00:00:00.000Z' }),
      media({ id: 'b', round: 1, created_at: '2026-10-28T01:00:00.000Z' }),
      media({ id: 'c', round: 2, created_at: '2026-10-29T00:00:00.000Z' }),
    ])
    expect(list.map((m) => [m.id, m.round])).toEqual([['c', 2], ['b', 1], ['a', 1]])
    expect(roundCount(list)).toBe(2)
  })
  it('refuses unsupported or oversized files before upload', () => {
    expect(uploadProblem({ type: 'video/mp4', size: 1 })).toBeNull()
    expect(uploadProblem({ type: 'IMAGE/JPEG', size: 1 })).toBeNull()
    expect(uploadProblem({ type: 'application/pdf', size: 1 })).toBe('ไม่รองรับไฟล์ชนิดนี้')
    expect(uploadProblem({ type: 'video/mp4', size: 0 })).toBe('ไฟล์ว่างเปล่า')
    expect(uploadProblem({ type: 'video/mp4', size: 2 * 1024 ** 3 + 1 })).toBe('วิดีโอใหญ่เกิน 2 GB')
    expect(uploadProblem({ type: 'image/png', size: 51 * 1024 ** 2 })).toBe('รูปใหญ่เกิน 50 MB')
  })
  it('detects browser-playable video', () => {
    expect(isPlayable('video/mp4')).toBe(true)
    expect(isPlayable('video/quicktime')).toBe(false)
  })
  it('formats sizes', () => {
    expect(formatSize(820 * 1024 ** 2)).toBe('820 MB')
    expect(formatSize(1.8 * 1024 ** 3)).toBe('1.8 GB')
    expect(formatSize(500 * 1024)).toBe('500 KB')
    expect(formatSize(1024 ** 3 - 1)).toBe('1 GB')
  })
})

describe('search', () => {
  const clip = { title: 'รีวิว Tissot', script: 'x'.repeat(100) + ' Seiko ' + 'y'.repeat(100), note: 'ห้ามใช้เพลง' } as Clip
  it('matches title, script and note, ignoring case', () => {
    expect(searchClips([clip], 'tissot')).toHaveLength(1)
    expect(searchClips([clip], 'seiko')).toHaveLength(1)
    expect(searchClips([clip], 'เพลง')).toHaveLength(1)
    expect(searchClips([clip], 'casio')).toHaveLength(0)
    expect(searchClips([clip], '  ')).toHaveLength(0)
  })
  it('cuts a snippet around the match, keeping original case', () => {
    const s = snippet(clip.script, 'seiko', 10)
    expect(s.match).toBe('Seiko')
    expect(s.before.startsWith('…')).toBe(true)
    expect(s.after.endsWith('…')).toBe(true)
  })
  it('falls back to the text start when nothing matches', () => {
    const s = snippet('abc', 'zzz', 10)
    expect(s).toEqual({ before: 'abc', match: '', after: '' })
  })
})

describe('color', () => {
  it('measures contrast', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0)
  })
  it('picks the readable text colour', () => {
    expect(readableOn('#34c759')).toBe('#1e1e1e')
    expect(readableOn('#6155f5')).toBe('#ffffff')
  })
  it('offers the first unused colour', () => {
    expect(nextColor(['#6155f5', '#34c759'])).toBe('#ff9500')
    expect(nextColor(['#6155F5'])).toBe('#34c759')
  })
})

describe('theme tokens', () => {
  it('dark and light text tokens meet 4.5:1 on their backgrounds', () => {
    const pairs = [
      ['#1e1e1e', '#ffffff'], ['#5f5f5f', '#ffffff'], ['#5f5f5f', '#f5f5f5'], ['#f2f2f2', '#1b1b1d'],
      ['#a0a0a5', '#1b1b1d'], ['#a0a0a5', '#262628'], ['#4da3ff', '#1b1b1d'], ['#ffb04d', '#3a2810'],
      ['#9a4f00', '#fff0e0'], ['#34c759', '#12301c'],
    ]
    for (const [fg, bg] of pairs) expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
  })
})

describe('attentionOf', () => {
  const today = '2026-10-29'
  it('sends submitted work to the owner', () => {
    expect(attentionOf({ status: 'submitted', date: today }, 'owner', today)).toBe('review')
    expect(attentionOf({ status: 'todo', date: '2026-10-01' }, 'owner', today)).toBeNull()
  })
  it('sends revisions and overdue work to the creator', () => {
    expect(attentionOf({ status: 'revision', date: '2026-11-20' }, 'creator', today)).toBe('revision')
    expect(attentionOf({ status: 'todo', date: '2026-10-28' }, 'creator', today)).toBe('overdue')
    expect(attentionOf({ status: 'todo', date: today }, 'creator', today)).toBeNull()
    expect(attentionOf({ status: 'approved', date: '2026-10-01' }, 'creator', today)).toBeNull()
  })
})

describe('expiresBeforeClip', () => {
  it('compares the expiry day with the clip day', () => {
    expect(expiresBeforeClip('2026-11-01T10:00:00.000Z', '2026-11-05')).toBe(true)
    expect(expiresBeforeClip('2026-11-05T10:00:00.000Z', '2026-11-05')).toBe(false)
  })
})

describe('draft', () => {
  const form = { date: '2026-11-05', category_id: 'a', title: 'x', script: '', note: '' }
  beforeEach(() => localStorage.clear())

  it('keeps new-clip and per-clip drafts apart', () => {
    writeDraft({ ...form, title: 'new' })
    writeDraft({ ...form, title: 'one' }, 'c1')
    expect(readDraft()?.title).toBe('new')
    expect(readDraft('c1')?.title).toBe('one')
    clearDraft('c1')
    expect(readDraft('c1')).toBeNull()
    expect(readDraft()?.title).toBe('new')
  })
  it('survives corrupt storage', () => {
    localStorage.setItem('clip-draft', '{')
    expect(readDraft()).toBeNull()
  })
  it('ignores surrounding spaces in the title', () => {
    expect(sameBrief(form, { ...form, title: ' x ' })).toBe(true)
    expect(sameBrief(form, { ...form, script: 'y' })).toBe(false)
  })
  it('treats a form with only a date as blank', () => {
    expect(isBlank({ ...form, title: '' })).toBe(true)
    expect(isBlank(form)).toBe(false)
  })
})

describe('upload helpers', () => {
  it('labels upload progress', () => {
    expect(progressLabel(1.2 * 1024 ** 3, 1.8 * 1024 ** 3)).toBe('1.2 GB / 1.8 GB · 66%')
  })
  it('lists part numbers for a file size', () => {
    expect(partNumbers(0)).toEqual([1])
    expect(partNumbers(PART_BYTES)).toEqual([1])
    expect(partNumbers(PART_BYTES + 1)).toEqual([1, 2])
    expect(partNumbers(3 * PART_BYTES)).toEqual([1, 2, 3])
  })
  it('picks the row state: failed beats paused beats retrying', () => {
    const base = { error: null, paused: false, retries: 0, offline: false }
    expect(uploadStatus(base)).toBe('uploading')
    expect(uploadStatus({ ...base, offline: true })).toBe('retrying')
    expect(uploadStatus({ ...base, retries: 2 })).toBe('retrying')
    expect(uploadStatus({ ...base, paused: true, retries: 2 })).toBe('paused')
    expect(uploadStatus({ ...base, error: 'x', retries: 2 })).toBe('failed')
  })
  it('uses the same multipart threshold and part size as the server', () => {
    // npm test runs in web/, so the server file is one level up (read as text: it imports Deno).
    const src = readFileSync(resolve(process.cwd(), '../supabase/functions/_shared/media.ts'), 'utf8')
    const mb = (name: string) => Number(src.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\d+)\\s*\\*\\s*1024\\s*\\*\\*\\s*2`))?.[1])
    expect(mb('MULTIPART_THRESHOLD') * 1024 ** 2).toBe(MULTIPART_AT)
    expect(mb('PART_BYTES') * 1024 ** 2).toBe(PART_BYTES)
  })
})
