import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Answer, Graph } from "../graph/types.ts";
import {
  answer as answerFn,
  collapse as collapseFn,
  expandAll,
  initialOpen,
  pathTo,
  reveal as revealFn,
  rewindTo as rewindToFn,
} from "../graph/traversal.ts";

interface State {
  open: Set<string>;
  selectedId: string;
}

/** `#q1=no,a1=no,a2=yes` — the answers taken to the selected node. */
function encode(graph: Graph, state: State): string {
  const steps = pathTo(graph, state.selectedId);
  if (steps.length === 0) return "";
  return "#" + steps.map((s) => `${s.question.id}=${s.answer}`).join(",");
}

function decode(graph: Graph, hash: string): State {
  const body = hash.replace(/^#/, "").trim();
  let state: State = { open: initialOpen(graph), selectedId: graph.entry };
  if (!body) return state;
  for (const part of body.split(",")) {
    const [qid, choice] = part.split("=");
    if (!qid || (choice !== "yes" && choice !== "no")) continue;
    if (!graph.nodes.has(qid)) continue;
    const next = answerFn(graph, state.open, qid, choice as Answer);
    state = { open: next.open, selectedId: next.selectedId };
  }
  return state;
}

export function useDecisionState(graph: Graph) {
  const [state, setState] = useState<State>(() => decode(graph, window.location.hash));
  const lastHash = useRef(window.location.hash);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === lastHash.current) return;
      lastHash.current = window.location.hash;
      setState(decode(graph, window.location.hash));
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [graph]);

  useEffect(() => {
    const next = encode(graph, state);
    if (next === lastHash.current) return;
    lastHash.current = next;
    window.history.replaceState(
      null,
      "",
      next || window.location.pathname + window.location.search,
    );
  }, [graph, state]);

  const answer = useCallback(
    (questionId: string, choice: Answer) =>
      setState((s) => {
        const r = answerFn(graph, s.open, questionId, choice);
        return { open: r.open, selectedId: r.selectedId };
      }),
    [graph],
  );

  const undoAnswer = useCallback(
    (questionId: string, choice: Answer) =>
      setState((s) => {
        const r = collapseFn(graph, s.open, questionId, choice);
        return { open: r.open, selectedId: r.selectedId };
      }),
    [graph],
  );

  const select = useCallback(
    (nodeId: string) => setState((s) => ({ ...s, selectedId: nodeId })),
    [],
  );

  const goTo = useCallback(
    (nodeId: string) =>
      setState((s) => {
        const r = revealFn(graph, s.open, nodeId);
        return { open: r.open, selectedId: r.selectedId };
      }),
    [graph],
  );

  const rewindTo = useCallback(
    (questionId: string) =>
      setState((s) => {
        const r = rewindToFn(graph, s.open, questionId);
        return { open: r.open, selectedId: r.selectedId };
      }),
    [graph],
  );

  const expandEverything = useCallback(
    () => setState({ open: expandAll(graph), selectedId: graph.entry }),
    [graph],
  );

  const restart = useCallback(
    () => setState({ open: initialOpen(graph), selectedId: graph.entry }),
    [graph],
  );

  const path = useMemo(() => pathTo(graph, state.selectedId), [graph, state.selectedId]);
  const selected = graph.nodes.get(state.selectedId) ?? null;

  return {
    open: state.open,
    selectedId: state.selectedId,
    selected,
    path,
    actions: { answer, undoAnswer, select, goTo, rewindTo, expandEverything, restart },
  };
}
