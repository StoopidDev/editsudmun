// Presigned GET URLs for a batch of media ids (spec §6.2). Rows are read as the caller, so RLS
// decides what they may open: creators see nothing on deleted clips. Call it when a clip is
// opened or a video is played, never for every card on the week page.
import { asCaller } from '../_shared/clients.ts'
import { cors, fail, json } from '../_shared/http.ts'
import { presignGet, VIEW_URL_SECONDS } from '../_shared/r2.ts'

const MAX_IDS = 100

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('method not allowed', 405)

  const db = asCaller(req)
  const { data: auth } = await db.auth.getUser()
  if (!auth.user) return fail('กรุณาเข้าสู่ระบบ', 401)

  let body: { media_ids?: unknown; download?: unknown }
  try {
    body = await req.json()
  } catch {
    return fail('คำขอไม่ถูกต้อง')
  }
  const ids = Array.isArray(body.media_ids) ? [...new Set(body.media_ids.map(String))] : []
  if (!ids.length || ids.length > MAX_IDS) return fail('คำขอไม่ถูกต้อง')

  const { data, error } = await db.from('clip_media').select('id, r2_key, file_name').in('id', ids).eq('status', 'ready')
  if (error) return fail('เกิดข้อผิดพลาด ลองอีกครั้ง', 500)

  // Ids the caller may not see, or that are not ready, are simply left out.
  const urls: Record<string, string> = {}
  for (const m of data ?? []) urls[m.id] = await presignGet(m.r2_key, m.file_name, body.download === true)
  return json({ urls, expires_at: new Date(Date.now() + VIEW_URL_SECONDS * 1000).toISOString() })
})
