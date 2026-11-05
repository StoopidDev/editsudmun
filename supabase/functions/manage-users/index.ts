// Owner-only user management: create a creator, reset a password, delete a user.
// Needs the service role for auth.admin, so the owner check runs first with the caller's JWT.
import { admin, asCaller } from '../_shared/clients.ts'
import { cors, fail, json } from '../_shared/http.ts'

type Body =
  | { action: 'create'; display_name: string; email: string }
  | { action: 'reset_password'; id: string }
  | { action: 'delete'; id: string }

// No look-alike characters, since the owner reads it out to the creator.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function tempPassword(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fail('method not allowed', 405)

  const { data: isOwner, error: roleError } = await asCaller(req).rpc('is_owner')
  if (roleError || !isOwner) return fail('ไม่มีสิทธิ์ทำรายการนี้', 403)

  let body: Body
  try {
    body = await req.json()
  } catch {
    return fail('คำขอไม่ถูกต้อง')
  }
  const db = admin()

  if (body.action === 'create') {
    const display_name = String(body.display_name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!display_name) return fail('กรุณากรอกชื่อ')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('อีเมลไม่ถูกต้อง')
    const password = tempPassword()
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'creator' },
      user_metadata: { display_name },
    })
    if (error) {
      if (error.code === 'email_exists' || /already/i.test(error.message)) return fail('อีเมลนี้มีบัญชีอยู่แล้ว', 409)
      console.error(error)
      return fail('สร้างบัญชีไม่สำเร็จ', 500)
    }
    const { data: user, error: profileError } = await db.from('profiles').select('*').eq('id', data.user.id).single()
    if (profileError) return fail('สร้างบัญชีไม่สำเร็จ', 500)
    return json({ user, tempPassword: password })
  }

  if (body.action === 'reset_password' || body.action === 'delete') {
    const { data: target } = await db.from('profiles').select('id, role').eq('id', String(body.id ?? '')).maybeSingle()
    if (!target) return fail('ไม่พบผู้ใช้', 404)

    if (body.action === 'reset_password') {
      if (target.role === 'owner') return fail('รีเซ็ตรหัสผ่านบัญชีเจ้าของไม่ได้', 403)
      const password = tempPassword()
      const { error } = await db.auth.admin.updateUserById(target.id, { password })
      if (error) return fail('รีเซ็ตรหัสผ่านไม่สำเร็จ', 500)
      return json({ tempPassword: password })
    }

    if (target.role === 'owner') return fail('ลบบัญชีเจ้าของไม่ได้', 403)
    // profiles cascades; clips.created_by and clip_media.uploaded_by become null, files stay.
    const { error } = await db.auth.admin.deleteUser(target.id)
    if (error) return fail('ลบผู้ใช้ไม่สำเร็จ', 500)
    return json({ ok: true })
  }

  return fail('คำขอไม่ถูกต้อง')
})
