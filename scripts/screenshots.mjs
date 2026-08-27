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
    .getByText(/· what fits/i)
    .count()
    .then((n) => n > 0);

/** Walk from the start screen to a result and shoot every screen on the way. */
async function walkAndShoot(page, dir, shot) {
  await page.goto(dir.base, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await shot("01-start");

  // open the "nipple & breast pain" area (or fall back to the first)
  const pain = page.locator('[data-area="pain"]');
  await ((await pain.count()) ? pain : page.locator("[data-area]").first()).click();
  await page.waitForTimeout(300);
  await shot("02-question");

  // expand the "how do I check this?" help, then collapse it again
  const help = page.getByRole("button", { name: /how do i check this/i }).first();
  if (await help.count()) {
    await help.click();
    await page.waitForTimeout(200);
    await shot("03-question-help-open");
    await help.click();
  }

  // answer the first question "yes", the rest "no" until results are ready
  const yes = page.getByRole("button", { name: /^Yes$/ }).first();
  if (await yes.count()) {
    await yes.click();
    await page.waitForTimeout(220);
  }
  for (let i = 0; i < 20 && !(await onResults(page)); i += 1) {
    const reveal = page.getByRole("button", { name: /see what fits so far/i }).first();
    const no = page.getByRole("button", { name: /^No$/ }).first();
    if (i === 3 && (await reveal.count())) {
      await shot("04-question-can-see-results");
    }
    if ((await no.count()) === 0) break;
    await no.click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(200);
  await shot("05-results", { fullPage: true });

  // expand "considered and set aside"
  const setAside = page.getByRole("button", { name: /considered and set aside/i }).first();
  if (await setAside.count()) {
    await setAside.click();
    await page.waitForTimeout(200);
    await shot("06-results-set-aside", { fullPage: true });
  }

  // pin the top match, start another area, open the findings summary
  const pin = page.getByRole("button", { name: /add to my findings/i }).first();
  if (await pin.count()) await pin.click();
  await page.waitForTimeout(150);

  const another = page.getByRole("button", { name: /check another area/i }).first();
  if (await another.count()) {
    await another.click();
    await page.waitForTimeout(300);
    await shot("07-start-with-a-finding");
  }

  const findings = page.getByRole("button", { name: /^Findings/ }).first();
  if (await findings.count()) {
    await findings.click();
    await page.waitForTimeout(300);
    await shot("08-findings-summary", { fullPage: true });
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
