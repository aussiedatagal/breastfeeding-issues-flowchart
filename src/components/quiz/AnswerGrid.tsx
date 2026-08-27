import { useId, useState } from "react";
import type { Content, Presence } from "../../content/model.ts";
import { findingShort } from "../../content/model.ts";
import styles from "./AnswerGrid.module.css";

interface Props {
  content: Content;
  answers: Record<string, Presence>;
  onChange: (finding: string, value: Presence) => void;
  onClear?: (finding: string) => void;
  /** shown open on the results screen, collapsed on the question screen */
  variant?: "collapsed" | "open";
}

/** Every answer given so far, in a set you can revise in place — order doesn't
 *  matter to the scoring, so nothing "rewinds". */
export function AnswerGrid({ content, answers, onChange, onClear, variant = "collapsed" }: Props) {
  const [open, setOpen] = useState(variant === "open");
  const id = useId();

  const entries = Object.entries(answers) as [string, Presence][];
  if (entries.length === 0) return null;

  const rows = (
    <ul id={id} className={styles.list}>
      {entries.map(([finding, value]) => (
        <li key={finding} className={styles.row}>
          <span className={styles.q}>{findingShort(content, finding)}</span>
          <span className={styles.toggle} role="group" aria-label={findingShort(content, finding)}>
            {(["present", "absent"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={styles.opt}
                data-on={value === v}
                aria-pressed={value === v}
                onClick={() => onChange(finding, v)}
              >
                {v === "present" ? "Yes" : "No"}
              </button>
            ))}
          </span>
          {onClear && (
            <button
              type="button"
              className={styles.clear}
              aria-label={`Clear ${findingShort(content, finding)}`}
              onClick={() => onClear(finding)}
            >
              ×
            </button>
          )}
        </li>
      ))}
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
        {open ? "Hide" : "Show"} your answers ({entries.length})
      </button>
      {open && rows}
    </div>
  );
}
