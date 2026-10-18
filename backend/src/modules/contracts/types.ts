export type ContractType =
  | 'main_contract'
  | 'subcontract'
  | 'consultancy'
  | 'joint_venture';

export type ContractStatus =
  | 'draft'
  | 'executed'
  | 'active'
  | 'suspended'
  | 'terminated'
  | 'closed';

export interface Contract {
  id: string;
  tenant_id: string;
  project_id: string;
  contract_reference: string;
  title: string;
  contract_type: ContractType;
  counterparty_name: string;
  original_value: number;
  revised_value: number;
  signed_date?: string | null;
  commencement_date: string;
  contractual_completion_date: string;
  revised_completion_date: string;
  governing_law: string;
  status: ContractStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type VariationReason =
  | 'client_request'
  | 'site_instruction'
  | 'design_change'
  | 'unforeseen_conditions'
  | 'value_engineering';

export type VariationStatus =
  | 'identified'
  | 'pricing'
  | 'submitted'
  | 'approved'
  | 'rejected';

export interface VariationOrder {
  id: string;
  tenant_id: string;
  contract_id: string;
  project_id: string;
  vo_number: string;
  title: string;
  description: string;
  reason: VariationReason;
  proposed_cost_amount: number;
  proposed_time_days: number;
  approved_cost_amount: number;
  approved_time_days: number;
  status: VariationStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type ClaimEventType =
  | 'employer_delay'
  | 'late_access'
  | 'design_revision'
  | 'adverse_weather'
  | 'force_majeure'
  | 'suspension';

export type ClaimStatus =
  | 'notice_issued'
  | 'particulars_submitted'
  | 'under_assessment'
  | 'approved'
  | 'partially_approved'
  | 'rejected'
  | 'disputed';

export interface ContractClaim {
  id: string;
  tenant_id: string;
  contract_id: string;
  project_id: string;
  claim_number: string;
  title: string;
  event_type: ClaimEventType;
  event_date: string;
  notice_date: string;
  notice_deadline_date: string;
  particulars_submitted_date?: string | null;
  claimed_days: number;
  claimed_cost_amount: number;
  certified_days: number;
  certified_cost_amount: number;
  status: ClaimStatus;
  assessment_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type SecurityType =
  | 'performance_bond'
  | 'advance_payment_guarantee'
  | 'retention_bond'
  | 'car_insurance'
  | 'third_party_liability'
  | 'workmen_compensation';

export type SecurityStatus = 'active' | 'expired' | 'called' | 'released';

export interface ContractSecurity {
  id: string;
  tenant_id: string;
  contract_id: string;
  project_id: string;
  security_type: SecurityType;
  reference_number: string;
  issuing_institution: string;
  beneficiary: string;
  amount: number;
  currency: string;
  effective_date: string;
  expiry_date: string;
  status: SecurityStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContractInput {
  project_id: string;
  contract_reference: string;
  title: string;
  contract_type?: ContractType;
  counterparty_name: string;
  original_value: number;
  signed_date?: string;
  commencement_date: string;
  contractual_completion_date: string;
  governing_law?: string;
  notes?: string;
}

export interface CreateVariationInput {
  contract_id: string;
  project_id: string;
  vo_number: string;
  title: string;
  description: string;
  reason?: VariationReason;
  proposed_cost_amount?: number;
  proposed_time_days?: number;
  notes?: string;
}

export interface ApproveVariationInput {
  approved_cost_amount: number;
  approved_time_days: number;
  approved_by: string;
}

export interface CreateClaimInput {
  contract_id: string;
  project_id: string;
  claim_number: string;
  title: string;
  event_type?: ClaimEventType;
  event_date: string;
  notice_date: string;
  claimed_days?: number;
  claimed_cost_amount?: number;
  particulars_submitted_date?: string;
  assessment_notes?: string;
}

export interface AssessClaimInput {
  certified_days: number;
  certified_cost_amount: number;
  status: ClaimStatus;
  assessment_notes?: string;
}

export interface CreateSecurityInput {
  contract_id: string;
  project_id: string;
  security_type: SecurityType;
  reference_number: string;
  issuing_institution: string;
  beneficiary: string;
  amount: number;
  currency?: string;
  effective_date: string;
  expiry_date: string;
  notes?: string;
}

export interface ContractsRepository {
  // Contracts
  listContracts(accessToken: string, projectId?: string): Promise<Contract[]>;
  getContractById(accessToken: string, id: string): Promise<Contract | null>;
  createContract(accessToken: string, input: CreateContractInput & {
    revised_value: number;
    revised_completion_date: string;
  }): Promise<Contract>;
  updateContract(accessToken: string, id: string, updates: Partial<Contract>): Promise<Contract | null>;

  // Variations
  listVariations(accessToken: string, projectId?: string, contractId?: string): Promise<VariationOrder[]>;
  getVariationById(accessToken: string, id: string): Promise<VariationOrder | null>;
  createVariation(accessToken: string, input: CreateVariationInput): Promise<VariationOrder>;
  updateVariation(accessToken: string, id: string, updates: Partial<VariationOrder>): Promise<VariationOrder | null>;

  // Claims
  listClaims(accessToken: string, projectId?: string, contractId?: string): Promise<ContractClaim[]>;
  getClaimById(accessToken: string, id: string): Promise<ContractClaim | null>;
  createClaim(accessToken: string, input: CreateClaimInput & { notice_deadline_date: string }): Promise<ContractClaim>;
  updateClaim(accessToken: string, id: string, updates: Partial<ContractClaim>): Promise<ContractClaim | null>;

  // Securities
  listSecurities(accessToken: string, projectId?: string, contractId?: string): Promise<ContractSecurity[]>;
  getSecurityById(accessToken: string, id: string): Promise<ContractSecurity | null>;
  createSecurity(accessToken: string, input: CreateSecurityInput): Promise<ContractSecurity>;
  updateSecurity(accessToken: string, id: string, updates: Partial<ContractSecurity>): Promise<ContractSecurity | null>;
}
