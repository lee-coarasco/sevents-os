import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { InventoryRepository } from "./repository.js";
import {
  acceptGrn,
  addGrnItem,
  addMaterialIssueItem,
  approveGatePass,
  createGatePass,
  createGrn,
  createInventoryItem,
  createMaterialIssue,
  createStoreLocation,
  dispatchGatePass,
  getGatePass,
  getGrnDetail,
  getInventoryItem,
  getMaterialIssueDetail,
  getStoreLocation,
  InvalidStateError,
  issueMaterial,
  listGatePasses,
  listGrns,
  listInventoryItems,
  listMaterialIssues,
  listStockBalances,
  listStoreLocations,
  NotFoundError,
  rejectGrn,
  updateInventoryItem,
  updateStoreLocation,
  ValidationError,
} from "./service.js";
import type {
  GatePassType,
  InventoryCategory,
  StoreLocationType,
} from "./types.js";

export interface InventoryRoutesOptions {
  getRepository: () => InventoryRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerInventoryRoutes(options: InventoryRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const storeManageGuard = { preHandler: [options.permissionGuard("inventory.store.manage")] };
    const itemManageGuard = { preHandler: [options.permissionGuard("inventory.item.manage")] };
    const stockViewGuard = { preHandler: [options.permissionGuard("inventory.stock.view")] };
    const grnManageGuard = { preHandler: [options.permissionGuard("inventory.grn.manage")] };
    const issueManageGuard = { preHandler: [options.permissionGuard("inventory.issue.manage")] };
    const gatePassGuard = { preHandler: [options.permissionGuard("inventory.gatepass.manage")] };

    // =======================================================================
    // STORE LOCATIONS
    // =======================================================================

    app.post<{
      Body: {
        projectId?: string | null;
        code: string;
        name: string;
        locationType?: StoreLocationType;
        address?: string | null;
        isActive?: boolean;
      };
    }>("/inventory/locations", storeManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const location = await createStoreLocation(options.getRepository(), token, {
          project_id: body.projectId,
          code: body.code,
          name: body.name,
          location_type: body.locationType,
          address: body.address,
          is_active: body.isActive,
        });
        reply.code(201);
        return { location };
      } catch (err) {
        if (err instanceof ValidationError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.get<{
      Querystring: { projectId?: string };
    }>("/inventory/locations", stockViewGuard, async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const locations = await listStoreLocations(options.getRepository(), token, request.query.projectId);
      return { locations };
    });

    app.get<{ Params: { id: string } }>("/inventory/locations/:id", stockViewGuard, async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const location = await getStoreLocation(options.getRepository(), token, request.params.id);
        return { location };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.patch<{
      Params: { id: string };
      Body: {
        name?: string;
        locationType?: StoreLocationType;
        address?: string | null;
        isActive?: boolean;
      };
    }>("/inventory/locations/:id", storeManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const location = await updateStoreLocation(options.getRepository(), token, request.params.id, {
          name: body.name,
          location_type: body.locationType,
          address: body.address,
          is_active: body.isActive,
        });
        return { location };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        throw err;
      }
    });

    // =======================================================================
    // INVENTORY ITEMS MASTER
    // =======================================================================

    app.post<{
      Body: {
        itemCode: string;
        name: string;
        description?: string | null;
        category?: InventoryCategory;
        uom?: string;
        reorderLevel?: number;
        unitCost?: number;
      };
    }>("/inventory/items", itemManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const item = await createInventoryItem(options.getRepository(), token, {
          item_code: body.itemCode,
          name: body.name,
          description: body.description,
          category: body.category,
          uom: body.uom,
          reorder_level: body.reorderLevel,
          unit_cost: body.unitCost,
        });
        reply.code(201);
        return { item };
      } catch (err) {
        if (err instanceof ValidationError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.get<{
      Querystring: { category?: InventoryCategory };
    }>("/inventory/items", stockViewGuard, async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const items = await listInventoryItems(options.getRepository(), token, request.query.category);
      return { items };
    });

    app.get<{ Params: { id: string } }>("/inventory/items/:id", stockViewGuard, async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const item = await getInventoryItem(options.getRepository(), token, request.params.id);
        return { item };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.patch<{
      Params: { id: string };
      Body: {
        name?: string;
        description?: string | null;
        category?: InventoryCategory;
        uom?: string;
        reorderLevel?: number;
        unitCost?: number;
      };
    }>("/inventory/items/:id", itemManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const item = await updateInventoryItem(options.getRepository(), token, request.params.id, {
          name: body.name,
          description: body.description,
          category: body.category,
          uom: body.uom,
          reorder_level: body.reorderLevel,
          unit_cost: body.unitCost,
        });
        return { item };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        throw err;
      }
    });

    // =======================================================================
    // STOCK BALANCES
    // =======================================================================

    app.get<{
      Querystring: { locationId?: string; itemId?: string };
    }>("/inventory/stock-balances", stockViewGuard, async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const balances = await listStockBalances(
        options.getRepository(),
        token,
        request.query.locationId,
        request.query.itemId,
      );
      return { balances };
    });

