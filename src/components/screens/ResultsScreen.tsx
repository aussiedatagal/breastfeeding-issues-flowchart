import type { Area, Content, Presence } from "../../content/model.ts";
import type { Match } from "../../quiz/score.ts";
import { Button } from "../ui/Button.tsx";
import { Disclosure } from "../ui/Disclosure.tsx";
import { MatchCard } from "../quiz/MatchCard.tsx";
import { AnswerGrid } from "../quiz/AnswerGrid.tsx";
import styles from "./ResultsScreen.module.css";

interface Props {
  content: Content;
  areas: Area[];
  matches: Match[];
  answers: Record<string, Presence>;
  complete: boolean;
  answeredCount: number;
  skippedCount: number;
  pinned: (id: string) => boolean;
  multifactorialNote?: string;
  onSetFinding: (finding: string, value: Presence) => void;
  onClearFinding: (finding: string) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
  onResume: () => void;
  onEditAreas: () => void;
  onRestart: () => void;
}

export function ResultsScreen({
  content,
  areas,
  matches,
  answers,
  complete,
  answeredCount,
  skippedCount,
  pinned,
  multifactorialNote,
  onSetFinding,
  onClearFinding,
  onPin,
  onUnpin,
  onResume,
  onEditAreas,
  onRestart,
}: Props) {
  const showArea = areas.length > 1;
  const cardProps = (m: Match) => ({
    content,
    match: m,
    showArea,
    pinned: pinned(m.diagnosis.id),
    onPin: () => onPin(m.diagnosis.id),
    onUnpin: () => onUnpin(m.diagnosis.id),
  });

  if (areas.length === 0) {
    return (
      <section className={styles.section}>
        <h1 className={styles.kicker}>Nothing to work up</h1>
        <p className={styles.based}>
          You didn't flag any problem area. Start over to answer the screening questions again.
        </p>
        <div className={styles.actions}>
          <Button variant="primary" block onClick={onEditAreas}>
            Back to screening
          </Button>
        </div>
      </section>
    );
  }

  const strong = matches.filter((m) => m.tier === "strong");
  const possible = matches.filter((m) => m.tier === "possible");
  let unlikely = matches.filter((m) => m.tier === "unlikely");
  const ruledOut = matches.filter((m) => m.tier === "ruled-out");

  const nothingYet = answeredCount === 0;

  // when nothing rises to "possible", promote the closest weak matches so the
  // reader always has something to look at rather than an empty screen
  const closest = strong.length + possible.length === 0 ? unlikely.slice(0, 3) : [];
  if (closest.length > 0) unlikely = unlikely.slice(closest.length);

  const areaNames = areas.map((a) => a.short ?? a.label).join(" · ");

  return (
    <section className={styles.section}>
      <h1 className={styles.kicker}>What fits — {areaNames}</h1>
      <p className={styles.based}>
        {nothingYet
          ? "Answer a few questions to see what fits."
          : `A probability for each diagnosis across ${areas.length === 1 ? "this area" : `${areas.length} areas`}, from your ${answeredCount} answer${answeredCount === 1 ? "" : "s"}` +
            (skippedCount ? ` (${skippedCount} skipped).` : ".") +
            " Nothing is ruled out unless your answers make it impossible."}
      </p>

      {!complete && !nothingYet && (
        <button type="button" className={styles.more} onClick={onResume}>
          Keep answering — more questions sharpen the probabilities →
        </button>
      )}

      {strong.length > 0 && (
        <>
          <h3 className={styles.groupHead}>Best fit</h3>
          <div className={styles.stack}>
            {strong.map((m, i) => (
              <MatchCard key={m.diagnosis.id} prominent={i === 0} {...cardProps(m)} />
            ))}
          </div>
        </>
      )}

      {closest.length > 0 && (
        <>
          <h3 className={styles.groupHead}>Closest so far</h3>
          <p className={styles.based}>
            Nothing stands out yet — these fit your answers best. Answer more to separate them.
          </p>
          <div className={styles.stack}>
            {closest.map((m) => (
              <MatchCard key={m.diagnosis.id} {...cardProps(m)} />
            ))}
          </div>
        </>
      )}

      {possible.length > 0 && (
        <>
          {strong.length > 0 && <h3 className={styles.groupHead}>Also possible</h3>}
          <div className={styles.stack}>
            {possible.map((m, i) => (
              <MatchCard
                key={m.diagnosis.id}
                prominent={i === 0 && strong.length === 0 && !m.fallback}
                {...cardProps(m)}
              />
            ))}
          </div>
        </>
      )}

      {unlikely.length > 0 && (
        <div className={styles.against}>
          <Disclosure summary={`Weak matches (${unlikely.length})`}>
            <p className={styles.aside}>
              Little in your answers points to these, but nothing rules them out.
            </p>
            <div className={styles.stack}>
              {unlikely.map((m) => (
                <MatchCard key={m.diagnosis.id} {...cardProps(m)} />
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      {ruledOut.length > 0 && (
        <div className={styles.against}>
          <Disclosure summary={`Ruled out by your answers (${ruledOut.length})`}>
            <p className={styles.aside}>
              Not possible given what you answered — shown so nothing is silently dropped.
            </p>
            <div className={styles.stack}>
              {ruledOut.map((m) => (
                <MatchCard key={m.diagnosis.id} {...cardProps(m)} />
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      {multifactorialNote && <p className={styles.multi}>{multifactorialNote}</p>}

      <div className={styles.answers}>
        <AnswerGrid
          content={content}
          answers={answers}
          onChange={onSetFinding}
          onClear={onClearFinding}
          variant="open"
        />
      </div>

      <div className={styles.actions}>
        <Button variant="primary" block onClick={onEditAreas}>
          Screen a different set of areas
        </Button>
        <button type="button" className={styles.restart} onClick={onRestart}>
          Start over
        </button>
        <p className={styles.hint}>
          More than one can be in play. Pin what fits to build a problem list.
        </p>
      </div>
    </section>
  );
}
