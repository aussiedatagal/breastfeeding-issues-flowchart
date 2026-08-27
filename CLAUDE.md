# CLAUDE.md

## What this repo is

A React + TypeScript single-page app (Vite, deployed to GitHub Pages) — a
**guided quiz** for working up breastfeeding difficulty. The clinician picks a
problem area, answers one Yes/No question at a time, and lands on a working
diagnosis with what points to it, first steps, look-alikes, and — importantly —
what the path _didn't_ check. Audience: clinicians (IBCLCs, GPs, midwives, NPs,
RNs), often chairside with a parent. Educational, not a substitute for
hands-on assessment.

The clinical content is the durable asset. The UI has been rebuilt more than
once; the decision graph in `content/` and the pure model in `src/graph/` are
what carry over. Predecessors are in `legacy/` (research/reference only, not
build artifacts).

## Layout

```
content/            YAML decision graph — EDUCATOR-OWNED, no code to edit.
                    content/README.md is written for them.
src/content/        zod schema + loader (YAML → validated Graph)
src/graph/          framework-free graph model, unit-tested:
                      build.ts   flat YAML nodes → validated Graph (cycle checks, reachability)
                      types.ts   Graph / QuestionNode / DiagnosisNode + guards
src/quiz/           framework-free quiz logic, unit-tested:
                      session.ts   walk() + screenOf() + the reducer (pure state machine)
                      analysis.ts  reachableDiagnoses(), untakenBranches() — the "what wasn't checked" analysis
                      url.ts       session <-> URL hash
src/hooks/          useQuizSession (session + hash), useTheme
src/components/     React, no UI framework. Plain CSS Modules + tokens.
                      QuizApp.tsx            orchestrator: TopBar + the current screen
                      screens/               StartScreen · QuestionScreen · ResultScreen · SummaryScreen
                      quiz/                  AnswerTrail · DetailList · RelatedList · OtherPossibilities
                      ui/                    Button · Disclosure · Badge · Chip · TopBar
scripts/            validate-content.mjs (used by `npm run build` and CI)
.github/workflows/  deploy.yml (push to main → Pages), ci.yml (PRs)
```

Import style: relative imports carry the `.ts` / `.tsx` extension
(`allowImportingTsExtensions`) so the same modules run under Vite, Vitest, and
`node scripts/*.mjs` with no build step.

## The decision model

- `map.yaml` lists **problem areas** (`domains`), each with an `entry` question.
  They are independent — the clinician works one at a time and can come back for
  another. Findings from all of them build one problem list.
- Within an area, `content/` is a flat set of questions and diagnoses.
  A question's `ifYes` / `ifNo` name the next node's `id` (or `{ goto: id }` for
  an explicit convergence — several routes reaching one diagnosis).
- `build.ts` validates: every branch resolves, no real branch loops back onto an
  ancestor, everything is reachable. It also assigns `depth`/`parents` (unused by
  the quiz, kept for tooling).
- `reference: true` diagnoses (`diagnoses/reference.yaml`) are look-alike /
  concept notes — never on a Yes/No path, surfaced only through `seeAlso`.

## The quiz (`src/quiz/`)

- **`walk(graph, area, answers)`** follows the graph from an area's entry,
  applying answers one by one. Stops at a diagnosis, a dead end, or a revisited
  node (loop guard). Returns `{ area, steps, current }`.
- **`screenOf(graph, state)`** resolves the current `SessionState` to one of
  `start | question | result | summary`.
- **`reduce`** is the only place state changes: `pickArea`, `answer`, `back`,
  `goToStep` (jump back to a fork), `changeAnswer`, `restart` (new pass, keeps
  findings), `pin/unpinFinding`, `open/closeSummary`.
- All pure. `useQuizSession` binds it to React + syncs the URL hash
  (`#area=pain&a=yes,no&f=dx-a,dx-b`).

## Not cutting off other explanations (do not regress without asking)

A single Yes/No walk characterises one problem and skips whatever the other
branch would have found. Four things keep that visible:

1. **`OtherPossibilities`** on the result screen — for every fork on the path,
   `untakenBranches()` names the diagnoses the un-taken answer would have
   investigated, with a one-tap "revisit that question".
2. **`AnswerTrail`** — the path is always shown and every answer is tappable to
   go back and re-answer it.
3. **`coexists: [ids]`** on a diagnosis → "Often occurs alongside" (common
   companions). Distinct from **`seeAlso`** → "Distinguish from" (mimics).
   Both render as peek-able disclosures.
4. **Findings** — pin a result, "check another area", build a problem list.
   `multifactorialNote` in `map.yaml` frames the summary. Findings persist
   across `restart` and live in the URL hash.

## Interaction

- One screen, one job. The panel/flowchart/pan-zoom of earlier versions is
  gone — nothing auto-opens, nothing needs to be dragged.
- Mobile-first: full-bleed column, sticky Yes/No at the thumb line. Desktop
  (`min-width: 40rem`) puts the same column in a contained card; the answer
  buttons flow in place.
- Opt-in detail everywhere: "How do I check this?" and the look-alikes are
  collapsed `Disclosure`s.
- `do-not-miss` diagnoses get a red badge and a red note callout — but still
  nothing pops up on its own.

## Scope boundary (user-set)

Works up the **breastfeeding problem only**. The infant's clinical care
(hydration, jaundice, weight, top-ups, admission) is handled separately — there
is **no red-flag / triage gate**. Diagnoses serious in themselves
(cardiorespiratory disease, HSV, inflammatory breast cancer) still exist as
endpoints, flagged `do-not-miss`.

## QA

`npm test` runs vitest:

- `src/quiz/session.test.ts`, `analysis.test.ts` — pure logic on a tiny fixture graph.
- `src/quiz/content.test.ts` — against real `/content`: every diagnosis
  reachable, every walk terminates.
- `src/components/QuizApp.test.tsx` — happy-dom render + full interaction
  (pick area → answer → result → pin → summary; two-area findings list).

No browser E2E dep; visual QA is ad hoc with Playwright against system Chrome.

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
