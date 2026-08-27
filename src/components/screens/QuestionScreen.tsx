import type { Domain, Graph, QuestionNode } from "../../graph/types.ts";
import type { Answer, Given } from "../../quiz/session.ts";
import { Disclosure } from "../ui/Disclosure.tsx";
import { AnswerGrid } from "../quiz/AnswerGrid.tsx";
import styles from "./QuestionScreen.module.css";

interface Props {
  graph: Graph;
  area: Domain;
  question: QuestionNode;
  answered: number;
  minUseful: number;
  given: Given[];
  onAnswer: (questionId: string, answer: Answer) => void;
  onReveal: () => void;
}

export function QuestionScreen({
  graph,
  area,
  question,
  answered,
  minUseful,
  given,
  onAnswer,
  onReveal,
}: Props) {
  const canReveal = answered >= minUseful;

  return (
    <section className={styles.section}>
      <p className={styles.progress}>
        {area.short ?? area.label} · question {answered + 1}
      </p>

      <h1 className={styles.question}>{question.ask}</h1>

      {question.assess && (
        <div className={styles.assess}>
          <Disclosure summary="How do I check this?">
            <p>{question.assess}</p>
          </Disclosure>
        </div>
      )}

      {given.length > 0 && (
        <div className={styles.trail}>
          <AnswerGrid graph={graph} given={given} onChange={onAnswer} />
        </div>
      )}

      <div className={styles.spacer} />

      <div className={styles.answers}>
        <button
          type="button"
          className={styles.answer}
          data-answer="yes"
          onClick={() => onAnswer(question.id, "yes")}
        >
          Yes
        </button>
        <button
          type="button"
          className={styles.answer}
          data-answer="no"
          onClick={() => onAnswer(question.id, "no")}
        >
          No
        </button>
      </div>
      {canReveal && (
        <button type="button" className={styles.reveal} onClick={onReveal}>
          See what fits so far ({answered} answered) →
        </button>
      )}
    </section>
  );
}
