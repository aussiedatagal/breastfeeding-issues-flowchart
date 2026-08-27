/**
 * The quiz session — a small, framework-free state machine. React binds to it in
 * `useQuizSession`; everything here is pure so it can be unit-tested on its own.
 *
 * The reader picks an area, answers questions in any order, and gets a ranked
 * list of what fits. No answer ever gates a diagnosis out — see `score.ts`.
 */
import type { Answer, Domain, Graph, QuestionNode } from "../graph/types.ts";
import { nextQuestion } from "./flow.ts";
import type { Profile } from "./profiles.ts";
import { rankMatches, type Answers, type Match } from "./score.ts";

export type { Answer };

export interface Given {
  questionId: string;
  answer: Answer;
}

export interface SessionState {
  /** the problem area being worked, or null on the start screen */
  areaId: string | null;
  /** answers given, in the order they were given */
  given: Given[];
  /** the reader asked to see results before a clear leader emerged */
  revealed: boolean;
  /** the reader asked for one more question from the results screen */
  probe: boolean;
  /** pinned diagnosis ids — the running problem list, order preserved */
  findings: string[];
  /** the reader has explicitly opened the findings summary */
  viewingSummary: boolean;
}

export const emptySession = (): SessionState => ({
  areaId: null,
  given: [],
  revealed: false,
  probe: false,
  findings: [],
  viewingSummary: false,
});

export const answersOf = (given: readonly Given[]): Answers =>
  Object.fromEntries(given.map((g) => [g.questionId, g.answer]));

export type Screen =
  | { name: "start" }
  | {
      name: "question";
      area: Domain;
      question: QuestionNode;
      answered: number;
      minUseful: number;
      given: Given[];
    }
  | { name: "results"; area: Domain; matches: Match[]; given: Given[]; exhausted: boolean }
  | { name: "summary" };

export function screenOf(graph: Graph, profiles: Profile[], state: SessionState): Screen {
  if (state.viewingSummary) return { name: "summary" };

  const area = state.areaId ? graph.domains.find((d) => d.id === state.areaId) : undefined;
  if (!area) return { name: "start" };

  const answers = answersOf(state.given);
  const step = nextQuestion(graph, profiles, area.id, answers);

  const results = (): Screen => ({
    name: "results",
    area,
    matches: rankMatches(graph, profiles, area.id, answers),
    given: state.given,
    exhausted: step.probeQuestion === null,
  });

  const question = (q: QuestionNode): Screen => ({
    name: "question",
    area,
    question: q,
    answered: step.answered,
    minUseful: step.minUseful,
    given: state.given,
  });

  // "answer another question" from results: offer any remaining area question
  if (state.probe) return step.probeQuestion ? question(step.probeQuestion) : results();

  // the flow: keep asking until a leader settles, unless the reader peeked
  if (step.question === null || state.revealed || step.confident) return results();
  return question(step.question);
}

// --- transitions -----------------------------------------------------------

export type SessionAction =
  | { type: "pickArea"; areaId: string }
  | { type: "answer"; questionId: string; answer: Answer }
  | { type: "unanswer"; questionId: string }
  | { type: "reveal" }
  | { type: "probe" }
  | { type: "back" }
  | { type: "restart" }
  | { type: "openSummary" }
  | { type: "closeSummary" }
  | { type: "pinFinding"; id: string }
  | { type: "unpinFinding"; id: string }
  | { type: "clearFindings" };

function upsert(given: Given[], questionId: string, answer: Answer): Given[] {
  const i = given.findIndex((g) => g.questionId === questionId);
  if (i === -1) return [...given, { questionId, answer }];
  const next = given.slice();
  next[i] = { questionId, answer };
  return next;
}

export function reduce(state: SessionState, action: SessionState | SessionAction): SessionState {
  if (!("type" in action)) return action; // hydration from the URL

  switch (action.type) {
    case "pickArea":
      return {
        ...state,
        areaId: action.areaId,
        given: [],
        revealed: false,
        probe: false,
        viewingSummary: false,
      };

    case "answer":
      return {
        ...state,
        given: upsert(state.given, action.questionId, action.answer),
        probe: false, // one probe question answered → re-evaluate
        viewingSummary: false,
      };

    case "unanswer":
      return {
        ...state,
        given: state.given.filter((g) => g.questionId !== action.questionId),
        viewingSummary: false,
      };

    case "reveal":
      return { ...state, revealed: true, probe: false, viewingSummary: false };

    case "probe":
      // "answer another question" from the results screen
      return { ...state, probe: true, revealed: false, viewingSummary: false };

    case "back":
      if (state.viewingSummary) return { ...state, viewingSummary: false };
      if (state.probe) return { ...state, probe: false };
      if (state.revealed) return { ...state, revealed: false };
      if (state.given.length > 0) return { ...state, given: state.given.slice(0, -1) };
      return { ...state, areaId: null };

    case "restart":
      // a fresh pass — the findings list is kept
      return {
        ...state,
        areaId: null,
        given: [],
        revealed: false,
        probe: false,
        viewingSummary: false,
      };

    case "openSummary":
      return { ...state, viewingSummary: true };

    case "closeSummary":
      return { ...state, viewingSummary: false };

    case "pinFinding":
      return state.findings.includes(action.id)
        ? state
        : { ...state, findings: [...state.findings, action.id] };

    case "unpinFinding":
      return { ...state, findings: state.findings.filter((id) => id !== action.id) };

    case "clearFindings":
      return { ...state, findings: [] };
  }
}
