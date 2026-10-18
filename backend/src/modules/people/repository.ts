import type { SupabaseClient } from "@supabase/supabase-js";
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
} from "./types.js";

export type { PeopleRepository };

export function createSupabasePeopleRepository(
  getUserScopedClient: (accessToken: string) => SupabaseClient
): PeopleRepository {
  return {
    // 1. Manpower Requests
    async listManpowerRequests(accessToken: string, projectId?: string): Promise<ManpowerRequest[]> {
      const client = getUserScopedClient(accessToken);
      let query = client.from("manpower_requests").select("*").order("created_at", { ascending: false });
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list manpower requests: ${error.message}`);
      return (data || []) as ManpowerRequest[];
    },

    async getManpowerRequestById(accessToken: string, id: string): Promise<ManpowerRequest | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client.from("manpower_requests").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to get manpower request: ${error.message}`);
      return data as ManpowerRequest | null;
    },

    async createManpowerRequest(accessToken: string, input: CreateManpowerRequestInput): Promise<ManpowerRequest> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("manpower_requests")
        .insert({
          project_id: input.project_id,
          request_number: input.request_number,
          role_title: input.role_title,
          quantity_required: input.quantity_required,
          skill_level: input.skill_level || "intermediate",
          required_date: input.required_date,
          notes: input.notes || null,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create manpower request: ${error.message}`);
      return data as ManpowerRequest;
    },

    async updateManpowerRequest(
      accessToken: string,
      id: string,
      updates: Partial<ManpowerRequest>
    ): Promise<ManpowerRequest | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("manpower_requests")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update manpower request: ${error.message}`);
      return data as ManpowerRequest | null;
    },

    // 2. Candidates
    async listCandidates(accessToken: string, requestId?: string): Promise<RecruitmentCandidate[]> {
      const client = getUserScopedClient(accessToken);
      let query = client.from("recruitment_candidates").select("*").order("created_at", { ascending: false });
      if (requestId) {
        query = query.eq("manpower_request_id", requestId);
      }
      const { data, error } = await query;
      if (error) throw new Error(`Failed to list candidates: ${error.message}`);
      return (data || []) as RecruitmentCandidate[];
    },

    async getCandidateById(accessToken: string, id: string): Promise<RecruitmentCandidate | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client.from("recruitment_candidates").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to get candidate: ${error.message}`);
      return data as RecruitmentCandidate | null;
    },

    async createCandidate(accessToken: string, input: CreateCandidateInput): Promise<RecruitmentCandidate> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("recruitment_candidates")
        .insert({
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
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create candidate: ${error.message}`);
      return data as RecruitmentCandidate;
    },

    async updateCandidate(
      accessToken: string,
      id: string,
      updates: Partial<RecruitmentCandidate>
    ): Promise<RecruitmentCandidate | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("recruitment_candidates")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update candidate: ${error.message}`);
      return data as RecruitmentCandidate | null;
    },

    // 3. Competencies
    async listCompetencies(accessToken: string): Promise<SiteCompetency[]> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client.from("site_competencies").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list site competencies: ${error.message}`);
      return (data || []) as SiteCompetency[];
    },

    async getCompetencyById(accessToken: string, id: string): Promise<SiteCompetency | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client.from("site_competencies").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to get site competency: ${error.message}`);
      return data as SiteCompetency | null;
    },

    async createCompetency(
      accessToken: string,
      input: CreateCompetencyInput & { status: CompetencyStatus }
    ): Promise<SiteCompetency> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("site_competencies")
        .insert({
          employee_name: input.employee_name,
          trade: input.trade || "civil_mason",
          certification_name: input.certification_name,
          certifying_body: input.certifying_body,
          issue_date: input.issue_date,
          expiry_date: input.expiry_date,
          status: input.status,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create site competency: ${error.message}`);
      return data as SiteCompetency;
    },

    async updateCompetency(
      accessToken: string,
      id: string,
      updates: Partial<SiteCompetency>
    ): Promise<SiteCompetency | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("site_competencies")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update site competency: ${error.message}`);
      return data as SiteCompetency | null;
    },

    // 4. Appraisals
    async listAppraisals(accessToken: string): Promise<PerformanceAppraisal[]> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client.from("performance_appraisals").select("*").order("created_at", { ascending: false });
      if (error) throw new Error(`Failed to list performance appraisals: ${error.message}`);
      return (data || []) as PerformanceAppraisal[];
    },

    async getAppraisalById(accessToken: string, id: string): Promise<PerformanceAppraisal | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client.from("performance_appraisals").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`Failed to get performance appraisal: ${error.message}`);
      return data as PerformanceAppraisal | null;
    },

    async createAppraisal(accessToken: string, input: CreateAppraisalInput): Promise<PerformanceAppraisal> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("performance_appraisals")
        .insert({
          employee_name: input.employee_name,
          review_period: input.review_period,
          appraiser_name: input.appraiser_name,
          score: input.score ?? 3.0,
          strengths: input.strengths || null,
          growth_areas: input.growth_areas || null,
          goals: input.goals || null,
          status: input.status || "draft",
        })
        .select()
        .single();
      if (error) throw new Error(`Failed to create performance appraisal: ${error.message}`);
      return data as PerformanceAppraisal;
    },

    async updateAppraisal(
      accessToken: string,
      id: string,
      updates: Partial<PerformanceAppraisal>
    ): Promise<PerformanceAppraisal | null> {
      const client = getUserScopedClient(accessToken);
      const { data, error } = await client
        .from("performance_appraisals")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw new Error(`Failed to update performance appraisal: ${error.message}`);
      return data as PerformanceAppraisal | null;
    },
  };
}
