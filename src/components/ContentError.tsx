/**
 * Shown when the YAML in /content does not build into a valid graph. Educators
 * see this in `npm run dev` so a typo is obvious rather than a blank screen.
 * The same list comes from `npm run validate`.
 */
export function ContentError({ errors }: { errors: string[] }) {
  return (
    <div
      style={{
        maxWidth: "34rem",
        margin: "10vh auto",
        padding: "0 1.5rem",
        fontFamily: "var(--font-sans)",
      }}
    >
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--step-3)" }}>
        The decision content has a problem
      </h1>
      <p style={{ color: "var(--ink-muted)" }}>
        Fix the items below in <code>/content</code>, then reload.
      </p>
      <ul style={{ fontSize: "var(--step--1)", lineHeight: 1.8, color: "var(--danger)" }}>
        {errors.map((error, i) => (
          <li key={i}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
