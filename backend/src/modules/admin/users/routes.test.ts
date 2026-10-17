import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { adminUsersRoutes } from "./routes.js";
import { FakeAuthorityRepository } from "../../../test/fakeAuthorityRepository.js";
import { requirePermission } from "../../authority/guard.js";

const ADMIN_TOKEN = "admin-token";
const ADMIN_USER_ID = "admin-user";
const TENANT_ID = "tenant-test";
const TARGET_USER_ID = "target-user";

function makeSupabaseStub(overrides: Record<string, unknown> = {}) {
  const fromChain = {
    select: () => fromChain,
    eq: () => fromChain,
    in: () => fromChain,
    is: () => fromChain,
    order: () => fromChain,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: { id: TARGET_USER_ID, email: "user@test.com", display_name: null, status: "pending", created_at: "2026-01-01T00:00:00Z" }, error: null }),
    update: () => fromChain,
    insert: () => Promise.resolve({ data: null, error: null }),
    upsert: () => fromChain,
    ...overrides,
  };
  return {
    from: () => fromChain,
    auth: {
      admin: {
        inviteUserByEmail: vi.fn().mockResolvedValue({
          data: { user: { id: TARGET_USER_ID } },
          error: null,
        }),
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  };
}

function buildTestApp(supabaseStub: ReturnType<typeof makeSupabaseStub>) {
  const authorityRepo = new FakeAuthorityRepository();
  authorityRepo.addSession(ADMIN_TOKEN, ADMIN_USER_ID, TENANT_ID);
  authorityRepo.grantPermission("role.platform_administrator", "admin.users.manage");
  authorityRepo.roleAssignments.set("seed", {
    id: "seed",
    tenant_id: TENANT_ID,
    user_id: ADMIN_USER_ID,
    role_id: "role.platform_administrator",
    department_id: null,
    valid_from: "2000-01-01T00:00:00.000Z",
    valid_to: null,
  });

  const app = Fastify({ logger: false });
  const getAuthorityRepository = () => authorityRepo;
  const guard = (permission: string) =>
    requirePermission(getAuthorityRepository, permission);

  app.register(adminUsersRoutes, {
    getServiceClient: () => supabaseStub as unknown as import("@supabase/supabase-js").SupabaseClient,
    requirePermission: guard,
  });

  return app;
}

const adminHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` };

describe("GET /admin/users", () => {
  it("200s and returns users list for an admin caller", async () => {
    const stub = makeSupabaseStub();
    // Mock the from().select().eq().order() chain to return an empty array
    const fromChain = {
      select: () => fromChain,
      eq: () => fromChain,
      in: () => fromChain,
      is: () => fromChain,
      order: () => Promise.resolve({ data: [], error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      update: () => fromChain,
      insert: () => Promise.resolve({ data: null, error: null }),
      upsert: () => fromChain,
    };
    const supabase = { ...stub, from: () => fromChain };
    const app = buildTestApp(supabase as unknown as ReturnType<typeof makeSupabaseStub>);

    const res = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("users");
  });

  it("401s with no bearer token", async () => {
    const app = buildTestApp(makeSupabaseStub());
    const res = await app.inject({ method: "GET", url: "/admin/users" });
    expect(res.statusCode).toBe(401);
  });

  it("403s for a caller without admin.users.manage", async () => {
    const authorityRepo = new FakeAuthorityRepository();
    const otherToken = "other-token";
    authorityRepo.addSession(otherToken, "other-user", TENANT_ID);
    // no admin.users.manage granted

    const app = Fastify({ logger: false });
    app.register(adminUsersRoutes, {
      getServiceClient: () => makeSupabaseStub() as unknown as import("@supabase/supabase-js").SupabaseClient,
      requirePermission: (p) => requirePermission(() => authorityRepo, p),
    });

    const res = await app.inject({
      method: "GET",
      url: "/admin/users",
      headers: { authorization: `Bearer ${otherToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("POST /admin/users/invite", () => {
  it("201s and invites a new user", async () => {
    const stub = makeSupabaseStub();
    const fromChain = {
      select: () => fromChain,
      eq: () => fromChain,
      in: () => fromChain,
      is: () => fromChain,
      order: () => Promise.resolve({ data: [], error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: { id: TARGET_USER_ID, email: "invited@test.com", display_name: null, status: "pending", created_at: "2026-01-01T00:00:00Z" }, error: null }),
      update: () => fromChain,
      insert: () => Promise.resolve({ data: null, error: null }),
      upsert: () => fromChain,
    };
    const supabase = { ...stub, from: () => fromChain };
    const app = buildTestApp(supabase as unknown as ReturnType<typeof makeSupabaseStub>);

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/invite",
      headers: adminHeaders,
      payload: { email: "invited@test.com", role_id: "role.project_manager" },
    });

    expect(res.statusCode).toBe(201);
    expect(supabase.auth.admin.inviteUserByEmail).toHaveBeenCalledWith("invited@test.com");
  });

  it("400s when email or role_id is missing", async () => {
    const app = buildTestApp(makeSupabaseStub());
    const res = await app.inject({
      method: "POST",
      url: "/admin/users/invite",
      headers: adminHeaders,
      payload: { email: "no-role@test.com" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /admin/users/:id/role", () => {
  it("200s when reassigning a role", async () => {
    const fromChain = {
      select: () => fromChain,
      eq: () => fromChain,
      in: () => fromChain,
      is: () => fromChain,
      order: () => Promise.resolve({ data: [], error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      single: () => Promise.resolve({ data: null, error: null }),
      update: () => fromChain,
      insert: () => Promise.resolve({ data: null, error: null }),
      upsert: () => fromChain,
    };
    const stub = makeSupabaseStub();
    const supabase = { ...stub, from: () => fromChain };
    const app = buildTestApp(supabase as unknown as ReturnType<typeof makeSupabaseStub>);

    const res = await app.inject({
      method: "PATCH",
      url: `/admin/users/${TARGET_USER_ID}/role`,
      headers: adminHeaders,
      payload: { role_id: "role.site_engineer" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it("400s when role_id is missing", async () => {
    const app = buildTestApp(makeSupabaseStub());
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/users/${TARGET_USER_ID}/role`,
      headers: adminHeaders,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});
