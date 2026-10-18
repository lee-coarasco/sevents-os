import type {
  PeopleRepository,
  ManpowerRequest,
  RecruitmentCandidate,
  SiteCompetency,
  PerformanceAppraisal,
  CreateManpowerRequestInput,
  CreateCandidateInput,
  CreateCompetencyInput,
  CreateAppraisalInput,
  CompetencyStatus,
} from "../modules/people/types.js";

export class FakePeopleRepository implements PeopleRepository {
  private sessions = new Map<string, { userId: string; tenantId: string }>();

  public manpowerRequests: ManpowerRequest[] = [];
  public candidates: RecruitmentCandidate[] = [];
  public competencies: SiteCompetency[] = [];
  public appraisals: PerformanceAppraisal[] = [];

  addSession(token: string, userId: string, tenantId: string) {
    this.sessions.set(token, { userId, tenantId });
  }

  private resolveTenant(token: string): string {
    const s = this.sessions.get(token);
    if (!s) throw new Error("Unauthorized token");
    return s.tenantId;
  }

  // 1. Manpower Requests
  async listManpowerRequests(accessToken: string, projectId?: string): Promise<ManpowerRequest[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.manpowerRequests.filter(
      (m) => m.tenant_id === tenantId && (!projectId || m.project_id === projectId)
    );
  }

  async getManpowerRequestById(accessToken: string, id: string): Promise<ManpowerRequest | null> {
    const tenantId = this.resolveTenant(accessToken);
    return this.manpowerRequests.find((m) => m.id === id && m.tenant_id === tenantId) || null;
  }

  async createManpowerRequest(accessToken: string, input: CreateManpowerRequestInput): Promise<ManpowerRequest> {
    const tenantId = this.resolveTenant(accessToken);
    const now = new Date().toISOString();
    const req: ManpowerRequest = {
      id: `mpr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id,
      request_number: input.request_number,
      role_title: input.role_title,
      quantity_required: input.quantity_required,
      skill_level: input.skill_level || "intermediate",
      required_date: input.required_date,
      status: "draft",
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    };
    this.manpowerRequests.push(req);
    return req;
  }

  async updateManpowerRequest(
    accessToken: string,
    id: string,
    updates: Partial<ManpowerRequest>
  ): Promise<ManpowerRequest | null> {
    const tenantId = this.resolveTenant(accessToken);
    const idx = this.manpowerRequests.findIndex((m) => m.id === id && m.tenant_id === tenantId);
    if (idx === -1) return null;
    const updated = {
      ...this.manpowerRequests[idx]!,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.manpowerRequests[idx] = updated;
    return updated;
  }

  // 2. Candidates
  async listCandidates(accessToken: string, requestId?: string): Promise<RecruitmentCandidate[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.candidates.filter(
      (c) => c.tenant_id === tenantId && (!requestId || c.manpower_request_id === requestId)
    );
  }

  async getCandidateById(accessToken: string, id: string): Promise<RecruitmentCandidate | null> {
    const tenantId = this.resolveTenant(accessToken);
    return this.candidates.find((c) => c.id === id && c.tenant_id === tenantId) || null;
  }

  async createCandidate(accessToken: string, input: CreateCandidateInput): Promise<RecruitmentCandidate> {
    const tenantId = this.resolveTenant(accessToken);
    const now = new Date().toISOString();
    const cand: RecruitmentCandidate = {
      id: `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      manpower_request_id: input.manpower_request_id || null,
      candidate_name: input.candidate_name,
      email: input.email,
      phone: input.phone || null,
      position_applied: input.position_applied,
      current_company: input.current_company || null,
      years_experience: input.years_experience || 0,
      stage: input.stage || "applied",
      rating: input.rating ?? 3,
      resume_url: input.resume_url || null,
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    };
    this.candidates.push(cand);
    return cand;
  }

  async updateCandidate(
    accessToken: string,
    id: string,
    updates: Partial<RecruitmentCandidate>
  ): Promise<RecruitmentCandidate | null> {
    const tenantId = this.resolveTenant(accessToken);
    const idx = this.candidates.findIndex((c) => c.id === id && c.tenant_id === tenantId);
    if (idx === -1) return null;
    const updated = {
      ...this.candidates[idx]!,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.candidates[idx] = updated;
    return updated;
  }

  // 3. Competencies
  async listCompetencies(accessToken: string): Promise<SiteCompetency[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.competencies.filter((c) => c.tenant_id === tenantId);
  }

  async getCompetencyById(accessToken: string, id: string): Promise<SiteCompetency | null> {
    const tenantId = this.resolveTenant(accessToken);
    return this.competencies.find((c) => c.id === id && c.tenant_id === tenantId) || null;
  }

  async createCompetency(
    accessToken: string,
    input: CreateCompetencyInput & { status: CompetencyStatus }
  ): Promise<SiteCompetency> {
    const tenantId = this.resolveTenant(accessToken);
    const now = new Date().toISOString();
    const comp: SiteCompetency = {
      id: `comp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      employee_name: input.employee_name,
      trade: input.trade || "civil_mason",
      certification_name: input.certification_name,
      certifying_body: input.certifying_body,
      issue_date: input.issue_date,
      expiry_date: input.expiry_date,
      status: input.status,
      notes: input.notes || null,
      created_at: now,
      updated_at: now,
    };
    this.competencies.push(comp);
    return comp;
  }

  async updateCompetency(
    accessToken: string,
    id: string,
    updates: Partial<SiteCompetency>
  ): Promise<SiteCompetency | null> {
    const tenantId = this.resolveTenant(accessToken);
    const idx = this.competencies.findIndex((c) => c.id === id && c.tenant_id === tenantId);
    if (idx === -1) return null;
    const updated = {
      ...this.competencies[idx]!,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.competencies[idx] = updated;
    return updated;
  }

  // 4. Appraisals
  async listAppraisals(accessToken: string): Promise<PerformanceAppraisal[]> {
    const tenantId = this.resolveTenant(accessToken);
    return this.appraisals.filter((a) => a.tenant_id === tenantId);
  }

  async getAppraisalById(accessToken: string, id: string): Promise<PerformanceAppraisal | null> {
    const tenantId = this.resolveTenant(accessToken);
    return this.appraisals.find((a) => a.id === id && a.tenant_id === tenantId) || null;
  }

  async createAppraisal(accessToken: string, input: CreateAppraisalInput): Promise<PerformanceAppraisal> {
    const tenantId = this.resolveTenant(accessToken);
    const now = new Date().toISOString();
    const app: PerformanceAppraisal = {
      id: `appr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenant_id: tenantId,
      employee_name: input.employee_name,
      review_period: input.review_period,
      appraiser_name: input.appraiser_name,
      score: input.score ?? 3.0,
      strengths: input.strengths || null,
      growth_areas: input.growth_areas || null,
      goals: input.goals || null,
      status: input.status || "draft",
      created_at: now,
      updated_at: now,
    };
    this.appraisals.push(app);
    return app;
  }

  async updateAppraisal(
    accessToken: string,
    id: string,
    updates: Partial<PerformanceAppraisal>
  ): Promise<PerformanceAppraisal | null> {
    const tenantId = this.resolveTenant(accessToken);
    const idx = this.appraisals.findIndex((a) => a.id === id && a.tenant_id === tenantId);
    if (idx === -1) return null;
    const updated = {
      ...this.appraisals[idx]!,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.appraisals[idx] = updated;
    return updated;
  }
}
