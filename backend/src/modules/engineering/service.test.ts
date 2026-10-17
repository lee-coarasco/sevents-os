import { describe, it, expect, vi } from "vitest";
import {
  NotFoundError,
  DraftOnlyError,
  getDesignBrief,
  deleteDesignBrief,
  createRfi,
  updateAsBuilt,
} from "./service.js";
import type { EngineeringRepository } from "./repository.js";
import type { MasterDataRepository } from "../masterdata/repository.js";
import type { DesignBrief, Rfi, AsBuiltRecord } from "./types.js";

function makeRepo(overrides: Partial<EngineeringRepository> = {}): EngineeringRepository {
  return {
    listDesignBriefs: vi.fn().mockResolvedValue([]),
    getDesignBrief: vi.fn().mockResolvedValue(null),
    createDesignBrief: vi.fn(),
    updateDesignBrief: vi.fn().mockResolvedValue(null),
    deleteDesignBrief: vi.fn().mockResolvedValue(true),
    listRfis: vi.fn().mockResolvedValue([]),
    getRfi: vi.fn().mockResolvedValue(null),
    createRfi: vi.fn(),
    updateRfi: vi.fn().mockResolvedValue(null),
    listIFCRegister: vi.fn().mockResolvedValue([]),
    listAsBuilt: vi.fn().mockResolvedValue([]),
    createAsBuilt: vi.fn(),
    updateAsBuilt: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeMasterDataRepo(overrides: Partial<MasterDataRepository> = {}): MasterDataRepository {
  return {
    listUom: vi.fn().mockResolvedValue([]),
    createUom: vi.fn(),
    updateUom: vi.fn(),
    archiveUom: vi.fn(),
    listCurrencies: vi.fn().mockResolvedValue([]),
    createCurrency: vi.fn(),
    updateCurrency: vi.fn(),
    archiveCurrency: vi.fn(),
    listCostCodes: vi.fn().mockResolvedValue([]),
    createCostCode: vi.fn(),
    updateCostCode: vi.fn(),
    archiveCostCode: vi.fn(),
    listDocumentTypes: vi.fn().mockResolvedValue([]),
    createDocumentType: vi.fn(),
    updateDocumentType: vi.fn(),
    archiveDocumentType: vi.fn(),
    listProjectTypes: vi.fn().mockResolvedValue([]),
    createProjectType: vi.fn(),
    updateProjectType: vi.fn(),
    archiveProjectType: vi.fn(),
    listNumberingSchemes: vi.fn().mockResolvedValue([]),
    createNumberingScheme: vi.fn(),
    updateNumberingScheme: vi.fn(),
    getNumberingScheme: vi.fn().mockResolvedValue(null),
    consumeNextSequence: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as MasterDataRepository;
}

function makeDesignBrief(overrides: Partial<DesignBrief> = {}): DesignBrief {
  return {
    id: "brief-1",
    tenant_id: "t1",
    project_id: "p1",
    title: "Structural brief",
    discipline: "Structural",
    scope_description: null,
    status: "draft",
    reference_document_ids: [],
    issued_by: null,
    issued_at: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("getDesignBrief", () => {
  it("returns brief when found", async () => {
    const brief = makeDesignBrief();
    const repo = makeRepo({ getDesignBrief: vi.fn().mockResolvedValue(brief) });
    await expect(getDesignBrief(repo, "tok", "brief-1")).resolves.toEqual(brief);
  });

  it("throws NotFoundError when brief not found", async () => {
    const repo = makeRepo({ getDesignBrief: vi.fn().mockResolvedValue(null) });
    await expect(getDesignBrief(repo, "tok", "x")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("deleteDesignBrief", () => {
  it("deletes a draft brief", async () => {
    const brief = makeDesignBrief({ status: "draft" });
    const deleteFn = vi.fn().mockResolvedValue(true);
    const repo = makeRepo({
      getDesignBrief: vi.fn().mockResolvedValue(brief),
      deleteDesignBrief: deleteFn,
    });
    await deleteDesignBrief(repo, "tok", "brief-1");
    expect(deleteFn).toHaveBeenCalledWith("tok", "brief-1");
  });

  it("throws DraftOnlyError for issued brief", async () => {
    const brief = makeDesignBrief({ status: "issued" });
    const repo = makeRepo({ getDesignBrief: vi.fn().mockResolvedValue(brief) });
    await expect(deleteDesignBrief(repo, "tok", "brief-1")).rejects.toBeInstanceOf(DraftOnlyError);
  });
});

describe("createRfi", () => {
  it("generates RFI number from numbering scheme when available", async () => {
    const scheme = {
      id: "scheme-1",
      tenant_id: "t1",
      entity_type: "rfi",
      prefix: "RFI-",
      suffix: "",
      next_sequence: 1,
      padding: 4,
      is_active: true,
      created_at: "",
      updated_at: "",
    };
    const updatedScheme = { ...scheme, next_sequence: 2 };
    const masterDataRepo = makeMasterDataRepo({
      listNumberingSchemes: vi.fn().mockResolvedValue([scheme]),
      consumeNextSequence: vi.fn().mockResolvedValue(updatedScheme),
    });
    const createdRfi: Rfi = {
      id: "rfi-1",
      tenant_id: "t1",
      project_id: "p1",
      rfi_number: "RFI-0001",
      raised_by: null,
      addressed_to_user_id: null,
      addressed_to_contact_id: null,
      subject: "Clarify foundation depth",
      description: null,
      date_raised: "2026-01-01",
      date_required: null,
      date_responded: null,
      response: null,
      status: "open",
      reference_document_ids: [],
      created_at: "2026-01-01T00:00:00Z",
    };
    const createFn = vi.fn().mockResolvedValue(createdRfi);
    const repo = makeRepo({
      listRfis: vi.fn().mockResolvedValue([]),
      createRfi: createFn,
    });
    await createRfi(repo, masterDataRepo, "tok", "p1", { subject: "Clarify foundation depth" });
    expect(createFn).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({ rfi_number: "RFI-0001" }),
    );
  });

  it("falls back to sequential number when no scheme defined", async () => {
    const masterDataRepo = makeMasterDataRepo({
      listNumberingSchemes: vi.fn().mockResolvedValue([]),
    });
    const createFn = vi.fn().mockResolvedValue({ id: "r1", rfi_number: "RFI-0001" });
    const repo = makeRepo({ listRfis: vi.fn().mockResolvedValue([]), createRfi: createFn });
    await createRfi(repo, masterDataRepo, "tok", "p1", { subject: "Soil test results" });
    expect(createFn).toHaveBeenCalledWith("tok", expect.objectContaining({ rfi_number: "RFI-0001" }));
  });
});

describe("updateAsBuilt", () => {
  it("throws NotFoundError when record not found", async () => {
    const repo = makeRepo({ updateAsBuilt: vi.fn().mockResolvedValue(null) });
    await expect(updateAsBuilt(repo, "tok", "x", {})).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns updated record", async () => {
    const record: AsBuiltRecord = {
      id: "ab-1",
      tenant_id: "t1",
      project_id: "p1",
      document_id: "d1",
      original_revision_id: null,
      as_built_revision_id: null,
      confirmed_by: null,
      confirmed_at: null,
      notes: null,
      created_at: "2026-01-01T00:00:00Z",
    };
    const repo = makeRepo({ updateAsBuilt: vi.fn().mockResolvedValue(record) });
    await expect(updateAsBuilt(repo, "tok", "ab-1", { notes: "confirmed" })).resolves.toEqual(record);
  });
});
