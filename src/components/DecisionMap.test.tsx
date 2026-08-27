// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildFromFiles } from "../content/load.ts";
import { pathTo } from "../graph/traversal.ts";
import { domainOf } from "../graph/types.ts";
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

const openDomainFor = (nodeId: string) => {
  const domain = domainOf(graph, nodeId)!;
  fireEvent.click(
    screen.getByRole("button", { name: new RegExp(`Open the "${esc(domain.label)}"`) }),
  );
};
const stubFor = (parentShort: string, answer: "yes" | "no") =>
  screen.getByRole("button", { name: new RegExp(`Answer ${answer}\\b.*"${esc(parentShort)}"`) });

const walkTo = (targetId: string) => {
  openDomainFor(targetId);
  for (const step of pathTo(graph, targetId)) {
    fireEvent.click(stubFor(step.question.short, step.answer));
  }
};

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("<DecisionMap> — user scenarios", () => {
  it("loads on the picker with a chip for every problem area", () => {
    render(<DecisionMap graph={graph} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(graph.title);
    for (const d of graph.domains) {
      expect(
        screen.getByRole("button", { name: new RegExp(`Open the "${esc(d.label)}"`) }),
      ).toBeDefined();
    }
  });

  it("opening an area reveals its first question and Yes/No branches", () => {
    render(<DecisionMap graph={graph} />);
    const first = graph.domains[0]!;
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`Open the "${esc(first.label)}"`) }),
    );
    expect(
      screen.getAllByRole("button", { name: /Answer (yes|no)\b/ }).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("answering through to a diagnosis auto-opens the panel with first steps", () => {
    render(<DecisionMap graph={graph} />);
    const target = [...graph.nodes.values()].find(
      (n) => n.kind === "diagnosis" && !n.reference && n.steps.length > 0,
    )!;
    walkTo(target.id);
    expect(panel()).toHaveProperty("inert", false);
    expect(within(panel()).getByRole("heading", { name: /First steps/ })).toBeDefined();
  });

  it("Expand all draws every question node once", () => {
    render(<DecisionMap graph={graph} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    const questionCount = [...graph.nodes.values()].filter((n) => n.kind === "question").length;
    expect(screen.getAllByRole("button", { name: /^Question:/ }).length).toBe(questionCount);
  });

  it("findings from two different areas build one list", () => {
    render(<DecisionMap graph={graph} />);
    const byDomain = new Map<string, string>();
    for (const n of graph.nodes.values()) {
      if (n.kind !== "diagnosis" || n.reference) continue;
      const d = domainOf(graph, n.id);
      if (d && !byDomain.has(d.id) && n.steps.length > 0) byDomain.set(d.id, n.id);
    }
    const [first, second] = [...byDomain.values()];

    walkTo(first!);
    fireEvent.click(screen.getByRole("button", { name: "+ Add to findings" }));
    walkTo(second!);
    fireEvent.click(screen.getByRole("button", { name: "+ Add to findings" }));

    const tray = screen.getByRole("region", { name: /Findings \(2\)/ });
    expect(tray).toBeDefined();
  });
});
