import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
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
import { hasPermission as checkAuthorityPermission } from "./modules/authority/service.js";
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
import { tenderingRoutes } from "./modules/tendering/routes.js";
import {
  createSupabaseTenderingRepository,
  type TenderingRepository,
} from "./modules/tendering/repository.js";
import { estimatingRoutes } from "./modules/estimating/routes.js";
import {
  createSupabaseEstimatingRepository,
  type EstimatingRepository,
} from "./modules/estimating/repository.js";
import { biddingRoutes } from "./modules/bidding/routes.js";
import {
  createSupabaseBiddingRepository,
  type BiddingRepository,
} from "./modules/bidding/repository.js";
import { documentsRoutes } from "./modules/documents/routes.js";
import {
  createSupabaseDocumentsRepository,
  type DocumentsRepository,
} from "./modules/documents/repository.js";
import { masterDataRoutes } from "./modules/masterdata/routes.js";
import {
  createSupabaseMasterDataRepository,
  type MasterDataRepository,
} from "./modules/masterdata/repository.js";
import { engineeringRoutes } from "./modules/engineering/routes.js";
import {
  createSupabaseEngineeringRepository,
  type EngineeringRepository,
} from "./modules/engineering/repository.js";
import { siteRoutes } from "./modules/site/routes.js";
import {
  createSupabaseSiteRepository,
  type SiteRepository,
} from "./modules/site/repository.js";
import { procurementRoutes } from "./modules/procurement/routes.js";
import {
  createSupabaseProcurementRepository,
  type ProcurementRepository,
} from "./modules/procurement/repository.js";
import { registerInventoryRoutes } from "./modules/inventory/routes.js";
import {
  createSupabaseInventoryRepository,
  type InventoryRepository,
} from "./modules/inventory/repository.js";
import { registerSubcontractorRoutes } from "./modules/subcontractors/routes.js";
import {
  createSupabaseSubcontractorRepository,
  type SubcontractorRepository,
} from "./modules/subcontractors/repository.js";
import { registerQualityRoutes } from "./modules/quality/routes.js";
import {
  createSupabaseQualityRepository,
  type QualityRepository,
} from "./modules/quality/repository.js";
import { registerSafetyRoutes } from "./modules/safety/routes.js";
import {
  createSupabaseSafetyRepository,
  type SafetyRepository,
} from "./modules/safety/repository.js";
import { registerEquipmentRoutes } from "./modules/equipment/routes.js";
import {
  createSupabaseEquipmentRepository,
  type EquipmentRepository,
} from "./modules/equipment/repository.js";
import { registerFinanceRoutes } from "./modules/finance/routes.js";
import {
  createSupabaseFinanceRepository,
  type FinanceRepository,
} from "./modules/finance/repository.js";
import { registerBillingRoutes } from "./modules/billing/routes.js";
import {
  createSupabaseBillingRepository,
  type BillingRepository,
} from "./modules/billing/repository.js";
import { registerContractsRoutes } from "./modules/contracts/routes.js";
import {
  createSupabaseContractsRepository,
  type ContractsRepository,
} from "./modules/contracts/repository.js";
import { registerPeopleRoutes } from "./modules/people/routes.js";
import {
  createSupabasePeopleRepository,
  type PeopleRepository,
} from "./modules/people/repository.js";
import { registerCommunicationsRoutes } from "./modules/communications/routes.js";
import {
  createSupabaseCommunicationsRepository,
  type CommunicationsRepository,
} from "./modules/communications/repository.js";
import { registerLegalRoutes } from "./modules/legal/routes.js";
import {
  createSupabaseLegalRepository,
  type LegalRepository,
} from "./modules/legal/repository.js";
import { registerIntegrationsRoutes } from "./modules/integrations/routes.js";
import {
  createSupabaseIntegrationsRepository,
  type IntegrationsRepository,
} from "./modules/integrations/repository.js";
import { registerPlatformAdminRoutes } from "./modules/platform-admin/routes.js";
import {
  createSupabasePlatformAdminRepository,
  type PlatformAdminRepository,
} from "./modules/platform-admin/repository.js";
import { registerMigrationRoutes } from "./modules/migration/routes.js";
import {
  createSupabaseMigrationRepository,
  type MigrationRepository,
} from "./modules/migration/repository.js";
import { registerAiRoutes } from "./modules/ai/routes.js";
import {
  createSupabaseAiRepository,
  type AiRepository,
} from "./modules/ai/repository.js";
import { registerAgentsRoutes } from "./modules/agents/routes.js";
import {
  createAgentsRepository,
  type AgentsRepository,
} from "./modules/agents/repository.js";
import { storageRoutes } from "./modules/storage/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import type { DashboardRepository } from "./modules/dashboard/repository.js";
import { adminUsersRoutes } from "./modules/admin/users/routes.js";
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
  /** Override for tests; defaults to a Supabase-backed repository. */
  getTenderingRepository?: () => TenderingRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getEstimatingRepository?: () => EstimatingRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getBiddingRepository?: () => BiddingRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getDocumentsRepository?: () => DocumentsRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getMasterDataRepository?: () => MasterDataRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getEngineeringRepository?: () => EngineeringRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getSiteRepository?: () => SiteRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getProcurementRepository?: () => ProcurementRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getInventoryRepository?: () => InventoryRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getSubcontractorRepository?: () => SubcontractorRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getQualityRepository?: () => QualityRepository;
  /** Override for tests; defaults to a Supabase-backed repository. */
  getSafetyRepository?: () => SafetyRepository;
  getEquipmentRepository?: () => EquipmentRepository;
  getFinanceRepository?: () => FinanceRepository;
  getBillingRepository?: () => BillingRepository;
  getContractsRepository?: () => ContractsRepository;
  getPeopleRepository?: () => PeopleRepository;
  getCommunicationsRepository?: () => CommunicationsRepository;
  getLegalRepository?: () => LegalRepository;
  getDashboardRepository?: () => DashboardRepository;
  getIntegrationsRepository?: () => IntegrationsRepository;
  getPlatformAdminRepository?: () => PlatformAdminRepository;
  getMigrationRepository?: () => MigrationRepository;
  getAiRepository?: () => AiRepository;
  getAgentsRepository?: () => AgentsRepository;
}

