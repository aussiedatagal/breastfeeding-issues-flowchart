import type { Flag } from "../content/schema";

export type { Flag };
export type Answer = "yes" | "no";

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
  entry: string;
  nodes: ReadonlyMap<string, GraphNode>;
}

export const isQuestion = (n: GraphNode): n is QuestionNode => n.kind === "question";
export const isDiagnosis = (n: GraphNode): n is DiagnosisNode => n.kind === "diagnosis";

/** A look-alike / concept node: never on a yes/no path, only opened from the panel. */
export const isReference = (n: GraphNode): boolean => n.kind === "diagnosis" && n.reference;

/** Drawn in the diagram (everything except reference nodes). */
export const isPlaceable = (n: GraphNode): boolean => !isReference(n);
