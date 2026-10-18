import type { FastifyInstance, preHandlerHookHandler } from "fastify";
import type { ProcurementRepository } from "./repository.js";
import {
  InvalidStateError,
  NotFoundError,
  ValidationError,
  addPurchaseOrderItem,
  addRequisitionItem,
  addRfqVendor,
  approveRequisition,
  createPurchaseOrder,
  createRequisition,
  createRfq,
  createVendor,
  deleteRequisition,
  getPurchaseOrderDetail,
  getRequisitionDetail,
  getRfqDetail,
  getVendor,
  issuePurchaseOrder,
  listPurchaseOrders,
  listRequisitions,
  listRfqs,
  listVendors,
  rejectRequisition,
  removePurchaseOrderItem,
  removeRequisitionItem,
  submitRequisition,
  updatePurchaseOrder,
  updatePurchaseOrderItemDelivery,
  updateRequisition,
  updateRfq,
  updateRfqVendor,
  updateVendor,
} from "./service.js";
import type {
  PoItemDeliveryStatus,
  PoStatus,
  RequisitionPriority,
  RequisitionStatus,
  RfqComplianceStatus,
  RfqStatus,
  VendorCategory,
  VendorStatus,
} from "./types.js";

export interface ProcurementRouteOptions {
  getRepository: () => ProcurementRepository;
  requirePermission: (permissionKey: string) => preHandlerHookHandler;
}

