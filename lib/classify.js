// Bump EXTRACTOR_VERSION whenever the skill/role/eligibility rules change: trend charts flag the break.
export const EXTRACTOR_VERSION = 1;
// Heuristic, keyword-based classification. Transparent on purpose: edit the lists below.
const SKILLS = {
  Python:/\bpython\b/i, FastAPI:/fastapi/i, Django:/django/i, Flask:/\bflask\b/i, "Node.js":/node\.?js|\bnode\b/i,
  TypeScript:/typescript/i, Go:/\bgolang\b|\bgo (developer|engineer)\b/i, Java:/\bjava\b(?!script)/i, Rust:/\brust\b/i,
  SQL:/\bsql\b|postgres|mysql/i, PostgreSQL:/postgres/i, Redis:/\bredis\b/i, "Queues (Kafka/Celery)":/kafka|rabbitmq|celery/i,
  Docker:/docker/i, Kubernetes:/kubernetes|\bk8s\b/i, AWS:/\baws\b|amazon web/i, GCP:/\bgcp\b|google cloud/i, Azure:/azure/i,
  Terraform:/terraform/i, "CI/CD":/ci\/cd|github actions|gitlab/i, Testing:/pytest|unit test|integration test|\btdd\b/i,
  GraphQL:/graphql/i, "REST APIs":/rest(ful)? api|\bapis?\b/i, Microservices:/microservice/i,
  LLMs:/\bllm|large language|openai|anthropic|gpt|claude/i, "RAG/Vector DB":/\brag\b|vector (db|database)|embedding|pinecone|pgvector/i,
  "Agents (LangGraph/CrewAI)":/langgraph|langchain|crewai|agentic|ai agent/i, "ML/PyTorch":/pytorch|tensorflow|machine learning|\bml\b/i,
  "Data pipelines":/airflow|dbt|etl|data pipeline|spark/i, Flutter:/flutter|dart/i, React:/\breact\b/i, Security:/security|owasp|oauth/i,
  Fintech:/fintech|payments?|mpesa|m-pesa|ledger/i, Observability:/observability|prometheus|grafana|datadog/i
};
const ROLES = [
  ["AI / LLM engineer", /\b(ai|llm|genai|generative|prompt)\b.*(engineer|developer)|(engineer|developer).*\b(ai|llm)\b|agent/i],
  ["ML / data science", /machine learning|\bml\b|data scien|research scien/i],
  ["Data engineer", /data engineer|analytics engineer|etl/i],
  ["DevOps / platform / SRE", /devops|\bsre\b|platform engineer|infrastructure|cloud engineer|reliability/i],
  ["Backend", /back.?end|server.?side|api (engineer|developer)|python|django|fastapi|node|java\b|golang|\bgo (dev|eng)|rust|\.net|php|ruby/i],
  ["Full-stack", /full.?stack/i], ["Mobile", /mobile|flutter|android|ios|react native/i], ["Frontend", /front.?end|react|vue|angular|ui engineer/i]
];
export const roleOf = t => (ROLES.find(([, r]) => r.test(t)) || ["Other", 0])[0];
export function seniorityOf(t) {
  if (/\b(intern|internship|graduate|trainee)\b/i.test(t)) return "Intern/Graduate";
  if (/\b(junior|jr\.?|entry|associate)\b/i.test(t)) return "Junior";
  if (/\b(principal|staff|architect|head of|director|vp)\b/i.test(t)) return "Staff+";
  if (/\b(lead|manager)\b/i.test(t)) return "Lead";
  if (/\b(senior|sr\.?)\b/i.test(t)) return "Senior";
  if (/\b(mid|intermediate)\b/i.test(t)) return "Mid";
  return "Unspecified";
}
// tier: kenya | africa | worldwide | restricted | unknown
export function eligibilityOf(loc = "") {
  const l = String(loc).toLowerCase();
  if (/kenya|nairobi|east africa/.test(l)) return { tier: "kenya", label: "Kenya / East Africa" };
  if (/\bafrica\b|\bemea\b|\bgmt\b|utc[+-]?[0-3]\b/.test(l)) return { tier: "africa", label: "Africa / EMEA timezone" };
  if (/worldwide|anywhere|global|any location|international/.test(l) || l.trim() === "remote") return { tier: "worldwide", label: "Worldwide" };
  if (/usa|u\.s\.|united states|canada|\buk\b|united kingdom|europe|\beu\b|germany|france|spain|netherlands|australia|india|latam|brazil|apac|only|north america/.test(l)) return { tier: "restricted", label: "Restricted: " + loc };
  return { tier: "unknown", label: loc || "Not stated" };
}
export const skillsOf = text => Object.keys(SKILLS).filter(k => SKILLS[k].test(text));
