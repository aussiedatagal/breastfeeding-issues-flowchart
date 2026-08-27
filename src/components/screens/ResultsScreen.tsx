import type { Domain, Graph } from "../../graph/types.ts";
import type { Answer, Given } from "../../quiz/session.ts";
import type { Match } from "../../quiz/score.ts";
import { Button } from "../ui/Button.tsx";
import { Disclosure } from "../ui/Disclosure.tsx";
import { MatchCard } from "../quiz/MatchCard.tsx";
import { AnswerGrid } from "../quiz/AnswerGrid.tsx";
import styles from "./ResultsScreen.module.css";

interface Props {
  graph: Graph;
  area: Domain;
  matches: Match[];
  given: Given[];
  exhausted: boolean;
  pinned: (id: string) => boolean;
  multifactorialNote?: string;
  onAnswer: (questionId: string, answer: Answer) => void;
  onPin: (id: string) => void;
  onUnpin: (id: string) => void;
  onAnswerMore: () => void;
  onCheckAnother: () => void;
}

const MAX_OTHERS = 6;
const MAX_AGAINST = 30;

export function ResultsScreen({
  graph,
  area,
  matches,
  given,
  exhausted,
  pinned,
  multifactorialNote,
  onAnswer,
  onPin,
  onUnpin,
  onAnswerMore,
  onCheckAnother,
}: Props) {
  const cardProps = (m: Match) => ({
    graph,
    match: m,
    pinned: pinned(m.diagnosis.id),
    onPin: () => onPin(m.diagnosis.id),
    onUnpin: () => onUnpin(m.diagnosis.id),
  });

  const clean = matches.filter((m) => m.conflicting.length === 0);
  const against = matches.filter((m) => m.conflicting.length > 0);

  const best = clean[0];
  const runnerUp = clean[1] && best && best.score - clean[1].score <= 2 ? clean[1] : undefined;
  const others = clean.slice(runnerUp ? 2 : 1, (runnerUp ? 2 : 1) + MAX_OTHERS);

  const tentative = best && given.length < 3;

  return (
    <section className={styles.section}>
      <h1 className={styles.kicker}>{area.short ?? area.label} · what fits</h1>
      <p className={styles.based}>
        {best
          ? `Based on your ${given.length} answer${given.length === 1 ? "" : "s"}.`
          : "Answer a few questions to see what fits."}
      </p>

      {best && <MatchCard variant="prominent" {...cardProps(best)} />}

      {!exhausted && (
        <button type="button" className={styles.more} onClick={onAnswerMore}>
          {tentative ? "Answer more — this is only a first pass" : "Answer another question"}
          {" →"}
        </button>
      )}

      {runnerUp && (
        <>
          <h2 className={styles.groupHead}>Also a close fit</h2>
          <MatchCard variant="prominent" {...cardProps(runnerUp)} />
        </>
      )}

      {others.length > 0 && (
        <>
          <h2 className={styles.groupHead}>Other possibilities</h2>
          <div className={styles.stack}>
            {others.map((m) => (
              <MatchCard key={m.diagnosis.id} {...cardProps(m)} />
            ))}
          </div>
        </>
      )}

      {against.length > 0 && (
        <div className={styles.against}>
          <Disclosure summary={`Considered and set aside (${against.length})`}>
            <p className={styles.aside}>
              Your answers point away from these — listed so nothing is silently dropped. The note
              is the answer that argues against each.
            </p>
            <div className={styles.minimalStack}>
              {against.slice(0, MAX_AGAINST).map((m) => (
                <MatchCard key={m.diagnosis.id} variant="minimal" {...cardProps(m)} />
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      {multifactorialNote && <p className={styles.multi}>{multifactorialNote}</p>}

      <div className={styles.answers}>
        <AnswerGrid graph={graph} given={given} onChange={onAnswer} variant="open" />
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
