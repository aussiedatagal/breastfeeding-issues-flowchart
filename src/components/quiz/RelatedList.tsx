import type { Graph } from "../../graph/types.ts";
import { isDiagnosis } from "../../graph/types.ts";
import { Disclosure } from "../ui/Disclosure.tsx";
import styles from "./RelatedList.module.css";

interface Props {
  title: string;
  blurb: string;
  graph: Graph;
  ids: string[];
}

/**
 * "Often occurs alongside" / "Distinguish from" — each linked diagnosis is a
 * disclosure so the reader can peek at it without leaving the result.
 */
export function RelatedList({ title, blurb, graph, ids }: Props) {
  const nodes = ids.map((id) => graph.nodes.get(id)).filter((n) => n && isDiagnosis(n));
  if (nodes.length === 0) return null;

  return (
    <section className={styles.block}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.blurb}>{blurb}</p>
      <div className={styles.items}>
        {nodes.map(
          (node) =>
            node &&
            isDiagnosis(node) && (
              <Disclosure key={node.id} summary={node.name}>
                {node.points.length > 0 && (
                  <ul className={styles.points}>
                    {node.points.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
                {node.steps.length > 0 && (
                  <p className={styles.steps}>
                    <strong>First step:</strong> {node.steps[0]}
                  </p>
                )}
              </Disclosure>
            ),
        )}
      </div>
    </section>
  );
}
