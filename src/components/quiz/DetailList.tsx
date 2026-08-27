import styles from "./DetailList.module.css";

interface Props {
  title: string;
  items: string[];
}

/** A titled bullet list — "What points to it", "First steps", … */
export function DetailList({ title, items }: Props) {
  if (items.length === 0) return null;
  return (
    <section className={styles.block}>
      <h2 className={styles.title}>{title}</h2>
      <ul className={styles.list}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
