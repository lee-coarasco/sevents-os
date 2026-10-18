export type SkillLevel = 'entry' | 'intermediate' | 'senior' | 'master';
export type ManpowerStatus = 'draft' | 'submitted' | 'approved' | 'fulfilled' | 'cancelled';

export interface ManpowerRequest {
  id: string;
  tenant_id: string;
  project_id: string;
  request_number: string;
  role_title: string;
  quantity_required: number;
  skill_level: SkillLevel;
  required_date: string;
  status: ManpowerStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type CandidateStage = 'applied' | 'screening' | 'interview' | 'offered' | 'hired' | 'rejected';

export interface RecruitmentCandidate {
  id: string;
  tenant_id: string;
  manpower_request_id?: string | null;
  candidate_name: string;
  email: string;
  phone?: string | null;
  position_applied: string;
  current_company?: string | null;
  years_experience: number;
  stage: CandidateStage;
  rating: number;
  resume_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type TradeType =
  | 'civil_mason'
  | 'steel_fixer'
  | 'electrician'
  | 'plumber'
  | 'hvac_technician'
  | 'safety_marshall'
  | 'scaffolder'
  | 'crane_operator';

export type CompetencyStatus = 'valid' | 'expiring_soon' | 'expired';

export interface SiteCompetency {
  id: string;
  tenant_id: string;
  employee_name: string;
  trade: TradeType;
  certification_name: string;
  certifying_body: string;
  issue_date: string;
  expiry_date: string;
  status: CompetencyStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type AppraisalStatus = 'draft' | 'submitted' | 'completed';

export interface PerformanceAppraisal {
  id: string;
  tenant_id: string;
  employee_name: string;
  review_period: string;
  appraiser_name: string;
  score: number;
  strengths?: string | null;
  growth_areas?: string | null;
  goals?: string | null;
  status: AppraisalStatus;
  created_at: string;
  updated_at: string;
}

// DTOs
export interface CreateManpowerRequestInput {
  project_id: string;
  request_number: string;
  role_title: string;
  quantity_required: number;
  skill_level?: SkillLevel;
  required_date: string;
  notes?: string;
}

export interface ApproveManpowerRequestInput {
  approved_by: string;
}

export interface CreateCandidateInput {
  manpower_request_id?: string;
  candidate_name: string;
  email: string;
  phone?: string;
  position_applied: string;
  current_company?: string;
  years_experience?: number;
  stage?: CandidateStage;
  rating?: number;
  resume_url?: string;
  notes?: string;
}

export interface UpdateCandidateStageInput {
  stage: CandidateStage;
  rating?: number;
  notes?: string;
}

export interface CreateCompetencyInput {
  employee_name: string;
  trade?: TradeType;
  certification_name: string;
  certifying_body: string;
  issue_date: string;
  expiry_date: string;
  notes?: string;
}

export interface CreateAppraisalInput {
  employee_name: string;
  review_period: string;
  appraiser_name: string;
  score?: number;
  strengths?: string;
  growth_areas?: string;
  goals?: string;
  status?: AppraisalStatus;
}

export interface PeopleRepository {
  // Manpower Requests
  listManpowerRequests(accessToken: string, projectId?: string): Promise<ManpowerRequest[]>;
  getManpowerRequestById(accessToken: string, id: string): Promise<ManpowerRequest | null>;
  createManpowerRequest(accessToken: string, input: CreateManpowerRequestInput): Promise<ManpowerRequest>;
  updateManpowerRequest(accessToken: string, id: string, updates: Partial<ManpowerRequest>): Promise<ManpowerRequest | null>;

  // Candidates
  listCandidates(accessToken: string, requestId?: string): Promise<RecruitmentCandidate[]>;
  getCandidateById(accessToken: string, id: string): Promise<RecruitmentCandidate | null>;
  createCandidate(accessToken: string, input: CreateCandidateInput): Promise<RecruitmentCandidate>;
  updateCandidate(accessToken: string, id: string, updates: Partial<RecruitmentCandidate>): Promise<RecruitmentCandidate | null>;

  // Competencies
  listCompetencies(accessToken: string): Promise<SiteCompetency[]>;
  getCompetencyById(accessToken: string, id: string): Promise<SiteCompetency | null>;
  createCompetency(accessToken: string, input: CreateCompetencyInput & { status: CompetencyStatus }): Promise<SiteCompetency>;
  updateCompetency(accessToken: string, id: string, updates: Partial<SiteCompetency>): Promise<SiteCompetency | null>;

  // Appraisals
  listAppraisals(accessToken: string): Promise<PerformanceAppraisal[]>;
  getAppraisalById(accessToken: string, id: string): Promise<PerformanceAppraisal | null>;
  createAppraisal(accessToken: string, input: CreateAppraisalInput): Promise<PerformanceAppraisal>;
  updateAppraisal(accessToken: string, id: string, updates: Partial<PerformanceAppraisal>): Promise<PerformanceAppraisal | null>;
}
