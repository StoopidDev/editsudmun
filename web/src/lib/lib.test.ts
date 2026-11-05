import { describe, expect, it } from 'vitest'
import { dayLabel, isIsoDate, monthGrid, rangeLabel, weekDays } from './dates'
import { canWithdraw, daysLeft, formatSize, isPlayable, withdrawMinutesLeft, withRounds } from './media'
import { searchClips, snippet } from './search'
import { contrast, nextColor, readableOn } from './color'
import type { Clip, ClipMedia } from './types'

const media = (over: Partial<ClipMedia>): ClipMedia => ({
  id: 'm', clip_id: 'c', kind: 'video', purpose: 'submission', r2_key: 'k', file_name: 'f.mp4',
  mime: 'video/mp4', size_bytes: 1, status: 'ready', uploaded_by: 'u1',
  created_at: '2026-10-29T10:00:00.000Z', expires_at: '2026-11-28T10:00:00.000Z', ...over,
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
  })
  it('numbers rounds oldest first and lists newest first', () => {
    const list = withRounds([
      media({ id: 'a', created_at: '2026-10-28T00:00:00.000Z' }),
      media({ id: 'b', created_at: '2026-10-29T00:00:00.000Z' }),
    ])
    expect(list.map((m) => [m.id, m.round])).toEqual([['b', 2], ['a', 1]])
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
