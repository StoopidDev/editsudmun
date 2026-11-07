// Prints which Supabase project the CLI is linked to, so a push never goes to the wrong one.
import { readFileSync } from 'node:fs'

const PROJECTS = { hjitoifpfbiodoiyuoqm: 'DEV (webapp-clip-dev)', avxuamggvhdnuzfaincl: 'PROD (webapp-clip-prod)' }
let ref = ''
try {
  ref = readFileSync(new URL('../.temp/project-ref', import.meta.url), 'utf8').trim()
} catch {
  console.error('Not linked. Run npm run link:dev or npm run link:prod')
  process.exit(1)
}
console.log(`Linked to ${PROJECTS[ref] ?? `unknown project ${ref}`}`)
