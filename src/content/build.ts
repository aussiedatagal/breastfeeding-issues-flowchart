import {
  diagnosisFile,
  mapMeta,
  questionFile,
  referenceFile,
  type Exclusion,
  type FindingRef,
  type Prior,
  type RawDiagnosis,
  type RawQuestion,
  type Reference,
} from "./schema.ts";
import type {
  Area,
  Content,
  Diagnosis,
  Finding,
  HardExclusion,
  Question,
  ShowCondition,
  WeightedFinding,
} from "./model.ts";

export interface BuildInput {
  meta: unknown;
  questions: unknown[];
  diagnoses: unknown[];
  references: unknown[];
}

export interface BuildResult {
  content?: Content;
  errors: string[];
  warnings: string[];
}

const DEFAULT_WEIGHT = 2;

/** the Bayesian prior a diagnosis gets when it doesn't declare one */
const DEFAULT_PRIOR = 0.08;
const PRIOR_KEYWORD: Record<string, number> = {
  common: 0.3,
  uncommon: 0.08,
  rare: 0.02,
  "very-rare": 0.004,
};

const asPrior = (p: Prior | undefined): number => {
  if (p === undefined) return DEFAULT_PRIOR;
  return typeof p === "number" ? p : PRIOR_KEYWORD[p]!;
};

const asWeighted = (r: FindingRef): WeightedFinding =>
  typeof r === "string" ? { finding: r, weight: DEFAULT_WEIGHT } : r;

const asExclusion = (e: Exclusion): HardExclusion =>
  typeof e === "string" ? { finding: e, when: "present" } : e;

const asConditions = (raw: RawQuestion["showIf"]): ShowCondition[] => {
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((c) => (typeof c === "string" ? { finding: c, is: "present" as const } : c));
};

