/**
 * Turn the content into a Mermaid `flowchart` per problem area — the screening
 * gate, every question with its `showIf` gates (the real DAG), and every
 * finding → diagnosis edge (supports / argues-against / rules-out).
 *
 * Framework-free. Used by the in-app Map view and by `scripts/content-map.mjs`.
 */
import type { Area, Content } from "./model.ts";

/** safe inside a "quoted" Mermaid label */
const mText = (s: string): string =>
  s
    .replace(/["]/g, "'")
    .replace(/[[\]{}()|<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

const nid = (prefix: string, id: string): string => `${prefix}_${id.replace(/[^a-zA-Z0-9]/g, "_")}`;

const shortOf = (content: Content, q: Content["questions"][number]): string =>
  q.type === "boolean"
    ? (content.finding.get(q.id)?.short ?? q.ask)
    : `${q.ask} — ${q.options
        .map((o) => content.finding.get(o.finding)?.short ?? o.label)
        .join(" · ")}`;

/** which question a finding belongs to, and (for multi) the option label */
function findingInfo(content: Content, fid: string) {
  const f = content.finding.get(fid);
  if (!f) return { qid: fid, label: fid, isOption: false };
  const q = content.question.get(f.questionId);
  return { qid: f.questionId, label: f.short, isOption: q?.type === "multi" };
}

export interface AreaDiagramMeta {
  screens: number;
  questions: number;
  diagnoses: number;
}

export function areaDiagramMeta(content: Content, area: Area): AreaDiagramMeta {
  return {
    screens: area.screens.length,
    questions: content.questions.filter((q) => q.area === area.id).length,
    diagnoses: content.diagnoses.filter((d) => d.area === area.id && !d.reference).length,
  };
}

/** the Mermaid source for one area's diagram */
export function areaDiagram(content: Content, area: Area): string {
  const qs = content.questions.filter((q) => q.area === area.id);
  const dxs = content.diagnoses.filter((d) => d.area === area.id && !d.reference);

  const lines: string[] = ["flowchart LR"];
  const linkStyles: string[] = [];
  let link = 0;

  const scr = nid("scr", area.id);
  lines.push(`  ${scr}["SCREEN IN · ${mText(area.screens.join("  /  "))}"]:::screen`);

  for (const q of qs) {
    const tag = q.type === "multi" ? " ☑" : "";
    lines.push(`  ${nid("q", q.id)}["${mText(q.id + tag + " — " + clip(shortOf(content, q), 90))}"]:::q`);
  }
  if (qs[0]) {
    lines.push(`  ${scr} --> ${nid("q", qs[0].id)}`);
    linkStyles.push(`  linkStyle ${link++} stroke:#b9ad97,stroke-width:1px`);
  }

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
      const { qid, label, isOption } = findingInfo(content, s.finding);
      lines.push(
        `  ${nid("q", qid)} ==>|"${mText((isOption ? label + " · " : "") + "w" + s.weight)}"| ${dn}`,
      );
      linkStyles.push(`  linkStyle ${link++} stroke:#35786a,stroke-width:2px`);
    }
    // only the deliberately-weighted against edges — the migration left many
    // weight-1 "not this branch" edges that would swamp the picture
    for (const a of d.against.filter((x) => x.weight >= 2)) {
      const { qid, label, isOption } = findingInfo(content, a.finding);
      lines.push(
        `  ${nid("q", qid)} -.->|"${mText((isOption ? label + " · " : "") + "against")}"| ${dn}`,
      );
      linkStyles.push(`  linkStyle ${link++} stroke:#b1503d,stroke-width:1.5px,stroke-dasharray:5 4`);
    }
    for (const e of d.excludes) {
      const { qid } = findingInfo(content, e.finding);
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