let cachedAgentsRepository: AgentsRepository | null = null;

function defaultAgentsRepository(): AgentsRepository {
  if (!cachedAgentsRepository) {
    cachedAgentsRepository = createAgentsRepository(createUserScopedClient);
  }
  return cachedAgentsRepository;
}

let cachedAiRepository: AiRepository | null = null;

function defaultAiRepository(): AiRepository {
  if (!cachedAiRepository) {
    cachedAiRepository = createSupabaseAiRepository(createUserScopedClient);
  }
  return cachedAiRepository;
}

let cachedMigrationRepository: MigrationRepository | null = null;

function defaultMigrationRepository(): MigrationRepository {
  if (!cachedMigrationRepository) {
    cachedMigrationRepository = createSupabaseMigrationRepository(createUserScopedClient);
  }
  return cachedMigrationRepository;
}

let cachedPlatformAdminRepository: PlatformAdminRepository | null = null;

function defaultPlatformAdminRepository(): PlatformAdminRepository {
  if (!cachedPlatformAdminRepository) {
    cachedPlatformAdminRepository = createSupabasePlatformAdminRepository(createUserScopedClient);
  }
  return cachedPlatformAdminRepository;
}

let cachedIntegrationsRepository: IntegrationsRepository | null = null;

function defaultIntegrationsRepository(): IntegrationsRepository {
  if (!cachedIntegrationsRepository) {
    cachedIntegrationsRepository = createSupabaseIntegrationsRepository(createUserScopedClient);
  }
  return cachedIntegrationsRepository;
}

let cachedLegalRepository: LegalRepository | null = null;

function defaultLegalRepository(): LegalRepository {
  if (!cachedLegalRepository) {
    cachedLegalRepository = createSupabaseLegalRepository(createUserScopedClient);
  }
  return cachedLegalRepository;
}

let cachedCommunicationsRepository: CommunicationsRepository | null = null;

function defaultCommunicationsRepository(): CommunicationsRepository {
  if (!cachedCommunicationsRepository) {
    cachedCommunicationsRepository = createSupabaseCommunicationsRepository(createUserScopedClient);
  }
  return cachedCommunicationsRepository;
}

let cachedBillingRepository: BillingRepository | null = null;

function defaultBillingRepository(): BillingRepository {
  if (!cachedBillingRepository) {
    cachedBillingRepository = createSupabaseBillingRepository(createUserScopedClient);
  }
  return cachedBillingRepository;
}

let cachedContractsRepository: ContractsRepository | null = null;

function defaultContractsRepository(): ContractsRepository {
  if (!cachedContractsRepository) {
    cachedContractsRepository = createSupabaseContractsRepository(createUserScopedClient);
  }
  return cachedContractsRepository;
}

let cachedPeopleRepository: PeopleRepository | null = null;

function defaultPeopleRepository(): PeopleRepository {
  if (!cachedPeopleRepository) {
    cachedPeopleRepository = createSupabasePeopleRepository(createUserScopedClient);
  }
  return cachedPeopleRepository;
}

let cachedFinanceRepository: FinanceRepository | null = null;

