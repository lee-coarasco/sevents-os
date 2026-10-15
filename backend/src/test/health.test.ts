import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildApp } from "../app.js";

function fakeClient(result: { error: Error | null }): SupabaseClient {
  return {
    auth: {
      admin: {
        listUsers: async () => result,
      },
    },
  } as unknown as SupabaseClient;
}

describe("GET /health", () => {
  it("returns 200 and status ok when Supabase is reachable", async () => {
    const app = buildApp({
      getSupabaseClient: () => fakeClient({ error: null }),
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", supabase: "reachable" });
  });

  it("returns 503 and status degraded when Supabase is unreachable", async () => {
    const app = buildApp({
      getSupabaseClient: () => fakeClient({ error: new Error("boom") }),
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "degraded",
      supabase: "unreachable",
    });
  });

  it("returns 503 when the Supabase client cannot even be constructed", async () => {
    const app = buildApp({
      getSupabaseClient: () => {
        throw new Error("missing env vars");
      },
    });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(503);
  });
});
