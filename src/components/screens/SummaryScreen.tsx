import type { Content } from "../../content/model.ts";
import { Button } from "../ui/Button.tsx";
import { Disclosure } from "../ui/Disclosure.tsx";
import { Badge } from "../ui/Badge.tsx";
import styles from "./SummaryScreen.module.css";

interface Props {
  content: Content;
  findings: string[];
  multifactorialNote?: string;
  onUnpin: (id: string) => void;
  onClear: () => void;
  onCheckAnother: () => void;
}

export function SummaryScreen({
  content,
  findings,
  multifactorialNote,
  onUnpin,
  onClear,
  onCheckAnother,
}: Props) {
  const items = findings
    .map((id) => content.diagnosis.get(id))
    .filter((d) => d !== undefined);

  const areaLabel = (areaId: string) => {
    const a = content.areas.find((x) => x.id === areaId);
    return a?.short ?? a?.label ?? "";
  };

  return (
    <section>
      <h1 className={styles.title}>Your findings</h1>

      {items.length === 0 ? (
        <p className={styles.empty}>
          Nothing pinned yet. When you reach a working diagnosis, add it here — then work another
          area to build a problem list.
        </p>
      ) : (
        <>
          <p className={styles.lede}>
            {multifactorialNote ??
              "A problem list, not a single answer — more than one factor is often in play."}
          </p>

          <ul className={styles.list}>
            {items.map((node) => (
              <li key={node!.id} className={styles.item}>
                <div className={styles.head}>
                  <span className={styles.dot} data-flag={node!.flag ?? "none"} aria-hidden="true" />
                  <div className={styles.headText}>
                    <p className={styles.name}>{node!.name}</p>
                    <p className={styles.area}>{areaLabel(node!.area)}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => onUnpin(node!.id)}
                    aria-label={`Remove ${node!.name}`}
                  >
                    ×
                  </button>
                </div>

                {node!.flag && (
                  <div className={styles.badge}>
                    <Badge flag={node!.flag} />
                  </div>
                )}

                {node!.steps.length > 0 && (
                  <Disclosure summary="First steps">
                    <ul className={styles.steps}>
                      {node!.steps.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </Disclosure>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className={styles.actions}>
        <Button variant="primary" block onClick={onCheckAnother}>
          Screen another set of areas
        </Button>
        {items.length > 0 && (
          <button type="button" className={styles.clear} onClick={onClear}>
            Clear all findings
          </button>
        )}
      </div>
    </section>
  );
}
