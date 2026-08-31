/**
 * Visual QA harness. Serves the production build, walks the quiz end to end at
 * a few viewports (light + dark), and drops PNGs into ./screenshots/.
 *
 *   npm run screenshots
 *
 * It is not a pass/fail test — it exists so a human (or Claude) can eyeball
 * every screen after a change. It does fail loudly on a page/console error.
 *
 * Uses your installed Chrome (channel: "chrome"); no browser download.
 */
import { rm, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { preview } from "vite";
import { chromium } from "playwright";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "screenshots");

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844, isMobile: true },
  { name: "phone-small", width: 360, height: 640, isMobile: true },
  { name: "desktop", width: 1280, height: 900, isMobile: false },
];

const onResults = (page) =>
  page
    .getByRole("heading", { name: /what fits/i })
    .count()
    .then((n) => n > 0);

/** Walk from the screening pass to a result and shoot every screen on the way. */
async function walkAndShoot(page, dir, shot) {
  await page.goto(dir.base, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await shot("01-start");

  // yes/no screening pass — say yes to the first two questions, no to the rest,
  // until the first real question appears
  for (let i = 0; i < 12 && !(await page.getByText(/question 1 of/i).count()); i += 1) {
    if (i === 1) await shot("01b-screening");
    const label = i < 2 ? "Yes" : "No";
    const btn = page.getByRole("button", { name: new RegExp(`^${label}$`) }).first();
    if (!(await btn.count())) break;
    await btn.click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(300);
  await shot("02-question");

  // expand the "what does this mean?" help, then collapse it again
  const help = page.getByRole("button", { name: /what does this mean/i }).first();
  if (await help.count()) {
    await help.click();
    await page.waitForTimeout(200);
    await shot("03-question-help-open");
    await help.click();
  }

  // answer the first question "yes", the rest a mix until results are ready
  const yes = page.getByRole("button", { name: /^Yes$/ }).first();
  if (await yes.count()) {
    await yes.click();
    await page.waitForTimeout(220);
  }
  for (let i = 0; i < 40 && !(await onResults(page)); i += 1) {
    const reveal = page.getByRole("button", { name: /see what fits so far/i }).first();
    const no = page.getByRole("button", { name: /^No$/ }).first();
    const next = page.getByRole("button", { name: /None of these — next|Next \(/i }).first();
    if (i === 3 && (await reveal.count())) {
      await shot("04-question-can-see-results");
    }
    if (await no.count()) await no.click();
    else if (await next.count()) await next.click();
    else break;
    await page.waitForTimeout(160);
  }
  await page.waitForTimeout(200);
  await shot("05-results", { fullPage: true });

  // expand the "ruled out" / "weak matches" disclosures
  const setAside = page
    .getByRole("button", { name: /ruled out by your answers|weak matches/i })
    .first();
  if (await setAside.count()) {
    await setAside.click();
    await page.waitForTimeout(200);
    await shot("06-results-set-aside", { fullPage: true });
  }

  // pin the top match, start another area, open the findings summary
  const pin = page.getByRole("button", { name: /add to my findings/i }).first();
  if (await pin.count()) await pin.click();
  await page.waitForTimeout(150);

  const another = page.getByRole("button", { name: /screen a different set|screen another/i }).first();
  if (await another.count()) {
    await another.click();
    await page.waitForTimeout(300);
    await shot("07-rescreen-with-a-finding");
  }

  const findings = page.getByRole("button", { name: /^Findings/ }).first();
  if (await findings.count()) {
    await findings.click();
    await page.waitForTimeout(300);
    await shot("08-findings-summary", { fullPage: true });
  }

  const sources = page.getByRole("button", { name: /sources and evidence/i }).first();
  if (await sources.count()) {
    await sources.click();
    await page.waitForTimeout(300);
    await shot("09-sources", { fullPage: true });
  }

  const mapToggle = page.getByRole("button", { name: /^Map$/ }).first();
  if (await mapToggle.count()) {
    await mapToggle.click();
    await page.waitForTimeout(9000); // cytoscape + elk load, layout settles
    try {
      await shot("10-content-map"); // viewport only — cytoscape canvas breaks fullPage
    } catch {
      /* the graph is a nice-to-have in the harness, not a gate */
    }
  }
}

async function main() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const server = await preview({
    root,
    preview: { port: 4181, strictPort: false, open: false },
  });
  const base = server.resolvedUrls?.local?.[0] ?? "http://localhost:4181/";
  console.log(`serving ${base}`);

  const browser = await chromium.launch({ channel: "chrome" });
  const problems = [];

  try {
    for (const vp of VIEWPORTS) {
      for (const scheme of ["light", "dark"]) {
        const label = `${vp.name}-${scheme}`;
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.isMobile,
          hasTouch: vp.isMobile,
          deviceScaleFactor: vp.isMobile ? 2 : 1,
          colorScheme: scheme,
        });
        const page = await context.newPage();
        page.on("pageerror", (e) => problems.push(`${label}: ${e.message}`));
        page.on("console", (m) => {
          if (m.type() === "error") problems.push(`${label}: ${m.text()}`);
        });

        const dir = { base };
        const shot = async (name, opts) => {
          await mkdir(resolve(outDir, label), { recursive: true });
          await page.screenshot({ path: resolve(outDir, label, `${name}.png`), ...opts });
        };
        await walkAndShoot(page, dir, shot);
        await context.close();
        console.log(`  ${label} ✓`);
      }
    }
  } finally {
    await browser.close();
    await server.httpServer.close();
  }

  if (problems.length) {
    console.error("\nconsole / page errors:");
    for (const p of problems) console.error("  " + p);
    process.exit(1);
  }
  console.log(`\nscreenshots in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
