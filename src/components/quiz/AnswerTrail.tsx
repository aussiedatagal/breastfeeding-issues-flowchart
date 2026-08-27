import { useId, useState } from "react";
import type { Step } from "../../quiz/session.ts";
import styles from "./AnswerTrail.module.css";

interface Props {
  steps: Step[];
  /** jump back to a step so it can be answered again */
  onGoToStep: (index: number) => void;
  /** "collapsed" on the question screen, "open" on the result screen */
  variant?: "collapsed" | "open";
}

export function AnswerTrail({ steps, onGoToStep, variant = "collapsed" }: Props) {
  const [open, setOpen] = useState(variant === "open");
  const id = useId();
  if (steps.length === 0) return null;

  const list = (
    <ol id={id} className={styles.list}>
      {steps.map((step, i) => (
        <li key={i}>
          <button type="button" className={styles.row} onClick={() => onGoToStep(i)}>
            <span className={styles.q}>{step.question.short}</span>
            <span className={styles.a} data-answer={step.answer}>
              {step.answer === "yes" ? "Yes" : "No"}
            </span>
            <span className={styles.change}>change</span>
          </button>
        </li>
      ))}
    </ol>
  );

  if (variant === "open") {
    return (
      <div className={styles.wrap}>
        <p className={styles.heading}>Answers that led here — tap one to revisit it</p>
        {list}
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-open={open}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.chevron} aria-hidden="true" />
        {open ? "Hide" : "Show"} your answers ({steps.length})
      </button>
      {open && list}
    </div>
  );
}
