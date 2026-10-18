import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PoItemDeliveryStatus,
  PoStatus,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseRequisition,
  PurchaseRequisitionItem,
  RequisitionPriority,
  RequisitionStatus,
  RfqComplianceStatus,
  RfqPackage,
  RfqStatus,
  RfqVendorQuote,
  Vendor,
  VendorCategory,
  VendorStatus,
} from "./types.js";

// ---- Vendor Inputs --------------------------------------------------------

export interface CreateVendorInput {
  name: string;
  trade_license_number?: string | null;
  tax_registration_number?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  category?: VendorCategory;
  rating?: number;
  status?: VendorStatus;
}

export interface UpdateVendorInput {
  name?: string;
  trade_license_number?: string | null;
  tax_registration_number?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  category?: VendorCategory;
  rating?: number;
  status?: VendorStatus;
}

// ---- Requisition Inputs ---------------------------------------------------

export interface CreateRequisitionInput {
  project_id: string;
  pr_number: string;
  title: string;
  required_date: string;
  priority?: RequisitionPriority;
  status?: RequisitionStatus;
  requested_by?: string | null;
  total_estimated_amount?: number;
  currency?: string;
  notes?: string | null;
}

export interface UpdateRequisitionInput {
  title?: string;
  required_date?: string;
  priority?: RequisitionPriority;
  status?: RequisitionStatus;
  total_estimated_amount?: number;
  notes?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejection_reason?: string | null;
}

export interface AddRequisitionItemInput {
  requisition_id: string;
  item_description: string;
  cost_code?: string | null;
  quantity: number;
  uom: string;
  estimated_unit_rate?: number;
  estimated_total_amount?: number;
  schedule_activity_id?: string | null;
  notes?: string | null;
}

// ---- RFQ Inputs -----------------------------------------------------------

export interface CreateRfqInput {
  project_id: string;
  requisition_id?: string | null;
  rfq_number: string;
  title: string;
  issue_date: string;
  due_date: string;
  status?: RfqStatus;
  scope_summary?: string | null;
}

export interface UpdateRfqInput {
  title?: string;
  due_date?: string;
  status?: RfqStatus;
  scope_summary?: string | null;
}

export interface AddRfqVendorInput {
  rfq_id: string;
  vendor_id: string;
  quoted_amount?: number | null;
  submission_date?: string | null;
  compliance_status?: RfqComplianceStatus;
  notes?: string | null;
}

export interface UpdateRfqVendorInput {
  quoted_amount?: number | null;
  submission_date?: string | null;
  compliance_status?: RfqComplianceStatus;
  notes?: string | null;
}

// ---- Purchase Order Inputs ------------------------------------------------

export interface CreatePurchaseOrderInput {
  project_id: string;
  vendor_id: string;
  requisition_id?: string | null;
  rfq_id?: string | null;
  po_number: string;
  order_date: string;
  expected_delivery_date?: string | null;
  delivery_address?: string | null;
  payment_terms?: string | null;
  status?: PoStatus;
  subtotal_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  currency?: string;
  notes?: string | null;
}

export interface UpdatePurchaseOrderInput {
  expected_delivery_date?: string | null;
  delivery_address?: string | null;
  payment_terms?: string | null;
  status?: PoStatus;
  subtotal_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
}

export interface AddPurchaseOrderItemInput {
  po_id: string;
  item_description: string;
  quantity: number;
  uom: string;
  unit_price: number;
  total_amount: number;
  delivery_status?: PoItemDeliveryStatus;
}

export interface UpdatePurchaseOrderItemInput {
  quantity?: number;
  unit_price?: number;
  total_amount?: number;
  delivery_status?: PoItemDeliveryStatus;
}

// ---- Repository Interface -------------------------------------------------

export interface ProcurementRepository {
  // Vendors
  createVendor(accessToken: string, input: CreateVendorInput): Promise<Vendor>;
  getVendor(accessToken: string, id: string): Promise<Vendor | null>;
  listVendors(
    accessToken: string,
    filters?: { category?: VendorCategory; status?: VendorStatus; search?: string },
  ): Promise<Vendor[]>;
  updateVendor(accessToken: string, id: string, input: UpdateVendorInput): Promise<Vendor | null>;

  // Requisitions
  createRequisition(accessToken: string, input: CreateRequisitionInput): Promise<PurchaseRequisition>;
  getRequisition(accessToken: string, id: string): Promise<PurchaseRequisition | null>;
  listRequisitions(
    accessToken: string,
    projectId: string,
    filters?: { status?: RequisitionStatus; priority?: RequisitionPriority },
  ): Promise<PurchaseRequisition[]>;
  updateRequisition(accessToken: string, id: string, input: UpdateRequisitionInput): Promise<PurchaseRequisition | null>;
  deleteRequisition(accessToken: string, id: string): Promise<boolean>;

