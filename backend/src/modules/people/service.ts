import type {
  PeopleRepository,
  ManpowerRequest,
  RecruitmentCandidate,
  SiteCompetency,
  PerformanceAppraisal,
  CreateManpowerRequestInput,
  ApproveManpowerRequestInput,
  CreateCandidateInput,
  UpdateCandidateStageInput,
  CreateCompetencyInput,
  CreateAppraisalInput,
  CompetencyStatus,
} from "./types.js";

export class PeopleService {
  constructor(private repo: PeopleRepository) {}

  // 1. Manpower Requests
  async listManpowerRequests(accessToken: string, projectId?: string): Promise<ManpowerRequest[]> {
    return this.repo.listManpowerRequests(accessToken, projectId);
  }

  async getManpowerRequestById(accessToken: string, id: string): Promise<ManpowerRequest | null> {
    return this.repo.getManpowerRequestById(accessToken, id);
  }

  async createManpowerRequest(
    accessToken: string,
    input: CreateManpowerRequestInput
  ): Promise<ManpowerRequest> {
    if (!input.role_title || input.role_title.trim() === "") {
      throw new Error("Role title is required");
    }
    const qty = Number(input.quantity_required) || 0;
    if (qty <= 0) {
      throw new Error("Quantity required must be greater than zero");
    }
    return this.repo.createManpowerRequest(accessToken, {
      ...input,
      quantity_required: qty,
    });
  }

  async approveManpowerRequest(
    accessToken: string,
    id: string,
    input: ApproveManpowerRequestInput
  ): Promise<ManpowerRequest> {
    const existing = await this.repo.getManpowerRequestById(accessToken, id);
    if (!existing) {
      throw new Error(`Manpower request ${id} not found`);
    }

    const updated = await this.repo.updateManpowerRequest(accessToken, id, {
      status: "approved",
      approved_by: input.approved_by,
      approved_at: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error(`Failed to approve manpower request ${id}`);
    }
    return updated;
  }

  // 2. Candidates
  async listCandidates(accessToken: string, requestId?: string): Promise<RecruitmentCandidate[]> {
    return this.repo.listCandidates(accessToken, requestId);
  }

  async getCandidateById(accessToken: string, id: string): Promise<RecruitmentCandidate | null> {
    return this.repo.getCandidateById(accessToken, id);
  }

  async createCandidate(
    accessToken: string,
    input: CreateCandidateInput
  ): Promise<RecruitmentCandidate> {
    if (!input.candidate_name || input.candidate_name.trim() === "") {
      throw new Error("Candidate name is required");
    }
    if (!input.email || !input.email.includes("@")) {
      throw new Error("Valid email is required");
    }
    return this.repo.createCandidate(accessToken, input);
  }

  async updateCandidateStage(
    accessToken: string,
    id: string,
    input: UpdateCandidateStageInput
  ): Promise<RecruitmentCandidate> {
    const existing = await this.repo.getCandidateById(accessToken, id);
    if (!existing) {
      throw new Error(`Candidate ${id} not found`);
    }

    const updates: Partial<RecruitmentCandidate> = {
      stage: input.stage,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    };
    if (input.rating !== undefined) {
      updates.rating = input.rating;
    }

    const updated = await this.repo.updateCandidate(accessToken, id, updates);
    if (!updated) {
      throw new Error(`Failed to update candidate stage ${id}`);
    }

    // Check if this fulfills the associated manpower request
    if (input.stage === "hired" && existing.manpower_request_id) {
      const allHired = (await this.repo.listCandidates(accessToken, existing.manpower_request_id)).filter(
        (c) => c.stage === "hired"
      );
      const mpr = await this.repo.getManpowerRequestById(accessToken, existing.manpower_request_id);
      if (mpr && allHired.length >= mpr.quantity_required) {
        await this.repo.updateManpowerRequest(accessToken, mpr.id, {
          status: "fulfilled",
        });
      }
    }

    return updated;
  }

  // 3. Competencies
  async listCompetencies(accessToken: string): Promise<SiteCompetency[]> {
    return this.repo.listCompetencies(accessToken);
  }

  async createCompetency(
    accessToken: string,
    input: CreateCompetencyInput
  ): Promise<SiteCompetency> {
    if (!input.employee_name || input.employee_name.trim() === "") {
      throw new Error("Employee name is required");
    }
    if (!input.certification_name || input.certification_name.trim() === "") {
      throw new Error("Certification name is required");
    }

    const todayStr = new Date().toISOString().split("T")[0]!;
    const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]!;

    let status: CompetencyStatus = "valid";
    if (input.expiry_date < todayStr) {
      status = "expired";
    } else if (input.expiry_date <= thirtyDaysOut) {
      status = "expiring_soon";
    }

    return this.repo.createCompetency(accessToken, {
      ...input,
      status,
    });
  }

  // 4. Appraisals
  async listAppraisals(accessToken: string): Promise<PerformanceAppraisal[]> {
    return this.repo.listAppraisals(accessToken);
  }

  async createAppraisal(
    accessToken: string,
    input: CreateAppraisalInput
  ): Promise<PerformanceAppraisal> {
    if (!input.employee_name || input.employee_name.trim() === "") {
      throw new Error("Employee name is required");
    }
    if (!input.review_period || input.review_period.trim() === "") {
      throw new Error("Review period is required");
    }
    return this.repo.createAppraisal(accessToken, input);
  }

  async completeAppraisal(accessToken: string, id: string): Promise<PerformanceAppraisal> {
    const existing = await this.repo.getAppraisalById(accessToken, id);
    if (!existing) {
      throw new Error(`Performance appraisal ${id} not found`);
    }
    const updated = await this.repo.updateAppraisal(accessToken, id, { status: "completed" });
    if (!updated) {
      throw new Error(`Failed to complete appraisal ${id}`);
    }
    return updated;
  }
}