    // =======================================================================
    // GOODS RECEIVED NOTES (GRN)
    // =======================================================================

    app.post<{
      Params: { projectId: string };
      Body: {
        poId?: string | null;
        locationId: string;
        grnNumber: string;
        supplierDeliveryNote?: string | null;
        carrierName?: string | null;
        vehicleNumber?: string | null;
        receivedDate?: string;
        receivedBy?: string | null;
        generalNotes?: string | null;
      };
    }>("/projects/:projectId/inventory/grns", grnManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const grn = await createGrn(options.getRepository(), token, {
          project_id: request.params.projectId,
          po_id: body.poId,
          location_id: body.locationId,
          grn_number: body.grnNumber,
          supplier_delivery_note: body.supplierDeliveryNote,
          carrier_name: body.carrierName,
          vehicle_number: body.vehicleNumber,
          received_date: body.receivedDate,
          received_by: body.receivedBy,
          general_notes: body.generalNotes,
        });
        reply.code(201);
        return { grn };
      } catch (err) {
        if (err instanceof ValidationError || err instanceof NotFoundError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.get<{
      Params: { projectId: string };
    }>("/projects/:projectId/inventory/grns", stockViewGuard, async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const grns = await listGrns(options.getRepository(), token, request.params.projectId);
      return { grns };
    });

    app.get<{ Params: { id: string } }>("/inventory/grns/:id", stockViewGuard, async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const detail = await getGrnDetail(options.getRepository(), token, request.params.id);
        return detail;
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.post<{
      Params: { id: string };
      Body: {
        itemId: string;
        poItemId?: string | null;
        quantityDelivered: number;
        quantityAccepted?: number;
        quantityRejected?: number;
        rackBin?: string | null;
        rejectionReason?: string | null;
      };
    }>("/inventory/grns/:id/items", grnManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const item = await addGrnItem(options.getRepository(), token, {
          grn_id: request.params.id,
          item_id: body.itemId,
          po_item_id: body.poItemId,
          quantity_delivered: body.quantityDelivered,
          quantity_accepted: body.quantityAccepted,
          quantity_rejected: body.quantityRejected,
          rack_bin: body.rackBin,
          rejection_reason: body.rejectionReason,
        });
        reply.code(201);
        return { item };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        if (err instanceof InvalidStateError || err instanceof ValidationError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.post<{
      Params: { id: string };
      Body: {
        inspectedBy?: string;
        inspectionNotes?: string;
      };
    }>("/inventory/grns/:id/accept", grnManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const grn = await acceptGrn(
          options.getRepository(),
          token,
          request.params.id,
          body.inspectedBy,
          body.inspectionNotes,
        );
        return { grn };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        if (err instanceof InvalidStateError || err instanceof ValidationError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.post<{
      Params: { id: string };
      Body: {
        rejectionReason: string;
      };
    }>("/inventory/grns/:id/reject", grnManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const grn = await rejectGrn(options.getRepository(), token, request.params.id, body.rejectionReason);
        return { grn };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        if (err instanceof InvalidStateError || err instanceof ValidationError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    // =======================================================================
    // MATERIAL ISSUE NOTES (MIN)
    // =======================================================================

    app.post<{
      Params: { projectId: string };
      Body: {
        locationId: string;
        issueNumber: string;
        issueDate?: string;
        issuedTo: string;
        costCode?: string | null;
        notes?: string | null;
      };
    }>("/projects/:projectId/inventory/issues", issueManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const issue = await createMaterialIssue(options.getRepository(), token, {
          project_id: request.params.projectId,
          location_id: body.locationId,
          issue_number: body.issueNumber,
          issue_date: body.issueDate,
          issued_to: body.issuedTo,
          cost_code: body.costCode,
          notes: body.notes,
        });
        reply.code(201);
        return { issue };
      } catch (err) {
        if (err instanceof ValidationError || err instanceof NotFoundError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.get<{
      Params: { projectId: string };
    }>("/projects/:projectId/inventory/issues", stockViewGuard, async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const issues = await listMaterialIssues(options.getRepository(), token, request.params.projectId);
      return { issues };
    });

    app.get<{ Params: { id: string } }>("/inventory/issues/:id", stockViewGuard, async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const detail = await getMaterialIssueDetail(options.getRepository(), token, request.params.id);
        return detail;
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.post<{
      Params: { id: string };
      Body: {
        itemId: string;
        quantityIssued: number;
        rackBin?: string | null;
        notes?: string | null;
      };
    }>("/inventory/issues/:id/items", issueManageGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const item = await addMaterialIssueItem(options.getRepository(), token, {
          issue_id: request.params.id,
          item_id: body.itemId,
          quantity_issued: body.quantityIssued,
          rack_bin: body.rackBin,
          notes: body.notes,
        });
        reply.code(201);
        return { item };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        if (err instanceof InvalidStateError || err instanceof ValidationError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.post<{ Params: { id: string } }>("/inventory/issues/:id/dispatch", issueManageGuard, async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const issue = await issueMaterial(options.getRepository(), token, request.params.id);
        return { issue };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        if (err instanceof InvalidStateError || err instanceof ValidationError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    // =======================================================================
    // MATERIAL GATE PASSES
    // =======================================================================

    app.post<{
      Params: { projectId: string };
      Body: {
        passNumber: string;
        passType?: GatePassType;
        vehicleNumber: string;
        driverName: string;
        driverContact?: string | null;
        destination: string;
        notes?: string | null;
      };
    }>("/projects/:projectId/inventory/gate-passes", gatePassGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const pass = await createGatePass(options.getRepository(), token, {
          project_id: request.params.projectId,
          pass_number: body.passNumber,
          pass_type: body.passType,
          vehicle_number: body.vehicleNumber,
          driver_name: body.driverName,
          driver_contact: body.driverContact,
          destination: body.destination,
          notes: body.notes,
        });
        reply.code(201);
        return { pass };
      } catch (err) {
        if (err instanceof ValidationError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.get<{
      Params: { projectId: string };
    }>("/projects/:projectId/inventory/gate-passes", stockViewGuard, async (request) => {
      const token = bearerToken(request.headers.authorization) as string;
      const gatePasses = await listGatePasses(options.getRepository(), token, request.params.projectId);
      return { gatePasses };
    });

    app.get<{ Params: { id: string } }>("/inventory/gate-passes/:id", stockViewGuard, async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const pass = await getGatePass(options.getRepository(), token, request.params.id);
        return { pass };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.post<{
      Params: { id: string };
      Body: { authorizedBy: string };
    }>("/inventory/gate-passes/:id/approve", gatePassGuard, async (request, reply) => {
      const body = request.body ?? ({} as never);
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const pass = await approveGatePass(
          options.getRepository(),
          token,
          request.params.id,
          body.authorizedBy,
        );
        return { pass };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        throw err;
      }
    });

    app.post<{ Params: { id: string } }>("/inventory/gate-passes/:id/dispatch", gatePassGuard, async (request, reply) => {
      const token = bearerToken(request.headers.authorization) as string;
      try {
        const pass = await dispatchGatePass(options.getRepository(), token, request.params.id);
        return { pass };
      } catch (err) {
        if (err instanceof NotFoundError) {
          reply.code(404);
          return { error: err.message };
        }
        if (err instanceof InvalidStateError) {
          reply.code(400);
          return { error: err.message };
        }
        throw err;
      }
    });
  };
}
