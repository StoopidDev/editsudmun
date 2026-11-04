import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './index'
import { resetDb } from './fake/db'
import { todayIso } from '@/lib/dates'

const asOwner = () => api.login('owner@example.com', 'owner1234')
const asCreator = () => api.login('creator@example.com', 'creator1234')

beforeEach(() => {
  // Seed dates are relative to today, so pin a Thursday: the other seeded days never collide with it.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 29, 10))
  localStorage.clear()
  resetDb()
})

afterEach(() => vi.useRealTimers())

describe('auth', () => {
  it('rejects a wrong password', async () => {
    await expect(api.login('owner@example.com', 'nope')).rejects.toThrow('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  })
  it('returns the signed-in profile, and null after logout', async () => {
    await asOwner()
    expect(api.me()?.role).toBe('owner')
    api.logout()
    expect(api.me()).toBeNull()
  })
})

describe('permissions', () => {
  it('blocks creators from changing briefs', async () => {
    await asCreator()
    await expect(api.updateClip('c1', { title: 'x' })).rejects.toThrow('ไม่มีสิทธิ์')
    await expect(api.softDeleteClip('c1')).rejects.toThrow('ไม่มีสิทธิ์')
    await expect(api.createCategory('x', '#000000')).rejects.toThrow('ไม่มีสิทธิ์')
  })
  it('requires a session for reads', async () => {
    await expect(api.listCategories()).rejects.toThrow('กรุณาเข้าสู่ระบบ')
  })
})

describe('clips', () => {
  it('lists a day in position order with image counts', async () => {
    await asOwner()
    const rows = await api.listClips(todayIso(), todayIso())
    expect(rows.map((c) => c.id)).toEqual(['c1', 'c2'])
    expect(rows[0].imageCount).toBe(2)
  })
  it('hides a soft-deleted clip and restores it', async () => {
    await asOwner()
    await api.softDeleteClip('c1')
    expect((await api.listClips(todayIso(), todayIso())).map((c) => c.id)).toEqual(['c2'])
    await api.restoreClip('c1')
    expect((await api.listClips(todayIso(), todayIso()))).toHaveLength(2)
  })
  it('moves a clip within its day and stops at the edges', async () => {
    await asOwner()
    await api.moveClip('c2', -1)
    expect((await api.listClips(todayIso(), todayIso())).map((c) => c.id)).toEqual(['c2', 'c1'])
    await api.moveClip('c2', -1)
    expect((await api.listClips(todayIso(), todayIso())).map((c) => c.id)).toEqual(['c2', 'c1'])
  })
  it('appends to the end of the day on create and on date change', async () => {
    await asOwner()
    const made = await api.createClip({ date: todayIso(), category_id: 'cat-review', title: 'ใหม่', script: '', note: '' })
    expect(made.position).toBe(2)
    const moved = await api.updateClip('c5', { date: todayIso() })
    expect(moved.position).toBe(3)
  })
  it('copies text and references, not submissions, and resets status', async () => {
    await asOwner()
    const copy = await api.copyClip('c1', '2030-01-01')
    expect(copy.status).toBe('todo')
    const media = await api.listMedia(copy.id)
    expect(media.every((m) => m.purpose === 'reference')).toBe(true)
    expect(media).toHaveLength(3)
  })
  it('searches clips and skips deleted ones', async () => {
    await asOwner()
    expect((await api.search('Casio')).map((c) => c.id)).toEqual(['c5'])
    await api.softDeleteClip('c5')
    expect(await api.search('Casio')).toEqual([])
  })
})

describe('status', () => {
  it('needs a reason for a change request and clears it on approve', async () => {
    await asOwner()
    await expect(api.reviewClip('c1', 'revision', '  ')).rejects.toThrow('กรุณาระบุเหตุผล')
    expect((await api.reviewClip('c1', 'revision', 'แก้เสียง')).revision_note).toBe('แก้เสียง')
    expect((await api.reviewClip('c1', 'approved')).revision_note).toBe('')
  })
  it('is owner-only', async () => {
    await asCreator()
    await expect(api.reviewClip('c1', 'approved')).rejects.toThrow('ไม่มีสิทธิ์')
  })
})

describe('media', () => {
  it('lets the creator withdraw a fresh submission but not an old one', async () => {
    await asCreator()
    await api.withdrawMedia('m6')
    expect((await api.listMedia('c1')).some((m) => m.id === 'm6')).toBe(false)
    await expect(api.withdrawMedia('m4')).rejects.toThrow('หมดเวลาถอนไฟล์')
  })
  it('resets status to todo when the last submission is withdrawn', async () => {
    await asOwner()
    await api.deleteMedia('m4')
    await api.deleteMedia('m5')
    await asCreator()
    await api.withdrawMedia('m6')
    expect((await api.getClip('c1'))?.status).toBe('todo')
  })
  it('blocks creators from the owner delete', async () => {
    await asCreator()
    await expect(api.deleteMedia('m6')).rejects.toThrow('ไม่มีสิทธิ์')
  })
})

describe('categories and users', () => {
  it('refuses to delete a category in use, allows an unused one', async () => {
    await asOwner()
    await expect(api.deleteCategory('cat-review')).rejects.toThrow('ยังมีคลิป')
    const c = await api.createCategory('ไลฟ์', '#ff9500')
    await api.deleteCategory(c.id)
    expect((await api.listCategories()).map((x) => x.id)).not.toContain(c.id)
  })
  it('creates a creator who can log in with the temporary password', async () => {
    await asOwner()
    const { tempPassword } = await api.createCreator('New', 'new@example.com')
    await api.login('new@example.com', tempPassword)
    expect(api.me()?.role).toBe('creator')
  })
  it('rejects a duplicate email and refuses to delete the owner', async () => {
    await asOwner()
    await expect(api.createCreator('X', 'creator@example.com')).rejects.toThrow('อีเมลนี้')
    await expect(api.deleteUser('u-owner')).rejects.toThrow('ลบบัญชีเจ้าของไม่ได้')
  })
})
