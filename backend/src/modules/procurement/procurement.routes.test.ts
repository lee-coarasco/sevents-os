import { describe, expect, it } from "vitest";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeProcurementRepository } from "../../test/fakeProcurementRepository.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER = "admin-user";
const TENANT_A = "tenant-a";

const OTHER_TENANT_TOKEN = "other-tenant-token";
const OTHER_USER = "other-user";
const TENANT_B = "tenant-b";

const PLAIN_TOKEN = "plain-token";
const PLAIN_USER = "plain-user";

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
  authorityRepo.grantPermission("role.platform_administrator", "procurement.vendor.manage");
  authorityRepo.grantPermission("role.platform_administrator", "procurement.requisition.manage");
  authorityRepo.grantPermission("role.platform_administrator", "procurement.requisition.approve");
  authorityRepo.grantPermission("role.platform_administrator", "procurement.po.manage");
  authorityRepo.grantPermission("role.platform_administrator", "procurement.po.approve");

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

  // Plain user with no procurement permissions
  authorityRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);

  const procurementRepo = new FakeProcurementRepository();
  procurementRepo.addSession(ADMIN_TOKEN, ADMIN_USER, TENANT_A);
  procurementRepo.addSession(OTHER_TENANT_TOKEN, OTHER_USER, TENANT_B);
  procurementRepo.addSession(PLAIN_TOKEN, PLAIN_USER, TENANT_A);

  const app = buildApp({
    getAuthorityRepository: () => authorityRepo,
    getProcurementRepository: () => procurementRepo,
  });

  return { app, procurementRepo, authorityRepo };
}

