import type {
  AddGrnItemInput,
  AddMaterialIssueItemInput,
  CreateGatePassInput,
  CreateGrnInput,
  CreateInventoryItemInput,
  CreateMaterialIssueInput,
  CreateStoreLocationInput,
  InventoryRepository,
  UpdateGatePassInput,
  UpdateGrnInput,
  UpdateInventoryItemInput,
  UpdateMaterialIssueInput,
  UpdateStoreLocationInput,
} from "./repository.js";
import type {
  GoodsReceivedNote,
  GrnDetail,
  GrnItem,
  InventoryCategory,
  InventoryItem,
  InventoryStockBalance,
  MaterialGatePass,
  MaterialIssueDetail,
  MaterialIssueItem,
  MaterialIssueNote,
  StoreLocation,
} from "./types.js";

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} with id '${id}' not found`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

// ===========================================================================
// STORE LOCATIONS
// ===========================================================================

export async function createStoreLocation(
  repo: InventoryRepository,
  accessToken: string,
  input: CreateStoreLocationInput,
): Promise<StoreLocation> {
  if (!input.code || !input.code.trim()) {
    throw new ValidationError("Location code is required");
  }
  if (!input.name || !input.name.trim()) {
    throw new ValidationError("Location name is required");
  }
  return repo.createStoreLocation(accessToken, {
    ...input,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
  });
}

export async function getStoreLocation(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
): Promise<StoreLocation> {
  const loc = await repo.getStoreLocation(accessToken, id);
  if (!loc) throw new NotFoundError("StoreLocation", id);
  return loc;
}

export async function listStoreLocations(
  repo: InventoryRepository,
  accessToken: string,
  projectId?: string,
): Promise<StoreLocation[]> {
  return repo.listStoreLocations(accessToken, projectId);
}

export async function updateStoreLocation(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
  input: UpdateStoreLocationInput,
): Promise<StoreLocation> {
  const updated = await repo.updateStoreLocation(accessToken, id, input);
  if (!updated) throw new NotFoundError("StoreLocation", id);
  return updated;
}

// ===========================================================================
// INVENTORY ITEMS
// ===========================================================================

export async function createInventoryItem(
  repo: InventoryRepository,
  accessToken: string,
  input: CreateInventoryItemInput,
): Promise<InventoryItem> {
  if (!input.item_code || !input.item_code.trim()) {
    throw new ValidationError("Item code is required");
  }
  if (!input.name || !input.name.trim()) {
    throw new ValidationError("Item name is required");
  }
  return repo.createInventoryItem(accessToken, {
    ...input,
    item_code: input.item_code.trim().toUpperCase(),
    name: input.name.trim(),
  });
}

export async function getInventoryItem(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
): Promise<InventoryItem> {
  const item = await repo.getInventoryItem(accessToken, id);
  if (!item) throw new NotFoundError("InventoryItem", id);
  return item;
}

export async function listInventoryItems(
  repo: InventoryRepository,
  accessToken: string,
  category?: InventoryCategory,
): Promise<InventoryItem[]> {
  return repo.listInventoryItems(accessToken, category);
}

export async function updateInventoryItem(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
  input: UpdateInventoryItemInput,
): Promise<InventoryItem> {
  const updated = await repo.updateInventoryItem(accessToken, id, input);
  if (!updated) throw new NotFoundError("InventoryItem", id);
  return updated;
}

// ===========================================================================
// STOCK BALANCES
// ===========================================================================

export async function listStockBalances(
  repo: InventoryRepository,
  accessToken: string,
  locationId?: string,
  itemId?: string,
): Promise<InventoryStockBalance[]> {
  return repo.listStockBalances(accessToken, locationId, itemId);
}

// ===========================================================================
// GOODS RECEIVED NOTES (GRN)
// ===========================================================================

export async function createGrn(
  repo: InventoryRepository,
  accessToken: string,
  input: CreateGrnInput,
): Promise<GoodsReceivedNote> {
  if (!input.project_id || !input.location_id || !input.grn_number) {
    throw new ValidationError("project_id, location_id, and grn_number are required");
  }
  await getStoreLocation(repo, accessToken, input.location_id);
  return repo.createGrn(accessToken, {
    ...input,
    grn_number: input.grn_number.trim(),
  });
}

export async function getGrn(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
): Promise<GoodsReceivedNote> {
  const grn = await repo.getGrn(accessToken, id);
  if (!grn) throw new NotFoundError("GoodsReceivedNote", id);
  return grn;
}

export async function getGrnDetail(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
): Promise<GrnDetail> {
  const detail = await repo.getGrnDetail(accessToken, id);
  if (!detail) throw new NotFoundError("GoodsReceivedNote", id);
  return detail;
}

export async function listGrns(
  repo: InventoryRepository,
  accessToken: string,
  projectId: string,
): Promise<GoodsReceivedNote[]> {
  return repo.listGrns(accessToken, projectId);
}

export async function addGrnItem(
  repo: InventoryRepository,
  accessToken: string,
  input: AddGrnItemInput,
): Promise<GrnItem> {
  const grn = await getGrn(repo, accessToken, input.grn_id);
  if (grn.status !== "draft" && grn.status !== "inspected") {
    throw new InvalidStateError("Items can only be added to a draft or inspected GRN");
  }
  await getInventoryItem(repo, accessToken, input.item_id);
  if (!input.quantity_delivered || input.quantity_delivered <= 0) {
    throw new ValidationError("quantity_delivered must be greater than 0");
  }

  const accepted = input.quantity_accepted ?? input.quantity_delivered;
  const rejected = input.quantity_rejected ?? 0;

  return repo.addGrnItem(accessToken, {
    ...input,
    quantity_accepted: accepted,
    quantity_rejected: rejected,
  });
}

export async function acceptGrn(
  repo: InventoryRepository,
  accessToken: string,
  grnId: string,
  inspectedBy?: string,
  inspectionNotes?: string,
): Promise<GoodsReceivedNote> {
  const detail = await getGrnDetail(repo, accessToken, grnId);
  if (detail.grn.status === "accepted") {
    throw new InvalidStateError("GRN is already accepted");
  }
  if (detail.items.length === 0) {
    throw new ValidationError("Cannot accept a GRN with no line items");
  }

  // Stock increment for each accepted item quantity into the store location
  for (const it of detail.items) {
    if (it.quantity_accepted > 0) {
      await repo.adjustStockBalance(
        accessToken,
        detail.grn.location_id,
        it.item_id,
        it.quantity_accepted,
        it.rack_bin,
      );
    }
  }

  const updated = await repo.updateGrn(accessToken, grnId, {
    status: "accepted",
    inspected_by: inspectedBy ?? detail.grn.inspected_by,
    inspection_notes: inspectionNotes ?? detail.grn.inspection_notes,
  });
  return updated!;
}

export async function rejectGrn(
  repo: InventoryRepository,
  accessToken: string,
  grnId: string,
  rejectionReason: string,
): Promise<GoodsReceivedNote> {
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new ValidationError("Rejection reason is required");
  }
  const grn = await getGrn(repo, accessToken, grnId);
  if (grn.status === "accepted") {
    throw new InvalidStateError("Cannot reject an already accepted GRN");
  }
  const updated = await repo.updateGrn(accessToken, grnId, {
    status: "rejected",
    general_notes: `[REJECTED]: ${rejectionReason}`,
  });
  return updated!;
}

// ===========================================================================
// MATERIAL ISSUE NOTES (MIN)
// ===========================================================================

export async function createMaterialIssue(
  repo: InventoryRepository,
  accessToken: string,
  input: CreateMaterialIssueInput,
): Promise<MaterialIssueNote> {
  if (!input.project_id || !input.location_id || !input.issue_number || !input.issued_to) {
    throw new ValidationError("project_id, location_id, issue_number, and issued_to are required");
  }
  await getStoreLocation(repo, accessToken, input.location_id);
  return repo.createMaterialIssue(accessToken, {
    ...input,
    issue_number: input.issue_number.trim(),
    issued_to: input.issued_to.trim(),
  });
}

export async function getMaterialIssue(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
): Promise<MaterialIssueNote> {
  const issue = await repo.getMaterialIssue(accessToken, id);
  if (!issue) throw new NotFoundError("MaterialIssueNote", id);
  return issue;
}

export async function getMaterialIssueDetail(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
): Promise<MaterialIssueDetail> {
  const detail = await repo.getMaterialIssueDetail(accessToken, id);
  if (!detail) throw new NotFoundError("MaterialIssueNote", id);
  return detail;
}

export async function listMaterialIssues(
  repo: InventoryRepository,
  accessToken: string,
  projectId: string,
): Promise<MaterialIssueNote[]> {
  return repo.listMaterialIssues(accessToken, projectId);
}

export async function addMaterialIssueItem(
  repo: InventoryRepository,
  accessToken: string,
  input: AddMaterialIssueItemInput,
): Promise<MaterialIssueItem> {
  const issue = await getMaterialIssue(repo, accessToken, input.issue_id);
  if (issue.status !== "draft") {
    throw new InvalidStateError("Items can only be added to a draft Material Issue Note");
  }
  await getInventoryItem(repo, accessToken, input.item_id);
  if (!input.quantity_issued || input.quantity_issued <= 0) {
    throw new ValidationError("quantity_issued must be greater than 0");
  }
  return repo.addMaterialIssueItem(accessToken, input);
}

export async function issueMaterial(
  repo: InventoryRepository,
  accessToken: string,
  issueId: string,
): Promise<MaterialIssueNote> {
  const detail = await getMaterialIssueDetail(repo, accessToken, issueId);
  if (detail.issue.status === "issued") {
    throw new InvalidStateError("Material Issue Note is already issued");
  }
  if (detail.items.length === 0) {
    throw new ValidationError("Cannot issue empty Material Issue Note");
  }

  // Deduct stock for each line item
  for (const it of detail.items) {
    await repo.adjustStockBalance(
      accessToken,
      detail.issue.location_id,
      it.item_id,
      -it.quantity_issued,
      it.rack_bin,
    );
  }

  const updated = await repo.updateMaterialIssue(accessToken, issueId, { status: "issued" });
  return updated!;
}

// ===========================================================================
// MATERIAL GATE PASSES
// ===========================================================================

export async function createGatePass(
  repo: InventoryRepository,
  accessToken: string,
  input: CreateGatePassInput,
): Promise<MaterialGatePass> {
  if (!input.project_id || !input.pass_number || !input.vehicle_number || !input.driver_name || !input.destination) {
    throw new ValidationError("project_id, pass_number, vehicle_number, driver_name, and destination are required");
  }
  return repo.createGatePass(accessToken, {
    ...input,
    pass_number: input.pass_number.trim(),
    vehicle_number: input.vehicle_number.trim(),
    driver_name: input.driver_name.trim(),
    destination: input.destination.trim(),
  });
}

export async function getGatePass(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
): Promise<MaterialGatePass> {
  const pass = await repo.getGatePass(accessToken, id);
  if (!pass) throw new NotFoundError("MaterialGatePass", id);
  return pass;
}

export async function listGatePasses(
  repo: InventoryRepository,
  accessToken: string,
  projectId: string,
): Promise<MaterialGatePass[]> {
  return repo.listGatePasses(accessToken, projectId);
}

export async function approveGatePass(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
  authorizedBy: string,
): Promise<MaterialGatePass> {
  await getGatePass(repo, accessToken, id);
  const updated = await repo.updateGatePass(accessToken, id, {
    status: "approved",
    authorized_by: authorizedBy,
  });
  return updated!;
}

export async function dispatchGatePass(
  repo: InventoryRepository,
  accessToken: string,
  id: string,
): Promise<MaterialGatePass> {
  const pass = await getGatePass(repo, accessToken, id);
  if (pass.status !== "approved") {
    throw new InvalidStateError("Only approved gate passes can be dispatched");
  }
  const updated = await repo.updateGatePass(accessToken, id, {
    status: "dispatched",
    exit_time: new Date().toISOString(),
  });
  return updated!;
}
