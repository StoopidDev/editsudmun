// Uploads go straight from the browser to R2 (spec §6.1). This function only decides and signs:
//   init        validate type and size, insert the clip_media row as the caller (RLS decides who
//               may add which file), return one presigned PUT or start a multipart upload
//   sign-parts  presign many part URLs in one call (saves invocations on the Free plan)
//   list-parts  parts R2 already has, so an interrupted upload can resume
//   complete    finish multipart, HeadObject to prove the file exists with the declared size
//               and type, then mark the row ready (service role: clients have no UPDATE)
//   abort       cancel: drop the multipart upload or object and the pending row
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { admin, asCaller } from '../_shared/clients.ts'
import { cors, fail, json } from '../_shared/http.ts'
import { kindOf, maxBytes, partPlan } from '../_shared/media.ts'
import * as r2 from '../_shared/r2.ts'

type Media = {
  id: string
  clip_id: string
  purpose: string
  r2_key: string
  mime: string
  size_bytes: number
  status: string
  uploaded_by: string | null
}

const MAX_PARTS_PER_CALL = 1000

// The caller must be able to see the row (RLS) and be its uploader; owners may also abort.
async function pendingOwnRow(db: SupabaseClient, userId: string, mediaId: unknown, isOwner: boolean, forAbort = false) {
  const { data } = await db.from('clip_media').select('*').eq('id', String(mediaId ?? '')).maybeSingle()
  const m = data as Media | null
  if (!m) return { error: fail('ไม่พบไฟล์', 404) }
  if (m.uploaded_by !== userId && !(forAbort && isOwner)) return { error: fail('ไม่มีสิทธิ์ทำรายการนี้', 403) }
  if (m.status !== 'pending') return { error: fail('ไฟล์นี้อัปโหลดเสร็จแล้ว', 409) }
  return { media: m }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('method not allowed', 405)

  const db = asCaller(req)
  const { data: auth } = await db.auth.getUser()
  const user = auth.user
  if (!user) return fail('กรุณาเข้าสู่ระบบ', 401)
  const isOwner = user.app_metadata?.role === 'owner'

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('คำขอไม่ถูกต้อง')
  }

  try {
    switch (body.action) {
      case 'init': {
        const file_name = String(body.file_name ?? '').trim()
        const mime = String(body.mime ?? '').toLowerCase()
        const size = Number(body.size)
        const purpose = body.purpose === 'reference' ? 'reference' : body.purpose === 'submission' ? 'submission' : null
        if (!purpose || !file_name || file_name.length > 255) return fail('คำขอไม่ถูกต้อง')
        const kind = kindOf(mime)
        if (!kind) return fail('ไม่รองรับไฟล์ชนิดนี้', 415)
        if (!Number.isSafeInteger(size) || size <= 0) return fail('ขนาดไฟล์ไม่ถูกต้อง')
        if (size > maxBytes(kind)) return fail('ไฟล์ใหญ่เกินกำหนด', 413)

        // RLS decides: a creator may only add submissions to live clips. The insert trigger
        // sets the key, status, uploader, round and expiry.
        const { data, error } = await db
          .from('clip_media')
          .insert({ clip_id: String(body.clip_id ?? ''), kind, purpose, file_name, mime, size_bytes: size, r2_key: '', expires_at: new Date().toISOString() })
          .select()
          .single()
        if (error || !data) return fail(error?.code === '23503' ? 'ไม่พบคลิป' : 'ไม่มีสิทธิ์อัปโหลดไฟล์นี้', 403)
        const media = data as Media

        const plan = partPlan(size, body.multipart === true)
        if (!plan) return json({ media, mode: 'single', url: await r2.presignPut(media.r2_key, mime), headers: { 'Content-Type': mime } })
        try {
          const upload_id = await r2.createMultipart(media.r2_key, mime)
          return json({ media, mode: 'multipart', upload_id, ...plan })
        } catch (e) {
          await admin().from('clip_media').delete().eq('id', media.id)
          throw e
        }
      }

      case 'sign-parts': {
        const { media, error } = await pendingOwnRow(db, user.id, body.media_id, isOwner)
        if (error) return error
        const numbers = Array.isArray(body.part_numbers) ? body.part_numbers.map(Number) : []
        if (!numbers.length || numbers.length > MAX_PARTS_PER_CALL || numbers.some((n) => !Number.isInteger(n) || n < 1 || n > 10000)) {
          return fail('คำขอไม่ถูกต้อง')
        }
        const uploadId = String(body.upload_id ?? '')
        const urls: Record<number, string> = {}
        for (const n of numbers) urls[n] = await r2.presignPart(media!.r2_key, uploadId, n)
        return json({ urls })
      }

      case 'list-parts': {
        const { media, error } = await pendingOwnRow(db, user.id, body.media_id, isOwner)
        if (error) return error
        const parts = await r2.listParts(media!.r2_key, String(body.upload_id ?? ''))
        if (!parts) return fail('ไม่พบการอัปโหลดนี้ เริ่มอัปโหลดใหม่', 404)
        return json({ parts })
      }

      case 'complete': {
        const { media, error } = await pendingOwnRow(db, user.id, body.media_id, isOwner)
        if (error) return error
        const m = media!
        if (body.upload_id) {
          const parts = Array.isArray(body.parts) ? (body.parts as { part_number: number; etag: string }[]) : []
          if (!parts.length) return fail('คำขอไม่ถูกต้อง')
          try {
            await r2.completeMultipart(m.r2_key, String(body.upload_id), parts)
          } catch (e) {
            console.error(e)
            return fail('รวมไฟล์ไม่สำเร็จ ลองอัปโหลดใหม่', 422)
          }
        }
        // The presigned URL cannot limit size, so check what actually arrived.
        const obj = await r2.head(m.r2_key)
        const sameType = obj?.type.split(';')[0].trim().toLowerCase() === m.mime
        if (!obj || obj.size !== m.size_bytes || !sameType) {
          if (obj) await r2.remove(m.r2_key)
          await admin().from('clip_media').delete().eq('id', m.id)
          return fail(obj ? 'ไฟล์ที่อัปโหลดไม่ตรงกับที่แจ้งไว้' : 'ไม่พบไฟล์ที่อัปโหลด ลองอีกครั้ง', 422)
        }
        const { data, error: updateError } = await admin()
          .from('clip_media')
          .update({ status: 'ready', ready_at: new Date().toISOString() })
          .eq('id', m.id)
          .eq('status', 'pending')
          .select()
          .single()
        if (updateError || !data) return fail('บันทึกไฟล์ไม่สำเร็จ', 500)
        return json({ media: data })
      }

      case 'abort': {
        const { media, error } = await pendingOwnRow(db, user.id, body.media_id, isOwner, true)
        if (error) return error
        const m = media!
        if (body.upload_id) await r2.abortMultipart(m.r2_key, String(body.upload_id))
        else await r2.remove(m.r2_key)
        await admin().from('clip_media').delete().eq('id', m.id)
        return json({ ok: true })
      }
    }
    return fail('คำขอไม่ถูกต้อง')
  } catch (e) {
    console.error(e)
    return fail('เชื่อมต่อที่เก็บไฟล์ไม่สำเร็จ ลองอีกครั้ง', 502)
  }
})
