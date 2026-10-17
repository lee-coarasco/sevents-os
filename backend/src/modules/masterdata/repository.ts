import type { SupabaseClient } from "@supabase/supabase-js";
import type { CostCode, CostCodeCategory, Currency, DocumentType, NumberingScheme, Uom } from "./types.js";

export interface CreateUomInput {
  code: string;
  description?: string | null;
}

export interface UpdateUomInput {
  code?: string;
  description?: string | null;
  is_active?: boolean;
}

export interface CreateCurrencyInput {
  code: string;
  name: string;
  symbol?: string | null;
  is_base_currency?: boolean;
  exchange_rate_to_base?: number;
  effective_date?: string | null;
}

export interface UpdateCurrencyInput {
  code?: string;
  name?: string;
  symbol?: string | null;
  is_base_currency?: boolean;
  exchange_rate_to_base?: number;
  effective_date?: string | null;
  is_active?: boolean;
}

export interface CreateCostCodeInput {
  parent_id?: string | null;
  code: string;
  description?: string | null;
  category: CostCodeCategory;
}

export interface UpdateCostCodeInput {
  parent_id?: string | null;
  code?: string;
  description?: string | null;
  category?: CostCodeCategory;
  is_active?: boolean;
}

export interface CreateDocumentTypeInput {
  code: string;
  label: string;
}

export interface UpdateDocumentTypeInput {
  code?: string;
  label?: string;
  is_active?: boolean;
}

export interface CreateNumberingSchemeInput {
  entity_type: string;
  prefix?: string | null;
  suffix?: string | null;
  padding?: number;
}

export interface UpdateNumberingSchemeInput {
  prefix?: string;
  suffix?: string;
  padding?: number;
  is_active?: boolean;
}

export interface MasterDataRepository {
  listUom(accessToken: string): Promise<Uom[]>;
  createUom(accessToken: string, input: CreateUomInput): Promise<Uom>;
  updateUom(accessToken: string, id: string, input: UpdateUomInput): Promise<Uom | null>;
  archiveUom(accessToken: string, id: string): Promise<Uom | null>;

  listCurrencies(accessToken: string): Promise<Currency[]>;
  createCurrency(accessToken: string, input: CreateCurrencyInput): Promise<Currency>;
  updateCurrency(accessToken: string, id: string, input: UpdateCurrencyInput): Promise<Currency | null>;
  archiveCurrency(accessToken: string, id: string): Promise<Currency | null>;
  /** Unsets `is_base_currency` on every currency for the tenant (used before setting a new one, so the partial-unique-index constraint never sees two true at once). */
  clearBaseCurrency(accessToken: string): Promise<void>;

  listCostCodes(accessToken: string): Promise<CostCode[]>;
  createCostCode(accessToken: string, input: CreateCostCodeInput): Promise<CostCode>;
  updateCostCode(accessToken: string, id: string, input: UpdateCostCodeInput): Promise<CostCode | null>;
  archiveCostCode(accessToken: string, id: string): Promise<CostCode | null>;
  countEstimateLinesReferencingCostCode(accessToken: string, costCodeId: string): Promise<number>;

  listDocumentTypes(accessToken: string): Promise<DocumentType[]>;
  createDocumentType(accessToken: string, input: CreateDocumentTypeInput): Promise<DocumentType>;
  updateDocumentType(accessToken: string, id: string, input: UpdateDocumentTypeInput): Promise<DocumentType | null>;
  archiveDocumentType(accessToken: string, id: string): Promise<DocumentType | null>;
  countDocumentsReferencingDocumentType(accessToken: string, documentTypeId: string): Promise<number>;

  listNumberingSchemes(accessToken: string): Promise<NumberingScheme[]>;
  createNumberingScheme(accessToken: string, input: CreateNumberingSchemeInput): Promise<NumberingScheme>;
  updateNumberingScheme(
    accessToken: string,
    id: string,
    input: UpdateNumberingSchemeInput,
  ): Promise<NumberingScheme | null>;
  getNumberingScheme(accessToken: string, id: string): Promise<NumberingScheme | null>;
  /** Atomically consumes the next sequence value and returns the updated row. */
  consumeNextSequence(accessToken: string, id: string): Promise<NumberingScheme | null>;
}

export function formatNumberingSchemeValue(scheme: NumberingScheme, sequence: number): string {
  return `${scheme.prefix}${String(sequence).padStart(scheme.padding, "0")}${scheme.suffix}`;
}

