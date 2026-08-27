# Breastfeeding Difficulty — guided assessment

A guided quiz for working up breastfeeding difficulty. Pick where the problem
shows up, answer one Yes/No question at a time, and land on a working diagnosis
with what points to it, first steps, look-alikes to rule out, and **what the
path didn't check** — so a single walk down the tree doesn't quietly close out
other explanations.

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

| Script             | Does                                                     |
| ------------------ | -------------------------------------------------------- |
| `npm run dev`      | Vite dev server with hot reload                          |
| `npm run validate` | Structural check of `content/` (part of `build` and CI)  |
| `npm test`         | Vitest — quiz logic, content checks, a render test       |
| `npm run lint`     | ESLint                                                   |
| `npm run build`    | `validate` → type-check → production bundle into `dist/` |
| `npm run preview`  | Serve the production build locally                       |

## Architecture

```
content/            YAML — the clinical decision graph (educator-owned)
src/
  content/          zod schema + loader; turns YAML into a validated graph
  graph/            framework-free graph model (build.ts, types.ts) — unit-tested
  quiz/             framework-free quiz logic — unit-tested
    session.ts        walk() + screenOf() + the reducer (pure state machine)
    analysis.ts       "what the path didn't check" — the confounding-variable safeguard
    url.ts            session <-> URL hash
  hooks/            useQuizSession, useTheme
  components/       React + CSS Modules; screens/, quiz/, ui/. No UI framework.
scripts/            validate-content.mjs (shared with CI)
legacy/             earlier single-file prototypes, kept for reference
```

`src/graph/*` and `src/quiz/*` have no React imports and are covered by unit
tests, so the decision logic is reasoned about and changed independently of the
UI. Components are wiring and presentation only.

### Problem areas

`map.yaml` lists **problem areas** (`domains`). They are independent: the
clinician works one at a time, pins the result to **Findings**, and comes back
for another. The output is a problem list, not a single answer — because pain,
low supply and refusal are not mutually exclusive, and one often causes another.

### Not cutting off other explanations

A single Yes/No walk only characterises one problem. On the result screen,
**"What this path didn't check"** enumerates — for every fork you passed — the
diagnoses the branch you _didn't_ take would have investigated, with a one-tap
"revisit that question". The answer trail is always visible and every answer is
tappable to go back.

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
(`#area=pain&a=yes,no,no&f=dx-vasospasm,dx-oversupply`), so a particular
assessment — or its findings list — can be linked or bookmarked.

## Caveats

The clinical content reflects guidance known up to early 2026 — ABM Clinical
Protocols #26 (persistent pain) and #36 (mastitis spectrum, 2022), IBLCE
Detailed Content Outline 2023. Check it against current guidelines before
clinical use. Longer-form source notes are in
`legacy/differential-diagnosis-flowchart.html`.
