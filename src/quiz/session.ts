/**
 * The quiz session — a small, framework-free state machine over the decision
 * graph. React binds to it in `useQuizSession`; everything here is pure so it
 * can be unit-tested on its own.
 */
import type {
  Answer,
  DiagnosisNode,
  Domain,
  Graph,
  GraphNode,
  QuestionNode,
} from "../graph/types.ts";
import { isQuestion } from "../graph/types.ts";

export type { Answer };

/** Guards a pathological `goto` loop in authored content. */
const MAX_STEPS = 60;

export interface Step {
  question: QuestionNode;
  answer: Answer;
}

/** A walk through one problem area — finished (at a diagnosis) or in progress. */
export interface Route {
  area: Domain;
  /** the questions answered so far, in order */
  steps: Step[];
  /** where the walk currently sits: a question to answer, or a diagnosis */
  current: GraphNode;
}

export type Screen =
  | { name: "start" }
  | { name: "question"; route: Route; question: QuestionNode }
  | { name: "result"; route: Route; diagnosis: DiagnosisNode }
  | { name: "summary" };

export interface SessionState {
  /** the problem area being worked, or null on the start screen */
  areaId: string | null;
  /** answers given from the area's entry question, in order */
  answers: Answer[];
  /** pinned diagnosis ids — the running problem list, order preserved */
  findings: string[];
  /** the reader has explicitly opened the findings summary */
  viewingSummary: boolean;
}

export const emptySession = (): SessionState => ({
  areaId: null,
  answers: [],
  findings: [],
  viewingSummary: false,
});

/**
 * Follow the graph from an area's entry question, applying `answers` one by one.
 * Stops early at a diagnosis, a dead end, or a revisited question (loop guard).
 */
export function walk(graph: Graph, area: Domain, answers: readonly Answer[]): Route {
  let current: GraphNode = graph.nodes.get(area.entry)!;
  const steps: Step[] = [];
  const seen = new Set<string>();

  for (const answer of answers) {
    if (!isQuestion(current) || seen.has(current.id) || steps.length >= MAX_STEPS) break;
    seen.add(current.id);
    steps.push({ question: current, answer });
    const next = graph.nodes.get(current.edges[answer].to);
    if (!next) break;
    current = next;
  }

  return { area, steps, current };
}

/** Which screen the current state resolves to. */
export function screenOf(graph: Graph, state: SessionState): Screen {
  if (state.viewingSummary) return { name: "summary" };

  const area = state.areaId ? graph.domains.find((d) => d.id === state.areaId) : undefined;
  if (!area) return { name: "start" };

  const route = walk(graph, area, state.answers);
  return isQuestion(route.current)
    ? { name: "question", route, question: route.current }
    : { name: "result", route, diagnosis: route.current as DiagnosisNode };
}

// --- transitions -----------------------------------------------------------

export type SessionAction =
  | { type: "pickArea"; areaId: string }
  | { type: "answer"; answer: Answer }
  | { type: "back" }
  | { type: "goToStep"; index: number }
  | { type: "changeAnswer"; index: number; answer: Answer }
  | { type: "restart" }
  | { type: "openSummary" }
  | { type: "closeSummary" }
  | { type: "pinFinding"; id: string }
  | { type: "unpinFinding"; id: string }
  | { type: "clearFindings" };

export function reduce(state: SessionState, action: SessionState | SessionAction): SessionState {
  if (!("type" in action)) return action; // hydration from the URL

  switch (action.type) {
    case "pickArea":
      return { ...state, areaId: action.areaId, answers: [], viewingSummary: false };

    case "answer":
      return { ...state, answers: [...state.answers, action.answer], viewingSummary: false };

    case "back":
      if (state.viewingSummary) return { ...state, viewingSummary: false };
      if (state.answers.length > 0) return { ...state, answers: state.answers.slice(0, -1) };
      return { ...state, areaId: null };

    case "goToStep":
      return { ...state, answers: state.answers.slice(0, Math.max(0, action.index)) };

    case "changeAnswer":
      return {
        ...state,
        answers: [...state.answers.slice(0, action.index), action.answer],
        viewingSummary: false,
      };

    case "restart":
      // a fresh pass — the findings list is kept, you're characterising the
      // next contributing factor
      return { ...state, areaId: null, answers: [], viewingSummary: false };

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
