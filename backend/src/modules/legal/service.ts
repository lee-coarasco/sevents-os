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
} from './types.js';

export class LegalService {
  constructor(private repo: LegalRepository) {}

  // 1. Licences & Permits
  async listLicences(accessToken: string, projectId?: string): Promise<LicencePermit[]> {
    return this.repo.listLicences(accessToken, projectId);
  }

  async createLicence(accessToken: string, input: CreateLicenceInput): Promise<LicencePermit> {
    if (!input.licence_name || !input.licence_number || !input.issuing_authority || !input.expiry_date) {
      throw new Error('Licence name, number, authority, and expiry date are required');
    }

    const leadDays = input.renewal_lead_days ?? 30;
    const expiry = new Date(input.expiry_date);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let status: LicenceStatus = 'active';
    if (daysUntilExpiry < 0) {
      status = 'expired';
    } else if (daysUntilExpiry <= leadDays) {
      status = 'expiring_soon';
    }

    return this.repo.createLicence(accessToken, {
      ...input,
      renewal_lead_days: leadDays,
      status,
    });
  }

  async renewLicence(accessToken: string, id: string, input: RenewLicenceInput): Promise<LicencePermit> {
    if (!input.new_expiry_date) {
      throw new Error('New expiry date is required for licence renewal');
    }

    const updated = await this.repo.renewLicence(accessToken, id, input);
    if (!updated) {
      throw new Error('Licence not found or unauthorized');
    }
    return updated;
  }

  // 2. Legal Matters
  async listMatters(accessToken: string, canViewPrivileged: boolean, projectId?: string): Promise<LegalMatter[]> {
    return this.repo.listMatters(accessToken, canViewPrivileged, projectId);
  }

  async createMatter(accessToken: string, input: CreateLegalMatterInput): Promise<LegalMatter> {
    if (!input.title || !input.matter_reference || !input.opposing_party || !input.internal_counsel) {
      throw new Error('Matter reference, title, opposing party, and internal counsel are required');
    }
    return this.repo.createMatter(accessToken, input);
  }

  async updateMatterStatus(accessToken: string, id: string, status: MatterStatus): Promise<LegalMatter> {
    const updated = await this.repo.updateMatterStatus(accessToken, id, status);
    if (!updated) {
      throw new Error('Legal matter not found or unauthorized');
    }
    return updated;
  }

  // 3. External Counsel
  async listCounsel(accessToken: string): Promise<ExternalCounsel[]> {
    return this.repo.listCounsel(accessToken);
  }

  async createCounsel(accessToken: string, input: CreateExternalCounselInput): Promise<ExternalCounsel> {
    if (!input.firm_name || !input.lead_attorney || !input.specialization) {
      throw new Error('Firm name, lead attorney, and specialization are required');
    }
    return this.repo.createCounsel(accessToken, input);
  }

  async updateCounselBilling(accessToken: string, id: string, billedAmount: number): Promise<ExternalCounsel> {
    if (billedAmount < 0) {
      throw new Error('Billed amount cannot be negative');
    }
    const updated = await this.repo.updateCounselBilling(accessToken, id, billedAmount);
    if (!updated) {
      throw new Error('External counsel record not found or unauthorized');
    }
    return updated;
  }

  // 4. Compliance Obligations
  async listObligations(accessToken: string): Promise<ComplianceObligation[]> {
    return this.repo.listObligations(accessToken);
  }

  async createObligation(accessToken: string, input: CreateComplianceObligationInput): Promise<ComplianceObligation> {
    if (!input.obligation_name || !input.regulatory_body || !input.deadline_date || !input.compliance_owner) {
      throw new Error('Obligation name, regulatory body, deadline, and owner are required');
    }
    return this.repo.createObligation(accessToken, input);
  }

  async fileObligation(accessToken: string, id: string, input: FileObligationInput): Promise<ComplianceObligation> {
    if (!input.evidence_reference || input.evidence_reference.trim().length === 0) {
      throw new Error('Filing evidence reference or document number is required');
    }
    const updated = await this.repo.fileObligation(accessToken, id, input);
    if (!updated) {
      throw new Error('Compliance obligation not found or unauthorized');
    }
    return updated;
  }
}
