import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { PermissionGate } from "../components/PermissionGate";
import type { WorkflowVersion, VersionStatus } from "./WorkflowDefinitionDetailPage";
import type { DefinitionStatus, WorkflowDefinition } from "./WorkflowDefinitionsPage";

// ── Types ──────────────────────────────────────────────────────────────────────

export type NodeType =
  | "create_task"
  | "assign_role_user"
  | "collect_form_data"
  | "request_upload_evidence"
  | "evaluate_condition"
  | "call_service"
  | "request_approval"
  | "send_notification"
  | "wait_event_time"
  | "create_linked_followup"
  | "escalate"
  | "complete"
  | "cancel";

export interface WorkflowNode {
  id: string;
  node_key: string;
  node_type: NodeType;
  config: Record<string, unknown> | null;
  created_at: string;
}

export interface WorkflowTransition {
  id: string;
  from_node_id: string;
  to_node_id: string;
  condition_id: string | null;
  order_index: number;
}

export interface WorkflowCondition {
  id: string;
  expression: { field: string; operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; value: string };
  description: string | null;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  transitions: WorkflowTransition[];
  conditions: WorkflowCondition[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const NODE_LABEL: Record<NodeType, string> = {
  create_task: "Create Task",
  assign_role_user: "Assign Role / User",
  collect_form_data: "Collect Form Data",
  request_upload_evidence: "Upload Evidence",
  evaluate_condition: "Evaluate Condition",
  call_service: "Call Service",
  request_approval: "Request Approval",
  send_notification: "Send Notification",
  wait_event_time: "Wait / Timer",
  create_linked_followup: "Create Follow-up",
  escalate: "Escalate",
  complete: "Complete",
  cancel: "Cancel",
};

const NODE_COLOR: Record<NodeType, string> = {
  create_task: "bg-purple-100 text-purple-700",
  assign_role_user: "bg-indigo-100 text-indigo-700",
  collect_form_data: "bg-violet-100 text-violet-700",
  request_upload_evidence: "bg-yellow-100 text-yellow-700",
  evaluate_condition: "bg-blue-100 text-blue-700",
  call_service: "bg-cyan-100 text-cyan-700",
  request_approval: "bg-brand-soft text-amber-700",
  send_notification: "bg-teal-100 text-teal-700",
  wait_event_time: "bg-orange-100 text-orange-700",
  create_linked_followup: "bg-pink-100 text-pink-700",
  escalate: "bg-rose-100 text-rose-700",
  complete: "bg-green-100 text-green-700",
  cancel: "bg-red-100 text-red-700",
};

const ALL_NODE_TYPES: NodeType[] = [
  "create_task", "assign_role_user", "collect_form_data", "request_upload_evidence",
  "evaluate_condition", "call_service", "request_approval", "send_notification",
  "wait_event_time", "create_linked_followup", "escalate", "complete", "cancel",
];

/** Returns nodes ordered by the transition chain (BFS from start node). Unlinked nodes appended at the end. */
function orderNodes(nodes: WorkflowNode[], transitions: WorkflowTransition[]): WorkflowNode[] {
  if (nodes.length === 0) return [];
  const incomingIds = new Set(transitions.map((t) => t.to_node_id));
  const startNodes = nodes.filter((n) => !incomingIds.has(n.id));
  const start = startNodes[0] ?? nodes[0];
  const ordered: WorkflowNode[] = [];
  const visited = new Set<string>();
  const queue = [start.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = nodes.find((n) => n.id === id);
    if (node) ordered.push(node);
    const nexts = transitions.filter((t) => t.from_node_id === id).sort((a, b) => a.order_index - b.order_index);
    for (const t of nexts) queue.push(t.to_node_id);
  }
  for (const n of nodes) {
    if (!visited.has(n.id)) ordered.push(n);
  }
  return ordered;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function NodeTypeBadge({ type }: { type: NodeType }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${NODE_COLOR[type]}`}>
      {NODE_LABEL[type]}
    </span>
  );
}

/** Per-type bespoke config form fields (JSON fallback for rare types). */
function NodeConfigFields({
  nodeType,
  config,
  onChange,
}: {
  nodeType: NodeType;
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  function field(label: string, key: string, placeholder?: string) {
    return (
      <div key={key}>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</label>
        <input
          value={(config[key] as string) ?? ""}
          onChange={(e) => onChange({ ...config, [key]: e.target.value })}
          placeholder={placeholder}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>
    );
  }

  if (nodeType === "create_task" || nodeType === "assign_role_user") {
    return (
      <div className="space-y-3">
        {field("Canonical Role ID", "canonicalRoleId", "e.g. role.project_manager")}
        {field("SLA Definition Key (optional)", "slaDefinitionKey", "e.g. sla.approval_24h")}
      </div>
    );
  }
  if (nodeType === "request_approval") {
    return (
      <div className="space-y-3">
        {field("Approver Role IDs (comma-separated)", "approverRoles", "e.g. role.cfo, role.coo")}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Mode</label>
          <select
            value={(config.mode as string) ?? "sequential"}
            onChange={(e) => onChange({ ...config, mode: e.target.value })}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="sequential">Sequential</option>
            <option value="parallel">Parallel</option>
          </select>
        </div>
        {field("Required approvals count", "requiredApprovals", "e.g. 1")}
      </div>
    );
  }
  if (nodeType === "send_notification") {
    return (
      <div className="space-y-3">
        {field("Template key", "templateKey", "e.g. notify.po_approved")}
        {field("Recipient role IDs (comma-separated)", "recipientRoles", "e.g. role.store_keeper")}
      </div>
    );
  }
  if (nodeType === "wait_event_time") {
    return (
      <div className="space-y-3">
        {field("Duration (ISO 8601 or hours)", "duration", "e.g. PT24H")}
        {field("Wait for event key (optional)", "eventKey", "e.g. grn.received")}
      </div>
    );
  }
  if (nodeType === "complete" || nodeType === "cancel" || nodeType === "escalate") {
    return (
      <div>
        {field("Reason / note (optional)", "reason", "e.g. All approvals received")}
      </div>
    );
  }
  // JSON fallback for: collect_form_data, request_upload_evidence, call_service, create_linked_followup, evaluate_condition
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Config JSON (optional)
      </label>
      <textarea
        rows={4}
        value={config._raw ? (config._raw as string) : ""}
        onChange={(e) => onChange({ _raw: e.target.value })}
        placeholder={`{ "key": "value" }`}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-xs outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <p className="mt-1 text-xs text-zinc-400">
        Bespoke form not yet built for this type — enter raw JSON or leave empty.
      </p>
    </div>
  );
}

// ── Steps Editor ───────────────────────────────────────────────────────────────

function StepsEditor({ versionId, isDraft }: { versionId: string; isDraft: boolean }) {
  const { session } = useAuth();
  const [graph, setGraph] = useState<WorkflowGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-node form
  const [showAddNode, setShowAddNode] = useState(false);
  const [newNodeType, setNewNodeType] = useState<NodeType>("create_task");
  const [newNodeKey, setNewNodeKey] = useState("");
  const [newNodeConfig, setNewNodeConfig] = useState<Record<string, unknown>>({});
  const [addingNode, setAddingNode] = useState(false);
  const [addNodeError, setAddNodeError] = useState<string | null>(null);

  // Add-transition form
  const [showAddTransition, setShowAddTransition] = useState(false);
  const [transFrom, setTransFrom] = useState("");
  const [transTo, setTransTo] = useState("");
  const [transCondition, setTransCondition] = useState("");
  const [addingTransition, setAddingTransition] = useState(false);
  const [addTransitionError, setAddTransitionError] = useState<string | null>(null);

  // Add-condition form
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [condField, setCondField] = useState("");
  const [condOperator, setCondOperator] = useState<"eq" | "neq" | "gt" | "gte" | "lt" | "lte">("eq");
  const [condValue, setCondValue] = useState("");
  const [condDescription, setCondDescription] = useState("");
  const [addingCondition, setAddingCondition] = useState(false);
  const [addConditionError, setAddConditionError] = useState<string | null>(null);

  const loadGraph = useCallback(() => {
    if (!session) return;
    setLoading(true);
    apiFetch<{ graph: WorkflowGraph }>(`/workflow/versions/${versionId}/graph`, session.access_token)
      .then((data) => {
        setGraph(data.graph);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load graph"))
      .finally(() => setLoading(false));
  }, [session, versionId]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // Auto-suggest nodeKey based on type and current step count
  function suggestKey(type: NodeType) {
    const count = (graph?.nodes.length ?? 0) + 1;
    return `step_${count}_${type}`;
  }

  function handleNodeTypeChange(t: NodeType) {
    setNewNodeType(t);
    setNewNodeKey(suggestKey(t));
    setNewNodeConfig({});
  }

  async function handleAddNode(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !newNodeKey.trim()) return;
    setAddingNode(true);
    setAddNodeError(null);
    try {
      // Build config: merge bespoke fields or parse raw JSON
      let config: Record<string, unknown> | undefined;
      if (newNodeConfig._raw) {
        try { config = JSON.parse(newNodeConfig._raw as string); } catch { config = undefined; }
      } else {
        const cleaned = Object.fromEntries(Object.entries(newNodeConfig).filter(([, v]) => v !== "" && v !== undefined));
        config = Object.keys(cleaned).length > 0 ? cleaned : undefined;
      }
      await apiFetch(`/workflow/versions/${versionId}/nodes`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ nodeKey: newNodeKey.trim(), nodeType: newNodeType, ...(config ? { config } : {}) }),
      });
      setNewNodeKey("");
      setNewNodeConfig({});
      setShowAddNode(false);
      loadGraph();
    } catch (err) {
      setAddNodeError(err instanceof ApiError ? err.message : "Could not add node");
    } finally {
      setAddingNode(false);
    }
  }

  async function handleAddTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !transFrom || !transTo) return;
    setAddingTransition(true);
    setAddTransitionError(null);
    try {
      const body: Record<string, unknown> = { fromNodeId: transFrom, toNodeId: transTo };
      if (transCondition) body.conditionId = transCondition;
      await apiFetch(`/workflow/versions/${versionId}/transitions`, session.access_token, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setTransFrom("");
      setTransTo("");
      setTransCondition("");
      setShowAddTransition(false);
      loadGraph();
    } catch (err) {
      setAddTransitionError(err instanceof ApiError ? err.message : "Could not add transition");
    } finally {
      setAddingTransition(false);
    }
  }

  async function handleAddCondition(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !condField || !condValue) return;
    setAddingCondition(true);
    setAddConditionError(null);
    try {
      await apiFetch(`/workflow/versions/${versionId}/conditions`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          expression: { field: condField.trim(), operator: condOperator, value: condValue.trim() },
          description: condDescription.trim() || null,
        }),
      });
      setCondField("");
      setCondValue("");
      setCondDescription("");
      setShowAddCondition(false);
      loadGraph();
    } catch (err) {
      setAddConditionError(err instanceof ApiError ? err.message : "Could not add condition");
    } finally {
      setAddingCondition(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-400">Loading graph…</p>;
  if (error) return <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!graph) return null;

  const orderedNodes = orderNodes(graph.nodes, graph.transitions);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* ── Left: step list ─────────────────────────────────────────── */}
      <div className="lg:col-span-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {orderedNodes.length} {orderedNodes.length === 1 ? "step" : "steps"}
          </p>
          {isDraft && (
            <PermissionGate permission="workflow.definition.manage">
              <button
                onClick={() => { setShowAddNode(true); setNewNodeKey(suggestKey(newNodeType)); }}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-brand-dim"
              >
                + Add Step
              </button>
            </PermissionGate>
          )}
        </div>

        {orderedNodes.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
            No steps yet. Add the first step to define this workflow.
          </div>
        )}

        {orderedNodes.map((node, idx) => {
          const outgoing = graph.transitions.filter((t) => t.from_node_id === node.id);
          return (
            <div key={node.id} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-zinc-600">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <NodeTypeBadge type={node.node_type} />
                    <code className="font-mono text-xs text-zinc-500">{node.node_key}</code>
                  </div>
                  {node.config && Object.keys(node.config).length > 0 && (
                    <pre className="mt-2 overflow-x-auto rounded bg-stone-50 p-2 font-mono text-xs text-zinc-600">
                      {JSON.stringify(node.config, null, 2)}
                    </pre>
                  )}
                  {outgoing.length > 0 && (
                    <p className="mt-2 text-xs text-zinc-400">
                      → {outgoing.map((t) => {
                        const toNode = nodeById.get(t.to_node_id);
                        return (
                          <span key={t.id} className="mr-2">
                            <code className="font-mono">{toNode?.node_key ?? t.to_node_id}</code>
                            {t.condition_id && (
                              <span className="ml-1 text-blue-500">
                                [cond: {graph.conditions.find((c) => c.id === t.condition_id)?.description ?? t.condition_id.slice(0, 8)}]
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add step form */}
        {showAddNode && isDraft && (
          <form onSubmit={handleAddNode} className="rounded-2xl border border-brand/40 bg-brand-soft p-4 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">New Step</p>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Node Type</label>
              <select
                value={newNodeType}
                onChange={(e) => handleNodeTypeChange(e.target.value as NodeType)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {ALL_NODE_TYPES.map((t) => (
                  <option key={t} value={t}>{NODE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Node Key</label>
              <input
                value={newNodeKey}
                onChange={(e) => setNewNodeKey(e.target.value)}
                placeholder="e.g. step_1_request_approval"
                required
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <NodeConfigFields nodeType={newNodeType} config={newNodeConfig} onChange={setNewNodeConfig} />
            {addNodeError && <p className="text-xs text-red-600">{addNodeError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={addingNode}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
              >
                {addingNode ? "Adding…" : "Add Step"}
              </button>
              <button type="button" onClick={() => setShowAddNode(false)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Right: transitions + conditions ─────────────────────────── */}
      <div className="lg:col-span-2 space-y-6">
        {/* Transitions */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Transitions</p>
            {isDraft && graph.nodes.length >= 2 && (
              <PermissionGate permission="workflow.definition.manage">
                <button
                  onClick={() => setShowAddTransition(true)}
                  className="text-xs font-semibold text-brand hover:text-brand-dim"
                >
                  + Link
                </button>
              </PermissionGate>
            )}
          </div>
          {graph.transitions.length === 0 && (
            <p className="text-xs text-zinc-400">
              No transitions. Steps are auto-linked when you add the second step sequentially.
            </p>
          )}
          {graph.transitions.map((t) => {
            const fromNode = nodeById.get(t.from_node_id);
            const toNode = nodeById.get(t.to_node_id);
            const cond = t.condition_id ? graph.conditions.find((c) => c.id === t.condition_id) : null;
            return (
              <div key={t.id} className="mb-2 flex items-center gap-1.5 text-xs text-zinc-600">
                <code className="rounded bg-stone-50 px-1.5 py-0.5 font-mono">{fromNode?.node_key ?? "?"}</code>
                <span className="text-zinc-300">→</span>
                <code className="rounded bg-stone-50 px-1.5 py-0.5 font-mono">{toNode?.node_key ?? "?"}</code>
                {cond && (
                  <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-blue-600">
                    if: {cond.description ?? `${cond.expression.field} ${cond.expression.operator} ${cond.expression.value}`}
                  </span>
                )}
              </div>
            );
          })}

          {showAddTransition && isDraft && (
            <form onSubmit={handleAddTransition} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">From</label>
                <select
                  value={transFrom}
                  onChange={(e) => setTransFrom(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-brand"
                >
                  <option value="">Select step…</option>
                  {graph.nodes.map((n) => (
                    <option key={n.id} value={n.id}>{n.node_key}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">To</label>
                <select
                  value={transTo}
                  onChange={(e) => setTransTo(e.target.value)}
                  required
                  className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-brand"
                >
                  <option value="">Select step…</option>
                  {graph.nodes.filter((n) => n.id !== transFrom).map((n) => (
                    <option key={n.id} value={n.id}>{n.node_key}</option>
                  ))}
                </select>
              </div>
              {graph.conditions.length > 0 && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Condition (optional)</label>
                  <select
                    value={transCondition}
                    onChange={(e) => setTransCondition(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-brand"
                  >
                    <option value="">— always —</option>
                    {graph.conditions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.description ?? `${c.expression.field} ${c.expression.operator} ${c.expression.value}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {addTransitionError && <p className="text-xs text-red-600">{addTransitionError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={addingTransition} className="rounded bg-brand px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50">
                  {addingTransition ? "Linking…" : "Link"}
                </button>
                <button type="button" onClick={() => setShowAddTransition(false)} className="rounded border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50">Cancel</button>
              </div>
            </form>
          )}
        </div>

        {/* Conditions (for evaluate_condition / branching) */}
        <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Conditions</p>
            {isDraft && (
              <PermissionGate permission="workflow.definition.manage">
                <button
                  onClick={() => setShowAddCondition(true)}
                  className="text-xs font-semibold text-brand hover:text-brand-dim"
                >
                  + Add
                </button>
              </PermissionGate>
            )}
          </div>
          {graph.conditions.length === 0 && (
            <p className="text-xs text-zinc-400">No conditions. Add one to build a branch (gateway) in the workflow.</p>
          )}
          {graph.conditions.map((c) => (
            <div key={c.id} className="mb-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-700">
              <p className="font-medium">{c.description ?? `${c.expression.field} ${c.expression.operator} ${c.expression.value}`}</p>
              <p className="mt-0.5 font-mono text-blue-500">
                {c.expression.field} {c.expression.operator} &quot;{c.expression.value}&quot;
              </p>
            </div>
          ))}

          {showAddCondition && isDraft && (
            <form onSubmit={handleAddCondition} className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Field</label>
                <input value={condField} onChange={(e) => setCondField(e.target.value)} required placeholder="e.g. amount" className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Operator</label>
                <select value={condOperator} onChange={(e) => setCondOperator(e.target.value as typeof condOperator)} className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-brand">
                  {(["eq", "neq", "gt", "gte", "lt", "lte"] as const).map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Value</label>
                <input value={condValue} onChange={(e) => setCondValue(e.target.value)} required placeholder="e.g. 50000" className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-brand" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Description (optional)</label>
                <input value={condDescription} onChange={(e) => setCondDescription(e.target.value)} placeholder="e.g. amount exceeds 50k" className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:border-brand" />
              </div>
              {addConditionError && <p className="text-xs text-red-600">{addConditionError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={addingCondition} className="rounded bg-brand px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50">
                  {addingCondition ? "Adding…" : "Add Condition"}
                </button>
                <button type="button" onClick={() => setShowAddCondition(false)} className="rounded border border-zinc-200 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50">Cancel</button>
              </div>
            </form>
          )}
        </div>

        {!isDraft && (
          <div className="rounded-xl bg-stone-50 p-3 text-xs text-zinc-400">
            This version is not a draft — steps are read-only. Create a new draft version to make changes.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Validation Panel ───────────────────────────────────────────────────────────

interface ValidationFinding {
  code: string;
  severity: "error" | "warning";
  message: string;
  nodeId?: string;
}

interface ValidationRun {
  id: string;
  result: "pass" | "fail";
  findings: ValidationFinding[];
  started_at: string;
  finished_at: string;
}

const SEVERITY_CLASS: Record<"error" | "warning", string> = {
  error: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
};

function ValidationPanel({
  definitionId,
  versionId,
  versionStatus,
  definitionStatus,
  onDefinitionReload,
  onGoToStep,
}: {
  definitionId: string;
  versionId: string;
  versionStatus: VersionStatus;
  definitionStatus: DefinitionStatus;
  onDefinitionReload: () => void;
  onGoToStep: (nodeId: string) => void;
}) {
  const { session } = useAuth();

  const [run, setRun] = useState<ValidationRun | null>(null);
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [approveDecision, setApproveDecision] = useState<"approved" | "rejected" | "">("");
  const [approveComment, setApproveComment] = useState("");
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishConfirm, setPublishConfirm] = useState(false);

  async function handleValidate() {
    if (!session) return;
    setValidating(true);
    setValidateError(null);
    try {
      const data = await apiFetch<{ run: ValidationRun }>(
        `/workflow/versions/${versionId}/validate`,
        session.access_token,
        { method: "POST" },
      );
      setRun(data.run);
    } catch (err) {
      setValidateError(err instanceof ApiError ? err.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit() {
    if (!session) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiFetch(`/workflow/definitions/${definitionId}/submit`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ versionId }),
      });
      onDefinitionReload();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !approveDecision) return;
    setApproving(true);
    setApproveError(null);
    try {
      await apiFetch(`/workflow/definitions/${definitionId}/approve`, session.access_token, {
        method: "POST",
        body: JSON.stringify({
          versionId,
          decision: approveDecision,
          comment: approveComment.trim() || null,
        }),
      });
      onDefinitionReload();
    } catch (err) {
      setApproveError(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setApproving(false);
    }
  }

  async function handlePublish() {
    if (!session) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await apiFetch(`/workflow/definitions/${definitionId}/publish`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ versionId }),
      });
      onDefinitionReload();
      setPublishConfirm(false);
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }

  const validationPassed = run?.result === "pass";
  const canPublish = definitionStatus === "approved" && versionStatus === "draft" && validationPassed;
  const canPublishReason = !validationPassed
    ? "Run validation first — publish requires a passing run."
    : definitionStatus !== "approved"
    ? "The definition must be in Approved status before publishing."
    : versionStatus !== "draft"
    ? "Only draft versions can be published."
    : null;

  return (
    <div className="space-y-6">
      {/* ── Validation ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-brand text-lg font-bold text-zinc-900">Validation</h2>
          <PermissionGate permission="workflow.definition.manage">
            <button
              onClick={handleValidate}
              disabled={validating}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
            >
              {validating ? "Running…" : "Run Validation"}
            </button>
          </PermissionGate>
        </div>

        {validateError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{validateError}</div>
        )}

        {run && (
          run.result === "pass" ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              <span>✓</span>
              <span>Validation passed — no issues found.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-700">
                Validation failed — {run.findings.length} {run.findings.length === 1 ? "issue" : "issues"} found:
              </p>
              {run.findings.map((f, i) => (
                <div key={i} className={`rounded-lg border px-4 py-3 text-sm ${SEVERITY_CLASS[f.severity]}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="font-semibold">[{f.severity.toUpperCase()}] {f.code}</span>
                      <p className="mt-0.5">{f.message}</p>
                    </div>
                    {f.nodeId && (
                      <button
                        onClick={() => onGoToStep(f.nodeId!)}
                        className="shrink-0 text-xs underline opacity-70 hover:opacity-100"
                      >
                        Go to step
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {!run && !validateError && (
          <p className="text-sm text-zinc-400">
            Run validation to check this version for structural errors before submitting for review.
          </p>
        )}
      </div>

      {/* ── Submit for Review (draft → under_review) ───────────────── */}
      {definitionStatus === "draft" && versionStatus === "draft" && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-brand text-lg font-bold text-zinc-900">Submit for Review</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Submit this version for review. The definition moves to <strong>Under Review</strong>; a
            publisher must approve it before it can go live.
          </p>
          {submitError && (
            <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
          )}
          <PermissionGate permission="workflow.definition.manage">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit for Review"}
            </button>
          </PermissionGate>
        </div>
      )}

      {/* ── Approve / Reject (under_review) ────────────────────────── */}
      {definitionStatus === "under_review" && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-brand text-lg font-bold text-zinc-900">Approval Decision</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Review this workflow version and record your decision.
          </p>
          <form onSubmit={handleApprove} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Decision</label>
              <select
                value={approveDecision}
                onChange={(e) => setApproveDecision(e.target.value as "approved" | "rejected" | "")}
                required
                className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="">Select…</option>
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-400">Comment (optional)</label>
              <textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                rows={3}
                placeholder="Any notes for the author…"
                className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            {approveError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{approveError}</div>
            )}
            <PermissionGate permission="workflow.definition.publish">
              <button
                type="submit"
                disabled={approving || !approveDecision}
                className={`rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50 ${
                  approveDecision === "rejected"
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-brand text-zinc-900 hover:bg-brand-dim"
                }`}
              >
                {approving ? "Saving…" : approveDecision === "rejected" ? "Reject" : "Approve"}
              </button>
            </PermissionGate>
          </form>
        </div>
      )}

      {/* ── Publish (approved) ─────────────────────────────────────── */}
      {(definitionStatus === "approved" || !canPublishReason && definitionStatus !== "published") && (
        <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
          <h2 className="mb-2 font-brand text-lg font-bold text-zinc-900">Publish</h2>
          <p className="mb-4 text-sm text-zinc-500">
            Make this version the active version for all new workflow instances.
          </p>
          {canPublishReason && (
            <p className="mb-3 text-sm text-zinc-400 italic">{canPublishReason}</p>
          )}
          {publishError && (
            <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{publishError}</div>
          )}
          {publishConfirm ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                This will become the active version for all new instances. Are you sure?
              </div>
              <div className="flex gap-2">
                <PermissionGate permission="workflow.definition.publish">
                  <button
                    onClick={handlePublish}
                    disabled={publishing}
                    className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:opacity-50"
                  >
                    {publishing ? "Publishing…" : "Confirm Publish"}
                  </button>
                </PermissionGate>
                <button
                  onClick={() => setPublishConfirm(false)}
                  className="rounded-lg border border-zinc-200 px-5 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <PermissionGate permission="workflow.definition.publish">
              <button
                onClick={() => setPublishConfirm(true)}
                disabled={!canPublish}
                title={canPublishReason ?? undefined}
                className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim disabled:cursor-not-allowed disabled:opacity-40"
              >
                Publish
              </button>
            </PermissionGate>
          )}
        </div>
      )}

      {/* Show nothing actionable when already published/retired */}
      {(definitionStatus === "published" || definitionStatus === "retired") && (
        <div className="rounded-xl bg-stone-50 p-4 text-sm text-zinc-400">
          This definition is {definitionStatus} — no further approval actions available.
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function WorkflowVersionDetailPage() {
  const { definitionId, versionId } = useParams<{ definitionId: string; versionId: string }>();
  const { session } = useAuth();

  const [versions, setVersions] = useState<WorkflowVersion[] | null>(null);
  const [definition, setDefinition] = useState<WorkflowDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"steps" | "validation" | "overview">("steps");

  function loadDefinition() {
    if (!session || !definitionId) return;
    apiFetch<{ definition: WorkflowDefinition }>(`/workflow/definitions/${definitionId}`, session.access_token)
      .then((data) => setDefinition(data.definition))
      .catch(() => { /* non-fatal — definition metadata is supplementary */ });
  }

  useEffect(() => {
    if (!session || !definitionId) return;
    apiFetch<{ versions: WorkflowVersion[] }>(`/workflow/definitions/${definitionId}/versions`, session.access_token)
      .then((data) => setVersions(data.versions))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not reach the API"));
    loadDefinition();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, definitionId]);

  const version = versions?.find((v) => v.id === versionId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/config-studio/${definitionId}`} className="text-sm text-zinc-400 hover:text-zinc-600">
          ← Back to definition
        </Link>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {!version && !error && <p className="text-sm text-zinc-400">Loading…</p>}

      {version && (
        <>
          {/* Header */}
          <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-brand text-2xl font-bold text-zinc-900">Version {version.version}</h1>
                <p className="mt-1 font-mono text-xs text-zinc-400">{version.id}</p>
              </div>
              <StatusBadge status={version.status} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Published at</dt>
                <dd className="mt-1 text-zinc-800">{version.published_at ? new Date(version.published_at).toLocaleString() : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Rollback of</dt>
                <dd className="mt-1 text-zinc-800">{version.rollback_of_version ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Created</dt>
                <dd className="mt-1 text-zinc-800">{new Date(version.created_at).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-zinc-100">
            {(["steps", "validation", "overview"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium capitalize transition ${
                  activeTab === tab
                    ? "border-b-2 border-brand text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          {activeTab === "steps" && versionId && (
            <StepsEditor versionId={versionId} isDraft={version.status === "draft"} />
          )}

          {activeTab === "validation" && versionId && definitionId && (
            definition ? (
              <ValidationPanel
                definitionId={definitionId}
                versionId={versionId}
                versionStatus={version.status}
                definitionStatus={definition.status}
                onDefinitionReload={() => {
                  loadDefinition();
                  apiFetch<{ versions: WorkflowVersion[] }>(
                    `/workflow/definitions/${definitionId}/versions`,
                    session!.access_token,
                  ).then((d) => setVersions(d.versions)).catch(() => {});
                }}
                onGoToStep={() => setActiveTab("steps")}
              />
            ) : (
              <p className="text-sm text-zinc-400">Loading definition…</p>
            )
          )}

          {activeTab === "overview" && (
            <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm text-sm text-zinc-600 space-y-2">
              <p><span className="font-semibold text-zinc-800">Status:</span> {version.status}</p>
              <p><span className="font-semibold text-zinc-800">Version number:</span> {version.version}</p>
              {version.effective_from && <p><span className="font-semibold text-zinc-800">Effective from:</span> {version.effective_from}</p>}
              {version.effective_to && <p><span className="font-semibold text-zinc-800">Effective to:</span> {version.effective_to}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
