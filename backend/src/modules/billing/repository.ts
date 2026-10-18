import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BillingRepository,
  PaymentApplication,
  PaymentApplicationStatus,
  TaxInvoice,
  InvoiceStatus,
  ClientReceipt,
  VendorBill,
  VendorBillStatus,
  RetentionRecord,
  ReleaseStatus,
  RetentionStatus,
  CreatePaymentApplicationInput,
  CreateTaxInvoiceInput,
  RecordReceiptInput,
  CreateVendorBillInput,
  CreateRetentionInput,
  MatchStatus,
} from "./types.js";

export type { BillingRepository } from "./types.js";

export function createSupabaseBillingRepository(
  createUserScopedClient: (token: string) => SupabaseClient
): BillingRepository {
  async function resolveTenant(client: SupabaseClient): Promise<string> {
    const { data: tenantId, error } = await client.rpc("current_tenant_id");
    if (error || !tenantId) {
      throw new Error("Unable to resolve tenant id for caller");
    }
    return tenantId as string;
  }

  return {
    async listPaymentApplications(accessToken, projectId) {
      const client = createUserScopedClient(accessToken);
      let query = client
        .from("payment_applications")
        .select("*")
        .order("submission_date", { ascending: false });
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PaymentApplication[];
    },

    async getPaymentApplicationById(accessToken, id) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("payment_applications")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as PaymentApplication) || null;
    },

    async createPaymentApplication(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("payment_applications")
        .insert({
          tenant_id: tenantId,
          project_id: input.project_id,
          application_number: input.application_number,
          period_start: input.period_start,
          period_end: input.period_end,
          submission_date: input.submission_date || new Date().toISOString().split("T")[0],
          gross_work_completed: input.gross_work_completed,
          advance_recovery_amount: input.advance_recovery_amount ?? 0,
          retention_withheld_amount: input.retention_withheld_amount ?? 0,
          net_certified_amount: input.net_certified_amount,
          tax_rate: input.tax_rate,
          tax_amount: input.tax_amount,
          total_amount: input.total_amount,
          status: "submitted",
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as PaymentApplication;
    },

    async updatePaymentApplication(accessToken, id, updates) {
      const client = createUserScopedClient(accessToken);
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.certified_by !== undefined) updatePayload.certified_by = updates.certified_by;
      if (updates.certified_at !== undefined) updatePayload.certified_at = updates.certified_at;

      const { data, error } = await client
        .from("payment_applications")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as PaymentApplication) || null;
    },

    async listTaxInvoices(accessToken, projectId) {
      const client = createUserScopedClient(accessToken);
      let query = client
        .from("tax_invoices")
        .select("*")
        .order("issue_date", { ascending: false });
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as TaxInvoice[];
    },

    async getTaxInvoiceById(accessToken, id) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("tax_invoices")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as TaxInvoice) || null;
    },

    async createTaxInvoice(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("tax_invoices")
        .insert({
          tenant_id: tenantId,
          project_id: input.project_id,
          application_id: input.application_id || null,
          invoice_number: input.invoice_number,
          invoice_type: input.invoice_type || "progress",
          client_name: input.client_name,
          trn: input.trn || null,
          issue_date: input.issue_date || new Date().toISOString().split("T")[0],
          due_date: input.due_date,
          subtotal_amount: input.subtotal_amount,
          tax_amount: input.tax_amount,
          total_amount: input.total_amount,
          paid_amount: 0,
          status: "unpaid",
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as TaxInvoice;
    },

    async updateTaxInvoice(accessToken, id, updates) {
      const client = createUserScopedClient(accessToken);
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.paid_amount !== undefined) updatePayload.paid_amount = updates.paid_amount;

      const { data, error } = await client
        .from("tax_invoices")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as TaxInvoice) || null;
    },

    async listReceipts(accessToken, invoiceId) {
      const client = createUserScopedClient(accessToken);
      let query = client
        .from("client_receipts")
        .select("*")
        .order("receipt_date", { ascending: false });
      if (invoiceId) {
        query = query.eq("invoice_id", invoiceId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ClientReceipt[];
    },

    async createReceipt(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("client_receipts")
        .insert({
          tenant_id: tenantId,
          invoice_id: input.invoice_id,
          receipt_number: input.receipt_number,
          receipt_date: input.receipt_date || new Date().toISOString().split("T")[0],
          amount: input.amount,
          payment_method: input.payment_method || "bank_transfer",
          reference_number: input.reference_number || null,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ClientReceipt;
    },

    async listVendorBills(accessToken, projectId) {
      const client = createUserScopedClient(accessToken);
      let query = client
        .from("vendor_bills")
        .select("*")
        .order("bill_date", { ascending: false });
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as VendorBill[];
    },

    async getVendorBillById(accessToken, id) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("vendor_bills")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as VendorBill) || null;
    },

    async createVendorBill(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("vendor_bills")
        .insert({
          tenant_id: tenantId,
          project_id: input.project_id,
          vendor_id: input.vendor_id,
          cost_code_id: input.cost_code_id || null,
          po_id: input.po_id || null,
          bill_number: input.bill_number,
          bill_date: input.bill_date || new Date().toISOString().split("T")[0],
          due_date: input.due_date,
          subtotal_amount: input.subtotal_amount,
          tax_amount: input.tax_amount,
          total_amount: input.total_amount,
          match_status: input.match_status,
          status: "received",
          paid_amount: 0,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as VendorBill;
    },

    async updateVendorBill(accessToken, id, updates) {
      const client = createUserScopedClient(accessToken);
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.status !== undefined) updatePayload.status = updates.status;
      if (updates.paid_amount !== undefined) updatePayload.paid_amount = updates.paid_amount;
      if (updates.payment_reference !== undefined) updatePayload.payment_reference = updates.payment_reference;
      if (updates.paid_at !== undefined) updatePayload.paid_at = updates.paid_at;

      const { data, error } = await client
        .from("vendor_bills")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as VendorBill) || null;
    },

    async listRetentionRecords(accessToken, projectId) {
      const client = createUserScopedClient(accessToken);
      let query = client
        .from("retention_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (projectId) {
        query = query.eq("project_id", projectId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RetentionRecord[];
    },

    async getRetentionRecordById(accessToken, id) {
      const client = createUserScopedClient(accessToken);
      const { data, error } = await client
        .from("retention_records")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as RetentionRecord) || null;
    },

    async createRetentionRecord(accessToken, input) {
      const client = createUserScopedClient(accessToken);
      const tenantId = await resolveTenant(client);
      const { data, error } = await client
        .from("retention_records")
        .insert({
          tenant_id: tenantId,
          project_id: input.project_id,
          retention_type: input.retention_type,
          party_name: input.party_name,
          reference_id: input.reference_id,
          total_retained_amount: input.total_retained_amount,
          first_release_amount: input.first_release_amount,
          first_release_date: input.first_release_date || null,
          first_release_status: "pending",
          second_release_amount: input.second_release_amount,
          second_release_due_date: input.second_release_due_date || null,
          second_release_status: "pending",
          status: "held",
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as RetentionRecord;
    },

    async updateRetentionRecord(accessToken, id, updates) {
      const client = createUserScopedClient(accessToken);
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.first_release_status !== undefined) updatePayload.first_release_status = updates.first_release_status;
      if (updates.first_release_date !== undefined) updatePayload.first_release_date = updates.first_release_date;
      if (updates.second_release_status !== undefined) updatePayload.second_release_status = updates.second_release_status;
      if (updates.second_release_due_date !== undefined) updatePayload.second_release_due_date = updates.second_release_due_date;
      if (updates.status !== undefined) updatePayload.status = updates.status;

      const { data, error } = await client
        .from("retention_records")
        .update(updatePayload)
        .eq("id", id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return (data as RetentionRecord) || null;
    },
  };
}
