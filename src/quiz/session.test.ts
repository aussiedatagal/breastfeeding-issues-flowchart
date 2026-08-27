import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import type { Graph } from "../graph/types.ts";
import { emptySession, reduce, screenOf, walk } from "./session.ts";

/** A tiny two-question area: q1 → (yes) q2 → (yes) dB / (no) dC, (no) → dA. */
function miniGraph(): Graph {
  const { graph, errors } = buildFromFiles({
    "map.yaml": "title: T\nrootPrompt: p\ndomains:\n  - { id: a, label: Area A, entry: q1 }\n",
    "questions/q.yaml":
      "- { id: q1, ask: Q1?, ifYes: q2, ifNo: dA }\n- { id: q2, ask: Q2?, ifYes: dB, ifNo: dC }\n",
    "diagnoses/d.yaml":
      "- { id: dA, name: Dx A }\n- { id: dB, name: Dx B }\n- { id: dC, name: Dx C }\n",
  });
  if (!graph) throw new Error(errors.join("; "));
  return graph;
}

const graph = miniGraph();
const areaA = graph.domains[0]!;

describe("walk", () => {
  it("lands on the entry question with no answers", () => {
    const route = walk(graph, areaA, []);
    expect(route.current.id).toBe("q1");
    expect(route.steps).toHaveLength(0);
  });

  it("follows answers to a diagnosis and records the steps", () => {
    const route = walk(graph, areaA, ["yes", "no"]);
    expect(route.current.id).toBe("dC");
    expect(route.steps.map((s) => [s.question.id, s.answer])).toEqual([
      ["q1", "yes"],
      ["q2", "no"],
    ]);
  });

  it("ignores answers given past a diagnosis", () => {
    const route = walk(graph, areaA, ["no", "yes", "yes"]);
    expect(route.current.id).toBe("dA");
    expect(route.steps).toHaveLength(1);
  });
});

describe("screenOf", () => {
  it("is the start screen with no area", () => {
    expect(screenOf(graph, emptySession()).name).toBe("start");
  });

  it("is a question screen mid-walk", () => {
    const s = reduce(reduce(emptySession(), { type: "pickArea", areaId: "a" }), {
      type: "answer",
      answer: "yes",
    });
    const screen = screenOf(graph, s);
    expect(screen.name).toBe("question");
    if (screen.name === "question") expect(screen.question.id).toBe("q2");
  });

  it("is a result screen at a diagnosis", () => {
    let s = reduce(emptySession(), { type: "pickArea", areaId: "a" });
    s = reduce(s, { type: "answer", answer: "no" });
    const screen = screenOf(graph, s);
    expect(screen.name).toBe("result");
    if (screen.name === "result") expect(screen.diagnosis.id).toBe("dA");
  });

  it("is the summary screen when viewingSummary", () => {
    expect(screenOf(graph, { ...emptySession(), viewingSummary: true }).name).toBe("summary");
  });
});

describe("reduce", () => {
  const start = reduce(emptySession(), { type: "pickArea", areaId: "a" });

  it("back pops the last answer, then leaves the area", () => {
    const answered = reduce(start, { type: "answer", answer: "yes" });
    expect(reduce(answered, { type: "back" }).answers).toEqual([]);
    expect(reduce(start, { type: "back" }).areaId).toBeNull();
  });

  it("goToStep truncates answers to that fork", () => {
    let s = start;
    s = reduce(s, { type: "answer", answer: "yes" });
    s = reduce(s, { type: "answer", answer: "no" });
    expect(reduce(s, { type: "goToStep", index: 1 }).answers).toEqual(["yes"]);
  });

  it("changeAnswer rewinds to a fork and takes the other branch", () => {
    let s = start;
    s = reduce(s, { type: "answer", answer: "yes" });
    s = reduce(s, { type: "answer", answer: "yes" });
    const changed = reduce(s, { type: "changeAnswer", index: 0, answer: "no" });
    expect(changed.answers).toEqual(["no"]);
    expect(screenOf(graph, changed).name).toBe("result");
  });

  it("restart clears the walk but keeps findings", () => {
    const withFinding = reduce(start, { type: "pinFinding", id: "dA" });
    const restarted = reduce(reduce(withFinding, { type: "answer", answer: "no" }), {
      type: "restart",
    });
    expect(restarted.areaId).toBeNull();
    expect(restarted.answers).toEqual([]);
    expect(restarted.findings).toEqual(["dA"]);
  });

  it("pinning is idempotent and unpinning removes", () => {
    let s = reduce(emptySession(), { type: "pinFinding", id: "dA" });
    s = reduce(s, { type: "pinFinding", id: "dA" });
    expect(s.findings).toEqual(["dA"]);
    expect(reduce(s, { type: "unpinFinding", id: "dA" }).findings).toEqual([]);
  });
});
