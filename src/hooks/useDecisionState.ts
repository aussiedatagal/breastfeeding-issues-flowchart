import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Answer, Graph } from "../graph/types.ts";
import { isDiagnosis } from "../graph/types.ts";
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
  /** pinned contributing factors — a running problem list, order preserved */
  findings: string[];
}

/** `#q1=no,a1=no;f=dx-x,dx-y` — the answers to the selected node + pinned findings. */
function encode(graph: Graph, state: State): string {
  const steps = pathTo(graph, state.selectedId);
  const path = steps.map((s) => `${s.question.id}=${s.answer}`).join(",");
  const found = state.findings.join(",");
  if (!path && !found) return "";
  return "#" + path + (found ? `;f=${found}` : "");
}

function decode(graph: Graph, hash: string): State {
  const [pathBody = "", foundBody = ""] = hash.replace(/^#/, "").trim().split(";f=");
  let state: State = { open: initialOpen(graph), selectedId: graph.entry, findings: [] };

  for (const part of pathBody.split(",")) {
    const [qid, choice] = part.split("=");
    if (!qid || (choice !== "yes" && choice !== "no")) continue;
    if (!graph.nodes.has(qid)) continue;
    const next = answerFn(graph, state.open, qid, choice as Answer);
    state = { ...state, open: next.open, selectedId: next.selectedId };
  }

  state.findings = foundBody
    .split(",")
    .filter((id) => id && isDiagnosisId(graph, id))
    .filter((id, i, all) => all.indexOf(id) === i);
  return state;
}

const isDiagnosisId = (graph: Graph, id: string) => {
  const n = graph.nodes.get(id);
  return n !== undefined && isDiagnosis(n);
};

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
        return { ...s, open: r.open, selectedId: r.selectedId };
      }),
    [graph],
  );

  const undoAnswer = useCallback(
    (questionId: string, choice: Answer) =>
      setState((s) => {
        const r = collapseFn(graph, s.open, questionId, choice);
        return { ...s, open: r.open, selectedId: r.selectedId };
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
        return { ...s, open: r.open, selectedId: r.selectedId };
      }),
    [graph],
  );

  const rewindTo = useCallback(
    (questionId: string) =>
      setState((s) => {
        const r = rewindToFn(graph, s.open, questionId);
        return { ...s, open: r.open, selectedId: r.selectedId };
      }),
    [graph],
  );

  const expandEverything = useCallback(
    () => setState((s) => ({ ...s, open: expandAll(graph), selectedId: graph.entry })),
    [graph],
  );

  /** Reset the current path but keep the findings list (you're doing another pass). */
  const restart = useCallback(
    () => setState((s) => ({ ...s, open: initialOpen(graph), selectedId: graph.entry })),
    [graph],
  );

  const pinFinding = useCallback(
    (id: string) =>
      setState((s) => (s.findings.includes(id) ? s : { ...s, findings: [...s.findings, id] })),
    [],
  );
  const unpinFinding = useCallback(
    (id: string) => setState((s) => ({ ...s, findings: s.findings.filter((f) => f !== id) })),
    [],
  );
  const clearFindings = useCallback(() => setState((s) => ({ ...s, findings: [] })), []);

  const path = useMemo(() => pathTo(graph, state.selectedId), [graph, state.selectedId]);
  const selected = graph.nodes.get(state.selectedId) ?? null;

  return {
    open: state.open,
    selectedId: state.selectedId,
    selected,
    path,
    findings: state.findings,
    actions: {
      answer,
      undoAnswer,
      select,
      goTo,
      rewindTo,
      expandEverything,
      restart,
      pinFinding,
      unpinFinding,
      clearFindings,
    },
  };
}
