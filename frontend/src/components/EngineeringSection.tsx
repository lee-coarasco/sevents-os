import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "./PermissionGate";

type DesignBriefStatus = "draft" | "issued" | "superseded";
type RfiStatus = "open" | "responded" | "closed" | "cancelled";
type EngTab = "briefs" | "rfis" | "ifc" | "asbuilt";

interface DesignBrief {
  id: string;
  title: string;
  discipline: string | null;
  scope_description: string | null;
  status: DesignBriefStatus;
  issued_by: string | null;
  issued_at: string | null;
  created_at: string;
}

interface Rfi {
  id: string;
  rfi_number: string;
  subject: string;
  description: string | null;
  status: RfiStatus;
  date_raised: string;
  date_required: string | null;
  date_responded: string | null;
  response: string | null;
}

interface IFCRegisterRow {
  document_id: string;
  document_number: string | null;
  title: string;
  discipline: string | null;
  revision_code: string | null;
  revision_status: string | null;
  approved_at: string | null;
  submitted: boolean;
}

interface AsBuiltRecord {
  id: string;
  document_id: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Document {
  id: string;
  document_number: string | null;
  title: string;
}

const TABS: { key: EngTab; label: string }[] = [
  { key: "briefs", label: "Design Briefs" },
  { key: "rfis", label: "RFIs" },
  { key: "ifc", label: "IFC Register" },
  { key: "asbuilt", label: "As-Built" },
];

const briefStatusColors: Record<DesignBriefStatus, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  issued: "bg-blue-50 text-blue-700",
  superseded: "bg-amber-50 text-amber-700",
};

const rfiStatusColors: Record<RfiStatus, string> = {
  open: "bg-blue-50 text-blue-700",
  responded: "bg-emerald-50 text-emerald-700",
  closed: "bg-zinc-100 text-zinc-500",
  cancelled: "bg-red-50 text-red-700",
};

const inputClass =
  "rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

