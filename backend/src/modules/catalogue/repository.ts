import type { SupabaseClient } from "@supabase/supabase-js";
import type { MergedCatalogueRow } from "./importParser.js";
import type {
  Disposition,
  SourceWorkItem,
  WorkItemDefinition,
  WorkItemDefinitionVersion,
  WorkItemDetail,
  WorkItemFilters,
  WorkItemStatus,
  WorkItemSummary,
} from "./types.js";

export interface ImportCatalogueInput {
  sourceFileName: string;
  sourceFileChecksum: string;
  rows: MergedCatalogueRow[];
  importedBy: string | null;
}

export interface ImportSummary {
  importId: string;
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
}

export interface UpdateWorkItemFields {
  disposition?: Disposition;
  status?: WorkItemStatus;
  priority?: string | null;
  risk_tier?: string | null;
  phase_target?: string | null;
  capability_key?: string | null;
  workflow_template_id?: string | null;
}

export interface CreateWorkItemInput {
  work_item_name: string;
  department: string;
  who_is_responsible: string;
  description?: string | null;
  trigger_text?: string | null;
  action_text?: string | null;
  output_evidence?: string | null;
  control_handoff?: string | null;
  continuity_escalation?: string | null;
  timing?: string | null;
  disposition: Disposition;
  canonical_role_id?: string | null;
  priority?: string | null;
  risk_tier?: string | null;
  phase_target?: string | null;
  capability_key?: string | null;
  created_by: string | null;
}

export interface UpdateSourceWorkItemFields {
  work_item_name?: string;
  department?: string;
  who_is_responsible?: string;
  description?: string | null;
  trigger_text?: string | null;
  action_text?: string | null;
  output_evidence?: string | null;
  control_handoff?: string | null;
  continuity_escalation?: string | null;
  timing?: string | null;
}

/**
 * Same convention as modules/tenancy and modules/authority: mutating/
 * reading-as-the-caller methods take the caller's own access token and
 * go through the user-scoped client, relying on RLS for isolation.
 * `importCatalogue` is the one exception — source_work_items and
 * work_item_definitions have no authenticated insert policy (same
 * precedent as ticket 0056's role_definitions: a shared catalogue
 * written by service-role tooling, not a self-service API) — so it
 * always runs through the service client, called only from
 * backend/src/scripts/import-catalogue.ts.
 */
export interface CatalogueRepository {
  importCatalogue(input: ImportCatalogueInput): Promise<ImportSummary>;
  listWorkItems(accessToken: string, filters: WorkItemFilters): Promise<WorkItemSummary[]>;
  getWorkItemDetail(accessToken: string, id: string): Promise<WorkItemDetail | null>;
  createWorkItem(accessToken: string, input: CreateWorkItemInput): Promise<WorkItemDefinition>;
  updateWorkItemDefinition(
    accessToken: string,
    id: string,
    fields: UpdateWorkItemFields,
    nextVersion: number,
    updatedBy: string | null,
  ): Promise<WorkItemDefinition>;
  updateSourceWorkItemFields(accessToken: string, sourceWorkItemId: string, fields: UpdateSourceWorkItemFields): Promise<void>;
  insertDefinitionVersion(
    accessToken: string,
    definitionId: string,
    version: number,
    snapshot: Record<string, unknown>,
    changeNote: string | null,
    createdBy: string | null,
  ): Promise<WorkItemDefinitionVersion>;
}

function matchesMissingData(definition: WorkItemDefinition): boolean {
  return (
    definition.priority === null &&
    definition.risk_tier === null &&
    definition.phase_target === null &&
    definition.capability_key === null
  );
}

function applyFilters(definitions: WorkItemDefinition[], filters: WorkItemFilters): WorkItemDefinition[] {
  return definitions.filter((definition) => {
    if (filters.canonicalRoleId && definition.canonical_role_id !== filters.canonicalRoleId) return false;
    if (filters.disposition && definition.disposition !== filters.disposition) return false;
    if (filters.status && definition.status !== filters.status) return false;
    if (filters.riskTier && definition.risk_tier !== filters.riskTier) return false;
    if (filters.missingData && !matchesMissingData(definition)) return false;
    if (filters.department && definition.department_cluster !== filters.department) return false;
    if (filters.excludeRetired && definition.status === "retired") return false;
    return true;
  });
}

