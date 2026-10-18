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
} from "../modules/procurement/repository.js";
import type {
  PoStatus,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseRequisition,
  PurchaseRequisitionItem,
  RequisitionPriority,
  RequisitionStatus,
  RfqPackage,
  RfqVendorQuote,
  Vendor,
  VendorCategory,
  VendorStatus,
} from "../modules/procurement/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export class FakeProcurementRepository implements ProcurementRepository {
  sessions = new Map<string, { userId?: string; tenantId: string }>();
  vendors = new Map<string, Vendor>();
  requisitions = new Map<string, PurchaseRequisition>();
  requisitionItems = new Map<string, PurchaseRequisitionItem>();
  rfqPackages = new Map<string, RfqPackage>();
  rfqVendors = new Map<string, RfqVendorQuote>();
  purchaseOrders = new Map<string, PurchaseOrder>();
  purchaseOrderItems = new Map<string, PurchaseOrderItem>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private tenantOf(accessToken: string): string {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context.tenantId;
  }

  // Vendors
  async createVendor(accessToken: string, input: CreateVendorInput): Promise<Vendor> {
    const tenantId = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const vendor: Vendor = {
      id: nextId("vendor"),
      tenant_id: tenantId,
      name: input.name,
      trade_license_number: input.trade_license_number ?? null,
      tax_registration_number: input.tax_registration_number ?? null,
      contact_person: input.contact_person ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      category: input.category ?? "materials",
      rating: input.rating ?? 5.0,
      status: input.status ?? "active",
      created_at: now,
      updated_at: now,
    };
    this.vendors.set(vendor.id, vendor);
    return vendor;
  }

  async getVendor(accessToken: string, id: string): Promise<Vendor | null> {
    const tenantId = this.tenantOf(accessToken);
    const vendor = this.vendors.get(id);
    if (!vendor || vendor.tenant_id !== tenantId) return null;
    return vendor;
  }

  async listVendors(
    accessToken: string,
    filters?: { category?: VendorCategory; status?: VendorStatus; search?: string },
  ): Promise<Vendor[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: Vendor[] = [];
    for (const v of this.vendors.values()) {
      if (v.tenant_id !== tenantId) continue;
      if (filters?.category && v.category !== filters.category) continue;
      if (filters?.status && v.status !== filters.status) continue;
      if (filters?.search && !v.name.toLowerCase().includes(filters.search.toLowerCase())) continue;
      results.push(v);
    }
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async updateVendor(accessToken: string, id: string, input: UpdateVendorInput): Promise<Vendor | null> {
    const vendor = await this.getVendor(accessToken, id);
    if (!vendor) return null;
    const updated: Vendor = {
      ...vendor,
      ...input,
      updated_at: new Date().toISOString(),
    };
    this.vendors.set(id, updated);
    return updated;
  }

  // Requisitions
  async createRequisition(accessToken: string, input: CreateRequisitionInput): Promise<PurchaseRequisition> {
    const tenantId = this.tenantOf(accessToken);
    for (const r of this.requisitions.values()) {
      if (r.tenant_id === tenantId && r.project_id === input.project_id && r.pr_number === input.pr_number) {
        throw new Error("PR number already exists in this project");
      }
    }
    const now = new Date().toISOString();
    const req: PurchaseRequisition = {
      id: nextId("pr"),
      tenant_id: tenantId,
      project_id: input.project_id,
      pr_number: input.pr_number,
      title: input.title,
      required_date: input.required_date,
      priority: input.priority ?? "normal",
      status: input.status ?? "draft",
      requested_by: input.requested_by ?? null,
      total_estimated_amount: input.total_estimated_amount ?? 0,
      currency: input.currency ?? "AED",
      notes: input.notes ?? null,
      approved_at: null,
      approved_by: null,
      rejection_reason: null,
      created_at: now,
      updated_at: now,
    };
    this.requisitions.set(req.id, req);
    return req;
  }

  async getRequisition(accessToken: string, id: string): Promise<PurchaseRequisition | null> {
    const tenantId = this.tenantOf(accessToken);
    const req = this.requisitions.get(id);
    if (!req || req.tenant_id !== tenantId) return null;
    return req;
  }

  async listRequisitions(
    accessToken: string,
    projectId: string,
    filters?: { status?: RequisitionStatus; priority?: RequisitionPriority },
  ): Promise<PurchaseRequisition[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: PurchaseRequisition[] = [];
    for (const r of this.requisitions.values()) {
      if (r.tenant_id !== tenantId || r.project_id !== projectId) continue;
      if (filters?.status && r.status !== filters.status) continue;
      if (filters?.priority && r.priority !== filters.priority) continue;
      results.push(r);
    }
    return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async updateRequisition(
    accessToken: string,
    id: string,
    input: UpdateRequisitionInput,
  ): Promise<PurchaseRequisition | null> {
    const req = await this.getRequisition(accessToken, id);
    if (!req) return null;
    const updated: PurchaseRequisition = {
      ...req,
      ...input,
      updated_at: new Date().toISOString(),
    };
    this.requisitions.set(id, updated);
    return updated;
  }

  async deleteRequisition(accessToken: string, id: string): Promise<boolean> {
    const req = await this.getRequisition(accessToken, id);
    if (!req) return false;
    this.requisitions.delete(id);
    for (const [key, item] of this.requisitionItems.entries()) {
      if (item.requisition_id === id) this.requisitionItems.delete(key);
    }
    return true;
  }

  async addRequisitionItem(accessToken: string, input: AddRequisitionItemInput): Promise<PurchaseRequisitionItem> {
    const tenantId = this.tenantOf(accessToken);
    const item: PurchaseRequisitionItem = {
      id: nextId("pr-item"),
      tenant_id: tenantId,
      requisition_id: input.requisition_id,
      item_description: input.item_description,
      cost_code: input.cost_code ?? null,
      quantity: input.quantity,
      uom: input.uom,
      estimated_unit_rate: input.estimated_unit_rate ?? 0,
      estimated_total_amount: input.estimated_total_amount ?? (input.quantity * (input.estimated_unit_rate ?? 0)),
      schedule_activity_id: input.schedule_activity_id ?? null,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    this.requisitionItems.set(item.id, item);
    return item;
  }

  async listRequisitionItems(accessToken: string, requisitionId: string): Promise<PurchaseRequisitionItem[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: PurchaseRequisitionItem[] = [];
    for (const item of this.requisitionItems.values()) {
      if (item.tenant_id === tenantId && item.requisition_id === requisitionId) {
        results.push(item);
      }
    }
    return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async removeRequisitionItem(accessToken: string, id: string): Promise<boolean> {
    const tenantId = this.tenantOf(accessToken);
    const item = this.requisitionItems.get(id);
    if (!item || item.tenant_id !== tenantId) return false;
    this.requisitionItems.delete(id);
    return true;
  }

  // RFQ
  async createRfq(accessToken: string, input: CreateRfqInput): Promise<RfqPackage> {
    const tenantId = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const rfq: RfqPackage = {
      id: nextId("rfq"),
      tenant_id: tenantId,
      project_id: input.project_id,
      requisition_id: input.requisition_id ?? null,
      rfq_number: input.rfq_number,
      title: input.title,
      issue_date: input.issue_date,
      due_date: input.due_date,
      status: input.status ?? "draft",
      scope_summary: input.scope_summary ?? null,
      created_at: now,
      updated_at: now,
    };
    this.rfqPackages.set(rfq.id, rfq);
    return rfq;
  }

  async getRfq(accessToken: string, id: string): Promise<RfqPackage | null> {
    const tenantId = this.tenantOf(accessToken);
    const rfq = this.rfqPackages.get(id);
    if (!rfq || rfq.tenant_id !== tenantId) return null;
    return rfq;
  }

  async listRfqs(accessToken: string, projectId: string): Promise<RfqPackage[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: RfqPackage[] = [];
    for (const rfq of this.rfqPackages.values()) {
      if (rfq.tenant_id === tenantId && rfq.project_id === projectId) {
        results.push(rfq);
      }
    }
    return results.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async updateRfq(accessToken: string, id: string, input: UpdateRfqInput): Promise<RfqPackage | null> {
    const rfq = await this.getRfq(accessToken, id);
    if (!rfq) return null;
    const updated: RfqPackage = {
      ...rfq,
      ...input,
      updated_at: new Date().toISOString(),
    };
    this.rfqPackages.set(id, updated);
    return updated;
  }

  async addRfqVendor(accessToken: string, input: AddRfqVendorInput): Promise<RfqVendorQuote> {
    const tenantId = this.tenantOf(accessToken);
    const vendor = this.vendors.get(input.vendor_id);
    const quote: RfqVendorQuote = {
      id: nextId("rfq-vendor"),
      tenant_id: tenantId,
      rfq_id: input.rfq_id,
      vendor_id: input.vendor_id,
      vendor_name: vendor?.name,
      quoted_amount: input.quoted_amount ?? null,
      submission_date: input.submission_date ?? null,
      compliance_status: input.compliance_status ?? "compliant",
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    this.rfqVendors.set(quote.id, quote);
    return quote;
  }

  async listRfqVendors(accessToken: string, rfqId: string): Promise<RfqVendorQuote[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: RfqVendorQuote[] = [];
    for (const q of this.rfqVendors.values()) {
      if (q.tenant_id === tenantId && q.rfq_id === rfqId) {
        const vendor = this.vendors.get(q.vendor_id);
        results.push({ ...q, vendor_name: vendor?.name });
      }
    }
    return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async updateRfqVendor(accessToken: string, id: string, input: UpdateRfqVendorInput): Promise<RfqVendorQuote | null> {
    const tenantId = this.tenantOf(accessToken);
    const quote = this.rfqVendors.get(id);
    if (!quote || quote.tenant_id !== tenantId) return null;
    const updated: RfqVendorQuote = {
      ...quote,
      ...input,
    };
    this.rfqVendors.set(id, updated);
    return updated;
  }

  // Purchase Orders
  async createPurchaseOrder(accessToken: string, input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
    const tenantId = this.tenantOf(accessToken);
    const vendor = this.vendors.get(input.vendor_id);
    const now = new Date().toISOString();
    const po: PurchaseOrder = {
      id: nextId("po"),
      tenant_id: tenantId,
      project_id: input.project_id,
      vendor_id: input.vendor_id,
      vendor_name: vendor?.name,
      requisition_id: input.requisition_id ?? null,
      rfq_id: input.rfq_id ?? null,
      po_number: input.po_number,
      order_date: input.order_date,
      expected_delivery_date: input.expected_delivery_date ?? null,
      delivery_address: input.delivery_address ?? null,
      payment_terms: input.payment_terms ?? null,
      status: input.status ?? "draft",
      subtotal_amount: input.subtotal_amount ?? 0,
      tax_amount: input.tax_amount ?? 0,
      total_amount: input.total_amount ?? 0,
      currency: input.currency ?? "AED",
      approved_by: null,
      approved_at: null,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };
    this.purchaseOrders.set(po.id, po);
    return po;
  }

  async getPurchaseOrder(accessToken: string, id: string): Promise<PurchaseOrder | null> {
    const tenantId = this.tenantOf(accessToken);
    const po = this.purchaseOrders.get(id);
    if (!po || po.tenant_id !== tenantId) return null;
    const vendor = this.vendors.get(po.vendor_id);
    return { ...po, vendor_name: vendor?.name };
  }

  async listPurchaseOrders(
    accessToken: string,
    projectId: string,
    filters?: { status?: PoStatus; vendorId?: string },
  ): Promise<PurchaseOrder[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: PurchaseOrder[] = [];
    for (const po of this.purchaseOrders.values()) {
      if (po.tenant_id !== tenantId || po.project_id !== projectId) continue;
      if (filters?.status && po.status !== filters.status) continue;
      if (filters?.vendorId && po.vendor_id !== filters.vendorId) continue;
      const vendor = this.vendors.get(po.vendor_id);
      results.push({ ...po, vendor_name: vendor?.name });
    }
    return results.sort((a, b) => b.order_date.localeCompare(a.order_date));
  }

  async updatePurchaseOrder(
    accessToken: string,
    id: string,
    input: UpdatePurchaseOrderInput,
  ): Promise<PurchaseOrder | null> {
    const po = await this.getPurchaseOrder(accessToken, id);
    if (!po) return null;
    const updated: PurchaseOrder = {
      ...po,
      ...input,
      updated_at: new Date().toISOString(),
    };
    this.purchaseOrders.set(id, updated);
    return updated;
  }

  async addPurchaseOrderItem(accessToken: string, input: AddPurchaseOrderItemInput): Promise<PurchaseOrderItem> {
    const tenantId = this.tenantOf(accessToken);
    const item: PurchaseOrderItem = {
      id: nextId("po-item"),
      tenant_id: tenantId,
      po_id: input.po_id,
      item_description: input.item_description,
      quantity: input.quantity,
      uom: input.uom,
      unit_price: input.unit_price,
      total_amount: input.total_amount,
      delivery_status: input.delivery_status ?? "pending",
      created_at: new Date().toISOString(),
    };
    this.purchaseOrderItems.set(item.id, item);
    return item;
  }

  async listPurchaseOrderItems(accessToken: string, poId: string): Promise<PurchaseOrderItem[]> {
    const tenantId = this.tenantOf(accessToken);
    const results: PurchaseOrderItem[] = [];
    for (const item of this.purchaseOrderItems.values()) {
      if (item.tenant_id === tenantId && item.po_id === poId) {
        results.push(item);
      }
    }
    return results.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async updatePurchaseOrderItem(
    accessToken: string,
    id: string,
    input: UpdatePurchaseOrderItemInput,
  ): Promise<PurchaseOrderItem | null> {
    const tenantId = this.tenantOf(accessToken);
    const item = this.purchaseOrderItems.get(id);
    if (!item || item.tenant_id !== tenantId) return null;
    const updated: PurchaseOrderItem = {
      ...item,
      ...input,
    };
    this.purchaseOrderItems.set(id, updated);
    return updated;
  }

  async removePurchaseOrderItem(accessToken: string, id: string): Promise<boolean> {
    const tenantId = this.tenantOf(accessToken);
    const item = this.purchaseOrderItems.get(id);
    if (!item || item.tenant_id !== tenantId) return false;
    this.purchaseOrderItems.delete(id);
    return true;
  }
}
