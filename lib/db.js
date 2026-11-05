// Returns null when no database is configured, so the site still works in live-feed mode.
export async function getSql() {
  if (!process.env.DATABASE_URL) return null;
  const { neon } = await import("@neondatabase/serverless");
  return neon(process.env.DATABASE_URL);
}
