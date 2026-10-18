export type PaymentApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'certified'
  | 'invoiced'
  | 'paid'
  | 'disputed';

export interface PaymentApplication {
  id: string;
  tenant_id: string;
  project_id: string;
  application_number: string;
  period_start: string;
  period_end: string;
  submission_date: string;
  gross_work_completed: number;
  advance_recovery_amount: number;
  retention_withheld_amount: number;
  net_certified_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: PaymentApplicationStatus;
  certified_by?: string | null;
  certified_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentApplicationItem {
  id: string;
  tenant_id: string;
  application_id: string;
  cost_code_id?: string | null;
  description: string;
  previous_claimed_amount: number;
  current_claimed_amount: number;
  certified_amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceType = 'progress' | 'advance' | 'retention_release' | 'direct';
export type InvoiceStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'disputed';

export interface TaxInvoice {
  id: string;
  tenant_id: string;
  project_id: string;
  application_id?: string | null;
  invoice_number: string;
  invoice_type: InvoiceType;
  client_name: string;
  trn?: string | null;
  issue_date: string;
  due_date: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = 'bank_transfer' | 'cheque' | 'credit_card' | 'cash';

export interface ClientReceipt {
  id: string;
  tenant_id: string;
  invoice_id: string;
  receipt_number: string;
  receipt_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type MatchStatus = 'matched' | 'variance_flagged' | 'manual_override';
export type VendorBillStatus =
  | 'received'
  | 'verified'
  | 'approved'
  | 'scheduled'
  | 'paid'
  | 'disputed';

export interface VendorBill {
  id: string;
  tenant_id: string;
  project_id: string;
  vendor_id: string;
  cost_code_id?: string | null;
  po_id?: string | null;
  bill_number: string;
  bill_date: string;
  due_date: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  match_status: MatchStatus;
  status: VendorBillStatus;
  paid_amount: number;
  payment_reference?: string | null;
  paid_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type RetentionType = 'client_receivable' | 'subcontractor_payable';
export type ReleaseStatus = 'pending' | 'released';
export type RetentionStatus = 'held' | 'partially_released' | 'fully_released';

export interface RetentionRecord {
  id: string;
  tenant_id: string;
  project_id: string;
  retention_type: RetentionType;
  party_name: string;
  reference_id: string;
  total_retained_amount: number;
  first_release_amount: number;
  first_release_date?: string | null;
  first_release_status: ReleaseStatus;
  second_release_amount: number;
  second_release_due_date?: string | null;
  second_release_status: ReleaseStatus;
  status: RetentionStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgingBucket {
  current_amount: number; // 0-30 days
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total_overdue: number;
}

export interface CreatePaymentApplicationInput {
  project_id: string;
  application_number: string;
  period_start: string;
  period_end: string;
  submission_date?: string;
  gross_work_completed: number;
  advance_recovery_amount?: number;
  retention_withheld_amount?: number;
  notes?: string;
}

export interface CreateTaxInvoiceInput {
  project_id: string;
  application_id?: string;
  invoice_number: string;
  invoice_type?: InvoiceType;
  client_name: string;
  trn?: string;
  issue_date?: string;
  due_date: string;
  subtotal_amount: number;
  notes?: string;
}

export interface RecordReceiptInput {
  invoice_id: string;
  receipt_number: string;
  receipt_date?: string;
  amount: number;
  payment_method?: PaymentMethod;
  reference_number?: string;
  notes?: string;
}

export interface CreateVendorBillInput {
  project_id: string;
  vendor_id: string;
  cost_code_id?: string;
  po_id?: string;
  bill_number: string;
  bill_date?: string;
  due_date: string;
  subtotal_amount: number;
  po_amount?: number; // for 3-way match validation
  notes?: string;
}

export interface CreateRetentionInput {
  project_id: string;
  retention_type: RetentionType;
  party_name: string;
  reference_id: string;
  total_retained_amount: number;
  first_release_date?: string;
  second_release_due_date?: string;
  notes?: string;
}

export interface BillingRepository {
  // Payment Applications
  listPaymentApplications(accessToken: string, projectId?: string): Promise<PaymentApplication[]>;
  getPaymentApplicationById(accessToken: string, id: string): Promise<PaymentApplication | null>;
  createPaymentApplication(accessToken: string, input: CreatePaymentApplicationInput & {
    net_certified_amount: number;
    tax_rate: number;
    tax_amount: number;
    total_amount: number;
  }): Promise<PaymentApplication>;
  updatePaymentApplication(
    accessToken: string,
    id: string,
    updates: {
      status?: PaymentApplicationStatus;
      certified_by?: string;
      certified_at?: string;
    }
  ): Promise<PaymentApplication | null>;

  // Tax Invoices
  listTaxInvoices(accessToken: string, projectId?: string): Promise<TaxInvoice[]>;
  getTaxInvoiceById(accessToken: string, id: string): Promise<TaxInvoice | null>;
  createTaxInvoice(accessToken: string, input: CreateTaxInvoiceInput & {
    tax_amount: number;
    total_amount: number;
  }): Promise<TaxInvoice>;
  updateTaxInvoice(
    accessToken: string,
    id: string,
    updates: {
      status?: InvoiceStatus;
      paid_amount?: number;
    }
  ): Promise<TaxInvoice | null>;

  // Receipts
  listReceipts(accessToken: string, invoiceId?: string): Promise<ClientReceipt[]>;
  createReceipt(accessToken: string, input: RecordReceiptInput): Promise<ClientReceipt>;

  // Vendor Bills
  listVendorBills(accessToken: string, projectId?: string): Promise<VendorBill[]>;
  getVendorBillById(accessToken: string, id: string): Promise<VendorBill | null>;
  createVendorBill(accessToken: string, input: CreateVendorBillInput & {
    tax_amount: number;
    total_amount: number;
    match_status: MatchStatus;
  }): Promise<VendorBill>;
  updateVendorBill(
    accessToken: string,
    id: string,
    updates: {
      status?: VendorBillStatus;
      paid_amount?: number;
      payment_reference?: string;
      paid_at?: string;
    }
  ): Promise<VendorBill | null>;

  // Retentions
  listRetentionRecords(accessToken: string, projectId?: string): Promise<RetentionRecord[]>;
  getRetentionRecordById(accessToken: string, id: string): Promise<RetentionRecord | null>;
  createRetentionRecord(accessToken: string, input: CreateRetentionInput & {
    first_release_amount: number;
    second_release_amount: number;
  }): Promise<RetentionRecord>;
  updateRetentionRecord(
    accessToken: string,
    id: string,
    updates: {
      first_release_status?: ReleaseStatus;
      first_release_date?: string;
      second_release_status?: ReleaseStatus;
      second_release_due_date?: string;
      status?: RetentionStatus;
    }
  ): Promise<RetentionRecord | null>;
}
