// Upload and view against the dev project and the real R2 bucket (spec §6, §11).
// Needs media-upload and media-view deployed. Uploaded test objects are small; whatever a test
// leaves in R2 is removed by the bucket's 30-day lifecycle rules.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const url = process.env.SUPABASE_URL!
const publishable = process.env.SUPABASE_PUBLISHABLE_KEY!
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const tag = Math.random().toString(36).slice(2, 8)
const users: string[] = []
const clips: string[] = []
let owner: SupabaseClient
let creator: SupabaseClient
let categoryId: string

async function makeUser(role: 'owner' | 'creator') {
  const email = `media-${role}-${tag}@example.com`
  const password = `pw-${tag}-${role}-123`
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { role }, user_metadata: { display_name: `ทดสอบไฟล์ ${role}` },
  })
  if (error) throw error
  users.push(data.user.id)
  const client = createClient(url, publishable, { auth: { persistSession: false } })
  await client.auth.signInWithPassword({ email, password })
  return client
}

// Calls a function and keeps the HTTP status (supabase-js hides it behind an error object).
async function call(client: SupabaseClient, name: string, body: object) {
  const { data } = await client.auth.getSession()
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publishable, Authorization: `Bearer ${data.session!.access_token}` },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

async function newClip(date = '2030-05-06') {
  const { data, error } = await owner.from('clips').insert({ date, category_id: categoryId, title: `ไฟล์ ${tag}` }).select().single()
  if (error) throw error
  clips.push(data.id)
  return data
}

const bytes = (n: number, seed = 7): Uint8Array<ArrayBuffer> => Uint8Array.from({ length: n }, (_, i) => (i * seed) % 251)
const init = (client: SupabaseClient, clipId: string, over: Record<string, unknown> = {}) =>
  call(client, 'media-upload', { action: 'init', clip_id: clipId, purpose: 'submission', file_name: 'งานตัดต่อ final.mp4', mime: 'video/mp4', size: 1000, ...over })

async function uploadSingle(client: SupabaseClient, clipId: string, body: Uint8Array<ArrayBuffer>, over: Record<string, unknown> = {}) {
  const started = await init(client, clipId, { size: body.length, ...over })
  expect(started.status).toBe(200)
  expect(started.data.mode).toBe('single')
  const put = await fetch(started.data.url, { method: 'PUT', headers: started.data.headers, body })
  expect(put.status).toBe(200)
  return started.data.media
}

beforeAll(async () => {
  owner = await makeUser('owner')
  creator = await makeUser('creator')
  const { data, error } = await owner.from('categories').insert({ name: `ไฟล์ ${tag}`, color: '#123456', position: 98 }).select().single()
  if (error) throw error
  categoryId = data.id
})

afterAll(async () => {
  if (clips.length) await admin.from('clips').delete().in('id', clips)
  await admin.from('categories').delete().eq('id', categoryId)
  for (const id of users) await admin.auth.admin.deleteUser(id)
})

describe('init refuses bad requests', () => {
  it('rejects a disallowed type (415) and a file over the cap (413)', async () => {
    const clip = await newClip()
    expect((await init(creator, clip.id, { mime: 'application/pdf', file_name: 'a.pdf' })).status).toBe(415)
    expect((await init(creator, clip.id, { size: 3 * 1024 ** 3 })).status).toBe(413)
    expect((await init(creator, clip.id, { mime: 'image/png', file_name: 'a.png', size: 60 * 1024 ** 2 })).status).toBe(413)
  })
  it('lets RLS refuse a creator adding a reference file (403)', async () => {
    const clip = await newClip()
    expect((await init(creator, clip.id, { purpose: 'reference' })).status).toBe(403)
  })
  it('refuses a signed-out caller', async () => {
    const res = await fetch(`${url}/functions/v1/media-upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: publishable }, body: '{"action":"init"}',
    })
    expect(res.status).toBe(401)
  })
})

describe('single upload', () => {
  it('uploads, completes, marks the clip submitted and can be viewed with the Thai name', async () => {
    const clip = await newClip()
    const body = bytes(2048)
    const media = await uploadSingle(creator, clip.id, body)
    expect(media.status).toBe('pending')

    const done = await call(creator, 'media-upload', { action: 'complete', media_id: media.id })
    expect(done.status).toBe(200)
    expect(done.data.media).toMatchObject({ status: 'ready' })
    expect(done.data.media.ready_at).not.toBeNull()
    expect((await admin.from('clips').select('status').eq('id', clip.id).single()).data!.status).toBe('submitted')

    const view = await call(owner, 'media-view', { media_ids: [media.id], download: true })
    expect(view.status).toBe(200)
    const got = await fetch(view.data.urls[media.id])
    expect(got.status).toBe(200)
    expect(new Uint8Array(await got.arrayBuffer())).toEqual(body)
    expect(got.headers.get('content-disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('งานตัดต่อ final.mp4')}`)

    // A second complete is refused: the row is no longer pending.
    expect((await call(creator, 'media-upload', { action: 'complete', media_id: media.id })).status).toBe(409)
  })
  it('rejects a file whose size differs from what was declared and removes the row', async () => {
    const clip = await newClip()
    const started = await init(creator, clip.id, { size: 10 })
    await fetch(started.data.url, { method: 'PUT', headers: started.data.headers, body: bytes(20) })
    const done = await call(creator, 'media-upload', { action: 'complete', media_id: started.data.media.id })
    expect(done.status).toBe(422)
    expect((await admin.from('clip_media').select('id').eq('id', started.data.media.id)).data).toHaveLength(0)
  })
  it('rejects complete when nothing was uploaded', async () => {
    const clip = await newClip()
    const started = await init(creator, clip.id)
    expect((await call(creator, 'media-upload', { action: 'complete', media_id: started.data.media.id })).status).toBe(422)
  })
  it('refuses a PUT with a different Content-Type than signed', async () => {
    const clip = await newClip()
    const started = await init(creator, clip.id, { size: 4 })
    const put = await fetch(started.data.url, { method: 'PUT', headers: { 'Content-Type': 'text/html' }, body: bytes(4) })
    expect(put.status).toBe(403)
  })
  it('only the uploader can complete', async () => {
    const clip = await newClip()
    const media = await uploadSingle(creator, clip.id, bytes(16))
    expect((await call(owner, 'media-upload', { action: 'complete', media_id: media.id })).status).toBe(403)
  })
})

