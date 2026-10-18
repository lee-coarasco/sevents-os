import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeContractsRepository } from "../../test/fakeContractsRepository.js";

describe("M23: Contracts, Claims, Variations & EOT routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let contractsRepo: FakeContractsRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "contracts.contract.manage",
    "contracts.variation.manage",
    "contracts.variation.approve",
    "contracts.claim.manage",
    "contracts.claim.assess",
    "contracts.security.manage",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    contractsRepo = new FakeContractsRepository();

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
    contractsRepo.addSession(tokenA, userA, tenantA);

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
    contractsRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getContractsRepository: () => contractsRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a contract and lists it with tenant isolation", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        project_id: "proj-1",
        contract_reference: "CTR-2026-001",
        title: "Main Structural & Civil Package",
        contract_type: "main_contract",
        counterparty_name: "Apex Engineering Group",
        original_value: 2500000,
        commencement_date: "2026-01-01",
        contractual_completion_date: "2026-12-31",
        governing_law: "FIDIC Red Book 1999 / English Law",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.contract.id).toBeDefined();
    expect(body.contract.contract_reference).toBe("CTR-2026-001");
    expect(body.contract.original_value).toBe(2500000);
    expect(body.contract.revised_value).toBe(2500000);
    expect(body.contract.revised_completion_date).toBe("2026-12-31");

    // Tenant A sees 1 contract
    const listResA = await app.inject({
      method: "GET",
      url: "/contracts",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listResA.statusCode).toBe(200);
    expect(listResA.json().contracts).toHaveLength(1);

    // Tenant B sees 0 contracts
    const listResB = await app.inject({
      method: "GET",
      url: "/contracts",
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(listResB.statusCode).toBe(200);
    expect(listResB.json().contracts).toHaveLength(0);
  });

  it("creates and approves a variation order with parent contract rollup", async () => {
    // 1. Create parent contract
    const contractRes = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        project_id: "proj-1",
        contract_reference: "CTR-2026-002",
        title: "MEP Services Package",
        contract_type: "subcontract",
        counterparty_name: "Delta MEP Solutions",
        original_value: 800000,
        commencement_date: "2026-03-01",
        contractual_completion_date: "2026-09-30",
      },
    });
    const contractId = contractRes.json().contract.id;

    // 2. Create variation order
    const voRes = await app.inject({
      method: "POST",
      url: "/contracts/variations",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        contract_id: contractId,
        project_id: "proj-1",
        vo_number: "VO-001",
        title: "Additional HVAC ducting for Level 4",
        description: "Re-routing ductwork due to structural clash",
        reason: "site_instruction",
        proposed_cost_amount: 50000,
        proposed_time_days: 14,
      },
    });
    expect(voRes.statusCode).toBe(201);
    const voId = voRes.json().variation.id;
    expect(voRes.json().variation.status).toBe("identified");

    // 3. Approve variation order
    const approveRes = await app.inject({
      method: "POST",
      url: `/contracts/variations/${voId}/approve`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        approved_cost_amount: 45000,
        approved_time_days: 10,
        approved_by: userA,
      },
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().variation.status).toBe("approved");
    expect(approveRes.json().variation.approved_cost_amount).toBe(45000);
    expect(approveRes.json().variation.approved_time_days).toBe(10);

    // 4. Verify parent contract revised values
    const fetchContract = await app.inject({
      method: "GET",
      url: `/contracts/${contractId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(fetchContract.statusCode).toBe(200);
    const updatedContract = fetchContract.json().contract;
    expect(updatedContract.revised_value).toBe(845000); // 800,000 + 45,000
    // 2026-09-30 + 10 days = 2026-10-10
    expect(updatedContract.revised_completion_date).toBe("2026-10-10");
  });

  it("calculates FIDIC 28-day notice deadline and warns on time-bar breach", async () => {
    // 1. Create contract
    const contractRes = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        project_id: "proj-1",
        contract_reference: "CTR-2026-003",
        title: "Facade Package",
        contract_type: "subcontract",
        counterparty_name: "Vertex Glass",
        original_value: 500000,
        commencement_date: "2026-01-01",
        contractual_completion_date: "2026-06-30",
      },
    });
    const contractId = contractRes.json().contract.id;

    // 2. Claim within 28 days
    const timelyClaimRes = await app.inject({
      method: "POST",
      url: "/contracts/claims",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        contract_id: contractId,
        project_id: "proj-1",
        claim_number: "CLM-001",
        title: "Late site access to Grid A-D",
        event_type: "late_access",
        event_date: "2026-02-01",
        notice_date: "2026-02-15", // 14 days later: within 28 days
        claimed_days: 20,
        claimed_cost_amount: 30000,
      },
    });
    expect(timelyClaimRes.statusCode).toBe(201);
    const timelyClaim = timelyClaimRes.json().claim;
    expect(timelyClaim.notice_deadline_date).toBe("2026-03-01");
    expect(timelyClaim.assessment_notes).toBeNull();

    // 3. Claim outside 28 days (breach of time-bar)
    const lateClaimRes = await app.inject({
      method: "POST",
      url: "/contracts/claims",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        contract_id: contractId,
        project_id: "proj-1",
        claim_number: "CLM-002",
        title: "Adverse storm flooding",
        event_type: "adverse_weather",
        event_date: "2026-01-01",
        notice_date: "2026-02-10", // 40 days later: exceeds 28 days
        claimed_days: 15,
        claimed_cost_amount: 12000,
      },
    });
    expect(lateClaimRes.statusCode).toBe(201);
    const lateClaim = lateClaimRes.json().claim;
    expect(lateClaim.notice_deadline_date).toBe("2026-01-29");
    expect(lateClaim.assessment_notes).toContain("FIDIC Cl. 20.1 Notice Warning: Notice issued after 28-day time bar");

    // 4. Assess timely claim with approval and EOT granted
    const assessRes = await app.inject({
      method: "POST",
      url: `/contracts/claims/${timelyClaim.id}/assess`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        certified_days: 15,
        certified_cost_amount: 25000,
        status: "approved",
        assessment_notes: "Delay on critical path substantiated by schedule analysis",
      },
    });
    expect(assessRes.statusCode).toBe(200);
    expect(assessRes.json().claim.status).toBe("approved");
    expect(assessRes.json().claim.certified_days).toBe(15);

    // Parent contract completion date extended by 15 days
    const checkContract = await app.inject({
      method: "GET",
      url: `/contracts/${contractId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    // 2026-06-30 + 15 days = 2026-07-15
    expect(checkContract.json().contract.revised_completion_date).toBe("2026-07-15");
  });

  it("manages contract securities (bonds & insurance register)", async () => {
    // 1. Create security
    const secRes = await app.inject({
      method: "POST",
      url: "/contracts/securities",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        contract_id: "ctr-dummy",
        project_id: "proj-1",
        security_type: "performance_bond",
        reference_number: "PB-HSBC-2026-99",
        issuing_institution: "HSBC Bank Middle East",
        beneficiary: "Sevents Prime Developments",
        amount: 250000,
        currency: "USD",
        effective_date: "2026-01-01",
        expiry_date: "2027-01-01",
      },
    });
    expect(secRes.statusCode).toBe(201);
    const secId = secRes.json().security.id;
    expect(secRes.json().security.status).toBe("active");

    // 2. Update status
    const statusRes = await app.inject({
      method: "POST",
      url: `/contracts/securities/${secId}/status`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { status: "released" },
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().security.status).toBe("released");

    // 3. List securities
    const listRes = await app.inject({
      method: "GET",
      url: "/contracts/securities",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().securities).toHaveLength(1);
    expect(listRes.json().securities[0].status).toBe("released");
  });
});
