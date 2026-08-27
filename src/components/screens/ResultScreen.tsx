import type { DiagnosisNode, Graph } from "../../graph/types.ts";
import type { Route } from "../../quiz/session.ts";
import { Badge } from "../ui/Badge.tsx";
import { Button } from "../ui/Button.tsx";
import { DetailList } from "../quiz/DetailList.tsx";
import { RelatedList } from "../quiz/RelatedList.tsx";
import { OtherPossibilities } from "../quiz/OtherPossibilities.tsx";
import { AnswerTrail } from "../quiz/AnswerTrail.tsx";
import styles from "./ResultScreen.module.css";

interface Props {
  graph: Graph;
  route: Route;
  diagnosis: DiagnosisNode;
  pinned: boolean;
  multifactorialNote?: string;
  onPin: () => void;
  onUnpin: () => void;
  onGoToStep: (index: number) => void;
  onCheckAnother: () => void;
  onOpenSummary: () => void;
}

export function ResultScreen({
  graph,
  route,
  diagnosis,
  pinned,
  multifactorialNote,
  onPin,
  onUnpin,
  onGoToStep,
  onCheckAnother,
  onOpenSummary,
}: Props) {
  return (
    <section>
      <p className={styles.kicker}>{route.area.short ?? route.area.label} · working diagnosis</p>
      <h1 className={styles.name}>{diagnosis.name}</h1>
      {diagnosis.flag && (
        <div className={styles.badge}>
          <Badge flag={diagnosis.flag} />
        </div>
      )}

      {diagnosis.note && (
        <p className={styles.note} data-flag={diagnosis.flag ?? "none"}>
          {diagnosis.note}
        </p>
      )}

      <div className={styles.pinRow}>
        <Button variant={pinned ? "primary" : "secondary"} block onClick={pinned ? onUnpin : onPin}>
          {pinned ? "✓ In your findings" : "+ Add to my findings"}
        </Button>
        {pinned && (
          <button type="button" className={styles.viewFindings} onClick={onOpenSummary}>
            View findings →
          </button>
        )}
      </div>

      <DetailList title="What points to it" items={diagnosis.points} />
      <DetailList title="First steps for the feeding problem" items={diagnosis.steps} />

      <RelatedList
        title="Often occurs alongside"
        blurb="Common companions — worth checking even if this explains most of the picture."
        graph={graph}
        ids={diagnosis.coexists}
      />

      <OtherPossibilities
        graph={graph}
        route={route}
        reachedId={diagnosis.id}
        onGoToStep={onGoToStep}
      />

      <RelatedList
        title="Distinguish from"
        blurb="Look-alikes to rule out before settling on this."
        graph={graph}
        ids={diagnosis.seeAlso}
      />

      {multifactorialNote && <p className={styles.multi}>{multifactorialNote}</p>}

      <div className={styles.trail}>
        <AnswerTrail steps={route.steps} onGoToStep={onGoToStep} variant="open" />
      </div>

      <div className={styles.actions}>
        <Button variant="primary" block onClick={onCheckAnother}>
          Check another area
        </Button>
        <p className={styles.hint}>
          Not sure this is the whole story? Tap an answer above to revisit it, or add this to your
          findings and work another area.
        </p>
      </div>
    </section>
  );
}
