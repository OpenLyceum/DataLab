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

function fitModelButton(page: Page) {
  return page.getByRole("button", { name: /^Fit model / });
}

async function selectFitModel(page: Page, name: string): Promise<void> {
  await fitModelButton(page).press("Enter");
  const option = page.getByRole("option", { name, exact: true });
  await expect(option).toBeVisible();
  await option.focus();
  await option.press("Enter");
  await expect(fitModelButton(page)).toHaveAccessibleName(`Fit model ${name}`);
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
  await selectFitModel(page, "Quadratic");
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

test("table structure edits keep the fit tied to the surviving columns", async ({ page }) => {
  await open(page);
  await setRange(page, "1.5", "3");
  await pressButton(page, "Add column");
  await expect(page.getByLabel("Name and unit of column 3")).toHaveValue("Column 3");

  // Fit against the original columns after removing a preceding, unselected column.
  await page.getByLabel("Column on the x axis").selectOption("1");
  await page.getByLabel("Column on the y axis").selectOption("1");
  await setRange(page, "0", "2");
  const before = await copiedResults(page);
  await page.getByLabel("Delete column 1", { exact: true }).click();
  await expect(page.getByLabel("Column on the x axis")).toHaveValue("0");
  await expect(page.getByLabel("Range maximum")).toHaveValue("2");
  expect(await copiedResults(page)).toBe(before);

  await page.getByLabel("Delete row 1", { exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(60);
  await expect(page.getByRole("status")).toContainText("of 60 rows");
  await page.getByLabel("Delete column 1", { exact: true }).click();
  await expect(page.getByLabel("Range maximum")).toHaveValue("");
  await expect(page.getByLabel("Delete column 1", { exact: true })).toBeDisabled();

  const cell = page.locator("tbody tr").first().locator("input[type=text]");
  await cell.fill("2");
  await cell.press("Enter");
  await expect(page.getByLabel("Column on the x axis")).toHaveValue("0");
  await expect(page.getByRole("status")).toContainText("Using 1 of 60 rows");
});

test("graph export downloads an opaque PNG with axes and data", async ({ page }) => {
  await open(page);
  await setRange(page, "1.5", "3");
  const downloadEvent = page.waitForEvent("download");
  await pressButton(page, "Export PNG");
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("data-lab.png");
  const path = await download.path();
  expect(path).toBeTruthy();
  const png = readFileSync(path as string);
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const image = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas unavailable");
    }
    context.drawImage(bitmap, 0, 0);
    return {
      width: bitmap.width,
      height: bitmap.height,
      opaqueCorner: context.getImageData(0, 0, 1, 1).data[3] === 255,
      hasDataPoint: context
        .getImageData(0, 0, bitmap.width, bitmap.height)
        .data.some(
          (red, index, pixels) =>
            index % 4 === 0 && red === 79 && pixels[index + 1] === 195 && pixels[index + 2] === 247,
        ),
    };
  }, png.toString("base64"));
  expect(image.width).toBeGreaterThan(385);
  expect(image.height).toBeGreaterThan(380);
  expect(image.opaqueCorner).toBe(true);
  expect(image.hasDataPoint).toBe(true);
});

test("a manually excluded point stays out of the fit after editing and reload", async ({ page }) => {
  await open(page);
  await setRange(page, "1.5", "3");
  const excluded = page.getByLabel("Exclude row 31 from fit", { exact: true });
  await excluded.check();
  expect(await includedRowCount(page)).toBe(30);
  expect(await copiedResults(page)).toContain("Points used: 30");

  await page.getByLabel("Delete row 1", { exact: true }).click();
  const shifted = page.getByLabel("Exclude row 30 from fit", { exact: true });
  await expect(shifted).toBeChecked();
  const cell = page.getByLabel("Position (m), row 30", { exact: true });
  await cell.fill("1,23");
  await cell.press("Enter");

  await open(page);
  await expect(shifted).toBeChecked();
  await expect(cell).toHaveValue("1,23");
  expect(await includedRowCount(page)).toBe(59);

  const [download] = await Promise.all([page.waitForEvent("download"), pressButton(page, "Export CSV")]);
  const exported = readFileSync(await download.path(), "utf8").split("\n");
  expect(exported[30]).toMatch(/^1\.5,1\.23,0,[^,]+,$/);

  await shifted.uncheck();
  expect(await includedRowCount(page)).toBe(60);
});

