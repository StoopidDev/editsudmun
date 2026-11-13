// RLS, trigger and RPC checks against the dev project (spec §11 and the backend plan).
// Creates its own owner and creator with random emails and removes everything afterwards.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const url = process.env.SUPABASE_URL!
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!
const secret = process.env.SUPABASE_SECRET_KEY!
const opts = { auth: { persistSession: false, autoRefreshToken: false } }

const admin = createClient(url, secret, opts)
const tag = Math.random().toString(36).slice(2, 8)
const users: string[] = []
const clips: string[] = []
let owner: SupabaseClient
let creator: SupabaseClient
let ownerId: string
let creatorId: string
let categoryId: string

async function makeUser(role: 'owner' | 'creator') {
  const email = `test-${role}-${tag}@example.com`
  const password = `Pw-${tag}-${role}-1234`
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { role }, user_metadata: { display_name: `ทดสอบ ${role}` },
  })
  if (error) throw error
  users.push(data.user.id)
  const client = createClient(url, publishable, opts)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { client, id: data.user.id, email }
}

async function newClip(title = `คลิปทดสอบ ${tag}`, date = '2030-01-07', extra: Record<string, string> = {}) {
  const { data, error } = await owner
    .from('clips')
    .insert({ date, category_id: categoryId, title, script: '', note: '', ...extra })
    .select()
    .single()
  if (error) throw error
  clips.push(data.id)
  return data
}

