import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type LicenceCategory =
  | "trade_licence"
  | "civil_defense"
  | "municipality_permit"
  | "environmental"
  | "road_transport"
  | "customs"
  | "other";

export type LicenceStatus = "active" | "expiring_soon" | "expired" | "under_renewal" | "suspended";

export interface LicencePermit {
  id: string;
  project_id?: string | null;
  licence_name: string;
  licence_number: string;
  category: LicenceCategory;
  issuing_authority: string;
  issue_date: string;
  expiry_date: string;
  renewal_lead_days: number;
  status: LicenceStatus;
  responsible_officer: string;
  renewal_cost: number;
  document_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export type MatterType =
  | "arbitration"
  | "litigation"
  | "adjudication"
  | "mediation"
  | "labor_claim"
  | "regulatory_investigation";

export type MatterRiskLevel = "low" | "medium" | "high" | "critical";
export type AccessClass = "public" | "internal" | "privileged_confidential";
export type MatterStatus = "open" | "pleadings" | "hearing" | "settled" | "judgment_awarded" | "closed";

export interface LegalMatter {
  id: string;
  project_id?: string | null;
  matter_reference: string;
  title: string;
  matter_type: MatterType;
  court_or_tribunal: string;
  claim_amount: number;
  currency: string;
  opposing_party: string;
  risk_level: MatterRiskLevel;
  access_class: AccessClass;
  internal_counsel: string;
  status: MatterStatus;
  summary: string;
  created_at: string;
}

export type FeeArrangement = "hourly" | "fixed_fee" | "capped" | "contingency";
export type CounselStatus = "active" | "concluded" | "terminated";

export interface ExternalCounsel {
  id: string;
  firm_name: string;
  lead_attorney: string;
  email?: string | null;
  phone?: string | null;
  specialization: string;
  fee_arrangement: FeeArrangement;
  budget_amount: number;
  billed_amount: number;
  currency: string;
  status: CounselStatus;
  notes?: string | null;
  created_at: string;
}

export type ObligationFrequency = "monthly" | "quarterly" | "semi_annual" | "annual" | "ad_hoc";
export type ObligationStatus = "pending" | "filed" | "exempt" | "overdue";

export interface ComplianceObligation {
  id: string;
  obligation_name: string;
  regulatory_body: string;
  frequency: ObligationFrequency;
  deadline_date: string;
  compliance_owner: string;
  status: ObligationStatus;
  evidence_reference?: string | null;
  filing_date?: string | null;
  notes?: string | null;
  created_at: string;
}

type TabKey = "licences" | "matters" | "counsel" | "obligations";

export function LegalPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as TabKey) || "licences";

  const [projectId] = useState<string>("");
  const [, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [licences, setLicences] = useState<LicencePermit[]>([]);
  const [matters, setMatters] = useState<LegalMatter[]>([]);
  const [counselList, setCounselList] = useState<ExternalCounsel[]>([]);
  const [obligations, setObligations] = useState<ComplianceObligation[]>([]);

  // Modals
  const [showLicenceModal, setShowLicenceModal] = useState(false);
  const [renewingLicence, setRenewingLicence] = useState<LicencePermit | null>(null);
  const [showMatterModal, setShowMatterModal] = useState(false);
  const [showCounselModal, setShowCounselModal] = useState(false);
  const [updatingBillingCounsel, setUpdatingBillingCounsel] = useState<ExternalCounsel | null>(null);
  const [showObligationModal, setShowObligationModal] = useState(false);
  const [filingObligation, setFilingObligation] = useState<ComplianceObligation | null>(null);

  // Form states
  const [newLicence, setNewLicence] = useState({
    licence_name: "",
    licence_number: "",
    category: "trade_licence" as LicenceCategory,
    issuing_authority: "",
    issue_date: new Date().toISOString().split("T")[0],
    expiry_date: "",
    renewal_lead_days: 30,
    responsible_officer: "",
    renewal_cost: 0,
    notes: "",
  });

  const [renewForm, setRenewForm] = useState({
    new_expiry_date: "",
    renewal_cost: 0,
    notes: "",
  });

  const [newMatter, setNewMatter] = useState({
    matter_reference: "",
    title: "",
    matter_type: "arbitration" as MatterType,
    court_or_tribunal: "",
    claim_amount: 0,
    currency: "AED",
    opposing_party: "",
    risk_level: "medium" as MatterRiskLevel,
    access_class: "internal" as AccessClass,
    internal_counsel: "",
    summary: "",
    status: "open" as MatterStatus,
  });

  const [newCounsel, setNewCounsel] = useState({
    firm_name: "",
    lead_attorney: "",
    email: "",
    phone: "",
    specialization: "",
    fee_arrangement: "hourly" as FeeArrangement,
    budget_amount: 0,
    billed_amount: 0,
    currency: "AED",
    notes: "",
  });

  const [counselBilledAmount, setCounselBilledAmount] = useState<number>(0);

  const [newObligation, setNewObligation] = useState({
    obligation_name: "",
    regulatory_body: "",
    frequency: "annual" as ObligationFrequency,
    deadline_date: "",
    compliance_owner: "",
    notes: "",
  });

  const [fileForm, setFileForm] = useState({
    evidence_reference: "",
    filing_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const loadData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";

    try {
      if (currentTab === "licences") {
        const res = await apiFetch<{ licences: LicencePermit[] }>(
          `/legal/licences${query}`,
          session.access_token
        );
        setLicences(res.licences || []);
      } else if (currentTab === "matters") {
        const res = await apiFetch<{ matters: LegalMatter[] }>(
          `/legal/matters${query}`,
          session.access_token
        );
        setMatters(res.matters || []);
      } else if (currentTab === "counsel") {
        const res = await apiFetch<{ counsel: ExternalCounsel[] }>(
          `/legal/counsel`,
          session.access_token
        );
        setCounselList(res.counsel || []);
      } else if (currentTab === "obligations") {
        const res = await apiFetch<{ obligations: ComplianceObligation[] }>(
          `/legal/obligations`,
          session.access_token
        );
        setObligations(res.obligations || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load legal records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session?.access_token, currentTab, projectId]);

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  // Actions
  const handleCreateLicence = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ licence: LicencePermit }>("/legal/licences", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...newLicence,
          project_id: projectId || null,
        }),
      });
      setShowLicenceModal(false);
      setNewLicence({
        licence_name: "",
        licence_number: "",
        category: "trade_licence",
        issuing_authority: "",
        issue_date: new Date().toISOString().split("T")[0],
        expiry_date: "",
        renewal_lead_days: 30,
        responsible_officer: "",
        renewal_cost: 0,
        notes: "",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to register licence");
    }
  };

  const handleRenewLicence = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !renewingLicence) return;
    try {
      await apiFetch<{ licence: LicencePermit }>(
        `/legal/licences/${renewingLicence.id}/renew`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify(renewForm),
        }
      );
      setRenewingLicence(null);
      setRenewForm({ new_expiry_date: "", renewal_cost: 0, notes: "" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to renew licence");
    }
  };

  const handleCreateMatter = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ matter: LegalMatter }>("/legal/matters", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...newMatter,
          project_id: projectId || null,
        }),
      });
      setShowMatterModal(false);
      setNewMatter({
        matter_reference: "",
        title: "",
        matter_type: "arbitration",
        court_or_tribunal: "",
        claim_amount: 0,
        currency: "AED",
        opposing_party: "",
        risk_level: "medium",
        access_class: "internal",
        internal_counsel: "",
        summary: "",
        status: "open",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to log legal matter");
    }
  };

  const handleUpdateMatterStatus = async (id: string, status: MatterStatus) => {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/legal/matters/${id}/status`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update matter status");
    }
  };

  const handleCreateCounsel = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ counsel: ExternalCounsel }>("/legal/counsel", session.access_token, {
        method: "POST",
        body: JSON.stringify(newCounsel),
      });
      setShowCounselModal(false);
      setNewCounsel({
        firm_name: "",
        lead_attorney: "",
        email: "",
        phone: "",
        specialization: "",
        fee_arrangement: "hourly",
        budget_amount: 0,
        billed_amount: 0,
        currency: "AED",
        notes: "",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to add external counsel");
    }
  };

  const handleUpdateCounselBilling = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !updatingBillingCounsel) return;
    try {
      await apiFetch(`/legal/counsel/${updatingBillingCounsel.id}/billing`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ billed_amount: counselBilledAmount }),
      });
      setUpdatingBillingCounsel(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update billing");
    }
  };

  const handleCreateObligation = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ obligation: ComplianceObligation }>("/legal/obligations", session.access_token, {
        method: "POST",
        body: JSON.stringify(newObligation),
      });
      setShowObligationModal(false);
      setNewObligation({
        obligation_name: "",
        regulatory_body: "",
        frequency: "annual",
        deadline_date: "",
        compliance_owner: "",
        notes: "",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to add obligation");
    }
  };

  const handleFileObligation = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !filingObligation) return;
    try {
      await apiFetch(`/legal/obligations/${filingObligation.id}/file`, session.access_token, {
        method: "POST",
        body: JSON.stringify(fileForm),
      });
      setFilingObligation(null);
      setFileForm({ evidence_reference: "", filing_date: new Date().toISOString().split("T")[0], notes: "" });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to file obligation");
    }
  };

  // Metrics
  const expiringLicencesCount = licences.filter(
    (l) => l.status === "expiring_soon" || l.status === "expired"
  ).length;

  const totalDisputeExposure = matters
    .filter((m) => m.status !== "settled" && m.status !== "closed")
    .reduce((sum, m) => sum + Number(m.claim_amount || 0), 0);

  const totalCounselBudget = counselList.reduce((sum, c) => sum + Number(c.budget_amount || 0), 0);
  const totalCounselBilled = counselList.reduce((sum, c) => sum + Number(c.billed_amount || 0), 0);

  const pendingObligationsCount = obligations.filter((o) => o.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-display">
            Legal, Licences & Regulatory Register
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage commercial trade licences, permits, disputes, arbitration, external counsel, and statutory compliance.
          </p>
        </div>

        {/* Action Button Based on Active Tab */}
        <div className="flex items-center gap-3">
          {currentTab === "licences" && (
            <PermissionGate permission="legal.licence.manage">
              <button
                onClick={() => setShowLicenceModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                + Register Licence / Permit
              </button>
            </PermissionGate>
          )}

          {currentTab === "matters" && (
            <PermissionGate permission="legal.matter.manage">
              <button
                onClick={() => setShowMatterModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                + Log Legal Matter
              </button>
            </PermissionGate>
          )}

          {currentTab === "counsel" && (
            <PermissionGate permission="legal.counsel.manage">
              <button
                onClick={() => setShowCounselModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                + Add External Counsel
              </button>
            </PermissionGate>
          )}

          {currentTab === "obligations" && (
            <PermissionGate permission="legal.compliance.manage">
              <button
                onClick={() => setShowObligationModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                + Add Compliance Obligation
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Active Licences & Permits
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 font-display">
            {licences.length}
          </div>
          <div className="mt-1 text-xs text-amber-600 font-medium">
            {expiringLicencesCount} expiring / expired
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Active Dispute Exposure
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-red-600 font-display">
            AED {totalDisputeExposure.toLocaleString("en-US")}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Across open disputes & claims</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            External Counsel Spend
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-indigo-600 font-display">
            AED {totalCounselBilled.toLocaleString("en-US")}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Budget: AED {totalCounselBudget.toLocaleString("en-US")}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Pending Filings
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-amber-600 font-display">
            {pendingObligationsCount}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Statutory regulatory deadlines</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => handleTabChange("licences")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "licences"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Licences & Permits Register
          </button>
          <button
            onClick={() => handleTabChange("matters")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "matters"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Legal Matters & Disputes
          </button>
          <button
            onClick={() => handleTabChange("counsel")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "counsel"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            External Counsel & Advisors
          </button>
          <button
            onClick={() => handleTabChange("obligations")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "obligations"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Compliance Obligations & Filings
          </button>
        </nav>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Tab 1: Licences & Permits */}
      {currentTab === "licences" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Licence Name & Ref</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Issuing Authority</th>
                  <th className="px-4 py-3">Validity Period</th>
                  <th className="px-4 py-3">Responsible Officer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {licences.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No licences or statutory permits registered. Click "+ Register Licence / Permit" to begin.
                    </td>
                  </tr>
                ) : (
                  licences.map((lic) => (
                    <tr key={lic.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <div>{lic.licence_name}</div>
                        <div className="text-xs font-mono text-zinc-400">{lic.licence_number}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-xs">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 font-medium bg-zinc-100 text-zinc-700">
                          {lic.category.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">{lic.issuing_authority}</td>
                      <td className="px-4 py-3 text-xs">
                        <div>Expires: <span className="font-semibold">{lic.expiry_date}</span></div>
                        <div className="text-zinc-400">Issued: {lic.issue_date}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{lic.responsible_officer}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            lic.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : lic.status === "expiring_soon"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-red-100 text-red-800 border border-red-300"
                          }`}
                        >
                          {lic.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="legal.licence.renew">
                          <button
                            onClick={() => {
                              setRenewingLicence(lic);
                              setRenewForm({
                                new_expiry_date: "",
                                renewal_cost: Number(lic.renewal_cost || 0),
                                notes: "",
                              });
                            }}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-800"
                          >
                            Renew
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Legal Matters & Disputes */}
      {currentTab === "matters" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Ref & Title</th>
                  <th className="px-4 py-3">Type & Forum</th>
                  <th className="px-4 py-3">Opposing Party</th>
                  <th className="px-4 py-3">Claim Amount</th>
                  <th className="px-4 py-3">Risk & Privilege</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Advance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {matters.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No legal disputes or litigation recorded.
                    </td>
                  </tr>
                ) : (
                  matters.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <div>{m.title}</div>
                        <div className="text-xs font-mono text-zinc-400">{m.matter_reference}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold capitalize">{m.matter_type.replace("_", " ")}</div>
                        <div className="text-zinc-500">{m.court_or_tribunal}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{m.opposing_party}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-zinc-900">
                        {m.currency} {Number(m.claim_amount || 0).toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-3 text-xs space-y-1">
                        <div>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold uppercase text-[10px] ${
                              m.risk_level === "critical"
                                ? "bg-red-100 text-red-800"
                                : m.risk_level === "high"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {m.risk_level} risk
                          </span>
                        </div>
                        {m.access_class === "privileged_confidential" && (
                          <div>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 font-semibold text-[10px] bg-purple-100 text-purple-800 border border-purple-200">
                              Privileged
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-xs">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 font-medium bg-zinc-100 text-zinc-700">
                          {m.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="legal.matter.manage">
                          {m.status === "open" && (
                            <button
                              onClick={() => handleUpdateMatterStatus(m.id, "pleadings")}
                              className="text-xs font-medium text-amber-600 hover:text-amber-800"
                            >
                              Pleadings
                            </button>
                          )}
                          {m.status === "pleadings" && (
                            <button
                              onClick={() => handleUpdateMatterStatus(m.id, "hearing")}
                              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                            >
                              Hearing
                            </button>
                          )}
                          {m.status === "hearing" && (
                            <button
                              onClick={() => handleUpdateMatterStatus(m.id, "settled")}
                              className="text-xs font-medium text-emerald-600 hover:text-emerald-800"
                            >
                              Settle
                            </button>
                          )}
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: External Counsel & Advisors */}
      {currentTab === "counsel" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Law Firm & Lead Counsel</th>
                  <th className="px-4 py-3">Specialization</th>
                  <th className="px-4 py-3">Fee Structure</th>
                  <th className="px-4 py-3">Budget vs Incurred</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Billing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {counselList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No external law firms registered. Click "+ Add External Counsel" to track retained legal advisors.
                    </td>
                  </tr>
                ) : (
                  counselList.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <div>{c.firm_name}</div>
                        <div className="text-xs text-zinc-400">{c.lead_attorney}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">{c.specialization}</td>
                      <td className="px-4 py-3 capitalize text-xs">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-zinc-100 text-zinc-700">
                          {c.fee_arrangement.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-semibold text-zinc-900">
                          Billed: {c.currency} {Number(c.billed_amount || 0).toLocaleString("en-US")}
                        </div>
                        <div className="text-zinc-400">
                          Budget: {c.currency} {Number(c.budget_amount || 0).toLocaleString("en-US")}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {c.email && <div>{c.email}</div>}
                        {c.phone && <div className="text-zinc-400">{c.phone}</div>}
                      </td>
                      <td className="px-4 py-3 capitalize text-xs">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="legal.counsel.manage">
                          <button
                            onClick={() => {
                              setUpdatingBillingCounsel(c);
                              setCounselBilledAmount(Number(c.billed_amount || 0));
                            }}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-800"
                          >
                            Update Fees
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Compliance Obligations & Filings */}
      {currentTab === "obligations" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Obligation & Body</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Deadline</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Filing Evidence</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {obligations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No statutory compliance obligations tracked yet.
                    </td>
                  </tr>
                ) : (
                  obligations.map((o) => (
                    <tr key={o.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <div>{o.obligation_name}</div>
                        <div className="text-xs text-zinc-400">{o.regulatory_body}</div>
                      </td>
                      <td className="px-4 py-3 capitalize text-xs">{o.frequency.replace("_", " ")}</td>
                      <td className="px-4 py-3 font-semibold text-xs text-zinc-900">{o.deadline_date}</td>
                      <td className="px-4 py-3 text-xs">{o.compliance_owner}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                            o.status === "filed"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : o.status === "overdue"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {o.evidence_reference ? (
                          <div>
                            <span className="font-mono text-zinc-700">{o.evidence_reference}</span>
                            <div className="text-[10px] text-zinc-400">{o.filing_date}</div>
                          </div>
                        ) : (
                          <span className="text-zinc-400 italic">Not yet filed</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="legal.compliance.manage">
                          {o.status !== "filed" && (
                            <button
                              onClick={() => {
                                setFilingObligation(o);
                                setFileForm({
                                  evidence_reference: "",
                                  filing_date: new Date().toISOString().split("T")[0],
                                  notes: "",
                                });
                              }}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                            >
                              Record Filing
                            </button>
                          )}
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Register Licence */}
      {showLicenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Register Licence or Permit</h2>
            <p className="text-xs text-zinc-500 mt-1">Record corporate trade licence, municipality, or site permit.</p>

            <form onSubmit={handleCreateLicence} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Licence / Permit Name *</label>
                <input
                  type="text"
                  required
                  value={newLicence.licence_name}
                  onChange={(e) => setNewLicence({ ...newLicence, licence_name: e.target.value })}
                  placeholder="e.g. Commercial Contracting Licence"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Licence Number *</label>
                  <input
                    type="text"
                    required
                    value={newLicence.licence_number}
                    onChange={(e) => setNewLicence({ ...newLicence, licence_number: e.target.value })}
                    placeholder="e.g. CN-1029482"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Category *</label>
                  <select
                    value={newLicence.category}
                    onChange={(e) => setNewLicence({ ...newLicence, category: e.target.value as LicenceCategory })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="trade_licence">Trade Licence</option>
                    <option value="civil_defense">Civil Defense</option>
                    <option value="municipality_permit">Municipality Permit</option>
                    <option value="environmental">Environmental Clearance</option>
                    <option value="road_transport">Road Transport Permit</option>
                    <option value="customs">Customs Code</option>
                    <option value="other">Other Statutory Permit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Issuing Authority *</label>
                  <input
                    type="text"
                    required
                    value={newLicence.issuing_authority}
                    onChange={(e) => setNewLicence({ ...newLicence, issuing_authority: e.target.value })}
                    placeholder="e.g. Dubai Economy & Tourism (DET)"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Responsible Officer *</label>
                  <input
                    type="text"
                    required
                    value={newLicence.responsible_officer}
                    onChange={(e) => setNewLicence({ ...newLicence, responsible_officer: e.target.value })}
                    placeholder="e.g. Legal Counsel Lead"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Issue Date *</label>
                  <input
                    type="date"
                    required
                    value={newLicence.issue_date}
                    onChange={(e) => setNewLicence({ ...newLicence, issue_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={newLicence.expiry_date}
                    onChange={(e) => setNewLicence({ ...newLicence, expiry_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Renewal Lead Days</label>
                  <input
                    type="number"
                    value={newLicence.renewal_lead_days}
                    onChange={(e) => setNewLicence({ ...newLicence, renewal_lead_days: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Estimated Renewal Cost (AED)</label>
                  <input
                    type="number"
                    value={newLicence.renewal_cost}
                    onChange={(e) => setNewLicence({ ...newLicence, renewal_cost: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowLicenceModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Save Licence
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Renew Licence */}
      {renewingLicence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Renew Licence / Permit</h2>
            <p className="text-xs text-zinc-500 mt-1">
              {renewingLicence.licence_name} ({renewingLicence.licence_number})
            </p>

            <form onSubmit={handleRenewLicence} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">New Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={renewForm.new_expiry_date}
                  onChange={(e) => setRenewForm({ ...renewForm, new_expiry_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Actual Renewal Fee (AED)</label>
                <input
                  type="number"
                  value={renewForm.renewal_cost}
                  onChange={(e) => setRenewForm({ ...renewForm, renewal_cost: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Renewal Notes</label>
                <textarea
                  rows={2}
                  value={renewForm.notes}
                  onChange={(e) => setRenewForm({ ...renewForm, notes: e.target.value })}
                  placeholder="e.g. Receipt voucher ref or payment channel..."
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setRenewingLicence(null)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Confirm Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Legal Matter */}
      {showMatterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl border border-zinc-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Log Legal Matter / Dispute</h2>
            <p className="text-xs text-zinc-500 mt-1">Register litigation, arbitration, or commercial disputes.</p>

            <form onSubmit={handleCreateMatter} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Matter Reference *</label>
                  <input
                    type="text"
                    required
                    value={newMatter.matter_reference}
                    onChange={(e) => setNewMatter({ ...newMatter, matter_reference: e.target.value })}
                    placeholder="e.g. ARB-2026-003"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Matter Type *</label>
                  <select
                    value={newMatter.matter_type}
                    onChange={(e) => setNewMatter({ ...newMatter, matter_type: e.target.value as MatterType })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="arbitration">Arbitration (DIAC / ICC)</option>
                    <option value="litigation">Litigation (Courts)</option>
                    <option value="adjudication">Adjudication / DAB</option>
                    <option value="mediation">Mediation</option>
                    <option value="labor_claim">MOHRE Labour Claim</option>
                    <option value="regulatory_investigation">Regulatory Investigation</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Case Title *</label>
                <input
                  type="text"
                  required
                  value={newMatter.title}
                  onChange={(e) => setNewMatter({ ...newMatter, title: e.target.value })}
                  placeholder="e.g. Contractor vs Steel Fabricator Delay Claim"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Court / Tribunal *</label>
                  <input
                    type="text"
                    required
                    value={newMatter.court_or_tribunal}
                    onChange={(e) => setNewMatter({ ...newMatter, court_or_tribunal: e.target.value })}
                    placeholder="e.g. Dubai International Arbitration Centre"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Opposing Party *</label>
                  <input
                    type="text"
                    required
                    value={newMatter.opposing_party}
                    onChange={(e) => setNewMatter({ ...newMatter, opposing_party: e.target.value })}
                    placeholder="e.g. Apex Steel Fabrication LLC"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Claim Amount</label>
                  <input
                    type="number"
                    value={newMatter.claim_amount}
                    onChange={(e) => setNewMatter({ ...newMatter, claim_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Risk Level</label>
                  <select
                    value={newMatter.risk_level}
                    onChange={(e) => setNewMatter({ ...newMatter, risk_level: e.target.value as MatterRiskLevel })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Privilege Class</label>
                  <select
                    value={newMatter.access_class}
                    onChange={(e) => setNewMatter({ ...newMatter, access_class: e.target.value as AccessClass })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="internal">Internal</option>
                    <option value="privileged_confidential">Privileged & Confidential</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Internal Counsel Lead *</label>
                <input
                  type="text"
                  required
                  value={newMatter.internal_counsel}
                  onChange={(e) => setNewMatter({ ...newMatter, internal_counsel: e.target.value })}
                  placeholder="e.g. Legal Counsel Lead"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Summary & Chronology *</label>
                <textarea
                  required
                  rows={3}
                  value={newMatter.summary}
                  onChange={(e) => setNewMatter({ ...newMatter, summary: e.target.value })}
                  placeholder="Background of the claim, cause of action, contract clauses..."
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowMatterModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Save Legal Matter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add External Counsel */}
      {showCounselModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Add External Counsel</h2>
            <p className="text-xs text-zinc-500 mt-1">Register retained law firm and agreed legal fee budget.</p>

            <form onSubmit={handleCreateCounsel} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Law Firm Name *</label>
                <input
                  type="text"
                  required
                  value={newCounsel.firm_name}
                  onChange={(e) => setNewCounsel({ ...newCounsel, firm_name: e.target.value })}
                  placeholder="e.g. Al Tamimi & Company"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Lead Attorney *</label>
                  <input
                    type="text"
                    required
                    value={newCounsel.lead_attorney}
                    onChange={(e) => setNewCounsel({ ...newCounsel, lead_attorney: e.target.value })}
                    placeholder="e.g. Omar Al-Khatib, Partner"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Specialization *</label>
                  <input
                    type="text"
                    required
                    value={newCounsel.specialization}
                    onChange={(e) => setNewCounsel({ ...newCounsel, specialization: e.target.value })}
                    placeholder="e.g. Construction & Arbitration"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Fee Arrangement</label>
                  <select
                    value={newCounsel.fee_arrangement}
                    onChange={(e) => setNewCounsel({ ...newCounsel, fee_arrangement: e.target.value as FeeArrangement })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="hourly">Hourly Rate</option>
                    <option value="fixed_fee">Fixed Fee</option>
                    <option value="capped">Capped Budget</option>
                    <option value="contingency">Contingency / Success</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Approved Budget (AED)</label>
                  <input
                    type="number"
                    value={newCounsel.budget_amount}
                    onChange={(e) => setNewCounsel({ ...newCounsel, budget_amount: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Email</label>
                  <input
                    type="email"
                    value={newCounsel.email}
                    onChange={(e) => setNewCounsel({ ...newCounsel, email: e.target.value })}
                    placeholder="counsel@firm.com"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Phone</label>
                  <input
                    type="tel"
                    value={newCounsel.phone}
                    onChange={(e) => setNewCounsel({ ...newCounsel, phone: e.target.value })}
                    placeholder="+971 4 364 1234"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowCounselModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Save Counsel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Update Counsel Billing */}
      {updatingBillingCounsel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Update Billed Legal Fees</h2>
            <p className="text-xs text-zinc-500 mt-1">{updatingBillingCounsel.firm_name}</p>

            <form onSubmit={handleUpdateCounselBilling} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Actual Incurred / Billed (AED) *</label>
                <input
                  type="number"
                  required
                  value={counselBilledAmount}
                  onChange={(e) => setCounselBilledAmount(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setUpdatingBillingCounsel(null)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Save Billing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Obligation */}
      {showObligationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Add Compliance Obligation</h2>
            <p className="text-xs text-zinc-500 mt-1">Track regulatory deadline, economic substance, or statutory audit.</p>

            <form onSubmit={handleCreateObligation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Obligation Name *</label>
                <input
                  type="text"
                  required
                  value={newObligation.obligation_name}
                  onChange={(e) => setNewObligation({ ...newObligation, obligation_name: e.target.value })}
                  placeholder="e.g. Economic Substance Regulations (ESR) Return"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Regulatory Body *</label>
                  <input
                    type="text"
                    required
                    value={newObligation.regulatory_body}
                    onChange={(e) => setNewObligation({ ...newObligation, regulatory_body: e.target.value })}
                    placeholder="e.g. Ministry of Finance"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Frequency</label>
                  <select
                    value={newObligation.frequency}
                    onChange={(e) => setNewObligation({ ...newObligation, frequency: e.target.value as ObligationFrequency })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="annual">Annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                    <option value="semi_annual">Semi-Annual</option>
                    <option value="ad_hoc">Ad-Hoc / Event-Driven</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Deadline Date *</label>
                  <input
                    type="date"
                    required
                    value={newObligation.deadline_date}
                    onChange={(e) => setNewObligation({ ...newObligation, deadline_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Compliance Owner *</label>
                  <input
                    type="text"
                    required
                    value={newObligation.compliance_owner}
                    onChange={(e) => setNewObligation({ ...newObligation, compliance_owner: e.target.value })}
                    placeholder="e.g. Compliance Officer"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowObligationModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Save Obligation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: File Obligation */}
      {filingObligation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Record Compliance Filing</h2>
            <p className="text-xs text-zinc-500 mt-1">{filingObligation.obligation_name}</p>

            <form onSubmit={handleFileObligation} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Evidence / Reference Number *</label>
                <input
                  type="text"
                  required
                  value={fileForm.evidence_reference}
                  onChange={(e) => setFileForm({ ...fileForm, evidence_reference: e.target.value })}
                  placeholder="e.g. MOF-ESR-SUB-90214"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Filing Date *</label>
                <input
                  type="date"
                  required
                  value={fileForm.filing_date}
                  onChange={(e) => setFileForm({ ...fileForm, filing_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Notes / Confirmation Details</label>
                <textarea
                  rows={2}
                  value={fileForm.notes}
                  onChange={(e) => setFileForm({ ...fileForm, notes: e.target.value })}
                  placeholder="Acknowledgment receipt confirmed..."
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setFilingObligation(null)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Confirm Filing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
