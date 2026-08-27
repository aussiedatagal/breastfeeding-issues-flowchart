/**
 * Integration checks against the real /content: every diagnosis must be
 * reachable as a symptom profile, and answering an area's whole question set
 * one way or another must always surface a best match.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import { isDiagnosis } from "../graph/types.ts";
import { buildProfiles, areaQuestionOrder } from "./profiles.ts";
import { rankMatches } from "./score.ts";

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

  it("every non-reference diagnosis has at least one symptom profile", () => {
    if (!graph) throw new Error("no graph");
    const profiled = new Set(buildProfiles(graph).map((p) => p.diagnosisId));
    const missing = [...graph.nodes.values()]
      .filter((n) => isDiagnosis(n) && !n.reference)
      .filter((n) => !profiled.has(n.id))
      .map((n) => n.id);
    expect(missing).toEqual([]);
  });

  it("answering an area produces a coherent ranking with a clear best match", () => {
    if (!graph) throw new Error("no graph");
    const profiles = buildProfiles(graph);

    for (const area of graph.domains) {
      const questions = areaQuestionOrder(graph, profiles, area.id);
      expect(questions.length).toBeGreaterThan(0);

      // answer every question of the area "no", then check the ranking holds up
      const answers = Object.fromEntries(questions.map((q) => [q.id, "no" as const]));
      const ranked = rankMatches(graph, profiles, area.id, answers);
      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked[ranked.length - 1]!.score);
      // the top match for an all-"no" walk should not itself be contradicted
      expect(ranked[0]!.conflicting).toHaveLength(0);
    }
  });
});
