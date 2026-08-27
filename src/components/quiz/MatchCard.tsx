import type { Graph } from "../../graph/types.ts";
import { isQuestion } from "../../graph/types.ts";
import type { Match, Tier } from "../../quiz/score.ts";
import type { Finding } from "../../quiz/profiles.ts";
import { Badge } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { Disclosure } from "../ui/Disclosure.tsx";
import { DetailList } from "./DetailList.tsx";
import { RelatedList } from "./RelatedList.tsx";
import styles from "./MatchCard.module.css";

const TIER_LABEL: Record<Tier, string> = {
  best: "Best fit",
  likely: "Likely",
  possible: "Possible",
  unlikely: "Argues against it",
};

interface Props {
  graph: Graph;
  match: Match;
  /** "prominent" = the best-fit hero card, "minimal" = a set-aside one-liner */
  variant?: "prominent" | "card" | "minimal";
  pinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
}

const shortOf = (graph: Graph, questionId: string) => {
  const q = graph.nodes.get(questionId);
  return q && isQuestion(q) ? q.short : questionId;
};

const answered = (graph: Graph, f: Finding) => `${shortOf(graph, f.questionId)} — ${f.answer}`;

/** phrase a contradicted profile finding from the reader's point of view */
const contradicted = (graph: Graph, f: Finding) =>
  `${shortOf(graph, f.questionId)} — ${f.answer === "yes" ? "no" : "yes"}`;

export function MatchCard({ graph, match, variant = "card", pinned, onPin, onUnpin }: Props) {
  const { diagnosis, matched, missing, conflicting, tier } = match;
  const prominent = variant === "prominent";

  if (variant === "minimal") {
    return (
      <article className={styles.minimal} data-flag={diagnosis.flag ?? "none"}>
        <p className={styles.minimalName}>
          {diagnosis.name}
          {conflicting[0] && (
            <span className={styles.minimalWhy}>
              {" · "}
              {shortOf(graph, conflicting[0].questionId)}
            </span>
          )}
        </p>
        {pinned ? (
          <span className={styles.minimalPinned}>in findings</span>
        ) : (
          <button type="button" className={styles.minimalPin} onClick={onPin}>
            Add anyway
          </button>
        )}
      </article>
    );
  }

  const detail = (
    <>
      <DetailList title="What points to it" items={diagnosis.points} />
      <DetailList title="First steps for the feeding problem" items={diagnosis.steps} />
      {prominent && (
        <>
          <RelatedList
            title="Often occurs alongside"
            blurb="Common companions — worth checking even if this explains most of the picture."
            graph={graph}
            ids={diagnosis.coexists}
          />
          <RelatedList
            title="Distinguish from"
            blurb="Look-alikes to rule out before settling on this."
            graph={graph}
            ids={diagnosis.seeAlso}
          />
        </>
      )}
    </>
  );

  return (
    <article className={styles.card} data-tier={tier} data-prominent={prominent}>
      <p className={styles.kicker}>{TIER_LABEL[tier]}</p>
      <h2 className={styles.name}>{diagnosis.name}</h2>
      {diagnosis.flag && (
        <div className={styles.badge}>
          <Badge flag={diagnosis.flag} />
        </div>
      )}

      {conflicting.length > 0 && (
        <p className={styles.against}>
          Doesn't fit: you answered <strong>{contradicted(graph, conflicting[0]!)}</strong>
          {conflicting.length > 1 && ` (+${conflicting.length - 1} more)`}.
        </p>
      )}

      {matched.length > 0 && conflicting.length === 0 && (
        <p className={styles.because}>
          {matched.length > 4
            ? `Consistent with all ${matched.length} of your answers.`
            : `Fits: ${matched.map((f) => answered(graph, f)).join("; ")}.`}
        </p>
      )}

      {prominent && missing.length > 0 && (
        <p className={styles.missing}>
          Not confirmed yet:{" "}
          {missing
            .slice(0, 4)
            .map((f) => shortOf(graph, f.questionId))
            .join("; ")}
          {missing.length > 4 && ` (+${missing.length - 4} more)`}.
        </p>
      )}

      <div className={styles.pin}>
        <Button
          variant={pinned ? "primary" : "secondary"}
          block={prominent}
          onClick={pinned ? onUnpin : onPin}
        >
          {pinned ? "✓ In your findings" : "+ Add to my findings"}
        </Button>
      </div>

      {prominent ? (
        <div className={styles.detail}>{detail}</div>
      ) : (
        <Disclosure summary="Detail">{detail}</Disclosure>
      )}
    </article>
  );
}
