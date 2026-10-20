import type {
  CreateBranchInput,
  CreateCompanyInput,
  RegisterFileObjectInput,
  TenancyRepository,
} from "../modules/tenancy/repository.js";
import type { Branch, Company, FileObjectMeta } from "../modules/tenancy/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for the real Postgres-RLS-backed adapter. Every
 * method resolves the caller's tenant from `sessions` first, exactly
 * like the real `current_tenant_id()` policy function resolves it from
 * `app_users.tenant_id` — then filters/forces every row to that tenant.
 * A cross-tenant id lookup returns null, same as RLS silently returning
 * zero rows.
 */
export class FakeTenancyRepository implements TenancyRepository {
  sessions = new Map<string, string>(); // accessToken -> tenant_id
  companies = new Map<string, Company>();
  branches = new Map<string, Branch>();
  fileObjects = new Map<string, FileObjectMeta>();

  addSession(accessToken: string, tenantId: string) {
    this.sessions.set(accessToken, tenantId);
  }

  private tenantOf(accessToken: string): string {
    const tenantId = this.sessions.get(accessToken);
    if (!tenantId) throw new Error("no tenant for this access token");
    return tenantId;
  }

  async createCompany(accessToken: string, input: CreateCompanyInput) {
    const tenant_id = this.tenantOf(accessToken);
    const company: Company = {
      id: nextId("company"),
      tenant_id,
      legal_entity_id: input.legal_entity_id ?? null,
      legal_name: input.legal_name,
      preferred_language: input.preferred_language ?? null,
      reporting_currency: input.reporting_currency ?? null,
      fiscal_year_start_month: input.fiscal_year_start_month ?? null,
      enabled_modules: input.enabled_modules ?? [],
      statutory_id: input.statutory_id ?? null,
      vat_registration_number: input.vat_registration_number ?? null,
    };
    this.companies.set(company.id, company);
    return company;
  }

  async updateCompany(accessToken: string, companyId: string, input: Partial<CreateCompanyInput>) {
    const existing = this.companies.get(companyId);
    if (!existing) throw new Error("company not found");
    const updated = {
      ...existing,
      ...input,
      legal_name: input.legal_name ?? existing.legal_name,
    };
    this.companies.set(companyId, updated);
    return updated;
  }

  async listCompanies(accessToken: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.companies.values()].filter((c) => c.tenant_id === tenant_id);
  }

  async getCompany(accessToken: string, companyId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const company = this.companies.get(companyId);
    if (!company || company.tenant_id !== tenant_id) return null;
    return company;
  }

  async createBranch(accessToken: string, input: CreateBranchInput) {
    const tenant_id = this.tenantOf(accessToken);
    const branch: Branch = {
      id: nextId("branch"),
      tenant_id,
      company_id: input.company_id,
      name: input.name,
      code: input.code ?? null,
      address: input.address ?? null,
      operating_region: input.operating_region ?? null,
    };
    this.branches.set(branch.id, branch);
    return branch;
  }

  async updateBranch(accessToken: string, branchId: string, input: Partial<CreateBranchInput>) {
    const existing = this.branches.get(branchId);
    if (!existing) throw new Error("branch not found");
    const updated: Branch = {
      ...existing,
      ...input,
      name: input.name ?? existing.name,
      code: input.code !== undefined ? input.code : existing.code,
      address: input.address !== undefined ? input.address : existing.address,
      operating_region: input.operating_region !== undefined ? input.operating_region : existing.operating_region,
    };
    this.branches.set(branchId, updated);
    return updated;
  }

  async listBranches(accessToken: string, companyId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.branches.values()].filter(
      (b) => b.tenant_id === tenant_id && b.company_id === companyId,
    );
  }

  async registerFileObject(accessToken: string, input: RegisterFileObjectInput) {
    const tenant_id = this.tenantOf(accessToken);
    const file: FileObjectMeta = {
      id: nextId("file"),
      tenant_id,
      company_id: input.company_id,
      project_id: input.project_id ?? null,
      bucket: input.bucket,
      storage_path: input.storage_path,
      content_type: input.content_type ?? null,
      size_bytes: input.size_bytes ?? null,
    };
    this.fileObjects.set(file.id, file);
    return file;
  }
}
