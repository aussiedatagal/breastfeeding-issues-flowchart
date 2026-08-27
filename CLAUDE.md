# CLAUDE.md

## What this repo is

A React + TypeScript single-page app (Vite, deployed to GitHub Pages) — a
**guided quiz** for working up breastfeeding difficulty. The clinician picks a
problem area, answers Yes/No questions, and gets a **ranked list of what fits**:
best fit, other possibilities, and everything considered and set aside (with the
answer that argues against each). No answer removes a diagnosis from
consideration — it only changes the score. Audience: clinicians (IBCLCs, GPs,
midwives, NPs, RNs), often chairside with a parent. Educational, not a
substitute for hands-on assessment.

The clinical content is the durable asset. The UI has been rebuilt more than
once; the decision tree in `content/` and the model in `src/graph/` are what
carry over. Predecessors are in `legacy/` (research/reference only, not build
artifacts).

## Layout

```
content/            YAML decision graph — EDUCATOR-OWNED, no code to edit.
                    content/README.md is written for them.
src/content/        zod schema + loader (YAML → validated Graph)
src/graph/          framework-free graph model, unit-tested:
                      build.ts   flat YAML nodes → validated Graph (cycle checks, reachability)
                      types.ts   Graph / QuestionNode / DiagnosisNode + guards
src/quiz/           framework-free quiz engine, unit-tested:
                      profiles.ts  root→leaf paths → symptom profiles + question priority
                      score.ts     rankMatches() — score every diagnosis vs the answers
                      flow.ts      nextQuestion() — adaptive questioning
                      session.ts   screenOf() + the reducer (pure state machine)
                      url.ts       session <-> URL hash
src/hooks/          useQuizSession (session + profiles + hash), useTheme
src/components/     React, no UI framework. Plain CSS Modules + tokens.
                      QuizApp.tsx   orchestrator: TopBar + the current screen
                      screens/      StartScreen · QuestionScreen · ResultsScreen · SummaryScreen
                      quiz/         MatchCard · AnswerGrid · DetailList · RelatedList
                      ui/           Button · Disclosure · Badge · TopBar
scripts/            validate-content.mjs (build + CI), screenshots.mjs (npm run screenshots)
.github/workflows/  deploy.yml (push to main → Pages), ci.yml (PRs)
```

Import style: relative imports carry the `.ts` / `.tsx` extension
(`allowImportingTsExtensions`) so the same modules run under Vite, Vitest, and
`node scripts/*.mjs` with no build step.

## The decision model

- `map.yaml` lists **problem areas** (`domains`), each with an `entry` question.
  They are independent — the clinician works one at a time, pins the result, and
  comes back for another. Findings from all areas build one problem list.
- Within an area, `content/` is authored as a Yes/No **tree** (`ifYes` / `ifNo`,
  or `{ goto: id }` for a convergence). Educators think in trees; it is the
  natural way to write "if this finding, look towards these diagnoses".
- **The app does not walk the tree as a strict decision path.** That is what
  lets one early answer gate whole families of diagnoses out. Instead every
  root→leaf path is read as a _symptom profile_ — see below.
- `build.ts` validates: every branch resolves, no real branch loops onto an
  ancestor, everything is reachable. `depth`/`parents` are assigned for tooling.
- `reference: true` diagnoses (`diagnoses/reference.yaml`) are look-alike /
  concept notes — never a profile, surfaced only through `seeAlso` / `coexists`.

## The quiz engine (`src/quiz/`) — scoring, not walking

- **`profiles.ts` — `buildProfiles(graph)`**: every root→leaf path in every area
  becomes a `Profile { diagnosisId, areaId, findings: {questionId, answer}[] }`.
  A diagnosis reached by several paths gets several profiles.
- **`score.ts` — `rankMatches(graph, profiles, areaId, answers)`**: scores every
  diagnosis in the area against the answers so far. Each profile finding is
  `matched` (answer agrees), `conflicting` (answer disagrees), or `missing` (not
  answered). `score = matched − 3·conflicting − 0.15·missing`, best profile per
  diagnosis wins. **Nothing is removed** — a contradicted diagnosis just scores
  low and shows under "considered and set aside" with the answer that argues
  against it.
