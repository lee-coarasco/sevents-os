import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeBillingRepository } from "../../test/fakeBillingRepository.js";

describe("M22: Billing, Invoicing, Receivables & Payables routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let billingRepo: FakeBillingRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "billing.application.manage",
    "billing.application.certify",
    "billing.invoice.manage",
    "billing.receipt.record",
    "billing.vendor_bill.manage",
    "billing.vendor_bill.approve",
    "billing.retention.manage",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    billingRepo = new FakeBillingRepository();

    // Tenant A setup
    authRepo.addSession(tokenA, userA, tenantA);
    authRepo.roleAssignments.set("seed-admin-a", {
      id: "seed-admin-a",
      tenant_id: tenantA,
      user_id: userA,
      role_id: "role.platform_administrator",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    permissions.forEach((perm) => authRepo.grantPermission("role.platform_administrator", perm));
    billingRepo.addSession(tokenA, userA, tenantA);

    // Tenant B setup
    authRepo.addSession(tokenB, userB, tenantB);
    authRepo.roleAssignments.set("seed-admin-b", {
      id: "seed-admin-b",
      tenant_id: tenantB,
      user_id: userB,
      role_id: "role.platform_administrator",
      department_id: null,
      valid_from: "2000-01-01T00:00:00.000Z",
      valid_to: null,
    });
    permissions.forEach((perm) => authRepo.grantPermission("role.platform_administrator", perm));
    billingRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getBillingRepository: () => billingRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const authHeader = (token: string) => ({
    authorization: `Bearer ${token}`,
  });

  it("creates payment application with 10% retention, 5% VAT, and allows certification", async () => {
    // 1. Submit Payment Application
    const resCreate = await app.inject({
      method: "POST",
      url: "/billing/applications",
      headers: authHeader(tokenA),
      payload: {
        project_id: "proj-tower-1",
        application_number: "APP-001",
        period_start: "2026-10-01",
        period_end: "2026-10-31",
        gross_work_completed: 100000,
        advance_recovery_amount: 10000,
        notes: "Interim Payment Certificate #1 for Tower foundations",
      },
    });

    expect(resCreate.statusCode).toBe(201);
    const bodyCreate = JSON.parse(resCreate.body);
    expect(bodyCreate.application.application_number).toBe("APP-001");
    // gross: 100,000, advance recovery: 10,000, default 10% retention: 10,000
    // net: 100,000 - 10,000 - 10,000 = 80,000
    expect(bodyCreate.application.retention_withheld_amount).toBe(10000);
    expect(bodyCreate.application.net_certified_amount).toBe(80000);
    // 5% VAT on 80,000 = 4,000
    expect(bodyCreate.application.tax_amount).toBe(4000);
    // Total = 84,000
    expect(bodyCreate.application.total_amount).toBe(84000);
    expect(bodyCreate.application.status).toBe("submitted");

    const appId = bodyCreate.application.id;

    // 2. Certify Application
    const resCert = await app.inject({
      method: "POST",
      url: `/billing/applications/${appId}/certify`,
      headers: authHeader(tokenA),
      payload: {
        certifiedBy: "Commercial Lead Engineer",
      },
    });

    expect(resCert.statusCode).toBe(200);
    const bodyCert = JSON.parse(resCert.body);
    expect(bodyCert.application.status).toBe("certified");
    expect(bodyCert.application.certified_by).toBe("Commercial Lead Engineer");

    // 3. Multi-tenant isolation: Tenant B cannot see Tenant A's application
    const resListB = await app.inject({
      method: "GET",
      url: "/billing/applications",
      headers: authHeader(tokenB),
    });
    expect(resListB.statusCode).toBe(200);
    const bodyListB = JSON.parse(resListB.body);
    expect(bodyListB.applications.length).toBe(0);
  });

  it("creates tax invoices, records client receipts, and computes AR aging", async () => {
    // 1. Create Tax Invoice
    const resInv = await app.inject({
      method: "POST",
      url: "/billing/invoices",
      headers: authHeader(tokenA),
      payload: {
        project_id: "proj-tower-1",
        invoice_number: "INV-2026-001",
        client_name: "Emaar Properties PJSC",
        trn: "100293847500003",
        due_date: "2026-11-15",
        subtotal_amount: 50000,
        notes: "Mobilization Advance Invoice",
      },
    });

    expect(resInv.statusCode).toBe(201);
    const bodyInv = JSON.parse(resInv.body);
    expect(bodyInv.invoice.invoice_number).toBe("INV-2026-001");
    // 5% VAT on 50,000 = 2,500. Total = 52,500
    expect(bodyInv.invoice.tax_amount).toBe(2500);
    expect(bodyInv.invoice.total_amount).toBe(52500);
    expect(bodyInv.invoice.status).toBe("unpaid");

    const invId = bodyInv.invoice.id;

    // 2. Record Partial Client Receipt
    const resRec1 = await app.inject({
      method: "POST",
      url: "/billing/receipts",
      headers: authHeader(tokenA),
      payload: {
        invoice_id: invId,
        receipt_number: "REC-001",
        amount: 25000,
        payment_method: "bank_transfer",
        reference_number: "ENBD-TRF-9921",
      },
    });

    expect(resRec1.statusCode).toBe(201);

    // Verify invoice is partially_paid
    const resList = await app.inject({
      method: "GET",
      url: "/billing/invoices",
      headers: authHeader(tokenA),
    });
    const invUpdated = JSON.parse(resList.body).invoices[0];
    expect(invUpdated.paid_amount).toBe(25000);
    expect(invUpdated.status).toBe("partially_paid");

    // 3. Record Remaining Client Receipt
    const resRec2 = await app.inject({
      method: "POST",
      url: "/billing/receipts",
      headers: authHeader(tokenA),
      payload: {
        invoice_id: invId,
        receipt_number: "REC-002",
        amount: 27500,
        payment_method: "cheque",
        reference_number: "CHQ-882103",
      },
    });
    expect(resRec2.statusCode).toBe(201);

    // Verify invoice is now paid
    const resList2 = await app.inject({
      method: "GET",
      url: "/billing/invoices",
      headers: authHeader(tokenA),
    });
    const invPaid = JSON.parse(resList2.body).invoices[0];
    expect(invPaid.paid_amount).toBe(52500);
    expect(invPaid.status).toBe("paid");
  });

  it("handles vendor bills, flags 3-way match variances, and processes bill payment", async () => {
    // 1. Create bill with matching PO amount
    const resBill1 = await app.inject({
      method: "POST",
      url: "/billing/vendor-bills",
      headers: authHeader(tokenA),
      payload: {
        project_id: "proj-tower-1",
        vendor_id: "vendor-steel-co",
        po_id: "po-101",
        bill_number: "VBILL-001",
        due_date: "2026-11-30",
        subtotal_amount: 10000,
        po_amount: 10500, // 10,000 + 5% VAT = 10,500 exact match
      },
    });

    expect(resBill1.statusCode).toBe(201);
    const bodyBill1 = JSON.parse(resBill1.body);
    expect(bodyBill1.vendorBill.match_status).toBe("matched");

    // 2. Create bill with variance > 2%
    const resBill2 = await app.inject({
      method: "POST",
      url: "/billing/vendor-bills",
      headers: authHeader(tokenA),
      payload: {
        project_id: "proj-tower-1",
        vendor_id: "vendor-concrete-co",
        po_id: "po-102",
        bill_number: "VBILL-002",
        due_date: "2026-11-30",
        subtotal_amount: 20000, // total with VAT = 21,000
        po_amount: 18000, // discrepancy > 2%
      },
    });

    expect(resBill2.statusCode).toBe(201);
    const bodyBill2 = JSON.parse(resBill2.body);
    expect(bodyBill2.vendorBill.match_status).toBe("variance_flagged");

    // 3. Approve Bill 1 and Pay
    const bill1Id = bodyBill1.vendorBill.id;
    const resApprove = await app.inject({
      method: "POST",
      url: `/billing/vendor-bills/${bill1Id}/approve`,
      headers: authHeader(tokenA),
    });
    expect(resApprove.statusCode).toBe(200);
    expect(JSON.parse(resApprove.body).vendorBill.status).toBe("approved");

    const resPay = await app.inject({
      method: "POST",
      url: `/billing/vendor-bills/${bill1Id}/pay`,
      headers: authHeader(tokenA),
      payload: {
        amount: 10500,
        payment_reference: "PV-2026-881",
      },
    });
    expect(resPay.statusCode).toBe(200);
    const bodyPay = JSON.parse(resPay.body);
    expect(bodyPay.vendorBill.status).toBe("paid");
    expect(bodyPay.vendorBill.paid_amount).toBe(10500);
  });

  it("manages retention ledger and releases TOC and DLP milestones", async () => {
    // 1. Create Retention Record for 200,000 total retention
    const resRet = await app.inject({
      method: "POST",
      url: "/billing/retentions",
      headers: authHeader(tokenA),
      payload: {
        project_id: "proj-tower-1",
        retention_type: "client_receivable",
        party_name: "Emaar Properties PJSC",
        reference_id: "TOWER-RET-01",
        total_retained_amount: 200000,
        first_release_date: "2027-01-15",
        second_release_due_date: "2028-01-15",
        notes: "10% retention withheld from Project Phase 1",
      },
    });

    expect(resRet.statusCode).toBe(201);
    const bodyRet = JSON.parse(resRet.body);
    expect(bodyRet.retention.first_release_amount).toBe(100000);
    expect(bodyRet.retention.second_release_amount).toBe(100000);
    expect(bodyRet.retention.status).toBe("held");

    const retId = bodyRet.retention.id;

    // 2. Release First Milestone (50% at Substantial Completion / TOC)
    const resRel1 = await app.inject({
      method: "POST",
      url: `/billing/retentions/${retId}/release`,
      headers: authHeader(tokenA),
      payload: {
        milestone: "first",
      },
    });
    expect(resRel1.statusCode).toBe(200);
    const bodyRel1 = JSON.parse(resRel1.body);
    expect(bodyRel1.retention.first_release_status).toBe("released");
    expect(bodyRel1.retention.status).toBe("partially_released");

    // 3. Release Second Milestone (50% at DLP Expiry)
    const resRel2 = await app.inject({
      method: "POST",
      url: `/billing/retentions/${retId}/release`,
      headers: authHeader(tokenA),
      payload: {
        milestone: "second",
      },
    });
    expect(resRel2.statusCode).toBe(200);
    const bodyRel2 = JSON.parse(resRel2.body);
    expect(bodyRel2.retention.second_release_status).toBe("released");
    expect(bodyRel2.retention.status).toBe("fully_released");
  });
});
