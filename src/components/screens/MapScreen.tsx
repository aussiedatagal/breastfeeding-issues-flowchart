import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import type cytoscape from "cytoscape";
import type { Content } from "../../content/model.ts";
import { buildGraph, graphStats, type EdgeKind, type GraphModel } from "../../content/graph.ts";
import styles from "./MapScreen.module.css";

const AREA_COLOR: Record<string, string> = {
  supply: "#35786a",
  pain: "#b1503d",
  inflammation: "#9a7328",
  refusal: "#4c7d57",
};
const areaColor = (id: string) => AREA_COLOR[id] ?? "#6b6252";

const EDGE_COLOR: Record<EdgeKind, string> = {
  flow: "#cabfa4",
  showIf: "#8a7f6a",
  supports: "#35786a",
  against: "#b1503d",
  excludes: "#8a1c1c",
  link: "#7a6fa8",
};

const EDGE_FILTERS: { kind: EdgeKind; label: string }[] = [
  { kind: "showIf", label: "showIf gates" },
  { kind: "supports", label: "supports" },
  { kind: "against", label: "argues against" },
  { kind: "excludes", label: "rules out" },
  { kind: "link", label: "distinguish / alongside" },
];
/* start with a clean scoring backbone; the noisy ones are opt-in */
const DEFAULT_EDGES: EdgeKind[] = ["flow", "showIf", "supports", "excludes"];

const SUB_LAYOUT = {
  name: "fcose",
  quality: "default",
  animate: false,
  randomize: true,
  nodeSeparation: 75,
  idealEdgeLength: 52,
  nodeRepulsion: 3600,
  gravity: 0.5,
  packComponents: true,
  tile: true,
} as const;

const COLS = 2;
const GAP = 150;

/** lay out each visible area on its own (fast), then pack the areas into a grid
 *  sized to their contents — one constrained layout over the whole thing is far
 *  too slow. */
async function relayout(cy: cytoscape.Core, areaIds: string[], visibleAreas: Set<string>) {
  const shown = areaIds.filter((id) => visibleAreas.has(id));
  const boxes: ({ nodes: cytoscape.NodeCollection; bb: cytoscape.BoundingBox12 } | null)[] = [];

  for (const id of shown) {
    const nodes = cy.nodes(`[area = "${id}"]`).filter((n) => !n.isParent() && n.visible());
    if (nodes.length === 0) {
      boxes.push(null);
      continue;
    }
    const eles = nodes.union(nodes.edgesWith(nodes)).filter((el) => el.visible());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fcose opts aren't typed
    const l = eles.layout({ ...SUB_LAYOUT } as any);
    await new Promise<void>((res) => {
      l.one("layoutstop", () => res());
      l.run();
    });
    boxes.push({ nodes, bb: nodes.boundingBox() });
  }

  const colW: number[] = [];
  const rowH: number[] = [];
  boxes.forEach((b, i) => {
    if (!b) return;
    const c = i % COLS;
    const r = Math.floor(i / COLS);
    colW[c] = Math.max(colW[c] ?? 0, b.bb.x2 - b.bb.x1);
    rowH[r] = Math.max(rowH[r] ?? 0, b.bb.y2 - b.bb.y1);
  });
  const colX: number[] = [];
  const rowY: number[] = [];
  colW.reduce((x, w, c) => ((colX[c] = x), x + w + GAP), 0);
  rowH.reduce((y, h, r) => ((rowY[r] = y), y + h + GAP), 0);

  boxes.forEach((b, i) => {
    if (!b) return;
    b.nodes.shift({
      x: (colX[i % COLS] ?? 0) - b.bb.x1,
      y: (rowY[Math.floor(i / COLS)] ?? 0) - b.bb.y1,
    });
  });
  cy.fit(cy.elements(":visible"), 25);
}

