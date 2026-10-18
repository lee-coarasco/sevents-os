import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GatePassStatus,
  GatePassType,
  GoodsReceivedNote,
  GrnDetail,
  GrnItem,
  GrnStatus,
  InventoryCategory,
  InventoryItem,
  InventoryStockBalance,
  MaterialGatePass,
  MaterialIssueDetail,
  MaterialIssueItem,
  MaterialIssueNote,
  MinStatus,
  StoreLocation,
  StoreLocationType,
} from "./types.js";

// ---- Inputs ----------------------------------------------------------------

export interface CreateStoreLocationInput {
  project_id?: string | null;
  code: string;
  name: string;
  location_type?: StoreLocationType;
  address?: string | null;
  is_active?: boolean;
}

export interface UpdateStoreLocationInput {
  name?: string;
  location_type?: StoreLocationType;
  address?: string | null;
  is_active?: boolean;
}

export interface CreateInventoryItemInput {
  item_code: string;
  name: string;
  description?: string | null;
  category?: InventoryCategory;
  uom?: string;
  reorder_level?: number;
  unit_cost?: number;
}

export interface UpdateInventoryItemInput {
  name?: string;
  description?: string | null;
  category?: InventoryCategory;
  uom?: string;
  reorder_level?: number;
  unit_cost?: number;
}

export interface CreateGrnInput {
  project_id: string;
  po_id?: string | null;
  location_id: string;
  grn_number: string;
  supplier_delivery_note?: string | null;
  carrier_name?: string | null;
  vehicle_number?: string | null;
  received_date?: string;
  status?: GrnStatus;
  received_by?: string | null;
  inspected_by?: string | null;
  inspection_notes?: string | null;
  general_notes?: string | null;
}

export interface UpdateGrnInput {
  supplier_delivery_note?: string | null;
  carrier_name?: string | null;
  vehicle_number?: string | null;
  status?: GrnStatus;
  inspected_by?: string | null;
  inspection_notes?: string | null;
  general_notes?: string | null;
}

export interface AddGrnItemInput {
  grn_id: string;
  item_id: string;
  po_item_id?: string | null;
  quantity_delivered: number;
  quantity_accepted?: number;
  quantity_rejected?: number;
  rack_bin?: string | null;
  rejection_reason?: string | null;
}

export interface CreateMaterialIssueInput {
  project_id: string;
  location_id: string;
  issue_number: string;
  issue_date?: string;
  issued_to: string;
  cost_code?: string | null;
  status?: MinStatus;
  notes?: string | null;
}

export interface UpdateMaterialIssueInput {
  issued_to?: string;
  cost_code?: string | null;
  status?: MinStatus;
  notes?: string | null;
}

export interface AddMaterialIssueItemInput {
  issue_id: string;
  item_id: string;
  quantity_issued: number;
  quantity_returned?: number;
  rack_bin?: string | null;
  notes?: string | null;
}

export interface CreateGatePassInput {
  project_id: string;
  pass_number: string;
  pass_type?: GatePassType;
  status?: GatePassStatus;
  vehicle_number: string;
  driver_name: string;
  driver_contact?: string | null;
  destination: string;
  authorized_by?: string | null;
  notes?: string | null;
}

export interface UpdateGatePassInput {
  status?: GatePassStatus;
  authorized_by?: string | null;
  exit_time?: string | null;
  notes?: string | null;
}

// ---- Repository Interface -------------------------------------------------

export interface InventoryRepository {
  // Store Locations
  createStoreLocation(accessToken: string, input: CreateStoreLocationInput): Promise<StoreLocation>;
  getStoreLocation(accessToken: string, id: string): Promise<StoreLocation | null>;
  listStoreLocations(accessToken: string, projectId?: string): Promise<StoreLocation[]>;
  updateStoreLocation(accessToken: string, id: string, input: UpdateStoreLocationInput): Promise<StoreLocation | null>;

  // Inventory Items
  createInventoryItem(accessToken: string, input: CreateInventoryItemInput): Promise<InventoryItem>;
  getInventoryItem(accessToken: string, id: string): Promise<InventoryItem | null>;
  listInventoryItems(accessToken: string, category?: InventoryCategory): Promise<InventoryItem[]>;
  updateInventoryItem(accessToken: string, id: string, input: UpdateInventoryItemInput): Promise<InventoryItem | null>;

  // Stock Balances
  getStockBalance(accessToken: string, locationId: string, itemId: string, rackBin?: string | null): Promise<InventoryStockBalance | null>;
  listStockBalances(accessToken: string, locationId?: string, itemId?: string): Promise<InventoryStockBalance[]>;
  adjustStockBalance(accessToken: string, locationId: string, itemId: string, quantityDelta: number, rackBin?: string | null): Promise<InventoryStockBalance>;

