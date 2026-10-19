import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type ConnectorCategory =
  | "accounting"
  | "banking"
  | "e_sign"
  | "storage"
  | "ocr"
  | "custom";

export type ConnectorStatus = "connected" | "disconnected" | "error" | "syncing";

export interface ApiKeyItem {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_rpm: number;
  expires_at?: string | null;
  revoked_at?: string | null;
  last_used_at?: string | null;
  created_by?: string | null;
  created_at: string;
  plain_key?: string;
}

export interface WebhookSubscriptionItem {
  id: string;
  tenant_id: string;
  name: string;
  target_url: string;
  event_types: string[];
  secret_key?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryItem {
  id: string;
  tenant_id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status?: number | null;
  response_body?: string | null;
  status: "success" | "failed" | "retrying";
  delivered_at: string;
}

export interface ServiceConnectorItem {
  id: string;
  tenant_id: string;
  connector_key: string;
  name: string;
  category: ConnectorCategory;
  status: ConnectorStatus;
  credentials_masked: Record<string, unknown>;
  settings: Record<string, unknown>;
  last_sync_at?: string | null;
  created_at: string;
  updated_at: string;
}

const AVAILABLE_SCOPES = [
  { key: "projects:read", label: "Read Projects & Milestones" },
  { key: "projects:write", label: "Update Projects & Progress" },
  { key: "finance:read", label: "Read Budgets & Expenses" },
  { key: "finance:write", label: "Create Expenses & Claims" },
  { key: "billing:read", label: "Read Invoices & Applications" },
  { key: "billing:write", label: "Create Invoices & Receipts" },
  { key: "quality:read", label: "Read Inspections & NCRs" },
  { key: "safety:read", label: "Read Safety & Incidents" },
  { key: "documents:read", label: "Read Drawings & Documents" },
  { key: "webhooks:read", label: "Read Webhook Logs" },
];

const AVAILABLE_EVENTS = [
  { key: "project.created", label: "Project Created" },
  { key: "project.milestone_reached", label: "Milestone Reached" },
  { key: "billing.invoice_approved", label: "Tax Invoice Approved" },
  { key: "billing.payment_received", label: "Payment Application Certified" },
  { key: "quality.ncr_raised", label: "NCR Raised (Defect)" },
  { key: "safety.incident_reported", label: "Safety Incident Reported" },
  { key: "subcontractor.claim_certified", label: "Subcontractor Claim Certified" },
];

export function IntegrationsPage() {
  const { session } = useAuth();
  const token = session?.access_token || "";

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "api_keys";

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  // State
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSubscriptionItem[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([]);
  const [connectors, setConnectors] = useState<ServiceConnectorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<string | null>(null);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [selectedConnector, setSelectedConnector] = useState<ServiceConnectorItem | null>(null);
  const [isConnectorModalOpen, setIsConnectorModalOpen] = useState(false);
  const [inspectDelivery, setInspectDelivery] = useState<WebhookDeliveryItem | null>(null);

  // Key Form
  const [keyName, setKeyName] = useState("");
  const [keyScopes, setKeyScopes] = useState<string[]>(["projects:read", "billing:read"]);
  const [keyRateLimit, setKeyRateLimit] = useState(60);
  const [keyExpiresAt, setKeyExpiresAt] = useState("");

  // Webhook Form
  const [webhookName, setWebhookName] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["billing.invoice_approved"]);

  // Connector Form
  const [connectorAuthKey, setConnectorAuthKey] = useState("");
  const [connectorSecret, setConnectorSecret] = useState("");
  const [connectorEnv, setConnectorEnv] = useState("sandbox");

  const loadData = async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [keysRes, hooksRes, delivRes, connRes] = await Promise.all([
        apiFetch<{ api_keys: ApiKeyItem[] }>("/integrations/api-keys", token).catch(() => ({ api_keys: [] })),
        apiFetch<{ webhooks: WebhookSubscriptionItem[] }>("/integrations/webhooks", token).catch(() => ({ webhooks: [] })),
        apiFetch<{ deliveries: WebhookDeliveryItem[] }>("/integrations/deliveries", token).catch(() => ({ deliveries: [] })),
        apiFetch<{ connectors: ServiceConnectorItem[] }>("/integrations/connectors", token).catch(() => ({ connectors: [] })),
      ]);

      setApiKeys(keysRes.api_keys || []);
      setWebhooks(hooksRes.webhooks || []);
      setDeliveries(delivRes.deliveries || []);
      setConnectors(connRes.connectors || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load integrations data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [token]);

  // Handlers: API Keys
  const handleCreateApiKey = async (e: FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    try {
      const res = await apiFetch<{ api_key: ApiKeyItem }>("/integrations/api-keys", token, {
        method: "POST",
        body: JSON.stringify({
          name: keyName,
          scopes: keyScopes,
          rate_limit_rpm: keyRateLimit,
          expires_at: keyExpiresAt || null,
        }),
      });
      setApiKeys([res.api_key, ...apiKeys]);
      setNewKeyResult(res.api_key.plain_key || null);
      setSuccessMsg("API key created successfully. Save your key token immediately.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create API key");
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action is permanent and cannot be undone.")) {
      return;
    }
    try {
      await apiFetch<{ success: boolean }>(`/integrations/api-keys/${id}/revoke`, token, {
        method: "POST",
      });
      setApiKeys(apiKeys.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)));
      setSuccessMsg("API key revoked");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to revoke API key");
    }
  };

  // Handlers: Webhooks
  const handleCreateWebhook = async (e: FormEvent) => {
    e.preventDefault();
    if (!webhookName.trim() || !webhookUrl.trim()) return;
    try {
      const res = await apiFetch<{ webhook: WebhookSubscriptionItem }>("/integrations/webhooks", token, {
        method: "POST",
        body: JSON.stringify({
          name: webhookName,
          target_url: webhookUrl,
          event_types: webhookEvents,
        }),
      });
      setWebhooks([res.webhook, ...webhooks]);
      setIsWebhookModalOpen(false);
      setWebhookName("");
      setWebhookUrl("");
      setSuccessMsg("Webhook subscription registered successfully.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create webhook subscription");
    }
  };

  const handleToggleWebhook = async (wh: WebhookSubscriptionItem) => {
    try {
      const res = await apiFetch<{ webhook: WebhookSubscriptionItem }>(`/integrations/webhooks/${wh.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !wh.is_active }),
      });
      setWebhooks(webhooks.map((w) => (w.id === wh.id ? res.webhook : w)));
      setSuccessMsg(`Webhook ${res.webhook.is_active ? "activated" : "paused"}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to toggle webhook");
    }
  };

  const handleTestPingWebhook = async (wh: WebhookSubscriptionItem) => {
    try {
      const res = await apiFetch<{ delivery: WebhookDeliveryItem }>(`/integrations/webhooks/${wh.id}/test`, token, {
        method: "POST",
      });
      setDeliveries([res.delivery, ...deliveries]);
      setSuccessMsg(`Test ping dispatched! Response status: ${res.delivery.response_status}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to ping webhook");
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook subscription?")) return;
    try {
      await apiFetch<{ success: boolean }>(`/integrations/webhooks/${id}`, token, {
        method: "DELETE",
      });
      setWebhooks(webhooks.filter((w) => w.id !== id));
      setSuccessMsg("Webhook subscription deleted");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete webhook");
    }
  };

  // Handlers: Connectors
  const handleOpenConnector = (c: ServiceConnectorItem) => {
    setSelectedConnector(c);
    setConnectorAuthKey("");
    setConnectorSecret("");
    setConnectorEnv((c.settings?.environment as string) || "sandbox");
    setIsConnectorModalOpen(true);
  };

  const handleSaveConnector = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedConnector) return;
    try {
      const res = await apiFetch<{ connector: ServiceConnectorItem }>("/integrations/connectors", token, {
        method: "POST",
        body: JSON.stringify({
          connector_key: selectedConnector.connector_key,
          name: selectedConnector.name,
          category: selectedConnector.category,
          credentials: {
            auth_key: connectorAuthKey,
            secret: connectorSecret,
          },
          settings: {
            environment: connectorEnv,
          },
        }),
      });
      setConnectors(connectors.map((c) => (c.connector_key === selectedConnector.connector_key ? res.connector : c)));
      setIsConnectorModalOpen(false);
      setSuccessMsg(`Connector ${selectedConnector.name} updated successfully.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save connector configuration");
    }
  };

  const handleDisconnectConnector = async (c: ServiceConnectorItem) => {
    if (!confirm(`Are you sure you want to disconnect ${c.name}? Synced pipelines will be paused.`)) return;
    try {
      await apiFetch<{ success: boolean }>(`/integrations/connectors/${c.id}/disconnect`, token, {
        method: "POST",
      });
      setConnectors(connectors.map((item) => (item.id === c.id ? { ...item, status: "disconnected", credentials_masked: {} } : item)));
      setSuccessMsg(`Disconnected ${c.name}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to disconnect connector");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Integrations &amp; API Management
            </h1>
            <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
              Module M34
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Secure developer gateway: machine-to-machine API tokens, real-time outbound webhooks, enterprise ERP connectors, and audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "api_keys" && (
            <PermissionGate permission="integrations.api_key.manage">
              <button
                onClick={() => {
                  setNewKeyResult(null);
                  setKeyName("");
                  setIsKeyModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Generate API Key
              </button>
            </PermissionGate>
          )}

          {activeTab === "webhooks" && (
            <PermissionGate permission="integrations.webhook.manage">
              <button
                onClick={() => setIsWebhookModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black shadow-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Webhook
              </button>
            </PermissionGate>
          )}

          <button
            onClick={loadData}
            title="Refresh"
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

      {/* Tabs */}
      <div className="mb-6 border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {[
            { id: "api_keys", label: "API Keys & Access Scopes", count: apiKeys.length },
            { id: "webhooks", label: "Outbound Webhooks", count: webhooks.length },
            { id: "connectors", label: "Service Connectors (ERP & DocuSign)", count: connectors.length },
            { id: "deliveries", label: "Delivery & Audit Logs", count: deliveries.length },
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
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    isCurrent ? "bg-amber-100 text-amber-800" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {tab.count}
                </span>
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
          {/* TAB 1: API KEYS */}
          {activeTab === "api_keys" && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                  <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-6 py-3">Token Name</th>
                      <th className="px-6 py-3">Key Prefix</th>
                      <th className="px-6 py-3">Assigned Scopes</th>
                      <th className="px-6 py-3">Rate Limit</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {apiKeys.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-sm text-zinc-400">
                          No API keys issued. Click "Generate API Key" to provision automated integration tokens.
                        </td>
                      </tr>
                    ) : (
                      apiKeys.map((key) => {
                        const isRevoked = !!key.revoked_at;
                        return (
                          <tr key={key.id} className="hover:bg-zinc-50/50">
                            <td className="px-6 py-4 font-medium text-zinc-900">
                              {key.name}
                              <div className="text-xs text-zinc-400 font-normal">
                                Created {new Date(key.created_at).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-zinc-700">
                              {key.key_prefix}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {key.scopes.slice(0, 3).map((s) => (
                                  <span key={s} className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-mono text-zinc-700">
                                    {s}
                                  </span>
                                ))}
                                {key.scopes.length > 3 && (
                                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">
                                    +{key.scopes.length - 3} more
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-zinc-600">
                              {key.rate_limit_rpm} rpm
                            </td>
                            <td className="px-6 py-4">
                              {isRevoked ? (
                                <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                  Revoked
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {!isRevoked && (
                                <PermissionGate permission="integrations.api_key.revoke">
                                  <button
                                    onClick={() => handleRevokeApiKey(key.id)}
                                    className="text-xs font-medium text-red-600 hover:text-red-800"
                                  >
                                    Revoke
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

          {/* TAB 2: WEBHOOKS */}
          {activeTab === "webhooks" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {webhooks.length === 0 ? (
                  <div className="col-span-2 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
                    No webhooks subscribed yet. Click "New Webhook" to dispatch live event notifications to external webhooks.
                  </div>
                ) : (
                  webhooks.map((wh) => (
                    <div key={wh.id} className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                      <div>
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-zinc-900">{wh.name}</h3>
                            <p className="mt-1 font-mono text-xs text-zinc-500 break-all">{wh.target_url}</p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              wh.is_active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {wh.is_active ? "Active" : "Paused"}
                          </span>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Subscribed Events</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {wh.event_types.map((ev) => (
                              <span key={ev} className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 border border-amber-200/50">
                                {ev}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4">
                        <div className="flex items-center gap-2">
                          <PermissionGate permission="integrations.webhook.test">
                            <button
                              onClick={() => handleTestPingWebhook(wh)}
                              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
                            >
                              Test Ping
                            </button>
                          </PermissionGate>
                          <PermissionGate permission="integrations.webhook.manage">
                            <button
                              onClick={() => handleToggleWebhook(wh)}
                              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
                            >
                              {wh.is_active ? "Pause" : "Resume"}
                            </button>
                          </PermissionGate>
                        </div>

                        <PermissionGate permission="integrations.webhook.manage">
                          <button
                            onClick={() => handleDeleteWebhook(wh.id)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </PermissionGate>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CONNECTORS */}
          {activeTab === "connectors" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {connectors.map((conn) => {
                const isConn = conn.status === "connected";
                return (
                  <div key={conn.id} className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                          {conn.category}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isConn ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${isConn ? "bg-emerald-500" : "bg-zinc-400"}`} />
                          {conn.status}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-bold text-zinc-900">{conn.name}</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {conn.category === "accounting" && "Synchronize general ledgers, tax invoices, and vendor bills with ERP."}
                        {conn.category === "banking" && "Automated corporate bank reconciliation & WPS payment dispatch."}
                        {conn.category === "e_sign" && "Digital signatures on subcontract work orders and change claims."}
                        {conn.category === "storage" && "Enterprise document archiving and backup replication."}
                        {conn.category === "ocr" && "Machine invoice and receipt digitisation."}
                      </p>

                      <div className="mt-4 rounded-lg bg-zinc-50 p-3 font-mono text-xs text-zinc-600">
                        <div className="flex justify-between py-0.5">
                          <span>Environment:</span>
                          <span className="font-semibold text-zinc-800">
                            {(conn.settings?.environment as string) || "sandbox"}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span>Last Synced:</span>
                          <span className="text-zinc-700">
                            {conn.last_sync_at ? new Date(conn.last_sync_at).toLocaleTimeString() : "Never"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex items-center justify-end gap-2 border-t border-zinc-100 pt-4">
                      {isConn ? (
                        <>
                          <PermissionGate permission="integrations.connector.manage">
                            <button
                              onClick={() => handleOpenConnector(conn)}
                              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                            >
                              Configure
                            </button>
                            <button
                              onClick={() => handleDisconnectConnector(conn)}
                              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Disconnect
                            </button>
                          </PermissionGate>
                        </>
                      ) : (
                        <PermissionGate permission="integrations.connector.manage">
                          <button
                            onClick={() => handleOpenConnector(conn)}
                            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400"
                          >
                            Connect
                          </button>
                        </PermissionGate>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: DELIVERIES & AUDIT LOGS */}
          {activeTab === "deliveries" && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-6 py-3">Timestamp</th>
                    <th className="px-6 py-3">Event Type</th>
                    <th className="px-6 py-3">Target Webhook</th>
                    <th className="px-6 py-3">HTTP Status</th>
                    <th className="px-6 py-3">Delivery Status</th>
                    <th className="px-6 py-3 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-sm text-zinc-400">
                        No webhook deliveries recorded yet. Outbound webhook events and test pings will appear here.
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((del) => (
                      <tr key={del.id} className="hover:bg-zinc-50/50">
                        <td className="px-6 py-4 font-mono text-xs text-zinc-600">
                          {new Date(del.delivered_at).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 font-semibold text-zinc-900">
                          {del.event_type}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                          {del.webhook_id}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${
                              del.response_status && del.response_status >= 200 && del.response_status < 300
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {del.response_status || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              del.status === "success"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {del.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setInspectDelivery(del)}
                            className="text-xs font-medium text-amber-600 hover:text-amber-800"
                          >
                            Inspect
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

      {/* MODAL: Generate API Key */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            {newKeyResult ? (
              <div>
                <div className="flex items-center gap-3 text-emerald-700">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-bold">API Key Generated</h3>
                </div>
                <p className="mt-2 text-sm text-zinc-600">
                  Please copy your secret key token now. You will <span className="font-semibold text-red-600">never be able to see it again!</span>
                </p>

                <div className="mt-4 rounded-lg bg-zinc-900 p-3 font-mono text-sm text-amber-400 select-all break-all">
                  {newKeyResult}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setIsKeyModalOpen(false);
                      setNewKeyResult(null);
                    }}
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                  >
                    I have saved my key
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateApiKey}>
                <h3 className="text-lg font-bold text-zinc-900">Generate New API Key</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  Create a secure token with defined scopes for programmatic backend access.
                </p>

                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700">Token Name *</label>
                    <input
                      type="text"
                      required
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="e.g. ERP Invoicing Sync"
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700">Rate Limit (Requests per min)</label>
                    <input
                      type="number"
                      value={keyRateLimit}
                      onChange={(e) => setKeyRateLimit(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700">Expiration Date (Optional)</label>
                    <input
                      type="date"
                      value={keyExpiresAt}
                      onChange={(e) => setKeyExpiresAt(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-2">Access Scopes</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                      {AVAILABLE_SCOPES.map((sc) => {
                        const checked = keyScopes.includes(sc.key);
                        return (
                          <label key={sc.key} className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setKeyScopes([...keyScopes, sc.key]);
                                } else {
                                  setKeyScopes(keyScopes.filter((k) => k !== sc.key));
                                }
                              }}
                              className="rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
                            />
                            <span>{sc.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsKeyModalOpen(false)}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                  >
                    Create Key
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: New Webhook */}
      {isWebhookModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <form onSubmit={handleCreateWebhook}>
              <h3 className="text-lg font-bold text-zinc-900">Add Webhook Subscription</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Register an HTTPS destination endpoint for signed JSON events.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Webhook Name *</label>
                  <input
                    type="text"
                    required
                    value={webhookName}
                    onChange={(e) => setWebhookName(e.target.value)}
                    placeholder="e.g. Accounting System Webhook"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Endpoint URL (HTTPS) *</label>
                  <input
                    type="url"
                    required
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://api.mycorp.com/sevents-webhook"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-2">Events to Subscribe</label>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 p-2">
                    {AVAILABLE_EVENTS.map((ev) => {
                      const checked = webhookEvents.includes(ev.key);
                      return (
                        <label key={ev.key} className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setWebhookEvents([...webhookEvents, ev.key]);
                              } else {
                                setWebhookEvents(webhookEvents.filter((k) => k !== ev.key));
                              }
                            }}
                            className="rounded border-zinc-300 text-amber-500 focus:ring-amber-400"
                          />
                          <span>{ev.label} ({ev.key})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWebhookModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                >
                  Register Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Configure Connector */}
      {isConnectorModalOpen && selectedConnector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <form onSubmit={handleSaveConnector}>
              <h3 className="text-lg font-bold text-zinc-900">Configure {selectedConnector.name}</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Enter API credentials and select synchronization profile.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Environment</label>
                  <select
                    value={connectorEnv}
                    onChange={(e) => setConnectorEnv(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="sandbox">Sandbox / Staging</option>
                    <option value="production">Production Live</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Client / API Key *</label>
                  <input
                    type="text"
                    required
                    value={connectorAuthKey}
                    onChange={(e) => setConnectorAuthKey(e.target.value)}
                    placeholder="Enter Client ID or API Key"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700">Client Secret / Private Key *</label>
                  <input
                    type="password"
                    required
                    value={connectorSecret}
                    onChange={(e) => setConnectorSecret(e.target.value)}
                    placeholder="Enter Secret Key"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsConnectorModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
                >
                  Save &amp; Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Inspect Webhook Delivery */}
      {inspectDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900">Webhook Delivery Inspection</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Delivery event <span className="font-mono">{inspectDelivery.id}</span>
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold text-zinc-700">Dispatched Payload</p>
                <pre className="mt-1 max-h-48 overflow-y-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs text-amber-300">
                  {JSON.stringify(inspectDelivery.payload, null, 2)}
                </pre>
              </div>

              <div>
                <p className="text-xs font-semibold text-zinc-700">Endpoint Response</p>
                <pre className="mt-1 max-h-32 overflow-y-auto rounded-lg bg-zinc-100 p-3 font-mono text-xs text-zinc-800">
                  {inspectDelivery.response_body || "No response body recorded"}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setInspectDelivery(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
