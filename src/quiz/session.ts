/**
 * The quiz session — a framework-free state machine.
 *
 * 1. A short yes/no **screening** pass. Each area has one or more screening
 *    questions; a "yes" to any of them flags that area in.
 * 2. The parent answers the questions from every flagged area, in any order,
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

/** `${areaId}:${screenIndex}` */
type ScreenKey = string;
const key = (areaId: string, i: number): ScreenKey => `${areaId}:${i}`;

export interface SessionState {
  /** screening answers, keyed `${areaId}:${screenIndex}` → yes / no */
  screenAnswers: Record<ScreenKey, boolean>;
  /** screening keys in the order they were answered (for `back`) */
  screenOrder: ScreenKey[];
  /** question ids in the order they were answered or skipped */
  handled: string[];
  /** question ids the reader chose to skip ("not sure") */
  skipped: string[];
  /** findingId → present / absent (absent from the map === not assessed) */
  answers: Record<string, Presence>;
  /** the reader asked to see results before working through every question */
  revealed: boolean;
  /** the forward pass finished at least once — stay on results while revising */
  submitted: boolean;
  /** pinned diagnosis ids — the running problem list */
  findings: string[];
  viewingSummary: boolean;
  viewingSources: boolean;
}

export const emptySession = (): SessionState => ({
  screenAnswers: {},
  screenOrder: [],
  handled: [],
  skipped: [],
  answers: {},
  revealed: false,
  submitted: false,
  findings: [],
  viewingSummary: false,
  viewingSources: false,
});

/** which findings a question sets — one for boolean, several for multi */
export const questionFindings = (q: Question): string[] => q.options.map((o) => o.finding);

/** whether a question should appear in the parent's flow right now. A hidden
 *  question's findings stay unknown — nothing is ruled out by hiding it. */
export const isVisible = (q: Question, answers: Record<string, Presence>): boolean =>
  q.showIf.every((c) => answers[c.finding] === c.is);

type Verdict = "in" | "out" | "pending";

/** where an area stands after the screening answers so far */
function areaVerdict(state: SessionState, area: Area): Verdict {
  let answered = 0;
  for (let i = 0; i < area.screens.length; i += 1) {
    const a = state.screenAnswers[key(area.id, i)];
    if (a === true) return "in";
    if (a === false) answered += 1;
  }
  return answered === area.screens.length ? "out" : "pending";
}

/** the areas flagged in, in map order */
export const selectedAreas = (content: Content, state: SessionState): Area[] =>
  content.areas.filter((a) => areaVerdict(state, a) === "in");

/** the next screening question to ask, or undefined when the pass is done */
function pendingScreen(
  content: Content,
  state: SessionState,
): { area: Area; screenIndex: number } | undefined {
  for (const area of content.areas) {
    if (areaVerdict(state, area) !== "pending") continue;
    for (let i = 0; i < area.screens.length; i += 1) {
      if (state.screenAnswers[key(area.id, i)] === undefined) return { area, screenIndex: i };
    }
  }
  return undefined;
}

/** questions from every flagged area, in area then authored order */
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

/** the next question to put in front of the parent, or null when done */
function nextQuestion(content: Content, state: SessionState): Question | null {
  return (
    selectedQuestions(content, state).find(
      (q) => !isHandled(q, state) && isVisible(q, state.answers),
    ) ?? null
  );
}

/** clear answers to questions that are now hidden — so toggling a gate back and
 *  forth from the results grid can't leave a stale answer scoring away. */
function pruneHidden(content: Content, state: SessionState): SessionState {
  let { answers, handled, skipped } = state;
  let changed = true;
  while (changed) {
    changed = false;
    for (const q of content.questions) {
      if (isVisible(q, answers)) continue;
      const fs = questionFindings(q);
      if (fs.some((f) => answers[f] !== undefined) || handled.includes(q.id)) {
        answers = Object.fromEntries(Object.entries(answers).filter(([f]) => !fs.includes(f)));
        handled = handled.filter((id) => id !== q.id);
        skipped = skipped.filter((id) => id !== q.id);
        changed = true;
      }
    }
  }
  return answers === state.answers ? state : { ...state, answers, handled, skipped };
}

