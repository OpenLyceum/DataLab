import { Range } from "scenerystack/dot";
import { describe, expect, it } from "vitest";
import { paddedRange, panBy, zoomAbout } from "../../../src/common/view/axisRange.js";

describe("zoomAbout", () => {
  it("keeps the anchor at the same fraction of the axis", () => {
    const zoomed = zoomAbout(new Range(0, 10), 0.5, 2);
    expect(zoomed.min).toBeCloseTo(1, 12);
    expect(zoomed.max).toBeCloseTo(6, 12);
    // The anchor was 20 % of the way along, and still is.
    expect((2 - zoomed.min) / zoomed.getLength()).toBeCloseTo(0.2, 12);
  });

  it("zooms out with a factor above one and undoes a zoom in", () => {
    const range = new Range(-3, 5);
    const back = zoomAbout(zoomAbout(range, 1 / 1.1, 1), 1.1, 1);
    expect(back.min).toBeCloseTo(-3, 12);
    expect(back.max).toBeCloseTo(5, 12);
  });

  it("refuses a zoom that would collapse the range", () => {
    const range = new Range(1e9, 1e9 + 1);
    expect(zoomAbout(range, 1e-3, 1e9 + 0.5)).toBe(range);
    expect(zoomAbout(range, 0, 1e9)).toBe(range);
    expect(zoomAbout(range, Number.POSITIVE_INFINITY, 1e9)).toBe(range);
  });
});

describe("panBy and paddedRange", () => {
  it("shifts both ends", () => {
    const panned = panBy(new Range(0, 4), -1.5);
    expect([panned.min, panned.max]).toEqual([-1.5, 2.5]);
  });

  it("pads a range and opens up a single value", () => {
    const padded = paddedRange(0, 10, 0.1);
    expect([padded.min, padded.max]).toEqual([-1, 11]);
    const single = paddedRange(4, 4, 0.1);
    expect([single.min, single.max]).toEqual([2, 6]);
    const zero = paddedRange(0, 0, 0.1);
    expect([zero.min, zero.max]).toEqual([-1, 1]);
    const empty = paddedRange(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0.1);
    expect([empty.min, empty.max]).toEqual([0, 1]);
  });
});
