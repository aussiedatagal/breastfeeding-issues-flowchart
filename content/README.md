# Editing the decision map — for educators

Everything the map says lives in this folder as plain text (`.yaml`) files. You
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
- **`map.yaml`** names the very first question (`entry`) and the page title.

The files are split by clinical area only to keep them short — the map does not
care which file a node is in, just its `id`. An `id` is a short label with no
spaces (e.g. `pain-at-latch`), unique across every file.

---

## Common edits

### Change the wording of a question or diagnosis

Find it by its `id` and edit `ask:` (or `name:`, `points:`, `steps:`).

```yaml
- id: intake-adequate
  ask: Is the infant's weight gain and milk output adequate for age?
  short: Intake adequate? # what shows in the breadcrumb trail
  assess: > # the "How to assess" note in the side panel
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
  seeAlso: [nipple-trauma] # optional — shows as a tappable link in the panel
```

### Send more than one branch to the same outcome (a shared step)

Two questions can point at the same `id` — the map draws it once and shows the
convergence. If the shared node is defined far away and you just want a "jump
to it" link, wrap the target:

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
appears when someone taps a `seeAlso` link. Use it for "X vs Y" comparison
notes. These live in `diagnoses/reference.yaml`.

---

## Checking your work

```
npm run validate     # structural check — must pass to publish
npm run dev           # opens the map locally so you can click through it
```

If `npm run dev` shows an error screen instead of the map, it lists exactly
what to fix.
