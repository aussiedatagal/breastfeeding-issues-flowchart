import type { Content } from "../../content/model.ts";
import { Disclosure } from "../ui/Disclosure.tsx";
import styles from "./RelatedList.module.css";

interface Props {
  title: string;
  blurb: string;
  content: Content;
  ids: string[];
}

/**
 * "Often occurs alongside" / "Distinguish from" — each linked diagnosis is a
 * disclosure so the reader can peek at it without leaving the result.
 */
export function RelatedList({ title, blurb, content, ids }: Props) {
  const items = ids.map((id) => content.diagnosis.get(id)).filter((d) => d !== undefined);
  if (items.length === 0) return null;

  return (
    <section className={styles.block}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.blurb}>{blurb}</p>
      <div className={styles.items}>
        {items.map((node) => (
          <Disclosure key={node!.id} summary={node!.name}>
            {node!.points.length > 0 && (
              <ul className={styles.points}>
                {node!.points.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
            {node!.steps.length > 0 && (
              <p className={styles.steps}>
                <strong>First step:</strong> {node!.steps[0]}
              </p>
            )}
          </Disclosure>
        ))}
      </div>
    </section>
  );
}