describe("Procurement & Purchase Orders (M14) Routes", () => {
  it("manages approved vendors (AVL)", async () => {
    const { app } = appWithFakeRepos();

    // Create vendor
    const createRes = await app.inject({
      method: "POST",
      url: "/procurement/vendors",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        name: "Emirates Steel Industries",
        tradeLicenseNumber: "TL-ESTEEL-990",
        taxRegistrationNumber: "100234567800003",
        contactPerson: "Ahmed Al Mansoori",
        email: "sales@emiratessteel.example",
        phone: "+971 2 550 0000",
        category: "materials",
        rating: 4.8,
        status: "active",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const vendor = createRes.json().vendor;
    expect(vendor.id).toBeDefined();
    expect(vendor.name).toBe("Emirates Steel Industries");
    expect(vendor.category).toBe("materials");

    // List vendors
    const listRes = await app.inject({
      method: "GET",
      url: "/procurement/vendors?category=materials",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().vendors.length).toBe(1);

    // Update vendor rating
    const updateRes = await app.inject({
      method: "PATCH",
      url: `/procurement/vendors/${vendor.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { rating: 5.0 },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().vendor.rating).toBe(5.0);
  });

  it("manages purchase requisition lifecycle and auto-calculates total estimated amount", async () => {
    const { app } = appWithFakeRepos();

    // 1. Create PR
    const createRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/procurement/requisitions",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        prNumber: "PR-2026-001",
        title: "Foundation Rebar & Structural Steel",
        requiredDate: "2026-11-01",
        priority: "urgent",
      },
    });

    expect(createRes.statusCode).toBe(201);
    const req = createRes.json().requisition;
    expect(req.pr_number).toBe("PR-2026-001");
    expect(req.status).toBe("draft");
    expect(req.total_estimated_amount).toBe(0);

    // 2. Add line items to PR
    const item1 = await app.inject({
      method: "POST",
      url: `/procurement/requisitions/${req.id}/items`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        itemDescription: "High-yield deformed steel bars 16mm",
        costCode: "MAT-STEEL-16",
        quantity: 50,
        uom: "ton",
        estimatedUnitRate: 2800,
      },
    });
    expect(item1.statusCode).toBe(201);
    expect(item1.json().item.estimated_total_amount).toBe(140000);

    const item2 = await app.inject({
      method: "POST",
      url: `/procurement/requisitions/${req.id}/items`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        itemDescription: "High-yield deformed steel bars 20mm",
        costCode: "MAT-STEEL-20",
        quantity: 20,
        uom: "ton",
        estimatedUnitRate: 2900,
      },
    });
    expect(item2.statusCode).toBe(201);
    expect(item2.json().item.estimated_total_amount).toBe(58000);

    // 3. Verify detail and auto-computed total (140,000 + 58,000 = 198,000)
    const detailRes = await app.inject({
      method: "GET",
      url: `/procurement/requisitions/${req.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = detailRes.json();
    expect(detail.items.length).toBe(2);
    expect(detail.requisition.total_estimated_amount).toBe(198000);

    // 4. Submit PR
    const submitRes = await app.inject({
      method: "POST",
      url: `/procurement/requisitions/${req.id}/submit`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().requisition.status).toBe("submitted");

    // 5. Approve PR
    const approveRes = await app.inject({
      method: "POST",
      url: `/procurement/requisitions/${req.id}/approve`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { approvedBy: "CPO Tariq" },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().requisition.status).toBe("approved");
    expect(approveRes.json().requisition.approved_by).toBe("CPO Tariq");
  });

  it("handles purchase orders with item tax and delivery status tracking", async () => {
    const { app } = appWithFakeRepos();

    // Create vendor
    const vRes = await app.inject({
      method: "POST",
      url: "/procurement/vendors",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Gulf Ready Mix LLC", category: "materials" },
    });
    const vendorId = vRes.json().vendor.id;

    // Create PO
    const poRes = await app.inject({
      method: "POST",
      url: "/projects/proj-101/procurement/orders",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        vendorId,
        poNumber: "PO-2026-088",
        orderDate: "2026-10-18",
        expectedDeliveryDate: "2026-10-25",
        deliveryAddress: "Skyline Tower Site Gate 2, Dubai Marina",
        paymentTerms: "30 Days PDC upon GRN",
      },
    });
    expect(poRes.statusCode).toBe(201);
    const po = poRes.json().order;
    expect(po.po_number).toBe("PO-2026-088");
    expect(po.status).toBe("draft");

    // Add item to PO: 100 cum @ 250 AED = 25,000 AED
    const itemRes = await app.inject({
      method: "POST",
      url: `/procurement/orders/${po.id}/items`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: {
        itemDescription: "Grade 40 Ready Mix Concrete with Silica Fume",
        quantity: 100,
        uom: "cum",
        unitPrice: 250,
      },
    });
    expect(itemRes.statusCode).toBe(201);
    const poItem = itemRes.json().item;
    expect(poItem.total_amount).toBe(25000);

    // Verify PO recalculation: Subtotal 25,000, 5% Tax 1,250, Total 26,250
    const detailRes = await app.inject({
      method: "GET",
      url: `/procurement/orders/${po.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    const updatedPo = detailRes.json().order;
    expect(updatedPo.subtotal_amount).toBe(25000);
    expect(updatedPo.tax_amount).toBe(1250);
    expect(updatedPo.total_amount).toBe(26250);

    // Issue PO
    const issueRes = await app.inject({
      method: "POST",
      url: `/procurement/orders/${po.id}/issue`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(issueRes.statusCode).toBe(200);
    expect(issueRes.json().order.status).toBe("issued");

    // Mark delivery as delivered
    const deliveryRes = await app.inject({
      method: "PATCH",
      url: `/procurement/orders/${po.id}/items/${poItem.id}/delivery`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { deliveryStatus: "delivered" },
    });
    expect(deliveryRes.statusCode).toBe(200);
    expect(deliveryRes.json().item.delivery_status).toBe("delivered");

    // Verify PO automatically marked as delivered
    const poFinal = await app.inject({
      method: "GET",
      url: `/procurement/orders/${po.id}`,
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    expect(poFinal.json().order.status).toBe("delivered");
  });

  it("enforces tenant isolation across all procurement records", async () => {
    const { app } = appWithFakeRepos();

    // Create vendor in Tenant A
    const vRes = await app.inject({
      method: "POST",
      url: "/procurement/vendors",
      headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
      payload: { name: "Tenant A Supplier" },
    });
    const vendorId = vRes.json().vendor.id;

    // Caller from Tenant B cannot access Tenant A vendor
    const getRes = await app.inject({
      method: "GET",
      url: `/procurement/vendors/${vendorId}`,
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(getRes.statusCode).toBe(404);

    // Caller from Tenant B listing vendors sees 0
    const listRes = await app.inject({
      method: "GET",
      url: "/procurement/vendors",
      headers: { authorization: `Bearer ${OTHER_TENANT_TOKEN}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().vendors.length).toBe(0);
  });
});
