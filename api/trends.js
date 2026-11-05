import { getSql } from "../lib/db.js";
import { trends } from "../lib/store.js";
export default async function handler(req, res) {
  try {
    const sql = await getSql(); if (!sql) return res.status(503).json({ error: "no database" });
    const { role = "", elig = "open", days = "120" } = req.query || {};
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    res.status(200).json(await trends(sql, { role, elig, days }));
    } catch (e) {
    const msg = String(e.message);
    if (/does not exist/.test(msg)) { res.setHeader("Cache-Control", "no-store"); return res.status(200).json({ days: [], total: [], fresh: [], versions: [], series: {}, sourceDays: [] }); }
    res.status(500).json({ error: msg.slice(0, 120) });
  }
}