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
} from "../modules/inventory/repository.js";
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
} from "../modules/inventory/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

export class FakeInventoryRepository implements InventoryRepository {
  sessions = new Map<string, { userId?: string; tenantId: string }>();
  storeLocations = new Map<string, StoreLocation>();
  inventoryItems = new Map<string, InventoryItem>();
  stockBalances = new Map<string, InventoryStockBalance>();
  grns = new Map<string, GoodsReceivedNote>();
  grnItems = new Map<string, GrnItem>();
  materialIssues = new Map<string, MaterialIssueNote>();
  materialIssueItems = new Map<string, MaterialIssueItem>();
  gatePasses = new Map<string, MaterialGatePass>();

  addSession(accessToken: string, userId: string, tenantId: string) {
    this.sessions.set(accessToken, { userId, tenantId });
  }

  private tenantOf(accessToken: string): string {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context.tenantId;
  }

  // Store Locations
  async createStoreLocation(accessToken: string, input: CreateStoreLocationInput): Promise<StoreLocation> {
    const tenantId = this.tenantOf(accessToken);
    const loc: StoreLocation = {
      id: nextId("loc"),
      tenant_id: tenantId,
      project_id: input.project_id ?? null,
      code: input.code,
      name: input.name,
      location_type: input.location_type ?? "site_store",
      address: input.address ?? null,
      is_active: input.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.storeLocations.set(loc.id, loc);
    return loc;
  }

  async getStoreLocation(accessToken: string, id: string): Promise<StoreLocation | null> {
    const tenantId = this.tenantOf(accessToken);
    const loc = this.storeLocations.get(id);
    if (!loc || loc.tenant_id !== tenantId) return null;
    return loc;
  }

  async listStoreLocations(accessToken: string, projectId?: string): Promise<StoreLocation[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.storeLocations.values()).filter(
      (l) => l.tenant_id === tenantId && (!projectId || l.project_id === projectId),
    );
  }

  async updateStoreLocation(accessToken: string, id: string, input: UpdateStoreLocationInput): Promise<StoreLocation | null> {
    const tenantId = this.tenantOf(accessToken);
    const loc = this.storeLocations.get(id);
    if (!loc || loc.tenant_id !== tenantId) return null;
    if (input.name !== undefined) loc.name = input.name;
    if (input.location_type !== undefined) loc.location_type = input.location_type;
    if (input.address !== undefined) loc.address = input.address;
    if (input.is_active !== undefined) loc.is_active = input.is_active;
    loc.updated_at = new Date().toISOString();
    return loc;
  }

  // Inventory Items
  async createInventoryItem(accessToken: string, input: CreateInventoryItemInput): Promise<InventoryItem> {
    const tenantId = this.tenantOf(accessToken);
    const item: InventoryItem = {
      id: nextId("item"),
      tenant_id: tenantId,
      item_code: input.item_code,
      name: input.name,
      description: input.description ?? null,
      category: input.category ?? "materials",
      uom: input.uom ?? "NOS",
      reorder_level: input.reorder_level ?? 0,
      unit_cost: input.unit_cost ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.inventoryItems.set(item.id, item);
    return item;
  }

  async getInventoryItem(accessToken: string, id: string): Promise<InventoryItem | null> {
    const tenantId = this.tenantOf(accessToken);
    const item = this.inventoryItems.get(id);
    if (!item || item.tenant_id !== tenantId) return null;
    return item;
  }

  async listInventoryItems(accessToken: string, category?: InventoryCategory): Promise<InventoryItem[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.inventoryItems.values()).filter(
      (i) => i.tenant_id === tenantId && (!category || i.category === category),
    );
  }

