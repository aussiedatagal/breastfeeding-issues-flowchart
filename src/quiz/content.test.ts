/**
 * Integration checks against the real /content: the quiz must be able to reach
 * every diagnosis, and a walk must always terminate.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import { isDiagnosis } from "../graph/types.ts";
import { reachableDiagnoses } from "./analysis.ts";
import { walk } from "./session.ts";

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

describe("content", () => {
  it("builds cleanly", () => {
    expect(errors).toEqual([]);
    expect(graph).toBeDefined();
  });

  it("every non-reference diagnosis is reachable from some area", () => {
    if (!graph) throw new Error("no graph");
    const reached = new Set<string>();
    for (const area of graph.domains) {
      for (const d of reachableDiagnoses(graph, area.entry)) reached.add(d.id);
    }
    const unreachable = [...graph.nodes.values()]
      .filter((n) => isDiagnosis(n) && !n.reference)
      .filter((n) => !reached.has(n.id))
      .map((n) => n.id);
    expect(unreachable).toEqual([]);
  });

  it("a walk down any branch combination terminates at a diagnosis", () => {
    if (!graph) throw new Error("no graph");
    for (const area of graph.domains) {
      // depth-first over every yes/no combination, capped
      const stack: ("yes" | "no")[][] = [[]];
      let visited = 0;
      while (stack.length && visited < 5000) {
        const answers = stack.pop()!;
        visited += 1;
        const route = walk(graph, area, answers);
        if (route.current.kind === "question" && answers.length < 40) {
          stack.push([...answers, "yes"], [...answers, "no"]);
        } else {
          expect(route.current.kind).toBe("diagnosis");
        }
      }
    }
  });
});
