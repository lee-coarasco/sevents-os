import type {
  CatalogueRepository,
  ImportCatalogueInput,
  ImportSummary,
  UpdateWorkItemFields,
} from "../modules/catalogue/repository.js";
import { applySearchInMemory, filterWorkItemsInMemory, toSummary } from "../modules/catalogue/repository.js";
import type {
  SourceWorkItem,
  WorkItemDefinition,
  WorkItemDefinitionVersion,
  WorkItemDetail,
  WorkItemFilters,
  WorkItemSummary,
} from "../modules/catalogue/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for CatalogueRepository. The work-item catalogue is
 * platform-wide (nullable tenant_id, same precedent as role_definitions
 * per DECISIONS.md) so, unlike FakeTenancyRepository, this fake does not
 * filter by a per-token tenant — every session sees the same shared
 * rows, same as the real RLS policy (`tenant_id is null or tenant_id =
 * current_tenant_id()`) would for an all-null-tenant catalogue.
 */
export class FakeCatalogueRepository implements CatalogueRepository {
  sourceWorkItemsBySerial = new Map<number, SourceWorkItem>();
  sourceWorkItemsById = new Map<string, SourceWorkItem>();
  definitionsBySourceId = new Map<string, WorkItemDefinition>();
  definitionsById = new Map<string, WorkItemDefinition>();
  versions: WorkItemDefinitionVersion[] = [];
  roleDepartmentClusters = new Map<string, string>();

  async importCatalogue(input: ImportCatalogueInput): Promise<ImportSummary> {
    const importId = nextId("import");
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const row of input.rows) {
      let sourceRow = this.sourceWorkItemsBySerial.get(row.source_serial);
      if (!sourceRow) {
        sourceRow = {
          id: nextId("source"),
          tenant_id: null,
          import_id: importId,
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
          governance_understanding: null,
          governance_sop_inputs: null,
        };
      } else {
        sourceRow = { ...sourceRow, department: row.department, work_item_name: row.work_item_name };
      }
      this.sourceWorkItemsBySerial.set(row.source_serial, sourceRow);
      this.sourceWorkItemsById.set(sourceRow.id, sourceRow);

      const departmentCluster = row.canonical_role_id
        ? this.roleDepartmentClusters.get(row.canonical_role_id) ?? null
        : null;
      const normalized = {
        canonical_role_id: row.canonical_role_id,
        department_cluster: departmentCluster,
        disposition: row.disposition,
        ticket_ref: row.ticket_ref,
      };

      const existing = this.definitionsBySourceId.get(sourceRow.id);
      if (!existing) {
        created += 1;
        const definition: WorkItemDefinition = {
          id: nextId("workitem"),
          tenant_id: null,
          source_work_item_id: sourceRow.id,
          ...normalized,
          status: "draft",
          priority: null,
          risk_tier: null,
          phase_target: null,
          validation_state: "not_validated",
          configuration_status: "unconfigured",
          capability_key: null,
          workflow_template_id: null,
          current_version: 1,
          created_by: input.importedBy,
          updated_by: null,
        };
        this.definitionsBySourceId.set(sourceRow.id, definition);
        this.definitionsById.set(definition.id, definition);
        this.versions.push({
          id: nextId("version"),
          tenant_id: null,
          work_item_definition_id: definition.id,
          version: 1,
          snapshot: normalized,
          change_note: "initial import",
          created_by: input.importedBy,
          created_at: new Date(0).toISOString(),
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
      const next: WorkItemDefinition = { ...existing, ...normalized, current_version: nextVersion };
      this.definitionsBySourceId.set(sourceRow.id, next);
      this.definitionsById.set(next.id, next);
      this.versions.push({
        id: nextId("version"),
        tenant_id: null,
        work_item_definition_id: next.id,
        version: nextVersion,
        snapshot: normalized,
        change_note: "re-import: normalized fields changed",
        created_by: input.importedBy,
        created_at: new Date(0).toISOString(),
      });
    }

    return { importId, totalRows: input.rows.length, created, updated, unchanged };
  }

  async listWorkItems(_accessToken: string, filters: WorkItemFilters): Promise<WorkItemSummary[]> {
    const filtered = filterWorkItemsInMemory([...this.definitionsById.values()], filters);
    const summaries = filtered.map((d) => toSummary(d, this.sourceWorkItemsById.get(d.source_work_item_id)));
    return applySearchInMemory(summaries, filters.search);
  }

  async getWorkItemDetail(_accessToken: string, id: string): Promise<WorkItemDetail | null> {
    const definition = this.definitionsById.get(id);
    if (!definition) return null;
    const source = this.sourceWorkItemsById.get(definition.source_work_item_id);
    if (!source) return null;
    const versions = this.versions
      .filter((v) => v.work_item_definition_id === id)
      .sort((a, b) => a.version - b.version);
    return { definition, source, versions };
  }

  async updateWorkItemDefinition(
    _accessToken: string,
    id: string,
    fields: UpdateWorkItemFields,
    nextVersion: number,
    updatedBy: string | null,
  ): Promise<WorkItemDefinition> {
    const existing = this.definitionsById.get(id);
    if (!existing) throw new Error(`updateWorkItemDefinition: ${id} not found`);
    const updated: WorkItemDefinition = {
      ...existing,
      ...fields,
      current_version: nextVersion,
      updated_by: updatedBy,
    };
    this.definitionsById.set(id, updated);
    this.definitionsBySourceId.set(updated.source_work_item_id, updated);
    return updated;
  }

  async insertDefinitionVersion(
    _accessToken: string,
    definitionId: string,
    version: number,
    snapshot: Record<string, unknown>,
    changeNote: string | null,
    createdBy: string | null,
  ): Promise<WorkItemDefinitionVersion> {
    const row: WorkItemDefinitionVersion = {
      id: nextId("version"),
      tenant_id: null,
      work_item_definition_id: definitionId,
      version,
      snapshot,
      change_note: changeNote,
      created_by: createdBy,
      created_at: new Date(0).toISOString(),
    };
    this.versions.push(row);
    return row;
  }
}
