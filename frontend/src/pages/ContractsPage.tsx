import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type ContractType = "main_contract" | "subcontract" | "consultancy" | "joint_venture";
export type ContractStatus = "draft" | "executed" | "active" | "suspended" | "terminated" | "closed";

export interface Contract {
  id: string;
  project_id: string;
  contract_reference: string;
  title: string;
  contract_type: ContractType;
  counterparty_name: string;
  original_value: number;
  revised_value: number;
  signed_date?: string | null;
  commencement_date: string;
  contractual_completion_date: string;
  revised_completion_date: string;
  governing_law: string;
  status: ContractStatus;
  notes?: string | null;
  created_at: string;
}

export type VariationReason =
  | "client_request"
  | "site_instruction"
  | "design_change"
  | "unforeseen_conditions"
  | "value_engineering";

export type VariationStatus = "identified" | "pricing" | "submitted" | "approved" | "rejected";

export interface VariationOrder {
  id: string;
  contract_id: string;
  project_id: string;
  vo_number: string;
  title: string;
  description: string;
  reason: VariationReason;
  proposed_cost_amount: number;
  proposed_time_days: number;
  approved_cost_amount: number;
  approved_time_days: number;
  status: VariationStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
  created_at: string;
}

export type ClaimEventType =
  | "employer_delay"
  | "late_access"
  | "design_revision"
  | "adverse_weather"
  | "force_majeure"
  | "suspension";

export type ClaimStatus =
  | "notice_issued"
  | "particulars_submitted"
  | "under_assessment"
  | "approved"
  | "partially_approved"
  | "rejected"
  | "disputed";

export interface ContractClaim {
  id: string;
  contract_id: string;
  project_id: string;
  claim_number: string;
  title: string;
  event_type: ClaimEventType;
  event_date: string;
  notice_date: string;
  notice_deadline_date: string;
  particulars_submitted_date?: string | null;
  claimed_days: number;
  claimed_cost_amount: number;
  certified_days: number;
  certified_cost_amount: number;
  status: ClaimStatus;
  assessment_notes?: string | null;
  created_at: string;
}

export type SecurityType =
  | "performance_bond"
  | "advance_payment_guarantee"
  | "retention_bond"
  | "car_insurance"
  | "third_party_liability"
  | "workmen_compensation";

export type SecurityStatus = "active" | "expired" | "called" | "released";

export interface ContractSecurity {
  id: string;
  contract_id: string;
  project_id: string;
  security_type: SecurityType;
  reference_number: string;
  issuing_institution: string;
  beneficiary: string;
  amount: number;
  currency: string;
  effective_date: string;
  expiry_date: string;
  status: SecurityStatus;
  notes?: string | null;
  created_at: string;
}