/* eslint-disable @typescript-eslint/no-explicit-any -- cytoscape stylesheet is loosely typed */
const CY_STYLE: any[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "font-size": 11,
      "font-family": "IBM Plex Sans, system-ui, sans-serif",
      color: "#2b2620",
      "text-wrap": "wrap",
      "text-max-width": "150px",
      "text-valign": "center",
      "text-halign": "center",
      "background-color": "#fbf7ee",
      "border-width": 1.5,
      "border-color": "data(color)",
      shape: "round-rectangle",
      width: "label",
      height: "label",
      padding: "9px",
    },
  },
  {
    selector: "node:parent",
    style: {
      label: "data(label)",
      "font-size": 15,
      "font-weight": 700,
      color: "data(color)",
      "text-valign": "top",
      "text-halign": "center",
      "text-margin-y": 4,
      "background-color": "data(color)",
      "background-opacity": 0.05,
      "border-width": 1,
      "border-color": "data(color)",
      "border-opacity": 0.4,
      shape: "round-rectangle",
      padding: "26px",
    },
  },
  { selector: 'node[kind = "screen"]', style: { "background-color": "#ece1cb", "font-weight": 600 } },
  { selector: 'node[kind = "multi"]', style: { "border-style": "double", "border-width": 4 } },
  {
    selector:
      'node[kind = "diagnosis"], node[kind = "do-not-miss"], node[kind = "fallback"], node[kind = "reference"]',
    style: { "background-color": "#e7efe9", "font-weight": 600 },
  },
  { selector: 'node[kind = "do-not-miss"]', style: { "background-color": "#f6e2dc", "border-width": 3 } },
  { selector: 'node[kind = "fallback"]', style: { "background-color": "#efeadd", "font-style": "italic" } },
  { selector: 'node[kind = "reference"]', style: { "background-color": "#efeae2", "border-style": "dashed" } },
  {
    selector: "edge",
    style: {
      width: 1.3,
      "line-color": "data(ecolor)",
      "line-opacity": 0.55,
      "target-arrow-color": "data(ecolor)",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.8,
      "curve-style": "bezier",
      "font-size": 9,
      color: "#5b5344",
      "text-background-color": "#f5efe4",
      "text-background-opacity": 0.9,
      "text-background-padding": "2px",
    },
  },
  { selector: 'edge[kind = "flow"]', style: { width: 1, "line-opacity": 0.25, "target-arrow-shape": "none", "curve-style": "straight" } },
  { selector: 'edge[kind = "showIf"]', style: { "line-style": "dashed", width: 1.8 } },
  { selector: 'edge[kind = "supports"]', style: { width: 2 } },
  { selector: 'edge[kind = "against"]', style: { "line-style": "dashed" } },
  { selector: 'edge[kind = "excludes"]', style: { width: 3.5 } },
  { selector: 'edge[kind = "link"]', style: { "line-style": "dotted", width: 1.4, "line-opacity": 0.4, "target-arrow-shape": "vee" } },
  { selector: 'edge[?cross]', style: { width: 2.4, "line-opacity": 0.6 } },
  { selector: ".hidden", style: { display: "none" } },
  { selector: ".dim", style: { opacity: 0.08 } },
  { selector: ".hot", style: { "line-opacity": 1, opacity: 1, label: "data(label)", width: 2.6, "z-index": 20 } },
  { selector: "node.pick", style: { "border-width": 4, "border-color": "#1f4a41", "background-color": "#d7ece4", "z-index": 30 } },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