describe('multipart upload', () => {
  it('signs all parts in one call, lists them for resume, completes and checks the size', async () => {
    const clip = await newClip()
    const size = 5 * 1024 ** 2 + 1000
    const body = bytes(size, 13)
    const started = await init(creator, clip.id, { size, multipart: true })
    expect(started.status).toBe(200)
    expect(started.data).toMatchObject({ mode: 'multipart', part_size: 5 * 1024 ** 2, part_count: 2 })
    const { media, upload_id, part_size } = started.data

    const signed = await call(creator, 'media-upload', { action: 'sign-parts', media_id: media.id, upload_id, part_numbers: [1, 2] })
    expect(signed.status).toBe(200)
    const parts = []
    for (const n of [1, 2]) {
      const put = await fetch(signed.data.urls[n], { method: 'PUT', body: body.slice((n - 1) * part_size, n * part_size) })
      expect(put.status).toBe(200)
      parts.push({ part_number: n, etag: put.headers.get('etag')! })
    }

    const listed = await call(creator, 'media-upload', { action: 'list-parts', media_id: media.id, upload_id })
    expect(listed.data.parts.map((p: { part_number: number }) => p.part_number)).toEqual([1, 2])
    // Resuming uses the ETags from list-parts; they must match the ones R2 sent on PUT.
    expect(listed.data.parts.map((p: { etag: string }) => p.etag)).toEqual(parts.map((p) => p.etag))

    const done = await call(creator, 'media-upload', { action: 'complete', media_id: media.id, upload_id, parts: listed.data.parts })
    expect(done.status).toBe(200)
    expect(done.data.media).toMatchObject({ status: 'ready', size_bytes: size })
  })
  it('abort cancels the upload and removes the pending row', async () => {
    const clip = await newClip()
    const started = await init(creator, clip.id, { size: 6 * 1024 ** 2, multipart: true })
    const { media, upload_id } = started.data
    expect((await call(creator, 'media-upload', { action: 'abort', media_id: media.id, upload_id })).status).toBe(200)
    expect((await admin.from('clip_media').select('id').eq('id', media.id)).data).toHaveLength(0)
    expect((await call(creator, 'media-upload', { action: 'list-parts', media_id: media.id, upload_id })).status).toBe(404)
  })
})

describe('media-view', () => {
  it('returns URLs only for files the caller may see', async () => {
    const clip = await newClip()
    const ref = await uploadSingle(owner, clip.id, bytes(32), { purpose: 'reference', mime: 'image/png', file_name: 'ref.png' })
    await call(owner, 'media-upload', { action: 'complete', media_id: ref.id })
    const pending = await uploadSingle(creator, clip.id, bytes(8))

    const seen = await call(creator, 'media-view', { media_ids: [ref.id, pending.id, crypto.randomUUID()] })
    expect(Object.keys(seen.data.urls)).toEqual([ref.id])
    const inline = await fetch(seen.data.urls[ref.id])
    expect(inline.headers.get('content-disposition')).toMatch(/^inline/)

    await owner.from('clips').update({ deleted_at: new Date().toISOString() }).eq('id', clip.id)
    expect((await call(creator, 'media-view', { media_ids: [ref.id] })).data.urls).toEqual({})
    expect(Object.keys((await call(owner, 'media-view', { media_ids: [ref.id] })).data.urls)).toEqual([ref.id])
  })
  it('refuses an empty or oversized batch', async () => {
    expect((await call(creator, 'media-view', { media_ids: [] })).status).toBe(400)
    const many = Array.from({ length: 101 }, () => crypto.randomUUID())
    expect((await call(creator, 'media-view', { media_ids: many })).status).toBe(400)
  })
})
