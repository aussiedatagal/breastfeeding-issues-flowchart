/**
 * The session in the URL hash, so an assessment (or its findings list) can be
 * linked or bookmarked:
 *
 *   #area=pain,supply&no=refusal&p=pain1,pain9&x=pain2&s=pain5&f=dx-vasospasm
 *
 * `area` = areas screened in, `no` = areas screened out, `p` / `x` = findings
 * answered present / absent, `s` = skipped questions — all keyed by id so a
 * content edit can't silently change what an old link means.
 */
import type { Content, Presence } from "../content/model.ts";
import type { SessionState } from "./session.ts";
import { answeredFindings, emptySession, questionFindings } from "./session.ts";

export function encode(content: Content, state: SessionState): string {
  const answered = answeredFindings(content, state);
  const present = answered.filter((f) => state.answers[f] === "present");
  const absent = answered.filter((f) => state.answers[f] === "absent");
  const gatesIn = content.areas.filter((a) => state.areaGate[a.id] === true).map((a) => a.id);
  const gatesOut = content.areas.filter((a) => state.areaGate[a.id] === false).map((a) => a.id);

  const parts: string[] = [];
  if (gatesIn.length) parts.push(`area=${gatesIn.join(",")}`);
  if (gatesOut.length) parts.push(`no=${gatesOut.join(",")}`);
  if (present.length) parts.push(`p=${present.join(",")}`);
  if (absent.length) parts.push(`x=${absent.join(",")}`);
  if (state.skipped.length) parts.push(`s=${state.skipped.join(",")}`);
  if (state.revealed) parts.push("show=1");
  if (state.findings.length) parts.push(`f=${state.findings.join(",")}`);
  if (state.viewingSummary) parts.push("view=summary");
  return parts.length ? `#${parts.join("&")}` : "";
}

export function decode(content: Content, hash: string): SessionState {
  const params = new Map<string, string>();
  for (const seg of hash.replace(/^#/, "").split("&")) {
    const eq = seg.indexOf("=");
    if (eq > 0) params.set(seg.slice(0, eq), seg.slice(eq + 1));
  }

  const state = emptySession();
  const csv = (key: string) => (params.get(key) ?? "").split(",").filter(Boolean);
  const uniq = (list: string[]) => list.filter((v, i) => list.indexOf(v) === i);
  const isArea = (id: string) => content.areas.some((a) => a.id === id);

  for (const id of csv("area")) if (isArea(id)) state.areaGate[id] = true;
  for (const id of csv("no")) if (isArea(id) && state.areaGate[id] === undefined) state.areaGate[id] = false;

  const take = (key: string, value: Presence) => {
    for (const f of csv(key)) {
      if (content.finding.has(f) && state.answers[f] === undefined) state.answers[f] = value;
    }
  };
  take("p", "present");
  take("x", "absent");

  const selected = new Set(
    content.areas.filter((a) => state.areaGate[a.id] === true).map((a) => a.id),
  );
  state.skipped = uniq(
    csv("s").filter((id) => {
      const q = content.question.get(id);
      return q !== undefined && selected.has(q.area);
    }),
  );

  // rebuild the handled order: answered questions, then skipped ones
  const answeredQ = new Set<string>();
  for (const fid of Object.keys(state.answers)) {
    const qid = content.finding.get(fid)?.questionId;
    const q = qid ? content.question.get(qid) : undefined;
    if (q && questionFindings(q).every((f) => state.answers[f] !== undefined)) answeredQ.add(q.id);
  }
  state.handled = uniq([...answeredQ, ...state.skipped]);
  state.revealed = params.get("show") === "1";

  state.findings = uniq(
    csv("f").filter((id) => {
      const d = content.diagnosis.get(id);
      return d !== undefined && !d.reference;
    }),
  );

  state.viewingSummary = params.get("view") === "summary";
  return state;
}
