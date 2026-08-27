/**
 * "What did this path not consider?" — the tools that keep a single yes/no walk
 * from silently closing out other explanations (the confounding-variable
 * problem). Pure; unit-tested.
 */
import type { Answer, DiagnosisNode, Graph } from "../graph/types.ts";
import { isDiagnosis } from "../graph/types.ts";
import type { Route, Step } from "./session.ts";

/**
 * Every non-reference diagnosis reachable from a node by following *both*
 * branches of every question below it.
 */
export function reachableDiagnoses(graph: Graph, fromId: string): DiagnosisNode[] {
  const out: DiagnosisNode[] = [];
  const seen = new Set<string>();
  const stack = [fromId];

  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);

    const node = graph.nodes.get(id);
    if (!node) continue;
    if (isDiagnosis(node)) {
      if (!node.reference) out.push(node);
      continue;
    }
    stack.push(node.edges.yes.to, node.edges.no.to);
  }
  return out;
}

export interface UntakenBranch {
  /** index of this fork in `route.steps` */
  stepIndex: number;
  step: Step;
  otherAnswer: Answer;
  /** diagnoses the branch you didn't take would have investigated */
  wouldConsider: DiagnosisNode[];
}

/**
 * For every fork on the route, the diagnoses the *un-taken* answer leads to —
 * minus the one you actually landed on. Forks whose other branch adds nothing
 * new are dropped.
 */
export function untakenBranches(graph: Graph, route: Route, reachedId: string): UntakenBranch[] {
  return route.steps
    .map((step, stepIndex): UntakenBranch => {
      const otherAnswer: Answer = step.answer === "yes" ? "no" : "yes";
      const wouldConsider = reachableDiagnoses(graph, step.question.edges[otherAnswer].to).filter(
        (d) => d.id !== reachedId,
      );
      return { stepIndex, step, otherAnswer, wouldConsider };
    })
    .filter((b) => b.wouldConsider.length > 0);
}
