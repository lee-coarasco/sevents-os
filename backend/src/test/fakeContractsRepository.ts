import type {
  ContractsRepository,
  Contract,
  VariationOrder,
  ContractClaim,
  ContractSecurity,
  CreateContractInput,
  CreateVariationInput,
  CreateClaimInput,
  CreateSecurityInput,
} from "../modules/contracts/types.js";

export class FakeContractsRepository implements ContractsRepository {
  private sessions = new Map<string, { userId: string; tenantId: string }>();

  public contracts: Contract[] = [];
  public variations: VariationOrder[] = [];
  public claims: ContractClaim[] = [];
  public securities: ContractSecurity[] = [];

  addSession(token: string, userId: string, tenantId: string) {
    this.sessions.set(token, { userId, tenantId });
  }

  private tenantOf(token: string): string {
    const s = this.sessions.get(token);
    if (!s) throw new Error("Invalid session token in FakeContractsRepository");
    return s.tenantId;
  }

  // Contracts
  async listContracts(accessToken: string, projectId?: string): Promise<Contract[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.contracts.filter((c) => c.tenant_id === tenantId && (!projectId || c.project_id === projectId));
  }

  async getContractById(accessToken: string, id: string): Promise<Contract | null> {
    const tenantId = this.tenantOf(accessToken);
    return this.contracts.find((c) => c.tenant_id === tenantId && c.id === id) || null;
  }

