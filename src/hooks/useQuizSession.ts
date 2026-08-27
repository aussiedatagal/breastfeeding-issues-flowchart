import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { Content, Presence } from "../content/model.ts";
import type { SessionAction, SessionState } from "../quiz/session.ts";
import { reduce, screenOf } from "../quiz/session.ts";
import { decode, encode } from "../quiz/url.ts";

/** Binds the pure quiz session to React and the URL hash. */
export function useQuizSession(content: Content) {
  const [state, dispatch] = useReducer(
    (s: SessionState, a: SessionState | SessionAction) => reduce(content, s, a),
    content,
    (c) => decode(c, window.location.hash),
  );

  const lastHash = useRef(window.location.hash);

  useEffect(() => {
    const next = encode(content, state);
    if (next === lastHash.current) return;
    lastHash.current = next;
    window.history.replaceState(
      null,
      "",
      next || window.location.pathname + window.location.search,
    );
  }, [content, state]);

  useEffect(() => {
    const onPop = () => {
      if (window.location.hash === lastHash.current) return;
      lastHash.current = window.location.hash;
      dispatch(decode(content, window.location.hash));
    };
    window.addEventListener("hashchange", onPop);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onPop);
      window.removeEventListener("popstate", onPop);
    };
  }, [content]);

  const screen = useMemo(() => screenOf(content, state), [content, state]);

  const actions = useMemo(
    () => ({
      pickArea: (areaId: string) => dispatch({ type: "pickArea", areaId }),
      answerQuestion: (questionId: string, findings: Record<string, Presence>) =>
        dispatch({ type: "answerQuestion", questionId, findings }),
      skipQuestion: (questionId: string) => dispatch({ type: "skipQuestion", questionId }),
      setFinding: (finding: string, value: Presence) =>
        dispatch({ type: "setFinding", finding, value }),
      clearFinding: (finding: string) => dispatch({ type: "clearFinding", finding }),
      reveal: () => dispatch({ type: "reveal" }),
      resume: () => dispatch({ type: "resume" }),
      back: () => dispatch({ type: "back" }),
      restart: () => dispatch({ type: "restart" }),
      openSummary: () => dispatch({ type: "openSummary" }),
      closeSummary: () => dispatch({ type: "closeSummary" }),
      pinFinding: (id: string) => dispatch({ type: "pinFinding", id }),
      unpinFinding: (id: string) => dispatch({ type: "unpinFinding", id }),
      clearFindings: () => dispatch({ type: "clearFindings" }),
    }),
    [],
  );

  const pinned = useCallback((id: string) => state.findings.includes(id), [state.findings]);

  return { screen, findings: state.findings, pinned, actions };
}

export type QuizActions = ReturnType<typeof useQuizSession>["actions"];
