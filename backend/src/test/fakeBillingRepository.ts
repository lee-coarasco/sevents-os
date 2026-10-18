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
} from "../modules/billing/types.js";

export class FakeBillingRepository implements BillingRepository {
  private sessions = new Map<string, { userId: string; tenantId: string }>();

  public paymentApplications: PaymentApplication[] = [];
  public taxInvoices: TaxInvoice[] = [];
  public receipts: ClientReceipt[] = [];
  public vendorBills: VendorBill[] = [];
  public retentionRecords: RetentionRecord[] = [];

  addSession(token: string, userId: string, tenantId: string) {
    this.sessions.set(token, { userId, tenantId });
  }

  private tenantOf(token: string): string {
    const s = this.sessions.get(token);
    if (!s) throw new Error("Invalid session token in FakeBillingRepository");
    return s.tenantId;
  }

  // Payment Applications
  async listPaymentApplications(accessToken: string, projectId?: string): Promise<PaymentApplication[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.paymentApplications.filter(
      (a) => a.tenant_id === tenantId && (!projectId || a.project_id === projectId)
    );
  }

  async getPaymentApplicationById(accessToken: string, id: string): Promise<PaymentApplication | null> {
    const tenantId = this.tenantOf(accessToken);
    return this.paymentApplications.find((a) => a.tenant_id === tenantId && a.id === id) || null;
  }

