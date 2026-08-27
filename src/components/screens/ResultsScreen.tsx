import type { Area, Content, Presence } from "../../content/model.ts";
import type { Match } from "../../quiz/score.ts";
import { Button } from "../ui/Button.tsx";
import { Disclosure } from "../ui/Disclosure.tsx";
import { MatchCard } from "../quiz/MatchCard.tsx";
import { AnswerGrid } from "../quiz/AnswerGrid.tsx";
import styles from "./ResultsScreen.module.css";

interface Props {
  content: Content;
  area: Area;
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
  onCheckAnother: () => void;
}

export function ResultsScreen({
  content,
  area,
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
  onCheckAnother,
}: Props) {
  const cardProps = (m: Match) => ({
    content,
    match: m,
    pinned: pinned(m.diagnosis.id),
    onPin: () => onPin(m.diagnosis.id),
    onUnpin: () => onUnpin(m.diagnosis.id),
  });

  const strong = matches.filter((m) => m.tier === "strong");
  const possible = matches.filter((m) => m.tier === "possible");
  let unlikely = matches.filter((m) => m.tier === "unlikely");
  const ruledOut = matches.filter((m) => m.tier === "ruled-out");

  const nothingYet = answeredCount === 0;

  // when nothing rises to "possible", promote the closest weak matches so the
  // reader always has something to look at rather than an empty screen
  const closest = strong.length + possible.length === 0 ? unlikely.slice(0, 3) : [];
  if (closest.length > 0) unlikely = unlikely.slice(closest.length);

  return (
    <section className={styles.section}>
      <h1 className={styles.kicker}>{area.short ?? area.label} · what fits</h1>
      <p className={styles.based}>
        {nothingYet
          ? "Answer a few questions to see what fits."
          : `Ranked against your ${answeredCount} answer${answeredCount === 1 ? "" : "s"}` +
            (skippedCount ? ` (${skippedCount} skipped).` : ".") +
            " Nothing is ruled out unless your answers make it impossible."}
      </p>

      {!complete && !nothingYet && (
        <button type="button" className={styles.more} onClick={onResume}>
          Keep answering — more questions sharpen the ranking →
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
        <Button variant="primary" block onClick={onCheckAnother}>
          Check another area
        </Button>
        <p className={styles.hint}>
          More than one can be in play. Pin what fits, then work another area — the result is a
          problem list, not one answer.
        </p>
      </div>
    </section>
  );
}
