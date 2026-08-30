/**
 * The session in the URL hash, so an assessment (or its findings list) can be
 * linked or bookmarked:
 *
 *   #area=pain,supply&no=refusal&p=pain1,pain9&x=pain2&s=pain5&f=dx-vasospasm
 *
 * `area` = areas screened in, `no` = areas screened out, `p` / `x` = findings
 * answered present / absent, `s` = skipped questions — all keyed by id so a
 * content edit can't silently change what an old link means. Mid-screening
 * position (which of an area's screening questions was answered) is not
 * preserved — only the in/out verdict.
 */
import type { Content, Presence } from "../content/model.ts";
import type { SessionState } from "./session.ts";
import { answeredFindings, emptySession, questionFindings, selectedAreas } from "./session.ts";

/** an area every one of whose screening questions was answered "no" */
function screenedOut(content: Content, state: SessionState) {
  return content.areas.filter((a) =>
    a.screens.every((_, i) => state.screenAnswers[`${a.id}:${i}`] === false),
  );
}

export function encode(content: Content, state: SessionState): string {
  const answered = answeredFindings(content, state);
  const present = answered.filter((f) => state.answers[f] === "present");
  const absent = answered.filter((f) => state.answers[f] === "absent");
  const gatesIn = selectedAreas(content, state).map((a) => a.id);
  const gatesOut = screenedOut(content, state).map((a) => a.id);

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
  const areaById = new Map(content.areas.map((a) => [a.id, a]));

  for (const id of csv("area")) {
    const area = areaById.get(id);
    if (area && state.screenAnswers[`${id}:0`] === undefined) {
      state.screenAnswers[`${id}:0`] = true;
      state.screenOrder.push(`${id}:0`);
    }
  }
  for (const id of csv("no")) {
    const area = areaById.get(id);
    if (!area || state.screenAnswers[`${id}:0`] !== undefined) continue;
    area.screens.forEach((_, i) => {
      state.screenAnswers[`${id}:${i}`] = false;
      state.screenOrder.push(`${id}:${i}`);
    });
  }

  const selected = new Set(selectedAreas(content, state).map((a) => a.id));

  const take = (key: string, value: Presence) => {
    for (const f of csv(key)) {
      if (content.finding.has(f) && state.answers[f] === undefined) state.answers[f] = value;
    }
  };
  take("p", "present");
  take("x", "absent");

  state.skipped = uniq(
    csv("s").filter((id) => {
      const q = content.question.get(id);
      return q !== undefined && selected.has(q.area);
    }),
  );

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
