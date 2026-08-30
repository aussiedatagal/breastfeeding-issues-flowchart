import { z } from "zod";

/**
 * The YAML in /content. Educators author **questions** (observations) and
 * **diagnoses** (which findings support / argue against / rule out each one).
 * There is no tree — nothing is gated; every diagnosis is scored against the
 * answers.
 */

export const flag = z.enum(["do-not-miss", "likely-normal", "often-mislabelled"]);
export type Flag = z.infer<typeof flag>;

const id = z.string().min(1);
const text = z.string().min(1);
const list = z.array(text);

/** A weighted reference to a finding: `q-fever` or `{ finding: q-fever, weight: 3 }`. */
export const findingRef = z.union([
  id,
  z.object({ finding: id, weight: z.number().int().min(1).max(5) }).strict(),
]);
export type FindingRef = z.infer<typeof findingRef>;

/** `q-fever` (present rules out) or `{ finding: q-fever, when: absent }`. */
export const exclusion = z.union([
  id,
  z.object({ finding: id, when: z.enum(["present", "absent"]) }).strict(),
]);
export type Exclusion = z.infer<typeof exclusion>;

export const area = z
  .object({
    id,
    label: text,
    short: text.optional(),
    /** yes/no screening question(s) on the start flow. One string, or several —
     *  a "yes" to ANY of them flags the area in. */
    ask: z.union([text, z.array(text).min(1)]).optional(),
  })
  .strict();
export type Area = z.infer<typeof area>;

/** A yes/no question — the question id is the finding id. */
export const booleanQuestion = z
  .object({
    id,
    area: id,
    type: z.literal("boolean"),
    ask: text,
    short: text,
    assess: text.optional(),
  })
  .strict();

/** A pick-any question — each option is its own finding. */
export const multiOption = z.object({ finding: id, label: text, short: text.optional() }).strict();
export const multiQuestion = z
  .object({
    id,
    area: id,
    type: z.literal("multi"),
    ask: text,
    assess: text.optional(),
    options: z.array(multiOption).min(2),
  })
  .strict();

export const rawQuestion = z.discriminatedUnion("type", [booleanQuestion, multiQuestion]);
export type RawQuestion = z.infer<typeof rawQuestion>;

/** how common the diagnosis is among mothers presenting with this problem —
 *  the Bayesian prior. A keyword, or a raw probability 0–1. */
export const prior = z.union([
  z.enum(["common", "uncommon", "rare", "very-rare"]),
  z.number().gt(0).lt(1),
]);
export type Prior = z.infer<typeof prior>;

export const rawDiagnosis = z
  .object({
    id,
    area: id,
    name: text,
    flag: flag.optional(),
    prior: prior.optional(),
    note: text.optional(),
    points: list.optional(),
    steps: list.optional(),
    seeAlso: z.array(id).optional(),
    coexists: z.array(id).optional(),
    supports: z.array(findingRef).optional(),
    against: z.array(findingRef).optional(),
    excludes: z.array(exclusion).optional(),
    /** ids from references.yaml — the evidence behind this entry and its prior */
    sources: z.array(id).optional(),
    /** a look-alike / concept note — never scored, only shown via seeAlso / coexists */
    reference: z.boolean().optional(),
  })
  .strict();
export type RawDiagnosis = z.infer<typeof rawDiagnosis>;

export const mapMeta = z
  .object({
    title: text,
    intro: text,
    areas: z.array(area).min(1),
    multifactorialNote: text.optional(),
    /** standing line shown on the Sources screen */
    evidenceNote: text.optional(),
  })
  .strict();
export type MapMeta = z.infer<typeof mapMeta>;

/** A citation the reader can inspect — listed on the Sources screen and
 *  referenced by `sources: [id]` on a diagnosis. */
export const reference = z
  .object({
    id,
    title: text,
    /** authors · journal · year, free text */
    detail: text.optional(),
    url: z.string().url().optional(),
  })
  .strict();
export type Reference = z.infer<typeof reference>;

export const questionFile = z.array(rawQuestion);
export const diagnosisFile = z.array(rawDiagnosis);
export const referenceFile = z.array(reference);
