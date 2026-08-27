# Breastfeeding Difficulty — guided assessment

A guided quiz for working up breastfeeding difficulty. Pick where the problem
shows up, answer Yes/No questions, and get a **ranked list of what fits** — best
fit, other possibilities, and everything that was considered and set aside (with
the answer that argues against each). No answer ever removes a diagnosis from
consideration; it only changes the score. Each result carries what points to it,
first steps, and look-alikes to rule out.

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
content/            YAML — the clinical decision tree (educator-owned)
src/
  content/          zod schema + loader; turns YAML into a validated graph
  graph/            framework-free graph model (build.ts, types.ts) — unit-tested
  quiz/             framework-free scoring engine — unit-tested
    profiles.ts       root→leaf tree paths → symptom profiles
    score.ts          rankMatches() — score every diagnosis against the answers
    flow.ts           nextQuestion() — adaptive questioning
    session.ts        screenOf() + the reducer (pure state machine)
    url.ts            session <-> URL hash
  hooks/            useQuizSession, useTheme
  components/       React + CSS Modules; screens/, quiz/, ui/. No UI framework.
scripts/            validate-content.mjs (CI), screenshots.mjs
legacy/             earlier single-file prototypes, kept for reference
```

`src/graph/*` and `src/quiz/*` have no React imports and are covered by unit
tests, so the logic is reasoned about and changed independently of the UI.
Components are wiring and presentation only.

### Problem areas

`map.yaml` lists **problem areas** (`domains`). They are independent: the
clinician works one at a time, pins the result to **Findings**, and comes back
for another. The output is a problem list, not a single answer — because pain,
low supply and refusal are not mutually exclusive, and one often causes another.

### Scoring, not walking

The content is authored as Yes/No trees (natural for educators), but the app
does not walk them as decision paths — that is what lets one early answer gate
whole families of diagnoses out. Instead each root→leaf path is a _symptom
profile_, and every diagnosis in the area is **scored** against the answers so
far: matched findings, missing findings, and _conflicting_ ones. An answer that
disagrees with a profile lowers its score; it never removes the diagnosis. The
results screen ranks the fits and lists everything "considered and set aside"
with the answer that argued against it.

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
(`#area=pain&a=pain1:yes,pain2:no&f=dx-vasospasm,dx-oversupply`), so a particular
assessment — or its findings list — can be linked or bookmarked. Answers are
keyed by question id so a content edit can't silently change what an old link
means.

## Caveats

The clinical content reflects guidance known up to early 2026 — ABM Clinical
Protocols #26 (persistent pain) and #36 (mastitis spectrum, 2022), IBLCE
Detailed Content Outline 2023. Check it against current guidelines before
clinical use. Longer-form source notes are in
`legacy/differential-diagnosis-flowchart.html`.
