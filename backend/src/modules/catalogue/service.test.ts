import { beforeEach, describe, expect, it } from "vitest";
import { FakeCatalogueRepository } from "../../test/fakeCatalogueRepository.js";
import {
  InvalidDispositionError,
  WorkItemNotFoundError,
  getWorkItem,
  importCatalogue,
  listWorkItems,
  updateWorkItem,
} from "./service.js";
import type { DispositionRow, RawCatalogueRow } from "./types.js";

const TOKEN = "caller-token";

function rawRow(overrides: Partial<RawCatalogueRow> = {}): RawCatalogueRow {
  return {
    "S.No.": 1,
    Department: "Company / Leadership",
    "Work Item Name": "Approve the company vision",
    "Who is Responsible": "Chairman",
    Description: "A description.",
    Trigger: "Trigger text.",
    Action: "Action text.",
    "Output/Evidence": "Output text.",
    "Control/Handoff": "Handoff text.",
    "Continuity/Escalation": "Escalation text.",
    Timing: "Timing text.",
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

describe("importCatalogue", () => {
  let repo: FakeCatalogueRepository;

  beforeEach(() => {
    repo = new FakeCatalogueRepository();
    repo.roleDepartmentClusters.set("role.chairman", "Company / Leadership");
  });

  it("creates a new work item definition on first import", async () => {
    const result = await importCatalogue(repo, [rawRow()], [dispositionRow()], {
      sourceFileName: "work-item-catalogue.xlsx",
      sourceFileChecksum: "abc123",
      importedBy: "admin-user",
    });
    expect(result).toMatchObject({ totalRows: 1, created: 1, updated: 0, unchanged: 0, issues: [] });
    expect(repo.definitionsById.size).toBe(1);
    const [definition] = [...repo.definitionsById.values()];
    expect(definition!.disposition).toBe("Configure approval/decision");
    expect(definition!.department_cluster).toBe("Company / Leadership");
    expect(definition!.current_version).toBe(1);
  });

  it("is idempotent: re-importing identical rows changes nothing", async () => {
    const meta = { sourceFileName: "f.xlsx", sourceFileChecksum: "abc123", importedBy: "admin-user" };
    await importCatalogue(repo, [rawRow()], [dispositionRow()], meta);
    const second = await importCatalogue(repo, [rawRow()], [dispositionRow()], meta);
    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 1 });
    expect(repo.definitionsById.size).toBe(1);
  });

  it("bumps the version and appends a version row when a re-import changes the normalized disposition", async () => {
    const meta = { sourceFileName: "f.xlsx", sourceFileChecksum: "abc123", importedBy: "admin-user" };
    await importCatalogue(repo, [rawRow()], [dispositionRow()], meta);
    const second = await importCatalogue(
      repo,
      [rawRow()],
      [dispositionRow({ disposition: "Configure workflow" })],
      meta,
    );
    expect(second).toMatchObject({ created: 0, updated: 1, unchanged: 0 });
    const [definition] = [...repo.definitionsById.values()];
    expect(definition!.disposition).toBe("Configure workflow");
    expect(definition!.current_version).toBe(2);
    expect(repo.versions).toHaveLength(2);
  });

  it("surfaces merge issues (e.g. a row with no disposition classification) without failing the import", async () => {
    const result = await importCatalogue(
      repo,
      [rawRow(), rawRow({ "S.No.": 2 })],
      [dispositionRow()],
      { sourceFileName: "f.xlsx", sourceFileChecksum: "abc", importedBy: null },
    );
    expect(result.created).toBe(1);
    expect(result.issues).toEqual([{ source_serial: 2, reason: "no disposition-workbook row for this S.No." }]);
  });
});

describe("listWorkItems / getWorkItem", () => {
  let repo: FakeCatalogueRepository;

  beforeEach(async () => {
    repo = new FakeCatalogueRepository();
    repo.roleDepartmentClusters.set("role.chairman", "Company / Leadership");
    await importCatalogue(repo, [rawRow()], [dispositionRow()], {
      sourceFileName: "f.xlsx",
      sourceFileChecksum: "abc",
      importedBy: "admin-user",
    });
  });

  it("lists work items matching a filter", async () => {
    const found = await listWorkItems(repo, TOKEN, { disposition: "Configure approval/decision" });
    expect(found).toHaveLength(1);
    const notFound = await listWorkItems(repo, TOKEN, { disposition: "Defer" });
    expect(notFound).toHaveLength(0);
  });

  it("filters on missing priority/risk/phase/capability data", async () => {
    const missing = await listWorkItems(repo, TOKEN, { missingData: true });
    expect(missing).toHaveLength(1);
  });

  it("returns the full detail including source provenance and version history", async () => {
    const [definition] = await listWorkItems(repo, TOKEN, {});
    const detail = await getWorkItem(repo, TOKEN, definition!.id);
    expect(detail?.source.who_is_responsible).toBe("Chairman");
    expect(detail?.versions).toHaveLength(1);
  });
});

describe("updateWorkItem", () => {
  let repo: FakeCatalogueRepository;
  let workItemId: string;

  beforeEach(async () => {
    repo = new FakeCatalogueRepository();
    repo.roleDepartmentClusters.set("role.chairman", "Company / Leadership");
    await importCatalogue(repo, [rawRow()], [dispositionRow()], {
      sourceFileName: "f.xlsx",
      sourceFileChecksum: "abc",
      importedBy: "admin-user",
    });
    const [definition] = [...repo.definitionsById.values()];
    workItemId = definition!.id;
  });

  it("bumps current_version and appends a version row on a normalized-field edit", async () => {
    const updated = await updateWorkItem(repo, TOKEN, workItemId, { risk_tier: "high" }, "process-owner");
    expect(updated.risk_tier).toBe("high");
    expect(updated.current_version).toBe(2);
    expect(updated.updated_by).toBe("process-owner");
    expect(repo.versions.filter((v) => v.work_item_definition_id === workItemId)).toHaveLength(2);
  });

  it("rejects a disposition value outside the BRD §6.5 taxonomy", async () => {
    await expect(
      updateWorkItem(repo, TOKEN, workItemId, { disposition: "Not a real value" as never }, "process-owner"),
    ).rejects.toBeInstanceOf(InvalidDispositionError);
  });

  it("rejects an unknown work item id", async () => {
    await expect(
      updateWorkItem(repo, TOKEN, "missing-id", { risk_tier: "high" }, "process-owner"),
    ).rejects.toBeInstanceOf(WorkItemNotFoundError);
  });
});
