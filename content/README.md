# Editing the assessment — for educators

Everything the quiz says lives in this folder as plain text (`.yaml`) files. You
do **not** need to touch any code to change a question, add a diagnosis, or
re-route a branch. Edit a file, save, open a pull request, and the site
rebuilds itself.

Before your change can be published it must pass `npm run validate`, which
checks that every branch points somewhere real and that nothing is orphaned.
The pull request shows you the result; if something is wrong it tells you which
file and which line.

---

## The shape of it

- **Questions** live in `questions/`. Each has an `id`, the text to `ask`, and
  where `ifYes` / `ifNo` lead.
- **Diagnoses** live in `diagnoses/`. Each has an `id`, a `name`, and optional
  `points` (what points to it) and `steps` (first steps).
- **`map.yaml`** holds the page title, the `rootPrompt` shown on the start
  screen, and the list of **problem areas** (`domains`).

The files are split by clinical area only to keep them short — the quiz does not
care which file a node is in, just its `id`. An `id` is a short label with no
spaces (e.g. `pain-at-latch`), unique across every file.

### Problem areas (domains)

The assessment is **not one big tree**. It is several independent question
trees, one per problem area. The clinician works one area at a time, pins the
result, and comes back for another — pain, low supply and refusal are not
mutually exclusive. Each area is listed in `map.yaml`:

```yaml
domains:
  - id: supply # short label, unique
    label: Not enough milk, poor weight gain, or supply feels low # the descriptive line on the picker
    short: Milk supply & weight # 2–4 words — the area's name in the header and result screen
    entry: q1 # the id of the first question in this area's tree
```

`entry` must be the `id` of a question. Everything reachable from that question
by `ifYes` / `ifNo` belongs to that area. Set both `label` (the descriptive
line) and `short` (the name). To add a whole new problem area, add a `domains:`
entry and author its question tree; to reword an area's opening, change `label`
and the `ask:` of its `entry` question.

---

## Common edits

### Change the wording of a question or diagnosis

Find it by its `id` and edit `ask:` (or `name:`, `points:`, `steps:`).

```yaml
- id: intake-adequate
  ask: Is the infant's weight gain and milk output adequate for age?
  short: Intake adequate? # the short label used in the answer trail
  assess: > # shown behind "How do I check this?" on the question
    A diagnostic split, not a safety check …
  ifYes: pain-present
  ifNo: transfer-effective
```

Long text: put `>` after the colon and indent the lines beneath it (as with
`assess:` above). Blank lines become paragraph breaks.

### Re-route a branch

Change `ifYes:` or `ifNo:` to a different `id`.

```yaml
ifNo: transfer-effective # send "No" to this question instead
```

### Add a new question in the middle of a branch

1. Pick a new `id`.
2. Add the question block to whichever `questions/*.yaml` fits.
3. Point an existing question's `ifYes` / `ifNo` at your new `id`.
4. Point your new question's `ifYes` / `ifNo` at what should come next.

### Add a new diagnosis

Add a block to a `diagnoses/*.yaml` file and point a question's branch at it.

```yaml
- id: nipple-dermatitis
  name: Nipple / areolar dermatitis
  flag: often-mislabelled # optional — see "Flags" below
  points:
    - Itch, burning, scale, well-demarcated erythema.
    - Flare after a new cream, breast pad, or detergent.
  steps:
    - Remove candidate allergens; short course of a topical corticosteroid.
  seeAlso: [nipple-trauma] # "distinguish from" — look-alikes, shown as links
  coexists: [nipple-trauma, vasospasm] # "also check" — things that travel with it
```

### How the tree is used — and multifactorial cases

You author each area as a Yes/No tree, but the app **doesn't walk it as a
decision path**. Every route from the entry question to a diagnosis is treated
as a list of findings that indicate that diagnosis. When the clinician answers
questions, _every_ diagnosis in the area is scored against those answers — so a
single "no" early on can't quietly remove a whole branch of possibilities. The
result screen shows a ranked list plus everything "considered and set aside".

What this means for authoring:

- Keep each route a genuine, complete symptom picture for its diagnosis. The
  more real the findings on a path, the better it scores when they're present.
- **`coexists:`** — factors that commonly occur _alongside_ this one. Shown on
  the best-fit result under "Often occurs alongside".
- **`seeAlso:`** — look-alikes to tell apart. Shown under "Distinguish from".
- `multifactorialNote` in `map.yaml` is the standing reminder on the findings
  summary — edit it there.

### Send more than one branch to the same outcome (a shared step)

Two questions can point at the same `id`. If the shared node is defined far away
and you just want a "jump to it" link, wrap the target:

```yaml
ifYes:
  goto: mastitis-ladder
```

### Flags (the coloured diagnoses)

| `flag:`             | Meaning                     | Colour |
| ------------------- | --------------------------- | ------ |
| `do-not-miss`       | serious, act now            | red    |
| `likely-normal`     | reassure and follow up      | green  |
| `often-mislabelled` | a common look-alike/pitfall | amber  |

Leave `flag` off for an ordinary diagnosis.

### Reference notes (look-alikes, not on a path)

A diagnosis with `reference: true` is not part of any yes/no route — it only
appears when it is named in a `seeAlso` (or `coexists`) list. Use it for "X vs
Y" comparison notes. These live in `diagnoses/reference.yaml`.

---

## Checking your work

```
npm run validate     # structural check — must pass to publish
npm run dev           # opens the quiz locally so you can click through it
```

If `npm run dev` shows an error screen instead of the quiz, it lists exactly
what to fix.
