import type { Content } from "../../content/model.ts";
import styles from "./SourcesScreen.module.css";

export function SourcesScreen({ content }: { content: Content }) {
  return (
    <section>
      <h1 className={styles.title}>Sources</h1>

      {content.evidenceNote && <p className={styles.note}>{content.evidenceNote}</p>}

      {content.references.length === 0 ? (
        <p className={styles.note}>No references recorded yet.</p>
      ) : (
        <ol className={styles.list}>
          {content.references.map((r) => (
            <li key={r.id} className={styles.item}>
              <p className={styles.refTitle}>{r.title}</p>
              {r.detail && <p className={styles.detail}>{r.detail}</p>}
              {r.url && (
                <a className={styles.link} href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.url}
                </a>
              )}
            </li>
          ))}
        </ol>
      )}

      <p className={styles.foot}>
        Clinical content current to early 2026. Verify against current guidelines before clinical
        use.
      </p>
    </section>
  );
}
