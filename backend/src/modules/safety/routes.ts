import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { SafetyRepository } from "./repository.js";
import { SafetyService } from "./service.js";
import type {
  IncidentSeverity,
  IncidentType,
  ObservationType,
  PermitType,
  RiskLevel,
  TradeDiscipline,
} from "./types.js";

export interface SafetyRoutesOptions {
  getRepository: () => SafetyRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerSafetyRoutes(options: SafetyRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new SafetyService(options.getRepository());

    const ptwManageGuard = { preHandler: [options.permissionGuard("safety.ptw.manage")] };
    const ptwApproveGuard = { preHandler: [options.permissionGuard("safety.ptw.approve")] };
    const incidentManageGuard = { preHandler: [options.permissionGuard("safety.incident.manage")] };
    const incidentInvestigateGuard = { preHandler: [options.permissionGuard("safety.incident.investigate")] };
    const hazardManageGuard = { preHandler: [options.permissionGuard("safety.hazard.manage")] };
    const tbtManageGuard = { preHandler: [options.permissionGuard("safety.tbt.manage")] };

    // =======================================================================
    // 1. PERMITS TO WORK (PTW)
    // =======================================================================

    // List PTWs for a project
    app.get<{ Params: { projectId: string } }>(
      "/projects/:projectId/safety/permits",
      ptwManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const permits = await service.listPermits(token, req.params.projectId);
          return reply.send({ permits });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create a PTW
    app.post<{
      Params: { projectId: string };
      Body: {
        permitNumber: string;
        permitType: PermitType;
        title: string;
        locationOrGrid: string;
        startTime: string;
        expiryTime: string;
        contractorName: string;
        supervisorName: string;
        precautionsTaken?: string;
        gasTestRequired?: boolean;
        gasTestResults?: string;
      };
    }>(
      "/projects/:projectId/safety/permits",
      ptwManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const permit = await service.createPermit(token, {
            project_id: req.params.projectId,
            permit_number: req.body.permitNumber,
            permit_type: req.body.permitType,
            title: req.body.title,
            location_or_grid: req.body.locationOrGrid,
            start_time: req.body.startTime,
            expiry_time: req.body.expiryTime,
            contractor_name: req.body.contractorName,
            supervisor_name: req.body.supervisorName,
            precautions_taken: req.body.precautionsTaken,
            gas_test_required: req.body.gasTestRequired,
            gas_test_results: req.body.gasTestResults,
          });
          return reply.status(201).send({ permit });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Authorize / Activate / Suspend PTW
    app.post<{
      Params: { permitId: string };
      Body: {
        status: "active" | "suspended" | "closed" | "cancelled";
        safetyOfficerName: string;
        precautionsTaken?: string;
      };
    }>(
      "/safety/permits/:permitId/authorize",
      ptwApproveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const permit = await service.authorizePermit(token, req.params.permitId, {
            status: req.body.status,
            safety_officer_name: req.body.safetyOfficerName,
            precautions_taken: req.body.precautionsTaken,
          });
          return reply.send({ permit });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. INCIDENTS & EMERGENCY
    // =======================================================================

    // List Incidents
    app.get<{ Params: { projectId: string } }>(
      "/projects/:projectId/safety/incidents",
      incidentManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const incidents = await service.listIncidents(token, req.params.projectId);
          return reply.send({ incidents });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Report Incident
    app.post<{
      Params: { projectId: string };
      Body: {
        incidentNumber: string;
        incidentDate?: string;
        incidentType: IncidentType;
        severity: IncidentSeverity;
        locationOrGrid: string;
        description: string;
        injuredPersonName?: string;
        injuryDetails?: string;
        lostWorkdays?: number;
        immediateActionTaken?: string;
        reportedBy: string;
      };
    }>(
      "/projects/:projectId/safety/incidents",
      incidentManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const incident = await service.createIncident(token, {
            project_id: req.params.projectId,
            incident_number: req.body.incidentNumber,
            incident_date: req.body.incidentDate,
            incident_type: req.body.incidentType,
            severity: req.body.severity,
            location_or_grid: req.body.locationOrGrid,
            description: req.body.description,
            injured_person_name: req.body.injuredPersonName,
            injury_details: req.body.injuryDetails,
            lost_workdays: req.body.lostWorkdays,
            immediate_action_taken: req.body.immediateActionTaken,
            reported_by: req.body.reportedBy,
          });
          return reply.status(201).send({ incident });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Investigate Incident & Assign CAPA
    app.post<{
      Params: { incidentId: string };
      Body: {
        investigatedBy: string;
        rootCauseAnalysis: string;
        correctivePreventiveAction: string;
        lostWorkdays?: number;
        status?: "under_investigation" | "capa_assigned";
      };
    }>(
      "/safety/incidents/:incidentId/investigate",
      incidentInvestigateGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const incident = await service.investigateIncident(token, req.params.incidentId, {
            investigated_by: req.body.investigatedBy,
            root_cause_analysis: req.body.rootCauseAnalysis,
            corrective_preventive_action: req.body.correctivePreventiveAction,
            lost_workdays: req.body.lostWorkdays,
            status: req.body.status,
          });
          return reply.send({ incident });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Close Incident
    app.post<{
      Params: { incidentId: string };
      Body: { closedBy: string };
    }>(
      "/safety/incidents/:incidentId/close",
      incidentInvestigateGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const incident = await service.closeIncident(token, req.params.incidentId, {
            closed_by: req.body.closedBy,
          });
          return reply.send({ incident });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. HAZARDS & STOP-WORK
    // =======================================================================

    // List Hazards
    app.get<{ Params: { projectId: string } }>(
      "/projects/:projectId/safety/hazards",
      hazardManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const hazards = await service.listHazards(token, req.params.projectId);
          return reply.send({ hazards });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Log Hazard Observation
    app.post<{
      Params: { projectId: string };
      Body: {
        observationNumber: string;
        observationType: ObservationType;
        riskLevel: RiskLevel;
        stopWorkIssued?: boolean;
        locationOrGrid: string;
        description: string;
        actionRequired: string;
        reportedBy: string;
        assignedTo?: string;
        targetRectificationDate?: string;
      };
    }>(
      "/projects/:projectId/safety/hazards",
      hazardManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const hazard = await service.createHazard(token, {
            project_id: req.params.projectId,
            observation_number: req.body.observationNumber,
            observation_type: req.body.observationType,
            risk_level: req.body.riskLevel,
            stop_work_issued: req.body.stopWorkIssued,
            location_or_grid: req.body.locationOrGrid,
            description: req.body.description,
            action_required: req.body.actionRequired,
            reported_by: req.body.reportedBy,
            assigned_to: req.body.assignedTo,
            target_rectification_date: req.body.targetRectificationDate,
          });
          return reply.status(201).send({ hazard });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Rectify / Close Hazard
    app.post<{
      Params: { hazardId: string };
      Body: {
        rectificationEvidence: string;
        status: "rectified" | "closed";
      };
    }>(
      "/safety/hazards/:hazardId/rectify",
      hazardManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const hazard = await service.rectifyHazard(token, req.params.hazardId, {
            rectification_evidence: req.body.rectificationEvidence,
            status: req.body.status,
          });
          return reply.send({ hazard });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 4. TOOLBOX TALKS (TBT)
    // =======================================================================

    // List TBTs
    app.get<{ Params: { projectId: string } }>(
      "/projects/:projectId/safety/toolbox-talks",
      tbtManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const toolboxTalks = await service.listToolboxTalks(token, req.params.projectId);
          return reply.send({ toolboxTalks });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Record TBT
    app.post<{
      Params: { projectId: string };
      Body: {
        tbtNumber: string;
        talkDate?: string;
        topic: string;
        conductedBy: string;
        tradeDiscipline: TradeDiscipline;
        attendeeCount: number;
        keyPointsDiscussed?: string;
        notes?: string;
      };
    }>(
      "/projects/:projectId/safety/toolbox-talks",
      tbtManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const toolboxTalk = await service.createToolboxTalk(token, {
            project_id: req.params.projectId,
            tbt_number: req.body.tbtNumber,
            talk_date: req.body.talkDate,
            topic: req.body.topic,
            conducted_by: req.body.conductedBy,
            trade_discipline: req.body.tradeDiscipline,
            attendee_count: req.body.attendeeCount,
            key_points_discussed: req.body.keyPointsDiscussed,
            notes: req.body.notes,
          });
          return reply.status(201).send({ toolboxTalk });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
