import { formatNumberingSchemeValue, type MasterDataRepository } from "./repository.js";
import type {
  CreateCostCodeInput,
  CreateCurrencyInput,
  CreateDocumentTypeInput,
  CreateNumberingSchemeInput,
  CreateUomInput,
  UpdateCostCodeInput,
  UpdateCurrencyInput,
  UpdateDocumentTypeInput,
  UpdateNumberingSchemeInput,
  UpdateUomInput,
} from "./repository.js";

export class NotFoundError extends Error {}

export class CostCodeInUseError extends Error {
  constructor(public readonly referencingCount: number) {
    super(`cost code is referenced by ${referencingCount} estimate line(s) and cannot be archived`);
  }
}

export class DocumentTypeInUseError extends Error {
  constructor(public readonly referencingCount: number) {
    super(`document type is referenced by ${referencingCount} document(s) and cannot be archived`);
  }
}

export class NumberingSchemeNotActiveError extends Error {
  constructor() {
    super("numbering scheme is archived and cannot issue new numbers");
  }
}

// --- UoM ---

export async function listUom(repo: MasterDataRepository, accessToken: string) {
  return repo.listUom(accessToken);
}

export async function createUom(repo: MasterDataRepository, accessToken: string, input: CreateUomInput) {
  return repo.createUom(accessToken, input);
}

export async function updateUom(
  repo: MasterDataRepository,
  accessToken: string,
  id: string,
  input: UpdateUomInput,
) {
  const updated = await repo.updateUom(accessToken, id, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function archiveUom(repo: MasterDataRepository, accessToken: string, id: string) {
  const archived = await repo.archiveUom(accessToken, id);
  if (!archived) throw new NotFoundError();
  return archived;
}

// --- Currencies ---

export async function listCurrencies(repo: MasterDataRepository, accessToken: string) {
  return repo.listCurrencies(accessToken);
}

export async function createCurrency(repo: MasterDataRepository, accessToken: string, input: CreateCurrencyInput) {
  // Clear any existing base currency *before* inserting — the new row's
  // own insert would otherwise violate the partial-unique-index
  // constraint the instant it tries to set is_base_currency=true while
  // another row still has it.
  if (input.is_base_currency) {
    await repo.clearBaseCurrency(accessToken);
  }
  return repo.createCurrency(accessToken, input);
}

export async function updateCurrency(
  repo: MasterDataRepository,
  accessToken: string,
  id: string,
  input: UpdateCurrencyInput,
) {
  if (input.is_base_currency) {
    await repo.clearBaseCurrency(accessToken);
  }
  const updated = await repo.updateCurrency(accessToken, id, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function archiveCurrency(repo: MasterDataRepository, accessToken: string, id: string) {
  const archived = await repo.archiveCurrency(accessToken, id);
  if (!archived) throw new NotFoundError();
  return archived;
}

// --- Cost codes ---

export async function listCostCodes(repo: MasterDataRepository, accessToken: string) {
  return repo.listCostCodes(accessToken);
}

export async function createCostCode(repo: MasterDataRepository, accessToken: string, input: CreateCostCodeInput) {
  return repo.createCostCode(accessToken, input);
}

export async function updateCostCode(
  repo: MasterDataRepository,
  accessToken: string,
  id: string,
  input: UpdateCostCodeInput,
) {
  const updated = await repo.updateCostCode(accessToken, id, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function archiveCostCode(repo: MasterDataRepository, accessToken: string, id: string) {
  const referencingCount = await repo.countEstimateLinesReferencingCostCode(accessToken, id);
  if (referencingCount > 0) throw new CostCodeInUseError(referencingCount);
  const archived = await repo.archiveCostCode(accessToken, id);
  if (!archived) throw new NotFoundError();
  return archived;
}

// --- Document types ---

export async function listDocumentTypes(repo: MasterDataRepository, accessToken: string) {
  return repo.listDocumentTypes(accessToken);
}

export async function createDocumentType(
  repo: MasterDataRepository,
  accessToken: string,
  input: CreateDocumentTypeInput,
) {
  return repo.createDocumentType(accessToken, input);
}

export async function updateDocumentType(
  repo: MasterDataRepository,
  accessToken: string,
  id: string,
  input: UpdateDocumentTypeInput,
) {
  const updated = await repo.updateDocumentType(accessToken, id, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function archiveDocumentType(repo: MasterDataRepository, accessToken: string, id: string) {
  const referencingCount = await repo.countDocumentsReferencingDocumentType(accessToken, id);
  if (referencingCount > 0) throw new DocumentTypeInUseError(referencingCount);
  const archived = await repo.archiveDocumentType(accessToken, id);
  if (!archived) throw new NotFoundError();
  return archived;
}

// --- Numbering schemes ---

export async function listNumberingSchemes(repo: MasterDataRepository, accessToken: string) {
  return repo.listNumberingSchemes(accessToken);
}

export async function createNumberingScheme(
  repo: MasterDataRepository,
  accessToken: string,
  input: CreateNumberingSchemeInput,
) {
  return repo.createNumberingScheme(accessToken, {
    ...input,
    prefix: input.prefix ?? "",
    suffix: input.suffix ?? "",
  });
}

export async function updateNumberingScheme(
  repo: MasterDataRepository,
  accessToken: string,
  id: string,
  input: UpdateNumberingSchemeInput,
) {
  const updated = await repo.updateNumberingScheme(accessToken, id, input);
  if (!updated) throw new NotFoundError();
  return updated;
}

export async function previewNextNumber(repo: MasterDataRepository, accessToken: string, id: string) {
  const scheme = await repo.getNumberingScheme(accessToken, id);
  if (!scheme) throw new NotFoundError();
  return formatNumberingSchemeValue(scheme, scheme.next_sequence);
}

export async function issueNextNumber(repo: MasterDataRepository, accessToken: string, id: string) {
  const scheme = await repo.getNumberingScheme(accessToken, id);
  if (!scheme) throw new NotFoundError();
  if (!scheme.is_active) throw new NumberingSchemeNotActiveError();
  const updated = await repo.consumeNextSequence(accessToken, id);
  if (!updated) throw new NotFoundError();
  // Derive the consumed value from the post-increment row (not the
  // pre-check read above) so a concurrent caller between those two reads
  // can never cause this response to report a sequence number that
  // doesn't match what was actually consumed.
  const consumedSequence = updated.next_sequence - 1;
  return { scheme: updated, formatted: formatNumberingSchemeValue(updated, consumedSequence) };
}
