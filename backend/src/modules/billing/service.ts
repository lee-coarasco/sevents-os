import type {
  BillingRepository,
  PaymentApplication,
  TaxInvoice,
  ClientReceipt,
  VendorBill,
  RetentionRecord,
  AgingBucket,
  CreatePaymentApplicationInput,
  CreateTaxInvoiceInput,
  RecordReceiptInput,
  CreateVendorBillInput,
  CreateRetentionInput,
} from "./types.js";

export class BillingService {
  constructor(private repo: BillingRepository) {}

  // 1. Payment Applications
  async listPaymentApplications(accessToken: string, projectId?: string): Promise<PaymentApplication[]> {
    return this.repo.listPaymentApplications(accessToken, projectId);
  }

  async getPaymentApplicationById(accessToken: string, id: string): Promise<PaymentApplication | null> {
    return this.repo.getPaymentApplicationById(accessToken, id);
  }

  async createPaymentApplication(
    accessToken: string,
    input: CreatePaymentApplicationInput
  ): Promise<PaymentApplication> {
    const gross = Number(input.gross_work_completed) || 0;
    const advanceRecovery = Number(input.advance_recovery_amount) || 0;
    // Default standard construction retention is 10% of gross work completed
    const retention =
      input.retention_withheld_amount !== undefined
        ? Number(input.retention_withheld_amount)
        : Math.round(gross * 0.1 * 100) / 100;

    const netCertified = Math.max(0, gross - advanceRecovery - retention);
    const taxRate = 5.0; // 5% UAE VAT
    const taxAmount = Math.round(netCertified * 0.05 * 100) / 100;
    const totalAmount = netCertified + taxAmount;

    return this.repo.createPaymentApplication(accessToken, {
      ...input,
      gross_work_completed: gross,
      advance_recovery_amount: advanceRecovery,
      retention_withheld_amount: retention,
      net_certified_amount: netCertified,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    });
  }

  async certifyPaymentApplication(
    accessToken: string,
    id: string,
    certifiedBy: string
  ): Promise<PaymentApplication> {
    const existing = await this.repo.getPaymentApplicationById(accessToken, id);
    if (!existing) {
      throw new Error(`Payment application ${id} not found`);
    }

    const updated = await this.repo.updatePaymentApplication(accessToken, id, {
      status: "certified",
      certified_by: certifiedBy,
      certified_at: new Date().toISOString(),
    });

    if (!updated) {
      throw new Error(`Failed to certify payment application ${id}`);
    }
    return updated;
  }

  // 2. Tax Invoices & Receivables
  async listTaxInvoices(accessToken: string, projectId?: string): Promise<TaxInvoice[]> {
    return this.repo.listTaxInvoices(accessToken, projectId);
  }

  async createTaxInvoice(accessToken: string, input: CreateTaxInvoiceInput): Promise<TaxInvoice> {
    const subtotal = Number(input.subtotal_amount) || 0;
    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100; // 5% UAE VAT
    const totalAmount = subtotal + taxAmount;

    const invoice = await this.repo.createTaxInvoice(accessToken, {
      ...input,
      subtotal_amount: subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    });

    // If linked to a payment application, update its status to invoiced
    if (input.application_id) {
      await this.repo.updatePaymentApplication(accessToken, input.application_id, {
        status: "invoiced",
      });
    }

    return invoice;
  }

  async recordReceipt(accessToken: string, input: RecordReceiptInput): Promise<ClientReceipt> {
    const invoice = await this.repo.getTaxInvoiceById(accessToken, input.invoice_id);
    if (!invoice) {
      throw new Error(`Invoice ${input.invoice_id} not found`);
    }

    const receipt = await this.repo.createReceipt(accessToken, input);

    const newPaidAmount = Number(invoice.paid_amount) + Number(input.amount);
    const newStatus =
      newPaidAmount >= Number(invoice.total_amount) ? "paid" : "partially_paid";

    await this.repo.updateTaxInvoice(accessToken, invoice.id, {
      paid_amount: newPaidAmount,
      status: newStatus,
    });

    return receipt;
  }

  async getAgingSummary(accessToken: string): Promise<AgingBucket> {
    const invoices = await this.repo.listTaxInvoices(accessToken);
    const now = new Date();

    let current = 0;
    let d31_60 = 0;
    let d61_90 = 0;
    let d90_plus = 0;
    let totalOverdue = 0;

    for (const inv of invoices) {
      if (inv.status === "paid") continue;
      const outstanding = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount));
      if (outstanding <= 0) continue;

