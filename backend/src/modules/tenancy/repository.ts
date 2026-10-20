import type { SupabaseClient } from "@supabase/supabase-js";
import type { Branch, Company, FileObjectMeta } from "./types.js";

export interface CreateCompanyInput {
  legal_name: string;
  legal_entity_id?: string | null;
  preferred_language?: string | null;
  reporting_currency?: string | null;
  fiscal_year_start_month?: number | null;
  enabled_modules?: string[];
  statutory_id?: string | null;
  vat_registration_number?: string | null;
}

export interface CreateBranchInput {
  company_id: string;
  name: string;
  operating_region?: string | null;
}

export interface RegisterFileObjectInput {
  company_id: string;
  project_id?: string | null;
  bucket: string;
  storage_path: string;
  content_type?: string | null;
  size_bytes?: number | null;
}

/**
 * Every method is keyed off the caller's own access token, not an
 * explicit tenant id — on the real adapter, Postgres RLS (keyed by
 * `current_tenant_id()`, see the ticket 0055 migration) does the
 * filtering; a cross-tenant read/write simply returns no row. The fake
 * used in tests reproduces that same "wrong tenant = not found" contract
 * so the isolation guarantee is actually exercised, not just asserted.
 */
export interface TenancyRepository {
  createCompany(accessToken: string, input: CreateCompanyInput): Promise<Company>;
  updateCompany(accessToken: string, companyId: string, input: Partial<CreateCompanyInput>): Promise<Company>;
  listCompanies(accessToken: string): Promise<Company[]>;
  getCompany(accessToken: string, companyId: string): Promise<Company | null>;
  createBranch(accessToken: string, input: CreateBranchInput): Promise<Branch>;
  listBranches(accessToken: string, companyId: string): Promise<Branch[]>;
  registerFileObject(accessToken: string, input: RegisterFileObjectInput): Promise<FileObjectMeta>;
}

/**
 * Supabase-backed implementation. Deliberately queries through the
 * user-scoped client (anon key + caller's bearer token) for every
 * operation, never the service-role client — RLS is the actual isolation
 * mechanism, this adapter just has to not bypass it. Not exercised
 * against a live Supabase project in this session (no reachable
 * credentials in this sandbox); see ticket 0055 Progress.
 */
export function createSupabaseTenancyRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): TenancyRepository {
  return {
    async createCompany(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("companies")
        .insert({ enabled_modules: [], ...input })
        .select("*")
        .single();
      if (error || !data) throw new Error(`createCompany: ${error?.message ?? "no row returned"}`);
      return data as Company;
    },

    async updateCompany(accessToken, companyId, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("companies")
        .update(input)
        .eq("id", companyId)
        .select("*")
        .single();
      if (error || !data) throw new Error(`updateCompany: ${error?.message ?? "no row returned"}`);
      return data as Company;
    },

    async listCompanies(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("companies").select("*");
      if (error) throw new Error(`listCompanies: ${error.message}`);
      return (data as Company[]) ?? [];
    },

    async getCompany(accessToken, companyId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw new Error(`getCompany: ${error.message}`);
      return (data as Company | null) ?? null;
    },

    async createBranch(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("branches").insert(input).select("*").single();
      if (error || !data) throw new Error(`createBranch: ${error?.message ?? "no row returned"}`);
      return data as Branch;
    },

    async listBranches(accessToken, companyId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("branches")
        .select("*")
        .eq("company_id", companyId);
      if (error) throw new Error(`listBranches: ${error.message}`);
      return (data as Branch[]) ?? [];
    },

    async registerFileObject(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("file_objects")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(`registerFileObject: ${error?.message ?? "no row returned"}`);
      }
      return data as FileObjectMeta;
    },
  };
}
