// Sign-in, sign-out and password calls. Kept apart from index.ts so the login route
// does not load the date-fns code that the rest of the API uses.
import type { Profile } from '@/lib/types'
import { ok } from './errors'
import { supabase } from './supabase'

export async function me(): Promise<Profile | null> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) return null
  return ok(await supabase.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null
}

export async function login(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
  if (error) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
  return me()
}

export async function logout() {
  await supabase.auth.signOut()
}

// Re-checks the current password by signing in with it, so a borrowed open session cannot
// change it. Minimum length must match Auth > Password settings in the dashboard.
export async function changePassword(current: string, next: string) {
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email
  if (!email) throw new Error('กรุณาเข้าสู่ระบบ')
  // Mirrors the Auth password policy (min 12, lower + upper + digit); the server enforces it.
  if (next.length < 12 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next))
    throw new Error('รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัว มีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลข')
  const check = await supabase.auth.signInWithPassword({ email, password: current })
  if (check.error) throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง')
  const { error } = await supabase.auth.updateUser({ password: next })
  if (error)
    throw new Error(
      error.code === 'same_password' ? 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม'
      : error.code === 'weak_password' ? 'รหัสผ่านใหม่ต้องมีอย่างน้อย 12 ตัว มีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ และตัวเลข'
      : 'เปลี่ยนรหัสผ่านไม่สำเร็จ',
    )
}
