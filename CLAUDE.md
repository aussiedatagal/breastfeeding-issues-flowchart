# CLAUDE.md

## What this repo is

A React + TypeScript single-page app (Vite, deployed to GitHub Pages) that
renders an **interactive binary decision graph** for working up breastfeeding
difficulty. Audience: clinicians (IBCLCs, physicians, midwives, NPs, RNs). It
is educational content, not a substitute for hands-on assessment.

Predecessors live in `legacy/`:

- `legacy/differential-diagnosis-flowchart.html` — the long-form literature
  synthesis. **Research/reference only**, not a build artifact. Keep it.
- `legacy/breastfeeding-diagnostic-map.html` — the single-file prototype this
  app replaces. `scripts/extract-legacy.mjs` migrated its decision data into
  `content/` (that script is a one-off and can be deleted).

## Layout

```
content/            YAML decision graph — EDUCATOR-OWNED, no code needed to edit.
                    content/README.md is written for them.
src/content/        zod schema + loader (YAML → validated Graph)
src/graph/          framework-free core, unit-tested:
                      build.ts     flat nodes → Graph (canonical parents, merge edges, cycle checks)
                      layout.ts    progressive-disclosure "spine" layout (pure)
                      traversal.ts open / collapse / answer / reveal / path (pure)
                      types.ts     Graph model + guards (isQuestion / isReference / …)
src/hooks/          useDecisionState (+URL hash sync), usePanZoom, useAnimatedLayout, useTheme
src/components/     React + hand-authored SVG. Canvas / NodeShape / StubShape /
                    Connectors / DetailPanel / Breadcrumb / Toolbar / Legend / DecisionMap
scripts/            validate-content.mjs (used by `npm run build` and CI)
.github/workflows/  deploy.yml (push to main → Pages), ci.yml (PRs)
```

Import style: relative imports carry the `.ts` / `.tsx` extension
(`allowImportingTsExtensions`) so the same modules run under Vite, Vitest, and
`node scripts/*.mjs` (Node's native TS) with no build step.

## The decision model

- It is a **DAG, not a tree**. Multiple routes may reach one diagnosis. A node
  is drawn once, under its shortest route from the entry (its _canonical_
  parent); other routes are _merge_ edges, shown dashed with a "↗" stub.
- `content/` is flat: questions reference other nodes by `id` via `ifYes` /
  `ifNo` (or `{ goto: id }` for an explicit jump). `build.ts` does a BFS from
  the entry to assign canonical parents and depths, and flags every other
  incoming edge as a merge.
- `reference: true` diagnoses (in `diagnoses/reference.yaml`) are look-alike /
  comparison notes — not on any path, reachable only from a `seeAlso` link.

## Interaction (do not regress without asking)

- An un-opened branch is a small clickable **"Yes" / "No" stub node** beside its
  parent. Tapping it opens the next node in place; the answer then moves onto
  the **edge** as a clickable "YES/NO" label (tap to undo). The unchosen branch
  stays as its stub, so tapping that also switches the answer.
- Tapping a **node body** opens the detail panel (question: "how to assess" +
  backup Yes/No; diagnosis: points + first steps). Answering via a stub does
  **not** open the panel; reaching a diagnosis opens it automatically.
- The panel is a **non-modal side drawer on desktop** (map, breadcrumb and
  toolbar stay live; no scrim) and a **bottom sheet on mobile** (scrim, and the
  current node is re-framed into the strip above it). It lives inside `.stage`,
  never over the chrome.
- **Expand all** opens every node and fits it to the viewport. Breadcrumb chips
  rewind (`rewindTo`). A merge/`↗` jump is additive — it reveals the shared
  node's route without folding the branch you came from, and a dashed connector
  shows the join. URL hash carries the path _and_ the findings for sharing.

## Multifactorial cases

A single pass down a binary tree only characterises one problem; answering a
question "yes" skips whatever the "no" branch would have surfaced. Handled by:

- **Findings tray** (`FindingsTray`, below the breadcrumb): a pinned problem
  list. Reaching a diagnosis shows "+ Add to findings"; the list persists across
  `restart` and re-runs, and is encoded in the URL hash (`;f=id,id`).
- **`coexists: [ids]`** on a diagnosis (educator-authored) → panel section
  "Often occurs alongside — also check", so the reader is pointed at what the
  tree skipped. Distinct from `seeAlso` ("distinguish from" — mimics).
- **`multifactorialNote`** in `map.yaml` → standing note on every diagnosis.
- Workflow: pin a finding → breadcrumb-rewind to a fork → take the other branch
  → pin again. The output is a problem list, not a single diagnosis.
- Camera: readable zoom by default (centres the current question + its stubs);
  pans to follow the selection only when it drifts out of view; wheel/pinch to
  zoom, drag to pan, ± buttons and Fit. Honours `prefers-reduced-motion`.

## QA harness

`npm test` runs the vitest suites: `src/graph/*.test.ts` (pure logic) and
`src/components/DecisionMap.test.tsx` (happy-dom render + interaction). There is
no browser E2E dep; visual QA was done ad hoc with Playwright against the system
Chrome. Keep the DecisionMap test's scenario list in step with the interaction
rules above.

## Scope boundary (user-set)

The tool diagnoses the **breastfeeding problem only**. The infant's clinical
care (hydration, jaundice, weight, top-ups, admission) is assumed to be handled
separately — there is **no red-flag / triage gate**. Diagnoses that are serious
in themselves (cardiorespiratory disease, HSV, inflammatory breast cancer)
still exist as endpoints, flagged `do-not-miss`.

## Working here

- `npm run dev` / `npm test` / `npm run validate` / `npm run build`.
- Prefer changing `src/graph/*` (pure, tested) over threading logic through
  components. Keep components to wiring.
- Content changes: edit `content/*.yaml`; `npm run validate` must pass.
- Match the existing house style — plain CSS Modules + tokens in
  `src/styles/tokens.css`, no UI framework, IBM Plex faces, 4px radii,
  warm-neutral palette with a single teal-green accent. Both light and dark
  themes are defined token-level; keep them in sync.

## Clinical caveats

Content migrated from the prototype; reflects guidance known to early 2026 (ABM
Protocol #36, 2022, for mastitis). Verify against current guidelines before
clinical use. Protocol years (esp. ABM #11 ankyloglossia) may have moved.

## Synthesis model behind the content

The literature silos these problems by presenting complaint and by protocol.
The graph is organised mechanism-first, which the gate ordering still reflects:
intake adequacy → transfer / production / hyperlactation / pain / inflammation
/ refusal. Cross-cutting patterns are encoded as merge edges and as the
`reference.yaml` look-alike pairs (oversupply stools vs CMPA; vasospasm vs
"thrush"; posterior tie vs immaturity; D-MER vs PND; non-resolving mastitis vs
inflammatory breast cancer; fast-flow vs low-supply refusal).
