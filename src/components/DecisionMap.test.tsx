// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildFromFiles } from "../content/load.ts";
import { pathTo } from "../graph/traversal.ts";
import { DecisionMap } from "./DecisionMap.tsx";

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
const { graph } = buildFromFiles(readContent());
if (!graph) throw new Error("content did not build");

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const panel = () => screen.getByRole("complementary", { name: "Details" });
const stubFor = (parentShort: string, answer: "yes" | "no") =>
  screen.getByRole("button", {
    name: new RegExp(`Answer ${answer}\\b.*"${esc(parentShort)}"`),
  });

afterEach(cleanup);

describe("<DecisionMap> — user scenarios", () => {
  it("loads with the entry question, two branch nodes, and the panel closed", () => {
    render(<DecisionMap graph={graph} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(graph.title);
    expect(screen.getAllByRole("button", { name: /Answer (yes|no)\b/ })).toHaveLength(2);
    expect(panel()).toHaveProperty("inert", true);
  });

  it("clicking a Yes/No node opens that branch without opening the panel", () => {
    render(<DecisionMap graph={graph} />);
    const entry = graph.nodes.get(graph.entry)!;
    fireEvent.click(stubFor(entry.short, "no"));
    expect(screen.getAllByRole("button", { name: /Undo the "no" answer/i }).length).toBeGreaterThan(
      0,
    );
    expect(panel()).toHaveProperty("inert", true);
  });

  it("clicking a question node body opens the panel with its assessment note", () => {
    render(<DecisionMap graph={graph} />);
    fireEvent.click(screen.getAllByRole("button", { name: /^Question:/ })[0]!);
    expect(panel()).toHaveProperty("inert", false);
    expect(within(panel()).getByRole("heading", { name: "How to assess" })).toBeDefined();
  });

  it("answering through to a diagnosis auto-opens the panel with first steps", () => {
    render(<DecisionMap graph={graph} />);
    const target = [...graph.nodes.values()].find(
      (n) => n.kind === "diagnosis" && !n.reference && n.steps.length > 0,
    )!;
    for (const step of pathTo(graph, target.id)) {
      fireEvent.click(stubFor(step.question.short, step.answer));
    }
    expect(panel()).toHaveProperty("inert", false);
    expect(within(panel()).getByRole("heading", { name: /First steps/ })).toBeDefined();
  });

  it("a breadcrumb rewinds to that question and folds the rest away", () => {
    render(<DecisionMap graph={graph} />);
    const entry = graph.nodes.get(graph.entry)!;
    fireEvent.click(stubFor(entry.short, "no"));
    // go one more level down the "no" spine
    const deeper = screen
      .getAllByRole("button", { name: /Answer no\b/ })
      .find((el) => !el.getAttribute("aria-label")!.includes(entry.short));
    if (deeper) fireEvent.click(deeper);
    const crumbs = within(screen.getByRole("navigation", { name: /Answers so far/ })).getAllByRole(
      "button",
    );
    fireEvent.click(crumbs[0]!);
    expect(screen.getAllByRole("button", { name: /Answer (yes|no)\b/ })).toHaveLength(2);
  });

  it("Expand all draws every question node once", () => {
    render(<DecisionMap graph={graph} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    const questionCount = [...graph.nodes.values()].filter((n) => n.kind === "question").length;
    expect(screen.getAllByRole("button", { name: /^Question:/ }).length).toBe(questionCount);
  });
});
