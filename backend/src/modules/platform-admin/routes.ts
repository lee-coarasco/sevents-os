import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { PlatformAdminRepository } from "./types.js";
import { PlatformAdminService } from "./service.js";
import type {
  UpdateTenantSettingsInput,
  CreateMaintenanceWindowInput,
  CreateSupportTicketInput,
  ResolveSupportTicketInput,
} from "./types.js";

export interface PlatformAdminRoutesOptions {
  getRepository: () => PlatformAdminRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerPlatformAdminRoutes(options: PlatformAdminRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new PlatformAdminService(options.getRepository());

    const settingsViewGuard = { preHandler: [options.permissionGuard("platform.settings.view")] };
    const settingsManageGuard = { preHandler: [options.permissionGuard("platform.settings.manage")] };
    const flagsManageGuard = { preHandler: [options.permissionGuard("platform.feature_flags.manage")] };
    const healthViewGuard = { preHandler: [options.permissionGuard("platform.health.view")] };
    const maintenanceManageGuard = { preHandler: [options.permissionGuard("platform.maintenance.manage")] };
    const supportViewGuard = { preHandler: [options.permissionGuard("platform.support.view")] };
    const supportManageGuard = { preHandler: [options.permissionGuard("platform.support.manage")] };

    // =======================================================================
    // 1. TENANT SETTINGS
    // =======================================================================
    app.get("/platform-admin/settings", settingsViewGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const settings = await service.getTenantSettings(token);
        return reply.send({ settings });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    app.patch<{ Body: UpdateTenantSettingsInput }>(
      "/platform-admin/settings",
      settingsManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const updated = await service.updateTenantSettings(token, req.body);
          return reply.send({ settings: updated });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. FEATURE FLAGS
    // =======================================================================
    app.get("/platform-admin/feature-flags", flagsManageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const flags = await service.listFeatureFlags(token);
        return reply.send({ flags });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    app.post<{ Body: { flag_key: string; is_enabled: boolean; updated_by?: string } }>(
      "/platform-admin/feature-flags/toggle",
      flagsManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const toggled = await service.toggleFeatureFlag(
            token,
            req.body.flag_key,
            req.body.is_enabled,
            req.body.updated_by
          );
          return reply.send({ flag: toggled });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. SYSTEM HEALTH PROBES
    // =======================================================================
    app.get("/platform-admin/health", healthViewGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const health = await service.getSystemHealth(token);
        return reply.send({ health });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    // =======================================================================
    // 4. MAINTENANCE WINDOWS & ANNOUNCEMENTS
    // =======================================================================
    app.get("/platform-admin/maintenance", settingsViewGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const windows = await service.listMaintenanceWindows(token);
        return reply.send({ maintenance_windows: windows });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    app.post<{ Body: CreateMaintenanceWindowInput & { created_by?: string } }>(
      "/platform-admin/maintenance",
      maintenanceManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const window = await service.createMaintenanceWindow(token, req.body, req.body.created_by);
          return reply.status(201).send({ maintenance_window: window });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.patch<{ Params: { id: string }; Body: { is_active: boolean } }>(
      "/platform-admin/maintenance/:id/toggle",
      maintenanceManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const toggled = await service.toggleMaintenanceWindow(token, req.params.id, req.body.is_active);
          return reply.send({ maintenance_window: toggled });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 5. PLATFORM SUPPORT & TICKETS
    // =======================================================================
    app.get("/platform-admin/support-tickets", supportViewGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: "Missing authorization token" });

      try {
        const tickets = await service.listSupportTickets(token);
        return reply.send({ tickets });
      } catch (err: any) {
        return reply.status(500).send({ error: err.message });
      }
    });

    app.post<{ Body: CreateSupportTicketInput & { reported_by?: string } }>(
      "/platform-admin/support-tickets",
      supportManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const ticket = await service.createSupportTicket(
            token,
            req.body,
            req.body.reported_by || "user@sevents.ae"
          );
          return reply.status(201).send({ ticket });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.patch<{ Params: { id: string }; Body: ResolveSupportTicketInput }>(
      "/platform-admin/support-tickets/:id/resolve",
      supportManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const resolved = await service.resolveSupportTicket(token, req.params.id, req.body);
          return reply.send({ ticket: resolved });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
