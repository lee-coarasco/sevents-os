import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface HealthRouteOptions {
  /** Injected for testability; defaults to the real service client lazily. */
  getSupabaseClient: () => SupabaseClient;
}

export async function healthRoute(
  app: FastifyInstance,
  options: HealthRouteOptions,
) {
  app.get("/health", async (_request, reply) => {
    let supabase: "reachable" | "unreachable" = "unreachable";

    try {
      const client = options.getSupabaseClient();
      // getSession() never hits the network for a service-role client with
      // persistSession disabled; auth.admin.listUsers with a tiny page size
      // is the cheapest real round-trip that proves the URL/key are valid.
      const { error } = await client.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      supabase = error ? "unreachable" : "reachable";
    } catch {
      supabase = "unreachable";
    }

    const status = supabase === "reachable" ? "ok" : "degraded";
    reply.code(status === "ok" ? 200 : 503);
    return { status, supabase };
  });
}
