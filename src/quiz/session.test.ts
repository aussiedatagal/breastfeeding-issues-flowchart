import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import type { Content } from "../content/model.ts";
import { rankAcross } from "./score.ts";
import { emptySession, reduce, screenOf, type SessionAction, type SessionState } from "./session.ts";

/**
 * Two tiny areas:
 *   area "a"  q1 boolean "Fever?"   q2 boolean "Red wedge?"   q3 multi "Skin change?"
 *   area "b"  q4 boolean "Sudden?"
 *
 *   dMastitis (a)   prior common, supported by q1 + q2
 *   dAbscess (a)    supported by q2, IMPOSSIBLE without fever (excludes)
 *   dDermatitis (a) supported by rash, argued against by q1
 *   dStrike (b)     supported by q4
 */
function miniContent(): Content {
  const { content, errors } = buildFromFiles({
    "map.yaml":
      "title: T\nintro: i\nareas:\n" +
      "  - { id: a, label: Area A, ask: 'A problem?' }\n" +
      "  - { id: b, label: Area B, ask: 'B problem?' }\n",
    "questions/q.yaml":
      "- { id: q1, area: a, type: boolean, ask: 'Fever?', short: 'Fever' }\n" +
      "- { id: q2, area: a, type: boolean, ask: 'Red wedge?', short: 'Red wedge' }\n" +
      "- id: q3\n  area: a\n  type: multi\n  ask: 'Skin change?'\n  options:\n" +
      "    - { finding: rash, label: 'Scaly rash' }\n" +
      "    - { finding: crack, label: 'Crack' }\n" +
      "- { id: q4, area: b, type: boolean, ask: 'Sudden?', short: 'Sudden' }\n",
    "diagnoses/d.yaml":
      "- { id: dMastitis, area: a, name: Mastitis, prior: common, supports: [ { finding: q1, weight: 3 }, { finding: q2, weight: 3 } ] }\n" +
      "- { id: dAbscess, area: a, name: Abscess, supports: [ { finding: q2, weight: 2 } ], excludes: [ { finding: q1, when: absent } ] }\n" +
      "- { id: dDermatitis, area: a, name: Dermatitis, supports: [ { finding: rash, weight: 3 } ], against: [ { finding: q1, weight: 2 } ] }\n" +
      "- { id: dStrike, area: b, name: Nursing strike, supports: [ { finding: q4, weight: 3 } ] }\n",
  });
  if (!content) throw new Error(errors.join("; "));
  return content;
}

const content = miniContent();

const after = (...actions: SessionAction[]): SessionState =>
  actions.reduce<SessionState>((s, a) => reduce(content, s, a), emptySession());

const gateBoth: SessionAction[] = [
  { type: "gateArea", areaId: "a", include: true },
  { type: "gateArea", areaId: "b", include: true },
];

describe("rankAcross — Bayesian, nothing gated out unless impossible", () => {
  it("a higher prior + confirmed findings lifts the posterior", () => {
    const m = rankAcross(content, ["a"], { q1: "present", q2: "present" });
    expect(m[0]!.diagnosis.id).toBe("dMastitis");
    expect(m[0]!.probability).toBeGreaterThan(0.6);
    expect(m[0]!.tier).toBe("strong");
  });

  it("an absent supporting finding lowers the posterior but keeps it", () => {
    const withIt = rankAcross(content, ["a"], { q1: "present", q2: "present" });
    const without = rankAcross(content, ["a"], { q1: "absent", q2: "present" });
    const p1 = withIt.find((x) => x.diagnosis.id === "dMastitis")!.probability;
    const p2 = without.find((x) => x.diagnosis.id === "dMastitis")!.probability;
    expect(p2).toBeLessThan(p1);
    expect(without.find((x) => x.diagnosis.id === "dMastitis")!.tier).not.toBe("ruled-out");
  });

  it("removes a diagnosis only when a hard exclude fires", () => {
    const noFever = rankAcross(content, ["a"], { q1: "absent", q2: "present" });
    const abscess = noFever.find((x) => x.diagnosis.id === "dAbscess")!;
    expect(abscess.tier).toBe("ruled-out");
    expect(abscess.probability).toBe(0);
    expect(noFever.at(-1)!.diagnosis.id).toBe("dAbscess");
  });

  it("scores every picked area into one list", () => {
    const m = rankAcross(content, ["a", "b"], { q4: "present" });
    expect(m.map((x) => x.diagnosis.id)).toContain("dStrike");
    expect(m.find((x) => x.diagnosis.id === "dStrike")!.diagnosis.area).toBe("b");
  });
});

