/**
 * The quiz session — a framework-free state machine.
 *
 * 1. A short yes/no **screening** pass, one question per area, decides which
 *    problem areas are in play ("Is there nipple or breast pain?").
 * 2. The clinician answers the questions from every picked area, in any order,
 *    skipping the ones they can't judge.
 * 3. One combined, probability-ranked list of what fits.
 *
 * There is no tree walk: order doesn't matter, and no answer removes a
 * diagnosis unless a hard `excludes` rule fires (see `score.ts`).
 *
 * Pure. React binds to it in `useQuizSession`.
 */
import type { Area, Content, Presence, Question } from "../content/model.ts";
import { rankAcross, type Match } from "./score.ts";

export type { Presence };

export interface SessionState {
  /** areaId → included? A key means its screening question has been answered. */
  areaGate: Record<string, boolean>;
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
  areaGate: {},
  handled: [],
  skipped: [],
  answers: {},
  revealed: false,
  findings: [],
  viewingSummary: false,
});

/** which findings a question sets — one for boolean, several for multi */
export const questionFindings = (q: Question): string[] => q.options.map((o) => o.finding);

/** the areas whose screening question was answered "yes", in map order */
export const selectedAreas = (content: Content, state: SessionState): Area[] =>
  content.areas.filter((a) => state.areaGate[a.id] === true);

/** the first area whose screening question hasn't been answered yet */
const pendingGate = (content: Content, state: SessionState): Area | undefined =>
  content.areas.find((a) => state.areaGate[a.id] === undefined);

/** questions from every picked area, in area then authored order */
const selectedQuestions = (content: Content, state: SessionState): Question[] => {
  const areas = new Set(selectedAreas(content, state).map((a) => a.id));
  return content.questions.filter((q) => areas.has(q.area));
};

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
  state.skipped.includes(q.id) || questionFindings(q).every((f) => state.answers[f] !== undefined);

export type Screen =
  | {
      name: "screening";
      area: Area;
      /** 1-based position in the screening pass */
      index: number;
      total: number;
      /** areas already flagged "yes" */
      picked: Area[];
      /** the very first screen — carries the intro */
      first: boolean;
    }
  | {
      name: "question";
      area: Area;
      question: Question;
      /** 1-based position across every picked area */
      index: number;
      total: number;
      answers: Record<string, Presence>;
      canReveal: boolean;
    }
  | {
      name: "results";
      areas: Area[];
      matches: Match[];
      answered: string[];
      answers: Record<string, Presence>;
      /** every question in every picked area has been answered or skipped */
      complete: boolean;
      answeredCount: number;
      skippedCount: number;
    }
  | { name: "summary" };

export function screenOf(content: Content, state: SessionState): Screen {
  if (state.viewingSummary) return { name: "summary" };

  const pending = pendingGate(content, state);
  if (pending && !state.revealed) {
    const answered = content.areas.filter((a) => state.areaGate[a.id] !== undefined).length;
    return {
      name: "screening",
      area: pending,
      index: answered + 1,
      total: content.areas.length,
      picked: selectedAreas(content, state),
      first: answered === 0,
    };
  }

  const areas = selectedAreas(content, state);
  const questions = selectedQuestions(content, state);
  const next = questions.find((q) => !isHandled(q, state)) ?? null;
  const answered = answeredFindings(content, state);
  const answeredCount = questions.filter(
    (q) => !state.skipped.includes(q.id) && questionFindings(q).every((f) => state.answers[f] !== undefined),
  ).length;

  if (next === null || state.revealed) {
    return {
      name: "results",
      areas,
      matches: rankAcross(content, areas.map((a) => a.id), state.answers),
      answered,
      answers: state.answers,
      complete: next === null,
      answeredCount,
      skippedCount: state.skipped.filter((qid) => {
        const q = content.question.get(qid);
        return q !== undefined && areas.some((a) => a.id === q.area);
      }).length,
    };
  }

  const area = content.areas.find((a) => a.id === next.area)!;
  return {
    name: "question",
    area,
    question: next,
    index: questions.filter((q) => isHandled(q, state)).length + 1,
    total: questions.length,
    answers: state.answers,
    canReveal: answered.length > 0,
  };
}

// --- transitions -----------------------------------------------------------

export type SessionAction =
  | { type: "gateArea"; areaId: string; include: boolean }
  | { type: "answerQuestion"; questionId: string; findings: Record<string, Presence> }
  | { type: "skipQuestion"; questionId: string }
  | { type: "setFinding"; finding: string; value: Presence }
  | { type: "clearFinding"; finding: string }
  | { type: "reveal" }
  | { type: "resume" }
  | { type: "back" }
  | { type: "restart" }
  | { type: "editAreas" }
  | { type: "openSummary" }
  | { type: "closeSummary" }
  | { type: "pinFinding"; id: string }
  | { type: "unpinFinding"; id: string }
  | { type: "clearFindings" };

const without = <T,>(list: T[], value: T) => list.filter((v) => v !== value);

const dropAnswers = (answers: Record<string, Presence>, findings: string[]) =>
  Object.fromEntries(Object.entries(answers).filter(([f]) => !findings.includes(f)));

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
    case "gateArea":
      return {
        ...state,
        areaGate: { ...state.areaGate, [action.areaId]: action.include },
        revealed: false,
        viewingSummary: false,
      };

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

    case "editAreas":
      return { ...state, areaGate: {}, revealed: false, viewingSummary: false };

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
      // step back through the screening pass
      const answeredGates = content.areas.filter((a) => state.areaGate[a.id] !== undefined);
      const lastGate = answeredGates[answeredGates.length - 1];
      if (lastGate) {
        const rest = { ...state.areaGate };
        delete rest[lastGate.id];
        return { ...state, areaGate: rest };
      }
      return state;
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
