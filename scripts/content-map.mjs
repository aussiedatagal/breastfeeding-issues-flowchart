/**
 * Generates a single-page overview of all the content — every screening and
 * detail question, how questions gate each other (`showIf`), and how each
 * finding feeds the diagnoses (supports / argues-against / rules-out).
 *
 *   node scripts/content-map.mjs [out.html]     (default: content-map.html)
 *
 * There is no decision tree — this is a DAG of question-gating plus a
 * finding → diagnosis scoring graph, drawn per problem area with Mermaid.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFromFiles } from "../src/content/load.ts";

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

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** mermaid node/edge text: safe inside a "quoted" label */
const mText = (s) =>
  String(s)
    .replace(/["]/g, "'")
    .replace(/[[\]{}()|<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const nid = (prefix, id) => `${prefix}_${id.replace(/[^a-zA-Z0-9]/g, "_")}`;
const shortOf = (q) =>
  q.type === "boolean"
    ? (content.finding.get(q.id)?.short ?? q.ask)
    : `${q.ask} — ${q.options.map((o) => content.finding.get(o.finding)?.short ?? o.label).join(" · ")}`;

/** which question a finding id belongs to, and (for multi) the option label */
const findingInfo = (fid) => {
  const f = content.finding.get(fid);
  if (!f) return { qid: fid, label: fid, isOption: false };
  const q = content.question.get(f.questionId);
  const opt = q?.options.find((o) => o.finding === fid);
  return { qid: f.questionId, label: opt?.short ?? f.short, isOption: q?.type === "multi" };
};

function areaDiagram(area) {
  const qs = content.questions.filter((q) => q.area === area.id);
  const dxs = content.diagnoses.filter((d) => d.area === area.id && !d.reference);

  const lines = ["flowchart LR"];
  const linkStyles = [];
  let link = 0;

  const scr = nid("scr", area.id);
  lines.push(`  ${scr}["SCREEN IN · ${mText(area.screens.join("  /  "))}"]:::screen`);

  for (const q of qs) {
    const tag = q.type === "multi" ? " ☑" : "";
    lines.push(`  ${nid("q", q.id)}["${mText(q.id + tag + " — " + clip(shortOf(q), 90))}"]:::q`);
  }
  if (qs[0]) {
    lines.push(`  ${scr} --> ${nid("q", qs[0].id)}`);
    linkStyles.push(`  linkStyle ${link++} stroke:#b9ad97,stroke-width:1px`);
  }

  // showIf edges — the actual question-gating DAG
  for (const q of qs) {
    for (const c of q.showIf) {
      const parent = content.finding.get(c.finding)?.questionId ?? c.finding;
      lines.push(
        `  ${nid("q", parent)} -. "only if ${c.is === "present" ? "yes" : "no"}" .-> ${nid("q", q.id)}`,
      );
      linkStyles.push(`  linkStyle ${link++} stroke:#8a7f6a,stroke-width:1.5px,stroke-dasharray:4 3`);
    }
  }

  for (const d of dxs) {
    const dn = nid("d", d.id);
    const cls = d.flag === "do-not-miss" ? "dxDanger" : d.supports.length === 0 ? "dxFallback" : "dx";
    lines.push(`  ${dn}["${mText(clip(d.name, 60))}"]:::${cls}`);

    for (const s of d.supports) {
      const { qid, label, isOption } = findingInfo(s.finding);
      lines.push(
        `  ${nid("q", qid)} ==>|"${mText((isOption ? label + " · " : "") + "w" + s.weight)}"| ${dn}`,
      );
      linkStyles.push(`  linkStyle ${link++} stroke:#35786a,stroke-width:2px`);
    }
    // only the deliberately-weighted against edges (weight ≥ 2) — the migration
    // left many weight-1 "not this branch" edges that would swamp the picture
    for (const a of d.against.filter((x) => x.weight >= 2)) {
      const { qid, label, isOption } = findingInfo(a.finding);
      lines.push(
        `  ${nid("q", qid)} -.->|"${mText((isOption ? label + " · " : "") + "against")}"| ${dn}`,
      );
      linkStyles.push(`  linkStyle ${link++} stroke:#b1503d,stroke-width:1.5px,stroke-dasharray:5 4`);
    }
    for (const e of d.excludes) {
      const { qid } = findingInfo(e.finding);
      lines.push(`  ${nid("q", qid)} ==>|"RULES OUT if ${e.when}"| ${dn}`);
      linkStyles.push(`  linkStyle ${link++} stroke:#8a1c1c,stroke-width:4px`);
    }
  }

  lines.push("  classDef screen fill:#e7dfcc,stroke:#b9ad97,color:#3a3222,font-weight:bold");
  lines.push("  classDef q fill:#fbf7ee,stroke:#c9bfa6,color:#322c23");
  lines.push("  classDef dx fill:#e2efe9,stroke:#35786a,color:#1f4a41,font-weight:bold");
  lines.push("  classDef dxDanger fill:#f5e0da,stroke:#b1503d,color:#7c2d1c,font-weight:bold");
  lines.push("  classDef dxFallback fill:#efeadd,stroke:#a99a78,color:#5a5038,font-style:italic");
  lines.push(...linkStyles);
  return lines.join("\n");
}

const areaSections = content.areas
  .map((a) => {
    const qCount = content.questions.filter((q) => q.area === a.id).length;
    const dCount = content.diagnoses.filter((d) => d.area === a.id && !d.reference).length;
    return `
    <section class="area">
      <h2 id="${a.id}">${esc(a.short ?? a.label)}</h2>
      <p class="meta">${a.screens.length} screening question${a.screens.length === 1 ? "" : "s"}
        · ${qCount} detail questions · ${dCount} diagnoses</p>
      <div class="scroll"><pre class="mermaid">${esc(areaDiagram(a))}</pre></div>
    </section>`;
  })
  .join("\n");

const refs = content.diagnoses
  .filter((d) => d.reference)
  .map((d) => `<li><strong>${esc(d.name)}</strong> — shown only via “see also” / “occurs alongside”.</li>`)
  .join("\n");

const totalQ = content.questions.length;
const totalScreens = content.areas.reduce((n, a) => n + a.screens.length, 0);
const totalDx = content.diagnoses.filter((d) => !d.reference).length;

const fontLink = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">`;

const css = `
  :root {
    --bg:#f5efe4; --surface:#fbf7ee; --ink:#322c23; --ink-muted:#6b6252; --ink-faint:#8a8069;
    --hairline:#e3dac6; --accent:#35786a; --clay:#b1503d;
    --font-display:"Fraunces",Georgia,serif; --font-sans:"IBM Plex Sans",system-ui,sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --bg:#211d16; --surface:#2a251d; --ink:#ece4d4; --ink-muted:#b3a992; --ink-faint:#8a7f6a;
      --hairline:#3b352a; --accent:#68b7a5; --clay:#d98b78;
    }
  }
  :root[data-theme="dark"] {
    --bg:#211d16; --surface:#2a251d; --ink:#ece4d4; --ink-muted:#b3a992; --ink-faint:#8a7f6a;
    --hairline:#3b352a; --accent:#68b7a5; --clay:#d98b78;
  }
  * { box-sizing:border-box; }
  body {
    margin:0; background:var(--bg); color:var(--ink);
    font-family:var(--font-sans); line-height:1.55;
    padding:2.5rem 1.25rem 5rem;
  }
  .wrap { max-width:70rem; margin:0 auto; }
  h1 { font-family:var(--font-display); font-weight:500; font-size:2.2rem; margin:0 0 .4rem; }
  .lede { color:var(--ink-muted); max-width:42rem; margin:0 0 1.5rem; }
  .counts { display:flex; gap:1.5rem; flex-wrap:wrap; margin:0 0 2rem; padding:1rem 0; border-top:1px solid var(--hairline); border-bottom:1px solid var(--hairline); }
  .counts b { font-family:var(--font-display); font-size:1.5rem; font-weight:500; display:block; }
  .counts span { font-size:.8rem; color:var(--ink-faint); text-transform:uppercase; letter-spacing:.05em; }
  nav { margin:0 0 2rem; font-size:.9rem; }
  nav a { color:var(--accent); text-decoration:none; margin-right:1rem; }
  nav a:hover { text-decoration:underline; }
  .legend { display:flex; gap:1.25rem; flex-wrap:wrap; font-size:.82rem; color:var(--ink-muted); margin:0 0 2rem; }
  .legend i { font-style:normal; display:inline-flex; align-items:center; gap:.4rem; }
  .swatch { width:26px; height:0; border-top-width:3px; border-top-style:solid; display:inline-block; }
  section.area { margin:0 0 3rem; }
  h2 { font-family:var(--font-display); font-weight:500; font-size:1.5rem; margin:0 0 .2rem; }
  .meta { font-size:.85rem; color:var(--ink-faint); margin:0 0 1rem; }
  .scroll { overflow-x:auto; background:var(--surface); border:1px solid var(--hairline); border-radius:12px; padding:1rem; }
  .mermaid { min-width:640px; }
  footer { margin-top:3rem; padding-top:1.5rem; border-top:1px solid var(--hairline); font-size:.85rem; color:var(--ink-faint); }
  footer ul { margin:.5rem 0 0; padding-left:1.1rem; }
`;

const bodyInner = `
<div class="wrap">
  <h1>Content map</h1>
  <p class="lede">Every question and diagnosis in the tool. There is <strong>no decision tree</strong>:
    questions can gate each other for the parent's flow (<code>showIf</code>, dotted grey), but every
    diagnosis is scored independently against the findings. Nothing is removed unless a hard
    “rules out” rule fires.</p>

  <div class="counts">
    <div><b>${totalScreens}</b><span>screening questions</span></div>
    <div><b>${totalQ}</b><span>detail questions</span></div>
    <div><b>${totalDx}</b><span>diagnoses</span></div>
    <div><b>${content.areas.length}</b><span>problem areas</span></div>
  </div>

  <nav>${content.areas.map((a) => `<a href="#${a.id}">${esc(a.short ?? a.label)}</a>`).join("")}</nav>

  <div class="legend">
    <i><span class="swatch" style="border-color:#35786a"></span> supports (with weight 1–5)</i>
    <i><span class="swatch" style="border-color:#b1503d;border-top-style:dashed"></span> argues against (weight ≥ 2 only)</i>
    <i><span class="swatch" style="border-color:#8a1c1c;border-top-width:4px"></span> rules out</i>
    <i><span class="swatch" style="border-color:#8a7f6a;border-top-style:dotted"></span> showIf gate · ☑ = multi-select</i>
  </div>

  ${areaSections}

  <footer>
    <strong>Reference notes</strong> (never scored):
    <ul>${refs}</ul>
    Generated from <code>/content</code> by <code>npm run map</code>.
  </footer>
</div>
`;

/** standalone file — opens in a browser; pulls Mermaid from a CDN */
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Breastfeeding Content Map</title>
${fontLink}
<style>${css}</style>
</head>
<body>
${bodyInner}
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  if (window.mermaid) window.mermaid.initialize({ startOnLoad: true, securityLevel: "loose", theme: "base", flowchart: { curve: "basis" } });
</script>
</body>
</html>
`;

/** body-only file for publishing as an Artifact (Mermaid renders natively there) */
const artifact = `<title>Breastfeeding Content Map</title>
${fontLink}
<style>${css}</style>
${bodyInner}`;

writeFileSync(outPath, standalone);
const artifactPath = outPath.replace(/\.html$/, ".artifact.html");
writeFileSync(artifactPath, artifact);
console.log(
  `wrote ${relative(root, outPath)} and ${relative(root, artifactPath)} — ${totalQ} questions, ${totalDx} diagnoses`,
);
