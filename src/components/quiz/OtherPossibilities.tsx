import type { Graph } from "../../graph/types.ts";
import type { Route } from "../../quiz/session.ts";
import { untakenBranches } from "../../quiz/analysis.ts";
import { Disclosure } from "../ui/Disclosure.tsx";
import styles from "./OtherPossibilities.module.css";

interface Props {
  graph: Graph;
  route: Route;
  reachedId: string;
  onGoToStep: (index: number) => void;
}

const MAX_NAMES = 5;

/**
 * The confounding-variable safeguard: a single yes/no walk closes out whatever
 * the other branch of each fork would have investigated. This lists it, so the
 * reader can see what wasn't considered and jump back if an answer is shaky.
 */
export function OtherPossibilities({ graph, route, reachedId, onGoToStep }: Props) {
  const forks = untakenBranches(graph, route, reachedId);
  if (forks.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <Disclosure summary={`What this path didn't check (${forks.length})`}>
        <p>
          This result followed one route. Each answer above sent the assessment down one branch — if
          any of them is uncertain, the other branch is worth a look.
        </p>
        <ul className={styles.forks}>
          {forks.map((fork) => {
            const names = fork.wouldConsider.slice(0, MAX_NAMES).map((d) => d.name);
            const extra = fork.wouldConsider.length - names.length;
            return (
              <li key={fork.stepIndex} className={styles.fork}>
                <p className={styles.line}>
                  If <strong>{fork.step.question.short}</strong> is really{" "}
                  <strong>{fork.otherAnswer === "yes" ? "Yes" : "No"}</strong>, consider:{" "}
                  {names.join(", ")}
                  {extra > 0 && `, +${extra} more`}.
                </p>
                <button
                  type="button"
                  className={styles.revisit}
                  onClick={() => onGoToStep(fork.stepIndex)}
                >
                  Revisit that question
                </button>
              </li>
            );
          })}
        </ul>
      </Disclosure>
    </div>
  );
}
