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
import { authorityRoutes } from "./modules/authority/routes.js";
import { requirePermission } from "./modules/authority/guard.js";
import {
  createSupabaseAuthorityRepository,
  type AuthorityRepository,
} from "./modules/authority/repository.js";
import { catalogueRoutes } from "./modules/catalogue/routes.js";
import {
  createSupabaseCatalogueRepository,
  type CatalogueRepository,
} from "./modules/catalogue/repository.js";
import { workflowRoutes } from "./modules/workflow/routes.js";
import {
  createSupabaseWorkflowRepository,
  type WorkflowRepository,
} from "./modules/workflow/repository.js";
import { workforceRoutes } from "./modules/workforce/routes.js";
import {
  createSupabaseWorkforceRepository,
  type WorkforceRepository,
} from "./modules/workforce/repository.js";
import { projectsRoutes } from "./modules/projects/routes.js";
import {
  createSupabaseProjectsRepository,
  type ProjectsRepository,
} from "./modules/projects/repository.js";
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
  /** Override for tests; defaults to a Supabase-backed repository. */
  getAuthorityRepository?: () => AuthorityRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getCatalogueRepository?: () => CatalogueRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getWorkflowRepository?: () => WorkflowRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getWorkforceRepository?: () => WorkforceRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getProjectsRepository?: () => ProjectsRepository;
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

let cachedAuthorityRepository: AuthorityRepository | null = null;

function defaultAuthorityRepository(): AuthorityRepository {
  if (!cachedAuthorityRepository) {
    cachedAuthorityRepository = createSupabaseAuthorityRepository(
      createServiceClient(),
      createUserScopedClient,
    );
  }
  return cachedAuthorityRepository;
}

let cachedCatalogueRepository: CatalogueRepository | null = null;

function defaultCatalogueRepository(): CatalogueRepository {
  if (!cachedCatalogueRepository) {
    cachedCatalogueRepository = createSupabaseCatalogueRepository(createServiceClient(), createUserScopedClient);
  }
  return cachedCatalogueRepository;
}

let cachedWorkflowRepository: WorkflowRepository | null = null;

function defaultWorkflowRepository(): WorkflowRepository {
  if (!cachedWorkflowRepository) {
    cachedWorkflowRepository = createSupabaseWorkflowRepository(createServiceClient(), createUserScopedClient);
  }
  return cachedWorkflowRepository;
}

let cachedWorkforceRepository: WorkforceRepository | null = null;

function defaultWorkforceRepository(): WorkforceRepository {
  if (!cachedWorkforceRepository) {
    cachedWorkforceRepository = createSupabaseWorkforceRepository(createServiceClient(), createUserScopedClient);
  }
  return cachedWorkforceRepository;
}

let cachedProjectsRepository: ProjectsRepository | null = null;

function defaultProjectsRepository(): ProjectsRepository {
  if (!cachedProjectsRepository) {
    cachedProjectsRepository = createSupabaseProjectsRepository(createUserScopedClient);
  }
  return cachedProjectsRepository;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true });
  const getAuthorityRepository = options.getAuthorityRepository ?? defaultAuthorityRepository;
  const guard = (permissionKey: string) => requirePermission(getAuthorityRepository, permissionKey);

  app.register(healthRoute, {
    getSupabaseClient: options.getSupabaseClient ?? createServiceClient,
  });

  app.register(identityRoutes, {
    getRepository: options.getIdentityRepository ?? defaultIdentityRepository,
    requirePermission: guard,
  });

  app.register(tenancyRoutes, {
    getRepository: options.getTenancyRepository ?? defaultTenancyRepository,
    requirePermission: guard,
  });

  app.register(authorityRoutes, {
    getRepository: getAuthorityRepository,
  });

  app.register(catalogueRoutes, {
    getRepository: options.getCatalogueRepository ?? defaultCatalogueRepository,
    requirePermission: guard,
  });

  app.register(workflowRoutes, {
    getRepository: options.getWorkflowRepository ?? defaultWorkflowRepository,
    requirePermission: guard,
    getAuthorityRepository,
  });

  app.register(workforceRoutes, {
    getRepository: options.getWorkforceRepository ?? defaultWorkforceRepository,
    requirePermission: guard,
  });

  app.register(projectsRoutes, {
    getRepository: options.getProjectsRepository ?? defaultProjectsRepository,
    getWorkflowRepository: options.getWorkflowRepository ?? defaultWorkflowRepository,
    requirePermission: guard,
  });

  return app;
}
