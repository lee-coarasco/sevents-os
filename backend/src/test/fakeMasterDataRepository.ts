import type {
  CreateCostCodeInput,
  CreateCurrencyInput,
  CreateDocumentTypeInput,
  CreateNumberingSchemeInput,
  CreateUomInput,
  MasterDataRepository,
  UpdateCostCodeInput,
  UpdateCurrencyInput,
  UpdateDocumentTypeInput,
  UpdateNumberingSchemeInput,
  UpdateUomInput,
} from "../modules/masterdata/repository.js";
import type { CostCode, Currency, DocumentType, NumberingScheme, Uom } from "../modules/masterdata/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function nowIso(): string {
  return "2026-10-17T00:00:00.000Z";
}

/** In-memory stand-in for MasterDataRepository, same session/tenant convention as FakeProjectsRepository. */
export class FakeMasterDataRepository implements MasterDataRepository {
  sessions = new Map<string, string>(); // accessToken -> tenant_id
  uomRows = new Map<string, Uom>();
  currencyRows = new Map<string, Currency>();
  costCodeRows = new Map<string, CostCode>();
  documentTypeRows = new Map<string, DocumentType>();
  numberingSchemeRows = new Map<string, NumberingScheme>();
  /** Test seam: entity_id/document_type_id values "in use" by a fake dependent row, keyed by referenced id. */
  estimateLineCostCodeRefs = new Map<string, number>();
  documentDocumentTypeRefs = new Map<string, number>();

  addSession(accessToken: string, tenantId: string) {
    this.sessions.set(accessToken, tenantId);
  }

  private tenantOf(accessToken: string): string {
    const tenantId = this.sessions.get(accessToken);
    if (!tenantId) throw new Error("no tenant for this access token");
    return tenantId;
  }

  // --- UoM ---

