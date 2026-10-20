import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { UserPicker } from "../components/UserPicker";
import { PermissionGate } from "../components/PermissionGate";

type OpportunityStage = "lead" | "qualified" | "site_visit" | "tender" | "negotiation" | "won" | "lost";

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

interface Opportunity {
  id: string;
  client_id: string;
  title: string;
  stage: OpportunityStage;
  expected_value: number | null;
  probability: number | null;
}

const STAGES: OpportunityStage[] = ["lead", "qualified", "site_visit", "tender", "negotiation", "won", "lost"];

const STAGE_LABELS: Record<OpportunityStage, string> = {
  lead: "Lead",
  qualified: "Qualified",
  site_visit: "Site visit",
  tender: "Tender",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

type Tab = "clients" | "contacts" | "pipeline";

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function CrmPage() {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>("clients");

  const [clients, setClients] = useState<Client[] | null>(null);
  const [clientSearch, setClientSearch] = useState("");

  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [contactSearch, setContactSearch] = useState("");

  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Client form
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientEditingId, setClientEditingId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientLicense, setClientLicense] = useState("");
  const [clientCountry, setClientCountry] = useState("");

  // Contact form
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactEditingId, setContactEditingId] = useState<string | null>(null);
  const [contactClientId, setContactClientId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactIsPrimary, setContactIsPrimary] = useState(false);

  // Opportunity form
  const [showOpportunityForm, setShowOpportunityForm] = useState(false);
  const [opportunityEditingId, setOpportunityEditingId] = useState<string | null>(null);
  const [opportunityClientId, setOpportunityClientId] = useState("");
  const [opportunityTitle, setOpportunityTitle] = useState("");
  const [opportunitySource, setOpportunitySource] = useState("");
  const [opportunityOwnerId, setOpportunityOwnerId] = useState("");
  const [opportunityExpectedValue, setOpportunityExpectedValue] = useState("");
  const [opportunityProbability, setOpportunityProbability] = useState("");

  function resolveClientName(clientId: string): string {
    return clients?.find((c) => c.id === clientId)?.name ?? clientId;
  }

  function loadClients() {
    if (!session) return;
    const query = clientSearch.trim() ? `?search=${encodeURIComponent(clientSearch.trim())}` : "";
    apiFetch<{ clients: Client[] }>(`/crm/clients${query}`, session.access_token)
      .then((data) => setClients(data.clients))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(() => {
    if (!session) return;
    apiFetch<{ clients: Client[] }>("/crm/clients", session.access_token)
      .then((data) => setClients(data.clients))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  useEffect(() => {
    if (!session || tab !== "clients") return;
    if (clients !== null && !clientSearch.trim()) return;
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab, clientSearch]);

  function loadContacts() {
    if (!session) return;
    const query = contactSearch.trim() ? `?search=${encodeURIComponent(contactSearch.trim())}` : "";
    apiFetch<{ contacts: Contact[] }>(`/crm/contacts${query}`, session.access_token)
      .then((data) => setContacts(data.contacts))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(() => {
    if (!session || tab !== "contacts") return;
    if (contacts !== null && !contactSearch.trim()) return;
    loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab, contactSearch]);

  function loadOpportunities() {
    if (!session) return;
    apiFetch<{ opportunities: Opportunity[] }>("/crm/opportunities", session.access_token)
      .then((data) => setOpportunities(data.opportunities))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(() => {
    if (tab === "pipeline") {
      if (opportunities !== null) return;
      loadOpportunities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab]);

  async function moveStage(opportunityId: string, stage: OpportunityStage) {
    if (!session) return;
    setActionError(null);
    try {
      await apiFetch(`/crm/opportunities/${opportunityId}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ stage }),
      });
      loadOpportunities();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not move this opportunity");
    }
  }

  function startClientCreate() {
    setClientEditingId(null);
    setClientName("");
    setClientLicense("");
    setClientCountry("");
    setShowClientForm(true);
  }

  function startClientEdit(client: Client) {
    setClientEditingId(client.id);
    setClientName(client.name);
    setClientLicense(client.trade_license_number ?? "");
    setClientCountry(client.registration_country ?? "");
    setShowClientForm(true);
  }

  async function handleSaveClient(event: FormEvent) {
    event.preventDefault();
    if (!session || !clientName.trim()) return;
    setActionError(null);
    try {
      if (clientEditingId) {
        await apiFetch(`/crm/clients/${clientEditingId}`, session.access_token, {
          method: "PATCH",
          body: JSON.stringify({
            name: clientName.trim(),
            tradeLicenseNumber: clientLicense.trim() || null,
            registrationCountry: clientCountry.trim() || null,
          }),
        });
      } else {
        await apiFetch("/crm/clients", session.access_token, {
          method: "POST",
          body: JSON.stringify({
            name: clientName.trim(),
            tradeLicenseNumber: clientLicense.trim() || undefined,
            registrationCountry: clientCountry.trim() || undefined,
          }),
        });
      }
      setShowClientForm(false);
      loadClients();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not save the client");
    }
  }

  function startContactCreate() {
    setContactEditingId(null);
    setContactClientId("");
    setContactName("");
    setContactTitle("");
    setContactEmail("");
    setContactPhone("");
    setContactIsPrimary(false);
    setShowContactForm(true);
  }

  function startContactEdit(contact: Contact) {
    setContactEditingId(contact.id);
    setContactClientId(contact.client_id);
    setContactName(contact.name);
    setContactTitle(contact.title ?? "");
    setContactEmail(contact.email ?? "");
    setContactPhone(contact.phone ?? "");
    setContactIsPrimary(contact.is_primary);
    setShowContactForm(true);
  }

  async function handleSaveContact(event: FormEvent) {
    event.preventDefault();
    if (!session || !contactName.trim()) return;
    setActionError(null);
    try {
      if (contactEditingId) {
        await apiFetch(`/crm/contacts/${contactEditingId}`, session.access_token, {
          method: "PATCH",
          body: JSON.stringify({
            name: contactName.trim(),
            title: contactTitle.trim() || null,
            email: contactEmail.trim() || null,
            phone: contactPhone.trim() || null,
            isPrimary: contactIsPrimary,
          }),
        });
      } else {
        if (!contactClientId) {
          setActionError("Select a client for this contact.");
          return;
        }
        await apiFetch(`/crm/clients/${contactClientId}/contacts`, session.access_token, {
          method: "POST",
          body: JSON.stringify({
            name: contactName.trim(),
            title: contactTitle.trim() || undefined,
            email: contactEmail.trim() || undefined,
            phone: contactPhone.trim() || undefined,
            isPrimary: contactIsPrimary,
          }),
        });
      }
      setShowContactForm(false);
      loadContacts();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not save the contact");
    }
  }

  function startOpportunityCreate() {
    setOpportunityEditingId(null);
    setOpportunityClientId("");
    setOpportunityTitle("");
    setOpportunitySource("");
    setOpportunityOwnerId("");
    setOpportunityExpectedValue("");
    setOpportunityProbability("");
    setShowOpportunityForm(true);
  }

  function startOpportunityEdit(opportunity: Opportunity) {
    setOpportunityEditingId(opportunity.id);
    setOpportunityClientId(opportunity.client_id);
    setOpportunityTitle(opportunity.title);
    setOpportunityOwnerId("");
    setOpportunityExpectedValue(opportunity.expected_value !== null ? String(opportunity.expected_value) : "");
    setOpportunityProbability(opportunity.probability !== null ? String(opportunity.probability) : "");
    setShowOpportunityForm(true);
  }

  async function handleSaveOpportunity(event: FormEvent) {
    event.preventDefault();
    if (!session || !opportunityTitle.trim()) return;
    setActionError(null);
    try {
      if (opportunityEditingId) {
        await apiFetch(`/crm/opportunities/${opportunityEditingId}`, session.access_token, {
          method: "PATCH",
          body: JSON.stringify({
            ...(opportunityOwnerId ? { ownerId: opportunityOwnerId } : {}),
            expectedValue: opportunityExpectedValue ? Number(opportunityExpectedValue) : null,
            probability: opportunityProbability ? Number(opportunityProbability) : null,
          }),
        });
      } else {
        if (!opportunityClientId || !opportunitySource.trim() || !opportunityOwnerId) {
          setActionError("Client, source and BD owner are required.");
          return;
        }
        await apiFetch("/crm/opportunities", session.access_token, {
          method: "POST",
          body: JSON.stringify({
            clientId: opportunityClientId,
            title: opportunityTitle.trim(),
            source: opportunitySource.trim(),
            ownerId: opportunityOwnerId,
            expectedValue: opportunityExpectedValue ? Number(opportunityExpectedValue) : undefined,
            probability: opportunityProbability ? Number(opportunityProbability) : undefined,
          }),
        });
      }
      setShowOpportunityForm(false);
      loadOpportunities();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not save the opportunity");
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition ${
      active ? "bg-brand text-zinc-900" : "text-zinc-500 hover:bg-stone-100"
    }`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Clients &amp; CRM</h1>
        <p className="mt-1 text-sm text-zinc-400">Clients, contacts and the sales pipeline</p>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex gap-2">
        <button onClick={() => setTab("clients")} className={tabClass(tab === "clients")}>
          Clients
        </button>
        <button onClick={() => setTab("contacts")} className={tabClass(tab === "contacts")}>
          Contacts
        </button>
        <button onClick={() => setTab("pipeline")} className={tabClass(tab === "pipeline")}>
          Pipeline
        </button>
      </div>

      {tab === "clients" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Search clients by name"
              className={`w-full max-w-sm ${inputClass}`}
            />
            <PermissionGate permission="crm.lead.manage">
              <button
                onClick={startClientCreate}
                className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
              >
                New client
              </button>
            </PermissionGate>
          </div>

          {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

          {showClientForm && (
            <form onSubmit={handleSaveClient} className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm sm:grid-cols-3">
              <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client name" className={inputClass} />
              <input value={clientLicense} onChange={(e) => setClientLicense(e.target.value)} placeholder="Trade license number" className={inputClass} />
              <input value={clientCountry} onChange={(e) => setClientCountry(e.target.value)} placeholder="Registration country" className={inputClass} />
              <div className="col-span-full flex gap-2">
                <button type="submit" disabled={!clientName.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50">
                  {clientEditingId ? "Save" : "Add client"}
                </button>
                <button type="button" onClick={() => setShowClientForm(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {clients?.length === 0 && <p className="text-sm text-zinc-400">No clients found.</p>}
          {clients && clients.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Trade license</th>
                    <th className="px-6 py-3">Registration country</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                      <td className="px-6 py-4 font-medium text-zinc-800">
                        <Link to={`/crm/clients/${c.id}`} className="hover:text-amber-600 hover:underline">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-zinc-600">{c.trade_license_number ?? "—"}</td>
                      <td className="px-6 py-4 text-zinc-600">{c.registration_country ?? "—"}</td>
                      <td className="px-6 py-4 text-right">
                        <PermissionGate permission="crm.lead.manage">
                          <button onClick={() => startClientEdit(c)} className="text-xs text-zinc-400 hover:text-brand-dim">
                            Edit
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <input
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search contacts by name, email or phone"
              className={`w-full max-w-sm ${inputClass}`}
            />
            <PermissionGate permission="crm.lead.manage">
              <button
                onClick={startContactCreate}
                className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
              >
                New contact
              </button>
            </PermissionGate>
          </div>

          {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

          {showContactForm && (
            <form onSubmit={handleSaveContact} className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm sm:grid-cols-3">
              {!contactEditingId && (
                <select value={contactClientId} onChange={(e) => setContactClientId(e.target.value)} className={inputClass}>
                  <option value="">Select client…</option>
                  {clients?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" className={inputClass} />
              <input value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} placeholder="Title" className={inputClass} />
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className={inputClass} />
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone" className={inputClass} />
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input type="checkbox" checked={contactIsPrimary} onChange={(e) => setContactIsPrimary(e.target.checked)} />
                Primary contact
              </label>
              <div className="col-span-full flex gap-2">
                <button type="submit" disabled={!contactName.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50">
                  {contactEditingId ? "Save" : "Add contact"}
                </button>
                <button type="button" onClick={() => setShowContactForm(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {contacts?.length === 0 && <p className="text-sm text-zinc-400">No contacts found.</p>}
          {contacts && contacts.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Phone</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact) => (
                    <tr key={contact.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                      <td className="px-6 py-4 font-medium text-zinc-800">
                        {contact.name}
                        {contact.is_primary && (
                          <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-dim">
                            Primary
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-zinc-600">{resolveClientName(contact.client_id)}</td>
                      <td className="px-6 py-4 text-zinc-600">{contact.email ?? "—"}</td>
                      <td className="px-6 py-4 text-zinc-600">{contact.phone ?? "—"}</td>
                      <td className="px-6 py-4 text-right">
                        <PermissionGate permission="crm.lead.manage">
                          <button onClick={() => startContactEdit(contact)} className="text-xs text-zinc-400 hover:text-brand-dim">
                            Edit
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "pipeline" && (
        <div className="space-y-4">
          <PermissionGate permission="crm.lead.manage">
            <div className="flex justify-end">
              <button
                onClick={startOpportunityCreate}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-brand-dim"
              >
                New opportunity
              </button>
            </div>
          </PermissionGate>

          {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}

          {showOpportunityForm && (
            <form onSubmit={handleSaveOpportunity} className="grid grid-cols-1 gap-2 rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm sm:grid-cols-3">
              {!opportunityEditingId && (
                <>
                  <select value={opportunityClientId} onChange={(e) => setOpportunityClientId(e.target.value)} className={inputClass}>
                    <option value="">Select client…</option>
                    {clients?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <input value={opportunitySource} onChange={(e) => setOpportunitySource(e.target.value)} placeholder="Source" className={inputClass} />
                </>
              )}
              <input value={opportunityTitle} onChange={(e) => setOpportunityTitle(e.target.value)} placeholder="Opportunity title" className={inputClass} />
              <UserPicker value={opportunityOwnerId} onChange={setOpportunityOwnerId} placeholder="BD owner…" />
              <input
                type="number"
                value={opportunityExpectedValue}
                onChange={(e) => setOpportunityExpectedValue(e.target.value)}
                placeholder="Estimated value"
                className={inputClass}
              />
              <input
                type="number"
                min={0}
                max={100}
                value={opportunityProbability}
                onChange={(e) => setOpportunityProbability(e.target.value)}
                placeholder="Probability %"
                className={inputClass}
              />
              <div className="col-span-full flex gap-2">
                <button type="submit" disabled={!opportunityTitle.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50">
                  {opportunityEditingId ? "Save" : "Add opportunity"}
                </button>
                <button type="button" onClick={() => setShowOpportunityForm(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {opportunities?.length === 0 && <p className="text-sm text-zinc-400">No opportunities yet.</p>}
          {opportunities && opportunities.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {STAGES.map((stage) => {
                const items = opportunities.filter((o) => o.stage === stage);
                return (
                  <div key={stage} className="w-64 shrink-0 rounded-2xl border border-zinc-100 bg-white shadow-sm">
                    <div className="border-b border-zinc-100 px-4 py-3">
                      <h2 className="font-brand text-sm font-semibold text-zinc-900">
                        {STAGE_LABELS[stage]} <span className="text-xs font-normal text-zinc-400">({items.length})</span>
                      </h2>
                    </div>
                    <div className="space-y-2 p-3">
                      {items.map((opp) => (
                        <div key={opp.id} className="rounded-xl border border-zinc-100 bg-stone-50 p-3 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <Link to={`/crm/opportunities/${opp.id}`} className="font-medium text-zinc-800 hover:text-brand-dim">
                              {opp.title}
                            </Link>
                            <PermissionGate permission="crm.lead.manage">
                              <button onClick={() => startOpportunityEdit(opp)} className="shrink-0 text-xs text-zinc-400 hover:text-brand-dim">
                                Edit
                              </button>
                            </PermissionGate>
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-400">{resolveClientName(opp.client_id)}</p>
                          {opp.expected_value !== null && (
                            <p className="mt-1 text-xs text-zinc-600">{opp.expected_value.toLocaleString()}</p>
                          )}
                          <select
                            value={opp.stage}
                            onChange={(e) => moveStage(opp.id, e.target.value as OpportunityStage)}
                            className="mt-2 w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {STAGE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
