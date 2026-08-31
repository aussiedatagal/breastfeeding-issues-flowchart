/**
 * Standalone HTML of the whole content graph — the same model the in-app Map
 * view uses, rendered with Cytoscape (loaded from a CDN).
 *
 *   node scripts/content-map.mjs [out.html]     (default: content-map.html)
 *
 * Writes `<out>` (opens in a browser) and `<out>.artifact.html` (body only, for
 * publishing as an Artifact — Cytoscape still loads from the CDN there).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFromFiles } from "../src/content/load.ts";
import { buildGraph, graphStats } from "../src/content/graph.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentDir = resolve(root, "content");
const outPath = resolve(root, process.argv[2] ?? "content-map.html");

function readAllYaml(dir) {
  const files = {};
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) Object.assign(files, readAllYaml(full));
    else if (name.endsWith(".yaml") || name.endsWith(".yml"))
      files[relative(contentDir, full).replaceAll("\\", "/")] = readFileSync(full, "utf8");
  }
  return files;
}

const { content, errors } = buildFromFiles(readAllYaml(contentDir));
if (!content) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const model = buildGraph(content);
const stats = graphStats(content);

const AREA_COLOR = { supply: "#35786a", pain: "#b1503d", inflammation: "#9a7328", refusal: "#4c7d57" };
const EDGE_COLOR = {
  flow: "#c2b79f",
  showIf: "#8a7f6a",
  supports: "#35786a",
  against: "#b1503d",
  excludes: "#8a1c1c",
  link: "#7a6fa8",
};

const elements = [
  ...model.nodes.map((n) => ({ data: { ...n, color: AREA_COLOR[n.area] ?? "#6b6252" } })),
  ...model.edges.map((e) => ({ data: { ...e, ecolor: EDGE_COLOR[e.kind] } })),
];

const statLine = stats
  .map(
    (s) =>
      `<span><b style="color:${AREA_COLOR[s.id]}">${s.label}</b> — ${s.screens} screening · ${s.questions} questions · ${s.diagnoses} diagnoses</span>`,
  )
  .join("");

const css = `
  :root { --bg:#f5efe4; --ink:#322c23; --muted:#6b6252; --hair:#e3dac6; --surface:#fbf7ee;
    --sans:"IBM Plex Sans",system-ui,sans-serif; --disp:"Fraunces",Georgia,serif; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
    --bg:#211d16; --ink:#ece4d4; --muted:#b3a992; --hair:#3b352a; --surface:#2a251d; } }
  :root[data-theme="dark"] { --bg:#211d16; --ink:#ece4d4; --muted:#b3a992; --hair:#3b352a; --surface:#2a251d; }
  * { box-sizing:border-box; } body { margin:0; background:var(--bg); color:var(--ink); font-family:var(--sans); }
  .wrap { max-width:74rem; margin:0 auto; padding:2rem 1.25rem 3rem; }
  h1 { font-family:var(--disp); font-weight:500; font-size:2rem; margin:0 0 .3rem; }
  .lede { color:var(--muted); max-width:46rem; margin:0 0 1.2rem; line-height:1.6; font-size:.92rem; }
  #cy { height:78vh; border:1px solid var(--hair); border-radius:12px; background:#f3ecdd; }
  .stats { display:flex; flex-wrap:wrap; gap:1.2rem; margin-top:1rem; font-size:.78rem; color:var(--muted); }
  .legend { display:flex; flex-wrap:wrap; gap:1rem; margin:.8rem 0; font-size:.78rem; color:var(--muted); }
  .legend i { font-style:normal; }
`;

const body = `
<div class="wrap">
  <h1>Content map</h1>
  <p class="lede">Every question and diagnosis across all four areas, as one graph. There is
    <strong>no decision tree</strong>: dashed <i style="color:${EDGE_COLOR.showIf}">showIf</i> edges
    only change what the parent is asked; solid <i style="color:${EDGE_COLOR.supports}">green</i>
    edges score a diagnosis; dotted <i style="color:${EDGE_COLOR.link}">violet</i> edges (thicker
    across areas) are “distinguish from” / “occurs alongside”. Drag to pan, scroll to zoom, click a
    node to trace it.</p>
  <div class="legend">
    <i style="color:${AREA_COLOR.supply}">● supply</i>
    <i style="color:${AREA_COLOR.pain}">● pain</i>
    <i style="color:${AREA_COLOR.inflammation}">● inflammation</i>
    <i style="color:${AREA_COLOR.refusal}">● refusal</i>
    &nbsp; ☑ = multi-select · dashed border = do-not-miss · dashed node = reference note
  </div>
  <div id="cy"></div>
  <div class="stats">${statLine}</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/cytoscape@3/dist/cytoscape.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/layout-base@2/layout-base.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cose-base@2/cose-base.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cytoscape-fcose@2/cytoscape-fcose.js"></script>
<script>
  const ELEMENTS = ${JSON.stringify(elements)};
  if (window.cytoscape && window.cytoscapeFcose) {
    cytoscape.use(window.cytoscapeFcose);
    cytoscape({
      container: document.getElementById("cy"),
      elements: ELEMENTS,
      wheelSensitivity: 0.25,
      minZoom: 0.1, maxZoom: 2.5,
      layout: { name: "fcose", quality: "proof", animate: false, randomize: true,
        nodeSeparation: 110, idealEdgeLength: 95, nodeRepulsion: 9000, packComponents: true },
      style: [
        { selector: "node", style: { label: "data(label)", "font-size": 11, "font-family": "IBM Plex Sans, sans-serif",
          color: "#2b2620", "text-wrap": "wrap", "text-max-width": "180px", "text-valign": "center", "text-halign": "center",
          "background-color": "#fbf7ee", "border-width": 1.5, "border-color": "data(color)", shape: "round-rectangle",
          width: "label", height: "label", padding: "10px" } },
        { selector: 'node[kind="screen"]', style: { "background-color": "#ece1cb", "font-weight": 600 } },
        { selector: 'node[kind="multi"]', style: { "border-style": "double", "border-width": 4 } },
        { selector: 'node[kind="diagnosis"],node[kind="do-not-miss"],node[kind="fallback"],node[kind="reference"]',
          style: { "background-color": "#e7efe9", "font-weight": 600 } },
        { selector: 'node[kind="do-not-miss"]', style: { "background-color": "#f6e2dc", "border-width": 3 } },
        { selector: 'node[kind="fallback"]', style: { "background-color": "#efeadd", "font-style": "italic" } },
        { selector: 'node[kind="reference"]', style: { "background-color": "#efeae2", "border-style": "dashed" } },
        { selector: "edge", style: { width: 1.5, "line-color": "data(ecolor)", "target-arrow-color": "data(ecolor)",
          "target-arrow-shape": "triangle", "arrow-scale": 0.9, "curve-style": "bezier", label: "data(label)",
          "font-size": 9, color: "#6b6252", "text-background-color": "#f5efe4", "text-background-opacity": 0.85,
          "text-background-padding": "2px" } },
        { selector: 'edge[kind="showIf"]', style: { "line-style": "dashed", width: 2 } },
        { selector: 'edge[kind="supports"]', style: { width: 2.5 } },
        { selector: 'edge[kind="against"]', style: { "line-style": "dashed" } },
        { selector: 'edge[kind="excludes"]', style: { width: 4 } },
        { selector: 'edge[kind="link"]', style: { "line-style": "dotted", width: 2, "target-arrow-shape": "vee" } },
        { selector: "edge[?cross]", style: { width: 3.5 } },
        { selector: ".faded", style: { opacity: 0.1, "text-opacity": 0.1 } },
      ],
    }).on("tap", "node", function (ev) {
      const cy = ev.cy, n = ev.target;
      cy.elements().removeClass("faded");
      cy.elements().not(n.closedNeighborhood()).addClass("faded");
    }).on("tap", function (ev) { if (ev.target === ev.cy) ev.cy.elements().removeClass("faded"); });
  }
</script>
`;

writeFileSync(
  outPath,
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Breastfeeding Content Map</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${css}</style></head><body>${body}</body></html>
`,
);
writeFileSync(
  outPath.replace(/\.html$/, ".artifact.html"),
  `<title>Breastfeeding Content Map</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${css}</style>${body}`,
);
console.log(
  `wrote ${relative(root, outPath)} — ${model.nodes.length} nodes, ${model.edges.length} edges`,
);
