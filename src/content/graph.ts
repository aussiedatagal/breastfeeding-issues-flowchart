/**
 * The whole content as one directed graph — screening gates, questions (with
 * their `showIf` gates), and diagnoses, grouped into a compound node per
 * problem area, joined by:
 *   • finding → diagnosis edges  (supports / argues-against / rules-out)
 *   • diagnosis → diagnosis edges (`seeAlso` "distinguish from", `coexists`
 *     "occurs alongside") — these are what connect the four areas.
 *
 * Framework-free. The in-app Map view renders it with Cytoscape; the standalone
 * `npm run map` generator renders the same model.
 */
import type { Content } from "./model.ts";

export type NodeKind =
  | "area"
  | "screen"
  | "boolean"
  | "multi"
  | "diagnosis"
  | "do-not-miss"
  | "fallback"
  | "reference";

export type EdgeKind = "flow" | "showIf" | "supports" | "against" | "excludes" | "link";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  area: string;
  /** compound parent — the area node this belongs to (area nodes have none) */
  parent?: string;
  /** longer text for the detail panel */
  detail?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
  /** the endpoints are in different problem areas */
  cross?: boolean;
}

export interface GraphModel {
  nodes: GraphNode[];
  edges: GraphEdge[];
  areas: { id: string; label: string }[];
}

const qNode = (id: string) => `q:${id}`;
const dNode = (id: string) => `dx:${id}`;
const aNode = (id: string) => `area:${id}`;

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const findingShort = (content: Content, fid: string) => content.finding.get(fid)?.short ?? fid;
const questionOf = (content: Content, fid: string) => content.finding.get(fid)?.questionId ?? fid;

export function buildGraph(content: Content): GraphModel {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const areaOfDx = new Map(content.diagnoses.map((d) => [d.id, d.area]));

  for (const area of content.areas) {
    nodes.push({ id: aNode(area.id), kind: "area", area: area.id, label: area.short ?? area.label });

    nodes.push({
      id: `scr:${area.id}`,
      kind: "screen",
      area: area.id,
      parent: aNode(area.id),
      label: `Screening (${area.screens.length})`,
      detail: area.screens.map((s) => "• " + s).join("\n"),
    });

    for (const q of content.questions.filter((qq) => qq.area === area.id)) {
      nodes.push({
        id: qNode(q.id),
        kind: q.type,
        area: area.id,
        parent: aNode(area.id),
        label: q.type === "multi" ? `${q.id} ☑ ${clip(q.ask, 46)}` : `${q.id} · ${findingShort(content, q.id)}`,
        detail:
          q.ask +
          (q.type === "multi" ? `\n\n• ${q.options.map((o) => findingShort(content, o.finding)).join("\n• ")}` : "") +
          (q.assess ? `\n\n${q.assess}` : ""),
      });
      // a faint tether so every question sits with its area's screening node
      edges.push({ id: `e:flow:${q.id}`, source: `scr:${area.id}`, target: qNode(q.id), kind: "flow" });
      for (const c of q.showIf) {
        edges.push({
          id: `e:showIf:${c.finding}->${q.id}`,
          source: qNode(questionOf(content, c.finding)),
          target: qNode(q.id),
          kind: "showIf",
          label: `only if ${c.is === "present" ? "yes" : "no"}`,
        });
      }
    }
  }

  for (const d of content.diagnoses) {
    const kind: NodeKind = d.reference
      ? "reference"
      : d.flag === "do-not-miss"
        ? "do-not-miss"
        : d.supports.length === 0
          ? "fallback"
          : "diagnosis";
    nodes.push({
      id: dNode(d.id),
      kind,
      area: d.area,
      parent: aNode(d.area),
      label: d.name,
      detail: [d.note, d.points.length ? `Points to it:\n• ${d.points.join("\n• ")}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    });
    // faint tether so every diagnosis sits inside its area, even the ones whose
    // only real edges are hidden by default (fallbacks, mimics, against-only)
    edges.push({ id: `e:flow:${d.id}`, source: `scr:${d.area}`, target: dNode(d.id), kind: "flow" });

    for (const s of d.supports) {
      const q = questionOf(content, s.finding);
      edges.push({
        id: `e:sup:${d.id}:${s.finding}`,
        source: qNode(q),
        target: dNode(d.id),
        kind: "supports",
        label:
          content.question.get(q)?.type === "multi"
            ? `${findingShort(content, s.finding)} · w${s.weight}`
            : `supports · w${s.weight}`,
      });
    }
    for (const a of d.against.filter((x) => x.weight >= 2)) {
      edges.push({
        id: `e:agn:${d.id}:${a.finding}`,
        source: qNode(questionOf(content, a.finding)),
        target: dNode(d.id),
        kind: "against",
        label: "argues against",
      });
    }
    for (const e of d.excludes) {
      edges.push({
        id: `e:exc:${d.id}:${e.finding}`,
        source: qNode(questionOf(content, e.finding)),
        target: dNode(d.id),
        kind: "excludes",
        label: `rules out if ${e.when}`,
      });
    }
    for (const [rel, ids] of [
      ["distinguish from", d.seeAlso],
      ["occurs alongside", d.coexists],
    ] as const) {
      for (const t of ids) {
        if (!areaOfDx.has(t)) continue;
        edges.push({
          id: `e:link:${rel}:${d.id}->${t}`,
          source: dNode(d.id),
          target: dNode(t),
          kind: "link",
          label: rel,
          cross: areaOfDx.get(t) !== d.area,
        });
      }
    }
  }

  return {
    nodes,
    edges,
    areas: content.areas.map((a) => ({ id: a.id, label: a.short ?? a.label })),
  };
}

/** small per-area tallies for the Map view header */
export function graphStats(content: Content) {
  return content.areas.map((a) => ({
    id: a.id,
    label: a.short ?? a.label,
    screens: a.screens.length,
    questions: content.questions.filter((q) => q.area === a.id).length,
    diagnoses: content.diagnoses.filter((d) => d.area === a.id && !d.reference).length,
  }));
}