// Inserts the way media-upload will (as the caller), then marks it ready the way `complete` will.
async function addMedia(client: SupabaseClient, clipId: string, purpose: 'reference' | 'submission', ready = true) {
  const { data, error } = await client
    .from('clip_media')
    .insert({ clip_id: clipId, kind: 'video', purpose, file_name: 'งานตัดต่อ final.mp4', mime: 'video/mp4', size_bytes: 1000, r2_key: 'x', expires_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  if (!ready) return data
  const { data: done, error: readyError } = await admin
    .from('clip_media').update({ status: 'ready', ready_at: new Date().toISOString() }).eq('id', data.id).select().single()
  if (readyError) throw readyError
  return done
}

const clipStatus = async (id: string) =>
  (await admin.from('clips').select('status, round, revision_note').eq('id', id).single()).data!

beforeAll(async () => {
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY']) {
    if (!process.env[name]) throw new Error(`${name} missing in supabase/.env`)
  }
  ;({ client: owner, id: ownerId } = await makeUser('owner'))
  ;({ client: creator, id: creatorId } = await makeUser('creator'))
  const { data, error } = await owner.from('categories').insert({ name: `ทดสอบ ${tag}`, color: '#123456', position: 99 }).select().single()
  if (error) throw error
  categoryId = data.id
})

afterAll(async () => {
  if (clips.length) await admin.from('clips').delete().in('id', clips)
  await admin.from('clips').delete().eq('category_id', categoryId)
  await admin.from('categories').delete().eq('id', categoryId)
  for (const id of users) await admin.auth.admin.deleteUser(id)
})

describe('profiles', () => {
  it('are created from app_metadata with the right role', async () => {
    const { data } = await owner.from('profiles').select('role, email').eq('id', creatorId).single()
    expect(data).toMatchObject({ role: 'creator', email: `test-creator-${tag}@example.com` })
  })
  it('cannot be changed by the creator (no role escalation)', async () => {
    const { error } = await creator.from('profiles').update({ role: 'owner' }).eq('id', creatorId)
    expect(error).not.toBeNull()
    const { data } = await admin.from('profiles').select('role').eq('id', creatorId).single()
    expect(data!.role).toBe('creator')
  })
  it('are not readable signed out', async () => {
    const anon = createClient(url, publishable, opts)
    const { data } = await anon.from('profiles').select('id')
    expect(data ?? []).toHaveLength(0)
  })
})

describe('categories and clips are read-only for the creator', () => {
  it('creator cannot insert, update or delete categories', async () => {
    expect((await creator.from('categories').insert({ name: 'x', color: '#000000' })).error).not.toBeNull()
    const upd = await creator.from('categories').update({ name: 'hacked' }).eq('id', categoryId).select()
    expect(upd.data ?? []).toHaveLength(0)
    const del = await creator.from('categories').delete().eq('id', categoryId).select()
    expect(del.data ?? []).toHaveLength(0)
  })
  it('creator cannot insert, update or delete clips', async () => {
    const clip = await newClip()
    expect((await creator.from('clips').insert({ date: '2030-01-07', category_id: categoryId, title: 'x' })).error).not.toBeNull()
    const upd = await creator.from('clips').update({ script: 'แก้ย้อนหลัง' }).eq('id', clip.id).select()
    expect(upd.data ?? []).toHaveLength(0)
    const del = await creator.from('clips').delete().eq('id', clip.id).select()
    expect(del.data ?? []).toHaveLength(0)
    expect((await admin.from('clips').select('script').eq('id', clip.id).single()).data!.script).toBe('')
  })
  it('creator cannot call owner RPCs', async () => {
    const clip = await newClip()
    expect((await creator.rpc('copy_clip', { p_id: clip.id, p_date: '2030-01-08' })).error).not.toBeNull()
    expect((await creator.rpc('move_clip', { p_id: clip.id, p_dir: 1 })).error).not.toBeNull()
    expect((await creator.rpc('delete_category', { p_id: categoryId })).error).not.toBeNull()
  })
})

describe('clips (owner)', () => {
  it('server sets position, created_by and status on insert', async () => {
    const a = await newClip('a', '2030-02-04', { status: 'approved', created_by: creatorId } as never)
    const b = await newClip('b', '2030-02-04')
    expect(a).toMatchObject({ position: 0, created_by: ownerId, status: 'todo', round: 1 })
    expect(b.position).toBe(1)
  })
  it('move_clip swaps neighbours', async () => {
    const a = await newClip('m1', '2030-02-05')
    const b = await newClip('m2', '2030-02-05')
    expect((await owner.rpc('move_clip', { p_id: b.id, p_dir: -1 })).error).toBeNull()
    const { data } = await owner.from('clips').select('id').eq('date', '2030-02-05').is('deleted_at', null).order('position')
    expect(data!.map((r) => r.id)).toEqual([b.id, a.id])
  })
  it('revision needs a note and starts a new round only after files were sent', async () => {
    const clip = await newClip()
    expect((await owner.from('clips').update({ status: 'revision', revision_note: ' ' }).eq('id', clip.id)).error).not.toBeNull()
    expect((await owner.from('clips').update({ status: 'revision', revision_note: 'ยังไม่ส่งเลย' }).eq('id', clip.id)).error).toBeNull()
    expect(await clipStatus(clip.id)).toMatchObject({ status: 'revision', round: 1 })
    await addMedia(creator, clip.id, 'submission')
    await owner.from('clips').update({ status: 'revision', revision_note: 'เสียงเบาไป' }).eq('id', clip.id)
    expect(await clipStatus(clip.id)).toMatchObject({ status: 'revision', round: 2 })
  })
  it('review undo keeps rounds right', async () => {
    const clip = await newClip()
    await addMedia(creator, clip.id, 'submission')
    // request changes, then undo it before the creator sends anything: back to round 1
    await owner.from('clips').update({ status: 'revision', revision_note: 'แก้สี' }).eq('id', clip.id)
    await owner.from('clips').update({ status: 'submitted', revision_note: '' }).eq('id', clip.id)
    expect(await clipStatus(clip.id)).toMatchObject({ status: 'submitted', round: 1 })
    // approve from revision, then undo back to revision: no extra round
    await owner.from('clips').update({ status: 'revision', revision_note: 'แก้สี' }).eq('id', clip.id)
    await owner.from('clips').update({ status: 'approved', revision_note: '' }).eq('id', clip.id)
    await owner.from('clips').update({ status: 'revision', revision_note: 'แก้สี' }).eq('id', clip.id)
    expect(await clipStatus(clip.id)).toMatchObject({ status: 'revision', round: 2 })
  })
  it('brief_updated_at moves on brief edits only', async () => {
    const clip = await newClip()
    const first = (await admin.from('clips').select('brief_updated_at').eq('id', clip.id).single()).data!.brief_updated_at
    await addMedia(creator, clip.id, 'submission')
    await owner.from('clips').update({ status: 'approved' }).eq('id', clip.id)
    await owner.from('clips').update({ title: clip.title }).eq('id', clip.id)
    expect((await admin.from('clips').select('brief_updated_at').eq('id', clip.id).single()).data!.brief_updated_at).toBe(first)
    await owner.from('clips').update({ script: 'สคริปต์ใหม่' }).eq('id', clip.id)
    expect((await admin.from('clips').select('brief_updated_at').eq('id', clip.id).single()).data!.brief_updated_at).not.toBe(first)
  })
  it('search finds a Thai word inside a script, ignores deleted clips and escapes wildcards', async () => {
    const word = `นาฬิกา${tag}`
    const live = await newClip('s1', '2030-03-01', { script: `วันนี้มารีวิว${word}รุ่นใหม่` })
    const gone = await newClip('s2', '2030-03-01', { script: `อีกคลิป${word}` })
    await owner.from('clips').update({ deleted_at: new Date().toISOString() }).eq('id', gone.id)
    const { data } = await creator.rpc('search_clips', { p_q: word })
    expect(data!.map((c: { id: string }) => c.id)).toEqual([live.id])
    expect((await creator.rpc('search_clips', { p_q: '%' })).data).toHaveLength(0)
  })
  it('delete_category refuses while live clips use it', async () => {
    await newClip()
    const { error } = await owner.rpc('delete_category', { p_id: categoryId })
    expect(error?.message).toContain('ลบไม่ได้')
  })
})

describe('soft delete', () => {
  it('hides the clip and its media from the creator, not from the owner', async () => {
    const clip = await newClip()
    const media = await addMedia(owner, clip.id, 'reference')
    await owner.from('clips').update({ deleted_at: new Date().toISOString() }).eq('id', clip.id)
    expect((await creator.from('clips').select('id').eq('id', clip.id)).data).toHaveLength(0)
    expect((await creator.from('clip_media').select('id').eq('id', media.id)).data).toHaveLength(0)
    expect((await owner.from('clips').select('id').eq('id', clip.id)).data).toHaveLength(1)
    await owner.from('clips').update({ deleted_at: null }).eq('id', clip.id)
    expect((await creator.from('clips').select('id').eq('id', clip.id)).data).toHaveLength(1)
  })
})

describe('search paging', () => {
  it('returns every match in pages with an exact total and no overlap', async () => {
    const word = `หน้า${tag}`
    for (let i = 0; i < 3; i++) await newClip(`${word} ${i}`, '2031-04-01')
    const page = (from: number, to: number) =>
      creator.rpc('search_clips', { p_q: word }, { count: 'exact' }).select('id').range(from, to)
    const first = await page(0, 1)
    const second = await page(2, 3)
    expect(first.count).toBe(3)
    expect(first.data).toHaveLength(2)
    expect(second.data).toHaveLength(1)
    const ids = [first.data, second.data].flatMap((rows) => (rows as { id: string }[]).map((r) => r.id))
    expect(new Set(ids).size).toBe(3)
  })
})

describe('card preview columns', () => {
  it('script_preview is the first 160 characters and has_note follows note; clients cannot write them', async () => {
    const script = 'ก'.repeat(200)
    const clip = await newClip('พรีวิว', '2031-03-03', { script, note: 'ข้อเดียว' })
    const { data } = await creator.from('clips').select('script_preview, has_note').eq('id', clip.id).single()
    expect(data).toEqual({ script_preview: 'ก'.repeat(160), has_note: true })
    await owner.from('clips').update({ note: '' }).eq('id', clip.id)
    expect((await owner.from('clips').select('has_note').eq('id', clip.id).single()).data!.has_note).toBe(false)
    expect((await owner.from('clips').update({ script_preview: 'ปลอม' }).eq('id', clip.id)).error).not.toBeNull()
  })
})

describe('count RPCs', () => {
  it('group live clips by day and category, for owner and creator, skipping deleted ones', async () => {
    const day = '2031-02-03'
    await newClip('นับ 1', day)
    await newClip('นับ 2', day)
    await newClip('นับ 3', '2031-02-04')
    const gone = await newClip('นับ ลบแล้ว', day)
    await owner.from('clips').update({ deleted_at: new Date().toISOString() }).eq('id', gone.id)

    for (const client of [owner, creator]) {
      const days = await client.rpc('clip_day_counts', { p_from: '2031-02-01', p_to: '2031-02-28' })
      expect(days.error).toBeNull()
      const mine = days.data!.filter((r: { category_id: string }) => r.category_id === categoryId)
      expect(mine.sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))).toEqual([
        { date: '2031-02-03', category_id: categoryId, n: 2 },
        { date: '2031-02-04', category_id: categoryId, n: 1 },
      ])
      const cats = await client.rpc('category_counts')
      expect(cats.error).toBeNull()
      const live = (await admin.from('clips').select('id', { count: 'exact', head: true }).eq('category_id', categoryId).is('deleted_at', null)).count
      expect(cats.data!.find((r: { category_id: string }) => r.category_id === categoryId)?.n).toBe(live)
    }
  })
  it('are not callable signed out', async () => {
    const anon = createClient(url, publishable, opts)
    expect((await anon.rpc('category_counts')).error).not.toBeNull()
  })
})

