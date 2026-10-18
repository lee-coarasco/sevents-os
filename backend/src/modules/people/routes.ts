import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { PeopleRepository } from "./types.js";
import { PeopleService } from "./service.js";
import type {
  CreateManpowerRequestInput,
  ApproveManpowerRequestInput,
  CreateCandidateInput,
  UpdateCandidateStageInput,
  CreateCompetencyInput,
  CreateAppraisalInput,
} from "./types.js";

export interface PeopleRoutesOptions {
  getRepository: () => PeopleRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerPeopleRoutes(options: PeopleRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new PeopleService(options.getRepository());

    const manpowerManageGuard = { preHandler: [options.permissionGuard("people.manpower.manage")] };
    const manpowerApproveGuard = { preHandler: [options.permissionGuard("people.manpower.approve")] };
    const recruitmentManageGuard = { preHandler: [options.permissionGuard("people.recruitment.manage")] };
    const competencyManageGuard = { preHandler: [options.permissionGuard("people.competency.manage")] };
    const appraisalManageGuard = { preHandler: [options.permissionGuard("people.appraisal.manage")] };

    // =======================================================================
    // 1. MANPOWER REQUESTS
    // =======================================================================

    app.get<{ Querystring: { projectId?: string } }>(
      "/people/manpower-requests",
      manpowerManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const requests = await service.listManpowerRequests(token, req.query.projectId);
          return reply.send({ requests });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateManpowerRequestInput }>(
      "/people/manpower-requests",
      manpowerManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const request = await service.createManpowerRequest(token, req.body);
          return reply.status(201).send({ request });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: ApproveManpowerRequestInput }>(
      "/people/manpower-requests/:id/approve",
      manpowerApproveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const request = await service.approveManpowerRequest(token, req.params.id, req.body);
          return reply.send({ request });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. RECRUITMENT CANDIDATES
    // =======================================================================

    app.get<{ Querystring: { requestId?: string } }>(
      "/people/candidates",
      recruitmentManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const candidates = await service.listCandidates(token, req.query.requestId);
          return reply.send({ candidates });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateCandidateInput }>(
      "/people/candidates",
      recruitmentManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const candidate = await service.createCandidate(token, req.body);
          return reply.status(201).send({ candidate });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: UpdateCandidateStageInput }>(
      "/people/candidates/:id/stage",
      recruitmentManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const candidate = await service.updateCandidateStage(token, req.params.id, req.body);
          return reply.send({ candidate });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. SITE COMPETENCIES
    // =======================================================================

    app.get(
      "/people/competencies",
      competencyManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const competencies = await service.listCompetencies(token);
          return reply.send({ competencies });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateCompetencyInput }>(
      "/people/competencies",
      competencyManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const competency = await service.createCompetency(token, req.body);
          return reply.status(201).send({ competency });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 4. PERFORMANCE APPRAISALS
    // =======================================================================

    app.get(
      "/people/appraisals",
      appraisalManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const appraisals = await service.listAppraisals(token);
          return reply.send({ appraisals });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateAppraisalInput }>(
      "/people/appraisals",
      appraisalManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const appraisal = await service.createAppraisal(token, req.body);
          return reply.status(201).send({ appraisal });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string } }>(
      "/people/appraisals/:id/complete",
      appraisalManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const appraisal = await service.completeAppraisal(token, req.params.id);
          return reply.send({ appraisal });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
