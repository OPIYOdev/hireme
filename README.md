# Kenya Hiring Pulse
No build step. Works with or without a database: without `DATABASE_URL` it shows live listings only (no trends).

## Add the database (Neon Postgres)
1. Vercel project, Storage / Marketplace, add Neon Postgres. This sets `DATABASE_URL` for you.
2. Add an environment variable `CRON_SECRET` (any long random string). Vercel Cron sends it automatically.
3. Deploy: `vercel --prod`. The cron in `vercel.json` runs `/api/ingest` daily at 04:00 UTC.
4. First fill, without waiting for the cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-APP.vercel.app/api/ingest`
   The response shows fetched / inserted / updated counts and per-source status. Tables are created automatically.

## How storage stays small
- `listings`: one row per distinct posting (same company + normalized title across all sources). Descriptions are not stored, only extracted skills. Rows unseen for 120 days are deleted.
- `listing_daily` and `skill_daily`: one small aggregate per day, kept forever. Trend charts read only these.
- A listing unseen for 60+ days and then seen again counts as a new posting.
- "Active" means seen today or yesterday, so one failed fetch day doesn't fake a dip.

## Tests
`npm i --no-save @electric-sql/pglite && npm test` runs the dedupe, upsert, rollup and retention SQL on an in-process Postgres.

## Notes
- Change anything in `lib/classify.js`, then bump `EXTRACTOR_VERSION`; the trend view flags the break.
- Source terms: Remotive asks for attribution and limits fetches (~4/day). Check each source's terms before storing its data.
