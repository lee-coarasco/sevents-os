import type {
  LegalRepository,
  LicencePermit,
  LegalMatter,
  ExternalCounsel,
  ComplianceObligation,
  CreateLicenceInput,
  RenewLicenceInput,
  CreateLegalMatterInput,
  CreateExternalCounselInput,
  CreateComplianceObligationInput,
  FileObligationInput,
  LicenceStatus,
  MatterStatus,
} from '../modules/legal/types.js';

export class FakeLegalRepository implements LegalRepository {
  private sessions = new Map<string, { userId: string; tenantId: string }>();

  public licences: LicencePermit[] = [];
  public matters: LegalMatter[] = [];
  public counsel: ExternalCounsel[] = [];
  public obligations: ComplianceObligation[] = [];

  addSession(token: string, userId: string, tenantId: string) {
    this.sessions.set(token, { userId, tenantId });
  }

  private resolveTenant(token: string): string {
    const s = this.sessions.get(token);
    if (!s) throw new Error('Unauthorized token');
    return s.tenantId;
  }

  // 1. Licences & Permits
  async listLicences(accessToken: string, projectId?: string): Promise<LicencePermit[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.licences.filter(
      (l) => l.tenant_id === tenantId && (!projectId || l.project_id === projectId)
    );
  }

  async createLicence(accessToken: string, input: CreateLicenceInput & { status: LicenceStatus }): Promise<LicencePermit> {
    const tenantId = this.resolveTenant(accessToken);
    const record: LicencePermit = {
      id: `lic-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id || null,
      licence_name: input.licence_name,
      licence_number: input.licence_number,
      category: input.category,
      issuing_authority: input.issuing_authority,
      issue_date: input.issue_date,
      expiry_date: input.expiry_date,
      renewal_lead_days: input.renewal_lead_days ?? 30,
      status: input.status,
      responsible_officer: input.responsible_officer,
      renewal_cost: input.renewal_cost ?? 0,
      document_url: input.document_url || null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.licences.push(record);
    return record;
  }

  async renewLicence(accessToken: string, id: string, input: RenewLicenceInput): Promise<LicencePermit | null> {
    const tenantId = this.resolveTenant(accessToken);
    const item = this.licences.find((l) => l.tenant_id === tenantId && l.id === id);
    if (!item) return null;
    item.expiry_date = input.new_expiry_date;
    item.status = 'active';
    if (input.renewal_cost !== undefined) item.renewal_cost = input.renewal_cost;
    if (input.notes) item.notes = input.notes;
    item.updated_at = new Date().toISOString();
    return item;
  }

  // 2. Legal Matters
  async listMatters(accessToken: string, canViewPrivileged: boolean, projectId?: string): Promise<LegalMatter[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.matters.filter(
      (m) =>
        m.tenant_id === tenantId &&
        (!projectId || m.project_id === projectId) &&
        (canViewPrivileged || m.access_class !== 'privileged_confidential')
    );
  }

  async createMatter(accessToken: string, input: CreateLegalMatterInput): Promise<LegalMatter> {
    const tenantId = this.resolveTenant(accessToken);
    const record: LegalMatter = {
      id: `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id || null,
      matter_reference: input.matter_reference,
      title: input.title,
      matter_type: input.matter_type,
      court_or_tribunal: input.court_or_tribunal,
      claim_amount: input.claim_amount ?? 0,
      currency: input.currency || 'AED',
      opposing_party: input.opposing_party,
      risk_level: input.risk_level || 'medium',
      access_class: input.access_class || 'internal',
      internal_counsel: input.internal_counsel,
      status: input.status || 'open',
      summary: input.summary,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.matters.push(record);
    return record;
  }

  async updateMatterStatus(accessToken: string, id: string, status: MatterStatus): Promise<LegalMatter | null> {
    const tenantId = this.resolveTenant(accessToken);
    const item = this.matters.find((m) => m.tenant_id === tenantId && m.id === id);
    if (!item) return null;
    item.status = status;
    item.updated_at = new Date().toISOString();
    return item;
  }

  // 3. External Counsel
  async listCounsel(accessToken: string): Promise<ExternalCounsel[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.counsel.filter((c) => c.tenant_id === tenantId);
  }

  async createCounsel(accessToken: string, input: CreateExternalCounselInput): Promise<ExternalCounsel> {
    const tenantId = this.resolveTenant(accessToken);
    const record: ExternalCounsel = {
      id: `csl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      firm_name: input.firm_name,
      lead_attorney: input.lead_attorney,
      email: input.email || null,
      phone: input.phone || null,
      specialization: input.specialization,
      fee_arrangement: input.fee_arrangement,
      budget_amount: input.budget_amount ?? 0,
      billed_amount: input.billed_amount ?? 0,
      currency: input.currency || 'AED',
      status: 'active',
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.counsel.push(record);
    return record;
  }

  async updateCounselBilling(accessToken: string, id: string, billedAmount: number): Promise<ExternalCounsel | null> {
    const tenantId = this.resolveTenant(accessToken);
    const item = this.counsel.find((c) => c.tenant_id === tenantId && c.id === id);
    if (!item) return null;
    item.billed_amount = billedAmount;
    item.updated_at = new Date().toISOString();
    return item;
  }

  // 4. Compliance Obligations
  async listObligations(accessToken: string): Promise<ComplianceObligation[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.obligations.filter((o) => o.tenant_id === tenantId);
  }

  async createObligation(accessToken: string, input: CreateComplianceObligationInput): Promise<ComplianceObligation> {
    const tenantId = this.resolveTenant(accessToken);
    const record: ComplianceObligation = {
      id: `obg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      obligation_name: input.obligation_name,
      regulatory_body: input.regulatory_body,
      frequency: input.frequency,
      deadline_date: input.deadline_date,
      compliance_owner: input.compliance_owner,
      status: 'pending',
      evidence_reference: input.evidence_reference || null,
      filing_date: null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.obligations.push(record);
    return record;
  }

  async fileObligation(accessToken: string, id: string, input: FileObligationInput): Promise<ComplianceObligation | null> {
    const tenantId = this.resolveTenant(accessToken);
    const item = this.obligations.find((o) => o.tenant_id === tenantId && o.id === id);
    if (!item) return null;
    item.evidence_reference = input.evidence_reference;
    item.filing_date = input.filing_date || new Date().toISOString().split('T')[0];
    item.status = 'filed';
    if (input.notes) item.notes = input.notes;
    item.updated_at = new Date().toISOString();
    return item;
  }
}
