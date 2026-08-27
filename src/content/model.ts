import type { Area, Flag } from "./schema.ts";

export type { Area, Flag };
export type Presence = "present" | "absent";

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

export interface Question {
  id: string;
  area: string;
  ask: string;
  assess?: string;
  type: "boolean" | "multi";
  /** boolean → one option (finding === question id); multi → the pick list */
  options: QuestionOption[];
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
  note?: string;
  points: string[];
  steps: string[];
  seeAlso: string[];
  coexists: string[];
  supports: WeightedFinding[];
  against: WeightedFinding[];
  excludes: HardExclusion[];
  reference: boolean;
}

export interface Content {
  title: string;
  intro: string;
  multifactorialNote?: string;
  areas: Area[];
  questions: Question[];
  diagnoses: Diagnosis[];
  finding: ReadonlyMap<string, Finding>;
  question: ReadonlyMap<string, Question>;
  diagnosis: ReadonlyMap<string, Diagnosis>;
}

export const findingShort = (content: Content, id: string): string =>
  content.finding.get(id)?.short ?? id;

export const questionsInArea = (content: Content, areaId: string): Question[] =>
  content.questions.filter((q) => q.area === areaId);

export const isReference = (d: Diagnosis) => d.reference;
