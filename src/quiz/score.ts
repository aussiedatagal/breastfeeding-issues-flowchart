/**
 * Score every diagnosis in an area against the answers given so far. Nothing is
 * gated: an answer that goes against a diagnosis's profile lowers its score, it
 * never removes it. A diagnosis with more than one profile is scored on its
 * best-matching one.
 *
 * Pure.
 */
import type { Answer, DiagnosisNode, Graph } from "../graph/types.ts";
import { isDiagnosis } from "../graph/types.ts";
import type { Finding, Profile } from "./profiles.ts";

/** questionId → the answer given */
export type Answers = Readonly<Record<string, Answer>>;

export type Tier = "best" | "likely" | "possible" | "unlikely";

export interface Match {
  diagnosis: DiagnosisNode;
  profile: Profile;
  /** profile findings the answers confirm */
  matched: Finding[];
  /** profile findings the answers contradict */
  conflicting: Finding[];
  /** profile findings not answered yet */
  missing: Finding[];
  score: number;
  tier: Tier;
}

const MATCH = 1;
const CONFLICT = 3;
const MISSING = 0.15;

function scoreProfile(profile: Profile, answers: Answers) {
  const matched: Finding[] = [];
  const conflicting: Finding[] = [];
  const missing: Finding[] = [];

  for (const f of profile.findings) {
    const a = answers[f.questionId];
    if (a === undefined) missing.push(f);
    else if (a === f.answer) matched.push(f);
    else conflicting.push(f);
  }

  const score = matched.length * MATCH - conflicting.length * CONFLICT - missing.length * MISSING;
  return { matched, conflicting, missing, score };
}

function tierOf(m: { matched: Finding[]; conflicting: Finding[]; missing: Finding[] }): Tier {
  const { matched, conflicting, missing } = m;
  if (conflicting.length > 0) return "unlikely";
  if (missing.length === 0 && matched.length > 0) return "best";
  if (matched.length >= 2 && missing.length <= 1) return "likely";
  if (matched.length >= 1) return "possible";
  return "possible";
}

/** Ranked matches for one area, best first. */
export function rankMatches(
  graph: Graph,
  profiles: readonly Profile[],
  areaId: string,
  answers: Answers,
): Match[] {
  const byDiagnosis = new Map<string, Profile[]>();
  for (const p of profiles) {
    if (p.areaId !== areaId) continue;
    const list = byDiagnosis.get(p.diagnosisId);
    if (list) list.push(p);
    else byDiagnosis.set(p.diagnosisId, [p]);
  }

  const matches: Match[] = [];
  for (const [diagnosisId, list] of byDiagnosis) {
    const node = graph.nodes.get(diagnosisId);
    if (!node || !isDiagnosis(node)) continue;

    const scored = list
      .map((profile) => ({ profile, ...scoreProfile(profile, answers) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0]!;

    matches.push({
      diagnosis: node,
      profile: best.profile,
      matched: best.matched,
      conflicting: best.conflicting,
      missing: best.missing,
      score: best.score,
      tier: tierOf(best),
    });
  }

  return matches.sort(
    (a, b) => b.score - a.score || a.diagnosis.name.localeCompare(b.diagnosis.name),
  );
}

/**
 * The still-plausible front-runners: no contradicted finding and within reach of
 * the top score. Drives which question to ask next.
 */
export function contenders(matches: Match[]): Match[] {
  const live = matches.filter((m) => m.conflicting.length === 0);
  if (live.length === 0) return matches.slice(0, 1);
  const top = live[0]!.score;
  return live.filter((m) => m.score >= top - 2);
}