  // GRN
  createGrn(accessToken: string, input: CreateGrnInput): Promise<GoodsReceivedNote>;
  getGrn(accessToken: string, id: string): Promise<GoodsReceivedNote | null>;
  getGrnDetail(accessToken: string, id: string): Promise<GrnDetail | null>;
  listGrns(accessToken: string, projectId: string): Promise<GoodsReceivedNote[]>;
  updateGrn(accessToken: string, id: string, input: UpdateGrnInput): Promise<GoodsReceivedNote | null>;
  addGrnItem(accessToken: string, input: AddGrnItemInput): Promise<GrnItem>;
  listGrnItems(accessToken: string, grnId: string): Promise<GrnItem[]>;

  // Material Issues
  createMaterialIssue(accessToken: string, input: CreateMaterialIssueInput): Promise<MaterialIssueNote>;
  getMaterialIssue(accessToken: string, id: string): Promise<MaterialIssueNote | null>;
  getMaterialIssueDetail(accessToken: string, id: string): Promise<MaterialIssueDetail | null>;
  listMaterialIssues(accessToken: string, projectId: string): Promise<MaterialIssueNote[]>;
  updateMaterialIssue(accessToken: string, id: string, input: UpdateMaterialIssueInput): Promise<MaterialIssueNote | null>;
  addMaterialIssueItem(accessToken: string, input: AddMaterialIssueItemInput): Promise<MaterialIssueItem>;
  listMaterialIssueItems(accessToken: string, issueId: string): Promise<MaterialIssueItem[]>;

  // Material Gate Passes
  createGatePass(accessToken: string, input: CreateGatePassInput): Promise<MaterialGatePass>;
  getGatePass(accessToken: string, id: string): Promise<MaterialGatePass | null>;
  listGatePasses(accessToken: string, projectId: string): Promise<MaterialGatePass[]>;
  updateGatePass(accessToken: string, id: string, input: UpdateGatePassInput): Promise<MaterialGatePass | null>;
}

// ---- Supabase Implementation ----------------------------------------------

