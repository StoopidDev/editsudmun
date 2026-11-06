// One-off: give any user (including the owner) a new temporary password.
// Usage (from supabase/): node --env-file=.env scripts/reset-password.mjs owner@example.com
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY in supabase/.env (never commit it).
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('usage: reset-password.mjs <email>')
  process.exit(1)
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})
const { data: profile } = await db.from('profiles').select('id').eq('email', email).maybeSingle()
if (!profile) {
  console.error(`no user with email ${email}`)
  process.exit(1)
}
const password = randomBytes(9).toString('base64url')
const { error } = await db.auth.admin.updateUserById(profile.id, { password })
if (error) {
  console.error(error.message)
  process.exit(1)
}
console.log(`new temporary password for ${email}: ${password}`)
