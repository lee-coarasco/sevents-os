import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AsBuiltRecord,
  DesignBrief,
  DesignBriefStatus,
  IFCRegisterRow,
  Rfi,
  RfiStatus,
} from "./types.js";

// ---- Design brief inputs -----------------------------------------------

export interface CreateDesignBriefInput {
  project_id: string;
  title: string;
  discipline?: string | null;
  scope_description?: string | null;
  reference_document_ids?: string[];
  created_by?: string | null;
}

export interface UpdateDesignBriefInput {
  title?: string;
  discipline?: string | null;
  scope_description?: string | null;
  status?: DesignBriefStatus;
  reference_document_ids?: string[];
  issued_by?: string | null;
  issued_at?: string | null;
}

// ---- RFI inputs ---------------------------------------------------------

export interface CreateRfiInput {
  project_id: string;
  rfi_number: string;
  raised_by?: string | null;
  addressed_to_user_id?: string | null;
  addressed_to_contact_id?: string | null;
  subject: string;
  description?: string | null;
  date_raised?: string;
  date_required?: string | null;
  reference_document_ids?: string[];
}

export interface UpdateRfiInput {
  subject?: string;
  description?: string | null;
  addressed_to_user_id?: string | null;
  addressed_to_contact_id?: string | null;
  date_required?: string | null;
  date_responded?: string | null;
  response?: string | null;
  status?: RfiStatus;
  reference_document_ids?: string[];
}

// ---- As-built inputs ----------------------------------------------------

export interface CreateAsBuiltInput {
  project_id: string;
  document_id: string;
  original_revision_id?: string | null;
  as_built_revision_id?: string | null;
  notes?: string | null;
}

export interface UpdateAsBuiltInput {
  original_revision_id?: string | null;
  as_built_revision_id?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  notes?: string | null;
}

// ---- Repository interface -----------------------------------------------

export interface EngineeringRepository {
  // Design briefs
  listDesignBriefs(accessToken: string, projectId: string): Promise<DesignBrief[]>;
  getDesignBrief(accessToken: string, id: string): Promise<DesignBrief | null>;
  createDesignBrief(accessToken: string, input: CreateDesignBriefInput): Promise<DesignBrief>;
  updateDesignBrief(accessToken: string, id: string, input: UpdateDesignBriefInput): Promise<DesignBrief | null>;
  deleteDesignBrief(accessToken: string, id: string): Promise<boolean>;

  // RFIs
  listRfis(accessToken: string, projectId: string, status?: RfiStatus): Promise<Rfi[]>;
  getRfi(accessToken: string, id: string): Promise<Rfi | null>;
  createRfi(accessToken: string, input: CreateRfiInput): Promise<Rfi>;
  updateRfi(accessToken: string, id: string, input: UpdateRfiInput): Promise<Rfi | null>;

  // IFC register (read-only derived view)
  listIFCRegister(accessToken: string, projectId: string): Promise<IFCRegisterRow[]>;

  // As-built records
  listAsBuilt(accessToken: string, projectId: string): Promise<AsBuiltRecord[]>;
  createAsBuilt(accessToken: string, input: CreateAsBuiltInput): Promise<AsBuiltRecord>;
  updateAsBuilt(accessToken: string, id: string, input: UpdateAsBuiltInput): Promise<AsBuiltRecord | null>;
}

// ---- Supabase implementation --------------------------------------------

export function createSupabaseEngineeringRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): EngineeringRepository {
  return {
    async listDesignBriefs(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("design_briefs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listDesignBriefs: ${error.message}`);
      return (data as DesignBrief[]) ?? [];
    },

    async getDesignBrief(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("design_briefs").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getDesignBrief: ${error.message}`);
      return (data as DesignBrief | null) ?? null;
    },

    async createDesignBrief(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("design_briefs")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`createDesignBrief: ${error?.message ?? "no row returned"}`);
      return data as DesignBrief;
    },

    async updateDesignBrief(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("design_briefs")
        .update(input)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateDesignBrief: ${error.message}`);
      return (data as DesignBrief | null) ?? null;
    },

    async deleteDesignBrief(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client.from("design_briefs").delete().eq("id", id);
      if (error) throw new Error(`deleteDesignBrief: ${error.message}`);
      return true;
    },

    async listRfis(accessToken, projectId, status) {
      const client = userScopedClientFactory(accessToken);
      let query = client
        .from("rfis")
        .select("*")
        .eq("project_id", projectId)
        .order("date_raised", { ascending: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw new Error(`listRfis: ${error.message}`);
      return (data as Rfi[]) ?? [];
    },

    async getRfi(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("rfis").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getRfi: ${error.message}`);
      return (data as Rfi | null) ?? null;
    },

    async createRfi(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("rfis")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`createRfi: ${error?.message ?? "no row returned"}`);
      return data as Rfi;
    },

    async updateRfi(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("rfis")
        .update(input)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateRfi: ${error.message}`);
      return (data as Rfi | null) ?? null;
    },

    async listIFCRegister(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      // Fetch drawing-type documents for this project, joined to their current revision.
      const { data: docs, error: docsError } = await client
        .from("documents")
        .select("id, document_number, title, discipline, document_type, current_revision_id")
        .eq("project_id", projectId)
        .ilike("document_type", "%draw%");
      if (docsError) throw new Error(`listIFCRegister documents: ${docsError.message}`);
      if (!docs || docs.length === 0) return [];

      const revisionIds = (docs as Array<{ current_revision_id: string | null }>)
        .map((d) => d.current_revision_id)
        .filter((id): id is string => id !== null);

      let revisions: Array<{
        id: string;
        revision_code: string;
        status: string;
        approved_at: string | null;
        workflow_instance_id: string | null;
      }> = [];
      if (revisionIds.length > 0) {
        const { data: revData, error: revError } = await client
          .from("document_revisions")
          .select("id, revision_code, status, approved_at, workflow_instance_id")
          .in("id", revisionIds);
        if (revError) throw new Error(`listIFCRegister revisions: ${revError.message}`);
        revisions = (revData as typeof revisions) ?? [];
      }

      const revMap = new Map(revisions.map((r) => [r.id, r]));

      return (docs as Array<{
        id: string;
        document_number: string | null;
        title: string;
        discipline: string | null;
        current_revision_id: string | null;
      }>).map((doc): IFCRegisterRow => {
        const rev = doc.current_revision_id ? revMap.get(doc.current_revision_id) : undefined;
        return {
          document_id: doc.id,
          document_number: doc.document_number,
          title: doc.title,
          discipline: doc.discipline,
          revision_id: rev?.id ?? null,
          revision_code: rev?.revision_code ?? null,
          revision_status: rev?.status ?? null,
          approved_at: rev?.approved_at ?? null,
          submitted: rev?.workflow_instance_id !== null && rev?.workflow_instance_id !== undefined,
        };
      });
    },

    async listAsBuilt(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("as_built_records")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listAsBuilt: ${error.message}`);
      return (data as AsBuiltRecord[]) ?? [];
    },

    async createAsBuilt(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("as_built_records")
        .insert(input)
        .select("*")
        .single();
      if (error || !data) throw new Error(`createAsBuilt: ${error?.message ?? "no row returned"}`);
      return data as AsBuiltRecord;
    },

    async updateAsBuilt(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("as_built_records")
        .update(input)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateAsBuilt: ${error.message}`);
      return (data as AsBuiltRecord | null) ?? null;
    },
  };
}
