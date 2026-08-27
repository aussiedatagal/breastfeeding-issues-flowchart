// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { buildFromFiles } from "../content/load.ts";
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

const clickArea = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const answer = (a: "Yes" | "No") =>
  fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^${a}$`) })[0]!);
const onResults = () => screen.queryByRole("heading", { name: /· what fits/i }) !== null;
/** the name of the top match on the results screen */
const topMatchName = () => screen.getAllByRole("heading", { level: 2 })[0]!.textContent!.trim();

/** answer questions until the results screen shows (adaptive flow, or the
 *  "see what fits so far" shortcut once it appears). */
function answerToResults(pick = "no") {
  for (let i = 0; i < 40 && !onResults(); i += 1) {
    const reveal = screen.queryByRole("button", { name: /see what fits so far/i });
    if (reveal && i > 6) {
      fireEvent.click(reveal);
      continue;
    }
    const btn = screen.queryAllByRole("button", { name: pick === "no" ? /^No$/ : /^Yes$/ })[0];
    if (!btn) break;
    fireEvent.click(btn);
  }
}

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

  it("asks one question at a time, then shows a ranked result", () => {
    render(<QuizApp graph={graph} />);
    clickArea(/Nipple & breast pain/);
    expect(screen.getByText(/question 1/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /^Yes$/ })).toBeDefined();

    answerToResults("no");
    expect(onResults()).toBe(true);
    // a best-fit card with the pin action
    expect(screen.getAllByRole("button", { name: /Add to my findings/ }).length).toBeGreaterThan(0);
  });

  it('the "See what fits so far" shortcut appears after a few answers', () => {
    render(<QuizApp graph={graph} />);
    clickArea(/Nipple & breast pain/);
    answer("No");
    answer("No");
    answer("No");
    const reveal = screen.getByRole("button", { name: /see what fits so far/i });
    fireEvent.click(reveal);
    expect(onResults()).toBe(true);
  });

  it("pins a match and shows it on the findings summary", () => {
    render(<QuizApp graph={graph} />);
    clickArea(/Nipple & breast pain/);
    answerToResults("no");

    fireEvent.click(screen.getAllByRole("button", { name: /Add to my findings/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /^Findings/ }));
    expect(screen.getByRole("heading", { name: /Your findings/ })).toBeDefined();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("findings from two different areas build one list", () => {
    render(<QuizApp graph={graph} />);

    clickArea(/Nipple & breast pain/);
    answerToResults("no");
    const firstName = topMatchName();
    fireEvent.click(screen.getAllByRole("button", { name: /Add to my findings/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Check another area/ }));

    clickArea(/Lump or inflammation/);
    answerToResults("no");
    const secondName = topMatchName();
    fireEvent.click(screen.getAllByRole("button", { name: /Add to my findings/ })[0]!);

    fireEvent.click(screen.getByRole("button", { name: /^Findings/ }));
    const list = screen.getByRole("heading", { name: /Your findings/ }).parentElement!;
    expect(within(list).getByText(firstName)).toBeDefined();
    expect(within(list).getByText(secondName)).toBeDefined();
  });
});
