import { useEffect, useRef } from "react";
import type { Graph } from "../graph/types.ts";
import { useQuizSession } from "../hooks/useQuizSession.ts";
import { useTheme } from "../hooks/useTheme.ts";
import { TopBar } from "./ui/TopBar.tsx";
import { StartScreen } from "./screens/StartScreen.tsx";
import { QuestionScreen } from "./screens/QuestionScreen.tsx";
import { ResultScreen } from "./screens/ResultScreen.tsx";
import { SummaryScreen } from "./screens/SummaryScreen.tsx";
import styles from "./QuizApp.module.css";

export function QuizApp({ graph }: { graph: Graph }) {
  const { screen, findings, pinned, actions } = useQuizSession(graph);
  const theme = useTheme();

  // scroll to the top of the column whenever the screen changes
  const mainRef = useRef<HTMLElement>(null);
  const signature =
    screen.name === "question"
      ? `q:${screen.question.id}:${screen.route.steps.length}`
      : screen.name === "result"
        ? `r:${screen.diagnosis.id}`
        : screen.name;
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [signature]);

  const onBack =
    screen.name === "start"
      ? undefined
      : screen.name === "summary"
        ? actions.closeSummary
        : actions.back;

  const eyebrow =
    screen.name === "question" || screen.name === "result"
      ? (screen.route.area.short ?? screen.route.area.label)
      : screen.name === "summary"
        ? "Findings"
        : undefined;

  return (
    <div className={styles.app}>
      <TopBar
        {...(onBack ? { onBack } : {})}
        {...(eyebrow ? { eyebrow } : {})}
        findingsCount={screen.name === "summary" ? 0 : findings.length}
        onFindings={actions.openSummary}
        theme={theme.choice}
        onCycleTheme={theme.cycle}
      />

      <main ref={mainRef} className={styles.main}>
        <div key={signature} className={styles.screen}>
          {screen.name === "start" && (
            <StartScreen
              graph={graph}
              findingsCount={findings.length}
              onPickArea={actions.pickArea}
              onOpenSummary={actions.openSummary}
            />
          )}

          {screen.name === "question" && (
            <QuestionScreen
              route={screen.route}
              question={screen.question}
              onAnswer={actions.answer}
              onGoToStep={actions.goToStep}
            />
          )}

          {screen.name === "result" && (
            <ResultScreen
              graph={graph}
              route={screen.route}
              diagnosis={screen.diagnosis}
              pinned={pinned(screen.diagnosis.id)}
              multifactorialNote={graph.multifactorialNote}
              onPin={() => actions.pinFinding(screen.diagnosis.id)}
              onUnpin={() => actions.unpinFinding(screen.diagnosis.id)}
              onGoToStep={actions.goToStep}
              onCheckAnother={actions.restart}
              onOpenSummary={actions.openSummary}
            />
          )}

          {screen.name === "summary" && (
            <SummaryScreen
              graph={graph}
              findings={findings}
              multifactorialNote={graph.multifactorialNote}
              onUnpin={actions.unpinFinding}
              onClear={actions.clearFindings}
              onCheckAnother={actions.restart}
            />
          )}
        </div>
      </main>
    </div>
  );
}
