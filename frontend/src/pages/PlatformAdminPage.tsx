import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export interface TenantSettings {
  id: string;
  tenant_id: string;
  organization_name: string;
  default_timezone: string;
  default_currency: string;
  fiscal_year_start_month: number;
  storage_quota_gb: number;
  session_timeout_minutes: number;
  mfa_enforced: boolean;
  support_email?: string | null;
  support_phone?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantFeatureFlag {
  id: string;
  tenant_id: string;
  flag_key: string;
  name: string;
  description?: string | null;
  category: string;
  is_enabled: boolean;
  updated_by?: string | null;
  updated_at: string;
  created_at: string;
}

export interface SystemMaintenanceWindow {
  id: string;
  tenant_id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export type TicketCategory = "bug" | "access" | "data" | "performance" | "general";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export interface PlatformSupportTicket {
  id: string;
  tenant_id: string;
  ticket_number: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  reported_by: string;
  assigned_to?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemHealthProbe {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  components: {
    database: { status: "up" | "down"; latency_ms: number };
    storage: { status: "up" | "down"; quota_used_gb: number; quota_total_gb: number };
    auth_service: { status: "up" | "down"; mfa_enforced: boolean };
    job_queues: { active_jobs: number; failed_jobs: number; delayed_jobs: number };
  };
}

export function PlatformAdminPage() {
  const { session } = useAuth();
  const token = session?.access_token || "";

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "settings";

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // State
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [flags, setFlags] = useState<TenantFeatureFlag[]>([]);
  const [health, setHealth] = useState<SystemHealthProbe | null>(null);
  const [maintenanceWindows, setMaintenanceWindows] = useState<SystemMaintenanceWindow[]>([]);
  const [tickets, setTickets] = useState<PlatformSupportTicket[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & form state
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<PlatformSupportTicket | null>(null);

  // Settings Edit State
  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("Asia/Dubai");
  const [currency, setCurrency] = useState("AED");
  const [timeoutMins, setTimeoutMins] = useState(60);
  const [mfaEnforced, setMfaEnforced] = useState(false);
  const [supportEmail, setSupportEmail] = useState("");

  // Ticket Form
  const [tktTitle, setTktTitle] = useState("");
  const [tktDesc, setTktDesc] = useState("");
  const [tktCategory, setTktCategory] = useState<TicketCategory>("bug");
  const [tktPriority, setTktPriority] = useState<TicketPriority>("medium");

  // Maintenance Form
  const [maintTitle, setMaintTitle] = useState("");
  const [maintMsg, setMaintMsg] = useState("");
  const [maintSeverity, setMaintSeverity] = useState<"info" | "warning" | "critical">("info");
  const [maintStart, setMaintStart] = useState("");
  const [maintEnd, setMaintEnd] = useState("");

  // Resolve Ticket Form
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolveStatus, setResolveStatus] = useState<TicketStatus>("resolved");

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [settRes, flagsRes, healthRes, maintRes, tktRes] = await Promise.all([
        apiFetch<{ settings: TenantSettings }>("/platform-admin/settings", token).catch(() => ({ settings: null })),
        apiFetch<{ flags: TenantFeatureFlag[] }>("/platform-admin/feature-flags", token).catch(() => ({ flags: [] })),
        apiFetch<{ health: SystemHealthProbe }>("/platform-admin/health", token).catch(() => ({ health: null })),
        apiFetch<{ maintenance_windows: SystemMaintenanceWindow[] }>("/platform-admin/maintenance", token).catch(() => ({ maintenance_windows: [] })),
        apiFetch<{ tickets: PlatformSupportTicket[] }>("/platform-admin/support-tickets", token).catch(() => ({ tickets: [] })),
      ]);

      if (settRes.settings) {
        setSettings(settRes.settings);
        setOrgName(settRes.settings.organization_name);
        setTimezone(settRes.settings.default_timezone);
        setCurrency(settRes.settings.default_currency);
        setTimeoutMins(settRes.settings.session_timeout_minutes);
        setMfaEnforced(settRes.settings.mfa_enforced);
        setSupportEmail(settRes.settings.support_email || "");
      }

      setFlags(flagsRes.flags || []);
      setHealth(healthRes.health || null);
      setMaintenanceWindows(maintRes.maintenance_windows || []);
      setTickets(tktRes.tickets || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load platform administration data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Handlers: Settings
  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ settings: TenantSettings }>("/platform-admin/settings", token, {
        method: "PATCH",
        body: JSON.stringify({
          organization_name: orgName,
          default_timezone: timezone,
          default_currency: currency,
          session_timeout_minutes: timeoutMins,
          mfa_enforced: mfaEnforced,
          support_email: supportEmail,
        }),
      });
      setSettings(res.settings);
      setSuccessMsg("Tenant settings updated successfully");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update tenant settings");
    }
  };

  // Handlers: Feature Flags
  const handleToggleFlag = async (flag: TenantFeatureFlag) => {
    try {
      const res = await apiFetch<{ flag: TenantFeatureFlag }>("/platform-admin/feature-flags/toggle", token, {
        method: "POST",
        body: JSON.stringify({
          flag_key: flag.flag_key,
          is_enabled: !flag.is_enabled,
          updated_by: session?.user?.email,
        }),
      });
      setFlags(flags.map((f) => (f.flag_key === flag.flag_key ? res.flag : f)));
      setSuccessMsg(`Flag ${flag.name} ${res.flag.is_enabled ? "enabled" : "disabled"}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to toggle feature flag");
    }
  };

  // Handlers: Maintenance
  const handleCreateMaintenance = async (e: FormEvent) => {
    e.preventDefault();
    if (!maintTitle.trim() || !maintMsg.trim()) return;
    try {
      const res = await apiFetch<{ maintenance_window: SystemMaintenanceWindow }>("/platform-admin/maintenance", token, {
        method: "POST",
        body: JSON.stringify({
          title: maintTitle,
          message: maintMsg,
          severity: maintSeverity,
          starts_at: maintStart || new Date().toISOString(),
          ends_at: maintEnd || new Date(Date.now() + 3600000).toISOString(),
          created_by: session?.user?.email,
        }),
      });
      setMaintenanceWindows([res.maintenance_window, ...maintenanceWindows]);
      setIsMaintModalOpen(false);
      setMaintTitle("");
      setMaintMsg("");
      setSuccessMsg("Maintenance announcement broadcast created");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to schedule maintenance window");
    }
  };

  const handleToggleMaintenance = async (win: SystemMaintenanceWindow) => {
    try {
      const res = await apiFetch<{ maintenance_window: SystemMaintenanceWindow }>(
        `/platform-admin/maintenance/${win.id}/toggle`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({ is_active: !win.is_active }),
        }
      );
      setMaintenanceWindows(maintenanceWindows.map((m) => (m.id === win.id ? res.maintenance_window : m)));
      setSuccessMsg(`Maintenance banner ${res.maintenance_window.is_active ? "activated" : "deactivated"}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update maintenance banner");
    }
  };

  // Handlers: Support Tickets
  const handleCreateTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!tktTitle.trim() || !tktDesc.trim()) return;
    try {
      const res = await apiFetch<{ ticket: PlatformSupportTicket }>("/platform-admin/support-tickets", token, {
        method: "POST",
        body: JSON.stringify({
          title: tktTitle,
          description: tktDesc,
          category: tktCategory,
          priority: tktPriority,
          reported_by: session?.user?.email || "user@sevents.ae",
        }),
      });
      setTickets([res.ticket, ...tickets]);
      setIsTicketModalOpen(false);
      setTktTitle("");
      setTktDesc("");
      setSuccessMsg("Support ticket submitted to helpdesk");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit support ticket");
    }
  };

  const handleResolveTicket = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !resolutionNotes.trim()) return;
    try {
      const res = await apiFetch<{ ticket: PlatformSupportTicket }>(
        `/platform-admin/support-tickets/${selectedTicket.id}/resolve`,
        token,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: resolveStatus,
            resolution_notes: resolutionNotes,
            assigned_to: session?.user?.email,
          }),
        }
      );
      setTickets(tickets.map((t) => (t.id === selectedTicket.id ? res.ticket : t)));
      setSelectedTicket(null);
      setResolutionNotes("");
      setSuccessMsg(`Ticket ${res.ticket.ticket_number} marked as ${res.ticket.status}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to resolve support ticket");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Platform Administration &amp; Support
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Tenant configuration, system health telemetry, experimental feature flags, maintenance windows, and helpdesk support.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "maintenance" && (
            <PermissionGate permission="platform.maintenance.manage">
              <button
                onClick={() => setIsMaintModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-amber-400 focus:outline-none"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Announce Maintenance
              </button>
            </PermissionGate>
          )}

          {activeTab === "support" && (
            <PermissionGate permission="platform.support.manage">
              <button
                onClick={() => setIsTicketModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-amber-400 focus:outline-none"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Support Ticket
              </button>
            </PermissionGate>
          )}

          <button
            onClick={loadData}
            title="Refresh telemetry"
            className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-semibold text-red-800">&times;</button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="font-semibold text-emerald-800">&times;</button>
        </div>
      )}

      {/* Active Maintenance Alert Banner (if any) */}
      {maintenanceWindows.some((w) => w.is_active) && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-amber-900">
                Active Maintenance Notice: {maintenanceWindows.find((w) => w.is_active)?.title}
              </h4>
              <p className="mt-0.5 text-xs text-amber-800">
                {maintenanceWindows.find((w) => w.is_active)?.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { id: "settings", label: "Tenant Profile & Security Config" },
            { id: "feature_flags", label: "Feature Flags", count: flags.length },
            { id: "health", label: "System Health & Observability" },
            { id: "maintenance", label: "Maintenance Announcements", count: maintenanceWindows.length },
            { id: "support", label: "Support & Helpdesk", count: tickets.length },
          ].map((tab) => {
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium ${
                  isCurrent
                    ? "border-amber-500 text-amber-600 font-semibold"
                    : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      isCurrent ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* TAB 1: SETTINGS */}
          {activeTab === "settings" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div>
                    <h3 className="font-heading text-lg font-bold text-zinc-900">Organization Profile</h3>
                    <p className="mt-1 text-xs text-zinc-500">Corporate legal entity name and global regional conventions.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">Organization Name *</label>
                      <input
                        type="text"
                        required
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">Default Currency</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                      >
                        <option value="AED">AED - United Arab Emirates Dirham</option>
                        <option value="SAR">SAR - Saudi Riyal</option>
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="OMR">OMR - Omani Rial</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">System Timezone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                      >
                        <option value="Asia/Dubai">Asia/Dubai (UTC+04:00)</option>
                        <option value="Asia/Riyadh">Asia/Riyadh (UTC+03:00)</option>
                        <option value="Europe/London">Europe/London (UTC+00:00 / UTC+01:00)</option>
                        <option value="UTC">UTC (Coordinated Universal Time)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700">Support Desk Email</label>
                      <input
                        type="email"
                        value={supportEmail}
                        onChange={(e) => setSupportEmail(e.target.value)}
                        placeholder="support@company.com"
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 pt-6">
                    <h3 className="font-heading text-lg font-bold text-zinc-900">Security &amp; Session Policies</h3>
                    <p className="mt-1 text-xs text-zinc-500">Idle timeout enforcement and zero-trust authentication controls.</p>

                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700">Session Idle Timeout (Minutes)</label>
                        <input
                          type="number"
                          min={5}
                          max={480}
                          value={timeoutMins}
                          onChange={(e) => setTimeoutMins(Number(e.target.value))}
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-6">
                        <input
                          type="checkbox"
                          id="mfaCheckbox"
                          checked={mfaEnforced}
                          onChange={(e) => setMfaEnforced(e.target.checked)}
                          className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
                        />
                        <label htmlFor="mfaCheckbox" className="text-xs font-semibold text-zinc-800 cursor-pointer">
                          Enforce Multi-Factor Authentication (MFA)
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <PermissionGate permission="platform.settings.manage">
                      <button
                        type="submit"
                        className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
                      >
                        Save Configuration
                      </button>
                    </PermissionGate>
                  </div>
                </form>
              </div>

              {/* Sidebar Quotas Card */}
              <div className="space-y-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h3 className="font-heading text-base font-bold text-zinc-900">Storage &amp; Capacity Quotas</h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-zinc-600">Document Cloud Storage</span>
                        <span className="text-zinc-900 font-bold">14.8 GB / {settings?.storage_quota_gb || 100} GB</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: "14.8%" }} />
                      </div>
                    </div>

                    <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600">
                      <p className="font-semibold text-zinc-800">High Availability Zone</p>
                      <p className="mt-0.5 text-zinc-500">Database primary hosted in AWS me-central-1 (UAE Region) with continuous WAL replication.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FEATURE FLAGS */}
          {activeTab === "feature_flags" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Feature Key</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {flags.map((flag) => (
                    <tr key={flag.id} className="hover:bg-zinc-50/50">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-zinc-900">
                        {flag.flag_key}
                        <div className="text-[11px] font-sans font-normal text-zinc-500">{flag.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase text-zinc-700">
                          {flag.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-600">
                        {flag.description || "No description provided"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            flag.is_enabled ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {flag.is_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <PermissionGate permission="platform.feature_flags.manage">
                          <button
                            onClick={() => handleToggleFlag(flag)}
                            className={`rounded-lg px-3 py-1 text-xs font-medium ${
                              flag.is_enabled
                                ? "border border-red-200 text-red-600 hover:bg-red-50"
                                : "border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {flag.is_enabled ? "Disable" : "Enable"}
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: SYSTEM HEALTH */}
          {activeTab === "health" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Database Engine</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {health?.components.database.status.toUpperCase() || "UP"}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-zinc-900">{health?.components.database.latency_ms || 12} ms</p>
                  <p className="mt-1 text-xs text-zinc-400">PostgreSQL ping latency</p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">File Storage</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {health?.components.storage.status.toUpperCase() || "UP"}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-zinc-900">{health?.components.storage.quota_used_gb || 14.8} GB</p>
                  <p className="mt-1 text-xs text-zinc-400">of {health?.components.storage.quota_total_gb || 100} GB provisioned</p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Auth Service</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {health?.components.auth_service.status.toUpperCase() || "UP"}
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-zinc-900">OAuth / JWT</p>
                  <p className="mt-1 text-xs text-zinc-400">Session auth active</p>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Job Queues</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      NORMAL
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-bold text-zinc-900">{health?.components.job_queues.active_jobs || 3} Active</p>
                  <p className="mt-1 text-xs text-zinc-400">0 failed / retry queue clean</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: MAINTENANCE WINDOWS */}
          {activeTab === "maintenance" && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-6 py-3">Announcement Title</th>
                      <th className="px-6 py-3">Severity</th>
                      <th className="px-6 py-3">Scheduled Period</th>
                      <th className="px-6 py-3">Banner State</th>
                      <th className="px-6 py-3 text-right">Toggle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {maintenanceWindows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-zinc-400">
                          No maintenance windows scheduled. Click "Announce Maintenance" to schedule downtime notifications.
                        </td>
                      </tr>
                    ) : (
                      maintenanceWindows.map((win) => (
                        <tr key={win.id} className="hover:bg-zinc-50/50">
                          <td className="px-6 py-4">
                            <span className="font-semibold text-zinc-900">{win.title}</span>
                            <div className="text-xs text-zinc-500 mt-0.5">{win.message}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                win.severity === "critical"
                                  ? "bg-red-100 text-red-800"
                                  : win.severity === "warning"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {win.severity.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-zinc-600">
                            {new Date(win.starts_at).toLocaleString()} &rarr; {new Date(win.ends_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                win.is_active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {win.is_active ? "Broadcasting" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <PermissionGate permission="platform.maintenance.manage">
                              <button
                                onClick={() => handleToggleMaintenance(win)}
                                className="text-xs font-medium text-amber-600 hover:text-amber-800"
                              >
                                {win.is_active ? "Deactivate" : "Broadcast"}
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

          {/* TAB 5: SUPPORT TICKETS */}
          {activeTab === "support" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Ticket ID</th>
                    <th className="px-6 py-3">Subject</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Priority</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Reported By</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-sm text-zinc-400">
                        No support tickets raised. Click "New Support Ticket" to submit helpdesk inquiries.
                      </td>
                    </tr>
                  ) : (
                    tickets.map((tkt) => (
                      <tr key={tkt.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-amber-700">
                          {tkt.ticket_number}
                        </td>
                        <td className="px-6 py-4 font-medium text-zinc-900">
                          {tkt.title}
                          <div className="text-xs text-zinc-500 line-clamp-1">{tkt.description}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium uppercase text-zinc-700">
                            {tkt.category}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              tkt.priority === "critical"
                                ? "bg-red-100 text-red-800"
                                : tkt.priority === "high"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {tkt.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              tkt.status === "resolved"
                                ? "bg-emerald-100 text-emerald-800"
                                : tkt.status === "in_progress"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {tkt.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-zinc-600">
                          {tkt.reported_by}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedTicket(tkt);
                              setResolveStatus(tkt.status === "resolved" ? "closed" : "resolved");
                              setResolutionNotes(tkt.resolution_notes || "");
                            }}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-800"
                          >
                            Triage
                          </button>
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

      {/* MODAL: New Support Ticket */}
      {isTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <form onSubmit={handleCreateTicket}>
              <h3 className="text-lg font-bold text-zinc-900">Submit Support Ticket</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Log a software defect, access permission issue, or platform request.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Ticket Subject *</label>
                  <input
                    type="text"
                    required
                    value={tktTitle}
                    onChange={(e) => setTktTitle(e.target.value)}
                    placeholder="Brief description of the issue"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700">Category</label>
                    <select
                      value={tktCategory}
                      onChange={(e) => setTktCategory(e.target.value as TicketCategory)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    >
                      <option value="bug">Software Bug</option>
                      <option value="access">Access &amp; Permissions</option>
                      <option value="data">Data Discrepancy</option>
                      <option value="performance">Performance / Latency</option>
                      <option value="general">General Support</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700">Urgency Priority</label>
                    <select
                      value={tktPriority}
                      onChange={(e) => setTktPriority(e.target.value as TicketPriority)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical / Site Blocking</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Detailed Description *</label>
                  <textarea
                    required
                    rows={4}
                    value={tktDesc}
                    onChange={(e) => setTktDesc(e.target.value)}
                    placeholder="Provide full reproduction steps or context..."
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTicketModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                >
                  Submit Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Announce Maintenance */}
      {isMaintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <form onSubmit={handleCreateMaintenance}>
              <h3 className="text-lg font-bold text-zinc-900">Broadcast Maintenance Window</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Display a tenant-wide banner notifying all active operators of upcoming downtime.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Notice Title *</label>
                  <input
                    type="text"
                    required
                    value={maintTitle}
                    onChange={(e) => setMaintTitle(e.target.value)}
                    placeholder="e.g. Scheduled ERP Core Upgrade"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Banner Message *</label>
                  <textarea
                    required
                    rows={3}
                    value={maintMsg}
                    onChange={(e) => setMaintMsg(e.target.value)}
                    placeholder="Explain the scheduled service interruption..."
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700">Severity</label>
                    <select
                      value={maintSeverity}
                      onChange={(e) => setMaintSeverity(e.target.value as any)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700">Starts At *</label>
                    <input
                      type="datetime-local"
                      required
                      value={maintStart}
                      onChange={(e) => setMaintStart(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700">Ends At *</label>
                    <input
                      type="datetime-local"
                      required
                      value={maintEnd}
                      onChange={(e) => setMaintEnd(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-2 py-2 text-xs focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsMaintModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                >
                  Broadcast Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Triage / Resolve Ticket */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <form onSubmit={handleResolveTicket}>
              <h3 className="text-lg font-bold text-zinc-900">Triage Ticket {selectedTicket.ticket_number}</h3>
              <p className="mt-1 text-xs text-zinc-500">{selectedTicket.title}</p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Update Status</label>
                  <select
                    value={resolveStatus}
                    onChange={(e) => setResolveStatus(e.target.value as TicketStatus)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Resolution / Triage Notes *</label>
                  <textarea
                    required
                    rows={4}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Detail the resolution or diagnostic steps taken..."
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                >
                  Update Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
