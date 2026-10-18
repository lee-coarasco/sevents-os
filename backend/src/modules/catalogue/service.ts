import { mergeCatalogueRows, type MergeIssue } from "./importParser.js";
import type { CatalogueRepository, CreateWorkItemInput, ImportSummary, UpdateWorkItemFields } from "./repository.js";
import { DISPOSITIONS } from "./types.js";
import type { DispositionRow, RawCatalogueRow, WorkItemDefinition, WorkItemDetail, WorkItemFilters, WorkItemSummary } from "./types.js";

export class InvalidDispositionError extends Error {}
export class WorkItemNotFoundError extends Error {}
export class WorkItemDuplicateKeyError extends Error {}

export interface ImportCatalogueOptions {
  sourceFileName: string;
  sourceFileChecksum: string;
  importedBy: string | null;
}

export interface ImportCatalogueResult extends ImportSummary {
  issues: MergeIssue[];
}

export async function importCatalogue(
  repository: CatalogueRepository,
  rawRows: RawCatalogueRow[],
  dispositionRows: DispositionRow[],
  options: ImportCatalogueOptions,
): Promise<ImportCatalogueResult> {
  const { rows, issues } = mergeCatalogueRows(rawRows, dispositionRows);
  const summary = await repository.importCatalogue({
    sourceFileName: options.sourceFileName,
    sourceFileChecksum: options.sourceFileChecksum,
    importedBy: options.importedBy,
    rows,
  });
  return { ...summary, issues };
}

export async function listWorkItems(
  repository: CatalogueRepository,
  accessToken: string,
  filters: WorkItemFilters,
): Promise<WorkItemSummary[]> {
  return repository.listWorkItems(accessToken, filters);
}

export async function getWorkItem(
  repository: CatalogueRepository,
  accessToken: string,
  id: string,
): Promise<WorkItemDetail | null> {
  return repository.getWorkItemDetail(accessToken, id);
}

export interface CreateWorkItemServiceInput {
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
  disposition: string;
  canonical_role_id?: string | null;
  priority?: string | null;
  risk_tier?: string | null;
  phase_target?: string | null;
  capability_key?: string | null;
}

export async function createWorkItem(
  repository: CatalogueRepository,
  accessToken: string,
  input: CreateWorkItemServiceInput,
  createdBy: string | null,
): Promise<WorkItemDefinition> {
  if (!(DISPOSITIONS as readonly string[]).includes(input.disposition)) {
    throw new InvalidDispositionError(`"${input.disposition}" is not one of the BRD §6.5 disposition values`);
  }
  return repository.createWorkItem(accessToken, {
    work_item_name: input.work_item_name,
    department: input.department,
    who_is_responsible: input.who_is_responsible,
    description: input.description ?? null,
    trigger_text: input.trigger_text ?? null,
    action_text: input.action_text ?? null,
    output_evidence: input.output_evidence ?? null,
    control_handoff: input.control_handoff ?? null,
    continuity_escalation: input.continuity_escalation ?? null,
    timing: input.timing ?? null,
    disposition: input.disposition as WorkItemDefinition["disposition"],
    canonical_role_id: input.canonical_role_id ?? null,
    priority: input.priority ?? null,
    risk_tier: input.risk_tier ?? null,
    phase_target: input.phase_target ?? null,
    capability_key: input.capability_key ?? null,
    created_by: createdBy,
  });
}

export interface UpdateWorkItemInput extends UpdateWorkItemFields {
  changeNote?: string | null;
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

/** FR-WI-007: published definition changes require versioning, not a silent overwrite. */
export async function updateWorkItem(
  repository: CatalogueRepository,
  accessToken: string,
  id: string,
  patch: UpdateWorkItemInput,
  updatedBy: string | null,
): Promise<WorkItemDefinition> {
  if (patch.disposition && !(DISPOSITIONS as readonly string[]).includes(patch.disposition)) {
    throw new InvalidDispositionError(`"${patch.disposition}" is not one of the BRD §6.5 disposition values`);
  }

  const detail = await repository.getWorkItemDetail(accessToken, id);
  if (!detail) throw new WorkItemNotFoundError(`work item definition ${id} not found`);

  const { changeNote, work_item_name, department, who_is_responsible, description, trigger_text, action_text, output_evidence, control_handoff, continuity_escalation, timing, ...defFields } = patch;

  const sourceFields = { work_item_name, department, who_is_responsible, description, trigger_text, action_text, output_evidence, control_handoff, continuity_escalation, timing };
  const hasSourceChanges = Object.values(sourceFields).some((v) => v !== undefined);
  if (hasSourceChanges) {
    await repository.updateSourceWorkItemFields(accessToken, detail.definition.source_work_item_id, sourceFields);
  }

  const nextVersion = detail.definition.current_version + 1;
  const updated = await repository.updateWorkItemDefinition(accessToken, id, defFields, nextVersion, updatedBy);
  await repository.insertDefinitionVersion(
    accessToken,
    id,
    nextVersion,
    { ...detail.definition, ...defFields },
    changeNote ?? null,
    updatedBy,
  );
  return updated;
}
