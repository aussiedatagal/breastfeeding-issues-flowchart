import type { Answer, QuestionNode } from "../../graph/types.ts";
import type { Route } from "../../quiz/session.ts";
import { Disclosure } from "../ui/Disclosure.tsx";
import { AnswerTrail } from "../quiz/AnswerTrail.tsx";
import styles from "./QuestionScreen.module.css";

interface Props {
  route: Route;
  question: QuestionNode;
  onAnswer: (answer: Answer) => void;
  onGoToStep: (index: number) => void;
}

export function QuestionScreen({ route, question, onAnswer, onGoToStep }: Props) {
  const step = route.steps.length + 1;

  return (
    <section className={styles.section}>
      <p className={styles.progress}>
        {route.area.short ?? route.area.label} · question {step}
      </p>

      <h1 className={styles.question}>{question.ask}</h1>

      {question.assess && (
        <div className={styles.assess}>
          <Disclosure summary="How do I check this?">
            <p>{question.assess}</p>
          </Disclosure>
        </div>
      )}

      {route.steps.length > 0 && (
        <div className={styles.trail}>
          <AnswerTrail steps={route.steps} onGoToStep={onGoToStep} />
        </div>
      )}

      <div className={styles.spacer} />

      <div className={styles.answers}>
        <button
          type="button"
          className={styles.answer}
          data-answer="yes"
          onClick={() => onAnswer("yes")}
        >
          Yes
        </button>
        <button
          type="button"
          className={styles.answer}
          data-answer="no"
          onClick={() => onAnswer("no")}
        >
          No
        </button>
      </div>
    </section>
  );
}
