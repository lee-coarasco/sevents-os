import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { MigrationRepository } from "./repository.js";
import { createMigrationService } from "./service.js";
import type { MigrationEntityType } from "./types.js";

export interface MigrationRoutesOptions {
  getRepository: () => MigrationRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerMigrationRoutes(options: MigrationRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = createMigrationService(options.getRepository());

    const viewGuard = { preHandler: [options.permissionGuard("migration.job.view")] };
    const importGuard = { preHandler: [options.permissionGuard("migration.import.execute")] };
    const rollbackGuard = { preHandler: [options.permissionGuard("migration.rollback.execute")] };

    /**
     * GET /migration/templates/:entityType
     * Download pre-formatted CSV template with sample data
     */
    app.get<{ Params: { entityType: string } }>(
      "/migration/templates/:entityType",
      viewGuard,
      async (req, reply) => {
        try {
          const { entityType } = req.params;
          const template = service.getSampleTemplate(entityType as MigrationEntityType);
          reply.header("Content-Type", "text/csv");
          reply.header("Content-Disposition", `attachment; filename="${template.fileName}"`);
          return reply.send(template.csvContent);
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    /**
     * POST /migration/jobs/validate
     * Dry-run simulation and duplicate checking
     */
    app.post<{
      Body: {
        entityType: MigrationEntityType;
        fileName: string;
        rows: Record<string, string>[];
      };
    }>("/migration/jobs/validate", importGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const user = (req as any).user;
      const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

      try {
        const { entityType, fileName, rows } = req.body;
        if (!entityType || !Array.isArray(rows)) {
          return reply.status(400).send({ error: "entityType and rows array are required" });
        }

        const result = await service.validateImport(
          token,
          tenantId,
          entityType,
          fileName || "import.csv",
          rows,
          user?.id
        );

        return reply.send({ result });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * POST /migration/jobs/commit
     * Transactional staged activation with rollback snapshot
     */
    app.post<{
      Body: {
        jobId: string;
        rows: Record<string, string>[];
      };
    }>("/migration/jobs/commit", importGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const user = (req as any).user;
      const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

      try {
        const { jobId, rows } = req.body;
        if (!jobId || !Array.isArray(rows)) {
          return reply.status(400).send({ error: "jobId and rows array are required" });
        }

        const result = await service.commitImport(token, tenantId, jobId, rows, user?.id);
        return reply.send({ result });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * GET /migration/jobs
     * List migration audit history
     */
    app.get("/migration/jobs", viewGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const jobs = await service.listJobs(token);
        return reply.send({ jobs });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * GET /migration/jobs/:id
     * Retrieve a specific job with error breakdown
     */
    app.get<{ Params: { id: string } }>("/migration/jobs/:id", viewGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const job = await service.getJob(token, req.params.id);
        if (!job) return reply.status(404).send({ error: "Migration job not found" });
        return reply.send({ job });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    /**
     * POST /migration/jobs/:id/rollback
     * 1-Click Rollback to revert imported batch
     */
    app.post<{ Params: { id: string } }>("/migration/jobs/:id/rollback", rollbackGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      const user = (req as any).user;
      const tenantId = user?.app_metadata?.tenant_id || user?.user_metadata?.tenant_id || "default-tenant";

      try {
        const result = await service.rollbackImport(token, tenantId, req.params.id, user?.id);
        return reply.send({ result });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });
  };
}
