import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { LegalRepository } from './types.js';
import { LegalService } from './service.js';
import type {
  CreateLicenceInput,
  RenewLicenceInput,
  CreateLegalMatterInput,
  CreateExternalCounselInput,
  CreateComplianceObligationInput,
  FileObligationInput,
  MatterStatus,
} from './types.js';

export interface LegalRoutesOptions {
  getRepository: () => LegalRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
  hasPermission?: (token: string, permissionKey: string) => Promise<boolean>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function registerLegalRoutes(options: LegalRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new LegalService(options.getRepository());

    const licenceManageGuard = { preHandler: [options.permissionGuard('legal.licence.manage')] };
    const licenceRenewGuard = { preHandler: [options.permissionGuard('legal.licence.renew')] };
    const matterManageGuard = { preHandler: [options.permissionGuard('legal.matter.manage')] };
    const counselManageGuard = { preHandler: [options.permissionGuard('legal.counsel.manage')] };
    const complianceManageGuard = { preHandler: [options.permissionGuard('legal.compliance.manage')] };

    // =======================================================================
    // 1. LICENCES & PERMITS REGISTER
    // =======================================================================
    app.get<{ Querystring: { projectId?: string } }>(
      '/legal/licences',
      licenceManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const licences = await service.listLicences(token, req.query.projectId);
          return reply.send({ licences });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateLicenceInput }>(
      '/legal/licences',
      licenceManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const licence = await service.createLicence(token, req.body);
          return reply.status(201).send({ licence });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: RenewLicenceInput }>(
      '/legal/licences/:id/renew',
      licenceRenewGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const licence = await service.renewLicence(token, req.params.id, req.body);
          return reply.send({ licence });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. LEGAL MATTERS & DISPUTES
    // =======================================================================
    app.get<{ Querystring: { projectId?: string } }>(
      '/legal/matters',
      matterManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          // Check if caller can view privileged records
          let canViewPrivileged = false;
          if (options.hasPermission) {
            canViewPrivileged = await options.hasPermission(token, 'legal.matter.view_privileged');
          } else {
            // Default to true if caller passes the general guard when hasPermission helper is omitted
            canViewPrivileged = true;
          }

          const matters = await service.listMatters(token, canViewPrivileged, req.query.projectId);
          return reply.send({ matters });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateLegalMatterInput }>(
      '/legal/matters',
      matterManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const matter = await service.createMatter(token, req.body);
          return reply.status(201).send({ matter });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.patch<{ Params: { id: string }; Body: { status: MatterStatus } }>(
      '/legal/matters/:id/status',
      matterManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const matter = await service.updateMatterStatus(token, req.params.id, req.body.status);
          return reply.send({ matter });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. EXTERNAL COUNSEL
    // =======================================================================
    app.get('/legal/counsel', counselManageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

      try {
        const counsel = await service.listCounsel(token);
        return reply.send({ counsel });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    });

    app.post<{ Body: CreateExternalCounselInput }>(
      '/legal/counsel',
      counselManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const counsel = await service.createCounsel(token, req.body);
          return reply.status(201).send({ counsel });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.patch<{ Params: { id: string }; Body: { billed_amount: number } }>(
      '/legal/counsel/:id/billing',
      counselManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const counsel = await service.updateCounselBilling(token, req.params.id, req.body.billed_amount);
          return reply.send({ counsel });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 4. COMPLIANCE OBLIGATIONS
    // =======================================================================
    app.get('/legal/obligations', complianceManageGuard, async (req, reply) => {
      const token = bearerToken(req.headers.authorization);
      if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

      try {
        const obligations = await service.listObligations(token);
        return reply.send({ obligations });
      } catch (err: any) {
        return reply.status(400).send({ error: err.message });
      }
    });

    app.post<{ Body: CreateComplianceObligationInput }>(
      '/legal/obligations',
      complianceManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const obligation = await service.createObligation(token, req.body);
          return reply.status(201).send({ obligation });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: FileObligationInput }>(
      '/legal/obligations/:id/file',
      complianceManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const obligation = await service.fileObligation(token, req.params.id, req.body);
          return reply.send({ obligation });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
