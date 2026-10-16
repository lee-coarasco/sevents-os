import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";

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

  function clientName(clientId: string): string {
    return clients?.find((c) => c.id === clientId)?.name ?? clientId;
  }

  useEffect(() => {
    if (!session) return;
    apiFetch<{ clients: Client[] }>("/crm/clients", session.access_token)
      .then((data) => setClients(data.clients))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session]);

  useEffect(() => {
    if (!session || tab !== "clients") return;
    const query = clientSearch.trim() ? `?search=${encodeURIComponent(clientSearch.trim())}` : "";
    apiFetch<{ clients: Client[] }>(`/crm/clients${query}`, session.access_token)
      .then((data) => setClients(data.clients))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session, tab, clientSearch]);

  useEffect(() => {
    if (!session || tab !== "contacts") return;
    const query = contactSearch.trim() ? `?search=${encodeURIComponent(contactSearch.trim())}` : "";
    apiFetch<{ contacts: Contact[] }>(`/crm/contacts${query}`, session.access_token)
      .then((data) => setContacts(data.contacts))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }, [session, tab, contactSearch]);

  function loadOpportunities() {
    if (!session) return;
    apiFetch<{ opportunities: Opportunity[] }>("/crm/opportunities", session.access_token)
      .then((data) => setOpportunities(data.opportunities))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
  }

  useEffect(() => {
    if (tab === "pipeline") loadOpportunities();
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
          <input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Search clients by name"
            className="w-full max-w-sm rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {clients?.length === 0 && <p className="text-sm text-zinc-400">No clients found.</p>}
          {clients && clients.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    <th className="px-6 py-3">Client</th>
                    <th className="px-6 py-3">Trade license</th>
                    <th className="px-6 py-3">Registration country</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-50 last:border-0 hover:bg-stone-50">
                      <td className="px-6 py-4 font-medium text-zinc-800">{c.name}</td>
                      <td className="px-6 py-4 text-zinc-600">{c.trade_license_number ?? "—"}</td>
                      <td className="px-6 py-4 text-zinc-600">{c.registration_country ?? "—"}</td>
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
          <input
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            placeholder="Search contacts by name, email or phone"
            className="w-full max-w-sm rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
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
                      <td className="px-6 py-4 text-zinc-600">{clientName(contact.client_id)}</td>
                      <td className="px-6 py-4 text-zinc-600">{contact.email ?? "—"}</td>
                      <td className="px-6 py-4 text-zinc-600">{contact.phone ?? "—"}</td>
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
          {actionError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{actionError}</div>}
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
                          <p className="font-medium text-zinc-800">{opp.title}</p>
                          <p className="mt-0.5 text-xs text-zinc-400">{clientName(opp.client_id)}</p>
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
