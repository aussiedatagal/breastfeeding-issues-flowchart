# CLAUDE.md

## What this repo is

A React + TypeScript single-page app (Vite, deployed to GitHub Pages) — a
**guided quiz** for working up breastfeeding difficulty. The parent runs a
short **yes/no screening pass** (each area has one or more plain screening
questions — a "yes" to any flags that area in), then answers as many questions
as they can from every flagged area (any order, skipping the ones they can't
judge). The output is **one combined list** ranked by a **posterior
probability** per diagnosis: what matches, what doesn't, what wasn't asked, and
— last — what the answers ruled out and why. No answer removes a diagnosis
unless the answers make it genuinely impossible.

**Audience split:** the **parent fills in the quiz** (screening + questions), so
every `ask` and `assess` is plain, non-medical language. The **clinician reads
the results** — diagnoses, probabilities, `points` / `steps`, look-alikes stay
clinical. `short` is the clinician's shorthand on the results grid. Educational,
not a substitute for hands-on assessment.

The clinical content is the durable asset. The UI and the engine have been
rebuilt more than once; the content in `content/` is what carries over.
Predecessors are in `legacy/` (research/reference only, not build artifacts).

## Layout

```
content/            YAML — EDUCATOR-OWNED, no code to edit. content/README.md is for them.
                      map.yaml         title, intro, areas (each with a screening `ask`), notes
                      questions/*.yaml boolean + multi questions, PARENT-FACING plain language
                      diagnoses/*.yaml diagnoses: a `prior` + weighted findings + `sources`
                      references.yaml  citations shown on the Sources screen
src/content/        zod schema + model + loader:
                      schema.ts   the authored shape (rawQuestion / rawDiagnosis / mapMeta)
                      model.ts    the runtime shape (Question / Diagnosis / Finding + maps)
                      build.ts    buildContent() — validate + normalise, never throws
                      load.ts     assemble the YAML files → buildContent (Vite glob + scripts)
src/quiz/           framework-free engine, unit-tested:
                      score.ts    rankAcross() — Bayesian posterior per diagnosis across the picked areas
                      session.ts  screenOf() + the reducer (pure state machine)
                      url.ts      session <-> URL hash
src/hooks/          useQuizSession (session + hash), useTheme
src/components/     React, no UI framework. Plain CSS Modules + tokens.
                      QuizApp.tsx   orchestrator: TopBar + the current screen
                      screens/      ScreeningScreen · QuestionScreen · ResultsScreen · SummaryScreen
                      quiz/         MatchCard · AnswerGrid · DetailList · RelatedList
                      ui/           Button · Disclosure · Badge · TopBar
scripts/            validate-content.mjs (build + CI), screenshots.mjs (npm run screenshots)
.github/workflows/  deploy.yml (push to main → Pages), ci.yml (PRs)
```

Import style: relative imports carry the `.ts` / `.tsx` extension
(`allowImportingTsExtensions`) so the same modules run under Vite, Vitest, and
`node scripts/*.mjs` with no build step.

## The decision model — a Bayesian classifier, not a tree

There is **no decision tree and no path**. Any tree walk (or tree-derived
scoring) lets one early answer gate whole families of diagnoses out, which was
the recurring complaint about every earlier version.

- `map.yaml` lists **areas**. Each area's `ask` is one string or a list of
  strings — the yes/no screening question(s), each one plain-language and about
  one observable thing. A "yes" to any of an area's questions flags it in (and
  skips its remaining screening questions); it takes "no" to all of them to
  leave the area out. The "yes" areas are worked together into one combined list.
- A **question** surfaces one or more **findings**, each `present` / `absent` /
  `unknown`:
  - `type: boolean` — the question id **is** the finding id. Yes = present,
    No = absent, "Not sure" = skipped.
  - `type: multi` — pick-any; each option is its own finding, unpicked options
    are recorded absent.
  - `showIf: <finding>` (or `{finding, is}`, or a list — AND) hides the question
    from the parent's flow until the condition holds. **This is UI flow only**:
    a hidden question's findings stay `unknown`, so nothing is ruled out by
    hiding it. `pruneHidden` in the reducer clears a question's answers if a
    later edit hides it again. Conditions must point at an earlier question in
    the same area (validated).