function bearerToken(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function procurementRoutes(app: FastifyInstance, options: ProcurementRouteOptions) {
  app.addHook("preHandler", async (request, reply) => {
    const token = bearerToken(request.headers.authorization);
    if (!token) {
      reply.code(401);
      return reply.send({ error: "missing bearer token" });
    }
  });

  const vendorManageGuard = { preHandler: options.requirePermission("procurement.vendor.manage") };
  const reqManageGuard = { preHandler: options.requirePermission("procurement.requisition.manage") };
  const reqApproveGuard = { preHandler: options.requirePermission("procurement.requisition.approve") };
  const poManageGuard = { preHandler: options.requirePermission("procurement.po.manage") };
  const poApproveGuard = { preHandler: options.requirePermission("procurement.po.approve") };

  // =========================================================================
  // 1. VENDORS (AVL)
  // =========================================================================

  app.get<{
    Querystring: { category?: VendorCategory; status?: VendorStatus; search?: string };
  }>("/procurement/vendors", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const vendors = await listVendors(options.getRepository(), token, request.query);
    return { vendors };
  });

  app.post<{
    Body: {
      name: string;
      tradeLicenseNumber?: string | null;
      taxRegistrationNumber?: string | null;
      contactPerson?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      category?: VendorCategory;
      rating?: number;
      status?: VendorStatus;
    };
  }>("/procurement/vendors", vendorManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const vendor = await createVendor(options.getRepository(), token, {
        name: body.name,
        trade_license_number: body.tradeLicenseNumber,
        tax_registration_number: body.taxRegistrationNumber,
        contact_person: body.contactPerson,
        email: body.email,
        phone: body.phone,
        address: body.address,
        category: body.category,
        rating: body.rating,
        status: body.status,
      });
      reply.code(201);
      return { vendor };
    } catch (err) {
      if (err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>("/procurement/vendors/:id", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const vendor = await getVendor(options.getRepository(), token, request.params.id);
      return { vendor };
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
      tradeLicenseNumber?: string | null;
      taxRegistrationNumber?: string | null;
      contactPerson?: string | null;
      email?: string | null;
      phone?: string | null;
      address?: string | null;
      category?: VendorCategory;
      rating?: number;
      status?: VendorStatus;
    };
  }>("/procurement/vendors/:id", vendorManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const vendor = await updateVendor(options.getRepository(), token, request.params.id, {
        name: body.name,
        trade_license_number: body.tradeLicenseNumber,
        tax_registration_number: body.taxRegistrationNumber,
        contact_person: body.contactPerson,
        email: body.email,
        phone: body.phone,
        address: body.address,
        category: body.category,
        rating: body.rating,
        status: body.status,
      });
      return { vendor };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  // =========================================================================
  // 2. PURCHASE REQUISITIONS (PR)
  // =========================================================================

  app.get<{
    Params: { projectId: string };
    Querystring: { status?: RequisitionStatus; priority?: RequisitionPriority };
  }>("/projects/:projectId/procurement/requisitions", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const requisitions = await listRequisitions(
      options.getRepository(),
      token,
      request.params.projectId,
      request.query,
    );
    return { requisitions };
  });

  app.post<{
    Params: { projectId: string };
    Body: {
      prNumber: string;
      title: string;
      requiredDate: string;
      priority?: RequisitionPriority;
      requestedBy?: string | null;
      currency?: string;
      notes?: string | null;
    };
  }>("/projects/:projectId/procurement/requisitions", reqManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const requisition = await createRequisition(options.getRepository(), token, {
        project_id: request.params.projectId,
        pr_number: body.prNumber,
        title: body.title,
        required_date: body.requiredDate,
        priority: body.priority,
        requested_by: body.requestedBy,
        currency: body.currency,
        notes: body.notes,
      });
      reply.code(201);
      return { requisition };
    } catch (err) {
      if (err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>("/procurement/requisitions/:id", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const detail = await getRequisitionDetail(options.getRepository(), token, request.params.id);
      return { requisition: detail.requisition, items: detail.items };
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
      title?: string;
      requiredDate?: string;
      priority?: RequisitionPriority;
      notes?: string | null;
    };
  }>("/procurement/requisitions/:id", reqManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const requisition = await updateRequisition(options.getRepository(), token, request.params.id, {
        title: body.title,
        required_date: body.requiredDate,
        priority: body.priority,
        notes: body.notes,
      });
      return { requisition };
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

  app.delete<{ Params: { id: string } }>("/procurement/requisitions/:id", reqManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      await deleteRequisition(options.getRepository(), token, request.params.id);
      reply.code(204);
      return;
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

  app.post<{ Params: { id: string } }>("/procurement/requisitions/:id/submit", reqManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const requisition = await submitRequisition(options.getRepository(), token, request.params.id);
      return { requisition };
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
    Body?: { approvedBy?: string };
  }>("/procurement/requisitions/:id/approve", reqApproveGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const approvedBy = request.body?.approvedBy || "Manager";
      const requisition = await approveRequisition(options.getRepository(), token, request.params.id, approvedBy);
      return { requisition };
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

  app.post<{
    Params: { id: string };
    Body: { rejectionReason: string };
  }>("/procurement/requisitions/:id/reject", reqApproveGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const requisition = await rejectRequisition(
        options.getRepository(),
        token,
        request.params.id,
        request.body?.rejectionReason,
      );
      return { requisition };
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

  // Requisition Items
  app.post<{
    Params: { requisitionId: string };
    Body: {
      itemDescription: string;
      costCode?: string | null;
      quantity: number;
      uom: string;
      estimatedUnitRate?: number;
      estimatedTotalAmount?: number;
      scheduleActivityId?: string | null;
      notes?: string | null;
    };
  }>("/procurement/requisitions/:requisitionId/items", reqManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const item = await addRequisitionItem(options.getRepository(), token, {
        requisition_id: request.params.requisitionId,
        item_description: body.itemDescription,
        cost_code: body.costCode,
        quantity: body.quantity,
        uom: body.uom,
        estimated_unit_rate: body.estimatedUnitRate,
        estimated_total_amount: body.estimatedTotalAmount,
        schedule_activity_id: body.scheduleActivityId,
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

  app.delete<{
    Params: { requisitionId: string; itemId: string };
  }>("/procurement/requisitions/:requisitionId/items/:itemId", reqManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      await removeRequisitionItem(
        options.getRepository(),
        token,
        request.params.requisitionId,
        request.params.itemId,
      );
      reply.code(204);
      return;
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

  // =========================================================================
  // 3. RFQ PACKAGES
  // =========================================================================

  app.get<{ Params: { projectId: string } }>("/projects/:projectId/procurement/rfqs", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const rfqs = await listRfqs(options.getRepository(), token, request.params.projectId);
    return { rfqs };
  });

  app.post<{
    Params: { projectId: string };
    Body: {
      requisitionId?: string | null;
      rfqNumber: string;
      title: string;
      issueDate: string;
      dueDate: string;
      scopeSummary?: string | null;
    };
  }>("/projects/:projectId/procurement/rfqs", poManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const rfq = await createRfq(options.getRepository(), token, {
        project_id: request.params.projectId,
        requisition_id: body.requisitionId,
        rfq_number: body.rfqNumber,
        title: body.title,
        issue_date: body.issueDate,
        due_date: body.dueDate,
        scope_summary: body.scopeSummary,
      });
      reply.code(201);
      return { rfq };
    } catch (err) {
      if (err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>("/procurement/rfqs/:id", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const detail = await getRfqDetail(options.getRepository(), token, request.params.id);
      return { rfq: detail.rfq, vendorQuotes: detail.vendorQuotes };
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
    Body: { title?: string; dueDate?: string; status?: RfqStatus; scopeSummary?: string | null };
  }>("/procurement/rfqs/:id", poManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const rfq = await updateRfq(options.getRepository(), token, request.params.id, {
        title: body.title,
        due_date: body.dueDate,
        status: body.status,
        scope_summary: body.scopeSummary,
      });
      return { rfq };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.post<{
    Params: { rfqId: string };
    Body: {
      vendorId: string;
      quotedAmount?: number | null;
      submissionDate?: string | null;
      complianceStatus?: RfqComplianceStatus;
      notes?: string | null;
    };
  }>("/procurement/rfqs/:rfqId/vendors", poManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const quote = await addRfqVendor(options.getRepository(), token, {
        rfq_id: request.params.rfqId,
        vendor_id: body.vendorId,
        quoted_amount: body.quotedAmount,
        submission_date: body.submissionDate,
        compliance_status: body.complianceStatus,
        notes: body.notes,
      });
      reply.code(201);
      return { quote };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.patch<{
    Params: { rfqId: string; quoteId: string };
    Body: {
      quotedAmount?: number | null;
      submissionDate?: string | null;
      complianceStatus?: RfqComplianceStatus;
      notes?: string | null;
    };
  }>("/procurement/rfqs/:rfqId/vendors/:quoteId", poManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const quote = await updateRfqVendor(options.getRepository(), token, request.params.quoteId, {
        quoted_amount: body.quotedAmount,
        submission_date: body.submissionDate,
        compliance_status: body.complianceStatus,
        notes: body.notes,
      });
      return { quote };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  // =========================================================================
  // 4. PURCHASE ORDERS (PO)
  // =========================================================================

  app.get<{
    Params: { projectId: string };
    Querystring: { status?: PoStatus; vendorId?: string };
  }>("/projects/:projectId/procurement/orders", async (request) => {
    const token = bearerToken(request.headers.authorization) as string;
    const orders = await listPurchaseOrders(
      options.getRepository(),
      token,
      request.params.projectId,
      request.query,
    );
    return { orders };
  });

  app.post<{
    Params: { projectId: string };
    Body: {
      vendorId: string;
      requisitionId?: string | null;
      rfqId?: string | null;
      poNumber: string;
      orderDate: string;
      expectedDeliveryDate?: string | null;
      deliveryAddress?: string | null;
      paymentTerms?: string | null;
      currency?: string;
      notes?: string | null;
    };
  }>("/projects/:projectId/procurement/orders", poManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const order = await createPurchaseOrder(options.getRepository(), token, {
        project_id: request.params.projectId,
        vendor_id: body.vendorId,
        requisition_id: body.requisitionId,
        rfq_id: body.rfqId,
        po_number: body.poNumber,
        order_date: body.orderDate,
        expected_delivery_date: body.expectedDeliveryDate,
        delivery_address: body.deliveryAddress,
        payment_terms: body.paymentTerms,
        currency: body.currency,
        notes: body.notes,
      });
      reply.code(201);
      return { order };
    } catch (err) {
      if (err instanceof ValidationError) {
        reply.code(400);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.get<{ Params: { id: string } }>("/procurement/orders/:id", async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const detail = await getPurchaseOrderDetail(options.getRepository(), token, request.params.id);
      return { order: detail.order, items: detail.items, vendor: detail.vendor };
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
      expectedDeliveryDate?: string | null;
      deliveryAddress?: string | null;
      paymentTerms?: string | null;
      notes?: string | null;
    };
  }>("/procurement/orders/:id", poManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const order = await updatePurchaseOrder(options.getRepository(), token, request.params.id, {
        expected_delivery_date: body.expectedDeliveryDate,
        delivery_address: body.deliveryAddress,
        payment_terms: body.paymentTerms,
        notes: body.notes,
      });
      return { order };
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

  app.post<{ Params: { id: string } }>("/procurement/orders/:id/issue", poApproveGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const order = await issuePurchaseOrder(options.getRepository(), token, request.params.id);
      return { order };
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

  // PO Items
  app.post<{
    Params: { orderId: string };
    Body: {
      itemDescription: string;
      quantity: number;
      uom: string;
      unitPrice: number;
      totalAmount?: number;
    };
  }>("/procurement/orders/:orderId/items", poManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const item = await addPurchaseOrderItem(options.getRepository(), token, {
        po_id: request.params.orderId,
        item_description: body.itemDescription,
        quantity: body.quantity,
        uom: body.uom,
        unit_price: body.unitPrice,
        total_amount: body.totalAmount ?? (body.quantity * body.unitPrice),
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

  app.patch<{
    Params: { orderId: string; itemId: string };
    Body: {
      deliveryStatus?: PoItemDeliveryStatus;
    };
  }>("/procurement/orders/:orderId/items/:itemId/delivery", poManageGuard, async (request, reply) => {
    const body = request.body ?? ({} as never);
    const token = bearerToken(request.headers.authorization) as string;
    try {
      const item = await updatePurchaseOrderItemDelivery(
        options.getRepository(),
        token,
        request.params.orderId,
        request.params.itemId,
        { delivery_status: body.deliveryStatus },
      );
      return { item };
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });

  app.delete<{
    Params: { orderId: string; itemId: string };
  }>("/procurement/orders/:orderId/items/:itemId", poManageGuard, async (request, reply) => {
    const token = bearerToken(request.headers.authorization) as string;
    try {
      await removePurchaseOrderItem(options.getRepository(), token, request.params.itemId);
      reply.code(204);
      return;
    } catch (err) {
      if (err instanceof NotFoundError) {
        reply.code(404);
        return { error: err.message };
      }
      throw err;
    }
  });
}
