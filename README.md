# Breastfeeding Difficulty — guided assessment

A guided quiz for working up breastfeeding difficulty. Run a short yes/no
**screening pass** to flag which problems are in play, answer as many questions
as you can from each (in any order, skipping the ones you can't judge), and get
**one combined list** ranked by a **probability** per diagnosis — what matches,
what doesn't, and what wasn't asked. No answer removes a diagnosis unless it
makes it genuinely impossible; everything else is scored, not gated. Each result
carries what points to it, first steps, and look-alikes to rule out.

**The parent fills in the quiz; the clinician reads the results.** The questions
are in plain language; the diagnoses, probabilities, and clinical detail are for
the health professional. Every diagnosis links to its evidence — the "?" in the
top bar opens a Sources screen.

**Educational.** It works up the _breastfeeding_ problem; the infant's clinical
care (hydration, jaundice, weight, top-ups) is assessed and managed separately,
in parallel.

## Who edits what

| You want to…                                            | Go to                                           |
| ------------------------------------------------------- | ----------------------------------------------- |
| Change a question, a diagnosis, or where a branch leads | [`content/`](content/README.md) — YAML, no code |
| Change how the quiz looks or behaves                    | `src/`                                          |

The clinical content is kept out of the code so an educator can edit it without
a development environment. Every content change is checked by `npm run validate`
before it can be deployed.

## Develop

```
npm install
npm run dev        # http://localhost:5173
```

| Script                | Does                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run dev`         | Vite dev server with hot reload                                                                    |
| `npm run validate`    | Structural check of `content/` (part of `build` and CI)                                            |
| `npm test`            | Vitest — quiz logic, content checks, a render test                                                 |
| `npm run lint`        | ESLint                                                                                             |
| `npm run build`       | `validate` → type-check → production bundle into `dist/`                                           |
| `npm run preview`     | Serve the production build locally                                                                 |
| `npm run screenshots` | Walk the whole quiz at 3 viewports × light/dark, PNGs into `screenshots/` (needs Chrome installed) |

## Architecture

```
content/            YAML — parent-facing questions + clinical diagnoses + references, educator-owned
src/
  content/          zod schema, model, and loader; turns YAML into a validated Content
    schema.ts         the authored shape
    model.ts          the runtime shape (Question / Diagnosis / Finding maps)
    build.ts          buildContent() — validate + normalise, never throws
  quiz/             framework-free scoring engine — unit-tested
    score.ts          rankAcross() — Bayesian posterior per diagnosis across the picked areas
    session.ts        screenOf() + the reducer (pure state machine)
    url.ts            session <-> URL hash
  hooks/            useQuizSession, useTheme
  components/       React + CSS Modules; screens/, quiz/, ui/. No UI framework.
scripts/            validate-content.mjs (CI), screenshots.mjs
legacy/             earlier single-file prototypes, kept for reference
```

`src/content/*` and `src/quiz/*` have no React imports and are covered by unit
tests, so the logic is reasoned about and changed independently of the UI.
Components are wiring and presentation only.

### Problem areas

`map.yaml` lists **areas**, each with one or more yes/no screening questions. A
"yes" to any of an area's questions flags it in; every flagged area is worked in
the same pass and its diagnoses are ranked into one combined list — because
pain, low supply and refusal are not mutually exclusive, and one often causes
another.

### Scoring — a Bayesian classifier

There is no decision path. Each question surfaces one or more **findings**
(present / absent / unknown). Each diagnosis declares a **prior** (roughly how
common it is), the findings that `support` it (weighted 1–5 for evidence
strength), the findings that argue `against` it, and — rarely — findings that
`exclude` it outright. For every diagnosis across the picked areas:

```
logOdds  = ln(prior / (1 − prior))
         + Σ ln(LR+)  for each present supporting finding   (weight → likelihood ratio)
         + Σ ln(LR−)  for each absent  supporting finding
         − Σ ln(LR+)  for each present "against" finding
probability = odds / (1 + odds)
```

Probabilities are **per-diagnosis, not normalised** against each other —
diagnoses co-occur. A diagnosis is dropped **only** when a hard `excludes` rule
fires (e.g. no fever ⇒ not an abscess). Everything else stays on the list,
ranked strong / possible / weak, ruled-out last with the rule that removed them.
A diagnosis with no `supports` is a **diagnosis of exclusion** — it sits at its
prior and can never be "confirmed".

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and publishes `dist/` on every push to
`main`. To enable it once:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main`.

The build reads `GITHUB_REPOSITORY` to set Vite's `base` to `/<repo>/`, so it
works from `https://<user>.github.io/<repo>/` with no manual config. For a
custom domain or a user/org page served from root, set `VITE_BASE=/` in the
workflow.

## State in the URL

The session is written to the URL hash
(`#area=pain,supply&no=refusal&p=pain1,pain9&x=pain2&s=pain5&f=dx-vasospasm`),
so a particular assessment — or its findings list — can be linked or bookmarked.
`area` / `no` are the areas screened in / out, `p` / `x` the findings answered
present / absent, `s` the skipped questions, `f` the pinned findings — all keyed
by id so a content edit can't silently change what an old link means.

## Caveats

The clinical content reflects guidance known up to early 2026 — ABM Clinical
Protocols #26 (persistent pain) and #36 (mastitis spectrum, 2022), IBLCE
Detailed Content Outline 2023. Check it against current guidelines before
clinical use. Longer-form source notes are in
`legacy/differential-diagnosis-flowchart.html`.
