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

const onResults = () => screen.queryByRole("heading", { name: /what fits/i }) !== null;
const topMatchName = () => screen.getAllByRole("heading", { level: 2 })[0]!.textContent!.trim();

/** walk the yes/no screening pass, saying yes only to the wanted areas */
const screenTextToArea = new Map<string, string>();
for (const a of content.areas) for (const q of a.screens) screenTextToArea.set(q, a.id);

/** walk the yes/no screening pass, saying yes only to the wanted areas */
function screenIn(wanted: string[]) {
  for (let i = 0; i < 20; i += 1) {
    const h2 = screen.queryAllByRole("heading", { level: 2 })[0];
    const areaId = h2 && screenTextToArea.get(h2.textContent!.trim());
    if (!areaId) break; // left the screening pass
    const yes = wanted.includes(areaId);
    fireEvent.click(screen.getByRole("button", { name: yes ? /^Yes$/ : /^No$/ }));
  }
}

/** answer every question "No" (or use the reveal shortcut) until results show */
function answerToResults() {
  for (let i = 0; i < 80 && !onResults(); i += 1) {
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
  it("starts on the first screening question", () => {
    render(<QuizApp content={content} />);
    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getByText(content.areas[0]!.screens[0]!)).toBeDefined();
    expect(screen.getByRole("button", { name: /^Yes$/ })).toBeDefined();
  });

  it("only asks questions from areas screened in", () => {
    render(<QuizApp content={content} />);
    screenIn(["pain"]);
    // the count is the pain area's questions minus the ones hidden by showIf
    const painVisible = content.questions.filter(
      (q) => q.area === "pain" && q.showIf.length === 0,
    ).length;
    expect(screen.getByText(new RegExp(`question 1 of ${painVisible}`, "i"))).toBeDefined();
  });

  it("a showIf question stays hidden until its gate is answered", () => {
    render(<QuizApp content={content} />);
    screenIn(["pain"]);
    // pain3 gates pain4/5/7/8 — answer everything "No" and never see them
    const gated = content.questions.filter((q) => q.area === "pain" && q.showIf.length > 0);
    expect(gated.length).toBeGreaterThan(0);
    answerToResults();
    for (const q of gated) expect(screen.queryByText(q.ask)).toBeNull();
  });

  it("screening in nothing lands on an empty results screen", () => {
    render(<QuizApp content={content} />);
    screenIn([]);
    expect(screen.getByRole("heading", { name: /nothing to work up/i })).toBeDefined();
  });

  it("answers, then shows a probability-ranked result", () => {
    render(<QuizApp content={content} />);
    screenIn(["pain"]);
    answerToResults();
    expect(onResults()).toBe(true);
    expect(screen.getAllByRole("button", { name: /Add to my findings/ }).length).toBeGreaterThan(0);
    expect(screen.getByText(/likely/i)).toBeDefined();
  });

  it("combines two screened areas into one ranked list", () => {
    render(<QuizApp content={content} />);
    screenIn(["pain", "inflammation"]);
    answerToResults();
    expect(onResults()).toBe(true);
    // the heading names both areas
    expect(screen.getByRole("heading", { name: /Nipple & breast pain/ })).toBeDefined();
  });

  it("pins matches from the combined list onto the findings summary", () => {
    render(<QuizApp content={content} />);
    screenIn(["pain", "inflammation"]);
    answerToResults();

    const firstName = topMatchName();
    fireEvent.click(screen.getAllByRole("button", { name: /Add to my findings/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /^Findings/ }));
    expect(screen.getByRole("heading", { name: /Your findings/ })).toBeDefined();
    const list = screen.getByRole("heading", { name: /Your findings/ }).parentElement!;
    expect(within(list).getByText(firstName)).toBeDefined();
  });

  it("the reveal shortcut appears after an answer", () => {
    render(<QuizApp content={content} />);
    screenIn(["pain"]);
    fireEvent.click(screen.getAllByRole("button", { name: /^No$/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /see what fits so far/i }));
    expect(onResults()).toBe(true);
  });

  it("the Sources button opens the evidence list", () => {
    render(<QuizApp content={content} />);
    fireEvent.click(screen.getByRole("button", { name: /sources and evidence/i }));
    expect(screen.getByRole("heading", { name: /^Sources$/ })).toBeDefined();
    expect(screen.getAllByRole("listitem").length).toBe(content.references.length);
  });
});