test("inverse fits skip zero and leave its prediction blank in CSV", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "Distance (m),Signal (V)\n-2,0\n-1,-2\n0,99\n1,6\n2,4\n4,3");
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await selectFitModel(page, "Inverse");
  await expect(page.getByRole("status")).toContainText("1 skipped (undefined reciprocal x)");
  expect(await includedRowCount(page)).toBe(5);
  const summary = await copiedResults(page);
  expect(summary).toContain("Signal = A/Distance + B");
  expect(parameter(summary, "A")).toBeCloseTo(4);
  expect(summary).toMatch(/^A = .* V·m$/m);
  const [download] = await Promise.all([page.waitForEvent("download"), pressButton(page, "Export CSV")]);
  expect(readFileSync(await download.path(), "utf8").split("\n")[3]).toBe("0,99,0,,");
});

test("a y uncertainty column enables weighting and flags unusable uncertainties", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "Time (s),Position (m),Sigma (m)\n0,1,1\n1,2,1\n2,5,2\n3,6,0");
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  const uncertainty = page.getByLabel("Y uncertainty (σ)", { exact: true });
  await uncertainty.selectOption("2");
  await expect(page.getByRole("status")).toContainText("1 skipped (invalid y uncertainty)");
  const summary = await copiedResults(page);
  expect(summary).toContain("Points used: 3");
  expect(summary).toContain("Reduced χ² = 0.4444");
  expect(await includedRowCount(page)).toBe(3);
  await uncertainty.selectOption("-1");
  expect(await includedRowCount(page)).toBe(4);
});

test("calculated columns can be edited, fitted, and restored", async ({ page }) => {
  await open(page);
  await pressButton(page, "Calculated column");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Column name").fill("Scaled time");
  await dialog.getByLabel("Unit (optional)").fill("s");
  await dialog.getByLabel("Formula", { exact: true }).fill("2*C1");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
  const calculated = page.getByLabel("Scaled time (s), row 3", { exact: true });
  await expect(calculated).toHaveValue("0.2");
  await expect(calculated).not.toBeEditable();
  await page.getByLabel("Column on the y axis").selectOption("2");
  expect(parameter(await copiedResults(page), "m")).toBeCloseTo(2);
  await page.getByLabel("Edit formula · Scaled time (s)", { exact: true }).click();
  await dialog.getByLabel("Formula", { exact: true }).fill("3*C1");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => Number(await calculated.inputValue())).toBeCloseTo(0.3);
  await open(page);
  await expect.poll(async () => Number(await calculated.inputValue())).toBeCloseTo(0.3);
});

test("a pinned fit can be compared against another range and clears on table edits", async ({ page }) => {
  await open(page);
  const pin = page.getByRole("button", { name: "Pin fit", exact: true });
  await expect(pin).toBeDisabled();
  await setRange(page, "1.5", "3");
  await pressButton(page, "Pin fit");
  await setRange(page, "0", "1.5");
  await selectFitModel(page, "Quadratic");

  const summary = await copiedResults(page);
  expect(summary).toContain("Current fit\nQuadratic:");
  expect(summary).toContain("Pinned fit\nLinear:");
  expect(summary).toContain("Pinned range: 1.500 s to 3.000 s");
  expect(parameter(summary, "m")).toBeCloseTo(0.9, 1);

  await pressButton(page, "Compare fits");
  const comparison = page.getByRole("dialog", { name: "Compare fits" });
  await expect(comparison).toContainText("Current fit");
  await expect(comparison).toContainText("Pinned fit");
  await comparison.getByRole("button", { name: "Close" }).click();
  await pressButton(page, "Remove pin");
  await expect(page.getByRole("button", { name: "Compare fits" })).toBeDisabled();

  await pressButton(page, "Pin fit");
  await pressButton(page, "Add row");
  await expect(page.getByRole("button", { name: "Compare fits" })).toBeDisabled();
});