describe('clip_media', () => {
  it('creator cannot add reference files', async () => {
    const clip = await newClip()
    await expect(addMedia(creator, clip.id, 'reference', false)).rejects.toBeTruthy()
  })
  it('creator submission: forged columns are overwritten by the server', async () => {
    const clip = await newClip()
    const { data, error } = await creator
      .from('clip_media')
      .insert({
        clip_id: clip.id, kind: 'video', purpose: 'submission', file_name: 'final.mp4', mime: 'video/mp4', size_bytes: 5,
        r2_key: 'reference/2030-01-01/other/stolen.mp4', status: 'ready', uploaded_by: ownerId, round: 9,
        expires_at: '2099-01-01T00:00:00Z', ready_at: '2020-01-01T00:00:00Z',
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'pending', uploaded_by: creatorId, round: 1, ready_at: null, uploader_name: 'ทดสอบ creator' })
    expect(data!.r2_key).toBe(`submission/2030-01-07/${clip.id}/${data!.id}-final.mp4`)
    expect(new Date(data!.expires_at).getFullYear()).toBeLessThan(2099)
  })
  it('creator cannot update media (only the server marks ready)', async () => {
    const clip = await newClip()
    const m = await addMedia(creator, clip.id, 'submission', false)
    const upd = await creator.from('clip_media').update({ status: 'ready', ready_at: new Date().toISOString() }).eq('id', m.id).select()
    expect(upd.data ?? []).toHaveLength(0)
    expect((await clipStatus(clip.id)).status).toBe('todo')
  })
  it('a ready submission marks the clip submitted; removing the last one returns it to todo', async () => {
    const clip = await newClip()
    const m = await addMedia(creator, clip.id, 'submission')
    expect((await clipStatus(clip.id)).status).toBe('submitted')
    await owner.from('clip_media').delete().eq('id', m.id)
    expect((await clipStatus(clip.id)).status).toBe('todo')
  })
  it('submissions after a revision request go into the next round', async () => {
    const clip = await newClip()
    const first = await addMedia(creator, clip.id, 'submission')
    await owner.from('clips').update({ status: 'revision', revision_note: 'ตัดช่วงต้นออก' }).eq('id', clip.id)
    const second = await addMedia(creator, clip.id, 'submission')
    expect([first.round, second.round]).toEqual([1, 2])
    expect(await clipStatus(clip.id)).toMatchObject({ status: 'submitted', revision_note: '' })
  })
  it('creator can withdraw a pending or fresh submission, not an older one', async () => {
    const clip = await newClip()
    const pending = await addMedia(creator, clip.id, 'submission', false)
    expect((await creator.from('clip_media').delete().eq('id', pending.id).select()).data).toHaveLength(1)
    const fresh = await addMedia(creator, clip.id, 'submission')
    expect((await creator.from('clip_media').delete().eq('id', fresh.id).select()).data).toHaveLength(1)
    const old = await addMedia(creator, clip.id, 'submission')
    await admin.from('clip_media').update({ ready_at: new Date(Date.now() - 11 * 60_000).toISOString() }).eq('id', old.id)
    expect((await creator.from('clip_media').delete().eq('id', old.id).select()).data ?? []).toHaveLength(0)
  })
  it('creator cannot submit to a deleted clip', async () => {
    const clip = await newClip()
    await owner.from('clips').update({ deleted_at: new Date().toISOString() }).eq('id', clip.id)
    await expect(addMedia(creator, clip.id, 'submission', false)).rejects.toBeTruthy()
  })
})

