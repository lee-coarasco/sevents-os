export type StoreLocationType = "central_warehouse" | "site_store" | "laydown_yard" | "scrap_yard";

export interface StoreLocation {
  id: string;
  tenant_id: string;
  project_id: string | null;
  code: string;
  name: string;
  location_type: StoreLocationType;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type InventoryCategory = "materials" | "plant_spares" | "consumables" | "tools_ppe" | "safety_equipment";

export interface InventoryItem {
  id: string;
  tenant_id: string;
  item_code: string;
  name: string;
  description: string | null;
  category: InventoryCategory;
  uom: string;
  reorder_level: number;
  unit_cost: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryStockBalance {
  id: string;
  tenant_id: string;
  location_id: string;
  item_id: string;
  item_code?: string;
  item_name?: string;
  category?: InventoryCategory;
  uom?: string;
  location_name?: string;
  rack_bin: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  last_counted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type GrnStatus = "draft" | "inspected" | "accepted" | "rejected";

export interface GoodsReceivedNote {
  id: string;
  tenant_id: string;
  project_id: string;
  po_id: string | null;
  po_number?: string;
  location_id: string;
  location_name?: string;
  grn_number: string;
  supplier_delivery_note: string | null;
  carrier_name: string | null;
  vehicle_number: string | null;
  received_date: string;
  status: GrnStatus;
  received_by: string | null;
  inspected_by: string | null;
  inspection_notes: string | null;
  general_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrnItem {
  id: string;
  tenant_id: string;
  grn_id: string;
  item_id: string;
  item_code?: string;
  item_name?: string;
  uom?: string;
  po_item_id: string | null;
  quantity_delivered: number;
  quantity_accepted: number;
  quantity_rejected: number;
  rack_bin: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface GrnDetail {
  grn: GoodsReceivedNote;
  items: GrnItem[];
}

export type MinStatus = "draft" | "issued" | "returned";

export interface MaterialIssueNote {
  id: string;
  tenant_id: string;
  project_id: string;
  location_id: string;
  location_name?: string;
  issue_number: string;
  issue_date: string;
  issued_to: string;
  cost_code: string | null;
  status: MinStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaterialIssueItem {
  id: string;
  tenant_id: string;
  issue_id: string;
  item_id: string;
  item_code?: string;
  item_name?: string;
  uom?: string;
  quantity_issued: number;
  quantity_returned: number;
  rack_bin: string | null;
  notes: string | null;
  created_at: string;
}

export interface MaterialIssueDetail {
  issue: MaterialIssueNote;
  items: MaterialIssueItem[];
}

export type GatePassType = "inbound" | "outbound" | "transfer" | "returnable" | "disposal";
export type GatePassStatus = "draft" | "approved" | "dispatched" | "closed";

export interface MaterialGatePass {
  id: string;
  tenant_id: string;
  project_id: string;
  pass_number: string;
  pass_type: GatePassType;
  status: GatePassStatus;
  vehicle_number: string;
  driver_name: string;
  driver_contact: string | null;
  destination: string;
  authorized_by: string | null;
  exit_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
