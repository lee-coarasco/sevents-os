export type LicenceCategory =
  | 'trade_licence'
  | 'civil_defense'
  | 'municipality_permit'
  | 'environmental'
  | 'road_transport'
  | 'customs'
  | 'other';

export type LicenceStatus = 'active' | 'expiring_soon' | 'expired' | 'under_renewal' | 'suspended';

export interface LicencePermit {
  id: string;
  tenant_id: string;
  project_id?: string | null;
  licence_name: string;
  licence_number: string;
  category: LicenceCategory;
  issuing_authority: string;
  issue_date: string;
  expiry_date: string;
  renewal_lead_days: number;
  status: LicenceStatus;
  responsible_officer: string;
  renewal_cost: number;
  document_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type MatterType =
  | 'arbitration'
  | 'litigation'
  | 'adjudication'
  | 'mediation'
  | 'labor_claim'
  | 'regulatory_investigation';

export type MatterRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AccessClass = 'public' | 'internal' | 'privileged_confidential';
export type MatterStatus = 'open' | 'pleadings' | 'hearing' | 'settled' | 'judgment_awarded' | 'closed';

export interface LegalMatter {
  id: string;
  tenant_id: string;
  project_id?: string | null;
  matter_reference: string;
  title: string;
  matter_type: MatterType;
  court_or_tribunal: string;
  claim_amount: number;
  currency: string;
  opposing_party: string;
  risk_level: MatterRiskLevel;
  access_class: AccessClass;
  internal_counsel: string;
  status: MatterStatus;
  summary: string;
  created_at: string;
  updated_at: string;
}

export type FeeArrangement = 'hourly' | 'fixed_fee' | 'capped' | 'contingency';
export type CounselStatus = 'active' | 'concluded' | 'terminated';

export interface ExternalCounsel {
  id: string;
  tenant_id: string;
  firm_name: string;
  lead_attorney: string;
  email?: string | null;
  phone?: string | null;
  specialization: string;
  fee_arrangement: FeeArrangement;
  budget_amount: number;
  billed_amount: number;
  currency: string;
  status: CounselStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type ObligationFrequency = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'ad_hoc';
export type ObligationStatus = 'pending' | 'filed' | 'exempt' | 'overdue';

export interface ComplianceObligation {
  id: string;
  tenant_id: string;
  obligation_name: string;
  regulatory_body: string;
  frequency: ObligationFrequency;
  deadline_date: string;
  compliance_owner: string;
  status: ObligationStatus;
  evidence_reference?: string | null;
  filing_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLicenceInput {
  project_id?: string | null;
  licence_name: string;
  licence_number: string;
  category: LicenceCategory;
  issuing_authority: string;
  issue_date: string;
  expiry_date: string;
  renewal_lead_days?: number;
  responsible_officer: string;
  renewal_cost?: number;
  document_url?: string | null;
  notes?: string | null;
}

export interface RenewLicenceInput {
  new_expiry_date: string;
  renewal_cost?: number;
  notes?: string;
}

export interface CreateLegalMatterInput {
  project_id?: string | null;
  matter_reference: string;
  title: string;
  matter_type: MatterType;
  court_or_tribunal: string;
  claim_amount?: number;
  currency?: string;
  opposing_party: string;
  risk_level?: MatterRiskLevel;
  access_class?: AccessClass;
  internal_counsel: string;
  summary: string;
  status?: MatterStatus;
}

export interface CreateExternalCounselInput {
  firm_name: string;
  lead_attorney: string;
  email?: string | null;
  phone?: string | null;
  specialization: string;
  fee_arrangement: FeeArrangement;
  budget_amount?: number;
  billed_amount?: number;
  currency?: string;
  notes?: string | null;
}

export interface CreateComplianceObligationInput {
  obligation_name: string;
  regulatory_body: string;
  frequency: ObligationFrequency;
  deadline_date: string;
  compliance_owner: string;
  evidence_reference?: string | null;
  notes?: string | null;
}

export interface FileObligationInput {
  evidence_reference: string;
  filing_date?: string;
  notes?: string;
}

export interface LegalRepository {
  // Licences & Permits
  listLicences(accessToken: string, projectId?: string): Promise<LicencePermit[]>;
  createLicence(accessToken: string, input: CreateLicenceInput & { status: LicenceStatus }): Promise<LicencePermit>;
  renewLicence(accessToken: string, id: string, input: RenewLicenceInput): Promise<LicencePermit | null>;

  // Legal Matters
  listMatters(accessToken: string, canViewPrivileged: boolean, projectId?: string): Promise<LegalMatter[]>;
  createMatter(accessToken: string, input: CreateLegalMatterInput): Promise<LegalMatter>;
  updateMatterStatus(accessToken: string, id: string, status: MatterStatus): Promise<LegalMatter | null>;

  // External Counsel
  listCounsel(accessToken: string): Promise<ExternalCounsel[]>;
  createCounsel(accessToken: string, input: CreateExternalCounselInput): Promise<ExternalCounsel>;
  updateCounselBilling(accessToken: string, id: string, billedAmount: number): Promise<ExternalCounsel | null>;

  // Compliance Obligations
  listObligations(accessToken: string): Promise<ComplianceObligation[]>;
  createObligation(accessToken: string, input: CreateComplianceObligationInput): Promise<ComplianceObligation>;
  fileObligation(accessToken: string, id: string, input: FileObligationInput): Promise<ComplianceObligation | null>;
}
