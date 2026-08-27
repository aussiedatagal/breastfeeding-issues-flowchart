import {
  ROOT_ID,
  isQuestion,
  type Answer,
  type Graph,
  type GraphNode,
  type QuestionNode,
} from "./types.ts";
import { wrap } from "./text.ts";

export const NODE_W = 248;
export const STUB_W = 104;
export const STUB_H = 46;
export const DOMAIN_W = 264;

const ROW = 150; // vertical distance between a parent row and its children row
const H_GAP = 26; // horizontal gap between sibling subtrees
const DOMAIN_GAP = 84; // horizontal gap between adjacent problem-area columns
const ROOT_GAP = 132; // vertical gap between the root and the first row of a column
const WRAP_CHARS = 26;
const DOMAIN_WRAP = 26;
const LINE_H = 16.5;
const ROOT_LABEL = "What is the difficulty?";

export interface Placement {
  id: string;
  kind: "root" | "domain" | "question" | "diagnosis" | "stub";
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  /** id of the underlying node ("" for the synthetic root) */
  nodeId: string;
  parentId?: string;
  answer?: Answer;
  merge?: boolean;
  /** domain chips + domain-entry questions carry their area label */
  domainId?: string;
  domainLabel?: string;
  /** short (2–4 word) area name, for the map kicker */
  domainShort?: string;
}

export interface Connector {
  id: string;
  fromId: string;
  toId: string;
  kind: "canonical" | "stub" | "merge" | "domain";
  answer?: Answer;
}

export interface Layout {
  placements: Placement[];
  connectors: Connector[];
  byId: Map<string, Placement>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

const nodeHeight = (lines: string[]) => Math.max(52, 30 + lines.length * (LINE_H + 0.5));
const stubId = (parentId: string, answer: Answer) => `stub:${parentId}:${answer}`;

/**
 * Progressive-disclosure layout, top-to-bottom. Each problem area is its own
 * column; the decision tree inside it grows downward, branches spreading
 * sideways. An un-opened branch is a small stub below its parent. Pure — depends
 * only on the graph and which node ids are open.
 */
export function computeLayout(graph: Graph, open: ReadonlySet<string>): Layout {
  const placements: Placement[] = [];
  const connectors: Connector[] = [];

  const isOpen = (id: string) => open.has(id);
  const domainByEntry = new Map(graph.domains.map((d) => [d.entry, d]));

  /** A branch below a question: either an opened child subtree or a stub leaf. */
  type Branch = { answer: Answer; childId: string; merge: boolean; open: boolean };
  const branchesOf = (node: QuestionNode): Branch[] => {
    const out: Branch[] = [];
    for (const answer of ["yes", "no"] as const) {
      const edge = node.edges[answer];
      const owns =
        !edge.merge && graph.nodes.get(edge.to)?.parents.find((p) => !p.merge)?.from === node.id;
      out.push({ answer, childId: edge.to, merge: !owns, open: owns && isOpen(edge.to) });
    }
    return out;
  };

  /** Width a node's whole subtree needs. */
  const measure = (node: GraphNode): number => {
    if (!isQuestion(node)) return NODE_W;
    const kids = branchesOf(node).map((b) =>
      b.open ? measure(graph.nodes.get(b.childId)!) : STUB_W,
    );
    const kidsW = kids.reduce((a, w) => a + w, 0) + H_GAP * Math.max(0, kids.length - 1);
    return Math.max(NODE_W, kidsW);
  };

  /**
   * Place `node` and its descendants. The subtree occupies [left, left + width]
   * horizontally and starts at row `depth`. Returns the node's centre x.
   */
  const place = (node: GraphNode, left: number, depth: number, topY: number): number => {
    const lines = wrap(isQuestion(node) ? node.ask : node.name, WRAP_CHARS);
    const h = nodeHeight(lines);
    const width = measure(node);
    const cx = left + width / 2;
    const dom = domainByEntry.get(node.id);

    placements.push({
      id: node.id,
      kind: node.kind,
      x: cx - NODE_W / 2,
      y: topY + depth * ROW,
      w: NODE_W,
      h,
      lines,
      nodeId: node.id,
      ...(dom
        ? { domainId: dom.id, domainLabel: dom.label, domainShort: dom.short ?? dom.label }
        : {}),
    });

    if (!isQuestion(node)) return cx;

    const kids = branchesOf(node);
    const kidWidths = kids.map((b) => (b.open ? measure(graph.nodes.get(b.childId)!) : STUB_W));
    const kidsW = kidWidths.reduce((a, w) => a + w, 0) + H_GAP * Math.max(0, kids.length - 1);
    let cursor = cx - kidsW / 2;

    kids.forEach((b, i) => {
      const w = kidWidths[i]!;
      if (b.open) {
        const child = graph.nodes.get(b.childId)!;
        place(child, cursor, depth + 1, topY);
        connectors.push({
          id: `c:${node.id}:${b.answer}`,
          fromId: node.id,
          toId: child.id,
          kind: "canonical",
          answer: b.answer,
        });
      } else {
        const sid = stubId(node.id, b.answer);
        placements.push({
          id: sid,
          kind: "stub",
          x: cursor + (w - STUB_W) / 2,
          y: topY + (depth + 1) * ROW,
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
      }
      cursor += w + H_GAP;
    });

    return cx;
  };

  // Problem areas sit side by side; the root sits above them.
  const rootLines = wrap(ROOT_LABEL, 21);
  const root: Placement = {
    id: ROOT_ID,
    kind: "root",
    x: 0,
    y: 0,
    w: NODE_W,
    h: nodeHeight(rootLines) + 6,
    lines: rootLines,
    nodeId: "",
  };
  placements.push(root);

  const columnTopY = root.h + ROOT_GAP;
  let cursorX = 0;
  const domainCentres: number[] = [];

  graph.domains.forEach((dom, i) => {
    const node = graph.nodes.get(dom.entry);
    if (!node) return;
    if (i > 0) cursorX += DOMAIN_GAP;
    const opened = isOpen(dom.entry);
    if (opened) {
      const width = measure(node);
      const cx = place(node, cursorX, 0, columnTopY);
      domainCentres.push(cx);
      cursorX += width;
    } else {
      const lines = wrap(dom.label, DOMAIN_WRAP);
      const h = Math.max(STUB_H, 20 + lines.length * LINE_H);
      placements.push({
        id: `domain:${dom.id}`,
        kind: "domain",
        x: cursorX,
        y: columnTopY,
        w: DOMAIN_W,
        h,
        lines,
        nodeId: dom.entry,
        parentId: ROOT_ID,
        domainId: dom.id,
        domainLabel: dom.label,
        domainShort: dom.short ?? dom.label,
      });
      domainCentres.push(cursorX + DOMAIN_W / 2);
      cursorX += DOMAIN_W;
    }
    connectors.push({
      id: `dom:${dom.id}`,
      fromId: ROOT_ID,
      toId: opened ? dom.entry : `domain:${dom.id}`,
      kind: "domain",
    });
  });

  const spanMid = domainCentres.length
    ? (domainCentres[0]! + domainCentres[domainCentres.length - 1]!) / 2
    : NODE_W / 2;
  root.x = spanMid - NODE_W / 2;

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
