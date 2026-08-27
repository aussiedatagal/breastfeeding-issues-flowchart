import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { Graph } from "../graph/types.ts";
import type { Answer, SessionAction, SessionState } from "../quiz/session.ts";
import { reduce, screenOf } from "../quiz/session.ts";
import { decode, encode } from "../quiz/url.ts";

/**
 * Binds the pure quiz session to React and to the URL hash. Returns the current
 * screen (already resolved against the graph) plus a flat set of actions the
 * screens call.
 */
export function useQuizSession(graph: Graph) {
  const [state, dispatch] = useReducer(
    (s: SessionState, a: SessionState | SessionAction) => reduce(s, a),
    graph,
    (g) => decode(g, window.location.hash),
  );

  // keep the hash in step with state, and react to back/forward navigation
  const lastHash = useRef(window.location.hash);

  useEffect(() => {
    const next = encode(state);
    if (next === lastHash.current) return;
    lastHash.current = next;
    window.history.replaceState(
      null,
      "",
      next || window.location.pathname + window.location.search,
    );
  }, [state]);

  useEffect(() => {
    const onPop = () => {
      if (window.location.hash === lastHash.current) return;
      lastHash.current = window.location.hash;
      dispatch(decode(graph, window.location.hash));
    };
    window.addEventListener("hashchange", onPop);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onPop);
      window.removeEventListener("popstate", onPop);
    };
  }, [graph]);

  const screen = useMemo(() => screenOf(graph, state), [graph, state]);

  const actions = useMemo(
    () => ({
      pickArea: (areaId: string) => dispatch({ type: "pickArea", areaId }),
      answer: (answer: Answer) => dispatch({ type: "answer", answer }),
      back: () => dispatch({ type: "back" }),
      goToStep: (index: number) => dispatch({ type: "goToStep", index }),
      changeAnswer: (index: number, answer: Answer) =>
        dispatch({ type: "changeAnswer", index, answer }),
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
