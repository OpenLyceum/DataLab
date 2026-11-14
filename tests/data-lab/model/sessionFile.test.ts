import { expect, test } from "vitest";
import { parseTable } from "../../../src/common/model/parseTable.js";
import { decodeSession, encodeSession, type Session } from "../../../src/data-lab/model/sessionFile.js";

const session: Session = {
  dataset: parseTable("X,Y\n0,1\n1,2").dataset,
  xColumn: 0,
  yColumn: 1,
  uncertaintyColumn: -1,
  model: "linear",
  range: null,
  pin: null,
  logX: false,
  logY: false,
  showResiduals: true,
};

test("version 1 sessions open as a single named run", () => {
  const text = JSON.stringify({ ...session, version: 1, format: "openlyceum-data-lab" });
  const decoded = decodeSession(text, "Run 1");
  expect(decoded?.activeIndex).toBe(0);
  expect(decoded?.runs[0]).toMatchObject({ name: "Run 1", session });
});

test("version 2 preserves the active run and rejects a malformed inactive run", () => {
  const runs = [
    { name: "Base", session },
    { name: "Trial", session: { ...session, logY: true } },
  ];
  const text = encodeSession({ runs, activeIndex: 1 });
  expect(decodeSession(text, "")).toMatchObject({ runs, activeIndex: 1 });
  const invalid = encodeSession({ runs, activeIndex: 2 });
  expect(decodeSession(invalid, "")).toBeNull();
  const corrupt = text.replace('"name":"Base"', '"name":42');
  expect(decodeSession(corrupt, "")).toBeNull();
});
