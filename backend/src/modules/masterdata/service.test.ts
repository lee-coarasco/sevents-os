import { describe, expect, it } from "vitest";
import { FakeMasterDataRepository } from "../../test/fakeMasterDataRepository.js";
import {
  CostCodeInUseError,
  DocumentTypeInUseError,
  NotFoundError,
  NumberingSchemeNotActiveError,
  archiveCostCode,
  archiveDocumentType,
  createCostCode,
  createCurrency,
  createDocumentType,
  createNumberingScheme,
  createUom,
  issueNextNumber,
  previewNextNumber,
  updateCurrency,
  updateNumberingScheme,
} from "./service.js";

const TOKEN = "token-a";
const TENANT = "tenant-a";

function repoWithSession() {
  const repo = new FakeMasterDataRepository();
  repo.addSession(TOKEN, TENANT);
  return repo;
}

describe("uom", () => {
  it("creates a uom row", async () => {
    const repo = repoWithSession();
    const uom = await createUom(repo, TOKEN, { code: "kg", description: "Kilogram" });
    expect(uom.code).toBe("kg");
    expect(uom.is_active).toBe(true);
  });
});

describe("currencies", () => {
  it("only ever has one base currency active at a time", async () => {
    const repo = repoWithSession();
    const aed = await createCurrency(repo, TOKEN, { code: "AED", name: "UAE Dirham", is_base_currency: true });
    const usd = await createCurrency(repo, TOKEN, { code: "USD", name: "US Dollar", is_base_currency: true });

    const currencies = await repo.listCurrencies(TOKEN);
    const base = currencies.filter((c) => c.is_base_currency);
    expect(base).toHaveLength(1);
    expect(base[0]?.id).toBe(usd.id);
    expect((await repo.listCurrencies(TOKEN)).find((c) => c.id === aed.id)?.is_base_currency).toBe(false);
  });

  it("moves the base flag when updating a different currency to base", async () => {
    const repo = repoWithSession();
    const aed = await createCurrency(repo, TOKEN, { code: "AED", name: "UAE Dirham", is_base_currency: true });
    const usd = await createCurrency(repo, TOKEN, { code: "USD", name: "US Dollar" });

    await updateCurrency(repo, TOKEN, usd.id, { is_base_currency: true });

    const currencies = await repo.listCurrencies(TOKEN);
    expect(currencies.find((c) => c.id === usd.id)?.is_base_currency).toBe(true);
    expect(currencies.find((c) => c.id === aed.id)?.is_base_currency).toBe(false);
  });

  it("404s updating a currency that doesn't exist", async () => {
    const repo = repoWithSession();
    await expect(updateCurrency(repo, TOKEN, "missing", { name: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("cost codes", () => {
  it("blocks archiving a cost code referenced by an estimate line", async () => {
    const repo = repoWithSession();
    const costCode = await createCostCode(repo, TOKEN, { code: "L100", category: "labour" });
    repo.estimateLineCostCodeRefs.set(costCode.id, 3);

    await expect(archiveCostCode(repo, TOKEN, costCode.id)).rejects.toBeInstanceOf(CostCodeInUseError);
    try {
      await archiveCostCode(repo, TOKEN, costCode.id);
    } catch (error) {
      expect((error as CostCodeInUseError).referencingCount).toBe(3);
    }
  });

  it("archives a cost code with no references", async () => {
    const repo = repoWithSession();
    const costCode = await createCostCode(repo, TOKEN, { code: "L200", category: "labour" });
    const archived = await archiveCostCode(repo, TOKEN, costCode.id);
    expect(archived.is_active).toBe(false);
  });
});

describe("document types", () => {
  it("blocks archiving a document type referenced by a document", async () => {
    const repo = repoWithSession();
    const documentType = await createDocumentType(repo, TOKEN, { code: "DRG", label: "Drawing" });
    repo.documentDocumentTypeRefs.set(documentType.id, 1);

    await expect(archiveDocumentType(repo, TOKEN, documentType.id)).rejects.toBeInstanceOf(DocumentTypeInUseError);
  });

  it("archives a document type with no references", async () => {
    const repo = repoWithSession();
    const documentType = await createDocumentType(repo, TOKEN, { code: "SPEC", label: "Specification" });
    const archived = await archiveDocumentType(repo, TOKEN, documentType.id);
    expect(archived.is_active).toBe(false);
  });
});

describe("numbering schemes", () => {
  it("previews the next number without consuming it", async () => {
    const repo = repoWithSession();
    const scheme = await createNumberingScheme(repo, TOKEN, { entity_type: "po", prefix: "PO-", padding: 4 });

    const first = await previewNextNumber(repo, TOKEN, scheme.id);
    const second = await previewNextNumber(repo, TOKEN, scheme.id);
    expect(first).toBe("PO-0001");
    expect(second).toBe("PO-0001");
  });

  it("issues sequential numbers that never repeat", async () => {
    const repo = repoWithSession();
    const scheme = await createNumberingScheme(repo, TOKEN, { entity_type: "invoice", prefix: "INV-", padding: 3 });

    const first = await issueNextNumber(repo, TOKEN, scheme.id);
    const second = await issueNextNumber(repo, TOKEN, scheme.id);
    const third = await issueNextNumber(repo, TOKEN, scheme.id);

    expect([first.formatted, second.formatted, third.formatted]).toEqual(["INV-001", "INV-002", "INV-003"]);
  });

  it("refuses to issue a number from an archived scheme", async () => {
    const repo = repoWithSession();
    const scheme = await createNumberingScheme(repo, TOKEN, { entity_type: "rfi" });
    await updateNumberingScheme(repo, TOKEN, scheme.id, { is_active: false });

    await expect(issueNextNumber(repo, TOKEN, scheme.id)).rejects.toBeInstanceOf(NumberingSchemeNotActiveError);
  });

  it("concurrent issue calls never hand out the same formatted number", async () => {
    const repo = repoWithSession();
    const scheme = await createNumberingScheme(repo, TOKEN, { entity_type: "grn", prefix: "GRN-", padding: 2 });

    const results = await Promise.all(Array.from({ length: 5 }, () => issueNextNumber(repo, TOKEN, scheme.id)));
    const formatted = results.map((r) => r.formatted);
    expect(new Set(formatted).size).toBe(5);
  });
});