test("log axes preserve the fit and a graph drag selects bounds in data units", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "Distance (m),Signal (V)\n0,-1\n1,2\n10,11\n100,101\n1000,1001");
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  const before = await copiedResults(page);
  const toggle = (name: string) => page.getByRole("checkbox", { name, exact: true }).dispatchEvent("click");
  await toggle("Log x");
  await toggle("Log y");
  await expect(page.getByRole("status")).toContainText("Hidden points on log axes (1)");
  expect(await includedRowCount(page)).toBe(5);
  expect(await copiedResults(page)).toBe(before);

  const at = (exponent: number) => PLOT.left + ((exponent + 0.12) / 3.24) * PLOT.width;
  const y = PLOT.top + PLOT.height / 2;
  await page.mouse.move(at(0.5), y);
  await page.mouse.down();
  await page.mouse.move(at(2.5), y, { steps: 8 });
  await page.mouse.up();
  expect(Number(await page.getByLabel("Range minimum").inputValue())).toBeCloseTo(10 ** 0.5, 0);
  expect(Number(await page.getByLabel("Range maximum").inputValue())).toBeGreaterThan(300);
  expect(await includedRowCount(page)).toBe(2);
  await page.mouse.move(at(1), y);
  await page.mouse.wheel(0, -100);
  expect(await includedRowCount(page)).toBe(2);
  await pressButton(page, "Reset All");
  await expect(page.getByRole("checkbox", { name: "Log x", exact: true })).not.toBeChecked();
  expect(await includedRowCount(page)).toBe(5);
});

test("range analysis reports a measured linear slope and signed area", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "Time (s),Position (m)\n0,1\n1,3\n2,5\n3,7");
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await setRange(page, "1", "3");
  await pressButton(page, "Range analysis");
  const analysis = page.getByRole("dialog", { name: "Range analysis" });
  await expect(analysis).toContainText("2.000 m/s");
  await expect(analysis).toContainText("10.00 m·s");
  await expect(analysis).toContainText("5.000 m");
  await analysis.getByRole("button", { name: "Close" }).click();
  await expect(analysis).toHaveCount(0);
});

test("session files restore measurements, axis settings, and both fits", async ({ page }) => {
  await open(page);
  await setRange(page, "1.5", "3");
  await pressButton(page, "Pin fit");
  await setRange(page, "0", "1.5");
  await selectFitModel(page, "Quadratic");
  const log = page.getByRole("checkbox", { name: "Log x", exact: true });
  await log.dispatchEvent("click");
  const [file] = await Promise.all([page.waitForEvent("download"), pressButton(page, "Save session")]);
  expect(file.suggestedFilename()).toBe("data-lab.session.json");
  const saved = readFileSync(await file.path());
  await pressButton(page, "Add row");
  await expect(page.locator("tbody tr")).toHaveCount(62);
  await pressButton(page, "Reset All");

  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), pressButton(page, "Open session")]);
  await chooser.setFiles({ name: file.suggestedFilename(), mimeType: "application/json", buffer: saved });
  await expect(log).toBeChecked();
  await expect(page.locator("tbody tr")).toHaveCount(61);
  await expect(page.getByLabel("Range maximum")).toHaveValue("1.5");
  await expect(page.getByRole("button", { name: "Compare fits" })).toBeEnabled();
  expect(await copiedResults(page)).toContain("Pinned range: 1.500 s to 3.000 s");

  const [invalid] = await Promise.all([page.waitForEvent("filechooser"), pressButton(page, "Open session")]);
  await invalid.setFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(page.getByRole("status")).toContainText("This file is not a supported Data Lab session.");
  await expect(log).toBeChecked();
  await expect(page.locator("tbody tr")).toHaveCount(61);
  await expect(page.getByLabel("Range maximum")).toHaveValue("1.5");
});

test("exponential fits use original measurements and export their predictions", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const data = new DataTransfer();
    const rows = [0, 1, 2, 3, 4].map((t) => `${10 + t},${4 * Math.exp(-0.5 * t)}`);
    data.setData("text/plain", ["Time (s),Signal (V)", ...rows].join("\n"));
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await selectFitModel(page, "Exponential");
  const summary = await copiedResults(page);
  expect(summary).toContain("Exponential: Signal = A·exp(k·(Time − x₀))");
  expect(summary).toMatch(/^k = .* 1\/s$/m);
  expect(summary).toContain("Points used: 5");
  const [download] = await Promise.all([page.waitForEvent("download"), pressButton(page, "Export CSV")]);
  const row = readFileSync(await download.path(), "utf8")
    .split("\n")[3]
    ?.split(",");
  expect(Number(row?.[3])).toBeCloseTo(4 * Math.exp(-1), 10);
  expect(Number(row?.[4])).toBeCloseTo(0, 10);
});

