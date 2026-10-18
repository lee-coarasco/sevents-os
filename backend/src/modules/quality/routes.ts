import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { QualityRepository } from "./repository.js";
import { QualityService } from "./service.js";
import type {
  ChecklistResult,
  ITPStatus,
  NCRSeverity,
  PointType,
  RootCauseCategory,
  TradeDiscipline,
  WIRStatus,
} from "./types.js";

export interface QualityRoutesOptions {
  getRepository: () => QualityRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerQualityRoutes(options: QualityRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new QualityService(options.getRepository());

    const itpManageGuard = { preHandler: [options.permissionGuard("quality.itp.manage")] };
    const inspectionManageGuard = { preHandler: [options.permissionGuard("quality.inspection.manage")] };
    const inspectionSignoffGuard = { preHandler: [options.permissionGuard("quality.inspection.signoff")] };
    const ncrManageGuard = { preHandler: [options.permissionGuard("quality.ncr.manage")] };
    const ncrCloseGuard = { preHandler: [options.permissionGuard("quality.ncr.close")] };

    // =======================================================================
    // 1. QUALITY INSPECTION & TEST PLANS (ITP)
    // =======================================================================

    // List ITPs for a project
    app.get<{ Params: { projectId: string } }>(
      "/projects/:projectId/quality/plans",
      inspectionManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const plans = await service.listPlans(token, req.params.projectId);
          return reply.send({ plans });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create an ITP
    app.post<{
      Params: { projectId: string };
      Body: {
        planNumber: string;
        title: string;
        tradeDiscipline: TradeDiscipline;
        version?: string;
        applicableSpecifications?: string;
        items?: Array<{
          itemSequence?: number;
          activityName: string;
          acceptanceCriteria: string;
          pointType: PointType;
          referenceStandard?: string;
          verifyingDocument?: string;
        }>;
      };
    }>(
      "/projects/:projectId/quality/plans",
      itpManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const plan = await service.createPlan(token, {
            project_id: req.params.projectId,
            plan_number: req.body.planNumber,
            title: req.body.title,
            trade_discipline: req.body.tradeDiscipline,
            version: req.body.version,
            applicable_specifications: req.body.applicableSpecifications,
            items: req.body.items?.map((it) => ({
              item_sequence: it.itemSequence,
              activity_name: it.activityName,
              acceptance_criteria: it.acceptanceCriteria,
              point_type: it.pointType,
              reference_standard: it.referenceStandard,
              verifying_document: it.verifyingDocument,
            })),
          });
          return reply.status(201).send({ plan });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Get ITP by ID
    app.get<{ Params: { planId: string } }>(
      "/quality/plans/:planId",
      inspectionManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const plan = await service.getPlan(token, req.params.planId);
          return reply.send({ plan });
        } catch (err: any) {
          return reply.status(404).send({ error: err.message });
        }
      }
    );

    // Update ITP status
    app.patch<{
      Params: { planId: string };
      Body: { status: ITPStatus };
    }>(
      "/quality/plans/:planId/status",
      itpManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const plan = await service.updatePlanStatus(token, req.params.planId, req.body.status);
          return reply.send({ plan });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. WORK INSPECTION REQUESTS (WIR / RFI)
    // =======================================================================

    // List WIRs for a project
    app.get<{ Params: { projectId: string } }>(
      "/projects/:projectId/quality/wirs",
      inspectionManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const wirs = await service.listWIRs(token, req.params.projectId);
          return reply.send({ wirs });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create a WIR
    app.post<{
      Params: { projectId: string };
      Body: {
        planId?: string;
        wirNumber: string;
        title: string;
        tradeDiscipline: TradeDiscipline;
        locationOrGrid: string;
        inspectionDate?: string;
        contractorRepresentative?: string;
        checklist?: Array<{
          itemSequence?: number;
          checkpointDescription: string;
          result?: ChecklistResult;
          comments?: string;
        }>;
      };
    }>(
      "/projects/:projectId/quality/wirs",
      inspectionManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const wir = await service.createWIR(token, {
            project_id: req.params.projectId,
            plan_id: req.body.planId,
            wir_number: req.body.wirNumber,
            title: req.body.title,
            trade_discipline: req.body.tradeDiscipline,
            location_or_grid: req.body.locationOrGrid,
            inspection_date: req.body.inspectionDate,
            contractor_representative: req.body.contractorRepresentative,
            checklist: req.body.checklist?.map((c) => ({
              item_sequence: c.itemSequence,
              checkpoint_description: c.checkpointDescription,
              result: c.result,
              comments: c.comments,
            })),
          });
          return reply.status(201).send({ wir });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Get WIR by ID
    app.get<{ Params: { wirId: string } }>(
      "/quality/wirs/:wirId",
      inspectionManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const wir = await service.getWIR(token, req.params.wirId);
          return reply.send({ wir });
        } catch (err: any) {
          return reply.status(404).send({ error: err.message });
        }
      }
    );

    // Sign off WIR (pass, conditional, reject + auto NCR)
    app.post<{
      Params: { wirId: string };
      Body: {
        status: "approved" | "conditionally_approved" | "rejected";
        inspectorName: string;
        inspectorRemarks?: string;
        checklistUpdates?: Array<{
          id: string;
          result: ChecklistResult;
          comments?: string;
        }>;
        autoCreateNcr?: boolean;
      };
    }>(
      "/quality/wirs/:wirId/sign-off",
      inspectionSignoffGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const result = await service.signOffWIR(token, req.params.wirId, {
            status: req.body.status,
            inspector_name: req.body.inspectorName,
            inspector_remarks: req.body.inspectorRemarks,
            checklist_updates: req.body.checklistUpdates,
            auto_create_ncr: req.body.autoCreateNcr,
          });
          return reply.send(result);
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. NON-CONFORMANCE REPORTS (NCR)
    // =======================================================================

    // List NCRs for a project
    app.get<{ Params: { projectId: string } }>(
      "/projects/:projectId/quality/ncrs",
      ncrManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const ncrs = await service.listNCRs(token, req.params.projectId);
          return reply.send({ ncrs });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create an NCR
    app.post<{
      Params: { projectId: string };
      Body: {
        wirId?: string;
        ncrNumber: string;
        title: string;
        tradeDiscipline: TradeDiscipline;
        locationOrGrid: string;
        severity: NCRSeverity;
        issueDescription: string;
        rootCauseCategory: RootCauseCategory;
        issuedBy: string;
        issuedTo: string;
        targetClosureDate?: string;
        containmentAction?: string;
      };
    }>(
      "/projects/:projectId/quality/ncrs",
      ncrManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const ncr = await service.createNCR(token, {
            project_id: req.params.projectId,
            wir_id: req.body.wirId,
            ncr_number: req.body.ncrNumber,
            title: req.body.title,
            trade_discipline: req.body.tradeDiscipline,
            location_or_grid: req.body.locationOrGrid,
            severity: req.body.severity,
            issue_description: req.body.issueDescription || (req.body as any).issue_description,
            root_cause_category: req.body.rootCauseCategory || (req.body as any).root_cause_category,
            issued_by: req.body.issuedBy || (req.body as any).issued_by,
            issued_to: req.body.issuedTo,
            target_closure_date: req.body.targetClosureDate,
            containment_action: req.body.containmentAction,
          });
          return reply.status(201).send({ ncr });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Get NCR by ID
    app.get<{ Params: { ncrId: string } }>(
      "/quality/ncrs/:ncrId",
      ncrManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const ncr = await service.getNCR(token, req.params.ncrId);
          return reply.send({ ncr });
        } catch (err: any) {
          return reply.status(404).send({ error: err.message });
        }
      }
    );

    // Submit CAPA for an NCR
    app.post<{
      Params: { ncrId: string };
      Body: {
        containmentAction?: string;
        correctiveActionPlan: string;
        preventiveActionPlan: string;
      };
    }>(
      "/quality/ncrs/:ncrId/capa",
      ncrManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const ncr = await service.submitCAPA(token, req.params.ncrId, {
            containment_action: req.body.containmentAction,
            corrective_action_plan: req.body.correctiveActionPlan,
            preventive_action_plan: req.body.preventiveActionPlan,
          });
          return reply.send({ ncr });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Verify and close NCR
    app.post<{
      Params: { ncrId: string };
      Body: {
        closedBy: string;
        closureRemarks: string;
      };
    }>(
      "/quality/ncrs/:ncrId/close",
      ncrCloseGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const ncr = await service.closeNCR(token, req.params.ncrId, {
            closed_by: req.body.closedBy,
            closure_remarks: req.body.closureRemarks,
          });
          return reply.send({ ncr });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
