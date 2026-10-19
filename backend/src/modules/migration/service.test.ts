import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMigrationService } from "./service.js";
import type { MigrationRepository } from "./repository.js";
import type { MigrationJob } from "./types.js";

describe("Module M38: Migration & Data Quality Service", () => {
  let mockRepo: MigrationRepository;

  beforeEach(() => {
    mockRepo = {
      createJob: vi.fn().mockImplementation(async (_token, data) => ({
        id: "job-101",
        ...data,
        rollback_snapshot: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      getJobById: vi.fn(),
      listJobs: vi.fn(),
      updateJob: vi.fn().mockImplementation(async (_token, id, updates) => ({
        id,
        ...updates,
      } as MigrationJob)),
      checkExistingKeys: vi.fn().mockResolvedValue(new Set(["con-001", "exist@sevents.test"])),
      insertBatch: vi.fn().mockResolvedValue(["id-1", "id-2"]),
      deleteBatch: vi.fn().mockResolvedValue(2),
    };
  });

  it("returns CSV templates with valid headers for all 5 entities", () => {
    const service = createMigrationService(mockRepo);

    const workItemsTpl = service.getSampleTemplate("work_items");
    expect(workItemsTpl.fileName).toBe("work_items_template.csv");
    expect(workItemsTpl.csvContent).toContain("item_code,title,description,unit,category");

    const costCodesTpl = service.getSampleTemplate("cost_codes");
    expect(costCodesTpl.csvContent).toContain("code,name,category,description");

    const employeesTpl = service.getSampleTemplate("employees");
    expect(employeesTpl.csvContent).toContain("first_name,last_name,work_email,job_title,department_code");

    const vendorsTpl = service.getSampleTemplate("vendors");
    expect(vendorsTpl.csvContent).toContain("name,trade_category,trn_number,contact_email,phone");

    const inventoryTpl = service.getSampleTemplate("inventory_items");
    expect(inventoryTpl.csvContent).toContain("item_code,name,uom,reorder_point,unit_cost");
  });

  it("validates rows, flags syntax errors, and detects duplicate keys in file", async () => {
    const service = createMigrationService(mockRepo);

    const rows = [
      { item_code: "NEW-01", title: "Valid Title", unit: "m2" }, // valid
      { item_code: "", title: "Missing Code", unit: "m3" },      // missing item_code
      { item_code: "NEW-01", title: "Duplicate in file", unit: "m2" }, // duplicate in file
    ];

    const result = await service.validateImport(
      "token",
      "tenant-1",
      "work_items",
      "test.csv",
      rows,
      "user-1"
    );

    expect(result.valid).toBe(false);
    expect(result.totalRows).toBe(3);
    expect(result.errorRows).toBe(2);
    expect(result.validRows).toBe(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 3, field: "item_code" }),
        expect.objectContaining({ row: 4, field: "duplicate" }),
      ])
    );
  });

  it("flags database conflict warnings when keys already exist in DB", async () => {
    const service = createMigrationService(mockRepo);

    const rows = [
      { item_code: "CON-001", title: "Existing in DB", unit: "m3" },
    ];

    const result = await service.validateImport(
      "token",
      "tenant-1",
      "work_items",
      "existing.csv",
      rows
    );

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "database_conflict",
          severity: "warning",
        }),
      ])
    );
  });

  it("commits a validated import and stores rollback snapshot", async () => {
    const service = createMigrationService(mockRepo);

    vi.mocked(mockRepo.getJobById).mockResolvedValue({
      id: "job-101",
      tenant_id: "tenant-1",
      entity_type: "work_items",
      file_name: "import.csv",
      status: "validated",
      total_rows: 2,
      valid_rows: 2,
      error_rows: 0,
      row_errors: [],
      rollback_snapshot: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const rows = [
      { item_code: "CW-01", title: "Blockwork", unit: "m2", category: "Masonry" },
      { item_code: "CW-02", title: "Plastering", unit: "m2", category: "Finishes" },
    ];

    const result = await service.commitImport("token", "tenant-1", "job-101", rows, "user-1");

    expect(result.success).toBe(true);
    expect(result.status).toBe("imported");
    expect(mockRepo.insertBatch).toHaveBeenCalledWith("token", "work_items", expect.any(Array));
    expect(mockRepo.updateJob).toHaveBeenCalledWith(
      "token",
      "job-101",
      expect.objectContaining({
        status: "imported",
        rollback_snapshot: ["id-1", "id-2"],
      })
    );
  });

  it("rolls back an imported batch using rollback snapshot IDs", async () => {
    const service = createMigrationService(mockRepo);

    vi.mocked(mockRepo.getJobById).mockResolvedValue({
      id: "job-101",
      tenant_id: "tenant-1",
      entity_type: "work_items",
      file_name: "import.csv",
      status: "imported",
      total_rows: 2,
      valid_rows: 2,
      error_rows: 0,
      row_errors: [],
      rollback_snapshot: ["id-1", "id-2"],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const result = await service.rollbackImport("token", "tenant-1", "job-101", "user-1");

    expect(result.success).toBe(true);
    expect(result.status).toBe("rolled_back");
    expect(mockRepo.deleteBatch).toHaveBeenCalledWith("token", "work_items", ["id-1", "id-2"]);
    expect(mockRepo.updateJob).toHaveBeenCalledWith(
      "token",
      "job-101",
      expect.objectContaining({
        status: "rolled_back",
      })
    );
  });
});
