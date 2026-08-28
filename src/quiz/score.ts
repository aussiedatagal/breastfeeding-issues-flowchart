/**
 * Rank the diagnoses across the areas the clinician picked, as a Bayesian
 * classifier.
 *
 * Each diagnosis carries a **prior** — roughly how common it is among mothers
 * presenting with that problem. Each answered finding then shifts the odds by a
 * **likelihood ratio** derived from its authored `weight` (1–5 = how strongly
 * that finding speaks): a present supporting finding multiplies the odds up, an
 * absent one multiplies them down, a finding that argues against multiplies
 * them down when present. Unknown / skipped findings don't move the odds.
 *
 * The result is a posterior probability per diagnosis, 0–1. It is NOT
 * normalised across diagnoses — they co-occur, so each stands on its own.
 *
 * A hard `excludes` rule sets the probability to zero (ruled out).
 *
 * Pure.
 */
import type { Content, Diagnosis, HardExclusion, Presence, WeightedFinding } from "../content/model.ts";

/** findingId → present / absent (absent from the map === not assessed) */
export type Answers = Readonly<Record<string, Presence>>;

export type Tier = "strong" | "possible" | "unlikely" | "ruled-out";

export interface Match {
  diagnosis: Diagnosis;
  tier: Tier;
  /** posterior P(diagnosis | answers), 0–1 */
  probability: number;
  present: WeightedFinding[];
  absent: WeightedFinding[]; // expected, but answered "no" → doesn't fit
  unknown: WeightedFinding[]; // not asked / skipped
  againstHit: WeightedFinding[]; // an "argues against" finding is present
  ruledOutBy?: HardExclusion;
  /** a diagnosis of exclusion — it has no positive findings of its own */
  fallback: boolean;
}

/**
 * Likelihood ratios from an authored weight (1 = weak … 5 = decisive).
 * LR+ applies when a supporting finding is present, LR− when it's absent.
 */
const LR_PLUS = [0, 1.8, 3, 5, 9, 16];
const LR_MINUS = [0, 0.8, 0.62, 0.45, 0.3, 0.15];
const lrPlus = (w: number) => LR_PLUS[Math.max(1, Math.min(5, Math.round(w)))]!;
const lrMinus = (w: number) => LR_MINUS[Math.max(1, Math.min(5, Math.round(w)))]!;

const fires = (ex: HardExclusion, answers: Answers) => {
  const a = answers[ex.finding];
  return a !== undefined && a === (ex.when === "present" ? "present" : "absent");
};

const clampPrior = (p: number) => Math.min(0.9, Math.max(0.001, p));

function scoreDiagnosis(dx: Diagnosis, answers: Answers): Match {
  const present: WeightedFinding[] = [];
  const absent: WeightedFinding[] = [];
  const unknown: WeightedFinding[] = [];
  for (const s of dx.supports) {
    const a = answers[s.finding];
    if (a === undefined) unknown.push(s);
    else if (a === "present") present.push(s);
    else absent.push(s);
  }
  const againstHit = dx.against.filter((g) => answers[g.finding] === "present");

  const prior = clampPrior(dx.prior);
  let logOdds = Math.log(prior / (1 - prior));
  for (const s of present) logOdds += Math.log(lrPlus(s.weight));
  for (const s of absent) logOdds += Math.log(lrMinus(s.weight));
  for (const g of againstHit) logOdds -= Math.log(lrPlus(g.weight));

  const odds = Math.exp(logOdds);
  const ruledOutBy = dx.excludes.find((ex) => fires(ex, answers));
  const probability = ruledOutBy ? 0 : odds / (1 + odds);
  const fallback = dx.supports.length === 0;

  let tier: Tier;
  if (ruledOutBy) tier = "ruled-out";
  else if (fallback) tier = againstHit.length > 0 ? "unlikely" : "possible";
  else if (present.length === 0) tier = "unlikely"; // nothing confirms it yet
  else if (probability >= 0.5) tier = "strong";
  else if (probability >= 0.15) tier = "possible";
  else tier = "unlikely";

  return {
    diagnosis: dx,
    tier,
    probability,
    present,
    absent,
    unknown,
    againstHit,
    fallback,
    ...(ruledOutBy ? { ruledOutBy } : {}),
  };
}

/** Every scored diagnosis across the given areas, most probable first
 *  (ruled-out last). */
export function rankAcross(
  content: Content,
  areaIds: readonly string[],
  answers: Answers,
): Match[] {
  const areas = new Set(areaIds);
  return content.diagnoses
    .filter((d) => areas.has(d.area) && !d.reference)
    .map((d) => scoreDiagnosis(d, answers))
    .sort((a, b) => {
      if ((a.tier === "ruled-out") !== (b.tier === "ruled-out")) {
        return a.tier === "ruled-out" ? 1 : -1;
      }
      return (
        b.probability - a.probability ||
        b.present.length - a.present.length ||
        a.diagnosis.name.localeCompare(b.diagnosis.name)
      );
    });
}
