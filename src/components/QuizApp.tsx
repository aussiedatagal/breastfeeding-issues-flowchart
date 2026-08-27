import { useEffect, useRef } from "react";
import type { Graph } from "../graph/types.ts";
import { useQuizSession } from "../hooks/useQuizSession.ts";
import { useTheme } from "../hooks/useTheme.ts";
import { TopBar } from "./ui/TopBar.tsx";
import { StartScreen } from "./screens/StartScreen.tsx";
import { QuestionScreen } from "./screens/QuestionScreen.tsx";
import { ResultsScreen } from "./screens/ResultsScreen.tsx";
import { SummaryScreen } from "./screens/SummaryScreen.tsx";
import styles from "./QuizApp.module.css";

export function QuizApp({ graph }: { graph: Graph }) {
  const { screen, findings, pinned, actions } = useQuizSession(graph);
  const theme = useTheme();

  // scroll to the top of the column whenever the screen meaningfully changes
  const mainRef = useRef<HTMLElement>(null);
  const signature =
    screen.name === "question"
      ? `q:${screen.question.id}`
      : screen.name === "results"
        ? `r:${screen.area.id}`
        : screen.name;
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [signature]);

  const onBack = screen.name === "start" ? undefined : actions.back;

  const eyebrow =
    screen.name === "question" || screen.name === "results"
      ? (screen.area.short ?? screen.area.label)
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
              graph={graph}
              area={screen.area}
              question={screen.question}
              answered={screen.answered}
              minUseful={screen.minUseful}
              given={screen.given}
              onAnswer={actions.answer}
              onReveal={actions.reveal}
            />
          )}

          {screen.name === "results" && (
            <ResultsScreen
              graph={graph}
              area={screen.area}
              matches={screen.matches}
              given={screen.given}
              exhausted={screen.exhausted}
              pinned={pinned}
              multifactorialNote={graph.multifactorialNote}
              onAnswer={actions.answer}
              onPin={actions.pinFinding}
              onUnpin={actions.unpinFinding}
              onAnswerMore={actions.probe}
              onCheckAnother={actions.restart}
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
