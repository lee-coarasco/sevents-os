import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { UserPicker } from "../components/UserPicker";
import { PermissionGate } from "../components/PermissionGate";

interface Client {
  id: string;
  name: string;
  trade_license_number: string | null;
  registration_country: string | null;
}

interface Contact {
  id: string;
  client_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

type OpportunityStage = "lead" | "qualified" | "site_visit" | "tender" | "negotiation" | "won" | "lost";

interface Opportunity {
  id: string;
  client_id: string;
  title: string;
  source: string;
  owner_id: string;
  stage: OpportunityStage;
  expected_value: number | null;
  probability: number | null;
}

interface ClientCommunication {
  id: string;
  client_id: string;
  channel: "email" | "phone" | "meeting" | "letter";
  summary: string;
  occurred_at: string;
}

const STAGE_LABELS: Record<OpportunityStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  site_visit: "Site visit",
  tender: "Tender",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function CrmClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();

  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [communications, setCommunications] = useState<ClientCommunication[]>([]);

  const [tab, setTab] = useState<"contacts" | "opportunities" | "communications">("contacts");
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Edit Client Form state
  const [editingClient, setEditingClient] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientLicense, setClientLicense] = useState("");
  const [clientCountry, setClientCountry] = useState("");
  const [savingClient, setSavingClient] = useState(false);

  // Add Contact Form state
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactIsPrimary, setContactIsPrimary] = useState(false);

  // Add Opportunity Form state
  const [showOppForm, setShowOppForm] = useState(false);
  const [oppTitle, setOppTitle] = useState("");
  const [oppSource, setOppSource] = useState("");
  const [oppOwnerId, setOppOwnerId] = useState("");
  const [oppExpectedValue, setOppExpectedValue] = useState("");
  const [oppProbability, setOppProbability] = useState("");

  // Add Communication Form state
  const [showCommForm, setShowCommForm] = useState(false);
  const [commChannel, setCommChannel] = useState<"email" | "phone" | "meeting" | "letter">("phone");
  const [commSummary, setCommSummary] = useState("");
  const [commDate, setCommDate] = useState(() => new Date().toISOString().slice(0, 10));

  function loadClient() {
    if (!session || !id) return;
    setError(null);
    apiFetch<{ client: Client }>(`/crm/clients/${id}`, session.access_token)
      .then((data) => {
        setClient(data.client);
        setClientName(data.client.name);
        setClientLicense(data.client.trade_license_number ?? "");
        setClientCountry(data.client.registration_country ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load client details"));

    loadContacts();
    loadOpportunities();
    loadCommunications();
  }

  function loadContacts() {
    if (!session || !id) return;
    apiFetch<{ contacts: Contact[] }>(`/crm/clients/${id}/contacts`, session.access_token)
      .then((data) => setContacts(data.contacts ?? []))
      .catch(() => {});
  }

  function loadOpportunities() {
    if (!session || !id) return;
    apiFetch<{ opportunities: Opportunity[] }>("/crm/opportunities", session.access_token)
      .then((data) => {
        const clientOpps = (data.opportunities ?? []).filter((o) => o.client_id === id);
        setOpportunities(clientOpps);
      })
      .catch(() => {});
  }

  function loadCommunications() {
    if (!session || !id) return;
    apiFetch<{ clientCommunications: ClientCommunication[] }>(
      `/crm/client-communications?clientId=${id}`,
      session.access_token,
    )
      .then((data) => setCommunications(data.clientCommunications ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    loadClient();
  }, [session, id]);

  async function handleSaveClient(e: FormEvent) {
    e.preventDefault();
    if (!session || !id || !clientName.trim()) return;
    setSavingClient(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await apiFetch<{ client: Client }>(`/crm/clients/${id}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({
          name: clientName.trim(),
          tradeLicenseNumber: clientLicense.trim() || null,
          registrationCountry: clientCountry.trim() || null,
        }),
      });
      setClient(res.client);
      setEditingClient(false);
      setActionSuccess("Client profile updated successfully");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update client");
    } finally {
      setSavingClient(false);
    }
  }

  async function handleAddContact(e: FormEvent) {
    e.preventDefault();
    if (!session || !id || !contactName.trim()) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiFetch(`/crm/clients/${id}/contacts`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          name: contactName.trim(),
          title: contactTitle.trim() || null,
          email: contactEmail.trim() || null,
          phone: contactPhone.trim() || null,
          isPrimary: contactIsPrimary,
        }),
      });
      setShowContactForm(false);
      setContactName("");
      setContactTitle("");
      setContactEmail("");
      setContactPhone("");
      setContactIsPrimary(false);
      setActionSuccess("Contact added successfully");
      loadContacts();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not add contact");
    }
  }

  async function handleAddOpportunity(e: FormEvent) {
    e.preventDefault();
    if (!session || !id || !oppTitle.trim() || !oppSource.trim() || !oppOwnerId) {
      setActionError("Title, source and BD owner are required.");
      return;
    }
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiFetch("/crm/opportunities", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          clientId: id,
          title: oppTitle.trim(),
          source: oppSource.trim(),
          ownerId: oppOwnerId,
          expectedValue: oppExpectedValue ? Number(oppExpectedValue) : undefined,
          probability: oppProbability ? Number(oppProbability) : undefined,
        }),
      });
      setShowOppForm(false);
      setOppTitle("");
      setOppSource("");
      setOppOwnerId("");
      setOppExpectedValue("");
      setOppProbability("");
      setActionSuccess("Opportunity created successfully");
      loadOpportunities();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not create opportunity");
    }
  }

  async function handleAddCommunication(e: FormEvent) {
    e.preventDefault();
    if (!session || !id || !commSummary.trim() || !commDate) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await apiFetch("/crm/client-communications", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          clientId: id,
          channel: commChannel,
          summary: commSummary.trim(),
          occurredAt: new Date(commDate).toISOString(),
        }),
      });
      setShowCommForm(false);
      setCommSummary("");
      setActionSuccess("Communication log added");
      loadCommunications();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not log communication");
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? "bg-brand text-zinc-900 font-semibold" : "text-zinc-500 hover:bg-stone-100"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/crm" className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Back to CRM &amp; Pipeline
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!client && !error && <p className="text-sm text-zinc-400">Loading client details…</p>}

      {client && (
        <>
          {/* Header Card */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="font-brand text-2xl font-bold text-zinc-900">{client.name}</h1>
                <p className="mt-1 text-xs text-zinc-400">
                  Trade License: <span className="font-semibold text-zinc-700">{client.trade_license_number ?? "—"}</span>
                  {" "}&bull; Country: <span className="font-semibold text-zinc-700">{client.registration_country ?? "—"}</span>
                </p>
              </div>

              <PermissionGate permission="crm.lead.manage">
                <button
                  onClick={() => setEditingClient((prev) => !prev)}
                  className="rounded-lg border border-zinc-200 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition"
                >
                  {editingClient ? "Close Edit" : "Edit Details"}
                </button>
              </PermissionGate>
            </div>

            {editingClient && (
              <form onSubmit={handleSaveClient} className="mt-6 pt-6 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Client name"
                  required
                  className={inputClass}
                />
                <input
                  value={clientLicense}
                  onChange={(e) => setClientLicense(e.target.value)}
                  placeholder="Trade License number"
                  className={inputClass}
                />
                <input
                  value={clientCountry}
                  onChange={(e) => setClientCountry(e.target.value)}
                  placeholder="Registration country"
                  className={inputClass}
                />
                <div className="sm:col-span-3 flex gap-2">
                  <button
                    type="submit"
                    disabled={savingClient || !clientName.trim()}
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                  >
                    {savingClient ? "Saving…" : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingClient(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <dl className="mt-6 grid grid-cols-3 gap-4 pt-4 border-t border-zinc-100 text-xs">
              <div>
                <dt className="font-semibold uppercase tracking-wide text-zinc-400">Contacts</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">{contacts.length}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-zinc-400">Opportunities</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">{opportunities.length}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wide text-zinc-400">Total Pipeline Value</dt>
                <dd className="mt-1 text-sm font-medium text-zinc-800">
                  AED {opportunities.reduce((sum, o) => sum + (o.expected_value ?? 0), 0).toLocaleString()}
                </dd>
              </div>
            </dl>
          </div>

          {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
          {actionSuccess && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionSuccess}</div>}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-zinc-200 pb-2">
            <button onClick={() => setTab("contacts")} className={tabClass(tab === "contacts")}>
              Contacts ({contacts.length})
            </button>
            <button onClick={() => setTab("opportunities")} className={tabClass(tab === "opportunities")}>
              Opportunities ({opportunities.length})
            </button>
            <button onClick={() => setTab("communications")} className={tabClass(tab === "communications")}>
              Communications ({communications.length})
            </button>
          </div>

          {/* Tab 1: Contacts */}
          {tab === "contacts" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <PermissionGate permission="crm.lead.manage">
                  <button
                    onClick={() => setShowContactForm((prev) => !prev)}
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim"
                  >
                    {showContactForm ? "Cancel" : "Add Contact"}
                  </button>
                </PermissionGate>
              </div>

              {showContactForm && (
                <form onSubmit={handleAddContact} className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Full name *"
                    required
                    className={inputClass}
                  />
                  <input
                    value={contactTitle}
                    onChange={(e) => setContactTitle(e.target.value)}
                    placeholder="Job title / Designation"
                    className={inputClass}
                  />
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="Email address"
                    className={inputClass}
                  />
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Phone number"
                    className={inputClass}
                  />
                  <label className="flex items-center gap-2 text-xs text-zinc-600 sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={contactIsPrimary}
                      onChange={(e) => setContactIsPrimary(e.target.checked)}
                      className="rounded border-zinc-300 text-brand focus:ring-brand"
                    />
                    Primary Point of Contact for this account
                  </label>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={!contactName.trim()}
                      className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                    >
                      Save Contact
                    </button>
                  </div>
                </form>
              )}

              {contacts.length === 0 ? (
                <p className="text-sm text-zinc-400">No contacts recorded for this client.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Designation</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">Phone</th>
                        <th className="px-6 py-3">Primary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((c) => (
                        <tr key={c.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                          <td className="px-6 py-4 font-medium text-zinc-800">{c.name}</td>
                          <td className="px-6 py-4 text-zinc-600">{c.title ?? "—"}</td>
                          <td className="px-6 py-4 text-zinc-600">{c.email ?? "—"}</td>
                          <td className="px-6 py-4 text-zinc-600">{c.phone ?? "—"}</td>
                          <td className="px-6 py-4">
                            {c.is_primary ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                Primary
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Opportunities */}
          {tab === "opportunities" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <PermissionGate permission="crm.lead.manage">
                  <button
                    onClick={() => setShowOppForm((prev) => !prev)}
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim"
                  >
                    {showOppForm ? "Cancel" : "New Opportunity"}
                  </button>
                </PermissionGate>
              </div>

              {showOppForm && (
                <form onSubmit={handleAddOpportunity} className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={oppTitle}
                    onChange={(e) => setOppTitle(e.target.value)}
                    placeholder="Opportunity title *"
                    required
                    className={`sm:col-span-2 ${inputClass}`}
                  />
                  <input
                    value={oppSource}
                    onChange={(e) => setOppSource(e.target.value)}
                    placeholder="Lead Source (e.g. Referral, Tender board) *"
                    required
                    className={inputClass}
                  />
                  <div>
                    <UserPicker
                      value={oppOwnerId}
                      onChange={setOppOwnerId}
                      placeholder="Pick BD Owner *"
                      className="w-full"
                    />
                  </div>
                  <input
                    type="number"
                    value={oppExpectedValue}
                    onChange={(e) => setOppExpectedValue(e.target.value)}
                    placeholder="Expected value (AED)"
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={oppProbability}
                    onChange={(e) => setOppProbability(e.target.value)}
                    placeholder="Probability (0-100%)"
                    className={inputClass}
                  />
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={!oppTitle.trim() || !oppSource.trim() || !oppOwnerId}
                      className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                    >
                      Create Opportunity
                    </button>
                  </div>
                </form>
              )}

              {opportunities.length === 0 ? (
                <p className="text-sm text-zinc-400">No opportunities created for this client yet.</p>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                        <th className="px-6 py-3">Title</th>
                        <th className="px-6 py-3">Stage</th>
                        <th className="px-6 py-3">Expected Value</th>
                        <th className="px-6 py-3">Probability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {opportunities.map((o) => (
                        <tr key={o.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                          <td className="px-6 py-4 font-medium text-zinc-800">
                            <Link to={`/crm/opportunities/${o.id}`} className="hover:text-amber-600 hover:underline">
                              {o.title}
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-dim">
                              {STAGE_LABELS[o.stage]}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-zinc-600">
                            {o.expected_value !== null ? `AED ${o.expected_value.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-6 py-4 text-zinc-600">
                            {o.probability !== null ? `${o.probability}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Communications */}
          {tab === "communications" && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <PermissionGate permission="crm.lead.manage">
                  <button
                    onClick={() => setShowCommForm((prev) => !prev)}
                    className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim"
                  >
                    {showCommForm ? "Cancel" : "Log Communication"}
                  </button>
                </PermissionGate>
              </div>

              {showCommForm && (
                <form onSubmit={handleAddCommunication} className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                        Channel
                      </label>
                      <select
                        value={commChannel}
                        onChange={(e) => setCommChannel(e.target.value as "email" | "phone" | "meeting" | "letter")}
                        className={`w-full ${inputClass}`}
                      >
                        <option value="phone">Phone Call</option>
                        <option value="meeting">In-Person / Virtual Meeting</option>
                        <option value="email">Email</option>
                        <option value="letter">Official Letter</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={commDate}
                        onChange={(e) => setCommDate(e.target.value)}
                        required
                        className={`w-full ${inputClass}`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
                      Summary &amp; Discussion Notes
                    </label>
                    <textarea
                      value={commSummary}
                      onChange={(e) => setCommSummary(e.target.value)}
                      rows={3}
                      placeholder="Discussed scope revision and site access schedule…"
                      required
                      className={`w-full ${inputClass}`}
                    />
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={!commSummary.trim() || !commDate}
                      className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                    >
                      Save Communication
                    </button>
                  </div>
                </form>
              )}

              {communications.length === 0 ? (
                <p className="text-sm text-zinc-400">No communication logs recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {communications.map((comm) => (
                    <div key={comm.id} className="rounded-xl border border-zinc-100 bg-white p-4 shadow-sm text-sm">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-700">
                          {comm.channel}
                        </span>
                        <span className="text-xs text-zinc-400">{comm.occurred_at ? comm.occurred_at.slice(0, 10) : "—"}</span>
                      </div>
                      <p className="mt-2 text-zinc-800 whitespace-pre-wrap">{comm.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
