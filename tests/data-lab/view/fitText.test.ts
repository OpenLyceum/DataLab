/** The caution under the results when reduced χ² says the uncertainties are off. */

import { beforeEach, describe, expect, it } from "vitest";
import { DataLabModel } from "../../../src/data-lab/model/DataLabModel.js";
import { createFitTextProperty } from "../../../src/data-lab/view/fitText.js";

/** y = 2x + 1 with scatter of about 0.1, and three candidate σ columns. */
const TABLE = [
  "x,y,right,small,large",
  "0,1.08,0.1,0.005,5",
  "1,2.91,0.1,0.005,5",
  "2,5.11,0.1,0.005,5",
  "3,6.93,0.1,0.005,5",
  "4,9.07,0.1,0.005,5",
  "5,10.9,0.1,0.005,5",
  "6,13.1,0.1,0.005,5",
  "7,14.92,0.1,0.005,5",
].join("\n");

beforeEach(() => localStorage.clear());

describe("reduced χ² caution", () => {
  it("speaks up only when χ² is far from 1", () => {
    const model = new DataLabModel();
    model.importText(TABLE);
    const fitText = createFitTextProperty(model);
    expect(fitText.value.caution).toBe("");

    model.uncertaintyColumnIndexProperty.value = 2;
    expect(fitText.value.caution).toBe("");
    model.uncertaintyColumnIndexProperty.value = 3;
    expect(fitText.value.caution).toContain("≫ 1");
    model.uncertaintyColumnIndexProperty.value = 4;
    expect(fitText.value.caution).toContain("≪ 1");
  });
});
