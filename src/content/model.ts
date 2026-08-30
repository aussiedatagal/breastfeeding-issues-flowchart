import type { Flag, Reference } from "./schema.ts";

export type { Flag, Reference };
export type Presence = "present" | "absent";

/** runtime shape of a problem area — `screens` is the normalised list of yes/no
 *  screening questions (always at least one). */
export interface Area {
  id: string;
  label: string;
  short?: string;
  screens: string[];
}

/** One observable thing. A boolean question is a single finding; a multi
 *  question contributes one per option. */
export interface Finding {
  id: string;
  /** short label for the results screen */
  short: string;
  /** the question that surfaces it */
  questionId: string;
}

export interface QuestionOption {
  finding: string;
  label: string;
}

/** a display condition — the question shows only while `finding` has this value */
export interface ShowCondition {
  finding: string;
  is: Presence;
}

export interface Question {
  id: string;
  area: string;
  ask: string;
  assess?: string;
  type: "boolean" | "multi";
  /** boolean → one option (finding === question id); multi → the pick list */
  options: QuestionOption[];
  /** ALL must hold for the question to appear (empty = always). UI flow only —
   *  a hidden question's findings stay unknown, nothing is ruled out. */
  showIf: ShowCondition[];
}

export interface WeightedFinding {
  finding: string;
  weight: number;
}
export interface HardExclusion {
  finding: string;
  when: Presence;
}

export interface Diagnosis {
  id: string;
  area: string;
  name: string;
  flag?: Flag;
  /** Bayesian prior — P(this diagnosis) among mothers with this problem, 0–1 */
  prior: number;
  note?: string;
  points: string[];
  steps: string[];
  seeAlso: string[];
  coexists: string[];
  supports: WeightedFinding[];
  against: WeightedFinding[];
  excludes: HardExclusion[];
  /** reference ids — the evidence behind this diagnosis and its prior */
  sources: string[];
  reference: boolean;
}

export interface Content {
  title: string;
  intro: string;
  multifactorialNote?: string;
  evidenceNote?: string;
  areas: Area[];
  questions: Question[];
  diagnoses: Diagnosis[];
  references: Reference[];
  finding: ReadonlyMap<string, Finding>;
  question: ReadonlyMap<string, Question>;
  diagnosis: ReadonlyMap<string, Diagnosis>;
}

export const findingShort = (content: Content, id: string): string =>
  content.finding.get(id)?.short ?? id;

export const questionsInArea = (content: Content, areaId: string): Question[] =>
  content.questions.filter((q) => q.area === areaId);

export const isReference = (d: Diagnosis) => d.reference;
