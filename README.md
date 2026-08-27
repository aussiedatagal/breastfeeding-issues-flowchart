# Breastfeeding Difficulty — guided assessment

A guided quiz for working up breastfeeding difficulty. Pick where the problem
shows up, answer as many questions as you can (in any order, skipping the ones
you can't judge), and get a **ranked list of what fits** — with a fit %, what
matches, what doesn't, and what wasn't asked. No answer removes a diagnosis
unless it makes it genuinely impossible; everything else is scored, not gated.
Each result carries what points to it, first steps, and look-alikes to rule out.

**Educational — for clinicians.** It works up the _breastfeeding_ problem; the
infant's clinical care (hydration, jaundice, weight, top-ups) is assessed and
managed separately, in parallel.

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
content/            YAML — questions + diagnoses with weighted findings (educator-owned)
src/
  content/          zod schema, model, and loader; turns YAML into a validated Content
    schema.ts         the authored shape
    model.ts          the runtime shape (Question / Diagnosis / Finding maps)
    build.ts          buildContent() — validate + normalise, never throws
  quiz/             framework-free scoring engine — unit-tested
    score.ts          rankArea() — score every diagnosis against the answers
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

`map.yaml` lists **areas**. They are independent: the clinician works one at a
time, pins the result to **Findings**, and comes back for another. The output is
a problem list, not a single answer — because pain, low supply and refusal are
not mutually exclusive, and one often causes another.

### Scoring, not walking

There is no decision path. Each question surfaces one or more **findings**
(present / absent / unknown). Each diagnosis declares the findings that
`support` it (weighted), the findings that argue `against` it, and — rarely —
findings that `exclude` it outright. For every diagnosis in the area:

```
score  = Σ present support weight − Σ absent support weight − 1.5 · Σ against weight
fit %  = present support weight ÷ assessed support weight
```

A diagnosis is dropped **only** when a hard `excludes` rule fires (e.g. no fever
⇒ not an abscess). Everything else stays on the list, ranked strong / possible /
weak, with ruled-out diagnoses shown last and the rule that removed them. A
diagnosis with no `supports` is a **diagnosis of exclusion** — it surfaces as a
low-confidence fallback that can never be "confirmed".

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
(`#area=pain&p=pain1,pain9&x=pain2&s=pain5&f=dx-vasospasm`), so a particular
assessment — or its findings list — can be linked or bookmarked. `p` / `x` are
the findings answered present / absent, `s` the skipped questions, `f` the
pinned findings — all keyed by id so a content edit can't silently change what
an old link means.

## Caveats

The clinical content reflects guidance known up to early 2026 — ABM Clinical
Protocols #26 (persistent pain) and #36 (mastitis spectrum, 2022), IBLCE
Detailed Content Outline 2023. Check it against current guidelines before
clinical use. Longer-form source notes are in
`legacy/differential-diagnosis-flowchart.html`.
