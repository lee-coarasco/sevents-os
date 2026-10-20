import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  aiService,
  type KnowledgeDocument,
  type KnowledgeSourceType,
  type AiCitation,
} from "../services/aiService";
import { AiAssistantDrawer } from "../components/AiAssistantDrawer";

export function AiKnowledgePage() {
  const { session } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Test Search State
  const [testQuery, setTestQuery] = useState("");
  const [testResults, setTestResults] = useState<AiCitation[]>([]);
  const [testLoading, setTestLoading] = useState(false);

  // Ingest Form State
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("drawing");
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [content, setContent] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setReadingFile(true);

    try {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      if (!title) {
        setTitle(baseName.replace(/[-_]/g, " "));
      }
      if (!sourceId) {
        setSourceId(`DOC-${Date.now().toString().slice(-6)}`);
      }

      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "txt" || ext === "md" || ext === "json" || ext === "csv") {
        const text = await file.text();
        setContent(text);
      } else {
        const text = await file.text();
        const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ").trim();
        if (cleaned.length > 50) {
          setContent(cleaned);
        } else {
          setContent(`[File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]\n\nUploaded technical file reference. Please paste or review document clauses below.`);
        }
      }
    } catch (err: any) {
      alert("Could not read file: " + err.message);
    } finally {
      setReadingFile(false);
    }
  };

  const fetchDocuments = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const docs = await aiService.listDocuments(session.access_token, selectedProject || undefined);
      setDocuments(docs);
    } catch (err: any) {
      setError(err.message || "Failed to load knowledge documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [selectedProject, session?.access_token]);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !sourceId.trim() || !title.trim() || !content.trim()) return;

    setIngesting(true);
    try {
      await aiService.ingestDocument(session.access_token, {
        sourceType,
        sourceId: sourceId.trim(),
        title: title.trim(),
        version: version.trim() || "v1.0",
        projectId: selectedProject || undefined,
        content: content.trim(),
      });
      setIngestSuccess(true);
      setTimeout(() => {
        setIngestSuccess(false);
        setIsIngestModalOpen(false);
        setSourceId("");
        setTitle("");
        setContent("");
      }, 1200);
      fetchDocuments();
    } catch (err: any) {
      alert("Failed to ingest document: " + err.message);
    } finally {
      setIngesting(false);
    }
  };

  const handleDelete = async (id: string, docTitle: string) => {
    if (!session?.access_token) return;
    if (!confirm(`Are you sure you want to remove "${docTitle}" and all its vector embeddings from the knowledge base?`)) {
      return;
    }
    try {
      await aiService.deleteDocument(session.access_token, id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      alert("Failed to delete document: " + err.message);
    }
  };

  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim() || !session?.access_token) return;

    setTestLoading(true);
    try {
      const res = await aiService.chat(session.access_token, testQuery.trim(), selectedProject || undefined);
      setTestResults(res.citations || []);
    } catch (err: any) {
      alert("Test search failed: " + err.message);
    } finally {
      setTestLoading(false);
    }
  };

  // Filtered documents
  const filteredDocs = documents.filter((doc) => {
    if (filterType !== "all" && doc.source_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.source_id.toLowerCase().includes(q) ||
        doc.version.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Source Type stats
  const typeCounts = documents.reduce<Record<string, number>>((acc, d) => {
    acc[d.source_type] = (acc[d.source_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">AI Knowledge Base &amp; Search</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Vectorized repository of drawings, specifications, RFIs, and contracts powering grounded AI queries with zero hallucination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAssistantOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 shadow-xs transition-colors"
          >
            <svg className="h-4 w-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Open Assistant (Ctrl+/)
          </button>
          <button
            onClick={() => setIsIngestModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 shadow-xs transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Ingest Document
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Indexed Documents</p>
          <p className="mt-2 text-3xl font-extrabold text-zinc-900">{documents.length}</p>
          <p className="mt-1 text-xs text-zinc-400">Authorized project assets</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Drawings &amp; Specs</p>
          <p className="mt-2 text-3xl font-extrabold text-amber-600">
            {(typeCounts["drawing"] || 0) + (typeCounts["specification"] || 0)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Architectural &amp; structural items</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">RFIs &amp; Submittals</p>
          <p className="mt-2 text-3xl font-extrabold text-blue-600">
            {(typeCounts["rfi"] || 0) + (typeCounts["submittal"] || 0)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Clarifications &amp; approvals</p>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Contracts &amp; DPRs</p>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600">
            {(typeCounts["contract"] || 0) + (typeCounts["dpr"] || 0)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Commercial &amp; daily logs</p>
        </div>
      </div>

      {/* Test Semantic Search Bench */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">Semantic Search &amp; Similarity Test Bench</h2>
            <p className="text-xs text-zinc-500">
              Directly query the pgvector cosine distance engine to inspect chunk retrieval rankings
            </p>
          </div>
        </div>

        <form onSubmit={handleTestSearch} className="flex gap-3">
          <input
            type="text"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            placeholder="e.g. Waterproofing membrane thickness, concrete column curing time, RFI-042 response..."
            className="flex-1 rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={testLoading || !testQuery.trim()}
            className="rounded-xl bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            {testLoading ? "Searching..." : "Test Vector Match"}
          </button>
        </form>

        {testResults.length > 0 && (
          <div className="mt-5 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Retrieved Chunks ({testResults.length})
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {testResults.map((chunk, idx) => (
                <div key={idx} className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-zinc-800 truncate">{chunk.title}</span>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                      {Math.round(chunk.similarity * 100)}% match
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-2">
                    <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-bold uppercase">{chunk.sourceType}</span>
                    <span>Version: {chunk.version}</span>
                  </div>
                  <p className="font-mono text-[11px] text-zinc-700 bg-white p-2.5 rounded border border-zinc-200 line-clamp-3">
                    {chunk.snippet}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Documents Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Filter Source:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-800 focus:border-brand focus:outline-none"
            >
              <option value="all">All Document Types</option>
              <option value="drawing">Drawings</option>
              <option value="specification">Specifications</option>
              <option value="contract">Contracts</option>
              <option value="rfi">RFIs</option>
              <option value="submittal">Submittals</option>
              <option value="dpr">Daily Progress Reports</option>
              <option value="policy">Policies &amp; SOPs</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Project:</span>
            <input
              type="text"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              placeholder="All Projects (or ID)"
              className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-brand focus:outline-none w-36"
            />
          </div>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, ID or version..."
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:border-brand focus:outline-none"
          />
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-zinc-500">Loading indexed documents...</div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl m-4">
            {error}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-semibold text-zinc-800">No knowledge documents found</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Get started by ingesting drawings, contracts, or specifications.
            </p>
            <button
              onClick={() => setIsIngestModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              Ingest First Document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Document Title &amp; ID</th>
                  <th className="px-6 py-3.5">Source Type</th>
                  <th className="px-6 py-3.5">Version</th>
                  <th className="px-6 py-3.5">Project Scope</th>
                  <th className="px-6 py-3.5">Indexed At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 text-sm">{doc.title}</div>
                      <div className="font-mono text-[11px] text-zinc-400 mt-0.5">{doc.source_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 font-bold uppercase text-[10px] text-zinc-700">
                        {doc.source_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-medium text-zinc-800">{doc.version}</td>
                    <td className="px-6 py-4 text-zinc-600">
                      {doc.project_id ? (
                        <span className="font-mono text-[11px]">{doc.project_id}</span>
                      ) : (
                        <span className="text-zinc-400 italic">Organization-wide</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(doc.id, doc.title)}
                        className="rounded p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                        title="Delete from vector index"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ingest Document Modal */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-900 px-6 py-4 text-white">
              <div>
                <h3 className="font-bold text-white text-base">Ingest &amp; Vectorize Project Document</h3>
                <p className="text-xs text-zinc-400">Chunks and generates embeddings for grounded retrieval</p>
              </div>
              <button
                onClick={() => setIsIngestModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleIngest} className="p-6 space-y-4 overflow-y-auto">
              {ingestSuccess && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
                  Document successfully vectorized and indexed!
                </div>
              )}

              {/* File Upload Option */}
              <div className="rounded-xl border border-dashed border-zinc-200 bg-stone-50/50 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-zinc-800">Direct File Ingestion</span>
                    <p className="text-[11px] text-zinc-400">
                      Upload a document (.txt, .md, .csv, .json, specifications) to auto-extract text and pre-fill fields
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50">
                    <input
                      type="file"
                      accept=".txt,.md,.json,.csv,.xml,.spec,.doc,.pdf"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                    {readingFile ? "Reading file..." : "Browse file..."}
                  </label>
                </div>
                {selectedFileName && (
                  <div className="mt-2 text-xs font-medium text-emerald-600 flex items-center gap-1.5">
                    <span>✓ Loaded: {selectedFileName}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Source Type *
                  </label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as KnowledgeSourceType)}
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                  >
                    <option value="drawing">Drawing (DWG / CAD Spec)</option>
                    <option value="specification">Specification</option>
                    <option value="contract">Contract Agreement</option>
                    <option value="rfi">RFI (Request for Information)</option>
                    <option value="submittal">Submittal / Shop Drawing</option>
                    <option value="dpr">Daily Progress Report (DPR)</option>
                    <option value="policy">Policy / Standard Procedure</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Source Reference ID *
                  </label>
                  <input
                    type="text"
                    required
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    placeholder="e.g. DWG-STR-A-101 or RFI-2026-088"
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Basement Waterproofing &amp; Membrane Spec"
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Version / Revision *
                  </label>
                  <input
                    type="text"
                    required
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder="e.g. v2.1 or Rev-B"
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                  Document Content (Extracted Text / Specifications) *
                </label>
                <textarea
                  required
                  rows={8}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste drawing notes, contract clauses, material grades, safety requirements, or RFI resolutions..."
                  className="w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs focus:border-brand focus:outline-none"
                />
                <p className="mt-1 text-[11px] text-zinc-400">
                  Content will be automatically chunked (~500 tokens with overlap) and embedded via pgvector.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsIngestModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={ingesting}
                  className="rounded-lg bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
                >
                  {ingesting ? "Vectorizing & Indexing..." : "Index Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Assistant Drawer */}
      <AiAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        initialProjectId={selectedProject || undefined}
      />
    </div>
  );
}