export type Screen =
  | {
      name: "screening";
      area: Area;
      /** the specific screening question text */
      ask: string;
      /** which of the area's screening questions this is (0-based) */
      screenIndex: number;
      /** 1-based position in the screening pass so far */
      index: number;
      /** areas already flagged "yes" */
      picked: Area[];
      /** the very first screen — carries the intro */
      first: boolean;
    }
  | {
      name: "question";
      area: Area;
      question: Question;
      /** 1-based position across every flagged area */
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
      /** every question in every flagged area has been answered or skipped */
      complete: boolean;
      answeredCount: number;
      skippedCount: number;
    }
  | { name: "summary" }
  | { name: "sources" };

export function screenOf(content: Content, state: SessionState): Screen {
  if (state.viewingSources) return { name: "sources" };
  if (state.viewingSummary) return { name: "summary" };

  const pending = pendingScreen(content, state);
  if (pending && !state.revealed && !state.submitted) {
    return {
      name: "screening",
      area: pending.area,
      ask: pending.area.screens[pending.screenIndex]!,
      screenIndex: pending.screenIndex,
      index: state.screenOrder.length + 1,
      picked: selectedAreas(content, state),
      first: state.screenOrder.length === 0,
    };
  }

  const areas = selectedAreas(content, state);
  const questions = selectedQuestions(content, state).filter((q) => isVisible(q, state.answers));
  const next = nextQuestion(content, state);
  const answered = answeredFindings(content, state);
  const answeredCount = questions.filter(
    (q) => !state.skipped.includes(q.id) && questionFindings(q).every((f) => state.answers[f] !== undefined),
  ).length;

  if (next === null || state.revealed || state.submitted) {
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
  | { type: "answerScreen"; areaId: string; screenIndex: number; yes: boolean }
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
  | { type: "openSources" }
  | { type: "closeSources" }
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
    case "answerScreen": {
      const k = key(action.areaId, action.screenIndex);
      return {
        ...state,
        screenAnswers: { ...state.screenAnswers, [k]: action.yes },
        screenOrder: state.screenOrder.includes(k)
          ? state.screenOrder
          : [...state.screenOrder, k],
        revealed: false,
        viewingSummary: false,
      };
    }

    case "answerQuestion": {
      const handled = state.handled.includes(action.questionId)
        ? state.handled
        : [...state.handled, action.questionId];
      const next = pruneHidden(content, {
        ...state,
        handled,
        skipped: without(state.skipped, action.questionId),
        answers: { ...state.answers, ...action.findings },
        viewingSummary: false,
      });
      return { ...next, submitted: state.submitted || nextQuestion(content, next) === null };
    }

    case "skipQuestion": {
      const handled = state.handled.includes(action.questionId)
        ? state.handled
        : [...state.handled, action.questionId];
      const next = pruneHidden(content, {
        ...state,
        handled,
        skipped: state.skipped.includes(action.questionId)
          ? state.skipped
          : [...state.skipped, action.questionId],
        viewingSummary: false,
      });
      return { ...next, submitted: state.submitted || nextQuestion(content, next) === null };
    }

    case "setFinding":
      return pruneHidden(content, {
        ...state,
        answers: { ...state.answers, [action.finding]: action.value },
        viewingSummary: false,
      });

    case "clearFinding":
      return pruneHidden(content, {
        ...state,
        answers: dropAnswers(state.answers, [action.finding]),
        viewingSummary: false,
      });

    case "reveal":
      return { ...state, revealed: true, viewingSummary: false };

    case "resume":
      return { ...state, revealed: false, submitted: false, viewingSummary: false };

    case "editAreas":
      return {
        ...state,
        screenAnswers: {},
        screenOrder: [],
        revealed: false,
        submitted: false,
        viewingSummary: false,
      };

    case "openSources":
      return { ...state, viewingSources: true };
    case "closeSources":
      return { ...state, viewingSources: false };

    case "back": {
      if (state.viewingSources) return { ...state, viewingSources: false };
      if (state.viewingSummary) return { ...state, viewingSummary: false };
      if (state.revealed) return { ...state, revealed: false };
      if (state.handled.length > 0) {
        const last = state.handled[state.handled.length - 1]!;
        return {
          ...state,
          submitted: false,
          handled: state.handled.slice(0, -1),
          skipped: without(state.skipped, last),
          answers: dropAnswers(state.answers, findingsOf(content, last)),
        };
      }
      // step back through the screening pass
      const lastKey = state.screenOrder[state.screenOrder.length - 1];
      if (lastKey) {
        const rest = { ...state.screenAnswers };
        delete rest[lastKey];
        return { ...state, screenAnswers: rest, screenOrder: state.screenOrder.slice(0, -1) };
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
