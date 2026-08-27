import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import { computeLayout } from "./layout.ts";
import { answer, collapse, expandAll, initialOpen, pathTo } from "./traversal.ts";
import { isQuestion, isReference } from "./types.ts";

const contentDir = resolve(__dirname, "../../content");

function readContent(dir = contentDir): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) Object.assign(out, readContent(full));
    else if (name.endsWith(".yaml"))
      out[relative(contentDir, full).replaceAll("\\", "/")] = readFileSync(full, "utf8");
  }
  return out;
}

const { graph, errors } = buildFromFiles(readContent());

describe("content graph", () => {
  it("builds without errors", () => {
    expect(errors).toEqual([]);
    expect(graph).toBeDefined();
  });

  it("reaches every non-reference diagnosis by walking yes/no", () => {
    if (!graph) throw new Error("no graph");
    const diagnoses = [...graph.nodes.values()].filter(
      (n) => n.kind === "diagnosis" && !n.reference,
    );
    for (const dx of diagnoses) {
      let open = initialOpen(graph);
      const steps = pathTo(graph, dx.id);
      expect(steps.length).toBeGreaterThan(0);
      let selectedId = graph.entry;
      for (const step of steps) {
        ({ open, selectedId } = answer(graph, open, step.question.id, step.answer));
      }
      expect(selectedId).toBe(dx.id);
    }
  });

  it("collapse removes the downstream branch", () => {
    if (!graph) throw new Error("no graph");
    const entry = graph.nodes.get(graph.entry);
    if (!entry || !isQuestion(entry)) throw new Error("entry not a question");
    let { open } = answer(graph, initialOpen(graph), entry.id, "no");
    const childId = entry.edges.no.to;
    expect(open.has(childId)).toBe(true);
    ({ open } = collapse(graph, open, entry.id, "no"));
    expect(open.has(childId)).toBe(false);
  });

  it("expandAll places every node once; stubs left are merge jumps only", () => {
    if (!graph) throw new Error("no graph");
    const layout = computeLayout(graph, expandAll(graph));
    const nodePlacements = layout.placements.filter((p) => p.kind !== "stub");
    const ids = nodePlacements.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);

    const placedNodeIds = new Set(ids);
    for (const node of graph.nodes.values()) {
      if (!isReference(node) && node.depth >= 0) expect(placedNodeIds.has(node.id)).toBe(true);
    }

    const stubs = layout.placements.filter((p) => p.kind === "stub");
    expect(stubs.every((s) => s.merge)).toBe(true);
  });
});