export function createSupabaseMasterDataRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): MasterDataRepository {
  return {
    async listUom(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("uom").select("*");
      if (error) throw new Error(`listUom: ${error.message}`);
      return (data as Uom[]) ?? [];
    },

    async createUom(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("uom").insert(input).select("*").single();
      if (error || !data) throw new Error(`createUom: ${error?.message ?? "no row returned"}`);
      return data as Uom;
    },

    async updateUom(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("uom").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updateUom: ${error.message}`);
      return (data as Uom | null) ?? null;
    },

    async archiveUom(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("uom")
        .update({ is_active: false })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`archiveUom: ${error.message}`);
      return (data as Uom | null) ?? null;
    },

    async listCurrencies(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("currencies").select("*");
      if (error) throw new Error(`listCurrencies: ${error.message}`);
      return (data as Currency[]) ?? [];
    },

    async createCurrency(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("currencies").insert(input).select("*").single();
      if (error || !data) throw new Error(`createCurrency: ${error?.message ?? "no row returned"}`);
      return data as Currency;
    },

    async updateCurrency(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("currencies").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updateCurrency: ${error.message}`);
      return (data as Currency | null) ?? null;
    },

    async archiveCurrency(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("currencies")
        .update({ is_active: false })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`archiveCurrency: ${error.message}`);
      return (data as Currency | null) ?? null;
    },

    async clearBaseCurrency(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client.from("currencies").update({ is_base_currency: false }).eq(
        "is_base_currency",
        true,
      );
      if (error) throw new Error(`clearBaseCurrency: ${error.message}`);
    },

    async listCostCodes(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("cost_codes").select("*");
      if (error) throw new Error(`listCostCodes: ${error.message}`);
      return (data as CostCode[]) ?? [];
    },

    async createCostCode(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("cost_codes").insert(input).select("*").single();
      if (error || !data) throw new Error(`createCostCode: ${error?.message ?? "no row returned"}`);
      return data as CostCode;
    },

    async updateCostCode(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("cost_codes").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updateCostCode: ${error.message}`);
      return (data as CostCode | null) ?? null;
    },

    async archiveCostCode(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("cost_codes")
        .update({ is_active: false })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`archiveCostCode: ${error.message}`);
      return (data as CostCode | null) ?? null;
    },

    async countEstimateLinesReferencingCostCode(accessToken, costCodeId) {
      const client = userScopedClientFactory(accessToken);
      const { count, error } = await client
        .from("estimate_lines")
        .select("*", { count: "exact", head: true })
        .eq("cost_code_id", costCodeId);
      if (error) throw new Error(`countEstimateLinesReferencingCostCode: ${error.message}`);
      return count ?? 0;
    },

    async listDocumentTypes(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("document_types").select("*");
      if (error) throw new Error(`listDocumentTypes: ${error.message}`);
      return (data as DocumentType[]) ?? [];
    },

    async createDocumentType(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("document_types").insert(input).select("*").single();
      if (error || !data) throw new Error(`createDocumentType: ${error?.message ?? "no row returned"}`);
      return data as DocumentType;
    },

    async updateDocumentType(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("document_types")
        .update(input)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateDocumentType: ${error.message}`);
      return (data as DocumentType | null) ?? null;
    },

    async archiveDocumentType(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("document_types")
        .update({ is_active: false })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`archiveDocumentType: ${error.message}`);
      return (data as DocumentType | null) ?? null;
    },

    async countDocumentsReferencingDocumentType(accessToken, documentTypeId) {
      const client = userScopedClientFactory(accessToken);
      const { count, error } = await client
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("document_type_id", documentTypeId);
      if (error) throw new Error(`countDocumentsReferencingDocumentType: ${error.message}`);
      return count ?? 0;
    },

    async listNumberingSchemes(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("numbering_schemes").select("*");
      if (error) throw new Error(`listNumberingSchemes: ${error.message}`);
      return (data as NumberingScheme[]) ?? [];
    },

    async createNumberingScheme(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("numbering_schemes").insert(input).select("*").single();
      if (error || !data) throw new Error(`createNumberingScheme: ${error?.message ?? "no row returned"}`);
      return data as NumberingScheme;
    },

    async updateNumberingScheme(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("numbering_schemes")
        .update(input)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateNumberingScheme: ${error.message}`);
      return (data as NumberingScheme | null) ?? null;
    },

    async getNumberingScheme(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("numbering_schemes").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getNumberingScheme: ${error.message}`);
      return (data as NumberingScheme | null) ?? null;
    },

    async consumeNextSequence(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      // Optimistic-concurrency retry (this codebase has no Postgres
      // function/stored-procedure convention to reach for): re-read the
      // current value and conditionally update it, retrying on a
      // concurrent-write miss rather than losing the increment.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data: current, error: readError } = await client
          .from("numbering_schemes")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (readError) throw new Error(`consumeNextSequence: ${readError.message}`);
        if (!current) return null;
        const row = current as NumberingScheme;
        const { data: updated, error: updateError } = await client
          .from("numbering_schemes")
          .update({ next_sequence: row.next_sequence + 1 })
          .eq("id", id)
          .eq("next_sequence", row.next_sequence)
          .select("*")
          .maybeSingle();
        if (updateError) throw new Error(`consumeNextSequence: ${updateError.message}`);
        if (updated) return updated as NumberingScheme;
      }
      throw new Error("consumeNextSequence: too many concurrent updates, give up");
    },
  };
}
