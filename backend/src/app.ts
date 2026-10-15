import Fastify, { type FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { healthRoute } from "./routes/health.js";
import { createServiceClient } from "./lib/supabase.js";

export interface BuildAppOptions {
  /** Override for tests; defaults to the real Supabase service client. */
  getSupabaseClient?: () => SupabaseClient;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(healthRoute, {
    getSupabaseClient: options.getSupabaseClient ?? createServiceClient,
  });

  return app;
}