export function EngineeringSection({ projectId, token }: { projectId: string; token: string }) {
  const [activeTab, setActiveTab] = useState<EngTab>("briefs");

  // --- Design Briefs ---
  const [briefs, setBriefs] = useState<DesignBrief[] | null>(null);
  const [briefsLoaded, setBriefsLoaded] = useState(false);
  const [briefsError, setBriefsError] = useState<string | null>(null);
  const [briefForm, setBriefForm] = useState(false);
  const [briefEditId, setBriefEditId] = useState<string | null>(null);
  const [briefTitle, setBriefTitle] = useState("");
  const [briefDiscipline, setBriefDiscipline] = useState("");
  const [briefScope, setBriefScope] = useState("");
  const [briefStatus, setBriefStatus] = useState<DesignBriefStatus>("draft");
  const [briefFormError, setBriefFormError] = useState<string | null>(null);

  // --- RFIs ---
  const [rfis, setRfis] = useState<Rfi[] | null>(null);
  const [rfisLoaded, setRfisLoaded] = useState(false);
  const [rfisError, setRfisError] = useState<string | null>(null);
  const [rfiForm, setRfiForm] = useState(false);
  const [rfiEditId, setRfiEditId] = useState<string | null>(null);
  const [rfiSubject, setRfiSubject] = useState("");
  const [rfiDesc, setRfiDesc] = useState("");
  const [rfiDateReq, setRfiDateReq] = useState("");
  const [rfiStatus, setRfiStatus] = useState<RfiStatus>("open");
  const [rfiResponse, setRfiResponse] = useState("");
  const [rfiDateResp, setRfiDateResp] = useState("");
  const [rfiFormError, setRfiFormError] = useState<string | null>(null);

  // --- IFC ---
  const [ifcRows, setIfcRows] = useState<IFCRegisterRow[] | null>(null);
  const [ifcLoaded, setIfcLoaded] = useState(false);
  const [ifcError, setIfcError] = useState<string | null>(null);

  // --- As-Built ---
  const [asBuilt, setAsBuilt] = useState<AsBuiltRecord[] | null>(null);
  const [asBuiltLoaded, setAsBuiltLoaded] = useState(false);
  const [asBuiltError, setAsBuiltError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [abForm, setAbForm] = useState(false);
  const [abEditId, setAbEditId] = useState<string | null>(null);
  const [abDocumentId, setAbDocumentId] = useState("");
  const [abNotes, setAbNotes] = useState("");
  const [abConfirmedBy, setAbConfirmedBy] = useState("");
  const [abConfirmedAt, setAbConfirmedAt] = useState("");
  const [abFormError, setAbFormError] = useState<string | null>(null);

  // Load data for active tab (lazy, once per tab)
  useEffect(() => {
    if (activeTab === "briefs" && !briefsLoaded) {
      apiFetch<{ designBriefs: DesignBrief[] }>(`/projects/${projectId}/design-briefs`, token)
        .then((r) => { setBriefs(r.designBriefs); setBriefsLoaded(true); })
        .catch((err) => setBriefsError(err instanceof ApiError ? err.message : "Could not load design briefs"));
    }
    if (activeTab === "rfis" && !rfisLoaded) {
      apiFetch<{ rfis: Rfi[] }>(`/projects/${projectId}/rfis`, token)
        .then((r) => { setRfis(r.rfis); setRfisLoaded(true); })
        .catch((err) => setRfisError(err instanceof ApiError ? err.message : "Could not load RFIs"));
    }
    if (activeTab === "ifc" && !ifcLoaded) {
      apiFetch<{ ifcRegister: IFCRegisterRow[] }>(`/projects/${projectId}/ifc-register`, token)
        .then((r) => { setIfcRows(r.ifcRegister); setIfcLoaded(true); })
        .catch((err) => setIfcError(err instanceof ApiError ? err.message : "Could not load IFC register"));
    }
    if (activeTab === "asbuilt" && !asBuiltLoaded) {
      Promise.all([
        apiFetch<{ asBuiltRecords: AsBuiltRecord[] }>(`/projects/${projectId}/as-built`, token),
        apiFetch<{ documents: Document[] }>(`/projects/${projectId}/documents`, token).catch(() => ({ documents: [] })),
      ]).then(([abData, docsData]) => {
        setAsBuilt(abData.asBuiltRecords);
        setDocuments(docsData.documents);
        setAsBuiltLoaded(true);
      }).catch((err) => setAsBuiltError(err instanceof ApiError ? err.message : "Could not load as-built records"));
    }
  }, [activeTab, projectId, token, briefsLoaded, rfisLoaded, ifcLoaded, asBuiltLoaded]);

  // --- Brief handlers ---
  function openBriefCreate() {
    setBriefEditId(null); setBriefTitle(""); setBriefDiscipline(""); setBriefScope("");
    setBriefStatus("draft"); setBriefFormError(null); setBriefForm(true);
  }

  function openBriefEdit(b: DesignBrief) {
    setBriefEditId(b.id); setBriefTitle(b.title); setBriefDiscipline(b.discipline ?? "");
    setBriefScope(b.scope_description ?? ""); setBriefStatus(b.status);
    setBriefFormError(null); setBriefForm(true);
  }

  async function handleSaveBrief(e: FormEvent) {
    e.preventDefault();
    if (!briefTitle.trim()) return;
    setBriefFormError(null);
    try {
      if (briefEditId) {
        await apiFetch(`/design-briefs/${briefEditId}`, token, {
          method: "PATCH",
          body: JSON.stringify({
            title: briefTitle.trim(),
            discipline: briefDiscipline.trim() || null,
            scopeDescription: briefScope.trim() || null,
            status: briefStatus,
          }),
        });
      } else {
        await apiFetch(`/projects/${projectId}/design-briefs`, token, {
          method: "POST",
          body: JSON.stringify({
            title: briefTitle.trim(),
            discipline: briefDiscipline.trim() || undefined,
            scopeDescription: briefScope.trim() || undefined,
          }),
        });
      }
      setBriefForm(false);
      setBriefsLoaded(false); // re-fetch
    } catch (err) {
      setBriefFormError(err instanceof ApiError ? err.message : "Could not save design brief");
    }
  }

  async function handleDeleteBrief(id: string) {
    if (!confirm("Delete this design brief?")) return;
    try {
      await apiFetch(`/design-briefs/${id}`, token, { method: "DELETE" });
      setBriefsLoaded(false);
    } catch (err) {
      setBriefsError(err instanceof ApiError ? err.message : "Could not delete");
    }
  }

  // --- RFI handlers ---
  function openRfiCreate() {
    setRfiEditId(null); setRfiSubject(""); setRfiDesc(""); setRfiDateReq("");
    setRfiStatus("open"); setRfiResponse(""); setRfiDateResp("");
    setRfiFormError(null); setRfiForm(true);
  }

  function openRfiEdit(r: Rfi) {
    setRfiEditId(r.id); setRfiSubject(r.subject); setRfiDesc(r.description ?? "");
    setRfiDateReq(r.date_required ?? ""); setRfiStatus(r.status);
    setRfiResponse(r.response ?? ""); setRfiDateResp(r.date_responded ?? "");
    setRfiFormError(null); setRfiForm(true);
  }

  async function handleSaveRfi(e: FormEvent) {
    e.preventDefault();
    if (!rfiSubject.trim()) return;
    setRfiFormError(null);
    try {
      if (rfiEditId) {
        await apiFetch(`/rfis/${rfiEditId}`, token, {
          method: "PATCH",
          body: JSON.stringify({
            subject: rfiSubject.trim(),
            description: rfiDesc.trim() || null,
            dateRequired: rfiDateReq || null,
            status: rfiStatus,
            response: rfiResponse.trim() || null,
            dateResponded: rfiDateResp || null,
          }),
        });
      } else {
        await apiFetch(`/projects/${projectId}/rfis`, token, {
          method: "POST",
          body: JSON.stringify({
            subject: rfiSubject.trim(),
            description: rfiDesc.trim() || undefined,
            dateRequired: rfiDateReq || undefined,
          }),
        });
      }
      setRfiForm(false);
      setRfisLoaded(false);
    } catch (err) {
      setRfiFormError(err instanceof ApiError ? err.message : "Could not save RFI");
    }
  }

  // --- As-built handlers ---
  function openAbCreate() {
    setAbEditId(null); setAbDocumentId(""); setAbNotes("");
    setAbConfirmedBy(""); setAbConfirmedAt("");
    setAbFormError(null); setAbForm(true);
  }

  function openAbEdit(r: AsBuiltRecord) {
    setAbEditId(r.id); setAbDocumentId(r.document_id); setAbNotes(r.notes ?? "");
    setAbConfirmedBy(r.confirmed_by ?? ""); setAbConfirmedAt(r.confirmed_at ? r.confirmed_at.slice(0, 10) : "");
    setAbFormError(null); setAbForm(true);
  }

  async function handleSaveAb(e: FormEvent) {
    e.preventDefault();
    if (!abDocumentId.trim()) return;
    setAbFormError(null);
    try {
      if (abEditId) {
        await apiFetch(`/as-built/${abEditId}`, token, {
          method: "PATCH",
          body: JSON.stringify({
            notes: abNotes.trim() || null,
            confirmedBy: abConfirmedBy.trim() || null,
            confirmedAt: abConfirmedAt || null,
          }),
        });
      } else {
        await apiFetch(`/projects/${projectId}/as-built`, token, {
          method: "POST",
          body: JSON.stringify({
            documentId: abDocumentId,
            notes: abNotes.trim() || undefined,
          }),
        });
      }
      setAbForm(false);
      setAsBuiltLoaded(false);
    } catch (err) {
      setAbFormError(err instanceof ApiError ? err.message : "Could not save as-built record");
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm">
      <div className="border-b border-zinc-100 px-6 py-4">
        <h2 className="font-brand text-base font-semibold text-zinc-900">Engineering</h2>
        <div className="mt-3 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeTab === t.key
                  ? "bg-brand text-zinc-900"
                  : "text-zinc-500 hover:bg-stone-50 hover:text-zinc-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* Design Briefs tab */}
        {activeTab === "briefs" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <PermissionGate permission="engineering.design_brief.manage">
                <button onClick={openBriefCreate} className="text-sm text-zinc-400 hover:text-brand-dim">
                  New brief
                </button>
              </PermissionGate>
            </div>

            {briefsError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{briefsError}</div>}

            {briefForm && (
              <form onSubmit={handleSaveBrief} className="space-y-2 rounded-xl bg-stone-50 p-4">
                {briefFormError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{briefFormError}</div>}
                <input
                  value={briefTitle} onChange={(e) => setBriefTitle(e.target.value)}
                  placeholder="Brief title*" className={`w-full ${inputClass}`} required
                />
                <input
                  value={briefDiscipline} onChange={(e) => setBriefDiscipline(e.target.value)}
                  placeholder="Discipline (e.g. Structural)" className={`w-full ${inputClass}`}
                />
                <textarea
                  value={briefScope} onChange={(e) => setBriefScope(e.target.value)}
                  placeholder="Scope description" rows={3} className={`w-full resize-none ${inputClass}`}
                />
                {briefEditId && (
                  <select value={briefStatus} onChange={(e) => setBriefStatus(e.target.value as DesignBriefStatus)} className={`w-full ${inputClass}`}>
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="superseded">Superseded</option>
                  </select>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim">
                    {briefEditId ? "Save" : "Create"}
                  </button>
                  <button type="button" onClick={() => setBriefForm(false)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {!briefs && !briefsError && <p className="text-sm text-zinc-400">Loading…</p>}
            {briefs?.length === 0 && <p className="text-sm text-zinc-400">No design briefs yet.</p>}
            {briefs && briefs.length > 0 && (
              <div className="space-y-2">
                {briefs.map((b) => (
                  <div key={b.id} className="flex items-start justify-between rounded-xl bg-stone-50 px-4 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-800">{b.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${briefStatusColors[b.status]}`}>{b.status}</span>
                      </div>
                      {b.discipline && <p className="mt-0.5 text-xs text-zinc-400">{b.discipline}</p>}
                      {b.scope_description && <p className="mt-1 text-xs text-zinc-500">{b.scope_description}</p>}
                    </div>
                    <div className="ml-3 flex shrink-0 gap-2">
                      <PermissionGate permission="engineering.design_brief.manage">
                        <button onClick={() => openBriefEdit(b)} className="text-xs text-zinc-400 hover:text-brand-dim">Edit</button>
                        {b.status === "draft" && (
                          <button onClick={() => handleDeleteBrief(b.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                        )}
                      </PermissionGate>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RFIs tab */}
        {activeTab === "rfis" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <PermissionGate permission="engineering.rfi.manage">
                <button onClick={openRfiCreate} className="text-sm text-zinc-400 hover:text-brand-dim">
                  Raise RFI
                </button>
              </PermissionGate>
            </div>

            {rfisError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{rfisError}</div>}

            {rfiForm && (
              <form onSubmit={handleSaveRfi} className="space-y-2 rounded-xl bg-stone-50 p-4">
                {rfiFormError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{rfiFormError}</div>}
                <input
                  value={rfiSubject} onChange={(e) => setRfiSubject(e.target.value)}
                  placeholder="Subject*" className={`w-full ${inputClass}`} required
                />
                <textarea
                  value={rfiDesc} onChange={(e) => setRfiDesc(e.target.value)}
                  placeholder="Description" rows={2} className={`w-full resize-none ${inputClass}`}
                />
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Date required by
                  <input type="date" value={rfiDateReq} onChange={(e) => setRfiDateReq(e.target.value)} className={inputClass} />
                </label>
                {rfiEditId && (
                  <>
                    <select value={rfiStatus} onChange={(e) => setRfiStatus(e.target.value as RfiStatus)} className={`w-full ${inputClass}`}>
                      <option value="open">Open</option>
                      <option value="responded">Responded</option>
                      <option value="closed">Closed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <textarea
                      value={rfiResponse} onChange={(e) => setRfiResponse(e.target.value)}
                      placeholder="Response" rows={2} className={`w-full resize-none ${inputClass}`}
                    />
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Date responded
                      <input type="date" value={rfiDateResp} onChange={(e) => setRfiDateResp(e.target.value)} className={inputClass} />
                    </label>
                  </>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim">
                    {rfiEditId ? "Save" : "Raise"}
                  </button>
                  <button type="button" onClick={() => setRfiForm(false)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {!rfis && !rfisError && <p className="text-sm text-zinc-400">Loading…</p>}
            {rfis?.length === 0 && <p className="text-sm text-zinc-400">No RFIs raised yet.</p>}
            {rfis && rfis.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-zinc-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      <th className="px-4 py-2">No.</th>
                      <th className="px-4 py-2">Subject</th>
                      <th className="px-4 py-2">Raised</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {rfis.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-50 last:border-0">
                        <td className="px-4 py-2 font-mono text-xs text-zinc-500">{r.rfi_number}</td>
                        <td className="px-4 py-2 text-zinc-800">{r.subject}</td>
                        <td className="px-4 py-2 text-xs text-zinc-500">{new Date(r.date_raised).toLocaleDateString()}</td>
                        <td className="px-4 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${rfiStatusColors[r.status]}`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <PermissionGate permission="engineering.rfi.manage">
                            <button onClick={() => openRfiEdit(r)} className="text-xs text-zinc-400 hover:text-brand-dim">Edit</button>
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

        {/* IFC Register tab (read-only) */}
        {activeTab === "ifc" && (
          <div className="space-y-4">
            {ifcError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{ifcError}</div>}
            {!ifcRows && !ifcError && <p className="text-sm text-zinc-400">Loading…</p>}
            {ifcRows?.length === 0 && (
              <p className="text-sm text-zinc-400">No drawing-type documents in this project yet.</p>
            )}
            {ifcRows && ifcRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-zinc-100">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      <th className="px-4 py-2">Doc no.</th>
                      <th className="px-4 py-2">Title</th>
                      <th className="px-4 py-2">Discipline</th>
                      <th className="px-4 py-2">Rev.</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Submitted</th>
                      <th className="px-4 py-2">Approved</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ifcRows.map((row) => (
                      <tr key={row.document_id} className="border-b border-zinc-50 last:border-0">
                        <td className="px-4 py-2 font-mono text-xs text-zinc-500">{row.document_number ?? "—"}</td>
                        <td className="px-4 py-2 text-zinc-800">{row.title}</td>
                        <td className="px-4 py-2 text-xs text-zinc-500">{row.discipline ?? "—"}</td>
                        <td className="px-4 py-2 text-xs text-zinc-500">{row.revision_code ?? "—"}</td>
                        <td className="px-4 py-2 text-xs text-zinc-500">{row.revision_status ?? "—"}</td>
                        <td className="px-4 py-2">
                          {row.submitted ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Yes</span>
                          ) : (
                            <span className="text-xs text-zinc-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-zinc-500">
                          {row.approved_at ? new Date(row.approved_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* As-Built tab */}
        {activeTab === "asbuilt" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <PermissionGate permission="engineering.as_built.manage">
                <button onClick={openAbCreate} className="text-sm text-zinc-400 hover:text-brand-dim">
                  Add record
                </button>
              </PermissionGate>
            </div>

            {asBuiltError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{asBuiltError}</div>}

            {abForm && (
              <form onSubmit={handleSaveAb} className="space-y-2 rounded-xl bg-stone-50 p-4">
                {abFormError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{abFormError}</div>}
                {!abEditId && (
                  documents.length > 0 ? (
                    <select value={abDocumentId} onChange={(e) => setAbDocumentId(e.target.value)} className={`w-full ${inputClass}`} required>
                      <option value="">Select document…</option>
                      {documents.map((d) => (
                        <option key={d.id} value={d.id}>{d.document_number ? `${d.document_number} — ` : ""}{d.title}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={abDocumentId} onChange={(e) => setAbDocumentId(e.target.value)}
                      placeholder="Document ID (UUID)*" className={`w-full ${inputClass}`} required
                    />
                  )
                )}
                <textarea
                  value={abNotes} onChange={(e) => setAbNotes(e.target.value)}
                  placeholder="Notes" rows={2} className={`w-full resize-none ${inputClass}`}
                />
                {abEditId && (
                  <>
                    <input
                      value={abConfirmedBy} onChange={(e) => setAbConfirmedBy(e.target.value)}
                      placeholder="Confirmed by (user ID)" className={`w-full ${inputClass}`}
                    />
                    <label className="flex flex-col gap-1 text-xs text-zinc-400">
                      Confirmed at
                      <input type="date" value={abConfirmedAt} onChange={(e) => setAbConfirmedAt(e.target.value)} className={inputClass} />
                    </label>
                  </>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim">
                    {abEditId ? "Save" : "Add"}
                  </button>
                  <button type="button" onClick={() => setAbForm(false)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {!asBuilt && !asBuiltError && <p className="text-sm text-zinc-400">Loading…</p>}
            {asBuilt?.length === 0 && <p className="text-sm text-zinc-400">No as-built records yet.</p>}
            {asBuilt && asBuilt.length > 0 && (
              <div className="space-y-2">
                {asBuilt.map((r) => (
                  <div key={r.id} className="flex items-start justify-between rounded-xl bg-stone-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-800">
                        {documents.find((d) => d.id === r.document_id)?.title ?? <span className="font-mono text-xs">{r.document_id}</span>}
                      </p>
                      {r.confirmed_at && (
                        <p className="mt-0.5 text-xs text-emerald-600">
                          Confirmed {new Date(r.confirmed_at).toLocaleDateString()}
                        </p>
                      )}
                      {!r.confirmed_at && <p className="mt-0.5 text-xs text-zinc-400">Not yet confirmed</p>}
                      {r.notes && <p className="mt-1 text-xs text-zinc-500">{r.notes}</p>}
                    </div>
                    <PermissionGate permission="engineering.as_built.manage">
                      <button onClick={() => openAbEdit(r)} className="ml-3 shrink-0 text-xs text-zinc-400 hover:text-brand-dim">Edit</button>
                    </PermissionGate>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
