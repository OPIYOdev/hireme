import { collect } from "../lib/collect.js";
import { getSql } from "../lib/db.js";
import { SCHEMA, upsertListings, logSources, rollup, prune } from "../lib/store.js";
import { EXTRACTOR_VERSION } from "../lib/classify.js";
// Called daily by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
export default async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: "unauthorized" });
  const sql = await getSql(); if (!sql) return res.status(503).json({ error: "DATABASE_URL not set" });
  for (const s of SCHEMA) await sql.query(s);
  const { jobs, status } = await collect(); await logSources(sql, status);
  if (!jobs.length) return res.status(502).json({ error: "all sources failed; nothing stored", status });
  const r = await upsertListings(sql, jobs); await rollup(sql, EXTRACTOR_VERSION); const pruned = await prune(sql, 120);
  res.status(200).json({ fetched: jobs.length, ...r, pruned, status });
}