/** Joins each definition with its source row's name/description, ticket 0125. */
function toSummary(definition: WorkItemDefinition, source: SourceWorkItem | undefined): WorkItemSummary {
  return {
    ...definition,
    work_item_name: source?.work_item_name ?? "",
    description: source?.description ?? null,
    who_is_responsible: source?.who_is_responsible ?? "",
    source_department: source?.department ?? "",
  };
}

/** `search` matches against the joined name/description, not any `work_item_definitions` column. */
function applySearch(summaries: WorkItemSummary[], search: string | undefined): WorkItemSummary[] {
  if (!search) return summaries;
  const needle = search.toLowerCase();
  return summaries.filter(
    (s) => s.work_item_name.toLowerCase().includes(needle) || (s.description ?? "").toLowerCase().includes(needle),
  );
}

/**
 * Supabase-backed implementation. Not exercised against a live Supabase
 * project in this session (no reachable credentials in this sandbox,
 * same recurring gap as every Phase 1/2 ticket so far) — service.test.ts
 * / routes.test.ts cover the business logic through the interface above
 * via FakeCatalogueRepository instead.
 */
export function createSupabaseCatalogueRepository(
  serviceClient: SupabaseClient,
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): CatalogueRepository {
  return {
    async importCatalogue(input) {
      const { data: importRow, error: importError } = await serviceClient
        .from("source_catalogue_imports")
        .insert({
          source_file_name: input.sourceFileName,
          source_file_checksum: input.sourceFileChecksum,
          row_count: input.rows.length,
          imported_by: input.importedBy,
        })
        .select("*")
        .single();
      if (importError || !importRow) {
        throw new Error(`importCatalogue (import record): ${importError?.message ?? "no row returned"}`);
      }

      const sourcePayload = input.rows.map((row) => ({
        source_serial: row.source_serial,
        department: row.department,
        work_item_name: row.work_item_name,
        who_is_responsible: row.who_is_responsible,
        description: row.description,
        trigger_text: row.trigger_text,
        action_text: row.action_text,
        output_evidence: row.output_evidence,
        control_handoff: row.control_handoff,
        continuity_escalation: row.continuity_escalation,
        timing: row.timing,
        import_id: importRow.id as string,
      }));

      const { data: sourceRows, error: sourceError } = await serviceClient
        .from("source_work_items")
        .upsert(sourcePayload, { onConflict: "source_serial" })
        .select("id, source_serial");
      if (sourceError) throw new Error(`importCatalogue (source rows): ${sourceError.message}`);

      const sourceIdBySerial = new Map<number, string>();
      for (const row of sourceRows ?? []) {
        sourceIdBySerial.set(row.source_serial as number, row.id as string);
      }
      const sourceWorkItemIds = [...sourceIdBySerial.values()];

      const { data: existingDefs, error: existingError } = await serviceClient
        .from("work_item_definitions")
        .select("*")
        .in("source_work_item_id", sourceWorkItemIds.length > 0 ? sourceWorkItemIds : [""]);
      if (existingError) throw new Error(`importCatalogue (existing definitions): ${existingError.message}`);
      const existingBySourceId = new Map<string, WorkItemDefinition>();
      for (const def of existingDefs ?? []) {
        existingBySourceId.set((def as WorkItemDefinition).source_work_item_id, def as WorkItemDefinition);
      }

      const roleIds = [...new Set(input.rows.map((row) => row.canonical_role_id).filter((id): id is string => !!id))];
      const departmentClusterByRole = new Map<string, string | null>();
      if (roleIds.length > 0) {
        const { data: roleRows, error: roleError } = await serviceClient
          .from("role_definitions")
          .select("id, department_cluster")
          .in("id", roleIds);
        if (roleError) throw new Error(`importCatalogue (role lookup): ${roleError.message}`);
        for (const role of roleRows ?? []) {
          departmentClusterByRole.set(role.id as string, (role.department_cluster as string | null) ?? null);
        }
      }

      let created = 0;
      let updated = 0;
      let unchanged = 0;
      const defPayload: Record<string, unknown>[] = [];
      const pendingVersions: { sourceWorkItemId: string; version: number; snapshot: Record<string, unknown>; changeNote: string }[] = [];

      for (const row of input.rows) {
        const sourceWorkItemId = sourceIdBySerial.get(row.source_serial);
        if (!sourceWorkItemId) continue;
        const departmentCluster = row.canonical_role_id
          ? departmentClusterByRole.get(row.canonical_role_id) ?? null
          : null;
        const normalized = {
          canonical_role_id: row.canonical_role_id,
          department_cluster: departmentCluster,
          disposition: row.disposition,
          ticket_ref: row.ticket_ref,
        };
        const existing = existingBySourceId.get(sourceWorkItemId);

        if (!existing) {
          created += 1;
          defPayload.push({ source_work_item_id: sourceWorkItemId, ...normalized, current_version: 1 });
          pendingVersions.push({
            sourceWorkItemId,
            version: 1,
            snapshot: normalized,
            changeNote: "initial import",
          });
          continue;
        }

        const changed =
          existing.canonical_role_id !== normalized.canonical_role_id ||
          existing.department_cluster !== normalized.department_cluster ||
          existing.disposition !== normalized.disposition ||
          existing.ticket_ref !== normalized.ticket_ref;

        if (!changed) {
          unchanged += 1;
          continue;
        }

        updated += 1;
        const nextVersion = existing.current_version + 1;
        defPayload.push({ source_work_item_id: sourceWorkItemId, ...normalized, current_version: nextVersion });
        pendingVersions.push({
          sourceWorkItemId,
          version: nextVersion,
          snapshot: normalized,
          changeNote: "re-import: normalized fields changed",
        });
      }

      if (defPayload.length > 0) {
        const { error: upsertError } = await serviceClient
          .from("work_item_definitions")
          .upsert(defPayload, { onConflict: "source_work_item_id" });
        if (upsertError) throw new Error(`importCatalogue (definitions): ${upsertError.message}`);
      }

      if (pendingVersions.length > 0) {
        const { data: defsForVersions, error: defsError } = await serviceClient
          .from("work_item_definitions")
          .select("id, source_work_item_id")
          .in("source_work_item_id", pendingVersions.map((v) => v.sourceWorkItemId));
        if (defsError) throw new Error(`importCatalogue (definitions for versions): ${defsError.message}`);
        const definitionIdBySourceId = new Map<string, string>();
        for (const def of defsForVersions ?? []) {
          definitionIdBySourceId.set(def.source_work_item_id as string, def.id as string);
        }

        const versionPayload = pendingVersions.map((pending) => ({
          work_item_definition_id: definitionIdBySourceId.get(pending.sourceWorkItemId),
          version: pending.version,
          snapshot: pending.snapshot,
          change_note: pending.changeNote,
          created_by: input.importedBy,
        }));
        const { error: versionError } = await serviceClient
          .from("work_item_definition_versions")
          .insert(versionPayload);
        if (versionError) throw new Error(`importCatalogue (versions): ${versionError.message}`);
      }

      return {
        importId: importRow.id as string,
        totalRows: input.rows.length,
        created,
        updated,
        unchanged,
      };
    },

    async listWorkItems(accessToken, filters) {
      const client = userScopedClientFactory(accessToken);
      // Use embedded select to join source_work_items in one query, avoiding a
      // large .in() that would exceed PostgREST's URL length limit at 1,308 rows.
      // .range(0, 1999) overrides PostgREST's 1000-row default.
      let query = client
        .from("work_item_definitions")
        .select("*, source_work_items(*)")
        .range(0, 1999);
      if (filters.canonicalRoleId) query = query.eq("canonical_role_id", filters.canonicalRoleId);
      if (filters.disposition) query = query.eq("disposition", filters.disposition);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.riskTier) query = query.eq("risk_tier", filters.riskTier);
      if (filters.department) query = query.eq("department_cluster", filters.department);
      if (filters.excludeRetired) query = query.neq("status", "retired");
      const { data, error } = await query;
      if (error) throw new Error(`listWorkItems: ${error.message}`);
      type RowWithSource = WorkItemDefinition & { source_work_items: SourceWorkItem | null };
      let rows = (data as RowWithSource[]) ?? [];
      if (filters.missingData) rows = rows.filter(matchesMissingData);
      const summaries = rows.map((r) => toSummary(r, r.source_work_items ?? undefined));
      return applySearch(summaries, filters.search);
    },

    async getWorkItemDetail(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data: definition, error: defError } = await client
        .from("work_item_definitions")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (defError) throw new Error(`getWorkItemDetail (definition): ${defError.message}`);
      if (!definition) return null;

      const { data: source, error: sourceError } = await client
        .from("source_work_items")
        .select("*")
        .eq("id", (definition as WorkItemDefinition).source_work_item_id)
        .maybeSingle();
      if (sourceError) throw new Error(`getWorkItemDetail (source): ${sourceError.message}`);
      if (!source) return null;

      const { data: versions, error: versionsError } = await client
        .from("work_item_definition_versions")
        .select("*")
        .eq("work_item_definition_id", id)
        .order("version", { ascending: true });
      if (versionsError) throw new Error(`getWorkItemDetail (versions): ${versionsError.message}`);

      return {
        definition: definition as WorkItemDefinition,
        source: source as never,
        versions: (versions as WorkItemDefinitionVersion[]) ?? [],
      };
    },

    async createWorkItem(_accessToken, input) {
      // Insert a manual source_work_item first, then the work_item_definition.
      const sourceSerial = Date.now(); // synthetic serial for manual items
      const { data: sourceRow, error: sourceError } = await serviceClient
        .from("source_work_items")
        .insert({
          source_serial: sourceSerial,
          department: input.department,
          work_item_name: input.work_item_name,
          who_is_responsible: input.who_is_responsible,
          description: input.description ?? null,
          trigger_text: input.trigger_text ?? null,
          action_text: input.action_text ?? null,
          output_evidence: input.output_evidence ?? null,
          control_handoff: input.control_handoff ?? null,
          continuity_escalation: input.continuity_escalation ?? null,
          timing: input.timing ?? null,
          import_id: null,
        })
        .select("id")
        .single();
      if (sourceError || !sourceRow) throw new Error(`createWorkItem (source row): ${sourceError?.message ?? "no row returned"}`);

      const { data: defRow, error: defError } = await serviceClient
        .from("work_item_definitions")
        .insert({
          source_work_item_id: sourceRow.id as string,
          disposition: input.disposition,
          canonical_role_id: input.canonical_role_id ?? null,
          priority: input.priority ?? null,
          risk_tier: input.risk_tier ?? null,
          phase_target: input.phase_target ?? null,
          capability_key: input.capability_key ?? null,
          source_type: "manual",
          current_version: 1,
          created_by: input.created_by,
        })
        .select("*")
        .single();
      if (defError || !defRow) throw new Error(`createWorkItem (definition): ${defError?.message ?? "no row returned"}`);
      return defRow as WorkItemDefinition;
    },

    async updateWorkItemDefinition(_accessToken, id, fields, nextVersion, updatedBy) {
      // Service client: catalogue rows are global (tenant_id IS NULL); app-layer
      // auth is already enforced by requirePermission("catalogue.workitem.manage").
      const { data, error } = await serviceClient
        .from("work_item_definitions")
        .update({ ...fields, current_version: nextVersion, updated_by: updatedBy })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) throw new Error(`updateWorkItemDefinition: ${error?.message ?? "no row returned"}`);
      return data as WorkItemDefinition;
    },

    async updateSourceWorkItemFields(_accessToken, sourceWorkItemId, fields) {
      const updatePayload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined) updatePayload[key] = value;
      }
      if (Object.keys(updatePayload).length === 0) return;
      const { error } = await serviceClient.from("source_work_items").update(updatePayload).eq("id", sourceWorkItemId);
      if (error) throw new Error(`updateSourceWorkItemFields: ${error.message}`);
    },

    async insertDefinitionVersion(_accessToken, definitionId, version, snapshot, changeNote, createdBy) {
      // Service client: same reasoning as updateWorkItemDefinition.
      const { data, error } = await serviceClient
        .from("work_item_definition_versions")
        .insert({
          work_item_definition_id: definitionId,
          version,
          snapshot,
          change_note: changeNote,
          created_by: createdBy,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertDefinitionVersion: ${error?.message ?? "no row returned"}`);
      return data as WorkItemDefinitionVersion;
    },
  };
}

export { applyFilters as filterWorkItemsInMemory, applySearch as applySearchInMemory, toSummary };
