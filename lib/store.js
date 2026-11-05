// All SQL lives here so it can be tested without a network. `sql` is any object with query(text, params) -> rows.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS listings (id BIGSERIAL PRIMARY KEY, canon_key TEXT NOT NULL UNIQUE, title TEXT NOT NULL, company TEXT NOT NULL DEFAULT '', url TEXT, sources TEXT[] NOT NULL DEFAULT '{}', role TEXT, seniority TEXT, eligibility TEXT, eligibility_label TEXT, skills TEXT[] NOT NULL DEFAULT '{}', extractor_version INT NOT NULL, salary TEXT, posted_at TIMESTAMPTZ, first_seen DATE NOT NULL DEFAULT CURRENT_DATE, last_seen DATE NOT NULL DEFAULT CURRENT_DATE, seen_count INT NOT NULL DEFAULT 1)`,
  `CREATE INDEX IF NOT EXISTS listings_last_seen ON listings (last_seen)`,
  `CREATE TABLE IF NOT EXISTS listing_daily (day DATE, role TEXT, eligibility TEXT, total INT, new_count INT, extractor_version INT, PRIMARY KEY (day, role, eligibility))`,
  `CREATE TABLE IF NOT EXISTS skill_daily (day DATE, skill TEXT, role TEXT, eligibility TEXT, n INT, PRIMARY KEY (day, skill, role, eligibility))`,
  `CREATE TABLE IF NOT EXISTS source_daily (day DATE, source TEXT, fetched INT, ok BOOLEAN, error TEXT, updated_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (day, source))`
];
// Same company + title = same listing, across sources and reposts. Location notes and "remote" are ignored.
export const canonKey = (company, title) => [company, title].map(s => String(s || "").toLowerCase().replace(/\(.*?\)|\b(remote|hybrid)\b/g, " ").replace(/[^a-z0-9]+/g, "")).join("|");
const pgArr = a => "{" + a.map(s => '"' + String(s).replace(/(["\\])/g, "\\$1") + '"').join(",") + "}";
const REOPEN_DAYS = 60; // a listing unseen this long and then seen again counts as a new posting
export async function upsertListings(sql, jobs) {
  const byKey = new Map();
  for (const j of jobs) { const k = canonKey(j.company, j.title); const e = byKey.get(k); if (e) e.sources = [...new Set([...e.sources, j.source])]; else byKey.set(k, { ...j, k, sources: [j.source] }); }
  const rows = [...byKey.values()]; let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100), params = [];
    const values = chunk.map((j, n) => {
      const d = new Date(j.date); const o = n * 13;
      params.push(j.k, j.title, j.company || "", j.url || "", pgArr(j.sources), j.role, j.seniority, j.eligibility, j.eligibilityLabel, pgArr(j.skills), j.extractorVersion, j.salary || "", isNaN(d) ? null : d.toISOString());
      return `($${o+1},$${o+2},$${o+3},$${o+4},$${o+5}::text[],$${o+6},$${o+7},$${o+8},$${o+9},$${o+10}::text[],$${o+11}::int,$${o+12},$${o+13}::timestamptz)`;
    }).join(",");
    const res = await sql.query(`INSERT INTO listings (canon_key,title,company,url,sources,role,seniority,eligibility,eligibility_label,skills,extractor_version,salary,posted_at) VALUES ${values}
      ON CONFLICT (canon_key) DO UPDATE SET
        first_seen = CASE WHEN listings.last_seen < CURRENT_DATE - ${REOPEN_DAYS} THEN CURRENT_DATE ELSE listings.first_seen END,
        seen_count = CASE WHEN listings.last_seen < CURRENT_DATE - ${REOPEN_DAYS} THEN 1 WHEN listings.last_seen < CURRENT_DATE THEN listings.seen_count + 1 ELSE listings.seen_count END,
        last_seen = CURRENT_DATE, url = EXCLUDED.url,
        sources = ARRAY(SELECT DISTINCT unnest(listings.sources || EXCLUDED.sources))
      RETURNING (xmax = 0) AS inserted`, params);
    inserted += res.filter(r => r.inserted).length;
  }
  return { distinct: rows.length, inserted, updated: rows.length - inserted };
}
export async function logSources(sql, status) {
  for (const [source, s] of Object.entries(status))
    await sql.query(`INSERT INTO source_daily (day, source, fetched, ok, error) VALUES (CURRENT_DATE, $1, $2::int, $3::boolean, $4) ON CONFLICT (day, source) DO UPDATE SET fetched = EXCLUDED.fetched, ok = EXCLUDED.ok, error = EXCLUDED.error, updated_at = now()`, [source, s.count || 0, !!s.ok, s.error || null]);
}
// "Active" = seen today or yesterday, so one failed fetch day doesn't fake a dip in the trend.
export async function rollup(sql, version) {
  await sql.query(`INSERT INTO listing_daily (day, role, eligibility, total, new_count, extractor_version) SELECT CURRENT_DATE, role, eligibility, count(*), count(*) FILTER (WHERE first_seen = CURRENT_DATE), $1::int FROM listings WHERE last_seen >= CURRENT_DATE - 1 GROUP BY role, eligibility ON CONFLICT (day, role, eligibility) DO UPDATE SET total = EXCLUDED.total, new_count = EXCLUDED.new_count, extractor_version = EXCLUDED.extractor_version`, [version]);
  await sql.query(`INSERT INTO skill_daily (day, skill, role, eligibility, n) SELECT CURRENT_DATE, sk.skill, l.role, l.eligibility, count(*) FROM listings l CROSS JOIN LATERAL unnest(l.skills) AS sk(skill) WHERE l.last_seen >= CURRENT_DATE - 1 GROUP BY sk.skill, l.role, l.eligibility ON CONFLICT (day, skill, role, eligibility) DO UPDATE SET n = EXCLUDED.n`);
}
// Raw listings are disposable; the daily aggregates are kept forever.
export const prune = async (sql, days = 120) => (await sql.query(`DELETE FROM listings WHERE last_seen < CURRENT_DATE - $1::int RETURNING 1`, [days])).length;
export async function recentJobs(sql) {
  const rows = await sql.query(`SELECT id::text, title, company, url, COALESCE(posted_at, first_seen::timestamptz) AS posted, sources[1] AS source, salary, role, seniority, eligibility, eligibility_label, skills, seen_count FROM listings WHERE last_seen >= CURRENT_DATE - 3 ORDER BY posted DESC LIMIT 600`);
  const st = await sql.query(`SELECT source, fetched, ok, error, updated_at FROM source_daily WHERE day = (SELECT max(day) FROM source_daily)`);
  const status = {}; let at = null;
  st.forEach(s => { status[s.source] = s.ok ? { ok: true, count: s.fetched } : { ok: false, error: s.error }; if (!at || s.updated_at > at) at = s.updated_at; });
  return { generatedAt: new Date(at || Date.now()).toISOString(), status, jobs: rows.map(r => ({ id: r.id, title: r.title, company: r.company, url: r.url, date: r.posted, source: r.source, salary: r.salary, role: r.role, seniority: r.seniority, eligibility: r.eligibility, eligibilityLabel: r.eligibility_label, skills: r.skills, seenCount: r.seen_count })) };
}
export async function trends(sql, { role = "", elig = "open", days = 120 } = {}) {
  const n = Math.min(365, Math.max(7, parseInt(days) || 120)), params = [n], w = ["day >= CURRENT_DATE - $1::int"];
  if (role) { params.push(role); w.push(`role = $${params.length}`); }
  if (elig === "kenya") w.push("eligibility = 'kenya'"); else if (elig !== "all") w.push("eligibility IN ('kenya','africa','worldwide')");
  const W = w.join(" AND ");
  const tot = await sql.query(`SELECT day::text AS day, sum(total)::int AS total, sum(new_count)::int AS fresh, max(extractor_version)::int AS v FROM listing_daily WHERE ${W} GROUP BY day ORDER BY day`, params);
  const sk = await sql.query(`SELECT day::text AS day, skill, sum(n)::int AS n FROM skill_daily WHERE ${W} GROUP BY day, skill`, params);
  const days_ = tot.map(t => t.day), idx = Object.fromEntries(days_.map((d, i) => [d, i])), series = {};
  sk.forEach(r => { (series[r.skill] ||= Array(days_.length).fill(0))[idx[r.day]] = r.n; });
  const src = await sql.query(`SELECT day::text AS day, source, fetched, ok FROM source_daily WHERE day >= CURRENT_DATE - 30 ORDER BY day`);
  return { days: days_, total: tot.map(t => t.total), fresh: tot.map(t => t.fresh), versions: tot.map(t => t.v), series, sourceDays: src };
}
