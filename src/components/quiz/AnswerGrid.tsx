import { useId, useState } from "react";
import type { Graph } from "../../graph/types.ts";
import { isQuestion } from "../../graph/types.ts";
import type { Answer, Given } from "../../quiz/session.ts";
import styles from "./AnswerGrid.module.css";

interface Props {
  graph: Graph;
  given: Given[];
  onChange: (questionId: string, answer: Answer) => void;
  /** shown open on the results screen, collapsed on the question screen */
  variant?: "collapsed" | "open";
}

/** Every answer given so far, in a set you can revise in place — order doesn't
 *  matter to the scoring, so nothing "rewinds". */
export function AnswerGrid({ graph, given, onChange, variant = "collapsed" }: Props) {
  const [open, setOpen] = useState(variant === "open");
  const id = useId();
  if (given.length === 0) return null;

  const rows = (
    <ul id={id} className={styles.list}>
      {given.map((g) => {
        const q = graph.nodes.get(g.questionId);
        if (!q || !isQuestion(q)) return null;
        return (
          <li key={g.questionId} className={styles.row}>
            <span className={styles.q}>{q.short}</span>
            <span className={styles.toggle} role="group" aria-label={q.short}>
              {(["yes", "no"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  className={styles.opt}
                  data-on={g.answer === a}
                  aria-pressed={g.answer === a}
                  onClick={() => onChange(g.questionId, a)}
                >
                  {a === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );

  if (variant === "open") {
    return (
      <div className={styles.wrap}>
        <p className={styles.heading}>Your answers — tap to change any</p>
        {rows}
      </div>
    );
  }

  return (
    <div className={styles.wrap} data-open={open}>
      <button
        type="button"
        className={styles.summary}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.chevron} aria-hidden="true" />
        {open ? "Hide" : "Show"} your answers ({given.length})
      </button>
      {open && rows}
    </div>
  );
}
