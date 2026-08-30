import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import type { Content } from "../content/model.ts";
import { rankAcross } from "./score.ts";
import { emptySession, reduce, screenOf, type SessionAction, type SessionState } from "./session.ts";

/**
 * Two tiny areas:
 *   area "a"  TWO screening questions   q1 boolean "Fever?"   q2 boolean "Red wedge?"   q3 multi
 *   area "b"  one screening question    q4 boolean "Sudden?"
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
      "  - { id: a, label: Area A, ask: ['A one?', 'A two?'] }\n" +
      "  - { id: b, label: Area B, ask: 'B problem?' }\n",
    "questions/q.yaml":
      "- { id: q1, area: a, type: boolean, ask: 'Fever?', short: 'Fever' }\n" +
      "- { id: q2, area: a, type: boolean, ask: 'Red wedge?', short: 'Red wedge' }\n" +
      "- id: q3\n  area: a\n  type: multi\n  ask: 'Skin change?'\n  showIf: q2\n  options:\n" +
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

/** flag area "a" in (yes to its 1st screen), area "b" in */
const gateBoth: SessionAction[] = [
  { type: "answerScreen", areaId: "a", screenIndex: 0, yes: true },
  { type: "answerScreen", areaId: "b", screenIndex: 0, yes: true },
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

  it("a 'yes' to any of an area's screening questions flags it in and skips the rest", () => {
    const s = after({ type: "answerScreen", areaId: "a", screenIndex: 0, yes: true });
    // area a is in after one yes; screening moves to area b, not a's 2nd question
    const screen = screenOf(content, s);
    expect(screen.name).toBe("screening");
    if (screen.name === "screening") expect(screen.area.id).toBe("b");
  });

  it("must say 'no' to every screening question in an area to exclude it", () => {
    const oneNo = after({ type: "answerScreen", areaId: "a", screenIndex: 0, yes: false });
    const still = screenOf(content, oneNo);
    expect(still.name).toBe("screening");
    if (still.name === "screening") {
      expect(still.area.id).toBe("a"); // still asking area a's 2nd question
      expect(still.screenIndex).toBe(1);
    }
  });

  it("only asks questions from areas screened in", () => {
    const s = after(
      { type: "answerScreen", areaId: "a", screenIndex: 0, yes: true },
      { type: "answerScreen", areaId: "b", screenIndex: 0, yes: false },
    );
    const screen = screenOf(content, s);
    expect(screen.name).toBe("question");
    if (screen.name === "question") {
      expect(screen.area.id).toBe("a");
      expect(screen.total).toBe(2); // q1, q2 visible; q3 hidden (showIf q2), q4 is area b
    }
  });

  it("a showIf question appears only once its gate is answered, and prunes if the gate flips back", () => {
    // q3 hidden while q2 unanswered
    let s = after(
      ...gateBoth,
      { type: "answerQuestion", questionId: "q1", findings: { q1: "absent" } },
    );
    let sc = screenOf(content, s);
    expect(sc.name === "question" && sc.question.id).toBe("q2");

    // q2 present → q3 appears; answer it
    s = reduce(content, s, { type: "answerQuestion", questionId: "q2", findings: { q2: "present" } });
    sc = screenOf(content, s);
    expect(sc.name === "question" && sc.question.id).toBe("q3");
    s = reduce(content, s, {
      type: "answerQuestion",
      questionId: "q3",
      findings: { rash: "present", crack: "absent" },
    });
    expect(s.answers.rash).toBe("present");

    // flip q2 to absent from the grid → q3 is hidden and its answers are pruned
    s = reduce(content, s, { type: "setFinding", finding: "q2", value: "absent" });
    expect(s.answers.rash).toBeUndefined();
    expect(s.answers.crack).toBeUndefined();
    expect(s.handled).not.toContain("q3");
  });

  it("no area screened in → an empty results screen", () => {
    const s = after(
      { type: "answerScreen", areaId: "a", screenIndex: 0, yes: false },
      { type: "answerScreen", areaId: "a", screenIndex: 1, yes: false },
      { type: "answerScreen", areaId: "b", screenIndex: 0, yes: false },
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

  it("back steps out of the last screening answer", () => {
    const s = after({ type: "answerScreen", areaId: "a", screenIndex: 0, yes: true });
    const stepped = reduce(content, s, { type: "back" });
    const screen = screenOf(content, stepped);
    expect(screen.name).toBe("screening");
    if (screen.name === "screening") expect(screen.area.id).toBe("a");
    expect(stepped.screenAnswers).toEqual({});
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

  it("toggleMap flips to the content-map view and back, keeping the session", () => {
    const s = after(
      ...gateBoth,
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "toggleMap" },
    );
    expect(screenOf(content, s).name).toBe("map");
    const back = reduce(content, s, { type: "toggleMap" });
    expect(screenOf(content, back).name).toBe("question");
    expect(back.answers.q1).toBe("present");
  });

  it("editAreas clears the screening pass but keeps pinned findings", () => {
    const s = after(
      ...gateBoth,
      { type: "pinFinding", id: "dMastitis" },
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "editAreas" },
    );
    expect(s.screenAnswers).toEqual({});
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
