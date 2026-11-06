import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

const url = Deno.env.get('SUPABASE_URL')!

// New publishable/secret keys come as JSON maps; legacy anon/service_role keys stop working
// at the end of 2026, so they are only a fallback.
const key = (map: string, legacy: string) => {
  const raw = Deno.env.get(map)
  return (raw && JSON.parse(raw).default) || Deno.env.get(legacy)!
}

// Acts as the caller: every query goes through RLS with their JWT. A missing or invalid JWT
// makes every query fail, which is how these functions authenticate (verify_jwt is off,
// because the platform check does not understand the new keys).
export const asCaller = (req: Request) =>
  createClient(url, key('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })

// Bypasses RLS. Use only after the caller's permission was checked through asCaller.
export const admin = () =>
  createClient(url, key('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