export function MapScreen({ content }: { content: Content }) {
  const model: GraphModel = useMemo(() => buildGraph(content), [content]);
  const stats = useMemo(() => graphStats(content), [content]);
  const areaIds = useMemo(() => model.areas.map((a) => a.id), [model]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areasOn, setAreasOn] = useState<Set<string>>(new Set(model.areas.map((a) => a.id)));
  const [edgesOn, setEdgesOn] = useState<Set<EdgeKind>>(new Set(DEFAULT_EDGES));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = model.nodes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ default: cy }, { default: fcose }] = await Promise.all([
          import("cytoscape"),
          import("cytoscape-fcose"),
        ]);
        cy.use(fcose);
        if (!alive || !containerRef.current) return;

        const instance = cy({
          container: containerRef.current,
          elements: [
            ...model.nodes.map((n) => ({ data: { ...n, color: areaColor(n.area) } })),
            ...model.edges.map((e) => ({ data: { ...e, ecolor: EDGE_COLOR[e.kind] } })),
          ],
          style: CY_STYLE,
          layout: { name: "preset" },
          wheelSensitivity: 0.3,
          minZoom: 0.08,
          maxZoom: 2.5,
        });
        cyRef.current = instance;
        instance.on("tap", "node", (ev) => {
          if (!ev.target.isParent()) setSelectedId(ev.target.id());
        });
        instance.on("tap", (ev) => {
          if (ev.target === instance) setSelectedId(null);
        });
        setReady(true);
        setTimeout(() => {
          instance.resize();
          relayout(instance, areaIds, areasOn);
        }, 130);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- areaIds/areasOn read once at mount
  }, [model]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        if (!n.isParent()) n.toggleClass("hidden", !areasOn.has(n.data("area")));
      });
      cy.nodes(":parent").forEach((p) => {
        p.toggleClass("hidden", p.children(":visible").length === 0);
      });
      cy.edges().forEach((e) => {
        const k = e.data("kind") as EdgeKind;
        const endsHidden = e.source().hasClass("hidden") || e.target().hasClass("hidden");
        e.toggleClass("hidden", endsHidden || (k !== "flow" && !edgesOn.has(k)));
      });
    });
    relayout(cy, areaIds, areasOn);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- areaIds is stable
  }, [ready, areasOn, edgesOn]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.elements().removeClass("dim hot pick");
    if (!selectedId) return;
    const node = cy.getElementById(selectedId);
    if (node.empty()) return;
    const hood = node.closedNeighborhood();
    cy.batch(() => {
      cy.elements().not(hood).not(hood.ancestors()).addClass("dim");
      hood.edges().addClass("hot");
      node.addClass("pick");
    });
    cy.animate({ fit: { eles: hood, padding: 90 }, duration: 350, easing: "ease-out" });
  }, [ready, selectedId]);

  const toggle = <T,>(set: Set<T>, v: T): Set<T> => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };

  const fit = () => {
    const cy = cyRef.current;
    if (cy) cy.animate({ fit: { eles: cy.elements(":visible"), padding: 30 }, duration: 300 });
  };

  const related = (kinds: EdgeKind[], dir: "in" | "out" | "both") => {
    const cy = cyRef.current;
    if (!cy || !selectedId) return [];
    const node = cy.getElementById(selectedId);
    const dirs = dir === "both" ? (["in", "out"] as const) : ([dir] as const);
    const seen = new Set<string>();
    const out: { id: string; label: string; via: string }[] = [];
    for (const d of dirs) {
      const edges = (d === "in" ? node.incomers("edge") : node.outgoers("edge"))
        .toArray()
        .filter((el): el is cytoscape.EdgeSingular => el.isEdge());
      for (const e of edges) {
        if (!kinds.includes(e.data("kind") as EdgeKind)) continue;
        const other = d === "in" ? e.source() : e.target();
        const key = other.id() + "|" + String(e.data("label"));
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          id: other.id(),
          label: String(other.data("label")),
          via: String(e.data("label") ?? ""),
        });
      }
    }
    return out;
  };

  const RelList = ({ head, items }: { head: string; items: ReturnType<typeof related> }) =>
    items.length === 0 ? null : (
      <div className={styles.rel}>
        <p className={styles.relHead}>{head}</p>
        <ul>
          {items.map((x) => (
            <li key={x.id + head}>
              <button type="button" onClick={() => setSelectedId(x.id)}>
                {x.label} {x.via ? <em>({x.via})</em> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>Content map</h1>
          <p className={styles.lede}>
            One graph, four areas (the tinted boxes). No decision tree — dashed{" "}
            <b style={{ color: EDGE_COLOR.showIf }}>showIf</b> edges only change what the parent is
            asked; solid <b style={{ color: EDGE_COLOR.supports }}>green</b> edges score a diagnosis.
            Turn on <b style={{ color: EDGE_COLOR.link }}>distinguish / alongside</b> to see the links
            between areas. Click a node to trace just its connections.
          </p>
        </div>
        <button type="button" className={styles.fit} onClick={fit}>
          Fit
        </button>
      </div>

      <div className={styles.filters}>
        {model.areas.map((a) => (
          <button
            key={a.id}
            type="button"
            className={styles.chip}
            data-on={areasOn.has(a.id)}
            style={{ "--chip": areaColor(a.id) } as CSSProperties}
            onClick={() => setAreasOn((s) => toggle(s, a.id))}
          >
            {a.label}
          </button>
        ))}
        <span className={styles.sep} />
        {EDGE_FILTERS.map((f) => (
          <button
            key={f.kind}
            type="button"
            className={styles.chip}
            data-on={edgesOn.has(f.kind)}
            style={{ "--chip": EDGE_COLOR[f.kind] } as CSSProperties}
            onClick={() => setEdgesOn((s) => toggle(s, f.kind))}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>Couldn't draw the map: {error}</p>}

      <div className={styles.canvasWrap}>
        <div ref={containerRef} className={styles.canvas} />
        {!ready && !error && <p className={styles.loading}>Building the graph…</p>}

        {selected && (
          <aside className={styles.panel}>
            <button
              type="button"
              className={styles.close}
              onClick={() => setSelectedId(null)}
              aria-label="Close"
            >
              ×
            </button>
            <p className={styles.kind} style={{ color: areaColor(selected.area) }}>
              {selected.kind.replace("-", " ")} ·{" "}
              {model.areas.find((a) => a.id === selected.area)?.label ?? selected.area}
            </p>
            <h2 className={styles.panelName}>{selected.label}</h2>
            {selected.detail && <p className={styles.detail}>{selected.detail}</p>}
            <RelList head="Supported by" items={related(["supports"], "in")} />
            <RelList head="Argued against by" items={related(["against"], "in")} />
            <RelList head="Ruled out by" items={related(["excludes"], "in")} />
            <RelList head="Feeds into" items={related(["supports", "against", "excludes"], "out")} />
            <RelList head="Gated by" items={related(["showIf"], "in")} />
            <RelList head="Gates" items={related(["showIf"], "out")} />
            <RelList head="Related diagnoses" items={related(["link"], "both")} />
          </aside>
        )}
      </div>

      <div className={styles.statline}>
        {stats.map((s) => (
          <span key={s.id}>
            <b style={{ color: areaColor(s.id) }}>{s.label}</b> — {s.screens} screening · {s.questions}{" "}
            questions · {s.diagnoses} diagnoses
          </span>
        ))}
      </div>
    </section>
  );
}
