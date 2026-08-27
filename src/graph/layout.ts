import type { Answer, Graph, GraphNode } from "./types.ts";
import { isQuestion } from "./types.ts";
import { wrap } from "./text.ts";

export const NODE_W = 260;
export const STUB_W = 78;
export const STUB_H = 34;
const COL = 312;
const ROW_GAP = 14;
const WRAP_CHARS = 32;
const LINE_H = 16;

export interface Placement {
  id: string;
  kind: "question" | "diagnosis" | "stub";
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  nodeId: string;
  parentId?: string;
  answer?: Answer;
  merge?: boolean;
}

export interface Connector {
  id: string;
  fromId: string;
  toId: string;
  kind: "canonical" | "stub" | "merge";
  answer: Answer;
}

export interface Layout {
  placements: Placement[];
  connectors: Connector[];
  byId: Map<string, Placement>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

const nodeHeight = (lines: string[]) => Math.max(40, 18 + lines.length * LINE_H);
const stubId = (parentId: string, answer: Answer) => `stub:${parentId}:${answer}`;

/**
 * Progressive-disclosure layout. Opened nodes render in full and sit on a near-
 * horizontal "spine"; an un-opened branch is a small stub beside its parent.
 * Pure — depends only on the graph and which node ids are open.
 */
export function computeLayout(graph: Graph, open: ReadonlySet<string>): Layout {
  const placements: Placement[] = [];
  const connectors: Connector[] = [];
  let cursorY = 0;
  const slot = (h: number) => {
    const y = cursorY + h / 2;
    cursorY += h + ROW_GAP;
    return y;
  };

  const isOpen = (id: string) => id === graph.entry || open.has(id);

  const walk = (node: GraphNode): number => {
    const lines = wrap(isQuestion(node) ? node.ask : node.name, WRAP_CHARS);
    const h = nodeHeight(lines);
    const x = node.depth * COL;

    const placement: Placement = {
      id: node.id,
      kind: node.kind,
      x,
      y: 0,
      w: NODE_W,
      h,
      lines,
      nodeId: node.id,
    };
    placements.push(placement);

    if (!isQuestion(node)) {
      placement.y = slot(h);
      return placement.y;
    }

    const branches: { answer: Answer; childId: string; merge: boolean; open: boolean }[] = [];
    for (const answer of ["yes", "no"] as const) {
      const edge = node.edges[answer];
      const owns =
        !edge.merge && graph.nodes.get(edge.to)?.parents.find((p) => !p.merge)?.from === node.id;
      branches.push({
        answer,
        childId: edge.to,
        merge: !owns,
        open: owns && isOpen(edge.to),
      });
    }

    const openChildY: number[] = [];
    for (const b of branches) {
      if (b.open) {
        const child = graph.nodes.get(b.childId)!;
        openChildY.push(walk(child));
        connectors.push({
          id: `c:${node.id}:${b.answer}`,
          fromId: node.id,
          toId: child.id,
          kind: "canonical",
          answer: b.answer,
        });
      }
    }

    const addStub = (b: (typeof branches)[number], y: number) => {
      const sid = stubId(node.id, b.answer);
      placements.push({
        id: sid,
        kind: "stub",
        x: (node.depth + 1) * COL,
        y,
        w: STUB_W,
        h: STUB_H,
        lines: [],
        nodeId: b.childId,
        parentId: node.id,
        answer: b.answer,
        merge: b.merge,
      });
      connectors.push({
        id: `c:${node.id}:${b.answer}`,
        fromId: node.id,
        toId: sid,
        kind: b.merge ? "merge" : "stub",
        answer: b.answer,
      });
    };

    if (openChildY.length > 0) {
      placement.y = (openChildY[0]! + openChildY[openChildY.length - 1]!) / 2;
      for (const b of branches) {
        if (b.open) continue;
        const offset = (b.answer === "yes" ? -1 : 1) * (h / 2 + STUB_H / 2 + 18);
        addStub(b, placement.y + offset);
      }
    } else {
      const stubYs: number[] = [];
      for (const b of branches) {
        const y = slot(STUB_H);
        stubYs.push(y);
        addStub(b, y);
      }
      placement.y = stubYs.length ? (stubYs[0]! + stubYs[stubYs.length - 1]!) / 2 : slot(h);
    }

    return placement.y;
  };

  const entry = graph.nodes.get(graph.entry);
  if (entry) walk(entry);

  const byId = new Map(placements.map((p) => [p.id, p]));

  // dashed connectors for merge edges whose target is currently on screen
  for (const node of graph.nodes.values()) {
    if (!isQuestion(node) || !isOpen(node.id)) continue;
    for (const answer of ["yes", "no"] as const) {
      const edge = node.edges[answer];
      if (!edge.merge) continue;
      if (byId.has(edge.to) && byId.has(node.id)) {
        connectors.push({
          id: `m:${node.id}:${answer}`,
          fromId: node.id,
          toId: edge.to,
          kind: "merge",
          answer,
        });
      }
    }
  }

  const bounds =
    placements.length === 0
      ? { minX: 0, minY: 0, maxX: NODE_W, maxY: 80 }
      : {
          minX: Math.min(...placements.map((p) => p.x)),
          minY: Math.min(...placements.map((p) => p.y - p.h / 2)),
          maxX: Math.max(...placements.map((p) => p.x + p.w)),
          maxY: Math.max(...placements.map((p) => p.y + p.h / 2)),
        };

  return { placements, connectors, byId, bounds };
}
