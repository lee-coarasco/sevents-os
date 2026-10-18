import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { ContractsRepository } from "./types.js";
import { ContractsService } from "./service.js";
import type {
  CreateContractInput,
  CreateVariationInput,
  ApproveVariationInput,
  CreateClaimInput,
  AssessClaimInput,
  CreateSecurityInput,
  SecurityStatus,
} from "./types.js";

export interface ContractsRoutesOptions {
  getRepository: () => ContractsRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerContractsRoutes(options: ContractsRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new ContractsService(options.getRepository());

    const contractManageGuard = { preHandler: [options.permissionGuard("contracts.contract.manage")] };
    const variationManageGuard = { preHandler: [options.permissionGuard("contracts.variation.manage")] };
    const variationApproveGuard = { preHandler: [options.permissionGuard("contracts.variation.approve")] };
    const claimManageGuard = { preHandler: [options.permissionGuard("contracts.claim.manage")] };
    const claimAssessGuard = { preHandler: [options.permissionGuard("contracts.claim.assess")] };
    const securityManageGuard = { preHandler: [options.permissionGuard("contracts.security.manage")] };

    // =======================================================================
    // 1. CONTRACTS REPOSITORY
    // =======================================================================

    app.get<{ Querystring: { projectId?: string } }>(
      "/contracts",
      contractManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const contracts = await service.listContracts(token, req.query.projectId);
          return reply.send({ contracts });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateContractInput }>(
      "/contracts",
      contractManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const contract = await service.createContract(token, req.body);
          return reply.status(201).send({ contract });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.get<{ Params: { id: string } }>(
      "/contracts/:id",
      contractManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const contract = await service.getContractById(token, req.params.id);
          if (!contract) return reply.status(404).send({ error: "Contract not found" });
          return reply.send({ contract });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. VARIATION ORDERS
    // =======================================================================

    app.get<{ Querystring: { projectId?: string; contractId?: string } }>(
      "/contracts/variations",
      variationManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const variations = await service.listVariations(token, req.query.projectId, req.query.contractId);
          return reply.send({ variations });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateVariationInput }>(
      "/contracts/variations",
      variationManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const variation = await service.createVariation(token, req.body);
          return reply.status(201).send({ variation });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: ApproveVariationInput }>(
      "/contracts/variations/:id/approve",
      variationApproveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const variation = await service.approveVariation(token, req.params.id, req.body);
          return reply.send({ variation });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. CLAIMS & EOT
    // =======================================================================

    app.get<{ Querystring: { projectId?: string; contractId?: string } }>(
      "/contracts/claims",
      claimManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const claims = await service.listClaims(token, req.query.projectId, req.query.contractId);
          return reply.send({ claims });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateClaimInput }>(
      "/contracts/claims",
      claimManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const claim = await service.createClaim(token, req.body);
          return reply.status(201).send({ claim });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: AssessClaimInput }>(
      "/contracts/claims/:id/assess",
      claimAssessGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const claim = await service.assessClaim(token, req.params.id, req.body);
          return reply.send({ claim });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 4. SECURITIES (BONDS, GUARANTEES, INSURANCE)
    // =======================================================================

    app.get<{ Querystring: { projectId?: string; contractId?: string } }>(
      "/contracts/securities",
      securityManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const securities = await service.listSecurities(token, req.query.projectId, req.query.contractId);
          return reply.send({ securities });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateSecurityInput }>(
      "/contracts/securities",
      securityManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const security = await service.createSecurity(token, req.body);
          return reply.status(201).send({ security });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: { status: SecurityStatus } }>(
      "/contracts/securities/:id/status",
      securityManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const security = await service.updateSecurityStatus(token, req.params.id, req.body.status);
          return reply.send({ security });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
