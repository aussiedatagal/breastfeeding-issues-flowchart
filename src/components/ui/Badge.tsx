import type { Flag } from "../../content/model.ts";
import styles from "./Badge.module.css";

const LABEL: Record<Flag, string> = {
  "do-not-miss": "Do not miss",
  "likely-normal": "Often normal",
  "often-mislabelled": "Commonly mislabelled",
};

/** The coloured flag on a diagnosis. */
export function Badge({ flag }: { flag: Flag }) {
  return (
    <span className={styles.badge} data-flag={flag}>
      {flag === "do-not-miss" && <span className={styles.dot} aria-hidden="true" />}
      {LABEL[flag]}
    </span>
  );
}
