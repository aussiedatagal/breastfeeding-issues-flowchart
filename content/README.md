# Editing the assessment — for educators

Everything the quiz says lives in this folder as plain text (`.yaml`) files. You
do **not** need to touch any code to change a question, add a diagnosis, or
change what points to it. Edit a file, save, open a pull request, and the site
rebuilds itself.

Before your change can be published it must pass `npm run validate`, which
checks that every finding a diagnosis refers to actually exists and that nothing
is orphaned. The pull request shows you the result; if something is wrong it
tells you which diagnosis and which field.

---

## How the assessment works

There is **no decision tree**. The parent first works through a short yes/no
**screening** pass — each area has one or more plain questions, and a "yes" to
any of them flags that area in. Then they answer as many detail questions as
they can from every flagged area (in any order, skipping the ones they can't
judge). Every diagnosis across those
areas is scored with a small **Bayesian model**:

- it starts from a **prior** — roughly how common that diagnosis is among
  mothers with this problem;
- each answered finding then nudges the probability up or down by how strongly
  that finding speaks (its authored `weight`);
- the result is a **probability** per diagnosis. The list is ranked by it.

A diagnosis is only removed if the answers make it genuinely impossible (a hard
`excludes` rule). Everything else stays, and every mismatch is shown.

So your job as an author is to give each diagnosis a `prior` and describe:

- which **findings support it** (and how strongly),
- which findings **argue against it**,
- which findings make it **impossible** (rare — use with care).

## Who reads what

**The parent fills in the quiz.** Every question (`ask`) and its "What does this
mean?" help (`assess`) must be plain, everyday language — imagine a tired parent
with a crying baby. **The clinician reads the results.** Diagnosis names,
`points`, `steps`, and the look-alikes can stay clinical. `short` is the
clinician's shorthand label on the results grid.

## The files

- **`map.yaml`** — the page title, the intro, the list of **areas** (each with a
  yes/no screening `ask`), the `multifactorialNote`, and the `evidenceNote`
  shown on the Sources screen.
- **`questions/`** — the observations the parent answers. Split by area only to
  keep files short; the app only cares about the `id`.
- **`diagnoses/`** — the diagnoses, with their prior, supporting / opposing
  findings, and `sources`.
- **`references.yaml`** — the citations shown on the Sources screen.

An `id` is a short label with no spaces (e.g. `pain-at-latch`), unique across
every file.

### Areas

```yaml
areas:
  - id: supply # short label, unique
    label: Not enough milk, poor weight gain, or supply feels low # the long line
    short: Milk supply & weight # 2–4 words — the name in the header and results
    ask: # one screening question, or a list — each about ONE observable thing
      - Has your baby been slow to gain weight?
      - Are feeds very long or very frequent?
      - Is your baby rarely settled or content after feeds?
```

`ask` can be a single string or a list. A "yes" to **any** question in the list
flags the area in; it takes "no" to **all** of them to leave it out. Keep each
question plain and about one thing — the parent is answering. Every question and
diagnosis names its `area`; to add an area, add an `areas:` entry (with an
`ask:`) and give its questions and diagnoses that `id`.

---

## Questions

A question surfaces one or more **findings** — the things a diagnosis can point
to. There are two kinds.

### Yes/No (`boolean`)

The question `id` **is** the finding id. "Yes" = the finding is present, "No" =
absent, "Not sure" = skipped (counts as neither).

```yaml
- id: pain-at-latch
  area: pain
  type: boolean
  ask: Does the pain occur ONLY in the first ~30 seconds of latch, then ease?
  short: Pain at latch only? # the label used on the results screen
  assess: > # optional — shown behind "How do I check this?"
    A sharp pinch as the infant draws the nipple in, gone once milk flows …
```

### Pick-any (`multi`)

Use when a question has several independent answers (e.g. _which_ skin change,
or a list of possible triggers). Each option is its own finding; options the
reader doesn't pick are recorded as absent.

```yaml
- id: skin-change-type
  area: pain
  type: multi
  ask: Which skin changes can you see?
  options:
    - { finding: skin-rash, label: A scaly, itchy patch with a clear edge }
    - { finding: skin-vesicles, label: Small blisters grouped together }
    - { finding: skin-bleb, label: A white spot at one point on the nipple }
```

### Only asking when it makes sense (`showIf`)

