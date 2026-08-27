import { useId, useState, type ReactNode } from "react";
import styles from "./Disclosure.module.css";

interface Props {
  /** the always-visible trigger text, e.g. "How do I check this?" */
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** An accessible show/hide section — used for opt-in detail so the main flow
 *  stays uncluttered. */
export function Disclosure({ summary, children, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className={styles.wrap} data-open={open}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.chevron} aria-hidden="true" />
        {summary}
      </button>
      {open && (
        <div id={id} className={styles.body}>
          {children}
        </div>
      )}
    </div>
  );
}
