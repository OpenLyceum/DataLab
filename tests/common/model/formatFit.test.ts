import { describe, expect, it } from "vitest";
import {
  formatSignificant,
  formatWithUncertainty,
  parameterUnit,
  withUnit,
} from "../../../src/common/model/formatFit.js";

describe("parameterUnit", () => {
  it("builds [y]/[x]^power as text", () => {
    expect(parameterUnit("s", "m", 0)).toBe("m");
    expect(parameterUnit("s", "m", 1)).toBe("m/s");
    expect(parameterUnit("s", "m", 2)).toBe("m/s²");
  });

  it("parenthesizes compound units", () => {
    expect(parameterUnit("m/s", "N", 1)).toBe("N/(m/s)");
    expect(parameterUnit("s", "kg m", 2)).toBe("(kg m)/s²");
  });

  it("drops blank units", () => {
    expect(parameterUnit("", "m", 2)).toBe("m");
    expect(parameterUnit("s", "", 1)).toBe("1/s");
    expect(parameterUnit("", "", 1)).toBe("");
  });
});

describe("formatWithUncertainty", () => {
  it("rounds the value to two significant figures of its error", () => {
    expect(formatWithUncertainty(0.90123, 0.00337)).toBe("0.9012 ± 0.0034");
    expect(formatWithUncertainty(-0.3008, 0.0284)).toBe("-0.301 ± 0.028");
    expect(formatWithUncertainty(12.3456, 1.234)).toBe("12.3 ± 1.2");
  });

  it("rounds to tens or hundreds when the error is large", () => {
    expect(formatWithUncertainty(12345, 230)).toBe("12350 ± 230");
  });

  it("uses a shared power of ten for very small or large numbers", () => {
    expect(formatWithUncertainty(-3.16081871e-15, 4.8665e-17)).toBe("(-3.161 ± 0.049)×10⁻¹⁵");
    expect(formatWithUncertainty(7.3206e-7, 1.578e-10)).toBe("(7.3206 ± 0.0016)×10⁻⁷");
  });

  it("falls back to four significant figures without an error", () => {
    expect(formatWithUncertainty(0.901234, null)).toBe("0.9012");
    expect(formatWithUncertainty(3, null)).toBe("3.000");
  });
});

describe("formatSignificant and withUnit", () => {
  it("formats ordinary and extreme magnitudes", () => {
    expect(formatSignificant(1.5)).toBe("1.500");
    expect(formatSignificant(0)).toBe("0");
    expect(formatSignificant(123456.7)).toBe("123457");
    expect(formatSignificant(2.5e-7, 3)).toBe("2.50×10⁻⁷");
    expect(formatSignificant(Number.NaN)).toBe("—");
  });

  it("appends a unit only when there is one", () => {
    expect(withUnit("1.5", "s")).toBe("1.5 s");
    expect(withUnit("1.5", "")).toBe("1.5");
  });
});
