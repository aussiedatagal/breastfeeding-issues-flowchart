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

There is **no decision tree**. The clinician picks a problem area, answers as
many questions as they can (in any order, skipping the ones they can't judge),
and every diagnosis in that area is **scored against the answers**. A diagnosis
is only removed from the list if the answers make it genuinely impossible (a
hard `excludes` rule). Everything else is ranked by how much of its picture the
answers confirm, and every mismatch is shown.

So your job as an author is to describe, for each diagnosis:

- which **findings support it** (and how strongly),
- which findings **argue against it**,
- which findings make it **impossible** (rare — use with care).

## The files

- **`map.yaml`** — the page title, the intro on the start screen, the list of
  **areas**, and the standing `multifactorialNote`.
- **`questions/`** — the observations. Split by area only to keep files short;
  the app only cares about the `id`.
- **`diagnoses/`** — the diagnoses, with their supporting / opposing findings.

An `id` is a short label with no spaces (e.g. `pain-at-latch`), unique across
every file.

### Areas

```yaml
areas:
  - id: supply # short label, unique
    label: Not enough milk, poor weight gain, or supply feels low # the line on the picker
    short: Milk supply & weight # 2–4 words — the name in the header and results
```

Every question and diagnosis names its `area`. To add an area, add an `areas:`
entry and give its questions and diagnoses that `id`.

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

Use when a question has several independent answers (e.g. _which_ skin change).
Each option is its own finding; options the reader doesn't pick are recorded as
absent.

```yaml
- id: skin-change-type
  area: pain
  type: multi
  ask: Which skin changes are present?
  options:
    - { finding: skin-rash, label: A scaly, itchy, well-demarcated rash }
    - { finding: skin-vesicles, label: Grouped vesicles or punched-out ulcers }
    - { finding: skin-bleb, label: A white spot at one point on the nipple }
```

---

## Diagnoses

```yaml
- id: dx-dermatitis
  area: pain
  name: Nipple / areolar dermatitis
  flag: often-mislabelled # optional — see "Flags"
  points: # "what points to it" in the detail panel
    - Itch, burning, scale, well-demarcated erythema.
  steps: # first steps for the feeding problem
    - Remove candidate allergens; short course of a topical corticosteroid.
  supports:
    - { finding: skin-rash, weight: 2 } # weight 1–5; 2 is the default
    - { finding: pain-between-feeds, weight: 1 }
  against:
    - { finding: pain-at-latch, weight: 1 } # present ⇒ score down, never removed
  seeAlso: [dx-trauma] # "distinguish from" — look-alikes, shown as links
  coexists: [dx-vasospasm] # "also check" — things that travel with it
```

- **`supports`** — findings that, when **present**, raise the score. `weight`
  1–5 (default 2). A diagnosis with no `supports` is treated as a **diagnosis of
  exclusion**: it stays on the list as a low-confidence fallback and is never
  "confirmed".
- **`against`** — findings that, when **present**, lower the score (penalty
  1.5× weight). They never remove the diagnosis.
- **`excludes`** — findings that make the diagnosis **impossible**. Use
  sparingly and only where it is clinically safe.

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
