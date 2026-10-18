import type {
  AddPurchaseOrderItemInput,
  AddRequisitionItemInput,
  AddRfqVendorInput,
  CreatePurchaseOrderInput,
  CreateRequisitionInput,
  CreateRfqInput,
  CreateVendorInput,
  ProcurementRepository,
  UpdatePurchaseOrderInput,
  UpdatePurchaseOrderItemInput,
  UpdateRequisitionInput,
  UpdateRfqInput,
  UpdateRfqVendorInput,
  UpdateVendorInput,
} from "./repository.js";
import type {
  PoStatus,
  PurchaseOrder,
  PurchaseOrderDetail,
  PurchaseOrderItem,
  PurchaseRequisition,
  PurchaseRequisitionDetail,
  PurchaseRequisitionItem,
  RequisitionPriority,
  RequisitionStatus,
  RfqDetail,
  RfqPackage,
  RfqVendorQuote,
  Vendor,
  VendorCategory,
  VendorStatus,
} from "./types.js";

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ===========================================================================
// VENDORS
// ===========================================================================

export async function createVendor(
  repo: ProcurementRepository,
  accessToken: string,
  input: CreateVendorInput,
): Promise<Vendor> {
  if (!input.name || !input.name.trim()) {
    throw new ValidationError("Vendor name is required");
  }
  return repo.createVendor(accessToken, {
    ...input,
    name: input.name.trim(),
  });
}

