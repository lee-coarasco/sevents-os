import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { EquipmentRepository } from "./repository.js";
import { EquipmentService } from "./service.js";
import type {
  CertificateType,
  EquipmentCategory,
  EquipmentStatus,
  MaintenanceStatus,
  MaintenanceType,
  OwnershipType,
} from "./types.js";

export interface EquipmentRoutesOptions {
  getRepository: () => EquipmentRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerEquipmentRoutes(options: EquipmentRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new EquipmentService(options.getRepository());

    const assetManageGuard = { preHandler: [options.permissionGuard("equipment.asset.manage")] };
    const allocManageGuard = { preHandler: [options.permissionGuard("equipment.allocation.manage")] };
    const allocApproveGuard = { preHandler: [options.permissionGuard("equipment.allocation.approve")] };
    const logManageGuard = { preHandler: [options.permissionGuard("equipment.log.manage")] };
    const maintManageGuard = { preHandler: [options.permissionGuard("equipment.maintenance.manage")] };
    const certManageGuard = { preHandler: [options.permissionGuard("equipment.certificate.manage")] };

    // =======================================================================
    // 1. ASSET MASTER REGISTER
    // =======================================================================

    // List assets
    app.get<{ Querystring: { category?: EquipmentCategory; status?: EquipmentStatus } }>(
      "/equipment/assets",
      assetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const assets = await service.listAssets(token, req.query.category, req.query.status);
          return reply.send({ assets });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Get asset by ID
    app.get<{ Params: { id: string } }>(
      "/equipment/assets/:id",
      assetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const asset = await service.getAssetById(token, req.params.id);
          if (!asset) return reply.status(404).send({ error: "Asset not found" });
          return reply.send({ asset });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create asset
    app.post<{
      Body: {
        assetCode: string;
        name: string;
        category: EquipmentCategory;
        make: string;
        model: string;
        yearOfManufacture?: number;
        serialOrVin?: string;
        ownershipType: OwnershipType;
        hireVendorName?: string;
        dailyRate: number;
        currentMeterHours?: number;
        currentProjectId?: string;
      };
    }>(
      "/equipment/assets",
      assetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const asset = await service.createAsset(token, {
            asset_code: req.body.assetCode,
            name: req.body.name,
            category: req.body.category,
            make: req.body.make,
            model: req.body.model,
            year_of_manufacture: req.body.yearOfManufacture,
            serial_or_vin: req.body.serialOrVin,
            ownership_type: req.body.ownershipType,
            hire_vendor_name: req.body.hireVendorName,
            daily_rate: req.body.dailyRate,
            current_meter_hours: req.body.currentMeterHours,
            current_project_id: req.body.currentProjectId,
          });
          return reply.status(201).send({ asset });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Update asset status
    app.patch<{
      Params: { id: string };
      Body: {
        status: EquipmentStatus;
        currentProjectId?: string | null;
        currentMeterHours?: number;
      };
    }>(
      "/equipment/assets/:id/status",
      assetManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const asset = await service.updateAssetStatus(token, req.params.id, {
            status: req.body.status,
            current_project_id: req.body.currentProjectId,
            current_meter_hours: req.body.currentMeterHours,
          });
          return reply.send({ asset });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. MOBILIZATION & ALLOCATIONS
    // =======================================================================

    // List allocations
    app.get<{ Querystring: { projectId?: string; equipmentId?: string } }>(
      "/equipment/allocations",
      allocManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const allocations = await service.listAllocations(
            token,
            req.query.projectId,
            req.query.equipmentId
          );
          return reply.send({ allocations });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create allocation request
    app.post<{
      Body: {
        equipmentId: string;
        projectId: string;
        allocationNumber: string;
        mobilizationDate: string;
        expectedDemobilizationDate?: string;
        gridLocation?: string;
        requestedBy: string;
        notes?: string;
      };
    }>(
      "/equipment/allocations",
      allocManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const allocation = await service.createAllocation(token, {
            equipment_id: req.body.equipmentId,
            project_id: req.body.projectId,
            allocation_number: req.body.allocationNumber,
            mobilization_date: req.body.mobilizationDate,
            expected_demobilization_date: req.body.expectedDemobilizationDate,
            grid_location: req.body.gridLocation,
            requested_by: req.body.requestedBy,
            notes: req.body.notes,
          });
          return reply.status(201).send({ allocation });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Authorize / Mobilize / Demobilize allocation
    app.post<{
      Params: { id: string };
      Body: {
        status: "approved" | "mobilized" | "demobilized";
        approvedBy: string;
        actualDemobilizationDate?: string;
      };
    }>(
      "/equipment/allocations/:id/authorize",
      allocApproveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const allocation = await service.authorizeAllocation(token, req.params.id, {
            status: req.body.status,
            approved_by: req.body.approvedBy,
            actual_demobilization_date: req.body.actualDemobilizationDate,
          });
          return reply.send({ allocation });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. DAILY EQUIPMENT LOGS
    // =======================================================================

    // List daily logs
    app.get<{ Querystring: { projectId?: string; equipmentId?: string } }>(
      "/equipment/daily-logs",
      logManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const logs = await service.listDailyLogs(
            token,
            req.query.projectId,
            req.query.equipmentId
          );
          return reply.send({ logs });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Record daily log
    app.post<{
      Body: {
        equipmentId: string;
        projectId: string;
        logDate: string;
        operatingHours: number;
        idleHours?: number;
        breakdownHours?: number;
        startMeterReading: number;
        endMeterReading: number;
        fuelAddedLitres?: number;
        operatorName: string;
        workDescription: string;
        supervisorSignoff?: string;
      };
    }>(
      "/equipment/daily-logs",
      logManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const log = await service.createDailyLog(token, {
            equipment_id: req.body.equipmentId,
            project_id: req.body.projectId,
            log_date: req.body.logDate,
            operating_hours: req.body.operatingHours,
            idle_hours: req.body.idleHours,
            breakdown_hours: req.body.breakdownHours,
            start_meter_reading: req.body.startMeterReading,
            end_meter_reading: req.body.endMeterReading,
            fuel_added_litres: req.body.fuelAddedLitres,
            operator_name: req.body.operatorName,
            work_description: req.body.workDescription,
            supervisor_signoff: req.body.supervisorSignoff,
          });
          return reply.status(201).send({ log });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 4. MAINTENANCE & REPAIRS
    // =======================================================================

    // List maintenance records
    app.get<{ Querystring: { equipmentId?: string } }>(
      "/equipment/maintenance",
      maintManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const records = await service.listMaintenanceRecords(token, req.query.equipmentId);
          return reply.send({ records });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Record maintenance event
    app.post<{
      Body: {
        equipmentId: string;
        maintenanceType: MaintenanceType;
        maintenanceDate: string;
        meterHoursAtService: number;
        cost: number;
        performedBy: string;
        description: string;
        nextDueDate?: string;
        nextDueMeterHours?: number;
        status?: MaintenanceStatus;
      };
    }>(
      "/equipment/maintenance",
      maintManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const record = await service.createMaintenanceRecord(token, {
            equipment_id: req.body.equipmentId,
            maintenance_type: req.body.maintenanceType,
            maintenance_date: req.body.maintenanceDate,
            meter_hours_at_service: req.body.meterHoursAtService,
            cost: req.body.cost,
            performed_by: req.body.performedBy,
            description: req.body.description,
            next_due_date: req.body.nextDueDate,
            next_due_meter_hours: req.body.nextDueMeterHours,
            status: req.body.status,
          });
          return reply.status(201).send({ record });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 5. STATUTORY CERTIFICATES
    // =======================================================================

    // List certificates
    app.get<{ Querystring: { equipmentId?: string } }>(
      "/equipment/certificates",
      certManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const certificates = await service.listCertificates(token, req.query.equipmentId);
          return reply.send({ certificates });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // Create certificate
    app.post<{
      Body: {
        equipmentId: string;
        certificateType: CertificateType;
        certificateNumber: string;
        issuingAuthority: string;
        issueDate: string;
        expiryDate: string;
        attachmentUrl?: string;
      };
    }>(
      "/equipment/certificates",
      certManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const certificate = await service.createCertificate(token, {
            equipment_id: req.body.equipmentId,
            certificate_type: req.body.certificateType,
            certificate_number: req.body.certificateNumber,
            issuing_authority: req.body.issuingAuthority,
            issue_date: req.body.issueDate,
            expiry_date: req.body.expiryDate,
            attachment_url: req.body.attachmentUrl,
          });
          return reply.status(201).send({ certificate });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