test("the fit menu reaches the sine series and reports all three harmonics", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const data = new DataTransfer();
    const rows = Array.from({ length: 48 }, (_, i) => {
      const t = i * 0.125;
      return `${t},${2 * Math.sin(2.5 * t + 0.4) + 0.5 * Math.sin(5 * t - 0.7) + 0.3 * Math.sin(7.5 * t + 1) + 0.25}`;
    });
    data.setData("text/plain", ["Elapsed time (s),Voltage (V)", ...rows].join("\n"));
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await selectFitModel(page, "Sine series");
  const summary = await copiedResults(page);
  expect(summary).toContain("Sine series: Voltage = A₁·sin(ω·[Elapsed time] + φ₁)");
  expect(summary).toContain("Points used: 48");
  expect(summary).toMatch(/^ω = .* rad\/s$/m);
  expect(parameter(summary, "A₃")).toBeCloseTo(0.3, 4);
});

test("named runs keep separate data and analysis and round-trip together", async ({ page }) => {
  await open(page);
  const active = page.getByLabel("Active run", { exact: true });
  await setRange(page, "1.5", "3");
  await pressButton(page, "Pin fit");
  await page.getByRole("checkbox", { name: "Log x", exact: true }).dispatchEvent("click");
  await pressButton(page, "New run");
  await expect(active).toHaveValue("1");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "Time (s),Signal (V)\n0,5\n1,6\n2,8");
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await setRange(page, "0", "2");
  await selectFitModel(page, "Quadratic");
  await pressButton(page, "Manage run");
  const manager = page.getByRole("dialog", { name: "Manage run" });
  await manager.getByLabel("Run name").fill("Trial B");
  await manager.getByRole("button", { name: "Save", exact: true }).click();
  await expect(active.locator("option:checked")).toHaveText("Trial B");

  await active.selectOption("0");
  await expect(page.locator("tbody tr")).toHaveCount(61);
  await expect(page.getByLabel("Range minimum")).toHaveValue("1.5");
  await expect(page.getByRole("checkbox", { name: "Log x", exact: true })).toBeChecked();
  await expect(page.getByRole("button", { name: "Compare fits" })).toBeEnabled();
  await active.selectOption("1");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(fitModelButton(page)).toHaveAccessibleName("Fit model Quadratic");
  await expect(page.getByRole("button", { name: "Compare fits" })).toBeDisabled();

  const [file] = await Promise.all([page.waitForEvent("download"), pressButton(page, "Save session")]);
  const saved = readFileSync(await file.path());
  await pressButton(page, "Manage run");
  await manager.getByRole("button", { name: "Delete run", exact: true }).click();
  await expect(manager.getByRole("heading")).toHaveText("Delete “Trial B”?");
  await manager.getByRole("button", { name: "Delete run", exact: true }).click();
  await expect(active.locator("option")).toHaveCount(1);

  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), pressButton(page, "Open session")]);
  await chooser.setFiles({ name: file.suggestedFilename(), mimeType: "application/json", buffer: saved });
  await expect(active.locator("option:checked")).toHaveText("Trial B");
  await expect(page.getByLabel("Signal (V), row 3", { exact: true })).toHaveValue("8");
  await expect(fitModelButton(page)).toHaveAccessibleName("Fit model Quadratic");
  await active.selectOption("0");
  await expect(page.getByRole("button", { name: "Compare fits" })).toBeEnabled();
});

