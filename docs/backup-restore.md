# Database backup and restore

Supabase Free has no automatic backups, so `.github/workflows/backup.yml` dumps the prod
database every night at 03:00 (Asia/Bangkok) and keeps each dump for 30 days as a GitHub
Actions artifact. Files in R2 are not backed up; they expire after 30 days by design.

## Setup (once)

1. Prod project dashboard > **Connect** > copy the **Session pooler** connection string and put
   the database password in it.
2. GitHub repo > Settings > Secrets and variables > Actions > New repository secret:
   `SUPABASE_PROD_DB_URL` = that string.
3. Actions > "Backup prod database" > **Run workflow** once to check it works.

GitHub emails the person who last changed the workflow when a scheduled run fails.

The artifact contains user emails and password hashes. Anyone with access to the repo's
Actions can download it, so keep the repo private and the collaborator list short.

## Restore

Download the artifact (Actions > a run > Artifacts), unzip it, then restore into an empty
Supabase project (for example a new project, or prod after a reset):

```sh
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "<connection string of the target project>"
```

`session_replication_role = replica` turns triggers off while the data loads, so the profile,
status and round triggers do not rewrite restored rows.

After a restore into a new project: deploy the Edge Functions, set the R2 secrets, turn off
sign-up, and point `web/.env.local` (or the hosting env vars) at the new project.
