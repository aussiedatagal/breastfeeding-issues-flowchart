import {
  diagnosisFile,
  mapMeta,
  questionFile,
  type EdgeTarget,
  type MapMeta,
  type RawDiagnosis,
  type RawQuestion,
} from "../content/schema.ts";
import type { Answer, Edge, Graph, GraphNode, ParentLink } from "./types.ts";
import { isQuestion, isReference } from "./types.ts";

export interface BuildInput {
  meta: unknown;
  questions: unknown[];
  diagnoses: unknown[];
}

export interface BuildResult {
  graph?: Graph;
  errors: string[];
  warnings: string[];
}

const targetId = (t: EdgeTarget) => (typeof t === "string" ? t : t.goto);
const isGoto = (t: EdgeTarget) => typeof t !== "string";

function deriveShort(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length <= 42 ? trimmed : trimmed.slice(0, 41).trimEnd() + "…";
}

/**
 * Turn the authored content into a validated Graph. Never throws — collects
 * every problem so the validate script and the app can report all of them.
 */
export function buildGraph(input: BuildInput): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const metaParsed = mapMeta.safeParse(input.meta);
  const questionsParsed = questionFile.safeParse(input.questions);
  const diagnosesParsed = diagnosisFile.safeParse(input.diagnoses);

  for (const [label, res] of [
    ["map.yaml", metaParsed],
    ["questions", questionsParsed],
    ["diagnoses", diagnosesParsed],
  ] as const) {
    if (!res.success) {
      for (const issue of res.error.issues) {
        errors.push(`${label}: ${issue.path.join(".") || "(root)"} — ${issue.message}`);
      }
    }
  }
  if (!metaParsed.success || !questionsParsed.success || !diagnosesParsed.success) {
    return { errors, warnings };
  }

  const meta: MapMeta = metaParsed.data;
  const rawQuestions: RawQuestion[] = questionsParsed.data;
  const rawDiagnoses: RawDiagnosis[] = diagnosesParsed.data;

  const nodes = new Map<string, GraphNode>();
  const claim = (id: string, source: string) => {
    if (nodes.has(id)) errors.push(`duplicate id "${id}" (also defined in ${source})`);
  };

  for (const q of rawQuestions) {
    claim(q.id, "questions");
    const mkEdge = (answer: Answer, t: EdgeTarget): Edge => ({
      answer,
      to: targetId(t),
      merge: isGoto(t),
    });
    nodes.set(q.id, {
      kind: "question",
      id: q.id,
      ask: q.ask,
      short: q.short ?? deriveShort(q.ask),
      ...(q.assess !== undefined ? { assess: q.assess } : {}),
      edges: { yes: mkEdge("yes", q.ifYes), no: mkEdge("no", q.ifNo) },
      depth: -1,
      parents: [],
    });
  }

  for (const d of rawDiagnoses) {
    claim(d.id, "diagnoses");
    nodes.set(d.id, {
      kind: "diagnosis",
      id: d.id,
      name: d.name,
      short: d.name.length <= 42 ? d.name : deriveShort(d.name),
      ...(d.flag !== undefined ? { flag: d.flag } : {}),
      ...(d.note !== undefined ? { note: d.note } : {}),
      points: d.points ?? [],
      steps: d.steps ?? [],
      seeAlso: d.seeAlso ?? [],
      reference: d.reference ?? false,
      depth: -1,
      parents: [],
    });
  }

  if (!nodes.has(meta.entry)) {
    errors.push(`map.yaml: entry "${meta.entry}" is not a known node`);
  }

  // every edge / seeAlso target must resolve
  for (const node of nodes.values()) {
    if (isQuestion(node)) {
      for (const edge of [node.edges.yes, node.edges.no]) {
        if (!nodes.has(edge.to)) {
          errors.push(`question "${node.id}" → ${edge.answer}: unknown target "${edge.to}"`);
        }
      }
    } else {
      for (const ref of node.seeAlso) {
        if (!nodes.has(ref)) {
          warnings.push(`diagnosis "${node.id}" seeAlso: unknown node "${ref}"`);
        }
      }
    }
  }

  if (errors.length) return { errors, warnings };

  // ---- assign canonical parent + depth by breadth-first walk from entry ----
  // Pass 1 follows only real (non-goto) edges so a diagnosis is drawn on its
  // main route; pass 2 lets goto-only nodes in.
  const link = (child: GraphNode, from: string, answer: Answer, merge: boolean) => {
    child.parents.push({ from, answer, merge });
  };

  const walk = (followMerge: boolean) => {
    const queue: string[] = [meta.entry];
    while (queue.length) {
      const id = queue.shift()!;
      const node = nodes.get(id)!;
      if (!isQuestion(node)) continue;
      for (const edge of [node.edges.yes, node.edges.no]) {
        if (edge.merge && !followMerge) continue;
        const child = nodes.get(edge.to)!;
        const canonical = child.depth === -1 && !edge.merge;
        if (canonical) {
          child.depth = node.depth + 1;
          link(child, id, edge.answer, false);
          queue.push(child.id);
        } else {
          edge.merge = true;
          link(child, id, edge.answer, true);
        }
      }
    }
  };

  nodes.get(meta.entry)!.depth = 0;
  walk(false);
  // any node reachable only through goto edges still needs a home
  for (const node of nodes.values()) {
    if (node.depth === -1 && !isReference(node) && node.parents.some((p) => p.merge)) {
      const first = node.parents.find((p) => p.merge)!;
      node.depth = (nodes.get(first.from)?.depth ?? 0) + 1;
      first.merge = false;
      const owner = nodes.get(first.from);
      if (owner && isQuestion(owner)) owner.edges[first.answer].merge = false;
    }
  }

  for (const node of nodes.values()) {
    if (isReference(node)) continue;
    if (node.id === meta.entry) continue;
    if (node.depth === -1 || node.parents.length === 0) {
      warnings.push(`node "${node.id}" is never reached from "${meta.entry}"`);
    }
  }

  // a real branch that loops back onto an ancestor is a bug
  for (const node of nodes.values()) {
    if (!isQuestion(node)) continue;
    const ancestors = canonicalAncestors(nodes, node.id);
    for (const edge of [node.edges.yes, node.edges.no]) {
      if (!edge.merge && ancestors.has(edge.to)) {
        errors.push(`question "${node.id}" → ${edge.answer} loops back to ancestor "${edge.to}"`);
      }
    }
  }
  if (errors.length) return { errors, warnings };

  const graph: Graph = {
    title: meta.title,
    ...(meta.subtitle !== undefined ? { subtitle: meta.subtitle } : {}),
    entry: meta.entry,
    nodes,
  };
  return { graph, errors, warnings };
}

function canonicalAncestors(nodes: Map<string, GraphNode>, id: string): Set<string> {
  const out = new Set<string>();
  let current = nodes.get(id);
  const guard = new Set<string>();
  while (current) {
    const parent: ParentLink | undefined = current.parents.find((p) => !p.merge);
    if (!parent || guard.has(parent.from)) break;
    guard.add(parent.from);
    out.add(parent.from);
    current = nodes.get(parent.from);
  }
  return out;
}
