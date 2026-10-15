import { describe, expect, it } from "vitest";
import { mergeCatalogueRows } from "./importParser.js";
import type { DispositionRow, RawCatalogueRow } from "./types.js";

function rawRow(overrides: Partial<RawCatalogueRow> = {}): RawCatalogueRow {
  return {
    "S.No.": 1,
    Department: "Company / Leadership",
    "Work Item Name": "Approve the company vision",
    "Who is Responsible": "Chairman",
    Description: "A description.",
    Trigger: "When the annual governance cycle requires a decision.",
    Action: "The Chairman approves.",
    "Output/Evidence": "a signed decision",
    "Control/Handoff": "CEO owns submission",
    "Continuity/Escalation": "Only an authorised alternate may act",
    Timing: "Within three working days",
    ...overrides,
  };
}

function dispositionRow(overrides: Partial<DispositionRow> = {}): DispositionRow {
  return {
    s_no: 1,
    department: "Company / Leadership",
    who_is_responsible: "Chairman",
    canonical_role_id: "role.chairman",
    disposition: "Configure approval/decision",
    ticket_id: "32",
    review_needed: "",
    ...overrides,
  };
}

describe("mergeCatalogueRows", () => {
  it("merges a raw row with its disposition row by serial", () => {
    const { rows, issues } = mergeCatalogueRows([rawRow()], [dispositionRow()]);
    expect(issues).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source_serial: 1,
      canonical_role_id: "role.chairman",
      disposition: "Configure approval/decision",
      ticket_ref: "32",
    });
  });

  it("flags a raw row with no matching disposition row instead of throwing", () => {
    const { rows, issues } = mergeCatalogueRows([rawRow({ "S.No.": 2 })], [dispositionRow({ s_no: 1 })]);
    expect(rows).toHaveLength(0);
    expect(issues).toEqual([{ source_serial: 2, reason: "no disposition-workbook row for this S.No." }]);
  });

  it("flags a disposition value outside the BRD §6.5 taxonomy instead of importing it", () => {
    const { rows, issues } = mergeCatalogueRows(
      [rawRow()],
      [dispositionRow({ disposition: "Not a real disposition" })],
    );
    expect(rows).toHaveLength(0);
    expect(issues[0]?.reason).toContain("is not one of the BRD §6.5 values");
  });

  it("throws on a duplicate S.No. in the raw rows", () => {
    expect(() => mergeCatalogueRows([rawRow(), rawRow()], [dispositionRow()])).toThrow(/duplicate S\.No\./);
  });

  it("throws on a duplicate s_no in the disposition workbook", () => {
    expect(() => mergeCatalogueRows([rawRow()], [dispositionRow(), dispositionRow()])).toThrow(/duplicate s_no/);
  });
});
