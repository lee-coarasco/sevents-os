import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
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
import { auditRoutes } from "./modules/audit/routes.js";
import {
  createSupabaseAuditRepository,
  type AuditRepository,
} from "./modules/audit/repository.js";
import { notificationsRoutes } from "./modules/notifications/routes.js";
import {
  createSupabaseNotificationsRepository,
  type NotificationsRepository,
} from "./modules/notifications/repository.js";
import { crmRoutes } from "./modules/crm/routes.js";
import { createSupabaseCrmRepository, type CrmRepository } from "./modules/crm/repository.js";
import {
  createAnonClient,
  createServiceClient,
  createUserScopedClient,
} from "./lib/supabase.js";
import { env } from "./lib/env.js";

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
  /** Override for tests; defaults to a Supabase-backed repository. */
  getAuditRepository?: () => AuditRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getNotificationsRepository?: () => NotificationsRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getCrmRepository?: () => CrmRepository;
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

let cachedAuditRepository: AuditRepository | null = null;

function defaultAuditRepository(): AuditRepository {
  if (!cachedAuditRepository) {
    cachedAuditRepository = createSupabaseAuditRepository(createServiceClient(), createUserScopedClient);
  }
  return cachedAuditRepository;
}

let cachedNotificationsRepository: NotificationsRepository | null = null;

function defaultNotificationsRepository(): NotificationsRepository {
  if (!cachedNotificationsRepository) {
    cachedNotificationsRepository = createSupabaseNotificationsRepository(
      createServiceClient(),
      createUserScopedClient,
    );
  }
  return cachedNotificationsRepository;
}

let cachedCrmRepository: CrmRepository | null = null;

function defaultCrmRepository(): CrmRepository {
  if (!cachedCrmRepository) {
    cachedCrmRepository = createSupabaseCrmRepository(createUserScopedClient);
  }
  return cachedCrmRepository;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true });
  const getAuthorityRepository = options.getAuthorityRepository ?? defaultAuthorityRepository;
  const guard = (permissionKey: string) => requirePermission(getAuthorityRepository, permissionKey);

  app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
  });

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

  app.register(auditRoutes, {
    getRepository: options.getAuditRepository ?? defaultAuditRepository,
    getWorkflowRepository: options.getWorkflowRepository ?? defaultWorkflowRepository,
    getIdentityRepository: options.getIdentityRepository ?? defaultIdentityRepository,
    requirePermission: guard,
  });

  app.register(notificationsRoutes, {
    getRepository: options.getNotificationsRepository ?? defaultNotificationsRepository,
    requirePermission: guard,
  });

  app.register(crmRoutes, {
    getRepository: options.getCrmRepository ?? defaultCrmRepository,
    getWorkflowRepository: options.getWorkflowRepository ?? defaultWorkflowRepository,
    requirePermission: guard,
  });

  return app;
}
