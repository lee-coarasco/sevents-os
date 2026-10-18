import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeInventoryRepository } from "../../test/fakeInventoryRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_A = "tenant-a";

const OTHER_TENANT_TOKEN = "other-tenant-token";
const OTHER_USER = "other-user";
const TENANT_B = "tenant-b";

function appWithFakeRepos() {
  const authorityRepo = new FakeAuthorityRepository();

  // Tenant A Admin
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  authorityRepo.roleAssignments.set("seed-admin", {
    id: "seed-admin",
    tenant_id: TENANT_A,
    user_id: ADMIN_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });
  authorityRepo.grantPermission("role.platform_administrator", "inventory.store.manage");
  authorityRepo.grantPermission("role.platform_administrator", "inventory.item.manage");
  authorityRepo.grantPermission("role.platform_administrator", "inventory.stock.view");
  authorityRepo.grantPermission("role.platform_administrator", "inventory.grn.manage");
  authorityRepo.grantPermission("role.platform_administrator", "inventory.issue.manage");
  authorityRepo.grantPermission("role.platform_administrator", "inventory.gatepass.manage");

  // Tenant B Admin
  authorityRepo.addSession(OTHER_TENANT_TOKEN, OTHER_USER, TENANT_B);
  authorityRepo.roleAssignments.set("seed-other", {
    id: "seed-other",
    tenant_id: TENANT_B,
    user_id: OTHER_USER,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });

  const inventoryRepo = new FakeInventoryRepository();
  inventoryRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  inventoryRepo.addSession(OTHER_TENANT_TOKEN, OTHER_USER, TENANT_B);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getInventoryRepository: () => inventoryRepo,
  });

  return { app, inventoryRepo };
}