- A **diagnosis** declares a `prior` (`common | uncommon | rare | very-rare`, or
  a raw 0–1; default 0.08), `supports: [{finding, weight}]`, `against: [{finding,
  weight}]`, and — rarely — `excludes: [{finding, when}]` (makes it impossible).
  `area` scopes it.
- `reference: true` diagnoses are look-alike / concept notes — never scored,
  surfaced only through `seeAlso` / `coexists`.

### `score.ts` — `rankAcross(content, areaIds, answers)`

Naive-Bayes odds update, per diagnosis, in log space:

```
logOdds  = ln(prior / (1 − prior))
         + Σ ln(LR+  for each present supporting finding)
         + Σ ln(LR−  for each absent  supporting finding)
         − Σ ln(LR+  for each present "against" finding)
probability = odds / (1 + odds)          // 0 if a hard `excludes` fired
```

`weight` 1–5 maps to a likelihood ratio (`LR_PLUS` / `LR_MINUS` tables in
`score.ts`) — 1 ≈ weak, 5 ≈ decisive. Unknown / skipped findings don't move the
odds. The probability is **per-diagnosis, not normalised** across the list —
diagnoses co-occur.

Tiers: `strong` (p ≥ 0.5) · `possible` (p ≥ 0.15) · `unlikely` · `ruled-out`
(a hard `excludes` fired — sorted last, carries `ruledOutBy`). A diagnosis with
**no `supports`** is a `fallback` (diagnosis of exclusion): it sits at its prior
and can never be "confirmed".

### `session.ts`

