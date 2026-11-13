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

const VIEWPORT = { width: 1024, height: 658 };

/** Plot rectangle in the sim's 1024×618 layout coordinates (PLOT_LEFT, top margin, PLOT_WIDTH, PLOT_HEIGHT). */
const LAYOUT_PLOT = { left: 380, top: 24, width: 385, height: 270 };

/** The plot rectangle in page pixels; set by open() from the screen view's actual transform. */
let PLOT = LAYOUT_PLOT;

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

  // The sim scales its layout to the window, so page positions come from the view's transform.
  const { scale, dx, dy } = await page.evaluate(() => {
    const view = (globalThis as unknown as { phet: { joist: { sim: { screens: { view: unknown }[] } } } }).phet.joist
      .sim.screens[0]?.view as { getLocalToGlobalMatrix(): { m00(): number; m02(): number; m12(): number } };
    const matrix = view.getLocalToGlobalMatrix();
    return { scale: matrix.m00(), dx: matrix.m02(), dy: matrix.m12() };
  });
  PLOT = {
    left: dx + LAYOUT_PLOT.left * scale,
    top: dy + LAYOUT_PLOT.top * scale,
    width: LAYOUT_PLOT.width * scale,
    height: LAYOUT_PLOT.height * scale,
  };
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
  await pressButton(page, "Auto scale");
  expect(await copiedResults(page)).toBe(before);
});

/**
 * Reads the visible x interval by sweeping a range across the whole plot width:
 * the range fields then hold the axis limits. Clears the range afterwards.
 */
async function visibleXRange(page: Page): Promise<{ min: number; max: number }> {
  const y = PLOT.top + PLOT.height / 2;
  await page.mouse.move(PLOT.left + 1, y);
  await page.mouse.down();
  await page.mouse.move(PLOT.left + PLOT.width / 2, y, { steps: 4 });
  await page.mouse.move(PLOT.left + PLOT.width - 1, y, { steps: 4 });
  await page.mouse.up();
  const min = Number(await page.getByLabel("Range minimum").inputValue());
  const max = Number(await page.getByLabel("Range maximum").inputValue());
  await pressButton(page, "Clear range");
  await expect(page.getByLabel("Range minimum")).toHaveValue("");
  return { min, max };
}

test("the wheel zooms about the cursor, an axis drag pans, and Auto scale undoes both", async ({ page }) => {
  await open(page);
  const before = await copiedResults(page);
  const full = await visibleXRange(page);
  // The sweep starts and ends a pixel inside the plot, hence the loose tolerance.
  expect(full.min).toBeCloseTo(AXIS.min, 1);
  expect(full.max).toBeCloseTo(AXIS.max, 1);

  // Eight notches in at t = 1.5 s: the span shrinks by 1.1⁸ and 1.5 s stays put.
  const y = PLOT.top + PLOT.height / 2;
  await page.mouse.move(pageX(1.5), y);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -100);
  }
  const span = (AXIS.max - AXIS.min) / 1.1 ** 8;
  const zoomed = await visibleXRange(page);
  expect(zoomed.max - zoomed.min).toBeCloseTo(span, 1);
  expect((zoomed.min + zoomed.max) / 2).toBeCloseTo(1.5, 2);
  // Zooming changed what is drawn, not what is fitted.
  expect(await copiedResults(page)).toBe(before);

  // The wheel over the y axis leaves the x axis alone.
  await page.mouse.move(PLOT.left - 25, y);
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, -100);
  }
  const afterYZoom = await visibleXRange(page);
  expect(afterYZoom.min).toBeCloseTo(zoomed.min, 2);
  expect(afterYZoom.max).toBeCloseTo(zoomed.max, 2);

  // Dragging the x axis 100 px to the right shows smaller x values.
  const stripY = PLOT.top + PLOT.height + 8;
  await page.mouse.move(PLOT.left + 150, stripY);
  await page.mouse.down();
  await page.mouse.move(PLOT.left + 200, stripY, { steps: 4 });
  await page.mouse.move(PLOT.left + 250, stripY, { steps: 4 });
  await page.mouse.up();
  const panned = await visibleXRange(page);
  expect(panned.min).toBeCloseTo(zoomed.min - (100 * span) / PLOT.width, 2);
  expect(panned.max - panned.min).toBeCloseTo(span, 1);

  await pressButton(page, "Auto scale");
  const restored = await visibleXRange(page);
  expect(restored.min).toBeCloseTo(AXIS.min, 1);
  expect(restored.max).toBeCloseTo(AXIS.max, 1);
});

test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("a two-finger pinch zooms without selecting a range", async ({ page }) => {
    await open(page);
    const cdp = await page.context().newCDPSession(page);
    const y = PLOT.top + PLOT.height / 2;
    const centre = pageX(1.5);
    const touch = (type: string, halfGap: number | null) =>
      cdp.send("Input.dispatchTouchEvent", {
        type: type as "touchStart",
        touchPoints:
          halfGap === null
            ? []
            : [
                { x: centre - halfGap, y, id: 0 },
                { x: centre + halfGap, y, id: 1 },
              ],
      });

    // One finger starts what would be a range sweep; the second turns it into a pinch.
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: centre - 30, y, id: 0 }] });
    await touch("touchStart", 30);
    for (const halfGap of [40, 50, 60, 70, 80, 90]) {
      await touch("touchMove", halfGap);
    }
    await touch("touchEnd", null);

    // Fingers three times as far apart: a third of the span, still centred on 1.5 s.
    await expect(page.getByLabel("Range minimum")).toHaveValue("");
    expect(await includedRowCount(page)).toBe(61);
    const zoomed = await visibleXRange(page);
    expect(zoomed.max - zoomed.min).toBeCloseTo((AXIS.max - AXIS.min) / 3, 1);
    expect((zoomed.min + zoomed.max) / 2).toBeCloseTo(1.5, 1);
  });
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
