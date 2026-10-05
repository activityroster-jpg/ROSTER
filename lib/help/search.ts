import { SECTIONS, type Section } from "@/lib/learn/sections";
import { FAQ } from "./faq";
import { topicsForPage } from "./pages";

export { suggestionsForPage, topicsForPage } from "./pages";

/**
 * The help assistant's brain (decided 5 Oct: no AI, no third party). It
 * answers from what is already written: the Learning Centre sections and the
 * setup FAQ. A plain keyword search (BM25 with simple word stems and a few
 * sailing-school synonyms), nudged towards topics that match the page the
 * person is on. Pure: no I/O, so it is fast, free and fully testable.
 */

export interface HelpAnswer {
  /** "faq" for a curated answer, "guide" for a passage from the Learning Centre. */
  source: "faq" | "guide";
  topic: string;
  topicLabel: string;
  heading: string | null;
  text: string | null;
  items: string[] | null;
  link: string;
}

export interface HelpReply {
  kind: "answer" | "not-found" | "smalltalk";
  message?: string;
  answer?: HelpAnswer;
  related: { topic: string; label: string; link: string }[];
}

interface Doc {
  topic: string;
  topicLabel: string;
  heading: string | null;
  text: string | null;
  items: string[] | null;
  source: "faq" | "guide";
  /** Weighted tokens: the body once, the heading and FAQ phrasings more. */
  tf: Map<string, number>;
  len: number;
}

const STOP = new Set("a an and are as at be been but by can could do does did for from had has have how i if in into is it its me my of on or our so should that the their them then there these they this to up us was we what when where which who why will with would you your yours about any get got just like need want please tell know make use using".split(" "));

/** Words people use for the same thing, folded to one. */
const SYNONYMS: Record<string, string> = {
  rota: "roster", rotas: "roster", rostering: "roster", schedule: "roster", shifts: "shift", shift: "shift",
  staff: "instructor", staffs: "instructor", instructors: "instructor", coach: "instructor", coaches: "instructor", team: "instructor", volunteer: "instructor", volunteers: "instructor", employee: "instructor", employees: "instructor", worker: "instructor",
  boat: "equipment", boats: "equipment", dinghy: "equipment", dinghies: "equipment", kit: "equipment", gear: "equipment", rib: "equipment", ribs: "equipment",
  pay: "payroll", wages: "payroll", wage: "payroll", salary: "payroll", rate: "payroll", rates: "payroll", hours: "payroll",
  cert: "certificate", certs: "certificate", certificates: "certificate", qualification: "certificate", qualifications: "certificate", ticket: "certificate", tickets: "certificate", licence: "certificate", licences: "certificate", license: "certificate",
  dbs: "vetting", pvg: "vetting", accessni: "vetting", garda: "vetting",
  kid: "young", kids: "young", child: "young", children: "young", junior: "young", juniors: "young", minor: "young", minors: "young", teenager: "young", u18: "young",
  holiday: "leave", holidays: "leave", vacation: "leave", absence: "leave",
  admin: "office", admins: "office", manager: "office", permission: "access", permissions: "access", rights: "access",
  price: "plan", pricing: "plan", cost: "plan", costs: "plan", subscription: "plan", invoice: "billing", invoices: "billing", payment: "billing",
  delete: "remove", deleting: "remove", erase: "remove", cancel: "cancel", cancelled: "cancel", cancelling: "cancel",
  app: "app", phone: "app", mobile: "app",
  place: "location", places: "location", venue: "location", venues: "location", area: "location", areas: "location",
  login: "sign", signin: "sign", password: "sign",
  free: "available", availability: "available", busy: "available",
  invite: "invite", invitation: "invite", invites: "invite",
};

function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w))
    .map((w) => SYNONYMS[w] ?? stem(w));
}

function add(tf: Map<string, number>, text: string, weight: number): number {
  let n = 0;
  for (const t of tokens(text)) { tf.set(t, (tf.get(t) ?? 0) + weight); n += weight; }
  return n;
}

