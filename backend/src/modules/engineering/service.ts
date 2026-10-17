import type { EngineeringRepository, CreateDesignBriefInput, UpdateDesignBriefInput, CreateRfiInput, UpdateRfiInput, CreateAsBuiltInput, UpdateAsBuiltInput } from "./repository.js";
import type { MasterDataRepository } from "../masterdata/repository.js";
import { formatNumberingSchemeValue } from "../masterdata/repository.js";
import type { DesignBrief, Rfi, IFCRegisterRow, AsBuiltRecord, RfiStatus } from "./types.js";

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
  }
}

export class DraftOnlyError extends Error {
  constructor() {
    super("Only draft design briefs can be deleted");
  }
}

export async function listDesignBriefs(
  repo: EngineeringRepository,
  accessToken: string,
  projectId: string,
): Promise<DesignBrief[]> {
  return repo.listDesignBriefs(accessToken, projectId);
}

export async function getDesignBrief(
  repo: EngineeringRepository,
  accessToken: string,
  id: string,
): Promise<DesignBrief> {
  const brief = await repo.getDesignBrief(accessToken, id);
  if (!brief) throw new NotFoundError("DesignBrief", id);
  return brief;
}

export async function createDesignBrief(
  repo: EngineeringRepository,
  accessToken: string,
  input: CreateDesignBriefInput,
): Promise<DesignBrief> {
  return repo.createDesignBrief(accessToken, input);
}

export async function updateDesignBrief(
  repo: EngineeringRepository,
  accessToken: string,
  id: string,
  input: UpdateDesignBriefInput,
): Promise<DesignBrief> {
  const brief = await repo.updateDesignBrief(accessToken, id, input);
  if (!brief) throw new NotFoundError("DesignBrief", id);
  return brief;
}

export async function deleteDesignBrief(
  repo: EngineeringRepository,
  accessToken: string,
  id: string,
): Promise<void> {
  const brief = await repo.getDesignBrief(accessToken, id);
  if (!brief) throw new NotFoundError("DesignBrief", id);
  if (brief.status !== "draft") throw new DraftOnlyError();
  await repo.deleteDesignBrief(accessToken, id);
}

// ---- RFI service --------------------------------------------------------

async function nextRfiNumber(
  masterDataRepo: MasterDataRepository,
  accessToken: string,
  projectId: string,
  existingRfis: Rfi[],
): Promise<string> {
  // Try M33 numbering scheme with entity_key = "RFI"
  const schemes = await masterDataRepo.listNumberingSchemes(accessToken);
  const scheme = schemes.find((s) => s.entity_type?.toLowerCase() === "rfi" && s.is_active);
  if (scheme) {
    const updated = await masterDataRepo.consumeNextSequence(accessToken, scheme.id);
    if (updated) return formatNumberingSchemeValue(updated, updated.next_sequence - 1);
  }
  // Fallback: sequential integer within project
  const seq = existingRfis.length + 1;
  return `RFI-${String(seq).padStart(4, "0")}`;
}

export async function listRfis(
  repo: EngineeringRepository,
  accessToken: string,
  projectId: string,
  status?: RfiStatus,
): Promise<Rfi[]> {
  return repo.listRfis(accessToken, projectId, status);
}

export async function getRfi(
  repo: EngineeringRepository,
  accessToken: string,
  id: string,
): Promise<Rfi> {
  const rfi = await repo.getRfi(accessToken, id);
  if (!rfi) throw new NotFoundError("Rfi", id);
  return rfi;
}

export async function createRfi(
  repo: EngineeringRepository,
  masterDataRepo: MasterDataRepository,
  accessToken: string,
  projectId: string,
  input: Omit<CreateRfiInput, "rfi_number" | "project_id">,
): Promise<Rfi> {
  const existing = await repo.listRfis(accessToken, projectId);
  const rfi_number = await nextRfiNumber(masterDataRepo, accessToken, projectId, existing);
  return repo.createRfi(accessToken, { ...input, project_id: projectId, rfi_number });
}

export async function updateRfi(
  repo: EngineeringRepository,
  accessToken: string,
  id: string,
  input: UpdateRfiInput,
): Promise<Rfi> {
  const rfi = await repo.updateRfi(accessToken, id, input);
  if (!rfi) throw new NotFoundError("Rfi", id);
  return rfi;
}

// ---- IFC register service -----------------------------------------------

export async function listIFCRegister(
  repo: EngineeringRepository,
  accessToken: string,
  projectId: string,
): Promise<IFCRegisterRow[]> {
  return repo.listIFCRegister(accessToken, projectId);
}

// ---- As-built service ---------------------------------------------------

export async function listAsBuilt(
  repo: EngineeringRepository,
  accessToken: string,
  projectId: string,
): Promise<AsBuiltRecord[]> {
  return repo.listAsBuilt(accessToken, projectId);
}

export async function createAsBuilt(
  repo: EngineeringRepository,
  accessToken: string,
  input: CreateAsBuiltInput,
): Promise<AsBuiltRecord> {
  return repo.createAsBuilt(accessToken, input);
}

export async function updateAsBuilt(
  repo: EngineeringRepository,
  accessToken: string,
  id: string,
  input: UpdateAsBuiltInput,
): Promise<AsBuiltRecord> {
  const record = await repo.updateAsBuilt(accessToken, id, input);
  if (!record) throw new NotFoundError("AsBuiltRecord", id);
  return record;
}
