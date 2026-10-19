import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { CommunicationsRepository } from './types.js';
import { CommunicationsService } from './service.js';
import type {
  CreateStakeholderInput,
  CreateCommunicationLogInput,
  CreateMeetingMinutesInput,
  CreateClientComplaintInput,
  CommunicationStatus,
} from './types.js';

export interface CommunicationsRoutesOptions {
  getRepository: () => CommunicationsRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

export function registerCommunicationsRoutes(options: CommunicationsRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new CommunicationsService(options.getRepository());

    const stakeholderManageGuard = { preHandler: [options.permissionGuard('communications.stakeholder.manage')] };
    const logManageGuard = { preHandler: [options.permissionGuard('communications.log.manage')] };
    const minutesManageGuard = { preHandler: [options.permissionGuard('communications.minutes.manage')] };
    const complaintManageGuard = { preHandler: [options.permissionGuard('communications.complaint.manage')] };
    const complaintResolveGuard = { preHandler: [options.permissionGuard('communications.complaint.resolve')] };

    // =======================================================================
    // 1. STAKEHOLDERS
    // =======================================================================
    app.get<{ Querystring: { projectId?: string } }>(
      '/communications/stakeholders',
      stakeholderManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const stakeholders = await service.listStakeholders(token, req.query.projectId);
          return reply.send({ stakeholders });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateStakeholderInput }>(
      '/communications/stakeholders',
      stakeholderManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const stakeholder = await service.createStakeholder(token, req.body);
          return reply.status(201).send({ stakeholder });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.delete<{ Params: { id: string } }>(
      '/communications/stakeholders/:id',
      stakeholderManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const success = await service.deleteStakeholder(token, req.params.id);
          return reply.send({ success });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. COMMUNICATION LOGS & FORMAL NOTICES
    // =======================================================================
    app.get<{ Querystring: { projectId?: string } }>(
      '/communications/logs',
      logManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const logs = await service.listCommunicationLogs(token, req.query.projectId);
          return reply.send({ logs });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateCommunicationLogInput }>(
      '/communications/logs',
      logManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const log = await service.createCommunicationLog(token, req.body);
          return reply.status(201).send({ log });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.patch<{ Params: { id: string }; Body: { status: CommunicationStatus } }>(
      '/communications/logs/:id/status',
      logManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const log = await service.updateCommunicationLogStatus(token, req.params.id, req.body.status);
          return reply.send({ log });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. MEETING MINUTES (MOM) & ACTION ITEMS
    // =======================================================================
    app.get<{ Querystring: { projectId?: string } }>(
      '/communications/meeting-minutes',
      minutesManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const minutes = await service.listMeetingMinutes(token, req.query.projectId);
          return reply.send({ minutes });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateMeetingMinutesInput }>(
      '/communications/meeting-minutes',
      minutesManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const minutes = await service.createMeetingMinutes(token, req.body);
          return reply.status(201).send({ minutes });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.patch<{ Params: { id: string; actionId: string }; Body: { status: 'pending' | 'in_progress' | 'completed' } }>(
      '/communications/meeting-minutes/:id/actions/:actionId',
      minutesManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const minutes = await service.updateActionItemStatus(
            token,
            req.params.id,
            req.params.actionId,
            req.body.status
          );
          return reply.send({ minutes });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 4. CLIENT COMPLAINTS & ESCALATIONS
    // =======================================================================
    app.get<{ Querystring: { projectId?: string } }>(
      '/communications/complaints',
      complaintManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const complaints = await service.listComplaints(token, req.query.projectId);
          return reply.send({ complaints });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateClientComplaintInput }>(
      '/communications/complaints',
      complaintManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const complaint = await service.createComplaint(token, req.body);
          return reply.status(201).send({ complaint });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: { resolutionPlan: string } }>(
      '/communications/complaints/:id/resolve',
      complaintResolveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: 'Missing authorization token' });

        try {
          const complaint = await service.resolveComplaint(token, req.params.id, req.body.resolutionPlan);
          return reply.send({ complaint });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
