import { useEffect, useMemo, useState } from "react";
import type { Content } from "../../content/model.ts";
import { areaDiagram, areaDiagramMeta } from "../../content/graph.ts";
import styles from "./MapScreen.module.css";

/** The content overview — every question, its `showIf` gates, and how each
 *  finding feeds the diagnoses. Mermaid is loaded on demand so it stays out of
 *  the main bundle. */
export function MapScreen({ content }: { content: Content }) {
  const diagrams = useMemo(
    () =>
      content.areas.map((a) => ({
        area: a,
        src: areaDiagram(content, a),
        meta: areaDiagramMeta(content, a),
      })),
    [content],
  );

  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const dark =
    typeof document !== "undefined" &&
    (document.documentElement.dataset.theme === "dark" ||
      (document.documentElement.dataset.theme !== "light" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: dark ? "dark" : "base",
          flowchart: { curve: "basis", useMaxWidth: false },
        });
        const out: Record<string, string> = {};
        for (const d of diagrams) {
          const { svg } = await mermaid.render(`map-${d.area.id}`, d.src);
          out[d.area.id] = svg;
        }
        if (alive) setSvgs(out);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [diagrams, dark]);

  return (
    <section className={styles.section}>
      <h1 className={styles.title}>Content map</h1>
      <p className={styles.lede}>
        Every question and diagnosis. There is <strong>no decision tree</strong>: questions can gate
        each other for the parent's flow (<code>showIf</code>), but every diagnosis is scored on its
        own and nothing is removed unless a hard “rules out” rule fires.
      </p>

      <div className={styles.legend}>
        <span>
          <i className={styles.sw} style={{ borderColor: "#35786a" }} /> supports (weight 1–5)
        </span>
        <span>
          <i className={styles.sw} style={{ borderColor: "#b1503d", borderTopStyle: "dashed" }} />{" "}
          argues against (weight ≥ 2)
        </span>
        <span>
          <i className={styles.sw} style={{ borderColor: "#8a1c1c", borderTopWidth: 4 }} /> rules out
        </span>
        <span>
          <i className={styles.sw} style={{ borderColor: "#8a7f6a", borderTopStyle: "dotted" }} />{" "}
          showIf gate · ☑ multi-select
        </span>
      </div>

      {error && <p className={styles.error}>Couldn't draw the map: {error}</p>}

      {diagrams.map((d) => (
        <section key={d.area.id} className={styles.area}>
          <h2 className={styles.areaName}>{d.area.short ?? d.area.label}</h2>
          <p className={styles.meta}>
            {d.meta.screens} screening · {d.meta.questions} questions · {d.meta.diagnoses} diagnoses
          </p>
          <div className={styles.scroll}>
            {svgs[d.area.id] ? (
              <div className={styles.svg} dangerouslySetInnerHTML={{ __html: svgs[d.area.id]! }} />
            ) : (
              <p className={styles.loading}>Drawing…</p>
            )}
          </div>
        </section>
      ))}
    </section>
  );
}
