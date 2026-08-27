/**
 * The decision graph is authored as Yes/No trees, one per area. We do **not**
 * walk them as strict decision paths (that would let one answer gate out whole
 * families of diagnoses). Instead every root→leaf path is read as a *symptom
 * profile*: "these findings indicate this diagnosis". A diagnosis reachable by
 * several paths gets several profiles.
 *
 * Pure; derived once from the graph.
 */
import type { Answer, Graph, QuestionNode } from "../graph/types.ts";
import { isDiagnosis, isQuestion } from "../graph/types.ts";

export interface Finding {
  questionId: string;
  answer: Answer;
}

export interface Profile {
  diagnosisId: string;
  areaId: string;
  /** one route of findings that indicates the diagnosis */
  findings: Finding[];
}

const MAX_DEPTH = 40;

export function buildProfiles(graph: Graph): Profile[] {
  const profiles: Profile[] = [];

  for (const area of graph.domains) {
    const walk = (nodeId: string, trail: Finding[], seen: ReadonlySet<string>) => {
      if (seen.has(nodeId) || trail.length > MAX_DEPTH) return;
      const node = graph.nodes.get(nodeId);
      if (!node) return;

      if (isDiagnosis(node)) {
        if (!node.reference) {
          profiles.push({ diagnosisId: node.id, areaId: area.id, findings: trail });
        }
        return;
      }
      if (!isQuestion(node)) return;

      const next = new Set(seen).add(nodeId);
      for (const answer of ["yes", "no"] as const) {
        walk(node.edges[answer].to, [...trail, { questionId: nodeId, answer }], next);
      }
    };
    walk(area.entry, [], new Set());
  }

  return profiles;
}

/**
 * The questions an area can ask, ordered so the ones that bear on the most
 * diagnoses come first (a stable, content-derived priority — the flow then
 * skips questions no live candidate needs).
 */
export function areaQuestionOrder(
  graph: Graph,
  profiles: readonly Profile[],
  areaId: string,
): QuestionNode[] {
  const weight = new Map<string, number>();
  const firstSeen = new Map<string, number>();

  for (const p of profiles) {
    if (p.areaId !== areaId) continue;
    p.findings.forEach((f, depth) => {
      weight.set(f.questionId, (weight.get(f.questionId) ?? 0) + 1);
      if (!firstSeen.has(f.questionId)) firstSeen.set(f.questionId, depth);
      else firstSeen.set(f.questionId, Math.min(firstSeen.get(f.questionId)!, depth));
    });
  }

  return [...weight.keys()]
    .map((id) => graph.nodes.get(id))
    .filter((n): n is QuestionNode => n !== undefined && isQuestion(n))
    .sort((a, b) => {
      const d = (firstSeen.get(a.id) ?? 0) - (firstSeen.get(b.id) ?? 0);
      if (d !== 0) return d;
      return (weight.get(b.id) ?? 0) - (weight.get(a.id) ?? 0);
    });
}
