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
if (!built.content) throw new Error("content did not build");
const content = built.content;

const clickArea = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const onResults = () => screen.queryByRole("heading", { name: /· what fits/i }) !== null;
const topMatchName = () => screen.getAllByRole("heading", { level: 2 })[0]!.textContent!.trim();

/** answer every question "No" (or use the reveal shortcut) until results show */
function answerToResults() {
  for (let i = 0; i < 60 && !onResults(); i += 1) {
    const no = screen.queryAllByRole("button", { name: /^No$/ })[0];
    const next = screen.queryByRole("button", { name: /None of these — next/i });
    const reveal = screen.queryByRole("button", { name: /see what fits so far/i });
    if (no) fireEvent.click(no);
    else if (next) fireEvent.click(next);
    else if (reveal) fireEvent.click(reveal);
    else break;
  }
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", window.location.pathname);
});

describe("<QuizApp>", () => {
  it("starts on the area picker", () => {
    render(<QuizApp content={content} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    for (const a of content.areas) {
      expect(screen.getByRole("button", { name: new RegExp(a.short ?? a.label) })).toBeDefined();
    }
  });

  it("asks one question at a time, then shows a ranked result", () => {
    render(<QuizApp content={content} />);
    clickArea(/Nipple & breast pain/);
    expect(screen.getByText(/question 1 of/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /^Yes$/ })).toBeDefined();

    answerToResults();
    expect(onResults()).toBe(true);
    expect(screen.getAllByRole("button", { name: /Add to my findings/ }).length).toBeGreaterThan(0);
  });

  it('the "See what fits so far" shortcut appears after an answer', () => {
    render(<QuizApp content={content} />);
    clickArea(/Nipple & breast pain/);
    fireEvent.click(screen.getAllByRole("button", { name: /^No$/ })[0]!);
    const reveal = screen.getByRole("button", { name: /see what fits so far/i });
    fireEvent.click(reveal);
    expect(onResults()).toBe(true);
  });

  it("a skipped question does not block reaching results", () => {
    render(<QuizApp content={content} />);
    clickArea(/Nipple & breast pain/);
    fireEvent.click(screen.getByRole("button", { name: /Not sure — skip this one/i }));
    expect(screen.getByText(/question 2 of/i)).toBeDefined();
  });

  it("pins a match and shows it on the findings summary", () => {
    render(<QuizApp content={content} />);
    clickArea(/Nipple & breast pain/);
    answerToResults();

    fireEvent.click(screen.getAllByRole("button", { name: /Add to my findings/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /^Findings/ }));
    expect(screen.getByRole("heading", { name: /Your findings/ })).toBeDefined();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("findings from two different areas build one list", () => {
    render(<QuizApp content={content} />);

    clickArea(/Nipple & breast pain/);
    answerToResults();
    const firstName = topMatchName();
    fireEvent.click(screen.getAllByRole("button", { name: /Add to my findings/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Check another area/ }));

    clickArea(/Lump or inflammation/);
    answerToResults();
    const secondName = topMatchName();
    fireEvent.click(screen.getAllByRole("button", { name: /Add to my findings/ })[0]!);

    fireEvent.click(screen.getByRole("button", { name: /^Findings/ }));
    const list = screen.getByRole("heading", { name: /Your findings/ }).parentElement!;
    expect(within(list).getByText(firstName)).toBeDefined();
    expect(within(list).getByText(secondName)).toBeDefined();
  });
});
