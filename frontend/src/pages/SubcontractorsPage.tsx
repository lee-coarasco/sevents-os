import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type TradeDiscipline = "civil" | "mep" | "structural" | "finishes" | "piling" | "facade" | "landscape";
export type WorkOrderStatus = "draft" | "approved" | "active" | "completed" | "terminated";
export type MilestoneStatus = "pending" | "completed" | "certified";
export type MeasuredWorkStatus = "draft" | "verified" | "certified";
export type ClaimStatus = "submitted" | "under_review" | "certified" | "paid";

export interface SubcontractorWorkOrder {
  id: string;
  project_id: string;
  vendor_id: string | null;
  vendor_name?: string;
  work_order_number: string;
  title: string;
  trade_discipline: TradeDiscipline;
  contract_value: number;
  retention_rate_pct: number;
  start_date: string | null;
  completion_date: string | null;
  status: WorkOrderStatus;
  scope_of_work: string | null;
  created_at: string;
}

export interface WorkOrderMilestone {
  id: string;
  work_order_id: string;
  milestone_name: string;
  description: string | null;
  amount: number;
  planned_date: string | null;
  status: MilestoneStatus;
}

export interface SubcontractorAttendanceLog {
  id: string;
  project_id: string;
  work_order_id: string;
  work_order_title?: string;
  date: string;
  trade: string;
  skilled_count: number;
  unskilled_count: number;
  total_hours: number;
  supervisor_name: string | null;
  notes: string | null;
}

export interface SubcontractorMeasuredWork {
  id: string;
  work_order_id: string;
  work_order_title?: string;
  measurement_date: string;
  wbs_code: string | null;
  boq_item_reference: string | null;
  description: string;
  uom: string;
  quantity_measured: number;
  unit_rate: number;
  certified_amount: number;
  measured_by: string | null;
  status: MeasuredWorkStatus;
}

export interface SubcontractorPaymentClaim {
  id: string;
  project_id: string;
  work_order_id: string;
  work_order_title?: string;
  claim_number: string;
  period_start: string;
  period_end: string;
  claimed_amount: number;
  certified_amount: number;
  retention_deducted: number;
  net_payable_amount: number;
  status: ClaimStatus;
  submitted_at: string;
  certified_at: string | null;
  notes: string | null;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  status: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
}

