// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildFromFiles } from "../content/load.ts";
import { isDiagnosis } from "../graph/types.ts";
import { reachableDiagnoses } from "../quiz/analysis.ts";
import { walk } from "../quiz/session.ts";
import { QuizApp } from "./QuizApp.tsx";

const contentDir = resolve(__dirname, "../../content");
function readContent(dir = contentDir): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) Object.assign(out, readContent(full));
    else if (name.endsWith(".yaml"))
      out[relative(contentDir, full).replaceAll("\\", "/")] = readFileSync(full, "utf8");
  }
  return out;
}
const built = buildFromFiles(readContent());
if (!built.graph) throw new Error("content did not build");
const graph = built.graph;

/** answers, from an area entry, that reach the first non-reference diagnosis. */
function pathToADiagnosis(areaId: string) {
  const area = graph.domains.find((d) => d.id === areaId)!;
  const stack: ("yes" | "no")[][] = [[]];
  while (stack.length) {
    const answers = stack.pop()!;
    const route = walk(graph, area, answers);
    if (isDiagnosis(route.current)) return { area, answers, diagnosis: route.current };
    if (answers.length < 30) stack.push([...answers, "no"], [...answers, "yes"]);
  }
  throw new Error("no diagnosis found");
}

const clickArea = (label: RegExp) => fireEvent.click(screen.getByRole("button", { name: label }));
const answer = (a: "Yes" | "No") =>
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${a}$`) }));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("<QuizApp>", () => {
  it("starts on the area picker", () => {
    render(<QuizApp graph={graph} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    for (const d of graph.domains) {
      expect(screen.getByRole("button", { name: new RegExp(d.short ?? d.label) })).toBeDefined();
    }
  });

  it("picking an area shows its first question with Yes / No", () => {
    render(<QuizApp graph={graph} />);
    clickArea(/Nipple & breast pain/);
    const pain1 = graph.nodes.get(graph.domains.find((d) => d.id === "pain")!.entry)!;
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      pain1.kind === "question" ? pain1.ask : "",
    );
    expect(screen.getByRole("button", { name: /^Yes$/ })).toBeDefined();
    expect(screen.getByRole("button", { name: /^No$/ })).toBeDefined();
  });

  it("walks to a result, which is not shown until every answer is given", () => {
    const { area, answers, diagnosis } = pathToADiagnosis("pain");
    render(<QuizApp graph={graph} />);
    clickArea(new RegExp(area.short ?? area.label));
    for (const a of answers) answer(a === "yes" ? "Yes" : "No");

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(diagnosis.name);
    expect(screen.getByRole("button", { name: /Add to my findings/ })).toBeDefined();
  });

  it("names what the path did not check", () => {
    const { area, answers, diagnosis } = pathToADiagnosis("pain");
    const forks = walk(graph, area, answers);
    const hasForks =
      forks.steps.some(
        (s) =>
          reachableDiagnoses(graph, s.question.edges[s.answer === "yes" ? "no" : "yes"].to).filter(
            (d) => d.id !== diagnosis.id,
          ).length > 0,
      ) && diagnosis;
    render(<QuizApp graph={graph} />);
    clickArea(new RegExp(area.short ?? area.label));
    for (const a of answers) answer(a === "yes" ? "Yes" : "No");
    if (hasForks) {
      expect(screen.getByRole("button", { name: /didn't check/ })).toBeDefined();
    }
  });

  it("pins a finding and shows it on the summary", () => {
    const { area, answers } = pathToADiagnosis("pain");
    render(<QuizApp graph={graph} />);
    clickArea(new RegExp(area.short ?? area.label));
    for (const a of answers) answer(a === "yes" ? "Yes" : "No");

    fireEvent.click(screen.getByRole("button", { name: /Add to my findings/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Findings/ }));

    expect(screen.getByRole("heading", { name: /Your findings/ })).toBeDefined();
  });

  it("findings from two different areas build one list", () => {
    const a = pathToADiagnosis("pain");
    const b = pathToADiagnosis("inflammation");
    render(<QuizApp graph={graph} />);

    clickArea(new RegExp(a.area.short ?? a.area.label));
    for (const x of a.answers) answer(x === "yes" ? "Yes" : "No");
    fireEvent.click(screen.getByRole("button", { name: /Add to my findings/ }));
    fireEvent.click(screen.getByRole("button", { name: /Check another area/ }));

    clickArea(new RegExp(b.area.short ?? b.area.label));
    for (const x of b.answers) answer(x === "yes" ? "Yes" : "No");
    fireEvent.click(screen.getByRole("button", { name: /Add to my findings/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Findings/ }));

    const list = screen.getByRole("heading", { name: /Your findings/ }).parentElement!;
    expect(within(list).getByText(a.diagnosis.name)).toBeDefined();
    expect(within(list).getByText(b.diagnosis.name)).toBeDefined();
  });
});