  async createPaymentApplication(
    accessToken: string,
    input: CreatePaymentApplicationInput & {
      net_certified_amount: number;
      tax_rate: number;
      tax_amount: number;
      total_amount: number;
    }
  ): Promise<PaymentApplication> {
    const tenantId = this.tenantOf(accessToken);
    const item: PaymentApplication = {
      id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id,
      application_number: input.application_number,
      period_start: input.period_start,
      period_end: input.period_end,
      submission_date: input.submission_date || new Date().toISOString().split("T")[0]!,
      gross_work_completed: input.gross_work_completed,
      advance_recovery_amount: input.advance_recovery_amount ?? 0,
      retention_withheld_amount: input.retention_withheld_amount ?? 0,
      net_certified_amount: input.net_certified_amount,
      tax_rate: input.tax_rate,
      tax_amount: input.tax_amount,
      total_amount: input.total_amount,
      status: "submitted",
      certified_by: null,
      certified_at: null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.paymentApplications.push(item);
    return item;
  }

  async updatePaymentApplication(
    accessToken: string,
    id: string,
    updates: {
      status?: PaymentApplicationStatus;
      certified_by?: string;
      certified_at?: string;
    }
  ): Promise<PaymentApplication | null> {
    const tenantId = this.tenantOf(accessToken);
    const idx = this.paymentApplications.findIndex((a) => a.tenant_id === tenantId && a.id === id);
    if (idx === -1) return null;
    const existing = this.paymentApplications[idx]!;
    const updated: PaymentApplication = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.paymentApplications[idx] = updated;
    return updated;
  }

  // Tax Invoices
  async listTaxInvoices(accessToken: string, projectId?: string): Promise<TaxInvoice[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.taxInvoices.filter(
      (i) => i.tenant_id === tenantId && (!projectId || i.project_id === projectId)
    );
  }

  async getTaxInvoiceById(accessToken: string, id: string): Promise<TaxInvoice | null> {
    const tenantId = this.tenantOf(accessToken);
    return this.taxInvoices.find((i) => i.tenant_id === tenantId && i.id === id) || null;
  }

  async createTaxInvoice(
    accessToken: string,
    input: CreateTaxInvoiceInput & {
      tax_amount: number;
      total_amount: number;
    }
  ): Promise<TaxInvoice> {
    const tenantId = this.tenantOf(accessToken);
    const item: TaxInvoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id,
      application_id: input.application_id || null,
      invoice_number: input.invoice_number,
      invoice_type: input.invoice_type || "progress",
      client_name: input.client_name,
      trn: input.trn || null,
      issue_date: input.issue_date || new Date().toISOString().split("T")[0]!,
      due_date: input.due_date,
      subtotal_amount: input.subtotal_amount,
      tax_amount: input.tax_amount,
      total_amount: input.total_amount,
      paid_amount: 0,
      status: "unpaid",
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.taxInvoices.push(item);
    return item;
  }

  async updateTaxInvoice(
    accessToken: string,
    id: string,
    updates: {
      status?: InvoiceStatus;
      paid_amount?: number;
    }
  ): Promise<TaxInvoice | null> {
    const tenantId = this.tenantOf(accessToken);
    const idx = this.taxInvoices.findIndex((i) => i.tenant_id === tenantId && i.id === id);
    if (idx === -1) return null;
    const existing = this.taxInvoices[idx]!;
    const updated: TaxInvoice = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.taxInvoices[idx] = updated;
    return updated;
  }

  // Receipts
  async listReceipts(accessToken: string, invoiceId?: string): Promise<ClientReceipt[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.receipts.filter(
      (r) => r.tenant_id === tenantId && (!invoiceId || r.invoice_id === invoiceId)
    );
  }

  async createReceipt(accessToken: string, input: RecordReceiptInput): Promise<ClientReceipt> {
    const tenantId = this.tenantOf(accessToken);
    const item: ClientReceipt = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      invoice_id: input.invoice_id,
      receipt_number: input.receipt_number,
      receipt_date: input.receipt_date || new Date().toISOString().split("T")[0]!,
      amount: input.amount,
      payment_method: input.payment_method || "bank_transfer",
      reference_number: input.reference_number || null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.receipts.push(item);
    return item;
  }

  // Vendor Bills
  async listVendorBills(accessToken: string, projectId?: string): Promise<VendorBill[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.vendorBills.filter(
      (b) => b.tenant_id === tenantId && (!projectId || b.project_id === projectId)
    );
  }

  async getVendorBillById(accessToken: string, id: string): Promise<VendorBill | null> {
    const tenantId = this.tenantOf(accessToken);
    return this.vendorBills.find((b) => b.tenant_id === tenantId && b.id === id) || null;
  }

  async createVendorBill(
    accessToken: string,
    input: CreateVendorBillInput & {
      tax_amount: number;
      total_amount: number;
      match_status: MatchStatus;
    }
  ): Promise<VendorBill> {
    const tenantId = this.tenantOf(accessToken);
    const item: VendorBill = {
      id: `bill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenant_id: tenantId,
      project_id: input.project_id,
      vendor_id: input.vendor_id,
      cost_code_id: input.cost_code_id || null,
      po_id: input.po_id || null,
      bill_number: input.bill_number,
      bill_date: input.bill_date || new Date().toISOString().split("T")[0]!,
      due_date: input.due_date,
      subtotal_amount: input.subtotal_amount,
      tax_amount: input.tax_amount,
      total_amount: input.total_amount,
      match_status: input.match_status,
      status: "received",
      paid_amount: 0,
      payment_reference: null,
      paid_at: null,
      notes: input.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.vendorBills.push(item);
    return item;
  }

  async updateVendorBill(
    accessToken: string,
    id: string,
    updates: {
      status?: VendorBillStatus;
      paid_amount?: number;
      payment_reference?: string;
      paid_at?: string;
    }
  ): Promise<VendorBill | null> {
    const tenantId = this.tenantOf(accessToken);
    const idx = this.vendorBills.findIndex((b) => b.tenant_id === tenantId && b.id === id);
    if (idx === -1) return null;
    const existing = this.vendorBills[idx]!;
    const updated: VendorBill = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.vendorBills[idx] = updated;
    return updated;
  }

  // Retentions
  async listRetentionRecords(accessToken: string, projectId?: string): Promise<RetentionRecord[]> {
    const tenantId = this.tenantOf(accessToken);
    return this.retentionRecords.filter(
      (r) => r.tenant_id === tenantId && (!projectId || r.project_id === projectId)
    );
  }

  async getRetentionRecordById(accessToken: string, id: string): Promise<RetentionRecord | null> {
    const tenantId = this.tenantOf(accessToken);
    return this.retentionRecords.find((r) => r.tenant_id === tenantId && r.id === id) || null;
  }

  async createRetentionRecord(
    accessToken: string,
    input: CreateRetentionInput & {
      first_release_amount: number;
      second_release_amount: number;
    }
  ): Promise<RetentionRecord> {
    const tenantId = this.tenantOf(accessToken);
    const item: RetentionRecord = {
      id: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.retentionRecords.push(item);
    return item;
  }

  async updateRetentionRecord(
    accessToken: string,
    id: string,
    updates: {
      first_release_status?: ReleaseStatus;
      first_release_date?: string;
      second_release_status?: ReleaseStatus;
      second_release_due_date?: string;
      status?: RetentionStatus;
    }
  ): Promise<RetentionRecord | null> {
    const tenantId = this.tenantOf(accessToken);
    const idx = this.retentionRecords.findIndex((r) => r.tenant_id === tenantId && r.id === id);
    if (idx === -1) return null;
    const existing = this.retentionRecords[idx]!;
    const updated: RetentionRecord = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.retentionRecords[idx] = updated;
    return updated;
  }
}
