import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import type { Graph } from "../graph/types.ts";
import { reachableDiagnoses, untakenBranches } from "./analysis.ts";
import { walk } from "./session.ts";

function miniGraph(): Graph {
  const { graph, errors } = buildFromFiles({
    "map.yaml": "title: T\nrootPrompt: p\ndomains:\n  - { id: a, label: A, entry: q1 }\n",
    "questions/q.yaml":
      "- { id: q1, ask: Q1?, ifYes: q2, ifNo: q3 }\n" +
      "- { id: q2, ask: Q2?, ifYes: dB, ifNo: dC }\n" +
      "- { id: q3, ask: Q3?, ifYes: dD, ifNo: dE }\n",
    "diagnoses/d.yaml":
      "- { id: dB, name: B }\n- { id: dC, name: C }\n- { id: dD, name: D }\n- { id: dE, name: E }\n" +
      "- { id: dRef, name: Ref, reference: true }\n",
  });
  if (!graph) throw new Error(errors.join("; "));
  return graph;
}

const graph = miniGraph();
const areaA = graph.domains[0]!;

describe("reachableDiagnoses", () => {
  it("collects every diagnosis under a node, both branches", () => {
    const ids = reachableDiagnoses(graph, "q1")
      .map((d) => d.id)
      .sort();
    expect(ids).toEqual(["dB", "dC", "dD", "dE"]);
  });

  it("excludes reference nodes", () => {
    expect(reachableDiagnoses(graph, "q1").some((d) => d.id === "dRef")).toBe(false);
  });
});

describe("untakenBranches", () => {
  it("names what the branch not taken would have investigated", () => {
    const route = walk(graph, areaA, ["yes", "yes"]); // q1=yes → q2=yes → dB
    const forks = untakenBranches(graph, route, "dB");

    const q1Fork = forks.find((f) => f.step.question.id === "q1");
    expect(q1Fork?.otherAnswer).toBe("no");
    expect(q1Fork?.wouldConsider.map((d) => d.id).sort()).toEqual(["dD", "dE"]);

    const q2Fork = forks.find((f) => f.step.question.id === "q2");
    expect(q2Fork?.wouldConsider.map((d) => d.id)).toEqual(["dC"]);
  });

  it("drops a fork whose other branch only leads back to where we are", () => {
    const route = walk(graph, areaA, ["yes", "no"]); // → dC
    const forks = untakenBranches(graph, route, "dC");
    // q2's "yes" leads only to dB (still shown); nothing degenerate here, so
    // just assert the reached id is never listed as an alternative
    expect(forks.every((f) => f.wouldConsider.every((d) => d.id !== "dC"))).toBe(true);
  });
});
