import { useEffect, useRef } from "react";
import type { Content } from "../content/model.ts";
import { useQuizSession } from "../hooks/useQuizSession.ts";
import { useTheme } from "../hooks/useTheme.ts";
import { TopBar } from "./ui/TopBar.tsx";
import { StartScreen } from "./screens/StartScreen.tsx";
import { QuestionScreen } from "./screens/QuestionScreen.tsx";
import { ResultsScreen } from "./screens/ResultsScreen.tsx";
import { SummaryScreen } from "./screens/SummaryScreen.tsx";
import styles from "./QuizApp.module.css";

export function QuizApp({ content }: { content: Content }) {
  const { screen, findings, pinned, actions } = useQuizSession(content);
  const theme = useTheme();

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
              content={content}
              findingsCount={findings.length}
              onPickArea={actions.pickArea}
              onOpenSummary={actions.openSummary}
            />
          )}

          {screen.name === "question" && (
            <QuestionScreen
              content={content}
              area={screen.area}
              question={screen.question}
              index={screen.index}
              total={screen.total}
              answers={screen.answers}
              canReveal={screen.canReveal}
              onAnswer={actions.answerQuestion}
              onSkip={actions.skipQuestion}
              onSetFinding={actions.setFinding}
              onReveal={actions.reveal}
            />
          )}

          {screen.name === "results" && (
            <ResultsScreen
              content={content}
              area={screen.area}
              matches={screen.matches}
              answers={screen.answers}
              complete={screen.complete}
              answeredCount={screen.answeredCount}
              skippedCount={screen.skippedCount}
              pinned={pinned}
              {...(content.multifactorialNote
                ? { multifactorialNote: content.multifactorialNote }
                : {})}
              onSetFinding={actions.setFinding}
              onClearFinding={actions.clearFinding}
              onPin={actions.pinFinding}
              onUnpin={actions.unpinFinding}
              onResume={actions.resume}
              onCheckAnother={actions.restart}
            />
          )}

          {screen.name === "summary" && (
            <SummaryScreen
              content={content}
              findings={findings}
              {...(content.multifactorialNote
                ? { multifactorialNote: content.multifactorialNote }
                : {})}
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
