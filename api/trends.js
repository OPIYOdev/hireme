import { getSql } from "../lib/db.js";
import { trends } from "../lib/store.js";
export default async function handler(req, res) {
  try {
    const sql = await getSql(); if (!sql) return res.status(503).json({ error: "no database" });
    const { role = "", elig = "open", days = "120" } = req.query || {};
    res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");
    res.status(200).json(await trends(sql, { role, elig, days }));
  } catch (e) { res.status(500).json({ error: String(e.message).slice(0, 120) }); }
}