  async listUom(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.uomRows.values()].filter((u) => u.tenant_id === tenant_id);
  }

  async createUom(accessToken: string, input: CreateUomInput) {
    const tenant_id = this.tenantOf(accessToken);
    const uom: Uom = {
      id: nextId("uom"),
      tenant_id,
      code: input.code,
      description: input.description ?? null,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    this.uomRows.set(uom.id, uom);
    return uom;
  }

  async updateUom(accessToken: string, id: string, input: UpdateUomInput) {
    const tenant_id = this.tenantOf(accessToken);
    const uom = this.uomRows.get(id);
    if (!uom || uom.tenant_id !== tenant_id) return null;
    const updated = { ...uom, ...input, updated_at: nowIso() };
    this.uomRows.set(id, updated);
    return updated;
  }

  async archiveUom(accessToken: string, id: string) {
    const tenant_id = this.tenantOf(accessToken);
    const uom = this.uomRows.get(id);
    if (!uom || uom.tenant_id !== tenant_id) return null;
    const archived = { ...uom, is_active: false, updated_at: nowIso() };
    this.uomRows.set(id, archived);
    return archived;
  }

  // --- Currencies ---

  async listCurrencies(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.currencyRows.values()].filter((c) => c.tenant_id === tenant_id);
  }

  async createCurrency(accessToken: string, input: CreateCurrencyInput) {
    const tenant_id = this.tenantOf(accessToken);
    const currency: Currency = {
      id: nextId("currency"),
      tenant_id,
      code: input.code,
      name: input.name,
      symbol: input.symbol ?? null,
      is_base_currency: input.is_base_currency ?? false,
      exchange_rate_to_base: input.exchange_rate_to_base ?? 1,
      effective_date: input.effective_date ?? null,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    this.currencyRows.set(currency.id, currency);
    return currency;
  }

  async updateCurrency(accessToken: string, id: string, input: UpdateCurrencyInput) {
    const tenant_id = this.tenantOf(accessToken);
    const currency = this.currencyRows.get(id);
    if (!currency || currency.tenant_id !== tenant_id) return null;
    const updated = { ...currency, ...input, updated_at: nowIso() };
    this.currencyRows.set(id, updated);
    return updated;
  }

  async archiveCurrency(accessToken: string, id: string) {
    const tenant_id = this.tenantOf(accessToken);
    const currency = this.currencyRows.get(id);
    if (!currency || currency.tenant_id !== tenant_id) return null;
    const archived = { ...currency, is_active: false, updated_at: nowIso() };
    this.currencyRows.set(id, archived);
    return archived;
  }

  async clearBaseCurrency(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    for (const [id, currency] of this.currencyRows) {
      if (currency.tenant_id === tenant_id && currency.is_base_currency) {
        this.currencyRows.set(id, { ...currency, is_base_currency: false, updated_at: nowIso() });
      }
    }
  }

  // --- Cost codes ---

  async listCostCodes(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.costCodeRows.values()].filter((c) => c.tenant_id === tenant_id);
  }

  async createCostCode(accessToken: string, input: CreateCostCodeInput) {
    const tenant_id = this.tenantOf(accessToken);
    const costCode: CostCode = {
      id: nextId("cost-code"),
      tenant_id,
      parent_id: input.parent_id ?? null,
      code: input.code,
      description: input.description ?? null,
      category: input.category,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    this.costCodeRows.set(costCode.id, costCode);
    return costCode;
  }

  async updateCostCode(accessToken: string, id: string, input: UpdateCostCodeInput) {
    const tenant_id = this.tenantOf(accessToken);
    const costCode = this.costCodeRows.get(id);
    if (!costCode || costCode.tenant_id !== tenant_id) return null;
    const updated = { ...costCode, ...input, updated_at: nowIso() };
    this.costCodeRows.set(id, updated);
    return updated;
  }

  async archiveCostCode(accessToken: string, id: string) {
    const tenant_id = this.tenantOf(accessToken);
    const costCode = this.costCodeRows.get(id);
    if (!costCode || costCode.tenant_id !== tenant_id) return null;
    const archived = { ...costCode, is_active: false, updated_at: nowIso() };
    this.costCodeRows.set(id, archived);
    return archived;
  }

  async countEstimateLinesReferencingCostCode(_accessToken: string, costCodeId: string) {
    return this.estimateLineCostCodeRefs.get(costCodeId) ?? 0;
  }

  // --- Document types ---

  async listDocumentTypes(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.documentTypeRows.values()].filter((d) => d.tenant_id === tenant_id);
  }

  async createDocumentType(accessToken: string, input: CreateDocumentTypeInput) {
    const tenant_id = this.tenantOf(accessToken);
    const documentType: DocumentType = {
      id: nextId("document-type"),
      tenant_id,
      code: input.code,
      label: input.label,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    this.documentTypeRows.set(documentType.id, documentType);
    return documentType;
  }

  async updateDocumentType(accessToken: string, id: string, input: UpdateDocumentTypeInput) {
    const tenant_id = this.tenantOf(accessToken);
    const documentType = this.documentTypeRows.get(id);
    if (!documentType || documentType.tenant_id !== tenant_id) return null;
    const updated = { ...documentType, ...input, updated_at: nowIso() };
    this.documentTypeRows.set(id, updated);
    return updated;
  }

  async archiveDocumentType(accessToken: string, id: string) {
    const tenant_id = this.tenantOf(accessToken);
    const documentType = this.documentTypeRows.get(id);
    if (!documentType || documentType.tenant_id !== tenant_id) return null;
    const archived = { ...documentType, is_active: false, updated_at: nowIso() };
    this.documentTypeRows.set(id, archived);
    return archived;
  }

  async countDocumentsReferencingDocumentType(_accessToken: string, documentTypeId: string) {
    return this.documentDocumentTypeRefs.get(documentTypeId) ?? 0;
  }

  // --- Numbering schemes ---

  async listNumberingSchemes(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.numberingSchemeRows.values()].filter((n) => n.tenant_id === tenant_id);
  }

  async createNumberingScheme(accessToken: string, input: CreateNumberingSchemeInput) {
    const tenant_id = this.tenantOf(accessToken);
    const numberingScheme: NumberingScheme = {
      id: nextId("numbering-scheme"),
      tenant_id,
      entity_type: input.entity_type,
      prefix: input.prefix ?? "",
      suffix: input.suffix ?? "",
      next_sequence: 1,
      padding: input.padding ?? 4,
      is_active: true,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    this.numberingSchemeRows.set(numberingScheme.id, numberingScheme);
    return numberingScheme;
  }

  async updateNumberingScheme(accessToken: string, id: string, input: UpdateNumberingSchemeInput) {
    const tenant_id = this.tenantOf(accessToken);
    const numberingScheme = this.numberingSchemeRows.get(id);
    if (!numberingScheme || numberingScheme.tenant_id !== tenant_id) return null;
    const updated = { ...numberingScheme, ...input, updated_at: nowIso() };
    this.numberingSchemeRows.set(id, updated);
    return updated;
  }

  async getNumberingScheme(accessToken: string, id: string) {
    const tenant_id = this.tenantOf(accessToken);
    const numberingScheme = this.numberingSchemeRows.get(id);
    if (!numberingScheme || numberingScheme.tenant_id !== tenant_id) return null;
    return numberingScheme;
  }

  async consumeNextSequence(accessToken: string, id: string) {
    const tenant_id = this.tenantOf(accessToken);
    const numberingScheme = this.numberingSchemeRows.get(id);
    if (!numberingScheme || numberingScheme.tenant_id !== tenant_id) return null;
    const updated = { ...numberingScheme, next_sequence: numberingScheme.next_sequence + 1, updated_at: nowIso() };
    this.numberingSchemeRows.set(id, updated);
    return updated;
  }
}