function guideDocs(sections: readonly Section[]): Doc[] {
  const docs: Doc[] = [];
  for (const s of sections) {
    let heading: string | null = null;
    for (const b of s.blocks) {
      if (b.kind === "sub") { heading = b.text; continue; }
      if (b.kind === "providerHelp") continue;
      const text = b.kind === "p" || b.kind === "tip" ? b.text : null;
      const items = b.kind === "steps" || b.kind === "bullets" ? b.items : null;
      const tf = new Map<string, number>();
      let len = add(tf, text ?? items!.join(" "), 1);
      len += add(tf, heading ?? "", 2);
      len += add(tf, `${s.label} ${s.blurb}`, 1);
      docs.push({ topic: s.id, topicLabel: s.label, heading, text, items, source: "guide", tf, len });
    }
  }
  return docs;
}

function faqDocs(sections: readonly Section[]): Doc[] {
  return FAQ.map((f) => {
    const tf = new Map<string, number>();
    let len = add(tf, f.answer, 1);
    len += add(tf, f.ask.join(" "), 3);
    const label = sections.find((s) => s.id === f.topic)?.label ?? "Learning Centre";
    return { topic: f.topic, topicLabel: label, heading: f.ask[0]!, text: f.answer, items: null, source: "faq" as const, tf, len };
  });
}

let INDEX: { docs: Doc[]; df: Map<string, number>; avgLen: number } | null = null;
function index() {
  if (INDEX) return INDEX;
  const docs = [...faqDocs(SECTIONS), ...guideDocs(SECTIONS)];
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  INDEX = { docs, df, avgLen: docs.reduce((n, d) => n + d.len, 0) / docs.length };
  return INDEX;
}

const learnLink = (topic: string) => `/learn?topic=${encodeURIComponent(topic)}`;

const SMALLTALK: { test: RegExp; reply: string }[] = [
  { test: /^(hi|hello|hey|hiya|morning|afternoon|evening|good (morning|afternoon|evening))\b[!. ]*$/i, reply: "Hello! Ask me anything about setting up or using ActivityRoster, for example “How do I add instructors?”." },
  { test: /^(thanks|thank you|cheers|ta|great|perfect|brilliant)\b/i, reply: "You're welcome. Ask another question any time." },
];

export function answerQuestion(question: string, path?: string | null): HelpReply {
  const q = question.trim().slice(0, 300);
  for (const s of SMALLTALK) if (s.test.test(q)) return { kind: "smalltalk", message: s.reply, related: [] };
  const terms = [...new Set(tokens(q))];
  if (terms.length === 0) return { kind: "not-found", message: "Ask me a question in a few words, for example “How do I publish the roster?”.", related: [] };

  const { docs, df, avgLen } = index();
  const N = docs.length;
  const pageTopics = new Set(topicsForPage(path));
  const k1 = 1.2;
  const b = 0.75;
  const scored = docs.map((d) => {
    let score = 0;
    let matched = 0;
    for (const t of terms) {
      const f = d.tf.get(t);
      if (!f) continue;
      matched++;
      const idf = Math.log(1 + (N - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.len / avgLen))));
    }
    const coverage = matched / terms.length;
    if (pageTopics.has(d.topic)) score *= 1.25;
    if (d.source === "faq") score *= 1.15;
    return { d, score: score * (0.5 + coverage), coverage };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);

  const best = scored[0];
  // Too little of the question matched anything: say so rather than guess.
  if (!best || best.coverage < (terms.length >= 3 ? 0.4 : terms.length === 2 ? 1 : 0.5)) {
    return {
      kind: "not-found",
      message: "I couldn't find that in the guides. Try different words or browse the Learning Centre, or email us and we'll help:",
      related: [...new Set(scored.slice(0, 6).map((x) => x.d.topic))].slice(0, 2).map((t) => ({ topic: t, label: docs.find((d) => d.topic === t)!.topicLabel, link: learnLink(t) })),
    };
  }
  const related: HelpReply["related"] = [];
  for (const x of scored.slice(1)) {
    if (related.length >= 2) break;
    if (x.d.topic === best.d.topic || related.some((r) => r.topic === x.d.topic) || x.score < best.score * 0.35) continue;
    related.push({ topic: x.d.topic, label: x.d.topicLabel, link: learnLink(x.d.topic) });
  }
  return {
    kind: "answer",
    answer: { source: best.d.source, topic: best.d.topic, topicLabel: best.d.topicLabel, heading: best.d.source === "faq" ? null : best.d.heading, text: best.d.text, items: best.d.items, link: learnLink(best.d.topic) },
    related,
  };
}
