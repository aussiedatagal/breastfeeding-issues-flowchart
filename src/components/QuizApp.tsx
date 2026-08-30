import { useEffect, useRef } from "react";
import type { Content } from "../content/model.ts";
import { useQuizSession } from "../hooks/useQuizSession.ts";
import { useTheme } from "../hooks/useTheme.ts";
import { TopBar } from "./ui/TopBar.tsx";
import { ScreeningScreen } from "./screens/ScreeningScreen.tsx";
import { QuestionScreen } from "./screens/QuestionScreen.tsx";
import { ResultsScreen } from "./screens/ResultsScreen.tsx";
import { SummaryScreen } from "./screens/SummaryScreen.tsx";
import { SourcesScreen } from "./screens/SourcesScreen.tsx";
import { MapScreen } from "./screens/MapScreen.tsx";
import styles from "./QuizApp.module.css";

export function QuizApp({ content }: { content: Content }) {
  const { screen, findings, pinned, actions } = useQuizSession(content);
  const theme = useTheme();

  const mainRef = useRef<HTMLElement>(null);
  const signature =
    screen.name === "screening"
      ? `s:${screen.area.id}:${screen.screenIndex}`
      : screen.name === "question"
        ? `q:${screen.question.id}`
        : screen.name;
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [signature]);

  const atStart = screen.name === "screening" && screen.first;
  const onBack = atStart || screen.name === "map" ? undefined : actions.back;
  const backLabel = screen.name === "results" ? "Back to the questions" : "Back";

  const eyebrow =
    screen.name === "question"
      ? (screen.area.short ?? screen.area.label)
      : screen.name === "screening"
        ? "Screening"
        : screen.name === "results"
          ? "Results"
          : screen.name === "summary"
            ? "Findings"
            : screen.name === "sources"
              ? "Sources"
              : screen.name === "map"
                ? "Content map"
                : undefined;

  return (
    <div className={styles.app}>
      <TopBar
        {...(eyebrow ? { eyebrow } : {})}
        findingsCount={screen.name === "summary" ? 0 : findings.length}
        onFindings={actions.openSummary}
        onSources={actions.openSources}
        onToggleMap={actions.toggleMap}
        mapActive={screen.name === "map"}
        theme={theme.choice}
        onCycleTheme={theme.cycle}
      />

      <main ref={mainRef} className={styles.main} data-wide={screen.name === "map"}>
        {screen.name === "map" && (
          <button type="button" className={styles.back} onClick={actions.toggleMap}>
            <span className={styles.backArrow} aria-hidden="true" />
            Back to the quiz
          </button>
        )}
        {onBack && (
          <button type="button" className={styles.back} onClick={onBack}>
            <span className={styles.backArrow} aria-hidden="true" />
            {backLabel}
          </button>
        )}
        <div key={signature} className={styles.screen}>
          {screen.name === "screening" && (
            <ScreeningScreen
              content={content}
              area={screen.area}
              ask={screen.ask}
              screenIndex={screen.screenIndex}
              index={screen.index}
              picked={screen.picked}
              first={screen.first}
              findingsCount={findings.length}
              onScreen={actions.answerScreen}
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
              areas={screen.areas}
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
              onEditAreas={actions.editAreas}
              onRestart={actions.restart}
            />
          )}

          {screen.name === "sources" && <SourcesScreen content={content} />}

          {screen.name === "map" && <MapScreen content={content} />}

          {screen.name === "summary" && (
            <SummaryScreen
              content={content}
              findings={findings}
              {...(content.multifactorialNote
                ? { multifactorialNote: content.multifactorialNote }
                : {})}
              onUnpin={actions.unpinFinding}
              onClear={actions.clearFindings}
              onCheckAnother={actions.editAreas}
            />
          )}
        </div>
      </main>
    </div>
  );
}
