import { SOURCES } from "../lib/sources.js";
import { collect } from "../lib/collect.js";
import { getSql } from "../lib/db.js";
import { recentJobs, canonKey } from "../lib/store.js";
export default async function handler(req, res) {
  const sources = Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => [k, { name: s.name, url: s.url }]));
  let body, mode = "database";
  try { const sql = await getSql(); if (sql) body = await recentJobs(sql); } catch (e) { mode = "live (database error: " + String(e.message).slice(0, 80) + ")"; }
  if (!body) {
    if (mode === "database") mode = "live";
    const { jobs, status } = await collect(), seen = new Set();
    body = { generatedAt: new Date().toISOString(), status, jobs: jobs.filter(j => { const k = canonKey(j.company, j.title); return seen.has(k) ? false : seen.add(k); }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 600) };
  }
  res.setHeader("Cache-Control", mode === "database" ? "public, s-maxage=300, stale-while-revalidate=3600" : "public, s-maxage=21600, stale-while-revalidate=86400");
  res.status(200).json({ ...body, sources, mode });
}