describe('copy_clip and storage', () => {
  it('copies the brief and shares reference files, counted once in storage', async () => {
    const before = (await owner.from('storage_usage').select('*').single()).data!
    const src = await newClip('ต้นฉบับ', '2030-04-01', { script: 'สคริปต์', note: 'โน้ต' })
    const ref = await addMedia(owner, src.id, 'reference')
    await addMedia(creator, src.id, 'submission')
    const { data: copy, error } = await owner.rpc('copy_clip', { p_id: src.id, p_date: '2030-04-02' })
    expect(error).toBeNull()
    clips.push(copy.id)
    expect(copy).toMatchObject({ date: '2030-04-02', title: 'ต้นฉบับ', script: 'สคริปต์', note: 'โน้ต', status: 'todo' })
    const { data: media } = await owner.from('clip_media').select('*').eq('clip_id', copy.id)
    expect(media).toHaveLength(1)
    expect(media![0]).toMatchObject({ r2_key: ref.r2_key, expires_at: ref.expires_at, purpose: 'reference', status: 'ready' })
    const after = (await owner.from('storage_usage').select('*').single()).data!
    expect(after.total_bytes - before.total_bytes).toBe(2000)
    expect((await creator.from('storage_usage').select('*').single()).data!.total_bytes).toBe(0)
  })
})

