import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type PaymentApplicationStatus =
  | "draft"
  | "submitted"
  | "certified"
  | "invoiced"
  | "paid"
  | "disputed";

export interface PaymentApplication {
  id: string;
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
}

export type InvoiceType = "progress" | "advance" | "retention_release" | "direct";
export type InvoiceStatus = "unpaid" | "partially_paid" | "paid" | "overdue" | "disputed";

export interface TaxInvoice {
  id: string;
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
}

export type MatchStatus = "matched" | "variance_flagged" | "manual_override";
export type VendorBillStatus =
  | "received"
  | "verified"
  | "approved"
  | "scheduled"
  | "paid"
  | "disputed";

export interface VendorBill {
  id: string;
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
}

export type RetentionType = "client_receivable" | "subcontractor_payable";
export type ReleaseStatus = "pending" | "released";
export type RetentionStatus = "held" | "partially_released" | "fully_released";

export interface RetentionRecord {
  id: string;
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
}

export interface AgingSummary {
  current_amount: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total_overdue: number;
}

interface ProjectOption {
  id: string;
  name: string;
}

export function BillingPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = (searchParams.get("tab") as "applications" | "invoices" | "vendor_bills" | "retentions") || "applications";
  const selectedProjectId = searchParams.get("project_id") || "";

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [applications, setApplications] = useState<PaymentApplication[]>([]);
  const [invoices, setInvoices] = useState<TaxInvoice[]>([]);
  const [aging, setAging] = useState<AgingSummary | null>(null);
  const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
  const [retentions, setRetentions] = useState<RetentionRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showAppModal, setShowAppModal] = useState(false);
  const [showCertifyModal, setShowCertifyModal] = useState<PaymentApplication | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState<TaxInvoice | null>(null);
  const [showBillModal, setShowBillModal] = useState(false);
  const [showPayBillModal, setShowPayBillModal] = useState<VendorBill | null>(null);
  const [showRetentionModal, setShowRetentionModal] = useState(false);

  // Form states
  const [appForm, setAppForm] = useState({
    project_id: "",
    application_number: "",
    period_start: "",
    period_end: "",
    gross_work_completed: 0,
    advance_recovery_amount: 0,
    retention_withheld_amount: 0,
    notes: "",
  });

  const [certifierName, setCertifierName] = useState("Chief Commercial Engineer");

  const [invForm, setInvForm] = useState({
    project_id: "",
    application_id: "",
    invoice_number: "",
    invoice_type: "progress" as InvoiceType,
    client_name: "",
    trn: "",
    due_date: "",
    subtotal_amount: 0,
    notes: "",
  });

  const [receiptForm, setReceiptForm] = useState({
    receipt_number: "",
    amount: 0,
    payment_method: "bank_transfer" as const,
    reference_number: "",
    notes: "",
  });

  const [billForm, setBillForm] = useState({
    project_id: "",
    vendor_id: "vendor-steel-co",
    po_id: "",
    bill_number: "",
    due_date: "",
    subtotal_amount: 0,
    po_amount: 0,
    notes: "",
  });

  const [payBillForm, setPayBillForm] = useState({
    amount: 0,
    payment_reference: "",
  });

  const [retForm, setRetForm] = useState({
    project_id: "",
    retention_type: "client_receivable" as RetentionType,
    party_name: "",
    reference_id: "",
    total_retained_amount: 0,
    first_release_date: "",
    second_release_due_date: "",
    notes: "",
  });

  useEffect(() => {
    async function loadProjects() {
      if (!session?.access_token) return;
      try {
        const res = await apiFetch<{ projects: { id: string; name: string }[] }>(
          "/projects",
          session.access_token
        );
        if (res.projects) {
          setProjects(res.projects.map((p) => ({ id: p.id, name: p.name })));
          if (res.projects.length > 0 && !selectedProjectId) {
            const firstId = res.projects[0]?.id;
            if (firstId) {
              setSearchParams((prev) => {
                prev.set("project_id", firstId);
                return prev;
              });
            }
          }
        }
      } catch (err: any) {
        // non-blocking fallback
      }
    }
    loadProjects();
  }, [session]);

  const loadData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const projParam = selectedProjectId ? `?projectId=${selectedProjectId}` : "";

      const [appsRes, invsRes, agingRes, billsRes, retsRes] = await Promise.all([
        apiFetch<{ applications: PaymentApplication[] }>(`/billing/applications${projParam}`, session.access_token),
        apiFetch<{ invoices: TaxInvoice[] }>(`/billing/invoices${projParam}`, session.access_token),
        apiFetch<{ aging: AgingSummary }>("/billing/aging", session.access_token),
        apiFetch<{ vendorBills: VendorBill[] }>(`/billing/vendor-bills${projParam}`, session.access_token),
        apiFetch<{ retentions: RetentionRecord[] }>(`/billing/retentions${projParam}`, session.access_token),
      ]);

      setApplications(appsRes.applications || []);
      setInvoices(invsRes.invoices || []);
      setAging(agingRes.aging || null);
      setVendorBills(billsRes.vendorBills || []);
      setRetentions(retsRes.retentions || []);
    } catch (err: any) {
      setError(err.message || "Failed to load billing records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session, selectedProjectId]);

  const handleTabChange = (tab: "applications" | "invoices" | "vendor_bills" | "retentions") => {
    setSearchParams((prev) => {
      prev.set("tab", tab);
      return prev;
    });
  };

  const handleProjectFilterChange = (pId: string) => {
    setSearchParams((prev) => {
      if (pId) prev.set("project_id", pId);
      else prev.delete("project_id");
      return prev;
    });
  };

  // 1. Submit Application
  const handleCreateApplication = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      const pId = appForm.project_id || selectedProjectId || (projects[0]?.id ?? "default-project");
      await apiFetch("/billing/applications", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...appForm,
          project_id: pId,
          gross_work_completed: Number(appForm.gross_work_completed),
          advance_recovery_amount: Number(appForm.advance_recovery_amount),
          retention_withheld_amount: Number(appForm.retention_withheld_amount) || undefined,
        }),
      });
      setShowAppModal(false);
      setAppForm({
        project_id: "",
        application_number: "",
        period_start: "",
        period_end: "",
        gross_work_completed: 0,
        advance_recovery_amount: 0,
        retention_withheld_amount: 0,
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create payment application");
    }
  };

  // 2. Certify Application
  const handleCertify = async (appId: string) => {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/billing/applications/${appId}/certify`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ certifiedBy: certifierName }),
      });
      setShowCertifyModal(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to certify application");
    }
  };

  // 3. Create Tax Invoice
  const handleCreateInvoice = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      const pId = invForm.project_id || selectedProjectId || (projects[0]?.id ?? "default-project");
      await apiFetch("/billing/invoices", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...invForm,
          project_id: pId,
          subtotal_amount: Number(invForm.subtotal_amount),
        }),
      });
      setShowInvoiceModal(false);
      setInvForm({
        project_id: "",
        application_id: "",
        invoice_number: "",
        invoice_type: "progress",
        client_name: "",
        trn: "",
        due_date: "",
        subtotal_amount: 0,
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to issue tax invoice");
    }
  };

  // 4. Record Receipt
  const handleRecordReceipt = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !showReceiptModal) return;
    try {
      await apiFetch("/billing/receipts", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          invoice_id: showReceiptModal.id,
          receipt_number: receiptForm.receipt_number,
          amount: Number(receiptForm.amount),
          payment_method: receiptForm.payment_method,
          reference_number: receiptForm.reference_number || undefined,
          notes: receiptForm.notes || undefined,
        }),
      });
      setShowReceiptModal(null);
      setReceiptForm({
        receipt_number: "",
        amount: 0,
        payment_method: "bank_transfer",
        reference_number: "",
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to record payment receipt");
    }
  };

  // 5. Create Vendor Bill
  const handleCreateVendorBill = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      const pId = billForm.project_id || selectedProjectId || (projects[0]?.id ?? "default-project");
      await apiFetch("/billing/vendor-bills", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...billForm,
          project_id: pId,
          subtotal_amount: Number(billForm.subtotal_amount),
          po_amount: Number(billForm.po_amount) || undefined,
        }),
      });
      setShowBillModal(false);
      setBillForm({
        project_id: "",
        vendor_id: "vendor-steel-co",
        po_id: "",
        bill_number: "",
        due_date: "",
        subtotal_amount: 0,
        po_amount: 0,
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to register vendor bill");
    }
  };

  // 6. Approve Vendor Bill
  const handleApproveBill = async (billId: string) => {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/billing/vendor-bills/${billId}/approve`, session.access_token, {
        method: "POST",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to approve vendor bill");
    }
  };

  // 7. Pay Vendor Bill
  const handlePayBill = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !showPayBillModal) return;
    try {
      await apiFetch(`/billing/vendor-bills/${showPayBillModal.id}/pay`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(payBillForm.amount),
          payment_reference: payBillForm.payment_reference || undefined,
        }),
      });
      setShowPayBillModal(null);
      setPayBillForm({ amount: 0, payment_reference: "" });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to record bill payment");
    }
  };

  // 8. Create Retention
  const handleCreateRetention = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      const pId = retForm.project_id || selectedProjectId || (projects[0]?.id ?? "default-project");
      await apiFetch("/billing/retentions", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...retForm,
          project_id: pId,
          total_retained_amount: Number(retForm.total_retained_amount),
        }),
      });
      setShowRetentionModal(false);
      setRetForm({
        project_id: "",
        retention_type: "client_receivable",
        party_name: "",
        reference_id: "",
        total_retained_amount: 0,
        first_release_date: "",
        second_release_due_date: "",
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create retention record");
    }
  };

  // 9. Release Retention Milestone
  const handleReleaseRetention = async (retId: string, milestone: "first" | "second") => {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/billing/retentions/${retId}/release`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ milestone }),
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to release retention milestone");
    }
  };

  // Format currency helpers
  const formatAED = (amt: number) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
      maximumFractionDigits: 0,
    }).format(amt);
  };

  // Header Calculations
  const totalCertifiedAmt = applications
    .filter((a) => a.status === "certified" || a.status === "invoiced" || a.status === "paid")
    .reduce((sum, a) => sum + Number(a.net_certified_amount || 0), 0);

  const totalInvoicedAmt = invoices.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
  const totalCollectedAmt = invoices.reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
  const outstandingARAmt = totalInvoicedAmt - totalCollectedAmt;

  const totalBillsAmt = vendorBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const totalBillsPaidAmt = vendorBills.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0);
  const outstandingAPAmt = totalBillsAmt - totalBillsPaidAmt;

  const clientRetHeld = retentions
    .filter((r) => r.retention_type === "client_receivable" && r.status !== "fully_released")
    .reduce((sum, r) => sum + Number(r.total_retained_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Billing, Invoicing & Receivables / Payables (M22)
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Interim payment certificates (IPC), progressive valuations, UAE 5% VAT invoicing, 3-way matching, and retention ledgers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => handleProjectFilterChange(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            aria-label="Filter by project"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadData()}
            className="inline-flex items-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="font-semibold">Operation Error</div>
          <div>{error}</div>
        </div>
      )}

      {loading && (
        <div className="text-xs text-zinc-400 animate-pulse">
          Loading billing and ledger records...
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Certified Progress (Net)
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">
            {formatAED(totalCertifiedAmt)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Applications for Payment (IPC)
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
            Accounts Receivable (AR)
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {formatAED(outstandingARAmt)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Collected: {formatAED(totalCollectedAmt)} of {formatAED(totalInvoicedAmt)}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-600">
            Accounts Payable (AP)
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">
            {formatAED(outstandingAPAmt)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Vendor & Subbie Bills Due
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Client Retention Held
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-700">
            {formatAED(clientRetHeld)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Held till TOC (50%) & DLP (50%)
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => handleTabChange("applications")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
              activeTab === "applications"
                ? "border-brand text-brand"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Applications for Payment (IPC)
          </button>
          <button
            onClick={() => handleTabChange("invoices")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
              activeTab === "invoices"
                ? "border-brand text-brand"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Tax Invoices & Receivables (AR)
          </button>
          <button
            onClick={() => handleTabChange("vendor_bills")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
              activeTab === "vendor_bills"
                ? "border-brand text-brand"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Vendor Bills & 3-Way Match (AP)
          </button>
          <button
            onClick={() => handleTabChange("retentions")}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-semibold transition-colors ${
              activeTab === "retentions"
                ? "border-brand text-brand"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Retention & DLP Ledger
          </button>
        </nav>
      </div>

      {/* TAB 1: APPLICATIONS FOR PAYMENT */}
      {activeTab === "applications" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              Client Payment Applications (Interim Valuations)
            </h2>
            <PermissionGate permission="billing.application.manage">
              <button
                onClick={() => setShowAppModal(true)}
                className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
              >
                + New Payment Application
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-3 px-4">Application #</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Gross Work Done</th>
                  <th className="py-3 px-4 text-right">Adv. Recovery</th>
                  <th className="py-3 px-4 text-right">Retention (10%)</th>
                  <th className="py-3 px-4 text-right">Net Certified</th>
                  <th className="py-3 px-4 text-right">5% VAT</th>
                  <th className="py-3 px-4 text-right font-bold">Total Claim</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {applications.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-400">
                      No payment applications found for this project context. Click "+ New Payment Application" to submit one.
                    </td>
                  </tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app.id} className="hover:bg-zinc-50/80">
                      <td className="py-3 px-4 font-mono font-medium text-zinc-900">
                        {app.application_number}
                      </td>
                      <td className="py-3 px-4 text-zinc-600">
                        {app.period_start} to {app.period_end}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-zinc-900">
                        {formatAED(Number(app.gross_work_completed))}
                      </td>
                      <td className="py-3 px-4 text-right text-rose-600">
                        -{formatAED(Number(app.advance_recovery_amount))}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-600">
                        -{formatAED(Number(app.retention_withheld_amount))}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">
                        {formatAED(Number(app.net_certified_amount))}
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-600">
                        {formatAED(Number(app.tax_amount))}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-zinc-900">
                        {formatAED(Number(app.total_amount))}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            app.status === "certified"
                              ? "bg-emerald-100 text-emerald-800"
                              : app.status === "invoiced"
                              ? "bg-blue-100 text-blue-800"
                              : app.status === "paid"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {app.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {app.status === "submitted" && (
                          <PermissionGate permission="billing.application.certify">
                            <button
                              onClick={() => setShowCertifyModal(app)}
                              className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              Certify IPC
                            </button>
                          </PermissionGate>
                        )}
                        {app.status === "certified" && (
                          <span className="text-xs text-zinc-400">
                            Cert by {app.certified_by || "Commercial Lead"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: TAX INVOICES & AR */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          {/* AR Aging Bar */}
          {aging && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 mb-4">
                Accounts Receivable (AR) Aging Analysis
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-lg bg-emerald-50 p-3 text-center">
                  <div className="text-xs font-medium text-emerald-800">Current (≤30 Days)</div>
                  <div className="text-lg font-bold text-emerald-900 mt-1">{formatAED(aging.current_amount)}</div>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <div className="text-xs font-medium text-blue-800">31 - 60 Days</div>
                  <div className="text-lg font-bold text-blue-900 mt-1">{formatAED(aging.days_31_60)}</div>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-center">
                  <div className="text-xs font-medium text-amber-800">61 - 90 Days</div>
                  <div className="text-lg font-bold text-amber-900 mt-1">{formatAED(aging.days_61_90)}</div>
                </div>
                <div className="rounded-lg bg-rose-50 p-3 text-center">
                  <div className="text-xs font-medium text-rose-800">90+ Days Overdue</div>
                  <div className="text-lg font-bold text-rose-900 mt-1">{formatAED(aging.days_90_plus)}</div>
                </div>
                <div className="rounded-lg bg-zinc-100 p-3 text-center col-span-2 sm:col-span-1">
                  <div className="text-xs font-medium text-zinc-700">Total Overdue</div>
                  <div className="text-lg font-bold text-zinc-900 mt-1">{formatAED(aging.total_overdue)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Official Tax Invoices (5% UAE VAT)</h2>
            <PermissionGate permission="billing.invoice.manage">
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
              >
                + Issue Tax Invoice
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Client / TRN</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">5% VAT</th>
                  <th className="py-3 px-4 text-right font-bold">Total</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-400">
                      No tax invoices registered. Click "+ Issue Tax Invoice" to create an invoice.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const balance = Number(inv.total_amount) - Number(inv.paid_amount);
                    return (
                      <tr key={inv.id} className="hover:bg-zinc-50/80">
                        <td className="py-3 px-4 font-mono font-medium text-zinc-900">{inv.invoice_number}</td>
                        <td className="py-3 px-4 capitalize text-zinc-600">{inv.invoice_type}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-zinc-900">{inv.client_name}</div>
                          {inv.trn && <div className="text-xs text-zinc-400 font-mono">TRN: {inv.trn}</div>}
                        </td>
                        <td className="py-3 px-4 text-zinc-600">{inv.due_date}</td>
                        <td className="py-3 px-4 text-right text-zinc-700">{formatAED(Number(inv.subtotal_amount))}</td>
                        <td className="py-3 px-4 text-right text-zinc-500">{formatAED(Number(inv.tax_amount))}</td>
                        <td className="py-3 px-4 text-right font-bold text-zinc-900">{formatAED(Number(inv.total_amount))}</td>
                        <td className="py-3 px-4 text-right text-emerald-700 font-medium">{formatAED(Number(inv.paid_amount))}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              inv.status === "paid"
                                ? "bg-emerald-100 text-emerald-800"
                                : inv.status === "partially_paid"
                                ? "bg-blue-100 text-blue-800"
                                : inv.status === "overdue"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {inv.status.replace("_", " ").toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {inv.status !== "paid" && (
                            <PermissionGate permission="billing.receipt.record">
                              <button
                                onClick={() => {
                                  setShowReceiptModal(inv);
                                  setReceiptForm({
                                    receipt_number: `REC-${Date.now().toString().slice(-4)}`,
                                    amount: balance,
                                    payment_method: "bank_transfer",
                                    reference_number: "",
                                    notes: "",
                                  });
                                }}
                                className="rounded bg-brand/10 px-2 py-1 text-xs font-semibold text-brand hover:bg-brand/20"
                              >
                                Record Receipt
                              </button>
                            </PermissionGate>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VENDOR BILLS (AP & 3-WAY MATCH) */}
      {activeTab === "vendor_bills" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              Vendor & Subcontractor Bills (3-Way Matching AP)
            </h2>
            <PermissionGate permission="billing.vendor_bill.manage">
              <button
                onClick={() => setShowBillModal(true)}
                className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
              >
                + Register Vendor Bill
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-3 px-4">Bill #</th>
                  <th className="py-3 px-4">Vendor & PO</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">3-Way Match</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">5% VAT</th>
                  <th className="py-3 px-4 text-right font-bold">Total Bill</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {vendorBills.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-400">
                      No vendor bills recorded. Click "+ Register Vendor Bill" to upload or record supplier invoices.
                    </td>
                  </tr>
                ) : (
                  vendorBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-zinc-50/80">
                      <td className="py-3 px-4 font-mono font-medium text-zinc-900">{bill.bill_number}</td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-900">{bill.vendor_id}</div>
                        {bill.po_id && <div className="text-xs text-zinc-500 font-mono">PO: {bill.po_id}</div>}
                      </td>
                      <td className="py-3 px-4 text-zinc-600">{bill.due_date}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            bill.match_status === "matched"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {bill.match_status === "matched" ? "✓ 3-Way Matched" : "⚠ Variance Flagged"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-zinc-700">{formatAED(Number(bill.subtotal_amount))}</td>
                      <td className="py-3 px-4 text-right text-zinc-500">{formatAED(Number(bill.tax_amount))}</td>
                      <td className="py-3 px-4 text-right font-bold text-zinc-900">{formatAED(Number(bill.total_amount))}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            bill.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : bill.status === "approved"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-zinc-100 text-zinc-800"
                          }`}
                        >
                          {bill.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {bill.status === "received" && (
                          <PermissionGate permission="billing.vendor_bill.approve">
                            <button
                              onClick={() => handleApproveBill(bill.id)}
                              className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Approve
                            </button>
                          </PermissionGate>
                        )}
                        {bill.status === "approved" && (
                          <PermissionGate permission="billing.vendor_bill.approve">
                            <button
                              onClick={() => {
                                setShowPayBillModal(bill);
                                setPayBillForm({
                                  amount: Number(bill.total_amount),
                                  payment_reference: `PV-${Date.now().toString().slice(-4)}`,
                                });
                              }}
                              className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              Pay Bill
                            </button>
                          </PermissionGate>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: RETENTION & DLP LEDGER */}
      {activeTab === "retentions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">
              Retention Ledger (TOC & DLP Release Schedule)
            </h2>
            <PermissionGate permission="billing.retention.manage">
              <button
                onClick={() => setShowRetentionModal(true)}
                className="inline-flex items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
              >
                + New Retention Record
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4 text-right">Total Retained</th>
                  <th className="py-3 px-4">Milestone 1: TOC (50%)</th>
                  <th className="py-3 px-4">Milestone 2: DLP (50%)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {retentions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400">
                      No retention ledger entries found. Click "+ New Retention Record" to register held amounts.
                    </td>
                  </tr>
                ) : (
                  retentions.map((ret) => (
                    <tr key={ret.id} className="hover:bg-zinc-50/80">
                      <td className="py-3 px-4 font-mono font-medium text-zinc-900">{ret.reference_id}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            ret.retention_type === "client_receivable"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {ret.retention_type === "client_receivable" ? "Client Receivable" : "Subcontractor Payable"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-zinc-900">{ret.party_name}</td>
                      <td className="py-3 px-4 text-right font-bold text-zinc-900">
                        {formatAED(Number(ret.total_retained_amount))}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-800">{formatAED(Number(ret.first_release_amount))}</div>
                        <div className="text-xs text-zinc-500">
                          Status:{" "}
                          <span
                            className={
                              ret.first_release_status === "released"
                                ? "text-emerald-700 font-semibold"
                                : "text-amber-700"
                            }
                          >
                            {ret.first_release_status.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-800">{formatAED(Number(ret.second_release_amount))}</div>
                        <div className="text-xs text-zinc-500">
                          Status:{" "}
                          <span
                            className={
                              ret.second_release_status === "released"
                                ? "text-emerald-700 font-semibold"
                                : "text-amber-700"
                            }
                          >
                            {ret.second_release_status.toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            ret.status === "fully_released"
                              ? "bg-emerald-100 text-emerald-800"
                              : ret.status === "partially_released"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-zinc-100 text-zinc-800"
                          }`}
                        >
                          {ret.status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {ret.first_release_status === "pending" && (
                          <PermissionGate permission="billing.retention.manage">
                            <button
                              onClick={() => handleReleaseRetention(ret.id, "first")}
                              className="rounded bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              Release TOC (50%)
                            </button>
                          </PermissionGate>
                        )}
                        {ret.first_release_status === "released" && ret.second_release_status === "pending" && (
                          <PermissionGate permission="billing.retention.manage">
                            <button
                              onClick={() => handleReleaseRetention(ret.id, "second")}
                              className="rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              Release DLP (50%)
                            </button>
                          </PermissionGate>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: SUBMIT PAYMENT APPLICATION */}
      {showAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Submit Application for Payment (IPC)</h3>
            <form onSubmit={handleCreateApplication} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700">Project</label>
                <select
                  value={appForm.project_id || selectedProjectId}
                  onChange={(e) => setAppForm({ ...appForm, project_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  required
                >
                  <option value="">Select a project...</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Application Number</label>
                <input
                  type="text"
                  placeholder="e.g. APP-001"
                  value={appForm.application_number}
                  onChange={(e) => setAppForm({ ...appForm, application_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Period Start</label>
                  <input
                    type="date"
                    value={appForm.period_start}
                    onChange={(e) => setAppForm({ ...appForm, period_start: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Period End</label>
                  <input
                    type="date"
                    value={appForm.period_end}
                    onChange={(e) => setAppForm({ ...appForm, period_end: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Gross Work Completed (AED)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={appForm.gross_work_completed || ""}
                  onChange={(e) =>
                    setAppForm({
                      ...appForm,
                      gross_work_completed: Number(e.target.value),
                      retention_withheld_amount: Math.round(Number(e.target.value) * 0.1 * 100) / 100,
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Advance Recovery (AED)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={appForm.advance_recovery_amount || ""}
                    onChange={(e) => setAppForm({ ...appForm, advance_recovery_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Retention (10% standard)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={appForm.retention_withheld_amount || ""}
                    onChange={(e) => setAppForm({ ...appForm, retention_withheld_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Notes / Scope Summary</label>
                <textarea
                  rows={2}
                  value={appForm.notes}
                  onChange={(e) => setAppForm({ ...appForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CERTIFY APPLICATION */}
      {showCertifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Certify Payment Application</h3>
            <p className="text-sm text-zinc-600">
              Certifying Application <span className="font-mono font-bold">{showCertifyModal.application_number}</span> for a net certified value of{" "}
              <span className="font-bold text-emerald-700">{formatAED(Number(showCertifyModal.net_certified_amount))}</span> (+5% VAT = {formatAED(Number(showCertifyModal.total_amount))}).
            </p>
            <div>
              <label className="block text-xs font-semibold text-zinc-700">Certified By (Title / Name)</label>
              <input
                type="text"
                value={certifierName}
                onChange={(e) => setCertifierName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCertifyModal(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCertify(showCertifyModal.id)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                Sign & Certify IPC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ISSUE TAX INVOICE */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Issue Official Tax Invoice (5% UAE VAT)</h3>
            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-001"
                    value={invForm.invoice_number}
                    onChange={(e) => setInvForm({ ...invForm, invoice_number: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Invoice Type</label>
                  <select
                    value={invForm.invoice_type}
                    onChange={(e) => setInvForm({ ...invForm, invoice_type: e.target.value as InvoiceType })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  >
                    <option value="progress">Progress Valuation</option>
                    <option value="advance">Mobilization Advance</option>
                    <option value="retention_release">Retention Release</option>
                    <option value="direct">Direct Billing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Client Legal Entity Name</label>
                <input
                  type="text"
                  placeholder="e.g. Emaar Properties PJSC"
                  value={invForm.client_name}
                  onChange={(e) => setInvForm({ ...invForm, client_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Client TRN (Tax Reg #)</label>
                  <input
                    type="text"
                    placeholder="15-digit TRN"
                    value={invForm.trn}
                    onChange={(e) => setInvForm({ ...invForm, trn: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Due Date</label>
                  <input
                    type="date"
                    value={invForm.due_date}
                    onChange={(e) => setInvForm({ ...invForm, due_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Subtotal Amount (AED)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={invForm.subtotal_amount || ""}
                  onChange={(e) => setInvForm({ ...invForm, subtotal_amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm font-semibold"
                  required
                />
                <div className="mt-1 text-xs text-zinc-500">
                  5% VAT ({formatAED(invForm.subtotal_amount * 0.05)}) will be auto-calculated. Total:{" "}
                  {formatAED(invForm.subtotal_amount * 1.05)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Linked Payment Application (Optional)</label>
                <select
                  value={invForm.application_id}
                  onChange={(e) => {
                    const sel = applications.find((a) => a.id === e.target.value);
                    setInvForm({
                      ...invForm,
                      application_id: e.target.value,
                      subtotal_amount: sel ? Number(sel.net_certified_amount) : invForm.subtotal_amount,
                    });
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                >
                  <option value="">None / Standalone</option>
                  {applications
                    .filter((a) => a.status === "certified")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.application_number} ({formatAED(Number(a.net_certified_amount))})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
                >
                  Generate Tax Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: RECORD RECEIPT */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Record Client Collection Receipt</h3>
            <p className="text-sm text-zinc-600">
              For Invoice <span className="font-mono font-bold">{showReceiptModal.invoice_number}</span> ({showReceiptModal.client_name}).
            </p>
            <form onSubmit={handleRecordReceipt} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700">Receipt Voucher #</label>
                <input
                  type="text"
                  value={receiptForm.receipt_number}
                  onChange={(e) => setReceiptForm({ ...receiptForm, receipt_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Amount Received (AED)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={receiptForm.amount || ""}
                  onChange={(e) => setReceiptForm({ ...receiptForm, amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Payment Method</label>
                  <select
                    value={receiptForm.payment_method}
                    onChange={(e) => setReceiptForm({ ...receiptForm, payment_method: e.target.value as any })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  >
                    <option value="bank_transfer">Bank Wire Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="credit_card">Card / Electronic</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Bank / Cheque Ref #</label>
                  <input
                    type="text"
                    value={receiptForm.reference_number}
                    onChange={(e) => setReceiptForm({ ...receiptForm, reference_number: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Confirm & Post Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: REGISTER VENDOR BILL */}
      {showBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Register Vendor Bill (3-Way Match)</h3>
            <form onSubmit={handleCreateVendorBill} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Bill Number (Supplier Invoice #)</label>
                  <input
                    type="text"
                    placeholder="e.g. SINV-8812"
                    value={billForm.bill_number}
                    onChange={(e) => setBillForm({ ...billForm, bill_number: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Due Date</label>
                  <input
                    type="date"
                    value={billForm.due_date}
                    onChange={(e) => setBillForm({ ...billForm, due_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Vendor ID / Name</label>
                  <input
                    type="text"
                    value={billForm.vendor_id}
                    onChange={(e) => setBillForm({ ...billForm, vendor_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Purchase Order (PO #)</label>
                  <input
                    type="text"
                    placeholder="e.g. PO-101"
                    value={billForm.po_id}
                    onChange={(e) => setBillForm({ ...billForm, po_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Bill Subtotal (AED)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={billForm.subtotal_amount || ""}
                    onChange={(e) => setBillForm({ ...billForm, subtotal_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">PO Total Amount (for Match)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={billForm.po_amount || ""}
                    onChange={(e) => setBillForm({ ...billForm, po_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBillModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
                >
                  Register Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: PAY VENDOR BILL */}
      {showPayBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Record Vendor Bill Payment</h3>
            <p className="text-sm text-zinc-600">
              For Bill <span className="font-mono font-bold">{showPayBillModal.bill_number}</span> to {showPayBillModal.vendor_id}.
            </p>
            <form onSubmit={handlePayBill} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700">Payment Amount (AED)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={payBillForm.amount || ""}
                  onChange={(e) => setPayBillForm({ ...payBillForm, amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Payment Voucher / Wire Reference</label>
                <input
                  type="text"
                  placeholder="e.g. PV-2026-991"
                  value={payBillForm.payment_reference}
                  onChange={(e) => setPayBillForm({ ...payBillForm, payment_reference: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayBillModal(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Post Payment Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: CREATE RETENTION */}
      {showRetentionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-zinc-900">Add Retention Record</h3>
            <form onSubmit={handleCreateRetention} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700">Retention Type</label>
                <select
                  value={retForm.retention_type}
                  onChange={(e) => setRetForm({ ...retForm, retention_type: e.target.value as RetentionType })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                >
                  <option value="client_receivable">Client Receivable (Client withholding from SEVENTS)</option>
                  <option value="subcontractor_payable">Subcontractor Payable (SEVENTS withholding from Subbie)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Contract Party Name</label>
                <input
                  type="text"
                  placeholder="e.g. Emaar Properties or MEP Subcontractor"
                  value={retForm.party_name}
                  onChange={(e) => setRetForm({ ...retForm, party_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Contract / Reference ID</label>
                <input
                  type="text"
                  placeholder="e.g. RET-CONT-01"
                  value={retForm.reference_id}
                  onChange={(e) => setRetForm({ ...retForm, reference_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700">Total Retention Held (AED)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={retForm.total_retained_amount || ""}
                  onChange={(e) => setRetForm({ ...retForm, total_retained_amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 text-sm font-semibold"
                  required
                />
                <div className="mt-1 text-xs text-zinc-500">
                  Standard split: 50% at Substantial Completion (TOC) and 50% at DLP expiry.
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRetentionModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
                >
                  Create Retention
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
