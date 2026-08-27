/**
 * Shown when the YAML in /content does not build into a valid graph. Educators
 * see this in `npm run dev` so a typo is obvious rather than a blank screen.
 */
export function ContentError({ errors }: { errors: string[] }) {
  return (
    <div
      style={{
        maxWidth: "42rem",
        margin: "10vh auto",
        padding: "0 1.5rem",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontSize: "var(--step-2)" }}>The decision content has a problem</h1>
      <p style={{ color: "var(--ink-muted)" }}>
        Fix the items below in <code>/content</code>, then reload. This same list comes from{" "}
        <code>npm run validate</code>.
      </p>
      <ul style={{ fontFamily: "var(--font-mono)", fontSize: "var(--step--1)", lineHeight: 1.7 }}>
        {errors.map((error, i) => (
          <li key={i}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
