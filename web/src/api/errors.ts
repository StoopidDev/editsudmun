import type { PostgrestError } from '@supabase/supabase-js'

// Postgres errors raised by our functions are already Thai; map the rest.
export function thai(e: PostgrestError): Error {
  if (e.code === 'P0001') return new Error(e.message)
  if (e.code === '42501' || e.code === 'PGRST301') return new Error('ไม่มีสิทธิ์ทำรายการนี้')
  if (e.code === '23503') return new Error('ข้อมูลที่อ้างถึงไม่มีอยู่แล้ว')
  if (e.code === '23514') return new Error('ข้อมูลไม่ถูกต้อง')
  console.error(e)
  return new Error('เกิดข้อผิดพลาด ลองอีกครั้ง')
}

// data is set whenever error is null, except for maybeSingle (no row): that caller checks for null itself.
export function ok<T>({ data, error }: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (error) throw thai(error)
  return data as NonNullable<T>
}