      const dueDate = new Date(inv.due_date);
      const diffMs = now.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        current += outstanding;
      } else if (diffDays <= 60) {
        d31_60 += outstanding;
        totalOverdue += outstanding;
      } else if (diffDays <= 90) {
        d61_90 += outstanding;
        totalOverdue += outstanding;
      } else {
        d90_plus += outstanding;
        totalOverdue += outstanding;
      }
    }

    return {
      current_amount: Math.round(current * 100) / 100,
      days_31_60: Math.round(d31_60 * 100) / 100,
      days_61_90: Math.round(d61_90 * 100) / 100,
      days_90_plus: Math.round(d90_plus * 100) / 100,
      total_overdue: Math.round(totalOverdue * 100) / 100,
    };
  }

  // 3. Vendor Bills & Accounts Payable
  async listVendorBills(accessToken: string, projectId?: string): Promise<VendorBill[]> {
    return this.repo.listVendorBills(accessToken, projectId);
  }

  async createVendorBill(accessToken: string, input: CreateVendorBillInput): Promise<VendorBill> {
    const subtotal = Number(input.subtotal_amount) || 0;
    const taxAmount = Math.round(subtotal * 0.05 * 100) / 100;
    const totalAmount = subtotal + taxAmount;

    // 3-Way Match Check
    let matchStatus: "matched" | "variance_flagged" = "matched";
    if (input.po_amount && input.po_amount > 0) {
      const variance = Math.abs(totalAmount - input.po_amount) / input.po_amount;
      if (variance > 0.02) {
        // greater than 2% price/quantity discrepancy
        matchStatus = "variance_flagged";
      }
    }

    return this.repo.createVendorBill(accessToken, {
      ...input,
      subtotal_amount: subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      match_status: matchStatus,
    });
  }

  async approveVendorBill(accessToken: string, id: string): Promise<VendorBill> {
    const existing = await this.repo.getVendorBillById(accessToken, id);
    if (!existing) {
      throw new Error(`Vendor bill ${id} not found`);
    }

    const updated = await this.repo.updateVendorBill(accessToken, id, {
      status: "approved",
    });
    if (!updated) {
      throw new Error(`Failed to approve vendor bill ${id}`);
    }
    return updated;
  }

  async recordBillPayment(
    accessToken: string,
    id: string,
    input: { amount: number; payment_reference?: string }
  ): Promise<VendorBill> {
    const existing = await this.repo.getVendorBillById(accessToken, id);
    if (!existing) {
      throw new Error(`Vendor bill ${id} not found`);
    }

    const updated = await this.repo.updateVendorBill(accessToken, id, {
      status: "paid",
      paid_amount: input.amount,
      payment_reference: input.payment_reference || "VOUCHER-" + Date.now(),
      paid_at: new Date().toISOString(),
    });
    if (!updated) {
      throw new Error(`Failed to record payment for vendor bill ${id}`);
    }
    return updated;
  }

  // 4. Retention Ledger
  async listRetentionRecords(accessToken: string, projectId?: string): Promise<RetentionRecord[]> {
    return this.repo.listRetentionRecords(accessToken, projectId);
  }

  async createRetentionRecord(
    accessToken: string,
    input: CreateRetentionInput
  ): Promise<RetentionRecord> {
    const total = Number(input.total_retained_amount) || 0;
    // Standard FIDIC/UAE construction terms: 50% release at Substantial/Practical Completion (TOC),
    // 50% release at end of Defect Liability Period (DLP)
    const firstRelease = Math.round(total * 0.5 * 100) / 100;
    const secondRelease = Math.round((total - firstRelease) * 100) / 100;

    return this.repo.createRetentionRecord(accessToken, {
      ...input,
      total_retained_amount: total,
      first_release_amount: firstRelease,
      second_release_amount: secondRelease,
    });
  }

  async releaseRetentionMilestone(
    accessToken: string,
    id: string,
    milestone: "first" | "second"
  ): Promise<RetentionRecord> {
    const existing = await this.repo.getRetentionRecordById(accessToken, id);
    if (!existing) {
      throw new Error(`Retention record ${id} not found`);
    }

    const now = new Date().toISOString().split("T")[0];
    if (milestone === "first") {
      const allDone = existing.second_release_status === "released";
      const updated = await this.repo.updateRetentionRecord(accessToken, id, {
        first_release_status: "released",
        first_release_date: now,
        status: allDone ? "fully_released" : "partially_released",
      });
      if (!updated) throw new Error(`Failed to update retention record ${id}`);
      return updated;
    } else {
      const allDone = existing.first_release_status === "released";
      const updated = await this.repo.updateRetentionRecord(accessToken, id, {
        second_release_status: "released",
        second_release_due_date: now,
        status: allDone ? "fully_released" : "partially_released",
      });
      if (!updated) throw new Error(`Failed to update retention record ${id}`);
      return updated;
    }
  }
}
