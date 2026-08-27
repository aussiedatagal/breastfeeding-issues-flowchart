import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import type { Graph } from "../graph/types.ts";
import { buildProfiles } from "./profiles.ts";
import { rankMatches } from "./score.ts";
import { nextQuestion } from "./flow.ts";
import { emptySession, reduce, screenOf, type SessionState } from "./session.ts";

/**
 *   q1 ─yes→ q2 ─yes→ dA
 *    │        └─no──→ dB
 *    └─no──→ q3 ─yes→ dC
 *             └─no──→ dD
 */
function miniGraph(): Graph {
  const { graph, errors } = buildFromFiles({
    "map.yaml": "title: T\nrootPrompt: p\ndomains:\n  - { id: a, label: A, entry: q1 }\n",
    "questions/q.yaml":
      "- { id: q1, ask: Q1?, ifYes: q2, ifNo: q3 }\n" +
      "- { id: q2, ask: Q2?, ifYes: dA, ifNo: dB }\n" +
      "- { id: q3, ask: Q3?, ifYes: dC, ifNo: dD }\n",
    "diagnoses/d.yaml":
      "- { id: dA, name: A }\n- { id: dB, name: B }\n- { id: dC, name: C }\n- { id: dD, name: D }\n",
  });
  if (!graph) throw new Error(errors.join("; "));
  return graph;
}

const graph = miniGraph();
const profiles = buildProfiles(graph);

const after = (...actions: Parameters<typeof reduce>[1][]) =>
  actions.reduce<SessionState>((s, a) => reduce(s, a), emptySession());

describe("buildProfiles", () => {
  it("reads every root→leaf path as a symptom profile", () => {
    const dA = profiles.find((p) => p.diagnosisId === "dA")!;
    expect(dA.findings).toEqual([
      { questionId: "q1", answer: "yes" },
      { questionId: "q2", answer: "yes" },
    ]);
    expect(profiles.map((p) => p.diagnosisId).sort()).toEqual(["dA", "dB", "dC", "dD"]);
  });
});

describe("rankMatches — nothing is gated out", () => {
  it("a contradicted diagnosis stays in the list, just scored down", () => {
    const m = rankMatches(graph, profiles, "a", { q1: "yes" });
    const ids = m.map((x) => x.diagnosis.id);
    expect(ids).toContain("dC"); // q1=yes contradicts dC's profile, but it's still here
    const dC = m.find((x) => x.diagnosis.id === "dC")!;
    expect(dC.conflicting).toHaveLength(1);
    expect(dC.tier).toBe("unlikely");
  });

  it("ranks the profile that matches the answers first", () => {
    const m = rankMatches(graph, profiles, "a", { q1: "yes", q2: "yes" });
    expect(m[0]!.diagnosis.id).toBe("dA");
    expect(m[0]!.tier).toBe("best");
    expect(m.find((x) => x.diagnosis.id === "dB")!.conflicting).toHaveLength(1);
  });
});

describe("nextQuestion — adaptive", () => {
  it("asks a question a front-runner still needs", () => {
    expect(nextQuestion(graph, profiles, "a", {}).question?.id).toBe("q1");
    expect(nextQuestion(graph, profiles, "a", { q1: "yes" }).question?.id).toBe("q2");
  });

  it("stops once no front-runner needs another answer", () => {
    const step = nextQuestion(graph, profiles, "a", { q1: "yes", q2: "yes" });
    expect(step.question).toBeNull();
  });
});

describe("screenOf + reduce", () => {
  it("start → question → results", () => {
    expect(screenOf(graph, profiles, emptySession()).name).toBe("start");

    const picked = after({ type: "pickArea", areaId: "a" });
    expect(screenOf(graph, profiles, picked).name).toBe("question");

    const done = after(
      { type: "pickArea", areaId: "a" },
      { type: "answer", questionId: "q1", answer: "yes" },
      { type: "answer", questionId: "q2", answer: "yes" },
    );
    const screen = screenOf(graph, profiles, done);
    expect(screen.name).toBe("results");
    if (screen.name === "results") expect(screen.matches[0]!.diagnosis.id).toBe("dA");
  });

  it("answering the same question again replaces it, order preserved", () => {
    const s = after(
      { type: "pickArea", areaId: "a" },
      { type: "answer", questionId: "q1", answer: "yes" },
      { type: "answer", questionId: "q1", answer: "no" },
    );
    expect(s.given).toEqual([{ questionId: "q1", answer: "no" }]);
  });

  it("reveal shows results before the questions run out", () => {
    const s = after(
      { type: "pickArea", areaId: "a" },
      { type: "answer", questionId: "q1", answer: "yes" },
      { type: "reveal" },
    );
    expect(screenOf(graph, profiles, s).name).toBe("results");
    expect(screenOf(graph, profiles, reduce(s, { type: "back" })).name).toBe("question");
  });

  it("restart clears the walk but keeps findings", () => {
    const s = after(
      { type: "pickArea", areaId: "a" },
      { type: "pinFinding", id: "dA" },
      { type: "answer", questionId: "q1", answer: "yes" },
      { type: "restart" },
    );
    expect(s.areaId).toBeNull();
    expect(s.given).toEqual([]);
    expect(s.findings).toEqual(["dA"]);
  });
});
