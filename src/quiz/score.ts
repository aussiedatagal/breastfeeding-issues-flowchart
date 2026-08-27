/**
 * Score every diagnosis in an area against the answers. A diagnosis is only
 * removed if one of its `excludes` rules fires (e.g. "no fever ⇒ not this").
 * Otherwise it is ranked by how much of its picture the answers confirm, and
 * every mismatch is reported.
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
  /** confirmed support weight ÷ assessed support weight, 0–100 */
  fitPct: number;
  score: number;
  present: WeightedFinding[];
  absent: WeightedFinding[]; // expected, but answered "no" → doesn't fit
  unknown: WeightedFinding[]; // not asked / skipped
  againstHit: WeightedFinding[]; // an "argues against" finding is present
  ruledOutBy?: HardExclusion;
  /** a diagnosis of exclusion — it has no positive findings of its own */
  fallback: boolean;
}

const AGAINST_PENALTY = 1.5;

const fires = (ex: HardExclusion, answers: Answers) => {
  const a = answers[ex.finding];
  return a !== undefined && a === (ex.when === "present" ? "present" : "absent");
};

const sum = (fs: WeightedFinding[]) => fs.reduce((n, f) => n + f.weight, 0);

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

  const got = sum(present);
  const missed = sum(absent);
  const againstW = sum(againstHit);
  const assessed = got + missed;
  const fitPct = assessed > 0 ? Math.round((100 * got) / assessed) : 0;

  const ruledOutBy = dx.excludes.find((ex) => fires(ex, answers));
  const fallback = dx.supports.length === 0;

  // a diagnosis of exclusion: no findings of its own, so it can't be "confirmed"
  // — it stays on the table until something else is, and its `against` list
  // (patterns that point elsewhere) is what pushes it down.
  const score = fallback ? -AGAINST_PENALTY * againstW : got - missed - AGAINST_PENALTY * againstW;

  let tier: Tier;
  if (ruledOutBy) tier = "ruled-out";
  else if (fallback) tier = againstHit.length > 0 ? "unlikely" : "possible";
  else if (got === 0 || score <= 0) tier = "unlikely";
  else if (score >= 4 && fitPct >= 60 && againstHit.length === 0) tier = "strong";
  else tier = "possible";

  return {
    diagnosis: dx,
    tier,
    fitPct,
    score,
    present,
    absent,
    unknown,
    againstHit,
    fallback,
    ...(ruledOutBy ? { ruledOutBy } : {}),
  };
}

/** Every scored diagnosis in the area, best first (ruled-out last). */
export function rankArea(content: Content, areaId: string, answers: Answers): Match[] {
  return content.diagnoses
    .filter((d) => d.area === areaId && !d.reference)
    .map((d) => scoreDiagnosis(d, answers))
    .sort((a, b) => {
      if ((a.tier === "ruled-out") !== (b.tier === "ruled-out")) {
        return a.tier === "ruled-out" ? 1 : -1;
      }
      return (
        b.score - a.score ||
        b.fitPct - a.fitPct ||
        b.present.length - a.present.length ||
        a.diagnosis.name.localeCompare(b.diagnosis.name)
      );
    });
}