function defaultFinanceRepository(): FinanceRepository {
  if (!cachedFinanceRepository) {
    cachedFinanceRepository = createSupabaseFinanceRepository(createUserScopedClient);
  }
  return cachedFinanceRepository;
}

let cachedEquipmentRepository: EquipmentRepository | null = null;

function defaultEquipmentRepository(): EquipmentRepository {
  if (!cachedEquipmentRepository) {
    cachedEquipmentRepository = createSupabaseEquipmentRepository(createUserScopedClient);
  }
  return cachedEquipmentRepository;
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

let cachedTenderingRepository: TenderingRepository | null = null;

function defaultTenderingRepository(): TenderingRepository {
  if (!cachedTenderingRepository) {
    cachedTenderingRepository = createSupabaseTenderingRepository(createUserScopedClient);
  }
  return cachedTenderingRepository;
}

let cachedEstimatingRepository: EstimatingRepository | null = null;

function defaultEstimatingRepository(): EstimatingRepository {
  if (!cachedEstimatingRepository) {
    cachedEstimatingRepository = createSupabaseEstimatingRepository(createUserScopedClient);
  }
  return cachedEstimatingRepository;
}

let cachedBiddingRepository: BiddingRepository | null = null;

function defaultBiddingRepository(): BiddingRepository {
  if (!cachedBiddingRepository) {
    cachedBiddingRepository = createSupabaseBiddingRepository(createUserScopedClient);
  }
  return cachedBiddingRepository;
}

let cachedDocumentsRepository: DocumentsRepository | null = null;

function defaultDocumentsRepository(): DocumentsRepository {
  if (!cachedDocumentsRepository) {
    cachedDocumentsRepository = createSupabaseDocumentsRepository(createUserScopedClient);
  }
  return cachedDocumentsRepository;
}

let cachedMasterDataRepository: MasterDataRepository | null = null;

function defaultMasterDataRepository(): MasterDataRepository {
  if (!cachedMasterDataRepository) {
    cachedMasterDataRepository = createSupabaseMasterDataRepository(createUserScopedClient);
  }
  return cachedMasterDataRepository;
}

let cachedEngineeringRepository: EngineeringRepository | null = null;

function defaultEngineeringRepository(): EngineeringRepository {
  if (!cachedEngineeringRepository) {
    cachedEngineeringRepository = createSupabaseEngineeringRepository(createUserScopedClient);
  }
  return cachedEngineeringRepository;
}

let cachedSiteRepository: SiteRepository | null = null;

function defaultSiteRepository(): SiteRepository {
  if (!cachedSiteRepository) {
    cachedSiteRepository = createSupabaseSiteRepository(createUserScopedClient);
  }
  return cachedSiteRepository;
}

let cachedProcurementRepository: ProcurementRepository | null = null;

function defaultProcurementRepository(): ProcurementRepository {
  if (!cachedProcurementRepository) {
    cachedProcurementRepository = createSupabaseProcurementRepository(createUserScopedClient);
  }
  return cachedProcurementRepository;
}

let cachedInventoryRepository: InventoryRepository | null = null;

function defaultInventoryRepository(): InventoryRepository {
  if (!cachedInventoryRepository) {
    cachedInventoryRepository = createSupabaseInventoryRepository(createUserScopedClient);
  }
  return cachedInventoryRepository;
}

let cachedSubcontractorRepository: SubcontractorRepository | null = null;

function defaultSubcontractorRepository(): SubcontractorRepository {
  if (!cachedSubcontractorRepository) {
    cachedSubcontractorRepository = createSupabaseSubcontractorRepository(createUserScopedClient);
  }
  return cachedSubcontractorRepository;
}

let cachedQualityRepository: QualityRepository | null = null;

function defaultQualityRepository(): QualityRepository {
  if (!cachedQualityRepository) {
    cachedQualityRepository = createSupabaseQualityRepository(createUserScopedClient);
  }
  return cachedQualityRepository;
}

let cachedSafetyRepository: SafetyRepository | null = null;

function defaultSafetyRepository(): SafetyRepository {
  if (!cachedSafetyRepository) {
    cachedSafetyRepository = createSupabaseSafetyRepository(createUserScopedClient);
  }
  return cachedSafetyRepository;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });
  const getAuthorityRepository = options.getAuthorityRepository ?? defaultAuthorityRepository;
  const guard = (permissionKey: string) => requirePermission(getAuthorityRepository, permissionKey);

  app.register(cors, {
    origin: env.corsOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }); // 50 MB cap

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

  app.register(tenderingRoutes, {
    getRepository: options.getTenderingRepository ?? defaultTenderingRepository,
    requirePermission: guard,
  });

  app.register(estimatingRoutes, {
    getRepository: options.getEstimatingRepository ?? defaultEstimatingRepository,
    getWorkflowRepository: options.getWorkflowRepository ?? defaultWorkflowRepository,
    requirePermission: guard,
  });

  app.register(biddingRoutes, {
    getRepository: options.getBiddingRepository ?? defaultBiddingRepository,
    getWorkflowRepository: options.getWorkflowRepository ?? defaultWorkflowRepository,
    requirePermission: guard,
  });

  app.register(documentsRoutes, {
    getRepository: options.getDocumentsRepository ?? defaultDocumentsRepository,
    getWorkflowRepository: options.getWorkflowRepository ?? defaultWorkflowRepository,
    requirePermission: guard,
  });

  app.register(masterDataRoutes, {
    getRepository: options.getMasterDataRepository ?? defaultMasterDataRepository,
    requirePermission: guard,
  });

  app.register(engineeringRoutes, {
    getRepository: options.getEngineeringRepository ?? defaultEngineeringRepository,
    getMasterDataRepository: options.getMasterDataRepository ?? defaultMasterDataRepository,
    requirePermission: guard,
  });

  app.register(siteRoutes, {
    getRepository: options.getSiteRepository ?? defaultSiteRepository,
    requirePermission: guard,
  });

  app.register(procurementRoutes, {
    getRepository: options.getProcurementRepository ?? defaultProcurementRepository,
    requirePermission: guard,
  });

  app.register(registerInventoryRoutes({
    getRepository: options.getInventoryRepository ?? defaultInventoryRepository,
    permissionGuard: guard,
  }));

  app.register(registerSubcontractorRoutes({
    getRepository: options.getSubcontractorRepository ?? defaultSubcontractorRepository,
    permissionGuard: guard,
  }));

  app.register(registerQualityRoutes({
    getRepository: options.getQualityRepository ?? defaultQualityRepository,
    permissionGuard: guard,
  }));

  app.register(registerSafetyRoutes({
    getRepository: options.getSafetyRepository ?? defaultSafetyRepository,
    permissionGuard: guard,
  }));

  app.register(registerEquipmentRoutes({
    getRepository: options.getEquipmentRepository ?? defaultEquipmentRepository,
    permissionGuard: guard,
  }));

  app.register(registerFinanceRoutes({
    getRepository: options.getFinanceRepository ?? defaultFinanceRepository,
    permissionGuard: guard,
  }));

  app.register(registerBillingRoutes({
    getRepository: options.getBillingRepository ?? defaultBillingRepository,
    permissionGuard: guard,
  }));

  app.register(registerContractsRoutes({
    getRepository: options.getContractsRepository ?? defaultContractsRepository,
    permissionGuard: guard,
  }));

  app.register(registerPeopleRoutes({
    getRepository: options.getPeopleRepository ?? defaultPeopleRepository,
    permissionGuard: guard,
  }));

  app.register(registerCommunicationsRoutes({
    getRepository: options.getCommunicationsRepository ?? defaultCommunicationsRepository,
    permissionGuard: guard,
  }));

  app.register(registerLegalRoutes({
    getRepository: options.getLegalRepository ?? defaultLegalRepository,
    permissionGuard: guard,
    hasPermission: async (token: string, perm: string) => {
      const auth = getAuthorityRepository();
      const ctx = await auth.resolveCallerContext(token);
      if (!ctx) return false;
      return checkAuthorityPermission(auth, ctx.userId, ctx.tenantId, perm);
    },
  }));

  app.register(storageRoutes, {
    getServiceClient: createServiceClient,
  });

  app.register(dashboardRoutes, {
    getUserScopedClient: createUserScopedClient,
    getRepository: options.getDashboardRepository ? () => options.getDashboardRepository!() : undefined,
    permissionGuard: guard,
  });

  app.register(registerIntegrationsRoutes({
    getRepository: options.getIntegrationsRepository ?? defaultIntegrationsRepository,
    permissionGuard: guard,
  }));

  app.register(registerPlatformAdminRoutes({
    getRepository: options.getPlatformAdminRepository ?? defaultPlatformAdminRepository,
    permissionGuard: guard,
  }));

  app.register(registerMigrationRoutes({
    getRepository: options.getMigrationRepository ?? defaultMigrationRepository,
    permissionGuard: guard,
  }));

  app.register(registerAiRoutes({
    getRepository: options.getAiRepository ?? defaultAiRepository,
    permissionGuard: guard,
  }));

  app.register(registerAgentsRoutes({
    getRepository: options.getAgentsRepository ?? defaultAgentsRepository,
    getClient: createUserScopedClient,
    permissionGuard: guard,
  }));

  app.register(adminUsersRoutes, {
    getServiceClient: createServiceClient,
    requirePermission: guard,
  });

  return app;
}