- **`flow.ts` — `nextQuestion(...)`**: adaptive. Asks the highest-priority
  question a still-plausible diagnosis is `missing`; stops (`confident`) once a
  clear leader emerges; `probeQuestion` offers any remaining question for
  "answer another question" from the results screen.
- **`session.ts`**: `SessionState { areaId, given: {questionId,answer}[], revealed,
probe, findings, viewingSummary }`. `screenOf` → `start | question | results |
summary`. `reduce` handles `pickArea`, `answer` (upsert — order doesn't matter),
  `unanswer`, `reveal` ("see what fits so far"), `probe` ("answer another"),
  `back`, `restart`, `pin/unpinFinding`, `open/closeSummary`.
- All pure. `useQuizSession` binds it to React + the URL hash
  (`#area=pain&a=pain1:yes,pain2:no&show=1&f=dx-a`).

## Not cutting off other explanations (do not regress without asking)

The whole point of the scoring model above: an answer lowers a diagnosis's
score, it never deletes it. On top of that:

1. **Results screen** shows the ranked list — best fit, other possibilities, and
   a collapsed **"Considered and set aside (N)"** listing every contradicted
   diagnosis with the answer that argued against it, each still pinnable ("add
   anyway").
2. **"Answer more"** keeps offering questions (any remaining in the area, not
   just the leader's) so a _second_ problem in the same area can surface.
3. **The answer grid** on the results screen — every answer is a Yes/No toggle,
   re-scored live, no "rewind".
4. **`coexists`** → "Often occurs alongside"; **`seeAlso`** → "Distinguish from"
   (mimics). Both are peek-able disclosures on the best-fit card.
5. **Findings** — pin any match, "check another area", build a problem list.
   `multifactorialNote` in `map.yaml` frames the summary.

Known limitation: profiles are only as rich as the tree. A pathognomonic first
question (e.g. "pain ONLY in the first 30s of latch") still narrows hard,
because no other diagnosis's tree path includes that answer. Fixing that means
enriching diagnoses with `supports` / `against` findings beyond the tree — a
content change, deferred.

## Interaction

- One screen, one job. Nothing auto-opens, nothing is dragged. No flowchart.
- Mobile-first: full-bleed column, sticky Yes/No at the thumb line, a "see what
  fits so far" shortcut once a few questions are answered. Desktop
  (`min-width: 40rem`) puts the same column in a contained card; buttons flow.
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

- `src/quiz/session.test.ts` — profiles, scoring (incl. "contradicted stays in
  the list"), the adaptive flow, and the reducer, on a tiny fixture graph.
- `src/quiz/content.test.ts` — against real `/content`: every diagnosis has a
  profile; answering an area produces a coherent, uncontradicted top match.
- `src/components/QuizApp.test.tsx` — happy-dom render + full interaction
  (pick area → answer → results → pin → summary; two-area findings list).

`npm run screenshots` (`scripts/screenshots.mjs`, Playwright + your installed
Chrome) serves the build and walks the whole quiz at phone / small-phone /
desktop × light / dark, writing PNGs to `screenshots/` (gitignored). Not a
pass/fail gate — it's for eyeballing every screen after a change — but it does
exit non-zero on a console/page error. Area cards carry `data-area="<id>"` as a
stable hook for it.

## Working here

- `npm run dev` / `npm test` / `npm run validate` / `npm run build`.
- Keep logic in `src/graph/*` and `src/quiz/*` (pure, tested); components are
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
years (esp. ABM #11 ankyloglossia) may have moved.

## Synthesis model behind the content

The literature silos these problems by presenting complaint and by protocol.
The graph is organised mechanism-first: intake adequacy → transfer / production
/ hyperlactation / pain / inflammation / refusal. Cross-cutting look-alikes are
the `reference.yaml` pairs (oversupply stools vs CMPA; vasospasm vs "thrush";
posterior tie vs immaturity; D-MER vs PND; non-resolving mastitis vs
inflammatory breast cancer; fast-flow vs low-supply refusal).
