import { describe, expect, it } from "vitest";
import { buildFromFiles } from "../content/load.ts";
import type { Content } from "../content/model.ts";
import { rankArea } from "./score.ts";
import { emptySession, reduce, screenOf, type SessionAction, type SessionState } from "./session.ts";

/**
 * A tiny area:
 *   q1  boolean  "Fever?"
 *   q2  boolean  "Red wedge?"
 *   q3  multi    "Skin change?" → rash / crack
 *
 *   dMastitis   supported by q1 + q2
 *   dAbscess    supported by q2, but IMPOSSIBLE without fever (excludes)
 *   dDermatitis supported by rash, argued against by q1
 */
function miniContent(): Content {
  const { content, errors } = buildFromFiles({
    "map.yaml": "title: T\nintro: i\nareas:\n  - { id: a, label: Area A }\n",
    "questions/q.yaml":
      "- { id: q1, area: a, type: boolean, ask: 'Fever?', short: 'Fever' }\n" +
      "- { id: q2, area: a, type: boolean, ask: 'Red wedge?', short: 'Red wedge' }\n" +
      "- id: q3\n" +
      "  area: a\n" +
      "  type: multi\n" +
      "  ask: 'Skin change?'\n" +
      "  options:\n" +
      "    - { finding: rash, label: 'Scaly rash' }\n" +
      "    - { finding: crack, label: 'Crack' }\n",
    "diagnoses/d.yaml":
      "- { id: dMastitis, area: a, name: Mastitis, supports: [ { finding: q1, weight: 2 }, { finding: q2, weight: 2 } ] }\n" +
      "- { id: dAbscess, area: a, name: Abscess, supports: [ { finding: q2, weight: 2 } ], excludes: [ { finding: q1, when: absent } ] }\n" +
      "- { id: dDermatitis, area: a, name: Dermatitis, supports: [ { finding: rash, weight: 2 } ], against: [ { finding: q1, weight: 2 } ] }\n",
  });
  if (!content) throw new Error(errors.join("; "));
  return content;
}

const content = miniContent();

const after = (...actions: SessionAction[]): SessionState =>
  actions.reduce<SessionState>((s, a) => reduce(content, s, a), emptySession());

describe("rankArea — nothing is gated out unless impossible", () => {
  it("scores a contradicted diagnosis down but keeps it", () => {
    const m = rankArea(content, "a", { q1: "absent", q2: "present" });
    const derm = m.find((x) => x.diagnosis.id === "dDermatitis")!;
    expect(derm).toBeDefined();
    expect(derm.tier).not.toBe("ruled-out");
  });

  it("removes a diagnosis only when a hard exclude fires", () => {
    const withFever = rankArea(content, "a", { q1: "present", q2: "present" });
    expect(withFever.find((x) => x.diagnosis.id === "dAbscess")!.tier).not.toBe("ruled-out");

    const noFever = rankArea(content, "a", { q1: "absent", q2: "present" });
    const abscess = noFever.find((x) => x.diagnosis.id === "dAbscess")!;
    expect(abscess.tier).toBe("ruled-out");
    expect(abscess.ruledOutBy).toEqual({ finding: "q1", when: "absent" });
    // still listed, just last
    expect(noFever.at(-1)!.diagnosis.id).toBe("dAbscess");
  });

  it("ranks the best-supported diagnosis first", () => {
    const m = rankArea(content, "a", { q1: "present", q2: "present" });
    expect(m[0]!.diagnosis.id).toBe("dMastitis");
    expect(m[0]!.tier).toBe("strong");
  });

  it("a multi question surfaces one finding per picked option", () => {
    const m = rankArea(content, "a", { rash: "present", crack: "absent" });
    const derm = m.find((x) => x.diagnosis.id === "dDermatitis")!;
    expect(derm.present.map((f) => f.finding)).toEqual(["rash"]);
  });
});

describe("screenOf + reduce", () => {
  it("start → question → results", () => {
    expect(screenOf(content, emptySession()).name).toBe("start");

    const picked = after({ type: "pickArea", areaId: "a" });
    const q = screenOf(content, picked);
    expect(q.name).toBe("question");
    if (q.name === "question") expect(q.question.id).toBe("q1");

    const done = after(
      { type: "pickArea", areaId: "a" },
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "answerQuestion", questionId: "q2", findings: { q2: "present" } },
      { type: "answerQuestion", questionId: "q3", findings: { rash: "absent", crack: "absent" } },
    );
    const screen = screenOf(content, done);
    expect(screen.name).toBe("results");
    if (screen.name === "results") {
      expect(screen.complete).toBe(true);
      expect(screen.matches[0]!.diagnosis.id).toBe("dMastitis");
    }
  });

  it("skipping a question advances past it and counts as skipped", () => {
    const s = after(
      { type: "pickArea", areaId: "a" },
      { type: "skipQuestion", questionId: "q1" },
    );
    const screen = screenOf(content, s);
    expect(screen.name).toBe("question");
    if (screen.name === "question") expect(screen.question.id).toBe("q2");
  });

  it("revising an answer replaces it", () => {
    const s = after(
      { type: "pickArea", areaId: "a" },
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "setFinding", finding: "q1", value: "absent" },
    );
    expect(s.answers.q1).toBe("absent");
  });

  it("reveal shows results early; back returns to the question", () => {
    const s = after(
      { type: "pickArea", areaId: "a" },
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "reveal" },
    );
    expect(screenOf(content, s).name).toBe("results");
    expect(screenOf(content, reduce(content, s, { type: "back" })).name).toBe("question");
  });

  it("back undoes the last handled question", () => {
    const s = after(
      { type: "pickArea", areaId: "a" },
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "answerQuestion", questionId: "q2", findings: { q2: "present" } },
      { type: "back" },
    );
    expect(s.answers.q2).toBeUndefined();
    expect(s.answers.q1).toBe("present");
  });

  it("restart clears the walk but keeps pinned findings", () => {
    const s = after(
      { type: "pickArea", areaId: "a" },
      { type: "pinFinding", id: "dMastitis" },
      { type: "answerQuestion", questionId: "q1", findings: { q1: "present" } },
      { type: "restart" },
    );
    expect(s.areaId).toBeNull();
    expect(s.answers).toEqual({});
    expect(s.findings).toEqual(["dMastitis"]);
  });
});
