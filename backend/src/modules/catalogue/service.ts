import { mergeCatalogueRows, type MergeIssue } from "./importParser.js";
import type { CatalogueRepository, ImportSummary, UpdateWorkItemFields } from "./repository.js";
import { DISPOSITIONS } from "./types.js";
import type { DispositionRow, RawCatalogueRow, WorkItemDefinition, WorkItemDetail, WorkItemFilters, WorkItemSummary } from "./types.js";

export class InvalidDispositionError extends Error {}
export class WorkItemNotFoundError extends Error {}

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

export interface UpdateWorkItemInput extends UpdateWorkItemFields {
  changeNote?: string | null;
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

  const { changeNote, ...fields } = patch;
  const nextVersion = detail.definition.current_version + 1;
  const updated = await repository.updateWorkItemDefinition(accessToken, id, fields, nextVersion, updatedBy);
  await repository.insertDefinitionVersion(
    accessToken,
    id,
    nextVersion,
    { ...detail.definition, ...fields },
    changeNote ?? null,
    updatedBy,
  );
  return updated;
}
