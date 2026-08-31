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
  flow: "#c2b79f",
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
const ALL_EDGES: EdgeKind[] = ["flow", "showIf", "supports", "against", "excludes", "link"];

const LAYOUT = {
  name: "fcose",
  quality: "proof",
  animate: false,
  randomize: true,
  nodeSeparation: 110,
  idealEdgeLength: 95,
  nodeRepulsion: 9000,
  gravity: 0.2,
  packComponents: true,
} as const;

/** force-directed layout of whatever is visible, then fit */
function relayout(cy: cytoscape.Core) {
  const visible = cy.elements(":visible");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fcose opts aren't typed
  const l = visible.layout({ ...LAYOUT } as any);
  l.one("layoutstop", () => cy.fit(visible, 40));
  l.run();
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
      "text-max-width": "180px",
      "text-valign": "center",
      "text-halign": "center",
      "background-color": "#fbf7ee",
      "border-width": 1.5,
      "border-color": "data(color)",
      shape: "round-rectangle",
      width: "label",
      height: "label",
      padding: "10px",
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
      width: 1.5,
      "line-color": "data(ecolor)",
      "target-arrow-color": "data(ecolor)",
      "target-arrow-shape": "triangle",
      "arrow-scale": 0.9,
      "curve-style": "bezier",
      label: "data(label)",
      "font-size": 9,
      "font-family": "IBM Plex Sans, system-ui, sans-serif",
      color: "#6b6252",
      "text-background-color": "#f5efe4",
      "text-background-opacity": 0.85,
      "text-background-padding": "2px",
    },
  },
  { selector: 'edge[kind = "showIf"]', style: { "line-style": "dashed", width: 2 } },
  { selector: 'edge[kind = "supports"]', style: { width: 2.5 } },
  { selector: 'edge[kind = "against"]', style: { "line-style": "dashed" } },
  { selector: 'edge[kind = "excludes"]', style: { width: 4 } },
  { selector: 'edge[kind = "link"]', style: { "line-style": "dotted", width: 2, "target-arrow-shape": "vee" } },
  { selector: "edge[?cross]", style: { width: 3.5 } },
  { selector: ".hidden", style: { display: "none" } },
  { selector: ".faded", style: { opacity: 0.1, "text-opacity": 0.1 } },
  { selector: ".pick", style: { "border-width": 4, "border-color": "#1f4a41", "background-color": "#d7ece4" } },
];
/* eslint-enable @typescript-eslint/no-explicit-any */

export function MapScreen({ content }: { content: Content }) {
  const model: GraphModel = useMemo(() => buildGraph(content), [content]);
  const stats = useMemo(() => graphStats(content), [content]);
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [areasOn, setAreasOn] = useState<Set<string>>(new Set(model.areas.map((a) => a.id)));
  // "against" edges are mostly weight-1 migration noise — start them hidden
  const [edgesOn, setEdgesOn] = useState<Set<EdgeKind>>(
    new Set(ALL_EDGES.filter((k) => k !== "against")),
  );
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
          wheelSensitivity: 0.25,
          minZoom: 0.1,
          maxZoom: 2.5,
        });
        cyRef.current = instance;
        instance.on("tap", "node", (ev) => setSelectedId(ev.target.id()));
        instance.on("tap", (ev) => {
          if (ev.target === instance) setSelectedId(null);
        });
        setReady(true);
        // the flex container settles a frame after mount — then lay out + fit
        setTimeout(() => {
          instance.resize();
          relayout(instance);
        }, 120);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [model]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.batch(() => {
      cy.nodes().forEach((n) => {
        n.toggleClass("hidden", !areasOn.has(n.data("area")));
      });
      cy.edges().forEach((e) => {
        const k = e.data("kind") as EdgeKind;
        e.toggleClass(
          "hidden",
          !edgesOn.has(k) || e.source().hasClass("hidden") || e.target().hasClass("hidden"),
        );
      });
    });
    relayout(cy);
  }, [ready, areasOn, edgesOn]);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.batch(() => {
      cy.elements().removeClass("faded pick");
      if (!selectedId) return;
      const node = cy.getElementById(selectedId);
      cy.elements().not(node.closedNeighborhood()).addClass("faded");
      node.addClass("pick");
    });
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
        out.push({ id: other.id(), label: String(other.data("label")), via: String(e.data("label") ?? "") });
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
            One graph, all four areas. No decision tree — dashed{" "}
            <b style={{ color: EDGE_COLOR.showIf }}>showIf</b> edges only change what the parent is
            asked; solid <b style={{ color: EDGE_COLOR.supports }}>green</b> edges score a diagnosis;
            dotted <b style={{ color: EDGE_COLOR.link }}>violet</b> edges (thicker across areas) are
            “distinguish from” / “occurs alongside”. Drag to pan, scroll to zoom, click any node.
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
            <RelList head="Feeds" items={related(["supports", "against", "excludes"], "out")} />
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