export function ContractsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "contracts";

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [variations, setVariations] = useState<VariationOrder[]>([]);
  const [claims, setClaims] = useState<ContractClaim[]>([]);
  const [securities, setSecurities] = useState<ContractSecurity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showContractModal, setShowContractModal] = useState<boolean>(false);
  const [showVariationModal, setShowVariationModal] = useState<boolean>(false);
  const [showApproveVoModal, setShowApproveVoModal] = useState<VariationOrder | null>(null);
  const [showClaimModal, setShowClaimModal] = useState<boolean>(false);
  const [showAssessClaimModal, setShowAssessClaimModal] = useState<ContractClaim | null>(null);
  const [showSecurityModal, setShowSecurityModal] = useState<boolean>(false);

  // Form inputs
  const [contractForm, setContractForm] = useState({
    project_id: "proj-1",
    contract_reference: "",
    title: "",
    contract_type: "main_contract" as ContractType,
    counterparty_name: "",
    original_value: 0,
    commencement_date: new Date().toISOString().split("T")[0]!,
    contractual_completion_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]!,
    governing_law: "FIDIC / English Law",
    notes: "",
  });

  const [voForm, setVoForm] = useState({
    contract_id: "",
    project_id: "proj-1",
    vo_number: "",
    title: "",
    description: "",
    reason: "client_request" as VariationReason,
    proposed_cost_amount: 0,
    proposed_time_days: 0,
    notes: "",
  });

  const [approveVoForm, setApproveVoForm] = useState({
    approved_cost_amount: 0,
    approved_time_days: 0,
  });

  const [claimForm, setClaimForm] = useState({
    contract_id: "",
    project_id: "proj-1",
    claim_number: "",
    title: "",
    event_type: "employer_delay" as ClaimEventType,
    event_date: new Date().toISOString().split("T")[0]!,
    notice_date: new Date().toISOString().split("T")[0]!,
    claimed_days: 0,
    claimed_cost_amount: 0,
    assessment_notes: "",
  });

  const [assessClaimForm, setAssessClaimForm] = useState({
    certified_days: 0,
    certified_cost_amount: 0,
    status: "approved" as ClaimStatus,
    assessment_notes: "",
  });

  const [securityForm, setSecurityForm] = useState({
    contract_id: "",
    project_id: "proj-1",
    security_type: "performance_bond" as SecurityType,
    reference_number: "",
    issuing_institution: "",
    beneficiary: "",
    amount: 0,
    currency: "USD",
    effective_date: new Date().toISOString().split("T")[0]!,
    expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]!,
    notes: "",
  });

  const loadData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [cRes, vRes, clRes, sRes] = await Promise.all([
        apiFetch<{ contracts: Contract[] }>("/contracts", session.access_token),
        apiFetch<{ variations: VariationOrder[] }>("/contracts/variations", session.access_token),
        apiFetch<{ claims: ContractClaim[] }>("/contracts/claims", session.access_token),
        apiFetch<{ securities: ContractSecurity[] }>("/contracts/securities", session.access_token),
      ]);
      setContracts(cRes.contracts || []);
      setVariations(vRes.variations || []);
      setClaims(clRes.claims || []);
      setSecurities(sRes.securities || []);
    } catch (err: any) {
      setError(err.message || "Failed to load contracts data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session?.access_token]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
  };

  const handleCreateContract = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ contract: Contract }>("/contracts", session.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contractForm),
      });
      setShowContractModal(false);
      setContractForm({
        project_id: "proj-1",
        contract_reference: "",
        title: "",
        contract_type: "main_contract",
        counterparty_name: "",
        original_value: 0,
        commencement_date: new Date().toISOString().split("T")[0]!,
        contractual_completion_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]!,
        governing_law: "FIDIC / English Law",
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create contract");
    }
  };

  const handleCreateVariation = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ variation: VariationOrder }>("/contracts/variations", session.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(voForm),
      });
      setShowVariationModal(false);
      setVoForm({
        contract_id: "",
        project_id: "proj-1",
        vo_number: "",
        title: "",
        description: "",
        reason: "client_request",
        proposed_cost_amount: 0,
        proposed_time_days: 0,
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create variation");
    }
  };

  const handleApproveVariation = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !showApproveVoModal) return;
    try {
      await apiFetch<{ variation: VariationOrder }>(
        `/contracts/variations/${showApproveVoModal.id}/approve`,
        session.access_token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approved_cost_amount: Number(approveVoForm.approved_cost_amount),
            approved_time_days: Number(approveVoForm.approved_time_days),
            approved_by: session.user?.id || "authorized-user",
          }),
        }
      );
      setShowApproveVoModal(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to approve variation");
    }
  };

  const handleCreateClaim = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ claim: ContractClaim }>("/contracts/claims", session.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(claimForm),
      });
      setShowClaimModal(false);
      setClaimForm({
        contract_id: "",
        project_id: "proj-1",
        claim_number: "",
        title: "",
        event_type: "employer_delay",
        event_date: new Date().toISOString().split("T")[0]!,
        notice_date: new Date().toISOString().split("T")[0]!,
        claimed_days: 0,
        claimed_cost_amount: 0,
        assessment_notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to submit claim");
    }
  };

  const handleAssessClaim = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !showAssessClaimModal) return;
    try {
      await apiFetch<{ claim: ContractClaim }>(
        `/contracts/claims/${showAssessClaimModal.id}/assess`,
        session.access_token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            certified_days: Number(assessClaimForm.certified_days),
            certified_cost_amount: Number(assessClaimForm.certified_cost_amount),
            status: assessClaimForm.status,
            assessment_notes: assessClaimForm.assessment_notes,
          }),
        }
      );
      setShowAssessClaimModal(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to assess claim");
    }
  };

  const handleCreateSecurity = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ security: ContractSecurity }>("/contracts/securities", session.access_token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(securityForm),
      });
      setShowSecurityModal(false);
      setSecurityForm({
        contract_id: "",
        project_id: "proj-1",
        security_type: "performance_bond",
        reference_number: "",
        issuing_institution: "",
        beneficiary: "",
        amount: 0,
        currency: "USD",
        effective_date: new Date().toISOString().split("T")[0]!,
        expiry_date: new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0]!,
        notes: "",
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to register security");
    }
  };

  const handleUpdateSecurityStatus = async (id: string, status: SecurityStatus) => {
    if (!session?.access_token) return;
    try {
      await apiFetch<{ security: ContractSecurity }>(
        `/contracts/securities/${id}/status`,
        session.access_token,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );
      await loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update security status");
    }
  };

  // KPI Calculations
  const totalCommittedValue = contracts.reduce((sum, c) => sum + Number(c.revised_value || 0), 0);
  const pendingVariationsCount = variations.filter((v) => v.status !== "approved" && v.status !== "rejected").length;
  const approvedVariationsValue = variations.filter((v) => v.status === "approved").reduce((sum, v) => sum + Number(v.approved_cost_amount || 0), 0);
  const pendingClaimsCount = claims.filter((c) => c.status !== "approved" && c.status !== "rejected").length;
  const activeSecuritiesAmount = securities.filter((s) => s.status === "active").reduce((sum, s) => sum + Number(s.amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Contracts, Claims & Variations</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Contract obligations repository, variation orders, FIDIC Clause 20.1 claims & EOT, and securities register.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "contracts" && (
            <PermissionGate permission="contracts.contract.manage">
              <button
                onClick={() => setShowContractModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                + Register Contract
              </button>
            </PermissionGate>
          )}
          {activeTab === "variations" && (
            <PermissionGate permission="contracts.variation.manage">
              <button
                onClick={() => setShowVariationModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                + Request Variation
              </button>
            </PermissionGate>
          )}
          {activeTab === "claims" && (
            <PermissionGate permission="contracts.claim.manage">
              <button
                onClick={() => setShowClaimModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                + Submit Claim / EOT
              </button>
            </PermissionGate>
          )}
          {activeTab === "securities" && (
            <PermissionGate permission="contracts.security.manage">
              <button
                onClick={() => setShowSecurityModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                + Register Bond / Insurance
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total Committed Value</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900">${totalCommittedValue.toLocaleString("en-US")}</p>
          <p className="mt-1 text-xs text-zinc-400">{contracts.length} active / executed contracts</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Approved Variations</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">+${approvedVariationsValue.toLocaleString("en-US")}</p>
          <p className="mt-1 text-xs text-zinc-400">{pendingVariationsCount} pending variations</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Active Claims &amp; EOT</p>
          <p className="mt-2 text-2xl font-bold text-indigo-600">{pendingClaimsCount}</p>
          <p className="mt-1 text-xs text-zinc-400">{claims.length} total claims recorded</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Securities &amp; Guarantees</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">${activeSecuritiesAmount.toLocaleString("en-US")}</p>
          <p className="mt-1 text-xs text-zinc-400">{securities.filter((s) => s.status === "active").length} active instruments</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex space-x-6">
          <button
            onClick={() => handleTabChange("contracts")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "contracts"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Contract Repository ({contracts.length})
          </button>
          <button
            onClick={() => handleTabChange("variations")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "variations"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Variation Orders ({variations.length})
          </button>
          <button
            onClick={() => handleTabChange("claims")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "claims"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Claims &amp; EOT ({claims.length})
          </button>
          <button
            onClick={() => handleTabChange("securities")}
            className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "securities"
                ? "border-amber-500 text-amber-600"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Bonds &amp; Insurance ({securities.length})
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : (
        <>
          {/* TAB 1: CONTRACTS */}
          {activeTab === "contracts" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Contract Ref</th>
                    <th className="px-6 py-3">Title &amp; Type</th>
                    <th className="px-6 py-3">Counterparty</th>
                    <th className="px-6 py-3">Original / Revised Value</th>
                    <th className="px-6 py-3">Completion Date</th>
                    <th className="px-6 py-3">Governing Law</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {contracts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-zinc-400">
                        No contracts registered yet. Click &quot;+ Register Contract&quot; to add your prime or subcontracts.
                      </td>
                    </tr>
                  ) : (
                    contracts.map((c) => (
                      <tr key={c.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4 font-mono font-semibold text-zinc-900">{c.contract_reference}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">{c.title}</p>
                          <span className="inline-block rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                            {c.contract_type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-zinc-700">{c.counterparty_name}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">${Number(c.revised_value).toLocaleString("en-US")}</p>
                          <p className="text-xs text-zinc-400">Orig: ${Number(c.original_value).toLocaleString("en-US")}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">{c.revised_completion_date}</p>
                          {c.revised_completion_date !== c.contractual_completion_date && (
                            <p className="text-xs text-amber-600">Orig: {c.contractual_completion_date}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-zinc-600">{c.governing_law}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: VARIATIONS */}
          {activeTab === "variations" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">VO #</th>
                    <th className="px-6 py-3">Title &amp; Reason</th>
                    <th className="px-6 py-3">Proposed (Cost / Time)</th>
                    <th className="px-6 py-3">Approved (Cost / Time)</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {variations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-400">
                        No variation orders recorded. Click &quot;+ Request Variation&quot; to record scope or cost changes.
                      </td>
                    </tr>
                  ) : (
                    variations.map((v) => (
                      <tr key={v.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4 font-mono font-semibold text-zinc-900">{v.vo_number}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">{v.title}</p>
                          <span className="inline-block rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                            {v.reason.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">${Number(v.proposed_cost_amount).toLocaleString("en-US")}</p>
                          <p className="text-xs text-zinc-400">+{v.proposed_time_days} days</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">
                            {v.status === "approved" ? `$${Number(v.approved_cost_amount).toLocaleString("en-US")}` : "—"}
                          </p>
                          {v.status === "approved" && <p className="text-xs text-zinc-400">+{v.approved_time_days} days</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              v.status === "approved"
                                ? "bg-emerald-50 text-emerald-700"
                                : v.status === "rejected"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {v.status !== "approved" && (
                            <PermissionGate permission="contracts.variation.approve">
                              <button
                                onClick={() => {
                                  setShowApproveVoModal(v);
                                  setApproveVoForm({
                                    approved_cost_amount: v.proposed_cost_amount,
                                    approved_time_days: v.proposed_time_days,
                                  });
                                }}
                                className="rounded bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                              >
                                Approve / Certify
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
          )}

          {/* TAB 3: CLAIMS & EOT */}
          {activeTab === "claims" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Claim #</th>
                    <th className="px-6 py-3">Event &amp; FIDIC Notice Window</th>
                    <th className="px-6 py-3">Claimed (Days / Cost)</th>
                    <th className="px-6 py-3">Certified (Days / Cost)</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {claims.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-zinc-400">
                        No claims recorded. Click &quot;+ Submit Claim / EOT&quot; to log FIDIC delay notices and claim particulars.
                      </td>
                    </tr>
                  ) : (
                    claims.map((cl) => {
                      const isTimeBarred = cl.assessment_notes?.includes("FIDIC Cl. 20.1 Notice Warning");
                      return (
                        <tr key={cl.id} className="hover:bg-zinc-50/50">
                          <td className="px-6 py-4 font-mono font-semibold text-zinc-900">{cl.claim_number}</td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-zinc-900">{cl.title}</p>
                            <p className="text-xs text-zinc-500">
                              Event: {cl.event_date} | Notice: {cl.notice_date}
                            </p>
                            <p className="text-xs text-zinc-400">FIDIC 28d Bar: {cl.notice_deadline_date}</p>
                            {isTimeBarred && (
                              <span className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800">
                                FIDIC 28-day Time Bar Warning
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-zinc-900">{cl.claimed_days} days EOT</p>
                            <p className="text-xs text-zinc-400">${Number(cl.claimed_cost_amount).toLocaleString("en-US")}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-zinc-900">{cl.certified_days} days</p>
                            <p className="text-xs text-zinc-400">${Number(cl.certified_cost_amount).toLocaleString("en-US")}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                cl.status === "approved"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : cl.status === "rejected" || cl.status === "disputed"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-indigo-50 text-indigo-700"
                              }`}
                            >
                              {cl.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <PermissionGate permission="contracts.claim.assess">
                              <button
                                onClick={() => {
                                  setShowAssessClaimModal(cl);
                                  setAssessClaimForm({
                                    certified_days: cl.claimed_days,
                                    certified_cost_amount: cl.claimed_cost_amount,
                                    status: "approved",
                                    assessment_notes: cl.assessment_notes || "",
                                  });
                                }}
                                className="rounded bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                              >
                                Assess / Certify
                              </button>
                            </PermissionGate>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: SECURITIES */}
          {activeTab === "securities" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Security Ref</th>
                    <th className="px-6 py-3">Type &amp; Issuer</th>
                    <th className="px-6 py-3">Beneficiary</th>
                    <th className="px-6 py-3">Guaranteed Amount</th>
                    <th className="px-6 py-3">Effective &amp; Expiry</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {securities.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-zinc-400">
                        No bonds or insurance registered yet. Click &quot;+ Register Bond / Insurance&quot; to log project guarantees.
                      </td>
                    </tr>
                  ) : (
                    securities.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4 font-mono font-semibold text-zinc-900">{s.reference_number}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-zinc-900">{s.security_type.replace("_", " ")}</p>
                          <p className="text-xs text-zinc-500">{s.issuing_institution}</p>
                        </td>
                        <td className="px-6 py-4 text-zinc-700">{s.beneficiary}</td>
                        <td className="px-6 py-4 font-medium text-zinc-900">
                          {s.currency} ${Number(s.amount).toLocaleString("en-US")}
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-500">
                          {s.effective_date} &rarr; {s.expiry_date}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              s.status === "active"
                                ? "bg-emerald-50 text-emerald-700"
                                : s.status === "released"
                                ? "bg-zinc-100 text-zinc-600"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <PermissionGate permission="contracts.security.manage">
                            <select
                              value={s.status}
                              onChange={(e) => handleUpdateSecurityStatus(s.id, e.target.value as SecurityStatus)}
                              className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="active">Active</option>
                              <option value="released">Released</option>
                              <option value="expired">Expired</option>
                              <option value="called">Called</option>
                            </select>
                          </PermissionGate>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: REGISTER CONTRACT */}
      {showContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Register Contract</h3>
            <form onSubmit={handleCreateContract} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Contract Reference</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CTR-2026-MAIN-001"
                  value={contractForm.contract_reference}
                  onChange={(e) => setContractForm({ ...contractForm, contract_reference: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Contract Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main EPC Civil & Structural Package"
                  value={contractForm.title}
                  onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Contract Type</label>
                  <select
                    value={contractForm.contract_type}
                    onChange={(e) => setContractForm({ ...contractForm, contract_type: e.target.value as ContractType })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="main_contract">Main Contract</option>
                    <option value="subcontract">Subcontract</option>
                    <option value="consultancy">Consultancy</option>
                    <option value="joint_venture">Joint Venture</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Counterparty Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gulf Contracting LLC"
                    value={contractForm.counterparty_name}
                    onChange={(e) => setContractForm({ ...contractForm, counterparty_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Original Contract Value ($)</label>
                <input
                  type="number"
                  required
                  value={contractForm.original_value}
                  onChange={(e) => setContractForm({ ...contractForm, original_value: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Commencement Date</label>
                  <input
                    type="date"
                    required
                    value={contractForm.commencement_date}
                    onChange={(e) => setContractForm({ ...contractForm, commencement_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Completion Date</label>
                  <input
                    type="date"
                    required
                    value={contractForm.contractual_completion_date}
                    onChange={(e) => setContractForm({ ...contractForm, contractual_completion_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowContractModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Register Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REQUEST VARIATION */}
      {showVariationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Request Variation Order</h3>
            <form onSubmit={handleCreateVariation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Select Contract</label>
                <select
                  required
                  value={voForm.contract_id}
                  onChange={(e) => setVoForm({ ...voForm, contract_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Choose Contract --</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contract_reference} - {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">VO Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. VO-001"
                    value={voForm.vo_number}
                    onChange={(e) => setVoForm({ ...voForm, vo_number: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Reason</label>
                  <select
                    value={voForm.reason}
                    onChange={(e) => setVoForm({ ...voForm, reason: e.target.value as VariationReason })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="client_request">Client Request</option>
                    <option value="site_instruction">Site Instruction</option>
                    <option value="design_change">Design Change</option>
                    <option value="unforeseen_conditions">Unforeseen Conditions</option>
                    <option value="value_engineering">Value Engineering</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Variation Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Additional electrical transformer room"
                  value={voForm.title}
                  onChange={(e) => setVoForm({ ...voForm, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Description</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Detailed scope of proposed modification..."
                  value={voForm.description}
                  onChange={(e) => setVoForm({ ...voForm, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Proposed Cost ($)</label>
                  <input
                    type="number"
                    value={voForm.proposed_cost_amount}
                    onChange={(e) => setVoForm({ ...voForm, proposed_cost_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Proposed Time (Days)</label>
                  <input
                    type="number"
                    value={voForm.proposed_time_days}
                    onChange={(e) => setVoForm({ ...voForm, proposed_time_days: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowVariationModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Submit Variation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: APPROVE VARIATION */}
      {showApproveVoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Approve Variation: {showApproveVoModal.vo_number}</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Approving this variation will automatically adjust the parent contract&apos;s revised value and completion date.
            </p>
            <form onSubmit={handleApproveVariation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Approved Cost ($)</label>
                <input
                  type="number"
                  required
                  value={approveVoForm.approved_cost_amount}
                  onChange={(e) => setApproveVoForm({ ...approveVoForm, approved_cost_amount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Approved Time Extension (Days)</label>
                <input
                  type="number"
                  required
                  value={approveVoForm.approved_time_days}
                  onChange={(e) => setApproveVoForm({ ...approveVoForm, approved_time_days: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowApproveVoModal(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Confirm Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SUBMIT CLAIM / EOT */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Submit Claim &amp; Extension of Time (EOT)</h3>
            <p className="mt-1 text-xs text-zinc-500">
              FIDIC Clause 20.1: Notice of claim must be submitted within 28 days of the event giving rise to the claim.
            </p>
            <form onSubmit={handleCreateClaim} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Select Contract</label>
                <select
                  required
                  value={claimForm.contract_id}
                  onChange={(e) => setClaimForm({ ...claimForm, contract_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Choose Contract --</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contract_reference} - {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Claim Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CLM-EOT-001"
                    value={claimForm.claim_number}
                    onChange={(e) => setClaimForm({ ...claimForm, claim_number: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Event Type</label>
                  <select
                    value={claimForm.event_type}
                    onChange={(e) => setClaimForm({ ...claimForm, event_type: e.target.value as ClaimEventType })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="employer_delay">Employer Delay</option>
                    <option value="late_access">Late Site Access</option>
                    <option value="design_revision">Design Revision</option>
                    <option value="adverse_weather">Adverse Weather</option>
                    <option value="force_majeure">Force Majeure</option>
                    <option value="suspension">Suspension</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Claim Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Delay due to late handover of basement levels"
                  value={claimForm.title}
                  onChange={(e) => setClaimForm({ ...claimForm, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Event Date</label>
                  <input
                    type="date"
                    required
                    value={claimForm.event_date}
                    onChange={(e) => setClaimForm({ ...claimForm, event_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Notice Date</label>
                  <input
                    type="date"
                    required
                    value={claimForm.notice_date}
                    onChange={(e) => setClaimForm({ ...claimForm, notice_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Claimed Days (EOT)</label>
                  <input
                    type="number"
                    value={claimForm.claimed_days}
                    onChange={(e) => setClaimForm({ ...claimForm, claimed_days: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Claimed Cost ($)</label>
                  <input
                    type="number"
                    value={claimForm.claimed_cost_amount}
                    onChange={(e) => setClaimForm({ ...claimForm, claimed_cost_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: ASSESS CLAIM */}
      {showAssessClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Assess Claim: {showAssessClaimModal.claim_number}</h3>
            <form onSubmit={handleAssessClaim} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Certified Days (EOT)</label>
                  <input
                    type="number"
                    required
                    value={assessClaimForm.certified_days}
                    onChange={(e) => setAssessClaimForm({ ...assessClaimForm, certified_days: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Certified Cost ($)</label>
                  <input
                    type="number"
                    required
                    value={assessClaimForm.certified_cost_amount}
                    onChange={(e) => setAssessClaimForm({ ...assessClaimForm, certified_cost_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Assessment Determination</label>
                <select
                  value={assessClaimForm.status}
                  onChange={(e) => setAssessClaimForm({ ...assessClaimForm, status: e.target.value as ClaimStatus })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="approved">Approved</option>
                  <option value="partially_approved">Partially Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="disputed">Disputed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Assessment Notes</label>
                <textarea
                  rows={3}
                  placeholder="Engineer / QS assessment rationale..."
                  value={assessClaimForm.assessment_notes}
                  onChange={(e) => setAssessClaimForm({ ...assessClaimForm, assessment_notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAssessClaimModal(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Record Assessment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: REGISTER SECURITY */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Register Bond, Guarantee or Insurance</h3>
            <form onSubmit={handleCreateSecurity} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Security Type</label>
                  <select
                    value={securityForm.security_type}
                    onChange={(e) => setSecurityForm({ ...securityForm, security_type: e.target.value as SecurityType })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="performance_bond">Performance Bond</option>
                    <option value="advance_payment_guarantee">Advance Payment Guarantee</option>
                    <option value="retention_bond">Retention Bond</option>
                    <option value="car_insurance">CAR Insurance (Contractor All Risks)</option>
                    <option value="third_party_liability">Third Party Liability</option>
                    <option value="workmen_compensation">Workmen Compensation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Reference Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PB-2026-9001"
                    value={securityForm.reference_number}
                    onChange={(e) => setSecurityForm({ ...securityForm, reference_number: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Issuing Institution (Bank / Insurer)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Chartered Bank"
                  value={securityForm.issuing_institution}
                  onChange={(e) => setSecurityForm({ ...securityForm, issuing_institution: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500">Beneficiary</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sevents Construction Corp"
                  value={securityForm.beneficiary}
                  onChange={(e) => setSecurityForm({ ...securityForm, beneficiary: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Amount</label>
                  <input
                    type="number"
                    required
                    value={securityForm.amount}
                    onChange={(e) => setSecurityForm({ ...securityForm, amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Currency</label>
                  <input
                    type="text"
                    required
                    value={securityForm.currency}
                    onChange={(e) => setSecurityForm({ ...securityForm, currency: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Effective Date</label>
                  <input
                    type="date"
                    required
                    value={securityForm.effective_date}
                    onChange={(e) => setSecurityForm({ ...securityForm, effective_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500">Expiry Date</label>
                  <input
                    type="date"
                    required
                    value={securityForm.expiry_date}
                    onChange={(e) => setSecurityForm({ ...securityForm, expiry_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSecurityModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
                >
                  Register Security
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