Add `showIf` so a question is only put to the parent when it's relevant — e.g.
"Is the lump soft or fluid-feeling?" should only appear after "Can you feel a
distinct lump?" is answered yes.

```yaml
- id: inf7
  area: inflammation
  type: boolean
  showIf: inf2 # show only when finding inf2 is present
  ask: Is the lump soft or fluid-feeling and very tender…?
  short: Soft, very tender lump?
```

`showIf` can be a finding id (show when present), `{ finding: inf2, is: absent }`,
or a list (all must hold). It must point at an **earlier** question in the
**same area**. This changes only what the parent sees — a hidden question's
finding stays *unknown*, so it never rules anything out. If the parent later
changes the gating answer, the hidden question's answers are cleared.

---

## Diagnoses

```yaml
- id: dx-dermatitis
  area: pain
  name: Nipple / areolar dermatitis
  flag: often-mislabelled # optional — see "Flags"
  prior: uncommon # common | uncommon | rare | very-rare, or a number 0–1
  points: # "what points to it" in the detail panel
    - Itch, burning, scale, well-demarcated erythema.
  steps: # first steps for the feeding problem
    - Remove candidate allergens; short course of a topical corticosteroid.
  supports:
    - { finding: skin-rash, weight: 3 } # weight 1–5 = how strongly it speaks
    - { finding: pain-between-feeds, weight: 1 }
  against:
    - { finding: pain-at-latch, weight: 2 } # present ⇒ probability down, never removed
  seeAlso: [dx-trauma] # "distinguish from" — look-alikes, shown as links
  coexists: [dx-vasospasm] # "also check" — things that travel with it
```

- **`prior`** — how common the diagnosis is among mothers with this problem.
  Keywords map to `common` ≈ 30%, `uncommon` ≈ 8%, `rare` ≈ 2%, `very-rare`
  ≈ 0.4%; or give a raw number like `0.15`. Default `uncommon`.
- **`supports`** — findings that shift the probability. `weight` 1–5 is how
  strongly the finding speaks (1 ≈ weak nudge, 5 ≈ decisive). A **present**
  supporting finding raises the probability; an **absent** one lowers it; an
  unanswered one does nothing. A diagnosis with no `supports` is a **diagnosis
  of exclusion**: it stays at its prior and is never "confirmed".
- **`against`** — findings that, when **present**, lower the probability. They
  never remove the diagnosis.
- **`excludes`** — findings that make the diagnosis **impossible**. Use
  sparingly and only where it is clinically safe.
- **`sources`** — a list of ids from `references.yaml` (the evidence behind this
  diagnosis and its prior). Shown in the diagnosis's detail and on the Sources
  screen.

### references.yaml

```yaml
- id: abm-36
  title: "ABM Clinical Protocol #36: The Mastitis Spectrum, Revised 2022"
  detail: Mitchell KB, et al. Breastfeeding Medicine 2022;17(5):360–376. # optional
  url: https://doi.org/10.1089/bfm.2022.29207.kbm # optional, must resolve
```

Keep every `url` a real link a reader can open.

  ```yaml
  excludes:
    - { finding: fever, when: absent } # no fever ⇒ this is not possible
    - bilateral-onset # shorthand for  { finding: bilateral-onset, when: present }
  ```

- A shorthand is allowed anywhere a `{ finding, weight }` is expected: a bare
  `finding-id` means weight 2.

### Flags

| `flag:`             | Meaning                     | Colour |
| ------------------- | --------------------------- | ------ |
| `do-not-miss`       | serious, act now            | red    |
| `likely-normal`     | reassure and follow up      | green  |
| `often-mislabelled` | a common look-alike/pitfall | amber  |

### Reference notes

A diagnosis with `reference: true` is never scored — it only appears when named
in a `seeAlso` or `coexists`. Use it for "X vs Y" comparison notes.

### Multifactorial cases

- **`coexists:`** — factors that commonly occur alongside this one. Shown under
  "Often occurs alongside".
- **`seeAlso:`** — look-alikes to tell apart. Shown under "Distinguish from".
- `multifactorialNote` in `map.yaml` is the standing reminder on the results and
  findings screens.

---

## Checking your work

```
npm run validate     # structural check — must pass to publish
npm run dev          # opens the quiz locally so you can click through it
```

Warnings (e.g. "has no supports") don't block publishing but are worth reading.
If `npm run dev` shows an error screen instead of the quiz, it lists exactly
what to fix.
