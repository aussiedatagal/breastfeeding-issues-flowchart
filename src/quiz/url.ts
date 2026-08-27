/**
 * The session, encoded in the URL hash so a particular assessment (or its
 * findings list) can be linked or bookmarked:
 *
 *   #area=pain&a=yes,no,no&f=dx-vasospasm,dx-oversupply&view=summary
 */
import type { Answer, Graph } from "../graph/types.ts";
import { isDiagnosis } from "../graph/types.ts";
import type { SessionState } from "./session.ts";
import { emptySession } from "./session.ts";

const isAnswer = (v: string): v is Answer => v === "yes" || v === "no";

export function encode(state: SessionState): string {
  const parts: string[] = [];
  if (state.areaId) parts.push(`area=${state.areaId}`);
  if (state.answers.length) parts.push(`a=${state.answers.join(",")}`);
  if (state.findings.length) parts.push(`f=${state.findings.join(",")}`);
  if (state.viewingSummary) parts.push(`view=summary`);
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
    state.answers = (params.get("a") ?? "").split(",").filter(isAnswer).slice(0, 60);
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
