import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvLine } from "./csv.js";

describe("parseCsvLine", () => {
  it("splits a plain comma-separated line", () => {
    expect(parseCsvLine("1,Legal,Contracts & Legal Assistant")).toEqual(["1", "Legal", "Contracts & Legal Assistant"]);
  });

  it("handles a quoted field containing a comma", () => {
    expect(parseCsvLine('1,"Approve, then notify",Chairman')).toEqual(["1", "Approve, then notify", "Chairman"]);
  });

  it("handles an escaped double-quote inside a quoted field", () => {
    expect(parseCsvLine('1,"Say ""hello""",Chairman')).toEqual(["1", 'Say "hello"', "Chairman"]);
  });

  it("preserves empty trailing fields", () => {
    expect(parseCsvLine("1,2,")).toEqual(["1", "2", ""]);
  });
});

describe("parseCsv", () => {
  it("parses a header + rows into an array of objects", () => {
    const rows = parseCsv("s_no,department\n1,Legal\n2,Finance\n");
    expect(rows).toEqual([
      { s_no: "1", department: "Legal" },
      { s_no: "2", department: "Finance" },
    ]);
  });

  it("ignores blank trailing lines", () => {
    const rows = parseCsv("s_no\n1\n\n");
    expect(rows).toEqual([{ s_no: "1" }]);
  });
});