`SessionState { screenAnswers: Record<`${areaId}:${i}`, boolean>, screenOrder,
handled: qid[], skipped: qid[], answers: Record<finding, Presence>, revealed,
submitted, findings: dxId[], viewingSummary, viewingSources }`. `submitted` (the
forward pass finished once) keeps you on results while revising from the grid,
even if an edit surfaces a `showIf` question. `screenOf` → `screening | question
| results | summary | sources`. `reduce(content, state, action)`
handles `answerScreen` (one screening yes/no),
`answerQuestion` (findings map — order doesn't matter), `skipQuestion`,
`setFinding` / `clearFinding` (revise from the results grid), `reveal` ("see
what fits so far") / `resume`, `back` (undoes the last handled question, then
steps back through the screening pass), `editAreas` (re-run screening, keep
findings), `restart`, `pin` / `unpinFinding`, `open` / `closeSummary`. All pure.
`editAreas` re-runs screening, `openSources` / `closeSources` show the Sources
screen. `useQuizSession` binds it to React + the URL hash
(`#area=pain,supply&no=refusal&p=pain1&x=pain2&s=pain5&show=1&f=dx-a`).

### Sources

`content/references.yaml` is a flat list of `{ id, title, detail?, url? }`. A
diagnosis cites them with `sources: [id]` (validated; shown in its detail). The
TopBar "?" opens the **Sources screen** listing every reference with its link,
plus `map.yaml`'s `evidenceNote`. Priors are currently all the default 0.08 —
real per-diagnosis prevalence data + citations is an open task.

## Not cutting off other explanations (do not regress without asking)

1. **Only `excludes` removes a diagnosis.** `against` and absent supports lower
   the posterior; the diagnosis stays on the list.
2. **Results screen** merges every picked area into one list: best fit /
   possible / a collapsed "weak matches", then a collapsed "ruled out by your
   answers (N)" naming the rule that fired. Each is still pinnable, each carries
   its area label. When nothing rises above "unlikely" the closest few are
   promoted to a "Closest so far" block so the screen is never empty.
3. **Every question is answerable in any order and skippable**; the answer grid
   on the results screen re-scores live, no "rewind".
4. **`coexists`** → "Often occurs alongside"; **`seeAlso`** → "Distinguish from".
5. **Findings** — pin any match, re-screen a different set of areas, build a
   problem list. `multifactorialNote` in `map.yaml` frames it.

Known content gaps (need educator / research work): every diagnosis currently
uses the **default prior** (0.08) — real prevalence data + `sources:` per
diagnosis is an assigned task (see the evidence-sources memory); `supports` /
`against` are minimal; hard `excludes` are not yet authored; `dx-plug`,
`dx-deeppain`, `dx-refuse-unk`, `dx-transfer-unk` are intentional diagnoses of
exclusion (0 supports). Multi questions are supported end-to-end but the real
content is still all `boolean`.

## Interaction

- One screen, one job. Nothing auto-opens, nothing is dragged. No flowchart.
- Mobile-first: full-bleed column, sticky Yes/No at the thumb line, "Not sure —
  skip", a "see what fits so far" shortcut once anything is answered. Desktop
  (`min-width: 40rem`) puts the same column in a contained card.
- The start screen IS the first screening question (with the intro above it) —
  there is no separate landing screen.
- Back is a "‹ Back" link at the top of the content frame (not the TopBar,
  which just carries the wordmark + Findings + "?" + theme).
- Opt-in detail everywhere — "How do I check this?", per-match detail, and the
  look-alikes are collapsed `Disclosure`s.
- `do-not-miss` diagnoses get a red badge / note — but still nothing pops up.

## Scope boundary (user-set)

Works up the **breastfeeding problem only**. The infant's clinical care
(hydration, jaundice, weight, top-ups, admission) is handled separately — there
is **no red-flag / triage gate**. Diagnoses serious in themselves
(cardiorespiratory disease, HSV, inflammatory breast cancer) still exist as
endpoints, flagged `do-not-miss`.

## QA

`npm test` runs vitest:

- `src/quiz/session.test.ts` — the Bayesian scoring (higher prior + confirmed
  findings lifts the posterior; absent support lowers but keeps; only `excludes`
  removes; multi questions; cross-area ranking) and the reducer (screening pass,
  `back` through it, `editAreas`), on a tiny fixture built with `buildFromFiles`.
- `src/quiz/content.test.ts` — against real `/content`: it builds; every scored
  diagnosis references real findings; a whole area answered gives a coherent
  probability ordering; the four diagnoses of exclusion behave as fallbacks.
- `src/components/QuizApp.test.tsx` — happy-dom render + full interaction
  (screening pass → answer / skip → combined results → pin → summary).

`npm run screenshots` (`scripts/screenshots.mjs`, Playwright + your installed
Chrome) serves the build and walks the whole quiz at phone / small-phone /
desktop × light / dark, writing PNGs to `screenshots/` (gitignored). Not a
pass/fail gate — for eyeballing every screen after a change — but it exits
non-zero on a console/page error. Area cards carry `data-area="<id>"` as a
stable hook.

## Working here

- `npm run dev` / `npm test` / `npm run validate` / `npm run build`.
- Keep logic in `src/content/*` and `src/quiz/*` (pure, tested); components are
  wiring + presentation only.
- Content changes: edit `content/*.yaml`; `npm run validate` must pass.
- House style: plain CSS Modules + tokens in `src/styles/tokens.css`, no UI
  framework. Warm oat-paper palette, calm eucalyptus-green accent, clay/honey
  for alerts; IBM Plex Sans for text, Fraunces for display headings, no
  monospace. Spacing + radius scales are tokens. Light and dark are defined
  token-level; keep them in sync. Deliberately soft and non-clinical.

## Clinical caveats

Content reflects guidance known to early 2026 — ABM Clinical Protocols #26
(persistent pain) and #36 (mastitis spectrum, 2022), IBLCE Detailed Content
Outline 2023. Verify against current guidelines before clinical use; protocol
years (esp. ABM #11 ankyloglossia) may have moved. Hard `excludes` rules are a
clinical-safety call — author them against current guidelines, not from memory.

## Synthesis model behind the content

The literature silos these problems by presenting complaint and by protocol.
The content is organised mechanism-first: intake adequacy → transfer / production
/ hyperlactation / pain / inflammation / refusal. Cross-cutting look-alikes are
the `reference: true` pairs (oversupply stools vs CMPA; vasospasm vs "thrush";
posterior tie vs immaturity; D-MER vs PND; non-resolving mastitis vs
inflammatory breast cancer; fast-flow vs low-supply refusal).
