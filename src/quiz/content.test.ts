/**
 * Integration checks against the real /content: it builds, every scored
 * diagnosis can actually rank, and answering an area's whole question set one
 * way still produces a coherent ordering.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import { questionsInArea } from "../content/model.ts";
import { questionFindings } from "./session.ts";
import { rankArea } from "./score.ts";

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

const { content, errors } = buildFromFiles(readContent());

/** deliberate diagnoses of exclusion — no positive findings of their own; the
 *  engine surfaces them as fallbacks (see score.ts) */
const DIAGNOSES_OF_EXCLUSION = new Set([
  "dx-plug",
  "dx-deeppain",
  "dx-refuse-unk",
  "dx-transfer-unk",
]);

describe("content", () => {
  it("builds cleanly", () => {
    expect(errors).toEqual([]);
    expect(content).toBeDefined();
  });

  it("every non-reference diagnosis either has supports or is a known diagnosis of exclusion", () => {
    if (!content) throw new Error("no content");
    const gaps = content.diagnoses
      .filter((d) => !d.reference && d.supports.length === 0)
      .map((d) => d.id)
      .filter((id) => !DIAGNOSES_OF_EXCLUSION.has(id));
    expect(gaps).toEqual([]);
  });

  it("a diagnosis of exclusion surfaces as a fallback, never ruled out by absence", () => {
    if (!content) throw new Error("no content");
    for (const id of DIAGNOSES_OF_EXCLUSION) {
      const d = content.diagnosis.get(id);
      if (!d) continue;
      const ranked = rankArea(content, d.area, {});
      const m = ranked.find((x) => x.diagnosis.id === id)!;
      expect(m.fallback).toBe(true);
      expect(m.tier).toBe("possible");
    }
  });

  it("supports and excludes reference findings that exist", () => {
    if (!content) throw new Error("no content");
    for (const d of content.diagnoses) {
      for (const s of [...d.supports, ...d.against, ...d.excludes]) {
        expect(content.finding.has(s.finding)).toBe(true);
      }
    }
  });

  it("answering a whole area 'present' still gives a coherent ranking", () => {
    if (!content) throw new Error("no content");
    for (const area of content.areas) {
      const qs = questionsInArea(content, area.id);
      expect(qs.length).toBeGreaterThan(0);

      const answers: Record<string, "present"> = {};
      for (const q of qs) for (const f of questionFindings(q)) answers[f] = "present";

      const ranked = rankArea(content, area.id, answers);
      expect(ranked.length).toBeGreaterThan(0);
      // sorted by score (ruled-out sinks to the back)
      const live = ranked.filter((m) => m.tier !== "ruled-out");
      for (let i = 1; i < live.length; i += 1) {
        expect(live[i - 1]!.score).toBeGreaterThanOrEqual(live[i]!.score);
      }
    }
  });
});