describe('manage-users function', () => {
  const invoke = (client: SupabaseClient, body: object) => client.functions.invoke('manage-users', { body })

  it('refuses a creator', async () => {
    const { error } = await invoke(creator, { action: 'create', display_name: 'x', email: `x-${tag}@example.com` })
    expect(error).not.toBeNull()
  })
  it('creates, resets and deletes a creator; their submissions survive', async () => {
    const email = `new-${tag}@example.com`
    const created = await invoke(owner, { action: 'create', display_name: 'ครีเอเตอร์ใหม่', email })
    expect(created.error).toBeNull()
    const { user, tempPassword } = created.data
    users.push(user.id)
    expect(user).toMatchObject({ role: 'creator', email, display_name: 'ครีเอเตอร์ใหม่' })
    // Temp passwords must pass the Auth policy (min 12, lower + upper + digit).
    expect(tempPassword).toMatch(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/)

    const dup = await invoke(owner, { action: 'create', display_name: 'ซ้ำ', email })
    expect(dup.error).not.toBeNull()

    const reset = await invoke(owner, { action: 'reset_password', id: user.id })
    expect(reset.error).toBeNull()
    const fresh = createClient(url, publishable, opts)
    expect((await fresh.auth.signInWithPassword({ email, password: tempPassword })).error).not.toBeNull()
    expect((await fresh.auth.signInWithPassword({ email, password: reset.data.tempPassword })).error).toBeNull()

    const clip = await newClip()
    const sub = await addMedia(fresh, clip.id, 'submission')
    expect((await invoke(owner, { action: 'delete', id: ownerId })).error).not.toBeNull()
    expect((await invoke(owner, { action: 'delete', id: user.id })).error).toBeNull()
    const { data } = await admin.from('clip_media').select('uploaded_by, uploader_name').eq('id', sub.id).single()
    expect(data).toEqual({ uploaded_by: null, uploader_name: 'ครีเอเตอร์ใหม่' })
  })
})
