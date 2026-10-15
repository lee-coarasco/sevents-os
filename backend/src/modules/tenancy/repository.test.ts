import { beforeEach, describe, expect, it } from "vitest";
import { FakeTenancyRepository } from "../../test/fakeTenancyRepository.js";

describe("cross-tenant isolation", () => {
  let repo: FakeTenancyRepository;
  const tokenA = "token-tenant-a";
  const tokenB = "token-tenant-b";

  beforeEach(() => {
    repo = new FakeTenancyRepository();
    repo.addSession(tokenA, "tenant-a");
    repo.addSession(tokenB, "tenant-b");
  });

  it("a tenant's own company list never includes another tenant's companies", async () => {
    await repo.createCompany(tokenA, { legal_name: "Tenant A Co" });
    await repo.createCompany(tokenB, { legal_name: "Tenant B Co" });

    const asA = await repo.listCompanies(tokenA);
    const asB = await repo.listCompanies(tokenB);

    expect(asA).toHaveLength(1);
    expect(asA[0]?.legal_name).toBe("Tenant A Co");
    expect(asB).toHaveLength(1);
    expect(asB[0]?.legal_name).toBe("Tenant B Co");
  });

  it("getCompany for another tenant's company id returns null, not the row", async () => {
    const companyB = await repo.createCompany(tokenB, { legal_name: "Tenant B Co" });

    const result = await repo.getCompany(tokenA, companyB.id);

    expect(result).toBeNull();
  });

  it("branches are scoped the same way as companies", async () => {
    const companyB = await repo.createCompany(tokenB, { legal_name: "Tenant B Co" });
    await repo.createBranch(tokenB, { company_id: companyB.id, name: "Dubai HQ" });

    const asA = await repo.listBranches(tokenA, companyB.id);

    expect(asA).toHaveLength(0);
  });

  it("projects are scoped per tenant: listProjects and getProject never cross tenants", async () => {
    const companyA = await repo.createCompany(tokenA, { legal_name: "Tenant A Co" });
    const companyB = await repo.createCompany(tokenB, { legal_name: "Tenant B Co" });
    await repo.createProject(tokenA, { company_id: companyA.id, name: "A Tower" });
    const projectB = await repo.createProject(tokenB, { company_id: companyB.id, name: "B Tower" });

    const asAList = await repo.listProjects(tokenA);
    expect(asAList.every((p) => p.tenant_id === "tenant-a")).toBe(true);

    const crossRead = await repo.getProject(tokenA, projectB.id);
    expect(crossRead).toBeNull();
  });

  it("file object metadata is scoped per tenant", async () => {
    const companyA = await repo.createCompany(tokenA, { legal_name: "Tenant A Co" });
    const companyB = await repo.createCompany(tokenB, { legal_name: "Tenant B Co" });

    await repo.registerFileObject(tokenA, {
      company_id: companyA.id,
      bucket: "documents",
      storage_path: "a/file.pdf",
    });
    await repo.registerFileObject(tokenB, {
      company_id: companyB.id,
      bucket: "documents",
      storage_path: "b/file.pdf",
    });

    expect([...repo.fileObjects.values()].filter((f) => f.tenant_id === "tenant-a")).toHaveLength(
      1,
    );
    expect([...repo.fileObjects.values()].filter((f) => f.tenant_id === "tenant-b")).toHaveLength(
      1,
    );
  });

  it("an access token with no tenant assigned cannot read or write anything", async () => {
    await expect(repo.listCompanies("token-no-tenant")).rejects.toThrow();
    await expect(
      repo.createCompany("token-no-tenant", { legal_name: "Should not work" }),
    ).rejects.toThrow();
  });
});
