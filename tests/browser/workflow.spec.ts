/**
 * End-to-end checks of the Data Lab workflow on the bundled sample dataset: a cart
 * that accelerates down a ramp (0–1.5 s, a = 0.60 m/s²) and then coasts on a level
 * track (1.5–3 s, v = 0.90 m/s).
 *
 * Run: npx playwright test tests/browser
 *
 * The fit results are read through "Copy results", so these tests also cover the
 * clipboard export.
 */

import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

/** The sim's layout is 1024×618 above a 40 px navigation bar, so this viewport gives a scale of 1. */
const VIEWPORT = { width: 1024, height: 658 };

/** Plot rectangle in page pixels at that scale (PLOT_LEFT, top margin, PLOT_WIDTH). */
const PLOT = { left: 380, top: 24, width: 385, height: 270 };

/** The x axis shows the data's 0–3 s extent padded by 4 % on each side. */
const AXIS = { min: -0.12, max: 3.12 };

const pageX = (t: number): number => PLOT.left + ((t - AXIS.min) / (AXIS.max - AXIS.min)) * PLOT.width;

test.use({ viewport: VIEWPORT, permissions: ["clipboard-read", "clipboard-write"] });

async function open(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto("/?ea");
  await expect(page.getByLabel("Range minimum")).toBeVisible({ timeout: 60_000 });
  expect(errors).toEqual([]);
}

async function setRange(page: Page, min: string, max: string): Promise<void> {
  await page.getByLabel("Range minimum").fill(min);
  await page.getByLabel("Range minimum").press("Enter");
  await page.getByLabel("Range maximum").fill(max);
  await page.getByLabel("Range maximum").press("Enter");
}

/** Presses a Scenery button through the parallel DOM. */
async function pressButton(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name, exact: true }).dispatchEvent("click");
}

async function copiedResults(page: Page): Promise<string> {
  await pressButton(page, "Copy results");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("Points used");
  return page.evaluate(() => navigator.clipboard.readText());
}

/** The value of a parameter line such as "m = 0.9012 ± 0.0034 m/s". */
function parameter(results: string, symbol: string): number {
  const match = new RegExp(`^${symbol} = (-?[\\d.]+)`, "m").exec(results);
  if (!match) {
    throw new Error(`no parameter ${symbol} in:\n${results}`);
  }
  return Number(match[1]);
}

function includedRowCount(page: Page): Promise<number> {
  return page.locator("tbody tr td:first-child", { hasText: "✓" }).count();
}

test("a linear fit to the level-track range gives the cart's speed", async ({ page }) => {
  await open(page);
  expect(await includedRowCount(page)).toBe(61);

  await setRange(page, "1.5", "3");
  expect(await includedRowCount(page)).toBe(31);

  const results = await copiedResults(page);
  expect(results).toContain("Linear: y = m·x + b");
  expect(results).toContain("Points used: 31");
  expect(results).toContain("Using 31 of 61 rows · Time from 1.500 s to 3.000 s");
  expect(Math.abs(parameter(results, "m") - 0.9)).toBeLessThan(0.02);
  expect(results).toMatch(/^m = .* m\/s$/m);
});

test("a quadratic fit to the ramp range gives half the acceleration", async ({ page }) => {
  await open(page);
  await page.getByRole("radio", { name: "Quadratic" }).dispatchEvent("click");
  await setRange(page, "0", "1.5");
  expect(await includedRowCount(page)).toBe(31);

  const results = await copiedResults(page);
  expect(results).toContain("Quadratic: y = A·x² + B·x + C");
  expect(Math.abs(parameter(results, "A") - 0.3)).toBeLessThan(0.01);
  expect(results).toMatch(/^A = .* m\/s²$/m);
});

test("dragging across the graph selects the same rows as typing the bounds", async ({ page }) => {
  await open(page);
  const y = PLOT.top + PLOT.height / 2;
  await page.mouse.move(pageX(1.47), y);
  await page.mouse.down();
  await page.mouse.move(pageX(2.2), y, { steps: 5 });
  await page.mouse.move(pageX(3.03), y, { steps: 5 });
  await page.mouse.up();

  expect(await includedRowCount(page)).toBe(31);
  expect(Number(await page.getByLabel("Range minimum").inputValue())).toBeCloseTo(1.47, 1);
  expect(Number(await page.getByLabel("Range maximum").inputValue())).toBeCloseTo(3.03, 1);

  await pressButton(page, "Clear range");
  expect(await includedRowCount(page)).toBe(61);
  await expect(page.getByLabel("Range minimum")).toHaveValue("");
});

test("the keyboard moves a range edge one data point at a time", async ({ page }) => {
  await open(page);
  await setRange(page, "1", "3");
  expect(await includedRowCount(page)).toBe(41);

  // Ten points to the right of 1.00 s at 20 Hz is 1.50 s.
  const start = page
    .locator(".a11y-pdom-root [aria-label='Range start'], .a11y-pdom-root :text-is('Range start')")
    .first();
  await start.focus();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("ArrowRight");
  }
  await expect(page.getByLabel("Range minimum")).toHaveValue("1.5");
  expect(await includedRowCount(page)).toBe(31);

  await page.keyboard.press("Home");
  await expect(page.getByLabel("Range minimum")).toHaveValue("0");
});

test("zooming does not change the fit", async ({ page }) => {
  await open(page);
  await setRange(page, "1.5", "3");
  const before = await copiedResults(page);
  await pressButton(page, "Zoom to range");
  const zoomed = await copiedResults(page);
  expect(zoomed).toBe(before);
  await pressButton(page, "Show all");
  expect(await copiedResults(page)).toBe(before);
});

test("editing and pasting into the table updates the fit and the export", async ({ page }) => {
  await open(page);
  const cell = page.getByLabel("Position (m), row 1", { exact: true });
  await cell.fill("0.5");
  await cell.press("Enter");
  await expect(page.getByLabel("Position (m), row 2", { exact: true })).toBeFocused();

  // A block copied from a spreadsheet fills cells from the focused one and adds rows.
  const last = page.getByLabel("Time (s), row 61", { exact: true });
  await last.focus();
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "3.00\t2.02\n3.05\t2.07\n3.10\tn/a\n");
    document.activeElement?.dispatchEvent(
      new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(page.locator("tbody tr")).toHaveCount(63);
  // The row with "n/a" has no y value, so it is skipped.
  expect(await includedRowCount(page)).toBe(62);

  const [download] = await Promise.all([page.waitForEvent("download"), pressButton(page, "Export CSV")]);
  const csv = readFileSync(await download.path(), "utf8")
    .trim()
    .split("\n");
  expect(csv[0]).toBe("Time (s),Position (m),in_fit,fit_value,residual");
  expect(csv).toHaveLength(64);
  expect(csv[1]?.startsWith("0,0.5,1,")).toBe(true);
  expect(csv[63]?.startsWith("3.1,n/a,0,")).toBe(true);
});

test("pasting a table outside a text field replaces the data", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "Longueur (m);Période (s)\n0,25;1,00\n0,50;1,42\n0,75;1,74\n1,00;2,01\n");
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(page.getByLabel("Période (s), row 2", { exact: true })).toHaveValue("1,42");
  const results = await copiedResults(page);
  expect(results).toContain("Points used: 4");
  expect(results).toMatch(/^m = .* s\/m$/m);
});
