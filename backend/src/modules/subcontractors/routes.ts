import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { SubcontractorRepository } from "./repository.js";
import { SubcontractorService } from "./service.js";
import type {
  ClaimStatus,
  MeasuredWorkStatus,
  MilestoneStatus,
  TradeDiscipline,
  WorkOrderStatus,
} from "./types.js";

export interface SubcontractorRoutesOptions {
  getRepository: () => SubcontractorRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerSubcontractorRoutes(options: SubcontractorRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new SubcontractorService(options.getRepository());

    const woManageGuard = { preHandler: [options.permissionGuard("subcontractor.workorder.manage")] };
    const woViewGuard = { preHandler: [options.permissionGuard("subcontractor.workorder.view")] };
    const attendanceGuard = { preHandler: [options.permissionGuard("subcontractor.attendance.manage")] };
    const claimsManageGuard = { preHandler: [options.permissionGuard("subcontractor.claims.manage")] };
    const claimsCertifyGuard = { preHandler: [options.permissionGuard("subcontractor.claims.certify")] };

    // =======================================================================
    // WORK ORDERS & MILESTONES
    // =======================================================================

    // List work orders for a project
    app.get<{ Params: { projectId: string } }>(
      "/projects/:projectId/subcontractors/work-orders",
      woViewGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const workOrders = await service.listWorkOrders(token, req.params.projectId);
          return reply.send({ workOrders });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create a new work order
    app.post<{
      Params: { projectId: string };
      Body: {
        vendorId?: string | null;
        workOrderNumber: string;
        title: string;
        tradeDiscipline: TradeDiscipline;
        contractValue: number;
        retentionRatePct?: number;
        startDate?: string | null;
        completionDate?: string | null;
        scopeOfWork?: string | null;
      };
    }>(
      "/projects/:projectId/subcontractors/work-orders",
      woManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const workOrder = await service.createWorkOrder(token, {
            projectId: req.params.projectId,
            vendorId: req.body.vendorId,
            workOrderNumber: req.body.workOrderNumber,
            title: req.body.title,
            tradeDiscipline: req.body.tradeDiscipline,
            contractValue: req.body.contractValue,
            retentionRatePct: req.body.retentionRatePct,
            startDate: req.body.startDate,
            completionDate: req.body.completionDate,
            scopeOfWork: req.body.scopeOfWork,
          });
          return reply.status(201).send({ workOrder });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Get work order by ID
    app.get<{ Params: { id: string } }>(
      "/subcontractors/work-orders/:id",
      woViewGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const workOrder = await service.getWorkOrder(token, req.params.id);
          const milestones = await service.listMilestones(token, req.params.id);
          return reply.send({ workOrder, milestones });
        } catch (err: any) {
          return reply.status(404).send({ error: err.message });
        }
      }
    );

    // Update work order status
    app.patch<{ Params: { id: string }; Body: { status: WorkOrderStatus } }>(
      "/subcontractors/work-orders/:id/status",
      woManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const workOrder = await service.updateWorkOrderStatus(token, req.params.id, req.body.status);
          return reply.send({ workOrder });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Add milestone to work order
    app.post<{
      Params: { id: string };
      Body: {
        milestoneName: string;
        description?: string | null;
        amount: number;
        plannedDate?: string | null;
      };
    }>(
      "/subcontractors/work-orders/:id/milestones",
      woManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const milestone = await service.createMilestone(token, {
            workOrderId: req.params.id,
            milestoneName: req.body.milestoneName,
            description: req.body.description,
            amount: req.body.amount,
            plannedDate: req.body.plannedDate,
          });
          return reply.status(201).send({ milestone });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Update milestone status
    app.patch<{ Params: { milestoneId: string }; Body: { status: MilestoneStatus } }>(
      "/subcontractors/milestones/:milestoneId/status",
      woManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const milestone = await service.updateMilestoneStatus(token, req.params.milestoneId, req.body.status);
          return reply.send({ milestone });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // ATTENDANCE & MANPOWER
    // =======================================================================

    // List attendance logs
    app.get<{ Params: { projectId: string }; Querystring: { date?: string } }>(
      "/projects/:projectId/subcontractors/attendance",
      woViewGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const logs = await service.listAttendanceLogs(token, req.params.projectId, req.query.date);
          return reply.send({ logs });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create attendance log
    app.post<{
      Params: { projectId: string };
      Body: {
        workOrderId: string;
        date: string;
        trade: string;
        skilledCount: number;
        unskilledCount: number;
        totalHours: number;
        supervisorName?: string | null;
        notes?: string | null;
      };
    }>(
      "/projects/:projectId/subcontractors/attendance",
      attendanceGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const log = await service.createAttendanceLog(token, {
            projectId: req.params.projectId,
            workOrderId: req.body.workOrderId,
            date: req.body.date,
            trade: req.body.trade,
            skilledCount: req.body.skilledCount,
            unskilledCount: req.body.unskilledCount,
            totalHours: req.body.totalHours,
            supervisorName: req.body.supervisorName,
            notes: req.body.notes,
          });
          return reply.status(201).send({ log });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // MEASURED WORKS
    // =======================================================================

    // List measured works for work order
    app.get<{ Params: { workOrderId: string } }>(
      "/subcontractors/work-orders/:workOrderId/measured-works",
      woViewGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const measuredWorks = await service.listMeasuredWorks(token, req.params.workOrderId);
          return reply.send({ measuredWorks });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create measured work
    app.post<{
      Params: { workOrderId: string };
      Body: {
        measurementDate: string;
        wbsCode?: string | null;
        boqItemReference?: string | null;
        description: string;
        uom: string;
        quantityMeasured: number;
        unitRate: number;
        measuredBy?: string | null;
      };
    }>(
      "/subcontractors/work-orders/:workOrderId/measured-works",
      claimsManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const measuredWork = await service.createMeasuredWork(token, {
            workOrderId: req.params.workOrderId,
            measurementDate: req.body.measurementDate,
            wbsCode: req.body.wbsCode,
            boqItemReference: req.body.boqItemReference,
            description: req.body.description,
            uom: req.body.uom,
            quantityMeasured: req.body.quantityMeasured,
            unitRate: req.body.unitRate,
            measuredBy: req.body.measuredBy,
          });
          return reply.status(201).send({ measuredWork });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Update measured work status (verify/certify)
    app.patch<{ Params: { id: string }; Body: { status: MeasuredWorkStatus } }>(
      "/subcontractors/measured-works/:id/status",
      claimsCertifyGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const measuredWork = await service.updateMeasuredWorkStatus(token, req.params.id, req.body.status);
          return reply.send({ measuredWork });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // PAYMENT CLAIMS & RETENTION
    // =======================================================================

    // List payment claims for a project
    app.get<{ Params: { projectId: string } }>(
      "/projects/:projectId/subcontractors/payment-claims",
      woViewGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const claims = await service.listPaymentClaims(token, req.params.projectId);
          return reply.send({ claims });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create payment claim
    app.post<{
      Params: { projectId: string };
      Body: {
        workOrderId: string;
        claimNumber: string;
        periodStart: string;
        periodEnd: string;
        claimedAmount: number;
        notes?: string | null;
      };
    }>(
      "/projects/:projectId/subcontractors/payment-claims",
      claimsManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const claim = await service.createPaymentClaim(token, {
            projectId: req.params.projectId,
            workOrderId: req.body.workOrderId,
            claimNumber: req.body.claimNumber,
            periodStart: req.body.periodStart,
            periodEnd: req.body.periodEnd,
            claimedAmount: req.body.claimedAmount,
            notes: req.body.notes,
          });
          return reply.status(201).send({ claim });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Certify payment claim
    app.post<{
      Params: { id: string };
      Body: {
        certifiedAmount: number;
        notes?: string | null;
      };
    }>(
      "/subcontractors/payment-claims/:id/certify",
      claimsCertifyGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const claim = await service.certifyPaymentClaim(
            token,
            req.params.id,
            req.body.certifiedAmount,
            req.body.notes
          );
          return reply.send({ claim });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