export function createSupabaseInventoryRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): InventoryRepository {
  return {
    async createStoreLocation(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("store_locations").insert(input).select("*").single();
      if (error || !data) throw new Error(`createStoreLocation: ${error?.message ?? "no row returned"}`);
      return data as StoreLocation;
    },

    async getStoreLocation(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("store_locations").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getStoreLocation: ${error.message}`);
      return (data as StoreLocation | null) ?? null;
    },

    async listStoreLocations(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("store_locations").select("*").order("name", { ascending: true });
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw new Error(`listStoreLocations: ${error.message}`);
      return (data as StoreLocation[]) ?? [];
    },

    async updateStoreLocation(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("store_locations").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updateStoreLocation: ${error.message}`);
      return (data as StoreLocation | null) ?? null;
    },

    async createInventoryItem(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("inventory_items").insert(input).select("*").single();
      if (error || !data) throw new Error(`createInventoryItem: ${error?.message ?? "no row returned"}`);
      return data as InventoryItem;
    },

    async getInventoryItem(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("inventory_items").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getInventoryItem: ${error.message}`);
      return (data as InventoryItem | null) ?? null;
    },

    async listInventoryItems(accessToken, category) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("inventory_items").select("*").order("name", { ascending: true });
      if (category) query = query.eq("category", category);
      const { data, error } = await query;
      if (error) throw new Error(`listInventoryItems: ${error.message}`);
      return (data as InventoryItem[]) ?? [];
    },

    async updateInventoryItem(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("inventory_items").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updateInventoryItem: ${error.message}`);
      return (data as InventoryItem | null) ?? null;
    },

    async getStockBalance(accessToken, locationId, itemId, rackBin) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("inventory_stock_balances").select("*").eq("location_id", locationId).eq("item_id", itemId);
      if (rackBin) {
        query = query.eq("rack_bin", rackBin);
      } else {
        query = query.is("rack_bin", null);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(`getStockBalance: ${error.message}`);
      return (data as InventoryStockBalance | null) ?? null;
    },

    async listStockBalances(accessToken, locationId, itemId) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("inventory_stock_balances").select(`
        *,
        item:inventory_items(item_code, name, category, uom),
        location:store_locations(name)
      `).order("created_at", { ascending: false });
      if (locationId) query = query.eq("location_id", locationId);
      if (itemId) query = query.eq("item_id", itemId);
      const { data, error } = await query;
      if (error) throw new Error(`listStockBalances: ${error.message}`);
      return ((data as unknown[]) ?? []).map((row: any) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        location_id: row.location_id,
        item_id: row.item_id,
        item_code: row.item?.item_code,
        item_name: row.item?.name,
        category: row.item?.category,
        uom: row.item?.uom,
        location_name: row.location?.name,
        rack_bin: row.rack_bin,
        quantity_on_hand: Number(row.quantity_on_hand),
        quantity_reserved: Number(row.quantity_reserved),
        last_counted_at: row.last_counted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    },

    async adjustStockBalance(accessToken, locationId, itemId, quantityDelta, rackBin) {
      const client = userScopedClientFactory(accessToken);
      const existing = await this.getStockBalance(accessToken, locationId, itemId, rackBin);
      if (!existing) {
        if (quantityDelta < 0) {
          throw new Error("Insufficient stock to deduct");
        }
        const { data, error } = await client.from("inventory_stock_balances").insert({
          location_id: locationId,
          item_id: itemId,
          rack_bin: rackBin ?? null,
          quantity_on_hand: quantityDelta,
          quantity_reserved: 0,
        }).select("*").single();
        if (error || !data) throw new Error(`adjustStockBalance insert: ${error?.message}`);
        return data as InventoryStockBalance;
      }

      const newQty = Number(existing.quantity_on_hand) + quantityDelta;
      if (newQty < 0) {
        throw new Error(`Insufficient stock. Current: ${existing.quantity_on_hand}, Delta: ${quantityDelta}`);
      }
      const { data, error } = await client.from("inventory_stock_balances").update({
        quantity_on_hand: newQty,
        updated_at: new Date().toISOString(),
      }).eq("id", existing.id).select("*").single();
      if (error || !data) throw new Error(`adjustStockBalance update: ${error?.message}`);
      return data as InventoryStockBalance;
    },

    async createGrn(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("goods_received_notes").insert(input).select("*").single();
      if (error || !data) throw new Error(`createGrn: ${error?.message ?? "no row returned"}`);
      return data as GoodsReceivedNote;
    },

    async getGrn(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("goods_received_notes").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getGrn: ${error.message}`);
      return (data as GoodsReceivedNote | null) ?? null;
    },

    async getGrnDetail(accessToken, id) {
      const grn = await this.getGrn(accessToken, id);
      if (!grn) return null;
      const items = await this.listGrnItems(accessToken, id);
      return { grn, items };
    },

    async listGrns(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("goods_received_notes")
        .select(`
          *,
          po:purchase_orders(po_number),
          location:store_locations(name)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listGrns: ${error.message}`);
      return ((data as unknown[]) ?? []).map((row: any) => ({
        ...row,
        po_number: row.po?.po_number,
        location_name: row.location?.name,
      }));
    },

    async updateGrn(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("goods_received_notes").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updateGrn: ${error.message}`);
      return (data as GoodsReceivedNote | null) ?? null;
    },

    async addGrnItem(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("grn_items").insert(input).select("*").single();
      if (error || !data) throw new Error(`addGrnItem: ${error?.message}`);
      return data as GrnItem;
    },

    async listGrnItems(accessToken, grnId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("grn_items")
        .select(`
          *,
          item:inventory_items(item_code, name, uom)
        `)
        .eq("grn_id", grnId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listGrnItems: ${error.message}`);
      return ((data as unknown[]) ?? []).map((row: any) => ({
        ...row,
        item_code: row.item?.item_code,
        item_name: row.item?.name,
        uom: row.item?.uom,
      }));
    },

    async createMaterialIssue(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("material_issue_notes").insert(input).select("*").single();
      if (error || !data) throw new Error(`createMaterialIssue: ${error?.message}`);
      return data as MaterialIssueNote;
    },

    async getMaterialIssue(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("material_issue_notes").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getMaterialIssue: ${error.message}`);
      return (data as MaterialIssueNote | null) ?? null;
    },

    async getMaterialIssueDetail(accessToken, id) {
      const issue = await this.getMaterialIssue(accessToken, id);
      if (!issue) return null;
      const items = await this.listMaterialIssueItems(accessToken, id);
      return { issue, items };
    },

    async listMaterialIssues(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("material_issue_notes")
        .select(`
          *,
          location:store_locations(name)
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listMaterialIssues: ${error.message}`);
      return ((data as unknown[]) ?? []).map((row: any) => ({
        ...row,
        location_name: row.location?.name,
      }));
    },

    async updateMaterialIssue(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("material_issue_notes").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updateMaterialIssue: ${error.message}`);
      return (data as MaterialIssueNote | null) ?? null;
    },

    async addMaterialIssueItem(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("material_issue_items").insert(input).select("*").single();
      if (error || !data) throw new Error(`addMaterialIssueItem: ${error?.message}`);
      return data as MaterialIssueItem;
    },

    async listMaterialIssueItems(accessToken, issueId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("material_issue_items")
        .select(`
          *,
          item:inventory_items(item_code, name, uom)
        `)
        .eq("issue_id", issueId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(`listMaterialIssueItems: ${error.message}`);
      return ((data as unknown[]) ?? []).map((row: any) => ({
        ...row,
        item_code: row.item?.item_code,
        item_name: row.item?.name,
        uom: row.item?.uom,
      }));
    },

    async createGatePass(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("material_gate_passes").insert(input).select("*").single();
      if (error || !data) throw new Error(`createGatePass: ${error?.message}`);
      return data as MaterialGatePass;
    },

    async getGatePass(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("material_gate_passes").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getGatePass: ${error.message}`);
      return (data as MaterialGatePass | null) ?? null;
    },

    async listGatePasses(accessToken, projectId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("material_gate_passes")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(`listGatePasses: ${error.message}`);
      return (data as MaterialGatePass[]) ?? [];
    },

    async updateGatePass(accessToken, id, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("material_gate_passes").update(input).eq("id", id).select("*").maybeSingle();
      if (error) throw new Error(`updateGatePass: ${error.message}`);
      return (data as MaterialGatePass | null) ?? null;
    },
  };
}
