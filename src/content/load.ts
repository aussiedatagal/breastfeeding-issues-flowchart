import { parse } from "yaml";
import { buildGraph, type BuildInput, type BuildResult } from "../graph/build.ts";

/**
 * `path` is relative to /content, e.g. "map.yaml" or "questions/pain.yaml".
 * Shared by the Vite loader (below) and scripts/validate-content.mjs so both
 * report identical problems.
 */
export function assembleInput(files: Record<string, string>): BuildInput {
  const questions: unknown[] = [];
  const diagnoses: unknown[] = [];
  let meta: unknown = undefined;

  for (const [path, text] of Object.entries(files)) {
    const doc = parse(text) as unknown;
    if (path === "map.yaml") {
      meta = doc;
    } else if (path.startsWith("questions/")) {
      if (Array.isArray(doc)) questions.push(...doc);
    } else if (path.startsWith("diagnoses/")) {
      if (Array.isArray(doc)) diagnoses.push(...doc);
    }
  }
  return { meta, questions, diagnoses };
}

export function buildFromFiles(files: Record<string, string>): BuildResult {
  return buildGraph(assembleInput(files));
}

/** Eager-load every YAML file under /content at build time (Vite only). */
export function loadContentFiles(): Record<string, string> {
  const modules = import.meta.glob("/content/**/*.yaml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  const files: Record<string, string> = {};
  for (const [absPath, text] of Object.entries(modules)) {
    files[absPath.replace("/content/", "")] = text;
  }
  return files;
}