  async createContract(
    accessToken: string,
    input: CreateContractInput & {
      revised_value: number;
      revised_completion_date: string;
    }
  ): Promise<Contract> {
    const tenantId = this.tenantOf(accessToken);
    const item: Contract = {
      id: `cont-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id,
      contract_reference: input.contract_reference,
      title: input.title,
      contract_type: input.contract_type || "main_contract",
      counterparty_name: input.counterparty_name,
      original_value: input.original_value,
      revised_value: input.revised_value,
      signed_date: input.signed_date || null,
      commencement_date: input.commencement_date,
      contractual_completion_date: input.contractual_completion_date,
      revised_completion_date: input.revised_completion_date,
      governing_law: input.governing_law || "UAE Law / FIDIC 1999 Red Book",
      status: "active",
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.contracts.push(item);
    return item;
  }

  async updateContract(accessToken: string, id: string, updates: Partial<Contract>): Promise<Contract | null> {
    const tenantId = this.tenantOf(accessToken);
    const idx = this.contracts.findIndex((c) => c.tenant_id === tenantId && c.id === id);
    if (idx === -1) return null;
    const existing = this.contracts[idx]!;
    const updated: Contract = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.contracts[idx] = updated;
    return updated;
  }

  // Variations
  async listVariations(accessToken: string, projectId?: string, contractId?: string): Promise<VariationOrder[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.variations.filter(
      (v) =>
        v.tenant_id === tenantId &&
        (!projectId || v.project_id === projectId) &&
        (!contractId || v.contract_id === contractId)
    );
  }

  async getVariationById(accessToken: string, id: string): Promise<VariationOrder | null> {
    const tenantId = this.tenantOf(accessToken);
    return this.variations.find((v) => v.tenant_id === tenantId && v.id === id) || null;
  }

  async createVariation(accessToken: string, input: CreateVariationInput): Promise<VariationOrder> {
    const tenantId = this.tenantOf(accessToken);
    const item: VariationOrder = {
      id: `vo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      contract_id: input.contract_id,
      project_id: input.project_id,
      vo_number: input.vo_number,
      title: input.title,
      description: input.description,
      reason: input.reason || "client_request",
      proposed_cost_amount: input.proposed_cost_amount ?? 0,
      proposed_time_days: input.proposed_time_days ?? 0,
      approved_cost_amount: 0,
      approved_time_days: 0,
      status: "identified",
      approved_by: null,
      approved_at: null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.variations.push(item);
    return item;
  }

  async updateVariation(accessToken: string, id: string, updates: Partial<VariationOrder>): Promise<VariationOrder | null> {
    const tenantId = this.tenantOf(accessToken);
    const idx = this.variations.findIndex((v) => v.tenant_id === tenantId && v.id === id);
    if (idx === -1) return null;
    const existing = this.variations[idx]!;
    const updated: VariationOrder = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.variations[idx] = updated;
    return updated;
  }

  // Claims
  async listClaims(accessToken: string, projectId?: string, contractId?: string): Promise<ContractClaim[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.claims.filter(
      (c) =>
        c.tenant_id === tenantId &&
        (!projectId || c.project_id === projectId) &&
        (!contractId || c.contract_id === contractId)
    );
  }

  async getClaimById(accessToken: string, id: string): Promise<ContractClaim | null> {
    const tenantId = this.tenantOf(accessToken);
    return this.claims.find((c) => c.tenant_id === tenantId && c.id === id) || null;
  }

  async createClaim(accessToken: string, input: CreateClaimInput & { notice_deadline_date: string }): Promise<ContractClaim> {
    const tenantId = this.tenantOf(accessToken);
    const item: ContractClaim = {
      id: `clm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      contract_id: input.contract_id,
      project_id: input.project_id,
      claim_number: input.claim_number,
      title: input.title,
      event_type: input.event_type || "employer_delay",
      event_date: input.event_date,
      notice_date: input.notice_date,
      notice_deadline_date: input.notice_deadline_date,
      particulars_submitted_date: input.particulars_submitted_date || null,
      claimed_days: input.claimed_days ?? 0,
      claimed_cost_amount: input.claimed_cost_amount ?? 0,
      certified_days: 0,
      certified_cost_amount: 0,
      status: "notice_issued",
      assessment_notes: input.assessment_notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.claims.push(item);
    return item;
  }

  async updateClaim(accessToken: string, id: string, updates: Partial<ContractClaim>): Promise<ContractClaim | null> {
    const tenantId = this.tenantOf(accessToken);
    const idx = this.claims.findIndex((c) => c.tenant_id === tenantId && c.id === id);
    if (idx === -1) return null;
    const existing = this.claims[idx]!;
    const updated: ContractClaim = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.claims[idx] = updated;
    return updated;
  }

  // Securities
  async listSecurities(accessToken: string, projectId?: string, contractId?: string): Promise<ContractSecurity[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.securities.filter(
      (s) =>
        s.tenant_id === tenantId &&
        (!projectId || s.project_id === projectId) &&
        (!contractId || s.contract_id === contractId)
    );
  }

  async getSecurityById(accessToken: string, id: string): Promise<ContractSecurity | null> {
    const tenantId = this.tenantOf(accessToken);
    return this.securities.find((s) => s.tenant_id === tenantId && s.id === id) || null;
  }

  async createSecurity(accessToken: string, input: CreateSecurityInput): Promise<ContractSecurity> {
    const tenantId = this.tenantOf(accessToken);
    const item: ContractSecurity = {
      id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      contract_id: input.contract_id,
      project_id: input.project_id,
      security_type: input.security_type,
      reference_number: input.reference_number,
      issuing_institution: input.issuing_institution,
      beneficiary: input.beneficiary,
      amount: input.amount,
      currency: input.currency || "AED",
      effective_date: input.effective_date,
      expiry_date: input.expiry_date,
      status: "active",
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.securities.push(item);
    return item;
  }

  async updateSecurity(accessToken: string, id: string, updates: Partial<ContractSecurity>): Promise<ContractSecurity | null> {
    const tenantId = this.tenantOf(accessToken);
    const idx = this.securities.findIndex((s) => s.tenant_id === tenantId && s.id === id);
    if (idx === -1) return null;
    const existing = this.securities[idx]!;
    const updated: ContractSecurity = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.securities[idx] = updated;
    return updated;
  }
}
