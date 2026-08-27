import { z } from "zod";

/**
 * Schemas for the YAML that lives in /content. These are the shapes educators
 * author. `npm run validate` and the app loader both check against them, so a
 * typo in the content produces a clear message rather than a broken graph.
 */

export const flag = z.enum(["do-not-miss", "likely-normal", "often-mislabelled"]);
export type Flag = z.infer<typeof flag>;

/** An answer points either at another node's id, or jumps to a shared node. */
export const edgeTarget = z.union([
  z.string().min(1),
  z.object({ goto: z.string().min(1) }).strict(),
]);
export type EdgeTarget = z.infer<typeof edgeTarget>;

export const rawQuestion = z
  .object({
    id: z.string().min(1),
    ask: z.string().min(1),
    short: z.string().min(1).optional(),
    assess: z.string().min(1).optional(),
    ifYes: edgeTarget,
    ifNo: edgeTarget,
  })
  .strict();
export type RawQuestion = z.infer<typeof rawQuestion>;

export const rawDiagnosis = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    flag: flag.optional(),
    note: z.string().min(1).optional(),
    points: z.array(z.string().min(1)).optional(),
    steps: z.array(z.string().min(1)).optional(),
    /** distinguish-from links (look-alikes / mimics) */
    seeAlso: z.array(z.string().min(1)).optional(),
    /**
     * Factors that commonly occur *alongside* this one. Surfaced as "also check"
     * so a multifactorial case isn't closed out at the first diagnosis.
     */
    coexists: z.array(z.string().min(1)).optional(),
    /** true = a look-alike / concept node, not on any yes/no path */
    reference: z.boolean().optional(),
  })
  .strict();
export type RawDiagnosis = z.infer<typeof rawDiagnosis>;

/** An independent problem area with its own decision sub-tree. */
export const domain = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    /** a 2–4 word name for the column header on the map (falls back to `label`) */
    short: z.string().min(1).optional(),
    entry: z.string().min(1),
  })
  .strict();
export type Domain = z.infer<typeof domain>;

export const mapMeta = z
  .object({
    title: z.string().min(1),
    subtitle: z.string().min(1).optional(),
    /** the prompt shown on the "what is going on?" picker */
    rootPrompt: z.string().min(1),
    domains: z.array(domain).min(1),
    /** shown on every diagnosis: the reminder that cases are often multifactorial */
    multifactorialNote: z.string().min(1).optional(),
  })
  .strict();
export type MapMeta = z.infer<typeof mapMeta>;

export const questionFile = z.array(rawQuestion);
export const diagnosisFile = z.array(rawDiagnosis);
