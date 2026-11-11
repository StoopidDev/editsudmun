// One-off: create a user with a fixed role (the owner cannot be created from the app).
// Usage (from supabase/): node --env-file=.env scripts/create-user.mjs owner owner@example.com "ชื่อเจ้าของ"
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY in supabase/.env (never commit it).
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const [role, email, displayName] = process.argv.slice(2)
if (!['owner', 'creator'].includes(role) || !email || !displayName) {
  console.error('usage: create-user.mjs <owner|creator> <email> <display name>')
  process.exit(1)
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})
// 16 characters with lower, upper and digit, to pass the Auth password policy.
let password
do password = randomBytes(12).toString('base64url')
while (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))
const { data, error } = await db.auth.admin.createUser({
  email: email.toLowerCase(),
  password,
  email_confirm: true,
  app_metadata: { role },
  user_metadata: { display_name: displayName },
})
if (error) {
  console.error(error.message)
  process.exit(1)
}
console.log(`created ${role} ${data.user.email}\ntemporary password: ${password}`)
