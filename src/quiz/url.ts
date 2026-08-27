/**
 * The session, encoded in the URL hash so a particular assessment (or its
 * findings list) can be linked or bookmarked:
 *
 *   #area=pain&a=pain1:no,pain2:yes&show=1&f=dx-vasospasm&view=summary
 *
 * Answers are stored as `questionId:answer` so a content edit can't silently
 * shift what an old link means.
 */
import type { Answer, Graph } from "../graph/types.ts";
import { isDiagnosis, isQuestion } from "../graph/types.ts";
import type { Given, SessionState } from "./session.ts";
import { emptySession } from "./session.ts";

const isAnswer = (v: string): v is Answer => v === "yes" || v === "no";

export function encode(state: SessionState): string {
  const parts: string[] = [];
  if (state.areaId) parts.push(`area=${state.areaId}`);
  if (state.given.length)
    parts.push(`a=${state.given.map((g) => `${g.questionId}:${g.answer}`).join(",")}`);
  if (state.revealed) parts.push("show=1");
  if (state.findings.length) parts.push(`f=${state.findings.join(",")}`);
  if (state.viewingSummary) parts.push("view=summary");
  return parts.length ? `#${parts.join("&")}` : "";
}

export function decode(graph: Graph, hash: string): SessionState {
  const params = new Map<string, string>();
  for (const seg of hash.replace(/^#/, "").split("&")) {
    const eq = seg.indexOf("=");
    if (eq > 0) params.set(seg.slice(0, eq), seg.slice(eq + 1));
  }

  const state = emptySession();

  const areaId = params.get("area");
  if (areaId && graph.domains.some((d) => d.id === areaId)) {
    state.areaId = areaId;
    const given: Given[] = [];
    for (const pair of (params.get("a") ?? "").split(",")) {
      const [qid, ans] = pair.split(":");
      const node = qid ? graph.nodes.get(qid) : undefined;
      if (qid && node && isQuestion(node) && ans && isAnswer(ans)) {
        given.push({ questionId: qid, answer: ans });
      }
    }
    state.given = given.slice(0, 40);
    state.revealed = params.get("show") === "1";
  }

  state.findings = (params.get("f") ?? "")
    .split(",")
    .filter((id) => {
      const node = graph.nodes.get(id);
      return node !== undefined && isDiagnosis(node) && !node.reference;
    })
    .filter((id, i, all) => all.indexOf(id) === i);

  state.viewingSummary = params.get("view") === "summary";

  return state;
}
