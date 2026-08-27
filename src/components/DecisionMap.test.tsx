// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildFromFiles } from "../content/load.ts";
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

afterEach(cleanup);

describe("<DecisionMap>", () => {
  it("renders the title and the entry question's two branches", () => {
    render(<DecisionMap graph={graph} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(graph.title);
    expect(screen.getAllByRole("button", { name: /Answer (yes|no) and open/ })).toHaveLength(2);
  });

  it("opening a branch reveals an undo label on its edge", () => {
    render(<DecisionMap graph={graph} />);
    fireEvent.click(screen.getByRole("button", { name: /Answer no and open the next question/i }));
    expect(screen.getAllByRole("button", { name: /Undo the "no" answer/i }).length).toBeGreaterThan(
      0,
    );
  });

  it("Expand all draws every question node once", () => {
    render(<DecisionMap graph={graph} />);
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    const questionCount = [...graph.nodes.values()].filter((n) => n.kind === "question").length;
    expect(screen.getAllByRole("button", { name: /^Question:/ }).length).toBe(questionCount);
  });
});