/** Turn authored content into a validated `Content`. Never throws. */
export function buildContent(input: BuildInput): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const metaParsed = mapMeta.safeParse(input.meta);
  const questionsParsed = questionFile.safeParse(input.questions);
  const diagnosesParsed = diagnosisFile.safeParse(input.diagnoses);
  const referencesParsed = referenceFile.safeParse(input.references);

  for (const [label, res] of [
    ["map.yaml", metaParsed],
    ["questions", questionsParsed],
    ["diagnoses", diagnosesParsed],
    ["references", referencesParsed],
  ] as const) {
    if (!res.success) {
      for (const issue of res.error.issues) {
        errors.push(`${label}: ${issue.path.join(".") || "(root)"} — ${issue.message}`);
      }
    }
  }
  if (
    !metaParsed.success ||
    !questionsParsed.success ||
    !diagnosesParsed.success ||
    !referencesParsed.success
  ) {
    return { errors, warnings };
  }

  const meta = metaParsed.data;
  const rawQuestions: RawQuestion[] = questionsParsed.data;
  const rawDiagnoses: RawDiagnosis[] = diagnosesParsed.data;
  const references: Reference[] = referencesParsed.data;
  const referenceIds = new Set(references.map((r) => r.id));

  const areas: Area[] = meta.areas.map((a) => ({
    id: a.id,
    label: a.label,
    ...(a.short ? { short: a.short } : {}),
    screens:
      a.ask === undefined ? [`${a.label}?`] : Array.isArray(a.ask) ? a.ask : [a.ask],
  }));
  const areaIds = new Set(areas.map((a) => a.id));

  // --- questions + findings ---
  const question = new Map<string, Question>();
  const finding = new Map<string, Finding>();
  const questions: Question[] = [];

  for (const q of rawQuestions) {
    if (question.has(q.id)) errors.push(`duplicate question id "${q.id}"`);
    if (!areaIds.has(q.area)) errors.push(`question "${q.id}": unknown area "${q.area}"`);

    const options =
      q.type === "boolean"
        ? [{ finding: q.id, label: q.ask }]
        : q.options.map((o) => ({ finding: o.finding, label: o.label }));

    const model: Question = {
      id: q.id,
      area: q.area,
      ask: q.ask,
      ...(q.assess ? { assess: q.assess } : {}),
      type: q.type,
      options,
      showIf: asConditions(q.showIf),
    };
    question.set(q.id, model);
    questions.push(model);

    const defs =
      q.type === "boolean"
        ? [{ id: q.id, short: q.short }]
        : q.options.map((o) => ({ id: o.finding, short: o.short ?? o.label }));
    for (const d of defs) {
      if (finding.has(d.id)) errors.push(`duplicate finding id "${d.id}"`);
      finding.set(d.id, { id: d.id, short: d.short, questionId: q.id });
    }
  }

  // showIf conditions must point at a real finding from an EARLIER question in
  // the same area (so the gate is answerable before the gated question)
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i]!;
    const earlier = new Set(
      questions.slice(0, i).flatMap((p) => p.options.map((o) => o.finding)),
    );
    for (const c of q.showIf) {
      const f = finding.get(c.finding);
      if (!f) {
        warnings.push(`question "${q.id}" showIf: unknown finding "${c.finding}"`);
      } else if (question.get(f.questionId)?.area !== q.area) {
        warnings.push(`question "${q.id}" showIf "${c.finding}" is in another area`);
      } else if (!earlier.has(c.finding)) {
        warnings.push(
          `question "${q.id}" showIf "${c.finding}" — that question comes later, so the gate never opens`,
        );
      }
    }
  }

  // --- diagnoses ---
  const diagnosis = new Map<string, Diagnosis>();
  const diagnoses: Diagnosis[] = [];

  const resolveFinding = (dxId: string, fid: string, field: string) => {
    if (!finding.has(fid)) warnings.push(`diagnosis "${dxId}" ${field}: unknown finding "${fid}"`);
  };

  for (const d of rawDiagnoses) {
    if (diagnosis.has(d.id)) errors.push(`duplicate diagnosis id "${d.id}"`);
    if (!areaIds.has(d.area)) errors.push(`diagnosis "${d.id}": unknown area "${d.area}"`);

    const supports = (d.supports ?? []).map(asWeighted);
    const against = (d.against ?? []).map(asWeighted);
    const excludes = (d.excludes ?? []).map(asExclusion);
    const isRef = d.reference === true;

    for (const s of supports) resolveFinding(d.id, s.finding, "supports");
    for (const a of against) resolveFinding(d.id, a.finding, "against");
    for (const e of excludes) resolveFinding(d.id, e.finding, "excludes");

    // a scored finding should come from a question in the diagnosis's area
    for (const s of supports) {
      const f = finding.get(s.finding);
      if (f && question.get(f.questionId)?.area !== d.area) {
        warnings.push(
          `diagnosis "${d.id}" supports "${s.finding}" — from another area, never asked here`,
        );
      }
    }

    if (!isRef && supports.length === 0) {
      warnings.push(
        `diagnosis "${d.id}" has no supports — it will only ever surface as a fallback / ` +
          `diagnosis of exclusion. Add supports unless that is intended.`,
      );
    }

    const sources = d.sources ?? [];
    for (const s of sources) {
      if (!referenceIds.has(s)) warnings.push(`diagnosis "${d.id}" sources: unknown reference "${s}"`);
    }

    const model: Diagnosis = {
      id: d.id,
      area: d.area,
      name: d.name,
      ...(d.flag ? { flag: d.flag } : {}),
      prior: asPrior(d.prior),
      ...(d.note ? { note: d.note } : {}),
      points: d.points ?? [],
      steps: d.steps ?? [],
      seeAlso: d.seeAlso ?? [],
      coexists: d.coexists ?? [],
      supports: isRef ? [] : supports,
      against: isRef ? [] : against,
      excludes: isRef ? [] : excludes,
      sources,
      reference: isRef,
    };
    diagnosis.set(d.id, model);
    diagnoses.push(model);
  }

  for (const d of diagnoses) {
    for (const ref of [...d.seeAlso, ...d.coexists]) {
      if (!diagnosis.has(ref)) warnings.push(`diagnosis "${d.id}": unknown link "${ref}"`);
    }
  }

  if (errors.length) return { errors, warnings };

  const content: Content = {
    title: meta.title,
    intro: meta.intro,
    ...(meta.multifactorialNote ? { multifactorialNote: meta.multifactorialNote } : {}),
    ...(meta.evidenceNote ? { evidenceNote: meta.evidenceNote } : {}),
    areas,
    questions,
    diagnoses,
    references,
    finding,
    question,
    diagnosis,
  };
  return { content, errors, warnings };
}
