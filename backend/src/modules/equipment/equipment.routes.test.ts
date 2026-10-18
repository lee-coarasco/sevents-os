import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../app.js";
import { FakeAuthorityRepository } from "../../test/fakeAuthorityRepository.js";
import { FakeEquipmentRepository } from "../../test/fakeEquipmentRepository.js";

describe("M25: Equipment, Plant & Fleet Operations routes", () => {
  let app: FastifyInstance;
  let authRepo: FakeAuthorityRepository;
  let equipmentRepo: FakeEquipmentRepository;

  const tenantA = "tenant-a-111";
  const userA = "user-a-111";
  const tokenA = "token-a-valid";

  const tenantB = "tenant-b-222";
  const userB = "user-b-222";
  const tokenB = "token-b-valid";

  const permissions = [
    "equipment.asset.manage",
    "equipment.allocation.manage",
    "equipment.allocation.approve",
    "equipment.log.manage",
    "equipment.maintenance.manage",
    "equipment.certificate.manage",
  ];

  beforeEach(async () => {
    authRepo = new FakeAuthorityRepository();
    equipmentRepo = new FakeEquipmentRepository();

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
    equipmentRepo.addSession(tokenA, userA, tenantA);

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
    equipmentRepo.addSession(tokenB, userB, tenantB);

    app = buildApp({
      getAuthorityRepository: () => authRepo,
      getEquipmentRepository: () => equipmentRepo,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const authHeader = (token: string) => ({
    authorization: `Bearer ${token}`,
  });

  it("registers new equipment assets and manages status lifecycle", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/equipment/assets",
      headers: authHeader(tokenA),
      payload: {
        assetCode: "TC-01",
        name: "Liebherr 280 EC-H 12 Litronic Tower Crane",
        category: "lifting_rigging",
        make: "Liebherr",
        model: "280 EC-H",
        yearOfManufacture: 2022,
        serialOrVin: "SN-98234-TC",
        ownershipType: "owned",
        dailyRate: 1500,
        currentMeterHours: 350,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.asset.asset_code).toBe("TC-01");
    expect(body.asset.status).toBe("available");
    expect(body.asset.daily_rate).toBe(1500);

    // List assets
    const listRes = await app.inject({
      method: "GET",
      url: "/equipment/assets?category=lifting_rigging",
      headers: authHeader(tokenA),
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().assets.length).toBe(1);
  });

  it("creates project mobilization allocation and authorizes deployment", async () => {
    // 1. Create asset
    const asset = await equipmentRepo.createAsset(tokenA, {
      asset_code: "EXC-05",
      name: "CAT 320 GC Hydraulic Excavator",
      category: "earthmoving",
      make: "Caterpillar",
      model: "320 GC",
      ownership_type: "owned",
      daily_rate: 800,
    });

    // 2. Request allocation
    const reqRes = await app.inject({
      method: "POST",
      url: "/equipment/allocations",
      headers: authHeader(tokenA),
      payload: {
        equipmentId: asset.id,
        projectId: "proj-101",
        allocationNumber: "MOB-2026-001",
        mobilizationDate: "2026-10-20T07:00:00Z",
        expectedDemobilizationDate: "2026-11-20T18:00:00Z",
        gridLocation: "Basement Excavation Zone A",
        requestedBy: "Eng. Tariq",
        notes: "Deep excavation for foundation raft",
      },
    });

    expect(reqRes.statusCode).toBe(201);
    const allocId = reqRes.json().allocation.id;
    expect(reqRes.json().allocation.status).toBe("requested");

    // 3. Authorize mobilization
    const authRes = await app.inject({
      method: "POST",
      url: `/equipment/allocations/${allocId}/authorize`,
      headers: authHeader(tokenA),
      payload: {
        status: "mobilized",
        approvedBy: "Plant Manager Robert",
      },
    });

    expect(authRes.statusCode).toBe(200);
    expect(authRes.json().allocation.status).toBe("mobilized");
    expect(authRes.json().allocation.equipment.status).toBe("mobilized_on_site");
    expect(authRes.json().allocation.equipment.current_project_id).toBe("proj-101");
  });

  it("records daily equipment utilization and advances meter reading", async () => {
    const asset = await equipmentRepo.createAsset(tokenA, {
      asset_code: "GEN-01",
      name: "Perkins 500kVA Diesel Generator",
      category: "power_generation",
      make: "Perkins",
      model: "500kVA",
      ownership_type: "leased",
      hire_vendor_name: "Aggreko Middle East",
      daily_rate: 450,
      current_meter_hours: 1200,
    });

    const logRes = await app.inject({
      method: "POST",
      url: "/equipment/daily-logs",
      headers: authHeader(tokenA),
      payload: {
        equipmentId: asset.id,
        projectId: "proj-101",
        logDate: "2026-10-18",
        operatingHours: 9.5,
        idleHours: 1.5,
        breakdownHours: 0,
        startMeterReading: 1200,
        endMeterReading: 1209.5,
        fuelAddedLitres: 180,
        operatorName: "Rashid Khan",
        workDescription: "Primary power to tower crane and site cabins",
        supervisorSignoff: "Eng. Ahmed",
      },
    });

    expect(logRes.statusCode).toBe(201);
    expect(logRes.json().log.operating_hours).toBe(9.5);

    // Verify asset meter hours were updated
    const updatedAsset = await equipmentRepo.getAssetById(tokenA, asset.id);
    expect(updatedAsset?.current_meter_hours).toBe(1209.5);
  });

  it("manages preventive maintenance and statutory safety certifications", async () => {
    const asset = await equipmentRepo.createAsset(tokenA, {
      asset_code: "MC-02",
      name: "Tadano 50T Mobile Crane",
      category: "lifting_rigging",
      make: "Tadano",
      model: "GR-500EX",
      ownership_type: "owned",
      daily_rate: 1100,
      current_meter_hours: 2400,
    });

    // 1. Record maintenance
    const maintRes = await app.inject({
      method: "POST",
      url: "/equipment/maintenance",
      headers: authHeader(tokenA),
      payload: {
        equipmentId: asset.id,
        maintenanceType: "preventive_service",
        maintenanceDate: "2026-10-18",
        meterHoursAtService: 2400,
        cost: 2800,
        performedBy: "Al Futtaim Motors Machinery",
        description: "2500-hour major hydraulic oil and filter replacement",
        nextDueDate: "2027-04-18",
        nextDueMeterHours: 2900,
        status: "completed",
      },
    });
    expect(maintRes.statusCode).toBe(201);
    expect(maintRes.json().record.cost).toBe(2800);

    // 2. Issue statutory 3rd party certification
    const certRes = await app.inject({
      method: "POST",
      url: "/equipment/certificates",
      headers: authHeader(tokenA),
      payload: {
        equipmentId: asset.id,
        certificateType: "safe_working_load_3rd_party",
        certificateNumber: "TUV-SWL-2026-8891",
        issuingAuthority: "TUV Middle East (DAC Accredited)",
        issueDate: "2026-10-18",
        expiryDate: "2027-10-17",
      },
    });
    expect(certRes.statusCode).toBe(201);
    expect(certRes.json().certificate.status).toBe("valid");

    // List certificates
    const certList = await app.inject({
      method: "GET",
      url: `/equipment/certificates?equipmentId=${asset.id}`,
      headers: authHeader(tokenA),
    });
    expect(certList.statusCode).toBe(200);
    expect(certList.json().certificates.length).toBe(1);
  });

  it("enforces tenant RLS isolation across assets and allocations", async () => {
    // Tenant 1 asset
    await equipmentRepo.createAsset(tokenA, {
      asset_code: "T1-BOOM",
      name: "Tenant 1 Manlift",
      category: "lifting_rigging",
      make: "Genie",
      model: "S-65",
      ownership_type: "owned",
      daily_rate: 400,
    });

    // Tenant 2 asset
    await equipmentRepo.createAsset(tokenB, {
      asset_code: "T2-BOOM",
      name: "Tenant 2 Manlift",
      category: "lifting_rigging",
      make: "JLG",
      model: "800AJ",
      ownership_type: "owned",
      daily_rate: 600,
    });

    // Tenant 1 only sees T1
    const t1Res = await app.inject({
      method: "GET",
      url: "/equipment/assets",
      headers: authHeader(tokenA),
    });
    expect(t1Res.json().assets.length).toBe(1);
    expect(t1Res.json().assets[0].asset_code).toBe("T1-BOOM");

    // Tenant 2 only sees T2
    const t2Res = await app.inject({
      method: "GET",
      url: "/equipment/assets",
      headers: authHeader(tokenB),
    });
    expect(t2Res.json().assets.length).toBe(1);
    expect(t2Res.json().assets[0].asset_code).toBe("T2-BOOM");
  });
});
