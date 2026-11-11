// Manual test for spec §11: a large multipart upload that loses the connection part-way and
// resumes from the parts R2 already has. Runs against the dev project.
// Usage (from supabase/): node --env-file=.env scripts/upload-resume-test.mjs [size in MB, default 300]
// It uploads the given size over your connection. The object stays in R2 until the 30-day
// lifecycle rule removes it; the test users and clip are deleted at the end.
import { createClient } from '@supabase/supabase-js'

const MB = 1024 ** 2
const size = Number(process.argv[2] ?? 300) * MB
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: publishable, SUPABASE_SECRET_KEY: secret } = process.env
const opts = { auth: { persistSession: false } }
const admin = createClient(url, secret, opts)
const tag = Date.now().toString(36)
const users = []
let clipId

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a)
const fail = (msg) => { throw new Error(msg) }

async function user(role) {
  const email = `resume-${role}-${tag}@example.com`
  const password = `Pw-${tag}-123456`
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role } })
  if (error) throw error
  users.push(data.user.id)
  const c = createClient(url, publishable, opts)
  await c.auth.signInWithPassword({ email, password })
  return c
}

async function call(client, body) {
  const { data } = await client.auth.getSession()
  const res = await fetch(`${url}/functions/v1/media-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publishable, Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) fail(`${body.action} ${res.status}: ${json.error}`)
  return json
}

// Deterministic bytes, so nothing has to be kept in memory beyond one part.
function chunk(start, end) {
  const b = Buffer.allocUnsafe(end - start)
  for (let i = 0; i < b.length; i++) b[i] = (start + i) % 251
  return b
}

async function putPart(urlFor, n, partSize, signal) {
  const start = (n - 1) * partSize
  const res = await fetch(urlFor, { method: 'PUT', body: chunk(start, Math.min(start + partSize, size)), signal })
  if (!res.ok) fail(`part ${n}: ${res.status} ${await res.text()}`)
  return { part_number: n, etag: res.headers.get('etag') }
}

try {
  const owner = await user('owner')
  const creator = await user('creator')
  const cat = (await owner.from('categories').select('id').limit(1).single()).data.id
  clipId = (await owner.from('clips').insert({ date: '2030-06-03', category_id: cat, title: `resume ${tag}` }).select().single()).data.id

  const started = await call(creator, { action: 'init', clip_id: clipId, purpose: 'submission', file_name: 'big-test.mp4', mime: 'video/mp4', size })
  if (started.mode !== 'multipart') fail(`expected multipart, got ${started.mode}`)
  const { media, upload_id, part_size, part_count } = started
  log(`init: ${size / MB} MB, ${part_count} parts of ${part_size / MB} MB`)

  const all = Array.from({ length: part_count }, (_, i) => i + 1)
  const { urls } = await call(creator, { action: 'sign-parts', media_id: media.id, upload_id, part_numbers: all })
  log(`signed ${Object.keys(urls).length} part URLs in one call`)

  // Upload about half, then cut the connection in the middle of the next part.
  const half = Math.max(1, Math.floor(part_count / 2))
  const t0 = Date.now()
  for (let n = 1; n <= half; n++) {
    await putPart(urls[n], n, part_size)
    log(`part ${n}/${part_count} uploaded`)
  }
  const cut = new AbortController()
  setTimeout(() => cut.abort(), 1500)
  try {
    await putPart(urls[half + 1], half + 1, part_size, cut.signal)
    log(`part ${half + 1} finished before the cut (fast connection); still resuming from the R2 list`)
  } catch (e) {
    if (e.name !== 'AbortError') throw e
    log(`connection cut during part ${half + 1}`)
  }

  // Resume: ask R2 what it has, upload only the rest.
  const { parts: have } = await call(creator, { action: 'list-parts', media_id: media.id, upload_id })
  log(`R2 has parts ${have.map((p) => p.part_number).join(', ')}`)
  const done = new Map(have.map((p) => [p.part_number, { part_number: p.part_number, etag: p.etag }]))
  for (const n of all) {
    if (done.has(n)) continue
    done.set(n, await putPart(urls[n], n, part_size))
    log(`part ${n}/${part_count} uploaded (resumed)`)
  }

  const completed = await call(creator, { action: 'complete', media_id: media.id, upload_id, parts: [...done.values()] })
  if (completed.media.status !== 'ready' || completed.media.size_bytes !== size) fail('complete did not mark the file ready with the right size')
  const secs = (Date.now() - t0) / 1000
  log(`complete: ready, ${size / MB} MB in ${secs.toFixed(0)} s (${(size / MB / secs).toFixed(1)} MB/s)`)

  // Read the last bytes back to check the parts were joined in order.
  const view = await fetch(`${url}/functions/v1/media-view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: publishable, Authorization: `Bearer ${(await owner.auth.getSession()).data.session.access_token}` },
    body: JSON.stringify({ media_ids: [media.id] }),
  }).then((r) => r.json())
  const tail = await fetch(view.urls[media.id], { headers: { Range: `bytes=${size - 16}-${size - 1}` } })
  const got = Buffer.from(await tail.arrayBuffer())
  if (!got.equals(chunk(size - 16, size))) fail('last bytes do not match what was uploaded')
  log('PASS: interrupted upload resumed, file is complete and byte-correct')
} catch (e) {
  console.error('FAIL:', e.message)
  process.exitCode = 1
} finally {
  if (clipId) await admin.from('clips').delete().eq('id', clipId)
  for (const id of users) await admin.auth.admin.deleteUser(id)
}
