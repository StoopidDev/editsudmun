# Deploy and hosting

## Where things live

| What | Where |
|---|---|
| Web app (prod) | https://webapp-clip.winpim.workers.dev |
| Cloudflare account | `WDev` (owner StoopidDev), account id `6508220090b9bc904f16ae2f31434d1d` |
| Worker (hosts the web app) | https://dash.cloudflare.com/6508220090b9bc904f16ae2f31434d1d/workers/services/view/webapp-clip/production |
| R2 buckets (files) | https://dash.cloudflare.com/6508220090b9bc904f16ae2f31434d1d/r2/overview — `webapp-clip-dev`, `webapp-clip-prod` |
| Supabase prod | project `webapp-clip-prod`, ref `avxuamggvhdnuzfaincl` |
| Supabase dev | project `webapp-clip-dev`, ref `hjitoifpfbiodoiyuoqm` |

The web app is a static Vite build served by Cloudflare Workers static assets (no Worker code).
`web/wrangler.jsonc` sets `not_found_handling: "single-page-application"`, so deep links such as
`/clips/123` load `index.html` and React Router takes over.

## Deploy the web app

There is no auto-deploy: pushing to `main` does not change the live site.

1. Log in to Cloudflare once per machine: `npx wrangler@4.160.0 login` (account `WDev`).
2. Create `web/.env.production.local` (gitignored) with the **prod** values. It overrides
   `web/.env.local` (dev) during the build:
   ```
   VITE_SUPABASE_URL=https://avxuamggvhdnuzfaincl.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<prod publishable key: Supabase dashboard > Project Settings > API Keys>
   ```
   Publishable key only, never the secret key.
3. From `main`: `cd web && npm run deploy` (runs `npm run build`, then `wrangler deploy`).
4. Check the site, then sign in as the owner.

Roll back from the Worker page in the dashboard (Deployments, then roll back to an earlier version).

## Custom domain

When the client gives a domain:
1. Add it to the Worker (dashboard > Worker > Settings > Domains & Routes).
2. Add the new origin to the prod bucket CORS, keeping the workers.dev origin:
   `npx wrangler@4.160.0 r2 bucket cors set webapp-clip-prod --file cors.json` with
   ```json
   {"rules":[{"allowed":{"origins":["https://webapp-clip.winpim.workers.dev","https://<domain>"],"methods":["GET","PUT","HEAD"],"headers":["*"]},"exposeHeaders":["ETag"],"maxAgeSeconds":3600}]}
   ```
   Without this, uploads and video playback fail in the browser with a CORS error.

Backend deploys (migrations, Edge Functions, secrets) are covered in `CLAUDE.md`; backups in
`docs/backup-restore.md`.
