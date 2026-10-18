export type VendorCategory = "materials" | "plant_machinery" | "services" | "specialist_contractor";
export type VendorStatus = "pending_kyc" | "active" | "suspended" | "blacklisted";

export interface Vendor {
  id: string;
  tenant_id: string;
  name: string;
  trade_license_number: string | null;
  tax_registration_number: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: VendorCategory;
  rating: number;
  status: VendorStatus;
  created_at: string;
  updated_at: string;
}

export type RequisitionPriority = "low" | "normal" | "urgent";
export type RequisitionStatus = "draft" | "submitted" | "approved" | "rejected" | "ordered" | "cancelled";

export interface PurchaseRequisition {
  id: string;
  tenant_id: string;
  project_id: string;
  pr_number: string;
  title: string;
  required_date: string;
  priority: RequisitionPriority;
  status: RequisitionStatus;
  requested_by: string | null;
  total_estimated_amount: number;
  currency: string;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequisitionItem {
  id: string;
  tenant_id: string;
  requisition_id: string;
  item_description: string;
  cost_code: string | null;
  quantity: number;
  uom: string;
  estimated_unit_rate: number;
  estimated_total_amount: number;
  schedule_activity_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface PurchaseRequisitionDetail {
  requisition: PurchaseRequisition;
  items: PurchaseRequisitionItem[];
}

export type RfqStatus = "draft" | "issued" | "evaluated" | "awarded" | "closed";
export type RfqComplianceStatus = "compliant" | "deviations" | "non_compliant";

export interface RfqPackage {
  id: string;
  tenant_id: string;
  project_id: string;
  requisition_id: string | null;
  rfq_number: string;
  title: string;
  issue_date: string;
  due_date: string;
  status: RfqStatus;
  scope_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface RfqVendorQuote {
  id: string;
  tenant_id: string;
  rfq_id: string;
  vendor_id: string;
  vendor_name?: string;
  quoted_amount: number | null;
  submission_date: string | null;
  compliance_status: RfqComplianceStatus;
  notes: string | null;
  created_at: string;
}

export interface RfqDetail {
  rfq: RfqPackage;
  vendorQuotes: RfqVendorQuote[];
}

export type PoStatus = "draft" | "issued" | "partially_delivered" | "delivered" | "closed" | "cancelled";
export type PoItemDeliveryStatus = "pending" | "partial" | "delivered";

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  project_id: string;
  vendor_id: string;
  vendor_name?: string;
  requisition_id: string | null;
  rfq_id: string | null;
  po_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  delivery_address: string | null;
  payment_terms: string | null;
  status: PoStatus;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  tenant_id: string;
  po_id: string;
  item_description: string;
  quantity: number;
  uom: string;
  unit_price: number;
  total_amount: number;
  delivery_status: PoItemDeliveryStatus;
  created_at: string;
}

export interface PurchaseOrderDetail {
  order: PurchaseOrder;
  items: PurchaseOrderItem[];
  vendor?: Vendor | null;
}
