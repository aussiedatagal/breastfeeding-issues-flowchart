/**
 * Checks everything under /content against the same rules the app uses.
 * Run by `npm run validate` (part of `npm run build`) and in CI.
 *
 *   node scripts/validate-content.mjs
 *
 * Exit code 1 on any error; warnings never fail the build.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFromFiles } from "../src/content/load.ts";

const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), "../content");

/** @returns {Record<string, string>} path-relative-to-/content → file text */
function readAllYaml(dir) {
  const files = {};
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      Object.assign(files, readAllYaml(full));
    } else if (name.endsWith(".yaml") || name.endsWith(".yml")) {
      files[relative(contentDir, full).replaceAll("\\", "/")] = readFileSync(full, "utf8");
    }
  }
  return files;
}

const { content, errors, warnings } = buildFromFiles(readAllYaml(contentDir));

for (const w of warnings) console.warn(`  warning  ${w}`);
for (const e of errors) console.error(`  error    ${e}`);

if (errors.length || !content) {
  console.error(`\n${errors.length} error(s) — content is not valid.`);
  process.exit(1);
}

const questions = content.questions.length;
const diagnoses = content.diagnoses.filter((d) => !d.reference).length;
const reference = content.diagnoses.filter((d) => d.reference).length;
console.log(
  `content ok — ${questions} questions, ${diagnoses} diagnoses, ${reference} reference nodes, ` +
    `${content.references.length} sources` +
    (warnings.length ? `, ${warnings.length} warning(s)` : ""),
);
