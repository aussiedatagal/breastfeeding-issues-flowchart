/**
 * The quiz session — a framework-free state machine. Pick an area, answer every
 * question you can (or skip the ones you can't judge), then get a ranked list
 * of what fits. React binds to it in `useQuizSession`.
 *
 * There is no tree walk: order doesn't matter, and no answer removes a
 * diagnosis unless a hard `excludes` rule fires (see `score.ts`).
 *
 * Pure.
 */
import type { Area, Content, Presence, Question } from "../content/model.ts";
import { questionsInArea } from "../content/model.ts";
import { rankArea, type Match } from "./score.ts";

export type { Presence };

export interface SessionState {
  /** the area being worked, or null on the start screen */
  areaId: string | null;
  /** question ids in the order they were answered or skipped */
  handled: string[];
  /** question ids the reader chose to skip ("not sure") */
  skipped: string[];
  /** findingId → present / absent (absent from the map === not assessed) */
  answers: Record<string, Presence>;
  /** the reader asked to see results before working through every question */
  revealed: boolean;
  /** pinned diagnosis ids — the running problem list */
  findings: string[];
  viewingSummary: boolean;
}

export const emptySession = (): SessionState => ({
  areaId: null,
  handled: [],
  skipped: [],
  answers: {},
  revealed: false,
  findings: [],
  viewingSummary: false,
});

/** which findings a question sets — one for boolean, several for multi */
export const questionFindings = (q: Question): string[] => q.options.map((o) => o.finding);

/** every finding the reader has answered, in the order the questions were handled */
export function answeredFindings(content: Content, state: SessionState): string[] {
  const out: string[] = [];
  for (const qid of state.handled) {
    if (state.skipped.includes(qid)) continue;
    const q = content.question.get(qid);
    if (!q) continue;
    for (const f of questionFindings(q)) {
      if (state.answers[f] !== undefined) out.push(f);
    }
  }
  return out;
}

const isHandled = (q: Question, state: SessionState) =>
  state.skipped.includes(q.id) ||
  questionFindings(q).every((f) => state.answers[f] !== undefined);

/** the next question the reader hasn't answered or skipped, in authored order */
function nextPending(content: Content, areaId: string, state: SessionState): Question | null {
  for (const q of questionsInArea(content, areaId)) {
    if (!isHandled(q, state)) return q;
  }
  return null;
}

export type Screen =
  | { name: "start" }
  | {
      name: "question";
      area: Area;
      question: Question;
      /** 1-based position of this question in the area */
      index: number;
      total: number;
      answers: Record<string, Presence>;
      /** something has been answered, so results are worth a peek */
      canReveal: boolean;
    }
  | {
      name: "results";
      area: Area;
      matches: Match[];
      answered: string[];
      answers: Record<string, Presence>;
      /** every question in the area has been answered or skipped */
      complete: boolean;
      /** count of questions answered (not skipped) */
      answeredCount: number;
      skippedCount: number;
    }
  | { name: "summary" };

export function screenOf(content: Content, state: SessionState): Screen {
  if (state.viewingSummary) return { name: "summary" };

  const area = state.areaId ? content.areas.find((a) => a.id === state.areaId) : undefined;
  if (!area) return { name: "start" };

  const areaQuestions = questionsInArea(content, area.id);
  const next = nextPending(content, area.id, state);
  const answered = answeredFindings(content, state);
  const answeredCount = areaQuestions.filter(
    (q) => !state.skipped.includes(q.id) && questionFindings(q).every((f) => state.answers[f] !== undefined),
  ).length;

  if (next === null || state.revealed) {
    return {
      name: "results",
      area,
      matches: rankArea(content, area.id, state.answers),
      answered,
      answers: state.answers,
      complete: next === null,
      answeredCount,
      skippedCount: state.skipped.length,
    };
  }

  return {
    name: "question",
    area,
    question: next,
    index: areaQuestions.indexOf(next) + 1,
    total: areaQuestions.length,
    answers: state.answers,
    canReveal: answered.length > 0,
  };
}

// --- transitions -----------------------------------------------------------

export type SessionAction =
  | { type: "pickArea"; areaId: string }
  | { type: "answerQuestion"; questionId: string; findings: Record<string, Presence> }
  | { type: "skipQuestion"; questionId: string }
  | { type: "setFinding"; finding: string; value: Presence }
  | { type: "clearFinding"; finding: string }
  | { type: "reveal" }
  | { type: "resume" }
  | { type: "back" }
  | { type: "restart" }
  | { type: "openSummary" }
  | { type: "closeSummary" }
  | { type: "pinFinding"; id: string }
  | { type: "unpinFinding"; id: string }
  | { type: "clearFindings" };

const without = <T,>(list: T[], value: T) => list.filter((v) => v !== value);

const dropAnswers = (answers: Record<string, Presence>, findings: string[]) =>
  Object.fromEntries(Object.entries(answers).filter(([f]) => !findings.includes(f)));

/** every finding a question could have set, so `back` fully undoes it */
const findingsOf = (content: Content, questionId: string): string[] => {
  const q = content.question.get(questionId);
  return q ? questionFindings(q) : [questionId];
};

export function reduce(
  content: Content,
  state: SessionState,
  action: SessionState | SessionAction,
): SessionState {
  if (!("type" in action)) return action; // hydration from the URL

  switch (action.type) {
    case "pickArea":
      return { ...emptySession(), findings: state.findings, areaId: action.areaId };

    case "answerQuestion": {
      const handled = state.handled.includes(action.questionId)
        ? state.handled
        : [...state.handled, action.questionId];
      return {
        ...state,
        handled,
        skipped: without(state.skipped, action.questionId),
        answers: { ...state.answers, ...action.findings },
        viewingSummary: false,
      };
    }

    case "skipQuestion": {
      const handled = state.handled.includes(action.questionId)
        ? state.handled
        : [...state.handled, action.questionId];
      return {
        ...state,
        handled,
        skipped: state.skipped.includes(action.questionId)
          ? state.skipped
          : [...state.skipped, action.questionId],
        viewingSummary: false,
      };
    }

    case "setFinding":
      return {
        ...state,
        answers: { ...state.answers, [action.finding]: action.value },
        viewingSummary: false,
      };

    case "clearFinding":
      return {
        ...state,
        answers: dropAnswers(state.answers, [action.finding]),
        viewingSummary: false,
      };

    case "reveal":
      return { ...state, revealed: true, viewingSummary: false };

    case "resume":
      return { ...state, revealed: false, viewingSummary: false };

    case "back": {
      if (state.viewingSummary) return { ...state, viewingSummary: false };
      if (state.revealed) return { ...state, revealed: false };
      if (state.handled.length > 0) {
        const last = state.handled[state.handled.length - 1]!;
        return {
          ...state,
          handled: state.handled.slice(0, -1),
          skipped: without(state.skipped, last),
          answers: dropAnswers(state.answers, findingsOf(content, last)),
        };
      }
      return { ...state, areaId: null };
    }

    case "restart":
      return { ...emptySession(), findings: state.findings };

    case "openSummary":
      return { ...state, viewingSummary: true };
    case "closeSummary":
      return { ...state, viewingSummary: false };

    case "pinFinding":
      return state.findings.includes(action.id)
        ? state
        : { ...state, findings: [...state.findings, action.id] };
    case "unpinFinding":
      return { ...state, findings: without(state.findings, action.id) };
    case "clearFindings":
      return { ...state, findings: [] };
  }
}