export function SubcontractorsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"work_orders" | "attendance" | "measured" | "claims">("work_orders");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Subcontractor entity states
  const [workOrders, setWorkOrders] = useState<SubcontractorWorkOrder[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<SubcontractorAttendanceLog[]>([]);
  const [paymentClaims, setPaymentClaims] = useState<SubcontractorPaymentClaim[]>([]);
  const [measuredWorks, setMeasuredWorks] = useState<SubcontractorMeasuredWork[]>([]);

  // Selection & Details Drawers
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<SubcontractorWorkOrder | null>(null);
  const [workOrderMilestones, setWorkOrderMilestones] = useState<WorkOrderMilestone[]>([]);

  // Modals
  const [showWoModal, setShowWoModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showMeasuredModal, setShowMeasuredModal] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);

  // Status & Feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Filter Date for Attendance
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));

  // Forms
  const [newWo, setNewWo] = useState({
    workOrderNumber: `WO-${Date.now().toString().slice(-4)}`,
    title: "",
    tradeDiscipline: "civil" as TradeDiscipline,
    contractValue: 100000,
    retentionRatePct: 10.0,
    startDate: new Date().toISOString().slice(0, 10),
    completionDate: "",
    vendorId: "",
    scopeOfWork: "",
  });

  const [newMilestone, setNewMilestone] = useState({
    milestoneName: "",
    description: "",
    amount: 10000,
    plannedDate: "",
  });

  const [newAttendance, setNewAttendance] = useState({
    workOrderId: "",
    date: new Date().toISOString().slice(0, 10),
    trade: "MEP Electricians",
    skilledCount: 10,
    unskilledCount: 5,
    totalHours: 8.0,
    supervisorName: "",
    notes: "",
  });

  const [newMeasured, setNewMeasured] = useState({
    workOrderId: "",
    measurementDate: new Date().toISOString().slice(0, 10),
    wbsCode: "03-CONC",
    boqItemReference: "BOQ-01",
    description: "",
    uom: "SQM",
    quantityMeasured: 100,
    unitRate: 50,
    measuredBy: "",
  });

  const [newClaim, setNewClaim] = useState({
    workOrderId: "",
    claimNumber: `IPC-${Date.now().toString().slice(-4)}`,
    periodStart: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
    claimedAmount: 50000,
    notes: "",
  });

  const notify = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  useEffect(() => {
    if (!session?.access_token) return;
    loadProjects();
    loadVendors();
  }, [session?.access_token]);

  useEffect(() => {
    if (!session?.access_token || !selectedProjectId) return;
    loadWorkOrders(selectedProjectId);
    loadAttendanceLogs(selectedProjectId, attendanceDate);
    loadPaymentClaims(selectedProjectId);
  }, [session?.access_token, selectedProjectId]);

  async function loadProjects() {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<Project[] | { projects: Project[] }>("/projects", session.access_token);
      const list = Array.isArray(data) ? data : data.projects || [];
      const active = list.filter((p) => p.status !== "archived");
      setProjects(active);
      if (active.length > 0 && !selectedProjectId) {
        const paramId = searchParams.get("projectId");
        const defaultProj = active.find((p) => p.id === paramId) || active[0];
        setSelectedProjectId(defaultProj.id);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  }

  async function loadVendors() {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ vendors: Vendor[] }>("/procurement/vendors", session.access_token);
      setVendors(data.vendors || []);
    } catch (err) {
      console.error("Failed to load vendors", err);
    }
  }

  async function loadWorkOrders(projId: string) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ workOrders: SubcontractorWorkOrder[] }>(
        `/projects/${projId}/subcontractors/work-orders`,
        session.access_token
      );
      setWorkOrders(data.workOrders || []);
      if (data.workOrders?.length > 0 && !newAttendance.workOrderId) {
        setNewAttendance((prev) => ({ ...prev, workOrderId: data.workOrders[0].id }));
        setNewMeasured((prev) => ({ ...prev, workOrderId: data.workOrders[0].id }));
        setNewClaim((prev) => ({ ...prev, workOrderId: data.workOrders[0].id }));
      }
    } catch (err) {
      console.error("Failed to load work orders", err);
    }
  }

  async function loadAttendanceLogs(projId: string, date?: string) {
    if (!session?.access_token) return;
    try {
      const url = date
        ? `/projects/${projId}/subcontractors/attendance?date=${date}`
        : `/projects/${projId}/subcontractors/attendance`;
      const data = await apiFetch<{ logs: SubcontractorAttendanceLog[] }>(url, session.access_token);
      setAttendanceLogs(data.logs || []);
    } catch (err) {
      console.error("Failed to load attendance", err);
    }
  }

  async function loadPaymentClaims(projId: string) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ claims: SubcontractorPaymentClaim[] }>(
        `/projects/${projId}/subcontractors/payment-claims`,
        session.access_token
      );
      setPaymentClaims(data.claims || []);
    } catch (err) {
      console.error("Failed to load claims", err);
    }
  }

  async function openWorkOrderDrawer(wo: SubcontractorWorkOrder) {
    if (!session?.access_token) return;
    setSelectedWorkOrder(wo);
    try {
      const data = await apiFetch<{ workOrder: SubcontractorWorkOrder; milestones: WorkOrderMilestone[] }>(
        `/subcontractors/work-orders/${wo.id}`,
        session.access_token
      );
      setWorkOrderMilestones(data.milestones || []);
      const mwData = await apiFetch<{ measuredWorks: SubcontractorMeasuredWork[] }>(
        `/subcontractors/work-orders/${wo.id}/measured-works`,
        session.access_token
      );
      setMeasuredWorks(mwData.measuredWorks || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load work order details");
    }
  }

  // Handle Work Order Creation
  async function handleCreateWorkOrder(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ workOrder: SubcontractorWorkOrder }>(
        `/projects/${selectedProjectId}/subcontractors/work-orders`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            workOrderNumber: newWo.workOrderNumber,
            title: newWo.title,
            tradeDiscipline: newWo.tradeDiscipline,
            contractValue: Number(newWo.contractValue),
            retentionRatePct: Number(newWo.retentionRatePct),
            startDate: newWo.startDate || null,
            completionDate: newWo.completionDate || null,
            vendorId: newWo.vendorId || null,
            scopeOfWork: newWo.scopeOfWork || null,
          }),
        }
      );
      setWorkOrders((prev) => [res.workOrder, ...prev]);
      setShowWoModal(false);
      notify(`Work package ${res.workOrder.work_order_number} created successfully.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create work order");
    } finally {
      setLoading(false);
    }
  }

  // Handle Milestone Creation
  async function handleCreateMilestone(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedWorkOrder) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ milestone: WorkOrderMilestone }>(
        `/subcontractors/work-orders/${selectedWorkOrder.id}/milestones`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            milestoneName: newMilestone.milestoneName,
            description: newMilestone.description || null,
            amount: Number(newMilestone.amount),
            plannedDate: newMilestone.plannedDate || null,
          }),
        }
      );
      setWorkOrderMilestones((prev) => [...prev, res.milestone]);
      setShowMilestoneModal(false);
      setNewMilestone({ milestoneName: "", description: "", amount: 10000, plannedDate: "" });
      notify("Milestone added successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create milestone");
    } finally {
      setLoading(false);
    }
  }

  // Handle Attendance Log Creation
  async function handleCreateAttendance(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ log: SubcontractorAttendanceLog }>(
        `/projects/${selectedProjectId}/subcontractors/attendance`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            workOrderId: newAttendance.workOrderId,
            date: newAttendance.date,
            trade: newAttendance.trade,
            skilledCount: Number(newAttendance.skilledCount),
            unskilledCount: Number(newAttendance.unskilledCount),
            totalHours: Number(newAttendance.totalHours),
            supervisorName: newAttendance.supervisorName || null,
            notes: newAttendance.notes || null,
          }),
        }
      );
      setAttendanceLogs((prev) => [res.log, ...prev]);
      setShowAttendanceModal(false);
      notify("Daily manpower attendance recorded.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record attendance");
    } finally {
      setLoading(false);
    }
  }

  // Handle Measured Work Creation
  async function handleCreateMeasured(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !newMeasured.workOrderId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ measuredWork: SubcontractorMeasuredWork }>(
        `/subcontractors/work-orders/${newMeasured.workOrderId}/measured-works`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            measurementDate: newMeasured.measurementDate,
            wbsCode: newMeasured.wbsCode,
            boqItemReference: newMeasured.boqItemReference,
            description: newMeasured.description,
            uom: newMeasured.uom,
            quantityMeasured: Number(newMeasured.quantityMeasured),
            unitRate: Number(newMeasured.unitRate),
            measuredBy: newMeasured.measuredBy || null,
          }),
        }
      );
      setMeasuredWorks((prev) => [res.measuredWork, ...prev]);
      setShowMeasuredModal(false);
      notify("Measured work entry recorded.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record measured work");
    } finally {
      setLoading(false);
    }
  }

  // Handle Payment Claim Creation
  async function handleCreateClaim(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedProjectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ claim: SubcontractorPaymentClaim }>(
        `/projects/${selectedProjectId}/subcontractors/payment-claims`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            workOrderId: newClaim.workOrderId,
            claimNumber: newClaim.claimNumber,
            periodStart: newClaim.periodStart,
            periodEnd: newClaim.periodEnd,
            claimedAmount: Number(newClaim.claimedAmount),
            notes: newClaim.notes || null,
          }),
        }
      );
      setPaymentClaims((prev) => [res.claim, ...prev]);
      setShowClaimModal(false);
      notify(`Interim Payment Claim ${res.claim.claim_number} submitted with retention deducted.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create payment claim");
    } finally {
      setLoading(false);
    }
  }

  // Certify Payment Claim
  async function handleCertifyClaim(claim: SubcontractorPaymentClaim) {
    if (!session?.access_token) return;
    const certAmtStr = window.prompt("Enter certified amount (AED):", claim.claimed_amount.toString());
    if (!certAmtStr) return;
    const certAmt = parseFloat(certAmtStr);
    if (isNaN(certAmt) || certAmt <= 0) {
      setError("Invalid certified amount entered.");
      return;
    }

    try {
      const res = await apiFetch<{ claim: SubcontractorPaymentClaim }>(
        `/subcontractors/payment-claims/${claim.id}/certify`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({ certifiedAmount: certAmt, notes: "Certified on site measurement validation" }),
        }
      );
      setPaymentClaims((prev) => prev.map((c) => (c.id === claim.id ? res.claim : c)));
      notify(`Claim ${claim.claim_number} certified for ${res.claim.net_payable_amount.toLocaleString()} AED.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to certify payment claim");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-200 pb-6">
        <div>
          <h1 className="font-syne text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Subcontractors &amp; Labour Operations
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Work packages, trade agreements, daily site attendance, measured work verification, and payment claims.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="subcontractor-project-select" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Project:
          </label>
          <select
            id="subcontractor-project-select"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSearchParams({ projectId: e.target.value });
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `[${p.code}] ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900 font-bold ml-4">
            ×
          </button>
        </div>
      )}
      {successMsg && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mt-6 border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "work_orders"}
            onClick={() => setActiveTab("work_orders")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "work_orders"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Work Packages &amp; Orders
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {workOrders.length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "attendance"}
            onClick={() => setActiveTab("attendance")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "attendance"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Daily Manpower &amp; Attendance
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {attendanceLogs.length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "measured"}
            onClick={() => setActiveTab("measured")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "measured"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Measured Work &amp; Progress
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {measuredWorks.length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "claims"}
            onClick={() => setActiveTab("claims")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "claims"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Payment Claims &amp; Retention
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {paymentClaims.length}
            </span>
          </button>
        </nav>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: WORK ORDERS & PACKAGES */}
      {/* ==================================================================== */}
      {activeTab === "work_orders" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Subcontract Packages &amp; Agreements</h2>
            <PermissionGate permission="subcontractor.workorder.manage">
              <button
                onClick={() => setShowWoModal(true)}
                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + New Work Order
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">WO Number</th>
                  <th className="px-4 py-3">Package Title</th>
                  <th className="px-4 py-3">Discipline</th>
                  <th className="px-4 py-3">Subcontractor</th>
                  <th className="px-4 py-3 text-right">Contract Value</th>
                  <th className="px-4 py-3 text-right">Retention</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {workOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                      No subcontractor work packages established for this project yet.
                    </td>
                  </tr>
                ) : (
                  workOrders.map((wo) => (
                    <tr key={wo.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{wo.work_order_number}</td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{wo.title}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold capitalize text-zinc-700">
                          {wo.trade_discipline}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{wo.vendor_name || "Direct Gang"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                        {wo.contract_value.toLocaleString()} AED
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-600">
                        {wo.retention_rate_pct}%
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          wo.status === "active" ? "bg-emerald-100 text-emerald-800" :
                          wo.status === "completed" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {wo.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openWorkOrderDrawer(wo)}
                          className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
                        >
                          View Package →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: DAILY MANPOWER & ATTENDANCE */}
      {/* ==================================================================== */}
      {activeTab === "attendance" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-base font-semibold text-zinc-800">Trade Manpower &amp; Attendance Ledger</h2>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-zinc-500">Date:</label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => {
                    setAttendanceDate(e.target.value);
                    if (selectedProjectId) loadAttendanceLogs(selectedProjectId, e.target.value);
                  }}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                />
              </div>
            </div>
            <PermissionGate permission="subcontractor.attendance.manage">
              <button
                onClick={() => setShowAttendanceModal(true)}
                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + Log Daily Attendance
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Work Package</th>
                  <th className="px-4 py-3">Trade Gang</th>
                  <th className="px-4 py-3 text-right">Skilled</th>
                  <th className="px-4 py-3 text-right">Helpers</th>
                  <th className="px-4 py-3 text-right">Total Hours</th>
                  <th className="px-4 py-3">Supervisor</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                      No attendance entries recorded for this date.
                    </td>
                  </tr>
                ) : (
                  attendanceLogs.map((att) => (
                    <tr key={att.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{att.date}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{att.work_order_title || "Direct"}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-800">{att.trade}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{att.skilled_count}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-600">{att.unskilled_count}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">{att.total_hours} hrs</td>
                      <td className="px-4 py-3 text-xs">{att.supervisor_name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{att.notes || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: MEASURED WORKS & PROGRESS */}
      {/* ==================================================================== */}
      {activeTab === "measured" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Field Measured Work Certifications</h2>
            <PermissionGate permission="subcontractor.claims.manage">
              <button
                onClick={() => setShowMeasuredModal(true)}
                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + Record Measured Work
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Work Package</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">WBS / BOQ</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Unit Rate</th>
                  <th className="px-4 py-3 text-right">Certified Value</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {measuredWorks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                      No field measured works recorded yet.
                    </td>
                  </tr>
                ) : (
                  measuredWorks.map((mw) => (
                    <tr key={mw.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{mw.measurement_date}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900">{mw.work_order_title || "Work Order"}</td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{mw.description}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                        {mw.wbs_code || mw.boq_item_reference || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold">
                        {mw.quantity_measured} {mw.uom}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-600">{mw.unit_rate} AED</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                        {mw.certified_amount.toLocaleString()} AED
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          mw.status === "certified" ? "bg-emerald-100 text-emerald-800" :
                          mw.status === "verified" ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-800"
                        }`}>
                          {mw.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: PAYMENT CLAIMS & RETENTION */}
      {/* ==================================================================== */}
      {activeTab === "claims" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Interim Payment Certificates (IPC) &amp; Retention</h2>
            <PermissionGate permission="subcontractor.claims.manage">
              <button
                onClick={() => setShowClaimModal(true)}
                className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + Submit Payment Claim
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Claim Number</th>
                  <th className="px-4 py-3">Package Title</th>
                  <th className="px-4 py-3">Claim Period</th>
                  <th className="px-4 py-3 text-right">Claimed Gross</th>
                  <th className="px-4 py-3 text-right">Certified Gross</th>
                  <th className="px-4 py-3 text-right">Retention Deducted</th>
                  <th className="px-4 py-3 text-right">Net Payable</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {paymentClaims.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                      No payment claims submitted yet.
                    </td>
                  </tr>
                ) : (
                  paymentClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{claim.claim_number}</td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{claim.work_order_title || "Package"}</td>
                      <td className="px-4 py-3 text-xs font-mono text-zinc-600">
                        {claim.period_start} → {claim.period_end}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-700">
                        {claim.claimed_amount.toLocaleString()} AED
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                        {claim.certified_amount.toLocaleString()} AED
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-rose-600 font-medium">
                        -{claim.retention_deducted.toLocaleString()} AED
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40">
                        {claim.net_payable_amount.toLocaleString()} AED
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          claim.status === "certified" ? "bg-emerald-100 text-emerald-800" :
                          claim.status === "paid" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {claim.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {claim.status === "submitted" && (
                          <PermissionGate permission="subcontractor.claims.certify">
                            <button
                              onClick={() => handleCertifyClaim(claim)}
                              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                            >
                              Certify IPC →
                            </button>
                          </PermissionGate>
                        )}
                        {claim.status !== "submitted" && (
                          <span className="text-xs text-zinc-400 font-medium">Certified</span>
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

      {/* ==================================================================== */}
      {/* WORK ORDER DRAWER */}
      {/* ==================================================================== */}
      {selectedWorkOrder && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl border-l border-zinc-200">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 bg-zinc-50">
            <div>
              <h3 className="text-base font-bold text-zinc-900">{selectedWorkOrder.work_order_number}</h3>
              <p className="text-xs text-zinc-500">{selectedWorkOrder.title}</p>
            </div>
            <button
              onClick={() => setSelectedWorkOrder(null)}
              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
              <div>
                <span className="text-xs text-zinc-500">Contract Value:</span>
                <p className="text-sm font-bold text-zinc-900">{selectedWorkOrder.contract_value.toLocaleString()} AED</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Retention Rate:</span>
                <p className="text-sm font-bold text-zinc-900">{selectedWorkOrder.retention_rate_pct}%</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Trade Discipline:</span>
                <p className="text-sm font-bold capitalize text-zinc-900">{selectedWorkOrder.trade_discipline}</p>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Status:</span>
                <p className="text-sm font-bold capitalize text-zinc-900">{selectedWorkOrder.status}</p>
              </div>
            </div>

            {/* Milestones Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-zinc-800">Contract Milestones</h4>
                <PermissionGate permission="subcontractor.workorder.manage">
                  <button
                    onClick={() => setShowMilestoneModal(true)}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    + Add Milestone
                  </button>
                </PermissionGate>
              </div>

              <div className="space-y-2">
                {workOrderMilestones.length === 0 ? (
                  <p className="text-xs text-zinc-400">No milestones recorded for this work package.</p>
                ) : (
                  workOrderMilestones.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 bg-white">
                      <div>
                        <p className="text-xs font-semibold text-zinc-900">{m.milestone_name}</p>
                        {m.description && <p className="text-[11px] text-zinc-500">{m.description}</p>}
                        <span className="text-[10px] text-zinc-400">Target: {m.planned_date || "TBD"}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-zinc-900">{m.amount.toLocaleString()} AED</p>
                        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-zinc-700">
                          {m.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: NEW WORK ORDER */}
      {/* ==================================================================== */}
      {showWoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">New Subcontractor Work Order</h3>
            <form onSubmit={handleCreateWorkOrder} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">WO Number</label>
                  <input
                    type="text"
                    required
                    value={newWo.workOrderNumber}
                    onChange={(e) => setNewWo({ ...newWo, workOrderNumber: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Discipline</label>
                  <select
                    value={newWo.tradeDiscipline}
                    onChange={(e) => setNewWo({ ...newWo, tradeDiscipline: e.target.value as TradeDiscipline })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="civil">Civil &amp; Concrete</option>
                    <option value="mep">MEP Services</option>
                    <option value="structural">Structural Steel</option>
                    <option value="finishes">Finishes &amp; Fitout</option>
                    <option value="facade">Glazed Facade</option>
                    <option value="piling">Piling &amp; Shoring</option>
                    <option value="landscape">Landscaping</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Package Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electrical Rough-in and Cable Tray Works"
                  value={newWo.title}
                  onChange={(e) => setNewWo({ ...newWo, title: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Contract Value (AED)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newWo.contractValue}
                    onChange={(e) => setNewWo({ ...newWo, contractValue: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Retention %</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={100}
                    value={newWo.retentionRatePct}
                    onChange={(e) => setNewWo({ ...newWo, retentionRatePct: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Subcontractor (Vendor)</label>
                <select
                  value={newWo.vendorId}
                  onChange={(e) => setNewWo({ ...newWo, vendorId: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">Direct Internal Labour Gang</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowWoModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create Work Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: NEW ATTENDANCE */}
      {/* ==================================================================== */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Log Daily Subcontractor Manpower</h3>
            <form onSubmit={handleCreateAttendance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Work Package</label>
                <select
                  required
                  value={newAttendance.workOrderId}
                  onChange={(e) => setNewAttendance({ ...newAttendance, workOrderId: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.work_order_number} - {wo.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={newAttendance.date}
                    onChange={(e) => setNewAttendance({ ...newAttendance, date: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Trade Gang</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Duct Installers"
                    value={newAttendance.trade}
                    onChange={(e) => setNewAttendance({ ...newAttendance, trade: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Skilled</label>
                  <input
                    type="number"
                    min={0}
                    value={newAttendance.skilledCount}
                    onChange={(e) => setNewAttendance({ ...newAttendance, skilledCount: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Helpers</label>
                  <input
                    type="number"
                    min={0}
                    value={newAttendance.unskilledCount}
                    onChange={(e) => setNewAttendance({ ...newAttendance, unskilledCount: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    value={newAttendance.totalHours}
                    onChange={(e) => setNewAttendance({ ...newAttendance, totalHours: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading ? "Recording..." : "Log Manpower"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: NEW MEASURED WORK */}
      {/* ==================================================================== */}
      {showMeasuredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Record Measured Work</h3>
            <form onSubmit={handleCreateMeasured} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Work Package</label>
                <select
                  required
                  value={newMeasured.workOrderId}
                  onChange={(e) => setNewMeasured({ ...newMeasured, workOrderId: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.work_order_number} - {wo.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Work Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cable Tray Installation Level 2"
                  value={newMeasured.description}
                  onChange={(e) => setNewMeasured({ ...newMeasured, description: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={0}
                    value={newMeasured.quantityMeasured}
                    onChange={(e) => setNewMeasured({ ...newMeasured, quantityMeasured: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">UOM</label>
                  <input
                    type="text"
                    value={newMeasured.uom}
                    onChange={(e) => setNewMeasured({ ...newMeasured, uom: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Unit Rate</label>
                  <input
                    type="number"
                    min={0}
                    value={newMeasured.unitRate}
                    onChange={(e) => setNewMeasured({ ...newMeasured, unitRate: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowMeasuredModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading ? "Recording..." : "Save Measurement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: NEW PAYMENT CLAIM */}
      {/* ==================================================================== */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Submit Subcontractor Payment Claim</h3>
            <form onSubmit={handleCreateClaim} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Work Package</label>
                <select
                  required
                  value={newClaim.workOrderId}
                  onChange={(e) => setNewClaim({ ...newClaim, workOrderId: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  {workOrders.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.work_order_number} - {wo.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Claim Number</label>
                  <input
                    type="text"
                    required
                    value={newClaim.claimNumber}
                    onChange={(e) => setNewClaim({ ...newClaim, claimNumber: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Claimed Amount (AED)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newClaim.claimedAmount}
                    onChange={(e) => setNewClaim({ ...newClaim, claimedAmount: Number(e.target.value) })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Period Start</label>
                  <input
                    type="date"
                    required
                    value={newClaim.periodStart}
                    onChange={(e) => setNewClaim({ ...newClaim, periodStart: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Period End</label>
                  <input
                    type="date"
                    required
                    value={newClaim.periodEnd}
                    onChange={(e) => setNewClaim({ ...newClaim, periodEnd: e.target.value })}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: NEW MILESTONE */}
      {/* ==================================================================== */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-200">
            <h3 className="text-lg font-bold text-zinc-900 mb-4">Add Milestone</h3>
            <form onSubmit={handleCreateMilestone} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Milestone Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basement First Fix Complete"
                  value={newMilestone.milestoneName}
                  onChange={(e) => setNewMilestone({ ...newMilestone, milestoneName: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Milestone Amount (AED)</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={newMilestone.amount}
                  onChange={(e) => setNewMilestone({ ...newMilestone, amount: Number(e.target.value) })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">Planned Date</label>
                <input
                  type="date"
                  value={newMilestone.plannedDate}
                  onChange={(e) => setNewMilestone({ ...newMilestone, plannedDate: e.target.value })}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setShowMilestoneModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Milestone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