test("rectangle drag constrains both axes and feeds the fit and CSV", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/plain", "x,y\n0,0\n1,1\n2,2\n2,8\n3,3\n4,4");
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await page.getByRole("checkbox", { name: "Rectangle", exact: true }).dispatchEvent("click");
  const px = (x: number) => PLOT.left + ((x + 0.16) / 4.32) * PLOT.width;
  const py = (y: number) => PLOT.top + ((8.64 - y) / 9.28) * PLOT.height;
  await page.mouse.move(px(3.5), py(3.5));
  await page.mouse.down();
  await page.mouse.move(px(0.5), py(0.5), { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole("status")).toContainText("Using 3 of 6 rows");
  await expect(page.getByRole("status")).toContainText("y from");
  const [file] = await Promise.all([page.waitForEvent("download"), pressButton(page, "Export CSV")]);
  expect(readFileSync(await file.path(), "utf8")).toContain("2,8,0,");
  const maxY = page.getByLabel("Selection y maximum");
  await maxY.fill("9");
  await maxY.press("Enter");
  await expect(page.getByRole("status")).toContainText("Using 4 of 6 rows");
  const [saved] = await Promise.all([page.waitForEvent("download"), pressButton(page, "Save session")]);
  await pressButton(page, "Clear range");
  await expect(maxY).toHaveValue("");
  const minY = page.getByLabel("Selection y minimum");
  await minY.fill("0.5");
  await minY.press("Enter");
  await maxY.fill("4.5");
  await maxY.press("Enter");
  await expect(page.getByRole("status")).toContainText("Using 4 of 6 rows");

  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), pressButton(page, "Open session")]);
  await chooser.setFiles({
    name: saved.suggestedFilename(),
    mimeType: "application/json",
    buffer: readFileSync(await saved.path()),
  });
  await expect(maxY).toHaveValue("9");
});

test("PASCO Smart Cart capture turns signed samples into a new run", async ({ page }) => {
  await page.addInitScript(() => {
    const reader = Object.assign(new EventTarget(), {
      value: new DataView(new ArrayBuffer(5)),
      startNotifications: () => Promise.resolve(),
    });
    Object.defineProperty(navigator, "bluetooth", {
      value: {
        requestDevice: (options: { filters: { namePrefix: string }[]; optionalServices: string[] }) => {
          const serviceId = "4a5c0003-0000-0000-0000-5c1e741f1c00";
          if (options.filters[0]?.namePrefix !== "Smart Cart" || !options.optionalServices.includes(serviceId)) {
            throw new Error("Wrong filter");
          }
          const writer = {
            properties: { write: true },
            writeValueWithResponse: (command: Uint8Array) => {
              if (String(command) !== "5,2") {
                throw new Error("Wrong sample request");
              }
              reader.value.setUint8(0, 0xc0);
              reader.value.setUint8(2, 5);
              reader.value.setInt16(3, -816, true);
              reader.dispatchEvent(new Event("characteristicvaluechanged"));
              return Promise.resolve();
            },
          };
          const gatt = {
            connect: (): Promise<unknown> => Promise.resolve(gatt),
            disconnect: () => undefined,
            getPrimaryService: (id: string) => {
              if (id !== serviceId) {
                throw new Error("Wrong service");
              }
              return Promise.resolve({
                getCharacteristic: (characteristic: string) =>
                  Promise.resolve(characteristic.includes("-0002-") ? writer : reader),
              });
            },
          };
          return Promise.resolve(Object.assign(new EventTarget(), { name: "Smart Cart Test", gatt }));
        },
      },
    });
  });
  await open(page);
  await pressButton(page, "PASCO");
  const dialog = page.getByRole("dialog", { name: "PASCO" });
  await dialog.getByRole("button", { name: "Connect and record" }).click();
  await expect(dialog.getByRole("status")).toContainText(/Samples: [2-9]\d*|Samples: [1-9]\d+/);
  await dialog.getByRole("button", { name: "Stop", exact: true }).click();
  await dialog.getByRole("button", { name: "Use recording" }).click();
  const active = page.getByLabel("Active run", { exact: true });
  await expect(active.locator("option:checked")).toHaveText("Smart Cart Test");
  await expect(page.getByLabel("Position (m), row 1", { exact: true })).toHaveValue("0");
  expect(Number(await page.getByLabel("Position (m), row 2", { exact: true }).inputValue())).toBeCloseTo(-0.09895, 8);
  await active.selectOption("0");
  await expect(page.locator("tbody tr")).toHaveCount(61);
});