export async function getVendor(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<Vendor> {
  const vendor = await repo.getVendor(accessToken, id);
  if (!vendor) throw new NotFoundError("Vendor", id);
  return vendor;
}

export async function listVendors(
  repo: ProcurementRepository,
  accessToken: string,
  filters?: { category?: VendorCategory; status?: VendorStatus; search?: string },
): Promise<Vendor[]> {
  return repo.listVendors(accessToken, filters);
}

export async function updateVendor(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
  input: UpdateVendorInput,
): Promise<Vendor> {
  const updated = await repo.updateVendor(accessToken, id, input);
  if (!updated) throw new NotFoundError("Vendor", id);
  return updated;
}

// ===========================================================================
// PURCHASE REQUISITIONS (PR)
// ===========================================================================

export async function createRequisition(
  repo: ProcurementRepository,
  accessToken: string,
  input: CreateRequisitionInput,
): Promise<PurchaseRequisition> {
  if (!input.project_id || !input.pr_number || !input.title || !input.required_date) {
    throw new ValidationError("project_id, pr_number, title, and required_date are required");
  }
  return repo.createRequisition(accessToken, {
    ...input,
    pr_number: input.pr_number.trim(),
    title: input.title.trim(),
  });
}

export async function getRequisition(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<PurchaseRequisition> {
  const req = await repo.getRequisition(accessToken, id);
  if (!req) throw new NotFoundError("PurchaseRequisition", id);
  return req;
}

export async function getRequisitionDetail(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<PurchaseRequisitionDetail> {
  const requisition = await getRequisition(repo, accessToken, id);
  const items = await repo.listRequisitionItems(accessToken, id);
  return { requisition, items };
}

export async function listRequisitions(
  repo: ProcurementRepository,
  accessToken: string,
  projectId: string,
  filters?: { status?: RequisitionStatus; priority?: RequisitionPriority },
): Promise<PurchaseRequisition[]> {
  return repo.listRequisitions(accessToken, projectId, filters);
}

export async function updateRequisition(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
  input: UpdateRequisitionInput,
): Promise<PurchaseRequisition> {
  const existing = await getRequisition(repo, accessToken, id);
  if (existing.status === "approved" || existing.status === "ordered") {
    throw new InvalidStateError(`Cannot modify requisition with status: ${existing.status}`);
  }
  const updated = await repo.updateRequisition(accessToken, id, input);
  if (!updated) throw new NotFoundError("PurchaseRequisition", id);
  return updated;
}

export async function deleteRequisition(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<void> {
  const existing = await getRequisition(repo, accessToken, id);
  if (existing.status !== "draft") {
    throw new InvalidStateError(`Only draft requisitions can be deleted (status: ${existing.status})`);
  }
  await repo.deleteRequisition(accessToken, id);
}

export async function submitRequisition(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<PurchaseRequisition> {
  const existing = await getRequisition(repo, accessToken, id);
  if (existing.status !== "draft" && existing.status !== "rejected") {
    throw new InvalidStateError(`Only draft or rejected requisitions can be submitted`);
  }
  const items = await repo.listRequisitionItems(accessToken, id);
  if (items.length === 0) {
    throw new ValidationError("Requisition must have at least one line item before submitting");
  }
  const updated = await repo.updateRequisition(accessToken, id, {
    status: "submitted",
    rejection_reason: null,
  });
  if (!updated) throw new NotFoundError("PurchaseRequisition", id);
  return updated;
}

export async function approveRequisition(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
  approvedBy: string,
): Promise<PurchaseRequisition> {
  const existing = await getRequisition(repo, accessToken, id);
  if (existing.status !== "submitted") {
    throw new InvalidStateError("Only submitted requisitions can be approved");
  }
  const now = new Date().toISOString();
  const updated = await repo.updateRequisition(accessToken, id, {
    status: "approved",
    approved_at: now,
    approved_by: approvedBy,
    rejection_reason: null,
  });
  if (!updated) throw new NotFoundError("PurchaseRequisition", id);
  return updated;
}

export async function rejectRequisition(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
  rejectionReason: string,
): Promise<PurchaseRequisition> {
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new ValidationError("Rejection reason is required");
  }
  const existing = await getRequisition(repo, accessToken, id);
  if (existing.status !== "submitted") {
    throw new InvalidStateError("Only submitted requisitions can be rejected");
  }
  const updated = await repo.updateRequisition(accessToken, id, {
    status: "rejected",
    rejection_reason: rejectionReason.trim(),
  });
  if (!updated) throw new NotFoundError("PurchaseRequisition", id);
  return updated;
}

export async function addRequisitionItem(
  repo: ProcurementRepository,
  accessToken: string,
  input: AddRequisitionItemInput,
): Promise<PurchaseRequisitionItem> {
  const req = await getRequisition(repo, accessToken, input.requisition_id);
  if (req.status !== "draft" && req.status !== "rejected") {
    throw new InvalidStateError("Line items can only be added to draft or rejected requisitions");
  }
  if (!input.item_description || !input.item_description.trim()) {
    throw new ValidationError("Item description is required");
  }
  if (!input.quantity || input.quantity <= 0) {
    throw new ValidationError("Quantity must be greater than 0");
  }
  const unitRate = input.estimated_unit_rate ?? 0;
  const lineTotal = input.estimated_total_amount ?? (input.quantity * unitRate);

  const item = await repo.addRequisitionItem(accessToken, {
    ...input,
    estimated_unit_rate: unitRate,
    estimated_total_amount: lineTotal,
  });

  // Recompute requisition total
  const allItems = await repo.listRequisitionItems(accessToken, req.id);
  const newTotal = allItems.reduce((sum, it) => sum + it.estimated_total_amount, 0);
  await repo.updateRequisition(accessToken, req.id, { total_estimated_amount: newTotal });

  return item;
}

export async function removeRequisitionItem(
  repo: ProcurementRepository,
  accessToken: string,
  requisitionId: string,
  itemId: string,
): Promise<void> {
  const req = await getRequisition(repo, accessToken, requisitionId);
  if (req.status !== "draft" && req.status !== "rejected") {
    throw new InvalidStateError("Line items can only be removed from draft or rejected requisitions");
  }
  const removed = await repo.removeRequisitionItem(accessToken, itemId);
  if (!removed) throw new NotFoundError("PurchaseRequisitionItem", itemId);

  // Recompute total
  const allItems = await repo.listRequisitionItems(accessToken, req.id);
  const newTotal = allItems.reduce((sum, it) => sum + it.estimated_total_amount, 0);
  await repo.updateRequisition(accessToken, req.id, { total_estimated_amount: newTotal });
}

// ===========================================================================
// RFQ PACKAGES
// ===========================================================================

export async function createRfq(
  repo: ProcurementRepository,
  accessToken: string,
  input: CreateRfqInput,
): Promise<RfqPackage> {
  if (!input.project_id || !input.rfq_number || !input.title || !input.issue_date || !input.due_date) {
    throw new ValidationError("project_id, rfq_number, title, issue_date, and due_date are required");
  }
  return repo.createRfq(accessToken, input);
}

export async function getRfq(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<RfqPackage> {
  const rfq = await repo.getRfq(accessToken, id);
  if (!rfq) throw new NotFoundError("RfqPackage", id);
  return rfq;
}

export async function getRfqDetail(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<RfqDetail> {
  const rfq = await getRfq(repo, accessToken, id);
  const vendorQuotes = await repo.listRfqVendors(accessToken, id);
  return { rfq, vendorQuotes };
}

export async function listRfqs(
  repo: ProcurementRepository,
  accessToken: string,
  projectId: string,
): Promise<RfqPackage[]> {
  return repo.listRfqs(accessToken, projectId);
}

export async function updateRfq(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
  input: UpdateRfqInput,
): Promise<RfqPackage> {
  const updated = await repo.updateRfq(accessToken, id, input);
  if (!updated) throw new NotFoundError("RfqPackage", id);
  return updated;
}

export async function addRfqVendor(
  repo: ProcurementRepository,
  accessToken: string,
  input: AddRfqVendorInput,
): Promise<RfqVendorQuote> {
  await getRfq(repo, accessToken, input.rfq_id);
  await getVendor(repo, accessToken, input.vendor_id);
  return repo.addRfqVendor(accessToken, input);
}

export async function updateRfqVendor(
  repo: ProcurementRepository,
  accessToken: string,
  quoteId: string,
  input: UpdateRfqVendorInput,
): Promise<RfqVendorQuote> {
  const updated = await repo.updateRfqVendor(accessToken, quoteId, input);
  if (!updated) throw new NotFoundError("RfqVendorQuote", quoteId);
  return updated;
}

// ===========================================================================
// PURCHASE ORDERS (PO)
// ===========================================================================

export async function createPurchaseOrder(
  repo: ProcurementRepository,
  accessToken: string,
  input: CreatePurchaseOrderInput,
): Promise<PurchaseOrder> {
  if (!input.project_id || !input.vendor_id || !input.po_number || !input.order_date) {
    throw new ValidationError("project_id, vendor_id, po_number, and order_date are required");
  }
  const vendor = await getVendor(repo, accessToken, input.vendor_id);
  if (vendor.status === "blacklisted" || vendor.status === "suspended") {
    throw new ValidationError(`Cannot issue PO to vendor with status '${vendor.status}'`);
  }
  return repo.createPurchaseOrder(accessToken, {
    ...input,
    po_number: input.po_number.trim(),
  });
}

export async function getPurchaseOrder(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<PurchaseOrder> {
  const po = await repo.getPurchaseOrder(accessToken, id);
  if (!po) throw new NotFoundError("PurchaseOrder", id);
  return po;
}

export async function getPurchaseOrderDetail(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<PurchaseOrderDetail> {
  const order = await getPurchaseOrder(repo, accessToken, id);
  const items = await repo.listPurchaseOrderItems(accessToken, id);
  const vendor = await repo.getVendor(accessToken, order.vendor_id);
  return { order, items, vendor };
}

export async function listPurchaseOrders(
  repo: ProcurementRepository,
  accessToken: string,
  projectId: string,
  filters?: { status?: PoStatus; vendorId?: string },
): Promise<PurchaseOrder[]> {
  return repo.listPurchaseOrders(accessToken, projectId, filters);
}

export async function updatePurchaseOrder(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
  input: UpdatePurchaseOrderInput,
): Promise<PurchaseOrder> {
  const existing = await getPurchaseOrder(repo, accessToken, id);
  if (existing.status === "closed" || existing.status === "cancelled") {
    throw new InvalidStateError(`Cannot modify a ${existing.status} Purchase Order`);
  }
  const updated = await repo.updatePurchaseOrder(accessToken, id, input);
  if (!updated) throw new NotFoundError("PurchaseOrder", id);
  return updated;
}

export async function issuePurchaseOrder(
  repo: ProcurementRepository,
  accessToken: string,
  id: string,
): Promise<PurchaseOrder> {
  const existing = await getPurchaseOrder(repo, accessToken, id);
  if (existing.status !== "draft") {
    throw new InvalidStateError(`Only draft Purchase Orders can be issued (status: ${existing.status})`);
  }
  const items = await repo.listPurchaseOrderItems(accessToken, id);
  if (items.length === 0) {
    throw new ValidationError("Purchase Order must have at least one line item before being issued");
  }
  const updated = await repo.updatePurchaseOrder(accessToken, id, { status: "issued" });
  if (!updated) throw new NotFoundError("PurchaseOrder", id);

  // If created from requisition, mark requisition ordered
  if (existing.requisition_id) {
    await repo.updateRequisition(accessToken, existing.requisition_id, { status: "ordered" });
  }

  return updated;
}

export async function addPurchaseOrderItem(
  repo: ProcurementRepository,
  accessToken: string,
  input: AddPurchaseOrderItemInput,
): Promise<PurchaseOrderItem> {
  const po = await getPurchaseOrder(repo, accessToken, input.po_id);
  if (po.status !== "draft") {
    throw new InvalidStateError("Items can only be added to a draft Purchase Order");
  }
  if (!input.item_description || !input.item_description.trim()) {
    throw new ValidationError("Item description is required");
  }
  if (!input.quantity || input.quantity <= 0) {
    throw new ValidationError("Quantity must be greater than 0");
  }
  const lineTotal = input.total_amount ?? (input.quantity * input.unit_price);
  const item = await repo.addPurchaseOrderItem(accessToken, {
    ...input,
    total_amount: lineTotal,
  });

  // Recompute PO subtotal, tax (standard 5% UAE VAT), total
  const allItems = await repo.listPurchaseOrderItems(accessToken, po.id);
  const subtotal = allItems.reduce((sum, it) => sum + Number(it.total_amount), 0);
  const tax = Number((subtotal * 0.05).toFixed(2));
  const total = Number((subtotal + tax).toFixed(2));
  await repo.updatePurchaseOrder(accessToken, po.id, {
    subtotal_amount: subtotal,
    tax_amount: tax,
    total_amount: total,
  });

  return item;
}

export async function updatePurchaseOrderItemDelivery(
  repo: ProcurementRepository,
  accessToken: string,
  poId: string,
  itemId: string,
  input: UpdatePurchaseOrderItemInput,
): Promise<PurchaseOrderItem> {
  await getPurchaseOrder(repo, accessToken, poId);
  const updated = await repo.updatePurchaseOrderItem(accessToken, itemId, input);
  if (!updated) throw new NotFoundError("PurchaseOrderItem", itemId);

  // Check if all items delivered
  const allItems = await repo.listPurchaseOrderItems(accessToken, poId);
  const allDelivered = allItems.length > 0 && allItems.every((it) => it.delivery_status === "delivered");
  const anyDelivered = allItems.some((it) => it.delivery_status === "delivered" || it.delivery_status === "partial");

  if (allDelivered) {
    await repo.updatePurchaseOrder(accessToken, poId, { status: "delivered" });
  } else if (anyDelivered) {
    await repo.updatePurchaseOrder(accessToken, poId, { status: "partially_delivered" });
  }

  return updated;
}
