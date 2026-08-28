import type { Content } from "../../content/model.ts";
import { findingShort } from "../../content/model.ts";
import type { Match, Tier } from "../../quiz/score.ts";
import { Badge } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { Disclosure } from "../ui/Disclosure.tsx";
import { DetailList } from "./DetailList.tsx";
import { RelatedList } from "./RelatedList.tsx";
import styles from "./MatchCard.module.css";

const TIER_LABEL: Record<Tier, string> = {
  strong: "Strong fit",
  possible: "Possible",
  unlikely: "Weak fit",
  "ruled-out": "Ruled out",
};

interface Props {
  content: Content;
  match: Match;
  /** the hero treatment for a top strong match */
  prominent?: boolean;
  /** show the area label — the result list spans more than one area */
  showArea?: boolean;
  pinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
}

const labels = (content: Content, list: { finding: string }[]) =>
  list.map((f) => findingShort(content, f.finding));

export function MatchCard({
  content,
  match,
  prominent = false,
  showArea = false,
  pinned,
  onPin,
  onUnpin,
}: Props) {
  const { diagnosis, tier, probability, present, absent, unknown, againstHit, ruledOutBy, fallback } =
    match;
  const ruledOut = tier === "ruled-out";
  const pct = Math.round(probability * 100);
  const areaLabel = showArea
    ? (content.areas.find((a) => a.id === diagnosis.area)?.short ?? diagnosis.area)
    : null;

  const sourceTitles = diagnosis.sources
    .map((id) => content.references.find((r) => r.id === id))
    .filter((r) => r !== undefined);

  const detail = (
    <>
      <DetailList title="What points to it" items={diagnosis.points} />
      <DetailList title="First steps for the feeding problem" items={diagnosis.steps} />
      <RelatedList
        title="Often occurs alongside"
        blurb="Common companions — worth checking even if this explains most of the picture."
        content={content}
        ids={diagnosis.coexists}
      />
      <RelatedList
        title="Distinguish from"
        blurb="Look-alikes to rule out before settling on this."
        content={content}
        ids={diagnosis.seeAlso}
      />
      {sourceTitles.length > 0 && (
        <DetailList title="Sources" items={sourceTitles.map((r) => r!.title)} />
      )}
    </>
  );

  return (
    <article className={styles.card} data-tier={tier} data-prominent={prominent}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <p className={styles.kicker}>
            {TIER_LABEL[tier]}
            {areaLabel && <span className={styles.area}> · {areaLabel}</span>}
          </p>
          <h2 className={styles.name}>{diagnosis.name}</h2>
        </div>
        {!ruledOut && (
          <div className={styles.fit} aria-label={`Probability ${pct} percent`}>
            <span className={styles.fitPct}>{pct}%</span>
            <span className={styles.fitWord}>likely</span>
          </div>
        )}
      </div>

      {!ruledOut && (
        <div className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      )}

      {fallback && !ruledOut && (
        <p className={styles.unknown}>
          A diagnosis of exclusion — nothing confirms it directly. Consider it once the options
          above are worked through and don't fit.
        </p>
      )}

      {diagnosis.flag && (
        <div className={styles.badge}>
          <Badge flag={diagnosis.flag} />
        </div>
      )}

      {ruledOutBy && (
        <p className={styles.ruledOut}>
          Not possible with your answers: <strong>{findingShort(content, ruledOutBy.finding)}</strong>{" "}
          answered {ruledOutBy.when === "present" ? "yes" : "no"}.
        </p>
      )}

      {!ruledOut && present.length > 0 && (
        <p className={styles.fits}>
          <span className={styles.lead}>Fits</span> {labels(content, present).join(", ")}.
        </p>
      )}

      {!ruledOut && (absent.length > 0 || againstHit.length > 0) && (
        <p className={styles.mismatch}>
          <span className={styles.lead}>Doesn't fit</span>{" "}
          {[...labels(content, absent), ...labels(content, againstHit)].join(", ")}.
        </p>
      )}

      {!ruledOut && prominent && unknown.length > 0 && (
        <p className={styles.unknown}>
          <span className={styles.lead}>Not asked</span> {labels(content, unknown).join(", ")}.
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

      {prominent ? <div className={styles.detail}>{detail}</div> : <Disclosure summary="Detail">{detail}</Disclosure>}
    </article>
  );
}
