import { SOURCES } from "./sources.js";
import { roleOf, seniorityOf, eligibilityOf, skillsOf, EXTRACTOR_VERSION } from "./classify.js";
const normalize = j => { const e = eligibilityOf(j.loc); return { id: j.id, source: j.source, title: j.title, company: j.company, url: /^https?:\/\//.test(j.url) ? j.url : "", date: j.date, salary: j.salary, role: roleOf(j.title + " " + j.tags.join(" ")), seniority: seniorityOf(j.title), eligibility: e.tier, eligibilityLabel: e.label, skills: skillsOf(`${j.title} ${j.tags.join(" ")} ${j.text}`), extractorVersion: EXTRACTOR_VERSION }; };
export async function collect() {
  const keys = Object.keys(SOURCES), status = {}, jobs = [];
  const out = await Promise.allSettled(keys.map(async k => (await SOURCES[k].run()).map(j => ({ ...j, source: k }))));
  out.forEach((r, i) => { status[keys[i]] = r.status === "fulfilled" ? { ok: true, count: r.value.length } : { ok: false, count: 0, error: String(r.reason?.message || r.reason).slice(0, 200) }; if (r.status === "fulfilled") jobs.push(...r.value.map(normalize)); });
  return { jobs, status };
}