  async updateInventoryItem(accessToken: string, id: string, input: UpdateInventoryItemInput): Promise<InventoryItem | null> {
    const tenantId = this.tenantOf(accessToken);
    const item = this.inventoryItems.get(id);
    if (!item || item.tenant_id !== tenantId) return null;
    if (input.name !== undefined) item.name = input.name;
    if (input.description !== undefined) item.description = input.description;
    if (input.category !== undefined) item.category = input.category;
    if (input.uom !== undefined) item.uom = input.uom;
    if (input.reorder_level !== undefined) item.reorder_level = input.reorder_level;
    if (input.unit_cost !== undefined) item.unit_cost = input.unit_cost;
    item.updated_at = new Date().toISOString();
    return item;
  }

  // Stock Balances
  async getStockBalance(accessToken: string, locationId: string, itemId: string, rackBin?: string | null): Promise<InventoryStockBalance | null> {
    const tenantId = this.tenantOf(accessToken);
    for (const b of this.stockBalances.values()) {
      if (
        b.tenant_id === tenantId &&
        b.location_id === locationId &&
        b.item_id === itemId &&
        (rackBin ? b.rack_bin === rackBin : !b.rack_bin)
      ) {
        return b;
      }
    }
    return null;
  }

  async listStockBalances(accessToken: string, locationId?: string, itemId?: string): Promise<InventoryStockBalance[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.stockBalances.values())
      .filter(
        (b) =>
          b.tenant_id === tenantId &&
          (!locationId || b.location_id === locationId) &&
          (!itemId || b.item_id === itemId),
      )
      .map((b) => {
        const item = this.inventoryItems.get(b.item_id);
        const loc = this.storeLocations.get(b.location_id);
        return {
          ...b,
          item_code: item?.item_code,
          item_name: item?.name,
          category: item?.category,
          uom: item?.uom,
          location_name: loc?.name,
        };
      });
  }

  async adjustStockBalance(accessToken: string, locationId: string, itemId: string, quantityDelta: number, rackBin?: string | null): Promise<InventoryStockBalance> {
    const tenantId = this.tenantOf(accessToken);
    let balance = await this.getStockBalance(accessToken, locationId, itemId, rackBin);
    if (!balance) {
      if (quantityDelta < 0) throw new Error("Insufficient stock to deduct");
      balance = {
        id: nextId("sb"),
        tenant_id: tenantId,
        location_id: locationId,
        item_id: itemId,
        rack_bin: rackBin ?? null,
        quantity_on_hand: quantityDelta,
        quantity_reserved: 0,
        last_counted_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.stockBalances.set(balance.id, balance);
      return balance;
    }

    const newQty = balance.quantity_on_hand + quantityDelta;
    if (newQty < 0) {
      throw new Error(`Insufficient stock. Current: ${balance.quantity_on_hand}, Delta: ${quantityDelta}`);
    }
    balance.quantity_on_hand = newQty;
    balance.updated_at = new Date().toISOString();
    return balance;
  }

  // GRN
  async createGrn(accessToken: string, input: CreateGrnInput): Promise<GoodsReceivedNote> {
    const tenantId = this.tenantOf(accessToken);
    const grn: GoodsReceivedNote = {
      id: nextId("grn"),
      tenant_id: tenantId,
      project_id: input.project_id,
      po_id: input.po_id ?? null,
      location_id: input.location_id,
      grn_number: input.grn_number,
      supplier_delivery_note: input.supplier_delivery_note ?? null,
      carrier_name: input.carrier_name ?? null,
      vehicle_number: input.vehicle_number ?? null,
      received_date: input.received_date ?? new Date().toISOString().slice(0, 10),
      status: input.status ?? "draft",
      received_by: input.received_by ?? null,
      inspected_by: input.inspected_by ?? null,
      inspection_notes: input.inspection_notes ?? null,
      general_notes: input.general_notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.grns.set(grn.id, grn);
    return grn;
  }

  async getGrn(accessToken: string, id: string): Promise<GoodsReceivedNote | null> {
    const tenantId = this.tenantOf(accessToken);
    const grn = this.grns.get(id);
    if (!grn || grn.tenant_id !== tenantId) return null;
    return grn;
  }

  async getGrnDetail(accessToken: string, id: string): Promise<GrnDetail | null> {
    const grn = await this.getGrn(accessToken, id);
    if (!grn) return null;
    const items = await this.listGrnItems(accessToken, id);
    return { grn, items };
  }

  async listGrns(accessToken: string, projectId: string): Promise<GoodsReceivedNote[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.grns.values())
      .filter((g) => g.tenant_id === tenantId && g.project_id === projectId)
      .map((g) => {
        const loc = this.storeLocations.get(g.location_id);
        return {
          ...g,
          location_name: loc?.name,
        };
      });
  }

  async updateGrn(accessToken: string, id: string, input: UpdateGrnInput): Promise<GoodsReceivedNote | null> {
    const tenantId = this.tenantOf(accessToken);
    const grn = this.grns.get(id);
    if (!grn || grn.tenant_id !== tenantId) return null;
    if (input.supplier_delivery_note !== undefined) grn.supplier_delivery_note = input.supplier_delivery_note;
    if (input.carrier_name !== undefined) grn.carrier_name = input.carrier_name;
    if (input.vehicle_number !== undefined) grn.vehicle_number = input.vehicle_number;
    if (input.status !== undefined) grn.status = input.status;
    if (input.inspected_by !== undefined) grn.inspected_by = input.inspected_by;
    if (input.inspection_notes !== undefined) grn.inspection_notes = input.inspection_notes;
    if (input.general_notes !== undefined) grn.general_notes = input.general_notes;
    grn.updated_at = new Date().toISOString();
    return grn;
  }

  async addGrnItem(accessToken: string, input: AddGrnItemInput): Promise<GrnItem> {
    const tenantId = this.tenantOf(accessToken);
    const item: GrnItem = {
      id: nextId("grn-item"),
      tenant_id: tenantId,
      grn_id: input.grn_id,
      item_id: input.item_id,
      po_item_id: input.po_item_id ?? null,
      quantity_delivered: input.quantity_delivered,
      quantity_accepted: input.quantity_accepted ?? 0,
      quantity_rejected: input.quantity_rejected ?? 0,
      rack_bin: input.rack_bin ?? null,
      rejection_reason: input.rejection_reason ?? null,
      created_at: new Date().toISOString(),
    };
    this.grnItems.set(item.id, item);
    return item;
  }

  async listGrnItems(accessToken: string, grnId: string): Promise<GrnItem[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.grnItems.values())
      .filter((i) => i.tenant_id === tenantId && i.grn_id === grnId)
      .map((gi) => {
        const it = this.inventoryItems.get(gi.item_id);
        return {
          ...gi,
          item_code: it?.item_code,
          item_name: it?.name,
          uom: it?.uom,
        };
      });
  }

  // Material Issues
  async createMaterialIssue(accessToken: string, input: CreateMaterialIssueInput): Promise<MaterialIssueNote> {
    const tenantId = this.tenantOf(accessToken);
    const issue: MaterialIssueNote = {
      id: nextId("min"),
      tenant_id: tenantId,
      project_id: input.project_id,
      location_id: input.location_id,
      issue_number: input.issue_number,
      issue_date: input.issue_date ?? new Date().toISOString().slice(0, 10),
      issued_to: input.issued_to,
      cost_code: input.cost_code ?? null,
      status: input.status ?? "draft",
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.materialIssues.set(issue.id, issue);
    return issue;
  }

  async getMaterialIssue(accessToken: string, id: string): Promise<MaterialIssueNote | null> {
    const tenantId = this.tenantOf(accessToken);
    const issue = this.materialIssues.get(id);
    if (!issue || issue.tenant_id !== tenantId) return null;
    return issue;
  }

  async getMaterialIssueDetail(accessToken: string, id: string): Promise<MaterialIssueDetail | null> {
    const issue = await this.getMaterialIssue(accessToken, id);
    if (!issue) return null;
    const items = await this.listMaterialIssueItems(accessToken, id);
    return { issue, items };
  }

  async listMaterialIssues(accessToken: string, projectId: string): Promise<MaterialIssueNote[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.materialIssues.values())
      .filter((m) => m.tenant_id === tenantId && m.project_id === projectId)
      .map((m) => {
        const loc = this.storeLocations.get(m.location_id);
        return {
          ...m,
          location_name: loc?.name,
        };
      });
  }

  async updateMaterialIssue(accessToken: string, id: string, input: UpdateMaterialIssueInput): Promise<MaterialIssueNote | null> {
    const tenantId = this.tenantOf(accessToken);
    const issue = this.materialIssues.get(id);
    if (!issue || issue.tenant_id !== tenantId) return null;
    if (input.issued_to !== undefined) issue.issued_to = input.issued_to;
    if (input.cost_code !== undefined) issue.cost_code = input.cost_code;
    if (input.status !== undefined) issue.status = input.status;
    if (input.notes !== undefined) issue.notes = input.notes;
    issue.updated_at = new Date().toISOString();
    return issue;
  }

  async addMaterialIssueItem(accessToken: string, input: AddMaterialIssueItemInput): Promise<MaterialIssueItem> {
    const tenantId = this.tenantOf(accessToken);
    const item: MaterialIssueItem = {
      id: nextId("min-item"),
      tenant_id: tenantId,
      issue_id: input.issue_id,
      item_id: input.item_id,
      quantity_issued: input.quantity_issued,
      quantity_returned: input.quantity_returned ?? 0,
      rack_bin: input.rack_bin ?? null,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
    };
    this.materialIssueItems.set(item.id, item);
    return item;
  }

  async listMaterialIssueItems(accessToken: string, issueId: string): Promise<MaterialIssueItem[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.materialIssueItems.values())
      .filter((i) => i.tenant_id === tenantId && i.issue_id === issueId)
      .map((mi) => {
        const it = this.inventoryItems.get(mi.item_id);
        return {
          ...mi,
          item_code: it?.item_code,
          item_name: it?.name,
          uom: it?.uom,
        };
      });
  }

  // Material Gate Passes
  async createGatePass(accessToken: string, input: CreateGatePassInput): Promise<MaterialGatePass> {
    const tenantId = this.tenantOf(accessToken);
    const pass: MaterialGatePass = {
      id: nextId("gp"),
      tenant_id: tenantId,
      project_id: input.project_id,
      pass_number: input.pass_number,
      pass_type: input.pass_type ?? "outbound",
      status: input.status ?? "draft",
      vehicle_number: input.vehicle_number,
      driver_name: input.driver_name,
      driver_contact: input.driver_contact ?? null,
      destination: input.destination,
      authorized_by: input.authorized_by ?? null,
      exit_time: null,
      notes: input.notes ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.gatePasses.set(pass.id, pass);
    return pass;
  }

  async getGatePass(accessToken: string, id: string): Promise<MaterialGatePass | null> {
    const tenantId = this.tenantOf(accessToken);
    const pass = this.gatePasses.get(id);
    if (!pass || pass.tenant_id !== tenantId) return null;
    return pass;
  }

  async listGatePasses(accessToken: string, projectId: string): Promise<MaterialGatePass[]> {
    const tenantId = this.tenantOf(accessToken);
    return Array.from(this.gatePasses.values()).filter(
      (p) => p.tenant_id === tenantId && p.project_id === projectId,
    );
  }

  async updateGatePass(accessToken: string, id: string, input: UpdateGatePassInput): Promise<MaterialGatePass | null> {
    const tenantId = this.tenantOf(accessToken);
    const pass = this.gatePasses.get(id);
    if (!pass || pass.tenant_id !== tenantId) return null;
    if (input.status !== undefined) pass.status = input.status;
    if (input.authorized_by !== undefined) pass.authorized_by = input.authorized_by;
    if (input.exit_time !== undefined) pass.exit_time = input.exit_time;
    if (input.notes !== undefined) pass.notes = input.notes;
    pass.updated_at = new Date().toISOString();
    return pass;
  }
}
