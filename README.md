# Breastfeeding Decision Map

An interactive binary decision graph for working up breastfeeding difficulty.
You answer a question Yes or No and the map opens the next question, until it
reaches a working diagnosis with its discriminating features and first steps.

**Educational — for clinicians.** It diagnoses the _breastfeeding_ problem; the
infant's clinical care (hydration, jaundice, weight, top-ups) is assessed and
managed separately, in parallel.

## Who edits what

| You want to…                                            | Go to                                           |
| ------------------------------------------------------- | ----------------------------------------------- |
| Change a question, a diagnosis, or how branches connect | [`content/`](content/README.md) — YAML, no code |
| Change how the map looks or behaves                     | `src/`                                          |

The clinical content is deliberately kept out of the code so an educator can
edit it without a development environment. Every content change is checked by
`npm run validate` before it can be deployed.

## Develop

```
npm install
npm run dev        # http://localhost:5173
```

| Script             | Does                                                     |
| ------------------ | -------------------------------------------------------- |
| `npm run dev`      | Vite dev server with hot reload                          |
| `npm run validate` | Structural check of `content/` (part of `build` and CI)  |
| `npm test`         | Vitest — graph logic + a render smoke test               |
| `npm run lint`     | ESLint                                                   |
| `npm run build`    | `validate` → type-check → production bundle into `dist/` |
| `npm run preview`  | Serve the production build locally                       |

## Architecture

```
content/            YAML — the clinical decision graph (educator-owned)
src/
  content/          schema (zod) + loader; turns YAML into a validated graph
  graph/            framework-free core:
    build.ts          flat nodes → graph with canonical parents + merge edges
    layout.ts         progressive-disclosure top-down column layout (pure)
    traversal.ts      open / collapse / answer / path (pure)
  hooks/            useDecisionState (+ URL sync), usePanZoom, useAnimatedLayout, useTheme
  components/       React + SVG rendering; no logic beyond wiring
scripts/            validate-content.mjs (shared with CI), extract-legacy.mjs (one-off)
legacy/             the original single-file prototypes, kept for reference
```

The map is **several independent decision trees**, one per problem area
(`domains` in `map.yaml`). The clinician opens every area that applies — pain,
low supply and refusal are not mutually exclusive — and findings accumulate
across all of them into one problem list.

Within a problem area the model is a **DAG, not a tree**: several routes can
reach one diagnosis. Each node is drawn once (under its shortest route from that
area's entry question); the other routes render as dashed "↗" connectors.

`src/graph/*` has no React imports and is covered by unit tests, so the
decision logic can be reasoned about and changed independently of the UI.

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

The current path is written to the URL hash (`#intake-adequate=no,transfer-effective=yes`),
so a particular route to a diagnosis can be linked or bookmarked.

## Caveats

The clinical content was migrated from an earlier prototype and reflects
guidance known up to early 2026 (e.g. ABM Protocol #36, 2022, for the mastitis
spectrum). Check it against current guidelines before clinical use. Longer-form
source notes are in `legacy/differential-diagnosis-flowchart.html`.
