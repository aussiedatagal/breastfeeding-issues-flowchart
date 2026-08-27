import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Answer, Graph } from "../graph/types.ts";
import { ROOT_ID, isDiagnosis } from "../graph/types.ts";
import {
  answer as answerFn,
  collapse as collapseFn,
  closeDomain as closeDomainFn,
  expandAll,
  initialOpen,
  openDomain as openDomainFn,
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

/** `#o=q1,a1;s=a1;f=dx-x` — open nodes, selection, and the pinned findings. */
function encode(state: State): string {
  const parts: string[] = [];
  if (state.open.size) parts.push(`o=${[...state.open].join(",")}`);
  if (state.selectedId !== ROOT_ID) parts.push(`s=${state.selectedId}`);
  if (state.findings.length) parts.push(`f=${state.findings.join(",")}`);
  return parts.length ? "#" + parts.join(";") : "";
}

function decode(graph: Graph, hash: string): State {
  const params = new Map<string, string>();
  for (const seg of hash.replace(/^#/, "").split(";")) {
    const eq = seg.indexOf("=");
    if (eq > 0) params.set(seg.slice(0, eq), seg.slice(eq + 1));
  }
  const known = (id: string) => graph.nodes.has(id);
  const open = new Set((params.get("o") ?? "").split(",").filter(known));
  const findings = (params.get("f") ?? "")
    .split(",")
    .filter((id) => id && isDiagnosisId(graph, id))
    .filter((id, i, all) => all.indexOf(id) === i);
  const s = params.get("s");
  const selectedId = s && known(s) ? s : ROOT_ID;
  return { open, selectedId, findings };
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
    const next = encode(state);
    if (next === lastHash.current) return;
    lastHash.current = next;
    window.history.replaceState(
      null,
      "",
      next || window.location.pathname + window.location.search,
    );
  }, [state]);

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

  const openDomain = useCallback(
    (entryId: string) =>
      setState((s) => ({ ...s, open: openDomainFn(s.open, entryId), selectedId: entryId })),
    [],
  );
  const closeDomain = useCallback(
    (entryId: string) =>
      setState((s) => ({
        ...s,
        open: closeDomainFn(graph, s.open, entryId),
        selectedId: ROOT_ID,
      })),
    [graph],
  );

  const expandEverything = useCallback(
    () => setState((s) => ({ ...s, open: expandAll(graph), selectedId: ROOT_ID })),
    [graph],
  );

  /** Reset the current path but keep the findings list (you're doing another pass). */
  const restart = useCallback(
    () => setState((s) => ({ ...s, open: initialOpen(graph), selectedId: ROOT_ID })),
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

  const path = useMemo(
    () => (state.selectedId === ROOT_ID ? [] : pathTo(graph, state.selectedId)),
    [graph, state.selectedId],
  );
  const selected =
    state.selectedId === ROOT_ID ? null : (graph.nodes.get(state.selectedId) ?? null);

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
      openDomain,
      closeDomain,
      expandEverything,
      restart,
      pinFinding,
      unpinFinding,
      clearFindings,
    },
  };
}
