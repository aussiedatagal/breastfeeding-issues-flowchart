import { parse } from "yaml";
import { buildContent, type BuildInput, type BuildResult } from "./build.ts";

/** `path` is relative to /content, e.g. "map.yaml" or "questions/pain.yaml".
 *  Shared by the Vite loader and scripts/validate-content.mjs. */
export function assembleInput(files: Record<string, string>): BuildInput {
  const questions: unknown[] = [];
  const diagnoses: unknown[] = [];
  const references: unknown[] = [];
  let meta: unknown = undefined;

  for (const [path, textContent] of Object.entries(files)) {
    const doc = parse(textContent) as unknown;
    if (path === "map.yaml") meta = doc;
    else if (path === "references.yaml" && Array.isArray(doc)) references.push(...doc);
    else if (path.startsWith("questions/") && Array.isArray(doc)) questions.push(...doc);
    else if (path.startsWith("diagnoses/") && Array.isArray(doc)) diagnoses.push(...doc);
  }
  return { meta, questions, diagnoses, references };
}

export function buildFromFiles(files: Record<string, string>): BuildResult {
  return buildContent(assembleInput(files));
}

/** Eager-load every YAML file under /content at build time (Vite only). */
export function loadContentFiles(): Record<string, string> {
  const modules = import.meta.glob("/content/**/*.yaml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const files: Record<string, string> = {};
  for (const [absPath, textContent] of Object.entries(modules)) {
    files[absPath.replace("/content/", "")] = textContent;
  }
  return files;
}
