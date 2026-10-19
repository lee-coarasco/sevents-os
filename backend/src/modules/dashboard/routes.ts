import type { FastifyInstance } from "fastify";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseDashboardRepository, type DashboardRepository } from "./repository.js";
import { createDashboardService } from "./service.js";
import type { CreateReportInput, ReportCategory } from "./types.js";

export interface DashboardRouteOptions {
  getUserScopedClient?: (accessToken: string) => SupabaseClient;
  getRepository?: (token: string) => DashboardRepository;
  permissionGuard?: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function dashboardRoutes(app: FastifyInstance, options: DashboardRouteOptions) {
  const getRepo = (token: string): DashboardRepository => {
    if (options.getRepository) {
      return options.getRepository(token);
    }
    if (options.getUserScopedClient) {
      return createSupabaseDashboardRepository(options.getUserScopedClient)(token);
    }
    throw new Error("Neither getRepository nor getUserScopedClient was provided to dashboardRoutes");
  };

  app.addHook("preHandler", async (request, reply) => {
    if (!bearerToken(request.headers.authorization)) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  const execGuard = options.permissionGuard ? { preHandler: [options.permissionGuard("dashboard.executive.view")] } : {};
  const finGuard = options.permissionGuard ? { preHandler: [options.permissionGuard("dashboard.financial.view")] } : {};
  const opsGuard = options.permissionGuard ? { preHandler: [options.permissionGuard("dashboard.operations.view")] } : {};
  const reportsManageGuard = options.permissionGuard ? { preHandler: [options.permissionGuard("dashboard.reports.manage")] } : {};
  const reportsExportGuard = options.permissionGuard ? { preHandler: [options.permissionGuard("dashboard.reports.export")] } : {};

  // GET /dashboard/summary — aggregate counts for the platform overview tiles
  app.get("/dashboard/summary", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const service = createDashboardService(getRepo(token));
      const summary = await service.getSummary(token);
      return reply.send({ summary });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || "Failed to load dashboard summary" });
    }
  });

  // GET /dashboard/analytics/executive
  app.get<{ Querystring: { projectId?: string } }>(
    "/dashboard/analytics/executive",
    execGuard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const service = createDashboardService(getRepo(token));
        const analytics = await service.getExecutiveAnalytics(token, request.query.projectId);
        return reply.send({ analytics });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message || "Failed to load executive analytics" });
      }
    }
  );

  // GET /dashboard/analytics/financial
  app.get<{ Querystring: { projectId?: string } }>(
    "/dashboard/analytics/financial",
    finGuard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const service = createDashboardService(getRepo(token));
        const analytics = await service.getFinancialAnalytics(token, request.query.projectId);
        return reply.send({ analytics });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message || "Failed to load financial analytics" });
      }
    }
  );

  // GET /dashboard/analytics/operations
  app.get<{ Querystring: { projectId?: string } }>(
    "/dashboard/analytics/operations",
    opsGuard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const service = createDashboardService(getRepo(token));
        const analytics = await service.getOperationsAnalytics(token, request.query.projectId);
        return reply.send({ analytics });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message || "Failed to load operations analytics" });
      }
    }
  );

  // GET /dashboard/reports
  app.get<{ Querystring: { category?: ReportCategory } }>(
    "/dashboard/reports",
    reportsManageGuard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const service = createDashboardService(getRepo(token));
        const reports = await service.listReports(token, request.query.category);
        return reply.send({ reports });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message || "Failed to list dashboard reports" });
      }
    }
  );

  // POST /dashboard/reports
  app.post<{ Body: CreateReportInput }>(
    "/dashboard/reports",
    reportsManageGuard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const service = createDashboardService(getRepo(token));
        const report = await service.createReport(token, request.body);
        return reply.status(201).send({ report });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to create report" });
      }
    }
  );

  // DELETE /dashboard/reports/:id
  app.delete<{ Params: { id: string } }>(
    "/dashboard/reports/:id",
    reportsManageGuard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const service = createDashboardService(getRepo(token));
        const deleted = await service.deleteReport(token, request.params.id);
        return reply.send({ success: deleted });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message || "Failed to delete report" });
      }
    }
  );

  // POST /dashboard/reports/generate
  app.post<{ Body: { entity: string; filters?: Record<string, unknown> } }>(
    "/dashboard/reports/generate",
    reportsExportGuard,
    async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      const { entity, filters } = request.body || {};
      if (!entity) {
        return reply.status(400).send({ error: "entity is required" });
      }

      try {
        const service = createDashboardService(getRepo(token));
        const result = await service.generateReportData(token, entity, filters);
        return reply.send({ result });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message || "Failed to generate report data" });
      }
    }
  );
}