describe("screening → questions → results", () => {
  it("starts on the first screening question", () => {
    const s = screenOf(content, emptySession());
    expect(s.name).toBe("screening");
    if (s.name === "screening") {
      expect(s.area.id).toBe("a");
      expect(s.first).toBe(true);
    }
  });

  it("only asks questions from areas screened in", () => {
    const s = after(
      { type: "gateArea", areaId: "a", include: true },
      { type: "gateArea", areaId: "b", include: false },
    );
    const screen = screenOf(content, s);
    expect(screen.name).toBe("question");
    if (screen.name === "question") {
      expect(screen.area.id).toBe("a");
      expect(screen.total).toBe(3); // q1, q2, q3 — not q4
    }
  });

  it("no area screened in → an empty results screen", () => {
    const s = after(
      { type: "gateArea", areaId: "a", include: false },
      { type: "gateArea", areaId: "b", include: false },
    );
    const screen = screenOf(content, s);
    expect(screen.name).toBe("results");
    if (screen.name === "results") expect(screen.areas).toEqual([]);
  });

  it("answers across areas, then a combined ranked result", () => {
    const s = after(
      ...gateBoth,
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "answerQuestion", questionId: "q2", findings: { q2: "present" } },
      { type: "answerQuestion", questionId: "q3", findings: { rash: "absent", crack: "absent" } },
      { type: "answerQuestion", questionId: "q4", findings: { q4: "absent" } },
    );
    const screen = screenOf(content, s);
    expect(screen.name).toBe("results");
    if (screen.name === "results") {
      expect(screen.complete).toBe(true);
      expect(screen.areas.map((a) => a.id)).toEqual(["a", "b"]);
      expect(screen.matches[0]!.diagnosis.id).toBe("dMastitis");
    }
  });

  it("skipping a screening question steps forward; back steps into it", () => {
    const s = after({ type: "gateArea", areaId: "a", include: true });
    const screen = screenOf(content, s);
    expect(screen.name).toBe("screening");
    if (screen.name === "screening") expect(screen.area.id).toBe("b");

    const stepped = reduce(content, s, { type: "back" });
    expect(screenOf(content, stepped).name).toBe("screening");
    expect(stepped.areaGate).toEqual({});
  });

  it("reveal shows results early; back returns to the question", () => {
    const s = after(
      ...gateBoth,
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "reveal" },
    );
    expect(screenOf(content, s).name).toBe("results");
    expect(screenOf(content, reduce(content, s, { type: "back" })).name).toBe("question");
  });

  it("editAreas clears the screening pass but keeps pinned findings", () => {
    const s = after(
      ...gateBoth,
      { type: "pinFinding", id: "dMastitis" },
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "editAreas" },
    );
    expect(s.areaGate).toEqual({});
    expect(screenOf(content, s).name).toBe("screening");
    expect(s.findings).toEqual(["dMastitis"]);
  });

  it("back undoes the last handled question", () => {
    const s = after(
      ...gateBoth,
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "answerQuestion", questionId: "q2", findings: { q2: "present" } },
      { type: "back" },
    );
    expect(s.answers.q2).toBeUndefined();
    expect(s.answers.q1).toBe("present");
  });
});