  addRequisitionItem(accessToken: string, input: AddRequisitionItemInput): Promise<PurchaseRequisitionItem>;
  listRequisitionItems(accessToken: string, requisitionId: string): Promise<PurchaseRequisitionItem[]>;
  removeRequisitionItem(accessToken: string, id: string): Promise<boolean>;

  // RFQ
  createRfq(accessToken: string, input: CreateRfqInput): Promise<RfqPackage>;
  getRfq(accessToken: string, id: string): Promise<RfqPackage | null>;
  listRfqs(accessToken: string, projectId: string): Promise<RfqPackage[]>;
  updateRfq(accessToken: string, id: string, input: UpdateRfqInput): Promise<RfqPackage | null>;

  addRfqVendor(accessToken: string, input: AddRfqVendorInput): Promise<RfqVendorQuote>;
  listRfqVendors(accessToken: string, rfqId: string): Promise<RfqVendorQuote[]>;
  updateRfqVendor(accessToken: string, id: string, input: UpdateRfqVendorInput): Promise<RfqVendorQuote | null>;

  // Purchase Orders
  createPurchaseOrder(accessToken: string, input: CreatePurchaseOrderInput): Promise<PurchaseOrder>;
  getPurchaseOrder(accessToken: string, id: string): Promise<PurchaseOrder | null>;
  listPurchaseOrders(
    accessToken: string,
    projectId: string,
    filters?: { status?: PoStatus; vendorId?: string },
  ): Promise<PurchaseOrder[]>;
  updatePurchaseOrder(accessToken: string, id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrder | null>;

  addPurchaseOrderItem(accessToken: string, input: AddPurchaseOrderItemInput): Promise<PurchaseOrderItem>;
  listPurchaseOrderItems(accessToken: string, poId: string): Promise<PurchaseOrderItem[]>;
  updatePurchaseOrderItem(accessToken: string, id: string, input: UpdatePurchaseOrderItemInput): Promise<PurchaseOrderItem | null>;
  removePurchaseOrderItem(accessToken: string, id: string): Promise<boolean>;
}

// ---- Supabase Implementation ----------------------------------------------

export function createSupabaseProcurementRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): ProcurementRepository {
  return {
    async createVendor(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("vendors").insert(input).select("*").single();
      if (error || !data) throw new Error(`createVendor: ${error?.message ?? "no row returned"}`);
      return data as Vendor;
    },

    async getVendor(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("vendors").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getVendor: ${error.message}`);
      return (data as Vendor | null) ?? null;
    },

    async listVendors(accessToken, filters) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("vendors").select("*").order("name", { ascending: true });
      if (filters?.category) query = query.eq("category", filters.category);
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.search) query = query.ilike("name", `%${filters.search}%`);
      const { data, error } = await query;
      if (error) throw new Error(`listVendors: ${error.message}`);
      return (data as Vendor[]) ?? [];
    },

    async updateVendor(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("vendors")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateVendor: ${error.message}`);
      return (data as Vendor | null) ?? null;
    },

    async createRequisition(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("purchase_requisitions").insert(input).select("*").single();
      if (error || !data) throw new Error(`createRequisition: ${error?.message ?? "no row returned"}`);
      return data as PurchaseRequisition;
    },

    async getRequisition(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("purchase_requisitions").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getRequisition: ${error.message}`);
      return (data as PurchaseRequisition | null) ?? null;
    },

    async listRequisitions(accessToken, projectId, filters) {
      const client = userScopedClientFactory(accessToken);
      let query = client
        .from("purchase_requisitions")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.priority) query = query.eq("priority", filters.priority);
      const { data, error } = await query;
      if (error) throw new Error(`listRequisitions: ${error.message}`);
      return (data as PurchaseRequisition[]) ?? [];
    },

    async updateRequisition(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("purchase_requisitions")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateRequisition: ${error.message}`);
      return (data as PurchaseRequisition | null) ?? null;
    },

    async deleteRequisition(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client.from("purchase_requisitions").delete().eq("id", id);
      if (error) throw new Error(`deleteRequisition: ${error.message}`);
      return true;
    },

    async addRequisitionItem(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("purchase_requisition_items").insert(input).select("*").single();
      if (error || !data) throw new Error(`addRequisitionItem: ${error?.message ?? "no row returned"}`);
      return data as PurchaseRequisitionItem;
    },

    async listRequisitionItems(accessToken, requisitionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("purchase_requisition_items")
        .select("*")
        .eq("requisition_id", requisitionId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listRequisitionItems: ${error.message}`);
      return (data as PurchaseRequisitionItem[]) ?? [];
    },

    async removeRequisitionItem(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client.from("purchase_requisition_items").delete().eq("id", id);
      if (error) throw new Error(`removeRequisitionItem: ${error.message}`);
      return true;
    },

    async createRfq(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("rfq_packages").insert(input).select("*").single();
      if (error || !data) throw new Error(`createRfq: ${error?.message ?? "no row returned"}`);
      return data as RfqPackage;
    },

    async getRfq(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("rfq_packages").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getRfq: ${error.message}`);
      return (data as RfqPackage | null) ?? null;
    },

    async listRfqs(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("rfq_packages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listRfqs: ${error.message}`);
      return (data as RfqPackage[]) ?? [];
    },

    async updateRfq(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("rfq_packages")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updateRfq: ${error.message}`);
      return (data as RfqPackage | null) ?? null;
    },

    async addRfqVendor(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("rfq_vendors").insert(input).select("*").single();
      if (error || !data) throw new Error(`addRfqVendor: ${error?.message ?? "no row returned"}`);
      return data as RfqVendorQuote;
    },

    async listRfqVendors(accessToken, rfqId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("rfq_vendors")
        .select("*, vendors(name)")
        .eq("rfq_id", rfqId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listRfqVendors: ${error.message}`);
      return ((data || []) as Array<RfqVendorQuote & { vendors?: { name: string } }>).map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        rfq_id: row.rfq_id,
        vendor_id: row.vendor_id,
        vendor_name: row.vendors?.name,
        quoted_amount: row.quoted_amount,
        submission_date: row.submission_date,
        compliance_status: row.compliance_status,
        notes: row.notes,
        created_at: row.created_at,
      }));
    },

    async updateRfqVendor(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("rfq_vendors").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updateRfqVendor: ${error.message}`);
      return (data as RfqVendorQuote | null) ?? null;
    },

    async createPurchaseOrder(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("purchase_orders").insert(input).select("*").single();
      if (error || !data) throw new Error(`createPurchaseOrder: ${error?.message ?? "no row returned"}`);
      return data as PurchaseOrder;
    },

    async getPurchaseOrder(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("purchase_orders").select("*, vendors(name)").eq("id", id).maybeSingle();
      if (error) throw new Error(`getPurchaseOrder: ${error.message}`);
      if (!data) return null;
      const order = data as PurchaseOrder & { vendors?: { name: string } };
      return {
        ...order,
        vendor_name: order.vendors?.name,
      };
    },

    async listPurchaseOrders(accessToken, projectId, filters) {
      const client = userScopedClientFactory(accessToken);
      let query = client
        .from("purchase_orders")
        .select("*, vendors(name)")
        .eq("project_id", projectId)
        .order("order_date", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.vendorId) query = query.eq("vendor_id", filters.vendorId);
      const { data, error } = await query;
      if (error) throw new Error(`listPurchaseOrders: ${error.message}`);
      return ((data || []) as Array<PurchaseOrder & { vendors?: { name: string } }>).map((row) => ({
        ...row,
        vendor_name: row.vendors?.name,
      }));
    },

    async updatePurchaseOrder(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("purchase_orders")
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`updatePurchaseOrder: ${error.message}`);
      return (data as PurchaseOrder | null) ?? null;
    },

    async addPurchaseOrderItem(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("purchase_order_items").insert(input).select("*").single();
      if (error || !data) throw new Error(`addPurchaseOrderItem: ${error?.message ?? "no row returned"}`);
      return data as PurchaseOrderItem;
    },

    async listPurchaseOrderItems(accessToken, poId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("purchase_order_items")
        .select("*")
        .eq("po_id", poId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listPurchaseOrderItems: ${error.message}`);
      return (data as PurchaseOrderItem[]) ?? [];
    },

    async updatePurchaseOrderItem(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("purchase_order_items").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updatePurchaseOrderItem: ${error.message}`);
      return (data as PurchaseOrderItem | null) ?? null;
    },

    async removePurchaseOrderItem(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { error } = await client.from("purchase_order_items").delete().eq("id", id);
      if (error) throw new Error(`removePurchaseOrderItem: ${error.message}`);
      return true;
    },
  };
}
