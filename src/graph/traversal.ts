import type { Answer, Graph, GraphNode } from "./types.ts";
import { isQuestion, isReference } from "./types.ts";

export interface PathStep {
  question: GraphNode;
  answer: Answer;
}

const canonicalParent = (node: GraphNode) => node.parents.find((p) => !p.merge) ?? null;

export function canonicalChain(graph: Graph, id: string): GraphNode[] {
  const chain: GraphNode[] = [];
  let node = graph.nodes.get(id) ?? null;
  const seen = new Set<string>();
  while (node && !seen.has(node.id)) {
    seen.add(node.id);
    chain.push(node);
    const parent = canonicalParent(node);
    node = parent ? (graph.nodes.get(parent.from) ?? null) : null;
  }
  return chain.reverse();
}

export function pathTo(graph: Graph, id: string): PathStep[] {
  const chain = canonicalChain(graph, id);
  const steps: PathStep[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const question = chain[i]!;
    const next = chain[i + 1]!;
    const link = next.parents.find((p) => !p.merge && p.from === question.id);
    if (question.kind === "question" && link) steps.push({ question, answer: link.answer });
  }
  return steps;
}

/** ids in `id`'s canonical subtree (not counting merge edges), including `id`. */
export function canonicalSubtree(graph: Graph, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    if (out.has(current)) continue;
    out.add(current);
    const node = graph.nodes.get(current);
    if (!node || !isQuestion(node)) continue;
    for (const edge of [node.edges.yes, node.edges.no]) {
      if (edge.merge) continue;
      const child = graph.nodes.get(edge.to);
      if (child?.parents.find((p) => !p.merge)?.from === current) stack.push(edge.to);
    }
  }
  return out;
}

export const initialOpen = (graph: Graph): Set<string> => new Set([graph.entry]);

/** Choose an answer at a question: open that branch, fold the other away. */
export function answer(
  graph: Graph,
  open: ReadonlySet<string>,
  questionId: string,
  choice: Answer,
): { open: Set<string>; selectedId: string; jumpedTo?: string } {
  const question = graph.nodes.get(questionId);
  if (!question || !isQuestion(question)) return { open: new Set(open), selectedId: questionId };

  const edge = question.edges[choice];
  const next = new Set(open);

  if (edge.merge) {
    for (const id of canonicalChain(graph, edge.to)) next.add(id.id);
    return { open: next, selectedId: edge.to, jumpedTo: edge.to };
  }

  const other = choice === "yes" ? "no" : "yes";
  const otherEdge = question.edges[other];
  if (!otherEdge.merge) {
    for (const id of canonicalSubtree(graph, otherEdge.to)) next.delete(id);
  }
  next.add(edge.to);
  return { open: next, selectedId: edge.to };
}

/** Undo an answer: fold that branch back to a stub. */
export function collapse(
  graph: Graph,
  open: ReadonlySet<string>,
  questionId: string,
  choice: Answer,
): { open: Set<string>; selectedId: string } {
  const question = graph.nodes.get(questionId);
  const next = new Set(open);
  if (question && isQuestion(question) && !question.edges[choice].merge) {
    for (const id of canonicalSubtree(graph, question.edges[choice].to)) next.delete(id);
  }
  return { open: next, selectedId: questionId };
}

/** Bring a node (and its canonical ancestors) into view without folding anything. */
export function reveal(
  graph: Graph,
  open: ReadonlySet<string>,
  id: string,
): { open: Set<string>; selectedId: string } {
  const next = new Set(open);
  for (const node of canonicalChain(graph, id)) next.add(node.id);
  return { open: next, selectedId: id };
}

export function expandAll(graph: Graph): Set<string> {
  const out = new Set<string>();
  for (const node of graph.nodes.values()) {
    if (!isReference(node) && node.depth >= 0) out.add(node.id);
  }
  return out;
}
