/**
 * Adaptive questioning. During the flow, ask the highest-priority question a
 * still-plausible diagnosis needs, and let the caller move to results once a
 * clear leader emerges. From the results screen the reader can keep answering —
 * then *any* remaining question of the area is offered, in priority order.
 *
 * Nothing is ever removed from consideration — see `score.ts`.
 *
 * Pure.
 */
import type { Graph, QuestionNode } from "../graph/types.ts";
import { areaQuestionOrder, type Profile } from "./profiles.ts";
import { contenders, rankMatches, type Answers, type Match } from "./score.ts";

export interface FlowStep {
  /** the next question for the adaptive flow, or null once the leader is settled */
  question: QuestionNode | null;
  /** the next unanswered question of the area (for "answer another question") */
  probeQuestion: QuestionNode | null;
  answered: number;
  /** answering at least this many makes a ranking worth showing */
  minUseful: number;
  /** a clear front-runner has emerged — fine to show results */
  confident: boolean;
}

const MIN_USEFUL = 3;
const PLAUSIBLE = 8;

function hasClearLeader(matches: Match[]): boolean {
  const clean = matches.filter((m) => m.conflicting.length === 0);
  const top = clean[0];
  if (!top || top.matched.length === 0) return false;
  if (top.tier === "best") return true;
  const second = clean[1];
  return !second || top.score - second.score >= 2;
}

export function nextQuestion(
  graph: Graph,
  profiles: readonly Profile[],
  areaId: string,
  answers: Answers,
): FlowStep {
  const order = areaQuestionOrder(graph, profiles, areaId);
  const unanswered = order.filter((q) => answers[q.id] === undefined);
  const answered = order.length - unanswered.length;

  const matches = rankMatches(graph, profiles, areaId, answers);

  // questions a still-plausible diagnosis (leader or not) is missing an answer to
  const wanted = new Set<string>();
  for (const m of contenders(matches)) for (const f of m.missing) wanted.add(f.questionId);
  for (const m of matches.filter((x) => x.conflicting.length === 0).slice(0, PLAUSIBLE)) {
    for (const f of m.missing) wanted.add(f.questionId);
  }

  return {
    question: unanswered.find((q) => wanted.has(q.id)) ?? null,
    probeQuestion: unanswered[0] ?? null,
    answered,
    minUseful: Math.min(MIN_USEFUL, order.length),
    confident: answered >= MIN_USEFUL && hasClearLeader(matches),
  };
}
