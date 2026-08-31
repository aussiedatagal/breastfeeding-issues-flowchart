import { useState } from "react";
import type { Area, Content, Presence, Question } from "../../content/model.ts";
import { Disclosure } from "../ui/Disclosure.tsx";
import { AnswerGrid } from "../quiz/AnswerGrid.tsx";
import styles from "./QuestionScreen.module.css";

interface Props {
  content: Content;
  area: Area;
  question: Question;
  index: number;
  total: number;
  answers: Record<string, Presence>;
  canReveal: boolean;
  onAnswer: (questionId: string, findings: Record<string, Presence>) => void;
  onSkip: (questionId: string) => void;
  onSetFinding: (finding: string, value: Presence) => void;
  onReveal: () => void;
  onBack: () => void;
}

export function QuestionScreen({
  content,
  area,
  question,
  index,
  total,
  answers,
  canReveal,
  onAnswer,
  onSkip,
  onSetFinding,
  onReveal,
  onBack,
}: Props) {
  return (
    <section className={styles.section} key={question.id}>
      <p className={styles.progress}>
        {area.short ?? area.label} <span className={styles.progressCount}>· question {index} of {total}</span>
      </p>

      <h1 className={styles.question}>{question.ask}</h1>

      {question.assess && (
        <div className={styles.assess}>
          <Disclosure summary="What does this mean?">
            <p>{question.assess}</p>
          </Disclosure>
        </div>
      )}

      <div className={styles.trail}>
        <AnswerGrid content={content} answers={answers} onChange={onSetFinding} />
      </div>

      <div className={styles.spacer} />

      {question.type === "boolean" ? (
        <BooleanAnswers question={question} onAnswer={onAnswer} onSkip={onSkip} />
      ) : (
        <MultiAnswers question={question} onAnswer={onAnswer} onSkip={onSkip} />
      )}

      {canReveal && (
        <button type="button" className={styles.reveal} onClick={onReveal}>
          See what fits so far →
        </button>
      )}

      <button type="button" className={styles.stepBack} onClick={onBack}>
        ← Previous question
      </button>
    </section>
  );
}

function BooleanAnswers({
  question,
  onAnswer,
  onSkip,
}: {
  question: Question;
  onAnswer: (id: string, f: Record<string, Presence>) => void;
  onSkip: (id: string) => void;
}) {
  return (
    <>
      <div className={styles.answers}>
        <button
          type="button"
          className={styles.answer}
          data-answer="yes"
          onClick={() => onAnswer(question.id, { [question.id]: "present" })}
        >
          Yes
        </button>
        <button
          type="button"
          className={styles.answer}
          data-answer="no"
          onClick={() => onAnswer(question.id, { [question.id]: "absent" })}
        >
          No
        </button>
      </div>
      <button type="button" className={styles.skip} onClick={() => onSkip(question.id)}>
        Not sure — skip this one
      </button>
    </>
  );
}

function MultiAnswers({
  question,
  onAnswer,
  onSkip,
}: {
  question: Question;
  onAnswer: (id: string, f: Record<string, Presence>) => void;
  onSkip: (id: string) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (finding: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(finding)) next.delete(finding);
      else next.add(finding);
      return next;
    });

  const submit = () => {
    const findings: Record<string, Presence> = {};
    for (const o of question.options) {
      findings[o.finding] = picked.has(o.finding) ? "present" : "absent";
    }
    onAnswer(question.id, findings);
  };

  return (
    <>
      <ul className={styles.options}>
        {question.options.map((o) => (
          <li key={o.finding}>
            <label className={styles.option} data-on={picked.has(o.finding)}>
              <input
                type="checkbox"
                checked={picked.has(o.finding)}
                onChange={() => toggle(o.finding)}
              />
              <span>{o.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className={styles.multiActions}>
        <button type="button" className={styles.next} onClick={submit}>
          {picked.size === 0 ? "None of these — next" : `Next (${picked.size} selected)`}
        </button>
        <button type="button" className={styles.skip} onClick={() => onSkip(question.id)}>
          Not sure — skip this one
        </button>
      </div>
    </>
  );
}
