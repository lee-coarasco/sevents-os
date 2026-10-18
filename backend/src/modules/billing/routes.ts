import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import type { BillingRepository } from "./repository.js";
import { BillingService } from "./service.js";
import type {
  CreatePaymentApplicationInput,
  CreateTaxInvoiceInput,
  RecordReceiptInput,
  CreateVendorBillInput,
  CreateRetentionInput,
} from "./types.js";

export interface BillingRoutesOptions {
  getRepository: () => BillingRepository;
  permissionGuard: (permissionKey: string) => (request: any, reply: any) => Promise<void>;
}

function bearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function registerBillingRoutes(options: BillingRoutesOptions): FastifyPluginAsync {
  return async (app: FastifyInstance) => {
    const service = new BillingService(options.getRepository());

    const appManageGuard = { preHandler: [options.permissionGuard("billing.application.manage")] };
    const appCertifyGuard = { preHandler: [options.permissionGuard("billing.application.certify")] };
    const invoiceManageGuard = { preHandler: [options.permissionGuard("billing.invoice.manage")] };
    const receiptRecordGuard = { preHandler: [options.permissionGuard("billing.receipt.record")] };
    const vendorBillManageGuard = { preHandler: [options.permissionGuard("billing.vendor_bill.manage")] };
    const vendorBillApproveGuard = { preHandler: [options.permissionGuard("billing.vendor_bill.approve")] };
    const retentionManageGuard = { preHandler: [options.permissionGuard("billing.retention.manage")] };

    // =======================================================================
    // 1. PAYMENT APPLICATIONS (IPC)
    // =======================================================================

    app.get<{ Querystring: { projectId?: string } }>(
      "/billing/applications",
      appManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const applications = await service.listPaymentApplications(token, req.query.projectId);
          return reply.send({ applications });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreatePaymentApplicationInput }>(
      "/billing/applications",
      appManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const application = await service.createPaymentApplication(token, req.body);
          return reply.status(201).send({ application });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: { certifiedBy?: string } }>(
      "/billing/applications/:id/certify",
      appCertifyGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const certifiedBy = req.body?.certifiedBy || "Project Lead / Commercial Lead";
          const application = await service.certifyPaymentApplication(token, req.params.id, certifiedBy);
          return reply.send({ application });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 2. TAX INVOICES & RECEIVABLES
    // =======================================================================

    app.get<{ Querystring: { projectId?: string } }>(
      "/billing/invoices",
      invoiceManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const invoices = await service.listTaxInvoices(token, req.query.projectId);
          return reply.send({ invoices });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateTaxInvoiceInput }>(
      "/billing/invoices",
      invoiceManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const invoice = await service.createTaxInvoice(token, req.body);
          return reply.status(201).send({ invoice });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: RecordReceiptInput }>(
      "/billing/receipts",
      receiptRecordGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const receipt = await service.recordReceipt(token, req.body);
          return reply.status(201).send({ receipt });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.get(
      "/billing/aging",
      invoiceManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const aging = await service.getAgingSummary(token);
          return reply.send({ aging });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 3. VENDOR BILLS (AP)
    // =======================================================================

    app.get<{ Querystring: { projectId?: string } }>(
      "/billing/vendor-bills",
      vendorBillManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const vendorBills = await service.listVendorBills(token, req.query.projectId);
          return reply.send({ vendorBills });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateVendorBillInput }>(
      "/billing/vendor-bills",
      vendorBillManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const vendorBill = await service.createVendorBill(token, req.body);
          return reply.status(201).send({ vendorBill });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string } }>(
      "/billing/vendor-bills/:id/approve",
      vendorBillApproveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const vendorBill = await service.approveVendorBill(token, req.params.id);
          return reply.send({ vendorBill });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: { amount: number; payment_reference?: string } }>(
      "/billing/vendor-bills/:id/pay",
      vendorBillApproveGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const vendorBill = await service.recordBillPayment(token, req.params.id, req.body);
          return reply.send({ vendorBill });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    // =======================================================================
    // 4. RETENTIONS
    // =======================================================================

    app.get<{ Querystring: { projectId?: string } }>(
      "/billing/retentions",
      retentionManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const retentions = await service.listRetentionRecords(token, req.query.projectId);
          return reply.send({ retentions });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Body: CreateRetentionInput }>(
      "/billing/retentions",
      retentionManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const retention = await service.createRetentionRecord(token, req.body);
          return reply.status(201).send({ retention });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );

    app.post<{ Params: { id: string }; Body: { milestone: "first" | "second" } }>(
      "/billing/retentions/:id/release",
      retentionManageGuard,
      async (req, reply) => {
        const token = bearerToken(req.headers.authorization);
        if (!token) return reply.status(401).send({ error: "Missing authorization token" });

        try {
          const milestone = req.body?.milestone || "first";
          const retention = await service.releaseRetentionMilestone(token, req.params.id, milestone);
          return reply.send({ retention });
        } catch (err: any) {
          return reply.status(400).send({ error: err.message });
        }
      }
    );
  };
}
