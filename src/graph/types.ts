import type { Domain, Flag } from "../content/schema";

export type { Domain, Flag };
export type Answer = "yes" | "no";

/** Synthetic id for the "what is the dyad dealing with?" picker at the far left. */
export const ROOT_ID = "__root__";

/**
 * An outgoing branch of a question.
 * `merge` is true when this edge does NOT own where the child is drawn — either
 * because it is a `goto`, or because another question reaches the child first.
 * Merge edges render as a dashed connector + a "↗" stub, never expand in place.
 */
export interface Edge {
  answer: Answer;
  to: string;
  merge: boolean;
}

export interface ParentLink {
  from: string;
  answer: Answer;
  merge: boolean;
}

interface NodeBase {
  id: string;
  short: string;
  /** distance in questions from the entry along the canonical path; -1 if unplaced */
  depth: number;
  /** first entry is the canonical parent (null only for the entry node) */
  parents: ParentLink[];
}

export interface QuestionNode extends NodeBase {
  kind: "question";
  ask: string;
  assess?: string;
  edges: Record<Answer, Edge>;
}

export interface DiagnosisNode extends NodeBase {
  kind: "diagnosis";
  name: string;
  flag?: Flag;
  note?: string;
  points: string[];
  steps: string[];
  /** distinguish-from links (look-alikes) */
  seeAlso: string[];
  /** factors that commonly occur alongside this one */
  coexists: string[];
  /** a look-alike / concept node, reachable only from the detail panel */
  reference: boolean;
}

export type GraphNode = QuestionNode | DiagnosisNode;

export interface Graph {
  title: string;
  subtitle?: string;
  multifactorialNote?: string;
  rootPrompt: string;
  /** the problem areas, each the root of its own sub-tree */
  domains: readonly Domain[];
  nodes: ReadonlyMap<string, GraphNode>;
}

/** The domain a node sits in, or null if it is not reachable from any. */
export function domainOf(graph: Graph, id: string): Domain | null {
  let cur = graph.nodes.get(id) ?? null;
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const d = graph.domains.find((dom) => dom.entry === cur!.id);
    if (d) return d;
    const parent = cur.parents.find((p) => !p.merge);
    cur = parent ? (graph.nodes.get(parent.from) ?? null) : null;
  }
  return null;
}

export const isQuestion = (n: GraphNode): n is QuestionNode => n.kind === "question";
export const isDiagnosis = (n: GraphNode): n is DiagnosisNode => n.kind === "diagnosis";

/** A look-alike / concept node: never on a yes/no path, only opened from the panel. */
export const isReference = (n: GraphNode): boolean => n.kind === "diagnosis" && n.reference;

/** Drawn in the diagram (everything except reference nodes). */
export const isPlaceable = (n: GraphNode): boolean => !isReference(n);