describe("M15: Inventory, Stores & Material Movement Routes", () => {
  it("creates store locations and master catalog items", async () => {
    const { app } = appWithFakeRepos();

    // 1. Create Store Location
    const resLoc = await app.inject({
      method: "POST",
      url: "/inventory/locations",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        code: "WH-MAIN",
        name: "Central Logistics Warehouse",
        locationType: "central_warehouse",
        address: "Industrial Area 1, Dubai",
      },
    });
    expect(resLoc.statusCode).toBe(201);
    const loc = resLoc.json().location;
    expect(loc.code).toBe("WH-MAIN");
    expect(loc.name).toBe("Central Logistics Warehouse");

    // 2. Create Master Inventory Item
    const resItem = await app.inject({
      method: "POST",
      url: "/inventory/items",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        itemCode: "REBAR-16MM",
        name: "Deformed High Tensile Rebar 16mm",
        category: "materials",
        uom: "TON",
        reorderLevel: 10,
        unitCost: 2650,
      },
    });
    expect(resItem.statusCode).toBe(201);
    const item = resItem.json().item;
    expect(item.item_code).toBe("REBAR-16MM");

    // 3. List Inventory Items
    const resList = await app.inject({
      method: "GET",
      url: "/inventory/items?category=materials",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resList.statusCode).toBe(200);
    expect(resList.json().items).toHaveLength(1);
  });

  it("handles Goods Received Note (GRN) workflow and increments stock balance", async () => {
    const { app } = appWithFakeRepos();

    // Create location and item
    const resLoc = await app.inject({
      method: "POST",
      url: "/inventory/locations",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { code: "SITE-YARD", name: "Project Site Laydown Yard" },
    });
    const locationId = resLoc.json().location.id;

    const resItem = await app.inject({
      method: "POST",
      url: "/inventory/items",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { itemCode: "CEMENT-OPC", name: "Portland Cement 50kg Bags", uom: "BAGS" },
    });
    const itemId = resItem.json().item.id;

    // Create GRN
    const resGrn = await app.inject({
      method: "POST",
      url: "/projects/proj-101/inventory/grns",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        locationId,
        grnNumber: "GRN-2026-001",
        supplierDeliveryNote: "DN-99410",
        carrierName: "Al Futtaim Transport",
        vehicleNumber: "DXB-49201",
      },
    });
    expect(resGrn.statusCode).toBe(201);
    const grnId = resGrn.json().grn.id;

    // Add GRN Line Item
    const resGrnItem = await app.inject({
      method: "POST",
      url: `/inventory/grns/${grnId}/items`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        itemId,
        quantityDelivered: 500,
        quantityAccepted: 480,
        quantityRejected: 20,
        rackBin: "BAY-C1",
        rejectionReason: "Torn packaging on 20 bags",
      },
    });
    expect(resGrnItem.statusCode).toBe(201);

    // Accept GRN
    const resAccept = await app.inject({
      method: "POST",
      url: `/inventory/grns/${grnId}/accept`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        inspectedBy: "Eng. Tariq",
        inspectionNotes: "Received in good condition except 20 damaged bags quarantined.",
      },
    });
    expect(resAccept.statusCode).toBe(200);
    expect(resAccept.json().grn.status).toBe("accepted");

    // Verify stock balance incremented by 480 (accepted quantity)
    const resStock = await app.inject({
      method: "GET",
      url: `/inventory/stock-balances?locationId=${locationId}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resStock.statusCode).toBe(200);
    const balances = resStock.json().balances;
    expect(balances).toHaveLength(1);
    expect(balances[0].quantity_on_hand).toBe(480);
    expect(balances[0].rack_bin).toBe("BAY-C1");
  });

  it("issues material to site crews and deducts from stock balance", async () => {
    const { app, inventoryRepo } = appWithFakeRepos();

    const loc = await inventoryRepo.createStoreLocation(ADMIN_TOKEN, {
      code: "STORE-B",
      name: "Site Store Block B",
    });
    const item = await inventoryRepo.createInventoryItem(ADMIN_TOKEN, {
      item_code: "SAFETY-HELMET",
      name: "Safety Helmets ANSI Type 1",
      uom: "NOS",
    });

    // Seed stock of 50 helmets
    await inventoryRepo.adjustStockBalance(ADMIN_TOKEN, loc.id, item.id, 50, "SHELF-1");

    // Create Material Issue Note (MIN)
    const resMin = await app.inject({
      method: "POST",
      url: "/projects/proj-101/inventory/issues",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        locationId: loc.id,
        issueNumber: "MIN-005",
        issuedTo: "Al Naboodah Subcontractor Crew",
        costCode: "01-SAFETY",
      },
    });
    expect(resMin.statusCode).toBe(201);
    const minId = resMin.json().issue.id;

    // Add Issue Item
    const resMinItem = await app.inject({
      method: "POST",
      url: `/inventory/issues/${minId}/items`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        itemId: item.id,
        quantityIssued: 15,
        rackBin: "SHELF-1",
      },
    });
    expect(resMinItem.statusCode).toBe(201);

    // Dispatch issue
    const resDispatch = await app.inject({
      method: "POST",
      url: `/inventory/issues/${minId}/dispatch`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resDispatch.statusCode).toBe(200);
    expect(resDispatch.json().issue.status).toBe("issued");

    // Stock should now be 35
    const balance = await inventoryRepo.getStockBalance(ADMIN_TOKEN, loc.id, item.id, "SHELF-1");
    expect(balance?.quantity_on_hand).toBe(35);
  });

  it("creates and approves material gate passes", async () => {
    const { app } = appWithFakeRepos();

    // Create gate pass
    const resPass = await app.inject({
      method: "POST",
      url: "/projects/proj-101/inventory/gate-passes",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        passNumber: "GP-2026-880",
        passType: "outbound",
        vehicleNumber: "DXB-77123",
        driverName: "Sultan Khan",
        driverContact: "+971509988776",
        destination: "Fabrication Yard, Sharjah",
        notes: "Steel structural trusses transfer",
      },
    });
    expect(resPass.statusCode).toBe(201);
    const passId = resPass.json().pass.id;

    // Approve Gate Pass
    const resApprove = await app.inject({
      method: "POST",
      url: `/inventory/gate-passes/${passId}/approve`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { authorizedBy: "Security Officer Hamdan" },
    });
    expect(resApprove.statusCode).toBe(200);
    expect(resApprove.json().pass.status).toBe("approved");

    // Dispatch Gate Pass
    const resDispatch = await app.inject({
      method: "POST",
      url: `/inventory/gate-passes/${passId}/dispatch`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(resDispatch.statusCode).toBe(200);
    expect(resDispatch.json().pass.status).toBe("dispatched");
    expect(resDispatch.json().pass.exit_time).toBeDefined();
  });

  it("enforces tenant isolation across inventory entities", async () => {
    const { app, inventoryRepo } = appWithFakeRepos();

    const locA = await inventoryRepo.createStoreLocation(ADMIN_TOKEN, {
      code: "TENANT-A-STORE",
      name: "Tenant A Main Store",
    });

    // Tenant B cannot fetch Tenant A's store location
    const resOther = await app.inject({
      method: "GET",
      url: `/inventory/locations/${locA.id}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(resOther.statusCode).toBe(404);
  });
});
