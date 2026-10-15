import Fastify, { type FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { healthRoute } from "./routes/health.js";
import { identityRoutes } from "./modules/identity/routes.js";
import {
  createSupabaseIdentityRepository,
  type IdentityRepository,
} from "./modules/identity/repository.js";
import { tenancyRoutes } from "./modules/tenancy/routes.js";
import {
  createSupabaseTenancyRepository,
  type TenancyRepository,
} from "./modules/tenancy/repository.js";
import {
  createAnonClient,
  createServiceClient,
  createUserScopedClient,
} from "./lib/supabase.js";

export interface BuildAppOptions {
  /** Override for tests; defaults to the real Supabase service client. */
  getSupabaseClient?: () => SupabaseClient;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getIdentityRepository?: () => IdentityRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getTenancyRepository?: () => TenancyRepository;
}

let cachedIdentityRepository: IdentityRepository | null = null;

/** Lazy + memoized so constructing it never requires env vars until an /identity/* route is actually hit. */
function defaultIdentityRepository(): IdentityRepository {
  if (!cachedIdentityRepository) {
    cachedIdentityRepository = createSupabaseIdentityRepository(
      createServiceClient(),
      createUserScopedClient,
      createAnonClient,
    );
  }
  return cachedIdentityRepository;
}

let cachedTenancyRepository: TenancyRepository | null = null;

function defaultTenancyRepository(): TenancyRepository {
  if (!cachedTenancyRepository) {
    cachedTenancyRepository = createSupabaseTenancyRepository(createUserScopedClient);
  }
  return cachedTenancyRepository;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(healthRoute, {
    getSupabaseClient: options.getSupabaseClient ?? createServiceClient,
  });

  app.register(identityRoutes, {
    getRepository: options.getIdentityRepository ?? defaultIdentityRepository,
  });

  app.register(tenancyRoutes, {
    getRepository: options.getTenancyRepository ?? defaultTenancyRepository,
  });

  return app;
}
