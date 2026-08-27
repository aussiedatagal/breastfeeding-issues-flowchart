/**
 * One-off migration: pull the decision graph out of the old single-file
 * prototype (legacy/breastfeeding-diagnostic-map.html) and emit the flat,
 * grouped YAML content files the React app reads.
 *
 * Run once:  node scripts/extract-legacy.mjs
 * After that the YAML in content/ is the source of truth and this script
 * can be deleted.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "legacy/breastfeeding-diagnostic-map.html"), "utf8");
const script = html.split("<script>")[1].split("</script>")[0];

// The prototype declares `const T = {...}` and `const EXTRA = {...}`.
const grab = (name) => {
  const m = script.match(new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});`));
  if (!m) throw new Error(`could not find ${name}`);
  return m[1];
};
const T = (0, eval)("(" + grab("T") + ")");
const EXTRA = (0, eval)("(" + grab("EXTRA") + ")");

const FLAG = { red: "do-not-miss", green: "likely-normal", amber: "often-mislabelled" };

/** which content file each node belongs in */
const GROUP = {
  q1: "intake",
  a1: "transfer", a1b: "transfer", a2: "transfer", a3: "transfer",
  a4: "transfer", a5: "transfer", a6: "transfer", a6b: "transfer",
  a7: "production", a8: "production", a9: "production",
  a10: "production", a11: "production", a12: "production",
  b1: "pain", b2: "inflammation", b3: "refusal", b4: "supply-worry", b5: "supply-worry",
};
for (let i = 1; i <= 11; i++) GROUP["pain" + i] = "pain";
for (let i = 1; i <= 10; i++) GROUP["inf" + i] = "inflammation";
for (let i = 1; i <= 8; i++) GROUP["ref" + i] = "refusal";

const dxGroup = (id) => {
  if (id.startsWith("dx-igt") || id.startsWith("dx-lac2") || id.startsWith("dx-second") ||
      id.startsWith("dx-surg") || id.startsWith("dx-endo") || id.startsWith("dx-idio")) return "production";
  if (id.startsWith("dx-position") || id.startsWith("dx-oral") || id.startsWith("dx-suck") ||
      id.startsWith("dx-cardio") || id.startsWith("dx-barrier") || id.startsWith("dx-transfer") ||
      id.startsWith("dx-oald-a")) return "transfer";
  if (id.startsWith("dx-latchpain") || id.startsWith("dx-hsv") || id.startsWith("dx-trauma") ||
      id.startsWith("dx-derm") || id.startsWith("dx-paget") || id.startsWith("dx-bleb") ||
      id.startsWith("dx-raynaud") || id.startsWith("dx-dmer") || id.startsWith("dx-deeppain")) return "pain";
  if (id.startsWith("dx-engorge") || id.startsWith("dx-plug") || id.startsWith("dx-inflammatory") ||
      id.startsWith("dx-bacterial") || id.startsWith("dx-phlegmon") || id.startsWith("dx-abscess") ||
      id.startsWith("dx-galac") || id.startsWith("dx-recur") || id.startsWith("dx-ibc") ||
      id.startsWith("dx-lump")) return "inflammation";
  if (id.startsWith("dx-strike") || id.startsWith("dx-painrefuse") || id.startsWith("dx-fastflow") ||
      id.startsWith("dx-distract") || id.startsWith("dx-teat") || id.startsWith("dx-aversion") ||
      id.startsWith("dx-slowflow") || id.startsWith("dx-refuse")) return "refusal";
  if (id.startsWith("dx-perc") || id.startsWith("dx-clarify")) return "supply-worry";
  return "reference";
};

const questions = {};
const diagnoses = {};

const edgeTarget = (spec) => (spec.goto ? { goto: spec.goto } : spec.id);

function walk(spec) {
  if (!spec || spec.goto) return;
  if (spec.dx) {
    const g = dxGroup(spec.id);
    (diagnoses[g] ??= []).push(diagnosis(spec));
    return;
  }
  // question
  const g = GROUP[spec.id] ?? "misc";
  const q = { id: spec.id, ask: spec.q };
  if (spec.short) q.short = spec.short;
  if (spec.help) q.assess = spec.help;
  q.ifYes = edgeTarget(spec.yes);
  q.ifNo = edgeTarget(spec.no);
  (questions[g] ??= []).push(q);
  walk(spec.yes);
  walk(spec.no);
}

function diagnosis(spec) {
  const d = spec.detail || {};
  const out = { id: spec.id, name: spec.dx || spec.label };
  if (FLAG[spec.tag]) out.flag = FLAG[spec.tag];
  if (d.note) out.note = d.note;
  if (d.clue?.length) out.points = d.clue;
  if (d.step?.length) out.steps = d.step;
  if (d.also?.length) out.seeAlso = d.also;
  return out;
}

walk(T);
for (const spec of Object.values(EXTRA)) {
  (diagnoses.reference ??= []).push({ ...diagnosis(spec), reference: true });
}

// ---- write files ----
const write = (rel, obj) => {
  const path = resolve(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringify(obj, { lineWidth: 96 }));
  console.log("wrote", rel);
};

write("content/map.yaml", {
  title: "Breastfeeding Difficulty",
  subtitle: "A binary decision graph — diagnoses the breastfeeding problem, not the infant's clinical care.",
  entry: T.id,
});
for (const [g, list] of Object.entries(questions)) write(`content/questions/${g}.yaml`, list);
for (const [g, list] of Object.entries(diagnoses)) write(`content/diagnoses/${g}.yaml`, list);

console.log(`\n${Object.values(questions).flat().length} questions, ${Object.values(diagnoses).flat().length} diagnoses`);
