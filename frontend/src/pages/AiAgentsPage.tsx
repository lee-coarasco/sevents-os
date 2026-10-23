import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  agentService,
  type AgentDefinition,
  type AgentTool,
  type AgentExecution,
  type HitlPolicy,
  type McpServer,
} from "../services/agentService";
import { aiService, type ProviderMeta } from "../services/aiService";

export function AiAgentsPage() {
  const { session } = useAuth();
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: studio | console | tools | audit | providers
  const [activeTab, setActiveTab] = useState<"studio" | "console" | "tools" | "audit" | "providers">("studio");

  // Providers State
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string>("openai");
  const [switchingProvider, setSwitchingProvider] = useState(false);
  const [providerTestingId, setProviderTestingId] = useState<string | null>(null);
  const [providerTestResults, setProviderTestResults] = useState<Record<string, { ok: boolean; message: string; latencyMs: number }>>({});

  // Dynamic Custom Provider state
  const [showAddCustomProviderModal, setShowAddCustomProviderModal] = useState(false);
  const [customId, setCustomId] = useState("");
  const [customName, setCustomName] = useState("");
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customDefaultModel, setCustomDefaultModel] = useState("");
  const [customOtherModels, setCustomOtherModels] = useState("");
  const [savingCustomProvider, setSavingCustomProvider] = useState(false);

  // Dynamic Model Add inline state
  const [activeAddingModelProviderId, setActiveAddingModelProviderId] = useState<string | null>(null);
  const [newModelInput, setNewModelInput] = useState("");
  const [savingNewModel, setSavingNewModel] = useState(false);

  // Console State
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [consolePrompt, setConsolePrompt] = useState<string>("");
  const [runningAgent, setRunningAgent] = useState(false);
  const [activeExecution, setActiveExecution] = useState<AgentExecution | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [approving, setApproving] = useState(false);

  // Create / Edit Agent Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AgentDefinition | null>(null);
  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formModel, setFormModel] = useState("gpt-4o-mini");
  const [useCustomModelInput, setUseCustomModelInput] = useState(false);
  const [formTemp, setFormTemp] = useState(0.2);
  const [formRole, setFormRole] = useState("role.site_engineer");
  const [formTools, setFormTools] = useState<string[]>([]);
  const [formHitl, setFormHitl] = useState<HitlPolicy>("require_for_mutations");
  const [savingAgent, setSavingAgent] = useState(false);

  // Audit Detail Modal
  const [selectedAuditExec, setSelectedAuditExec] = useState<AgentExecution | null>(null);

  // MCP Servers State
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpApiKey, setMcpApiKey] = useState("");
  const [mcpDesc, setMcpDesc] = useState("");
  const [savingMcp, setSavingMcp] = useState(false);
  const [syncingMcpId, setSyncingMcpId] = useState<string | null>(null);

  // Custom Tool Modal
  const [showAddCustomToolModal, setShowAddCustomToolModal] = useState(false);
  const [toolKey, setToolKey] = useState("");
  const [toolName, setToolName] = useState("");
  const [toolDesc, setToolDesc] = useState("");
  const [toolCategory, setToolCategory] = useState("custom");
  const [toolWebhook, setToolWebhook] = useState("");
  const [toolIsMutation, setToolIsMutation] = useState(false);
  const [savingCustomTool, setSavingCustomTool] = useState(false);

  const loadData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      const [agentList, toolList, execList, provResult, mcpList] = await Promise.all([
        agentService.listAgents(session.access_token),
        agentService.listTools(session.access_token),
        agentService.listExecutions(session.access_token),
        aiService.listProviders(session.access_token).catch(() => ({ providers: [], activeProvider: "openai" })),
        agentService.listMcpServers(session.access_token).catch(() => []),
      ]);
      setMcpServers(mcpList);
      let finalAgentList = [...agentList];
      try {
        const storedOverrides = localStorage.getItem("sevents_agent_overrides");
        if (storedOverrides) {
          const overrides: Record<string, Partial<AgentDefinition>> = JSON.parse(storedOverrides);
          finalAgentList = finalAgentList.map((ag) =>
            overrides[ag.id] ? ({ ...ag, ...overrides[ag.id] } as AgentDefinition) : ag
          );
        }
      } catch {}
      setAgents(finalAgentList);
      setTools(toolList);
      setExecutions(execList);
      const mergedProviders: ProviderMeta[] = [...(provResult.providers || [])];
      try {
        const stored = localStorage.getItem("sevents_custom_providers");
        if (stored) {
          const localCustoms: (ProviderMeta & { apiKey?: string })[] = JSON.parse(stored);
          for (const lc of localCustoms) {
            if (!mergedProviders.some((p) => p.id === lc.id)) {
              mergedProviders.push(lc);
              // Register with backend in background
              aiService.registerCustomProvider(session.access_token, {
                id: lc.id,
                name: lc.name,
                baseUrl: lc.baseUrl || "",
                apiKey: lc.apiKey,
                defaultModel: lc.defaultModel,
                supportedModels: lc.supportedModels,
              }).catch(() => {});
            }
          }
        }
      } catch {}

      setProviders(mergedProviders);
      try {
        const storedActive = localStorage.getItem("sevents_active_provider");
        if (storedActive) {
          setActiveProviderId(storedActive);
          aiService.setActiveProvider(session.access_token, storedActive as any).catch(() => {});
        } else if (provResult.activeProvider) {
          setActiveProviderId(provResult.activeProvider);
        }
      } catch {
        if (provResult.activeProvider) {
          setActiveProviderId(provResult.activeProvider);
        }
      }
      if (finalAgentList.length > 0 && !selectedAgentId) {
        setSelectedAgentId(finalAgentList[0].id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load agent studio data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session?.access_token]);

  const handleSelectActiveProvider = async (providerId: string) => {
    if (!session?.access_token || switchingProvider) return;
    setSwitchingProvider(true);
    try {
      const active = await aiService.setActiveProvider(session.access_token, providerId);
      setActiveProviderId(active);
      try {
        localStorage.setItem("sevents_active_provider", active);
      } catch {}
    } catch (err: any) {
      alert("Failed to switch active provider: " + err.message);
    } finally {
      setSwitchingProvider(false);
    }
  };

  const handleTestProvider = async (providerId: string) => {
    if (!session?.access_token || providerTestingId) return;
    setProviderTestingId(providerId);
    try {
      const res = await aiService.testProvider(session.access_token, providerId);
      setProviderTestResults((prev) => ({ ...prev, [providerId]: res }));
    } catch (err: any) {
      setProviderTestResults((prev) => ({
        ...prev,
        [providerId]: { ok: false, message: err.message || "Connection failed", latencyMs: 0 },
      }));
    } finally {
      setProviderTestingId(null);
    }
  };

  const handleSaveCustomTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !toolKey.trim() || !toolName.trim()) return;
    setSavingCustomTool(true);
    try {
      await agentService.createCustomTool(session.access_token, {
        key: toolKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        name: toolName.trim(),
        description: toolDesc.trim(),
        category: toolCategory,
        isMutation: toolIsMutation,
        webhookUrl: toolWebhook.trim() || undefined,
        schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Query or instruction for this tool" },
            data: { type: "object", description: "Arbitrary payload" },
          },
        },
      });
      setShowAddCustomToolModal(false);
      setToolKey("");
      setToolName("");
      setToolDesc("");
      setToolWebhook("");
      loadData();
    } catch (err: any) {
      alert("Failed to register custom tool: " + err.message);
    } finally {
      setSavingCustomTool(false);
    }
  };

  const handleSaveMcpServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !mcpName.trim() || !mcpUrl.trim()) return;
    setSavingMcp(true);
    try {
      await agentService.createMcpServer(session.access_token, {
        name: mcpName.trim(),
        url: mcpUrl.trim(),
        apiKey: mcpApiKey.trim() || undefined,
        description: mcpDesc.trim() || undefined,
      });
      setShowAddMcpModal(false);
      setMcpName("");
      setMcpUrl("");
      setMcpApiKey("");
      setMcpDesc("");
      loadData();
    } catch (err: any) {
      alert("Failed to connect MCP server: " + err.message);
    } finally {
      setSavingMcp(false);
    }
  };

  const handleSyncMcp = async (id: string) => {
    if (!session?.access_token) return;
    setSyncingMcpId(id);
    try {
      const res = await agentService.syncMcpServer(session.access_token, id);
      alert(`Synced ${res.toolsCount} tools from MCP server!`);
      loadData();
    } catch (err: any) {
      alert("Sync failed: " + err.message);
    } finally {
      setSyncingMcpId(null);
    }
  };

  const handleDeleteMcp = async (id: string, name: string) => {
    if (!session?.access_token) return;
    if (!confirm(`Disconnect MCP Server "${name}" and remove its registered tools?`)) return;
    try {
      await agentService.deleteMcpServer(session.access_token, id);
      loadData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleDeleteTool = async (key: string, name: string) => {
    if (!session?.access_token) return;
    if (!confirm(`Delete tool "${name}" (${key})?`)) return;
    try {
      await agentService.deleteCustomTool(session.access_token, key);
      loadData();
    } catch (err: any) {
      alert("Delete tool failed: " + err.message);
    }
  };

  const handleRegisterCustomProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || savingCustomProvider) return;
    setSavingCustomProvider(true);
    try {
      const extra = customOtherModels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await aiService.registerCustomProvider(session.access_token, {
        id: customId,
        name: customName,
        baseUrl: customBaseUrl,
        apiKey: customApiKey || undefined,
        defaultModel: customDefaultModel,
        supportedModels: extra,
      });
      setProviders(res.providers);
      try {
        const stored = localStorage.getItem("sevents_custom_providers");
        const list = stored ? JSON.parse(stored) : [];
        const itemToStore = {
          ...res.provider,
          apiKey: customApiKey || undefined,
        };
        const updated = [...list.filter((c: any) => c.id !== res.provider.id), itemToStore];
        localStorage.setItem("sevents_custom_providers", JSON.stringify(updated));
      } catch {}
      setShowAddCustomProviderModal(false);
      setCustomId("");
      setCustomName("");
      setCustomBaseUrl("");
      setCustomApiKey("");
      setCustomDefaultModel("");
      setCustomOtherModels("");
      alert(`Custom provider "${res.provider.name}" registered successfully.`);
    } catch (err: any) {
      alert("Failed to register custom provider: " + err.message);
    } finally {
      setSavingCustomProvider(false);
    }
  };

  const handleDeleteCustomProvider = async (providerId: string) => {
    if (!session?.access_token) return;
    if (!confirm(`Are you sure you want to remove custom provider "${providerId}"?`)) return;
    try {
      const updated = await aiService.deleteCustomProvider(session.access_token, providerId);
      setProviders(updated);
      try {
        const stored = localStorage.getItem("sevents_custom_providers");
        if (stored) {
          const list = JSON.parse(stored);
          localStorage.setItem("sevents_custom_providers", JSON.stringify(list.filter((c: any) => c.id !== providerId)));
        }
      } catch {}
      if (activeProviderId === providerId) {
        setActiveProviderId("openai");
      }
    } catch (err: any) {
      alert("Failed to remove provider: " + err.message);
    }
  };

  const handleAddModelToProvider = async (providerId: string) => {
    if (!session?.access_token || !newModelInput.trim() || savingNewModel) return;
    setSavingNewModel(true);
    try {
      const updated = await aiService.addModel(session.access_token, providerId, newModelInput.trim());
      setProviders(updated);
      try {
        const stored = localStorage.getItem("sevents_custom_providers");
        if (stored) {
          const list: ProviderMeta[] = JSON.parse(stored);
          const target = list.find((c) => c.id === providerId);
          if (target && !target.supportedModels.includes(newModelInput.trim())) {
            target.supportedModels.push(newModelInput.trim());
            localStorage.setItem("sevents_custom_providers", JSON.stringify(list));
          }
        }
      } catch {}
      setActiveAddingModelProviderId(null);
      setNewModelInput("");
    } catch (err: any) {
      alert("Failed to add model: " + err.message);
    } finally {
      setSavingNewModel(false);
    }
  };

  const handleRunAgent = async (presetPrompt?: string) => {
    const promptToSend = (presetPrompt || consolePrompt).trim();
    if (!promptToSend || !selectedAgentId || !session?.access_token || runningAgent) return;

    const currentAgent = agents.find((a) => a.id === selectedAgentId);

    setRunningAgent(true);
    try {
      const exec = await agentService.runAgent(
        session.access_token,
        selectedAgentId,
        promptToSend,
        undefined,
        undefined,
        currentAgent?.model,
        currentAgent?.system_prompt
      );
      setActiveExecution(exec);
      setConsolePrompt("");
      // Refresh execution history
      const updatedExecs = await agentService.listExecutions(session.access_token);
      setExecutions(updatedExecs);
    } catch (err: any) {
      alert("Execution error: " + err.message);
    } finally {
      setRunningAgent(false);
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (!activeExecution || !session?.access_token || approving) return;
    setApproving(true);
    try {
      const resumed = await agentService.approveAction(
        session.access_token,
        activeExecution.id,
        approved,
        approved ? undefined : rejectionReason
      );
      setActiveExecution(resumed);
      setIsRejecting(false);
      setRejectionReason("");
      const updatedExecs = await agentService.listExecutions(session.access_token);
      setExecutions(updatedExecs);
    } catch (err: any) {
      alert("Failed to process approval: " + err.message);
    } finally {
      setApproving(false);
    }
  };

  const handleOpenCreateModal = (agentToEdit?: AgentDefinition) => {
    if (agentToEdit) {
      setEditingAgent(agentToEdit);
      setFormKey(agentToEdit.key);
      setFormName(agentToEdit.name);
      setFormDesc(agentToEdit.description || "");
      setFormPrompt(agentToEdit.system_prompt);
      setFormModel(agentToEdit.model);
      const isKnown = providers.some((p) => p.supportedModels.includes(agentToEdit.model));
      setUseCustomModelInput(!isKnown);
      setFormTemp(agentToEdit.temperature);
      setFormRole(agentToEdit.canonical_role_id || "");
      setFormTools(agentToEdit.allowed_tools || []);
      setFormHitl(agentToEdit.hitl_policy);
    } else {
      setEditingAgent(null);
      setFormKey(`agent.custom_${Date.now().toString().slice(-4)}`);
      setFormName("");
      setFormDesc("");
      setFormPrompt("You are an expert construction AI agent. Follow SEVENTS policies strictly.");
      setFormModel("gpt-4o-mini");
      setUseCustomModelInput(false);
      setFormTemp(0.2);
      setFormRole("role.site_engineer");
      setFormTools(["search_knowledge_base"]);
      setFormHitl("require_for_mutations");
    }
    setIsModalOpen(true);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !formKey || !formName || !formPrompt) return;

    const updatedFields: Partial<AgentDefinition> = {
      name: formName,
      description: formDesc,
      system_prompt: formPrompt,
      model: formModel,
      temperature: formTemp,
      canonical_role_id: formRole || null,
      allowed_tools: formTools,
      hitl_policy: formHitl,
    };

    setSavingAgent(true);
    try {
      if (editingAgent) {
        try {
          const storedOverrides = localStorage.getItem("sevents_agent_overrides");
          const overrides: Record<string, Partial<AgentDefinition>> = storedOverrides
            ? JSON.parse(storedOverrides)
            : {};
          overrides[editingAgent.id] = updatedFields;
          localStorage.setItem("sevents_agent_overrides", JSON.stringify(overrides));
        } catch {}

        setAgents((prev) =>
          prev.map((a) => (a.id === editingAgent.id ? ({ ...a, ...updatedFields } as AgentDefinition) : a))
        );

        await agentService.updateAgent(session.access_token, editingAgent.id, {
          name: formName,
          description: formDesc,
          systemPrompt: formPrompt,
          model: formModel,
          temperature: formTemp,
          canonicalRoleId: formRole || undefined,
          allowedTools: formTools,
          hitlPolicy: formHitl,
        });
      } else {
        const created = await agentService.createAgent(session.access_token, {
          key: formKey,
          name: formName,
          description: formDesc,
          systemPrompt: formPrompt,
          model: formModel,
          temperature: formTemp,
          canonicalRoleId: formRole || undefined,
          allowedTools: formTools,
          hitlPolicy: formHitl,
        });
        try {
          const storedOverrides = localStorage.getItem("sevents_agent_overrides");
          const overrides: Record<string, Partial<AgentDefinition>> = storedOverrides
            ? JSON.parse(storedOverrides)
            : {};
          overrides[created.id] = { ...created };
          localStorage.setItem("sevents_agent_overrides", JSON.stringify(overrides));
        } catch {}
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      alert("Failed to save agent profile: " + err.message);
    } finally {
      setSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (id: string, name: string) => {
    if (!session?.access_token) return;
    if (!confirm(`Are you sure you want to delete agent profile "${name}"?`)) return;
    try {
      await agentService.deleteAgent(session.access_token, id);
      try {
        const storedOverrides = localStorage.getItem("sevents_agent_overrides");
        if (storedOverrides) {
          const overrides = JSON.parse(storedOverrides);
          delete overrides[id];
          localStorage.setItem("sevents_agent_overrides", JSON.stringify(overrides));
        }
      } catch {}
      setAgents((prev) => prev.filter((a) => a.id !== id));
      if (selectedAgentId === id && agents.length > 1) {
        setSelectedAgentId(agents.find((a) => a.id !== id)?.id || "");
      }
    } catch (err: any) {
      alert("Failed to delete agent: " + err.message);
    }
  };

  const toggleToolInForm = (toolKey: string) => {
    setFormTools((prev) =>
      prev.includes(toolKey) ? prev.filter((k) => k !== toolKey) : [...prev, toolKey]
    );
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              AI Agent Studio &amp; Tool Registry
            </h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Configure autonomous construction agents, bind scoped operational tools, and enforce Human-In-The-Loop approval checkpoints.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <Link
            to="/ai/runs"
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 shadow-xs transition-colors"
          >
            <span>📊</span> Runs &amp; Audit
          </Link>
          <button
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 shadow-xs transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Agent Profile
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200">
        <button
          onClick={() => setActiveTab("studio")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "studio"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Agent Studio ({agents.length})
        </button>
        <button
          onClick={() => setActiveTab("console")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "console"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Interactive Console &amp; HITL Gate
          {executions.some((e) => e.status === "paused_waiting_approval") && (
            <span className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white animate-pulse">
              Pending
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("tools")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "tools"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Tool Registry ({tools.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "audit"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          Execution History &amp; Audit ({executions.length})
        </button>
        <button
          onClick={() => setActiveTab("providers")}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "providers"
              ? "border-zinc-900 text-zinc-900"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          AI Providers &amp; Adapters ({providers.length || 5})
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-sm text-zinc-500">Loading Agent Studio data...</div>
      ) : error ? (
        <div className="p-6 text-center text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
          {error}
        </div>
      ) : (
        <>
          {/* TAB 1: AGENT STUDIO CARDS */}
          {activeTab === "studio" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs hover:border-zinc-300 transition-all"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-bold text-zinc-900 text-base">{agent.name}</h3>
                        <p className="font-mono text-[11px] text-zinc-400">{agent.key}</p>
                      </div>
                      <span className="rounded-md bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-mono font-medium text-zinc-600">
                        {agent.model}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-600 mb-4 line-clamp-2">
                      {agent.description || "Autonomous construction copilot agent."}
                    </p>

                    <div className="space-y-2 text-xs border-t border-zinc-100 pt-3">
                      <div className="flex items-center justify-between text-zinc-500">
                        <span>Role Scoping:</span>
                        <span className="font-mono text-zinc-700 font-medium">
                          {agent.canonical_role_id || "Unrestricted"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-500">
                        <span>HITL Policy:</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            agent.hitl_policy === "always"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : agent.hitl_policy === "require_for_mutations"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {agent.hitl_policy.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                        Permitted Tools ({agent.allowed_tools.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {agent.allowed_tools.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenCreateModal(agent)}
                        className="rounded p-1 text-zinc-400 hover:text-zinc-700"
                        title="Edit profile"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteAgent(agent.id, agent.name)}
                        className="rounded p-1 text-zinc-400 hover:text-rose-600"
                        title="Delete agent"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setActiveTab("console");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      <span>Run Agent</span>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2: INTERACTIVE CONSOLE & HITL CHECKPOINT */}
          {activeTab === "console" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Agent Selector & Setup Column */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-2">
                    Active Agent
                  </label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 p-2.5 text-sm font-semibold text-zinc-800 focus:border-brand focus:outline-none"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.key})
                      </option>
                    ))}
                  </select>

                  {selectedAgent && (
                    <div className="mt-4 space-y-2 text-xs border-t border-zinc-100 pt-3">
                      <div>
                        <span className="text-zinc-400 block">System Persona:</span>
                        <p className="font-mono text-[11px] text-zinc-700 bg-zinc-50 p-2 rounded border border-zinc-100 mt-1 line-clamp-3">
                          {selectedAgent.system_prompt}
                        </p>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Model:</span>
                        <span className="font-mono font-medium">{selectedAgent.model}</span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>HITL Policy:</span>
                        <span className="font-semibold text-amber-700 capitalize">
                          {selectedAgent.hitl_policy.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preset Prompt Actions */}
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs">
                  <p className="text-xs font-bold uppercase text-zinc-500 mb-3">
                    Sample Test Prompts
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() =>
                        handleRunAgent("Draft an RFI regarding Level 12 beam rebar clash with MEP duct")
                      }
                      className="w-full text-left rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900 hover:bg-amber-100 transition-colors"
                    >
                      <div className="flex items-center gap-1 font-semibold text-amber-800">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        Trigger Mutation HITL Gate
                      </div>
                      <p className="mt-0.5 text-[11px] text-amber-700">
                        "Draft an RFI regarding Level 12 beam rebar clash..."
                      </p>
                    </button>

                    <button
                      onClick={() =>
                        handleRunAgent("Check warehouse stock for Rebar T25 against threshold")
                      }
                      className="w-full text-left rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-800 hover:bg-zinc-100 transition-colors"
                    >
                      <span className="font-semibold text-blue-700">Safe Read Tool:</span> Check Inventory
                      Stock
                    </button>

                    <button
                      onClick={() =>
                        handleRunAgent("Calculate critical path delay impact for 10 days delay on site")
                      }
                      className="w-full text-left rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 text-xs text-zinc-800 hover:bg-zinc-100 transition-colors"
                    >
                      <span className="font-semibold text-emerald-700">Safe Read Tool:</span> Delay &amp;
                      Overhead Calculation
                    </button>
                  </div>
                </div>
              </div>

              {/* Execution Thread & HITL Action Column */}
              <div className="lg:col-span-2 flex flex-col rounded-2xl border border-zinc-200/80 bg-white shadow-xs overflow-hidden h-[620px]">
                {/* Console Header */}
                <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-900 px-6 py-3.5 text-white">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="font-bold text-sm">
                      {selectedAgent?.name || "Agent Console"}
                    </span>
                  </div>
                  {activeExecution && (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                        activeExecution.status === "paused_waiting_approval"
                          ? "bg-amber-500 text-white animate-pulse"
                          : activeExecution.status === "completed"
                          ? "bg-emerald-600 text-white"
                          : activeExecution.status === "rejected"
                          ? "bg-rose-600 text-white"
                          : "bg-zinc-700 text-zinc-200"
                      }`}
                    >
                      {activeExecution.status.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                {/* Messages Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-stone-50/50">
                  {!activeExecution ? (
                    <div className="flex h-full items-center justify-center text-center p-8 text-zinc-400">
                      <div>
                        <svg className="mx-auto h-12 w-12 text-zinc-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <p className="font-semibold text-zinc-700">Agent Console Ready</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          Select a prompt from the left or enter instructions below.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {activeExecution.messages.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                        >
                          <span className="text-[10px] text-zinc-400 mb-0.5 px-1 uppercase font-semibold">
                            {m.role === "user"
                              ? "You"
                              : m.role === "tool"
                              ? `Tool Result [${m.toolName}]`
                              : selectedAgent?.name || "Assistant"}
                          </span>
                          <div
                            className={`rounded-2xl px-4 py-3 text-xs leading-relaxed max-w-[90%] shadow-xs ${
                              m.role === "user"
                                ? "bg-zinc-900 text-white rounded-tr-xs"
                                : m.role === "tool"
                                ? "bg-zinc-800 font-mono text-zinc-200 rounded-tl-xs overflow-x-auto whitespace-pre"
                                : "bg-white text-zinc-800 border border-zinc-200 rounded-tl-xs whitespace-pre-wrap"
                            }`}
                          >
                            {m.content}
                          </div>
                        </div>
                      ))}

                      {/* PROMINENT HUMAN-IN-THE-LOOP APPROVAL BANNER */}
                      {activeExecution.status === "paused_waiting_approval" &&
                        activeExecution.pending_action && (
                          <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 p-5 shadow-md">
                            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-1">
                              <span className="h-3 w-3 rounded-full bg-amber-500 animate-ping" />
                              <span>Human-In-The-Loop Approval Checkpoint</span>
                            </div>
                            <p className="text-xs text-amber-800 mb-3">
                              Agent paused execution because <strong>"{activeExecution.pending_action.toolName}"</strong> modifies project state. Review the proposed action below:
                            </p>

                            <div className="rounded-xl border border-amber-200 bg-white p-3 font-mono text-xs text-zinc-800 mb-3 max-h-48 overflow-y-auto">
                              <div className="text-[10px] uppercase font-bold text-zinc-400 mb-1">
                                Proposed Tool Payload
                              </div>
                              {JSON.stringify(activeExecution.pending_action.input, null, 2)}
                            </div>

                            <p className="text-xs text-zinc-600 mb-4">
                              <strong>Rationale:</strong> {activeExecution.pending_action.rationale}
                            </p>

                            {isRejecting ? (
                              <div className="space-y-2 border-t border-amber-200 pt-3">
                                <label className="block text-xs font-semibold text-zinc-700">
                                  Rejection Explanation for Agent Audit
                                </label>
                                <textarea
                                  rows={2}
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  placeholder="State why this action cannot be executed..."
                                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none bg-white"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => setIsRejecting(false)}
                                    className="rounded-lg px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleApproval(false)}
                                    disabled={approving}
                                    className="rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                                  >
                                    Confirm Rejection
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-3 pt-2 border-t border-amber-200">
                                <button
                                  onClick={() => setIsRejecting(true)}
                                  className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                >
                                  Reject Action
                                </button>
                                <button
                                  onClick={() => handleApproval(true)}
                                  disabled={approving}
                                  className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition-all"
                                >
                                  {approving ? "Executing Action..." : "Approve & Execute Action"}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                    </>
                  )}
                </div>

                {/* Console Input Bar */}
                <div className="border-t border-zinc-200 bg-white p-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRunAgent();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={consolePrompt}
                      onChange={(e) => setConsolePrompt(e.target.value)}
                      placeholder="Instruct agent (e.g. check stock, evaluate delay, draft RFI)..."
                      disabled={runningAgent}
                      className="flex-1 rounded-xl border border-zinc-300 px-4 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:border-brand focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={runningAgent || !consolePrompt.trim()}
                      className="rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white hover:bg-zinc-800 disabled:opacity-40"
                    >
                      {runningAgent ? "Running Agent..." : "Send Prompt"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TOOL REGISTRY & MCP SERVERS */}
          {activeTab === "tools" && (
            <div className="space-y-6">
              {/* Top Controls Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-xs">
                <div>
                  <h3 className="font-bold text-zinc-900 text-sm">Model Context Protocol (MCP) &amp; Tool Capabilities</h3>
                  <p className="text-xs text-zinc-500">
                    Connect internal microservices or external systems (Revit BIM, Primavera P6, ERP) via standard MCP servers or webhooks
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddCustomToolModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-xs hover:bg-zinc-50"
                  >
                    + Register Custom Tool
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddMcpModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800"
                  >
                    + Connect MCP Server
                  </button>
                </div>
              </div>

              {/* Connected MCP Servers Section */}
              {mcpServers.length > 0 && (
                <div className="rounded-2xl border border-zinc-200/80 bg-stone-50/60 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Active MCP Server Connections ({mcpServers.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {mcpServers.map((srv) => (
                      <div key={srv.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-xs text-zinc-900">{srv.name}</span>
                            <span className="rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 border border-emerald-200">
                              {srv.transport.toUpperCase()}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-zinc-400 truncate mb-1">{srv.url}</p>
                          {srv.description && <p className="text-xs text-zinc-500 mb-2">{srv.description}</p>}
                          <p className="text-[11px] text-zinc-400">
                            Discovered Tools: <span className="font-semibold text-zinc-700">{srv.cached_tools?.length || 0}</span>
                          </p>
                        </div>
                        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-zinc-100">
                          <button
                            type="button"
                            onClick={() => handleSyncMcp(srv.id)}
                            disabled={syncingMcpId === srv.id}
                            className="text-xs font-semibold text-brand hover:underline disabled:opacity-50"
                          >
                            {syncingMcpId === srv.id ? "Syncing..." : "Sync Tools ⟳"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMcp(srv.id, srv.name)}
                            className="text-xs font-medium text-rose-600 hover:underline ml-2"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tools.map((t) => (
                <div
                  key={t.key}
                  className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="rounded bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-700">
                        {t.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {t.is_mutation ? (
                          <span className="rounded bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                            State-Modifying (Requires HITL)
                          </span>
                        ) : (
                          <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            Read-Only (Auto-Allowed)
                          </span>
                        )}
                        {t.is_custom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTool(t.key, t.name)}
                            className="text-zinc-400 hover:text-rose-600 text-xs px-1"
                            title="Delete custom tool"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="font-bold text-zinc-900 text-sm">{t.name}</h3>
                    <p className="font-mono text-[11px] text-zinc-400 mb-2">{t.key}</p>
                    <p className="text-xs text-zinc-600 mb-3">{t.description}</p>

                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
                      <span>Permission Required:</span>
                      <span className="font-mono text-[11px] text-zinc-700 bg-zinc-50 px-1.5 py-0.5 rounded border">
                        {t.required_permission}
                      </span>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <span className="text-[10px] font-semibold uppercase text-zinc-400 block mb-1">
                        JSON Parameter Schema
                      </span>
                      <pre className="font-mono text-[10px] text-zinc-700 overflow-x-auto">
                        {JSON.stringify(t.schema, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIT TRAIL & EXECUTION HISTORY */}
          {activeTab === "audit" && (
            <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-3.5">Execution ID &amp; Time</th>
                      <th className="px-6 py-3.5">Agent</th>
                      <th className="px-6 py-3.5">Input Prompt</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Audit Trail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {executions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-zinc-400">
                          No agent executions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      executions.map((exec) => {
                        const agent = agents.find((a) => a.id === exec.agent_id);
                        return (
                          <tr key={exec.id} className="hover:bg-zinc-50/60 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-mono font-medium text-zinc-900 block truncate max-w-[140px]">
                                {exec.id}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {new Date(exec.created_at).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-semibold text-zinc-800">
                              {agent?.name || "Copilot Agent"}
                            </td>
                            <td className="px-6 py-4 text-zinc-700 max-w-xs truncate">
                              {exec.input_prompt}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  exec.status === "completed"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : exec.status === "paused_waiting_approval"
                                    ? "bg-amber-100 text-amber-800"
                                    : exec.status === "rejected"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-zinc-100 text-zinc-700"
                                }`}
                              >
                                {exec.status.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => setSelectedAuditExec(exec)}
                                className="rounded-lg bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors"
                              >
                                View Log ({exec.messages.length})
                              </button>
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

          {/* TAB 5: AI PROVIDERS & ADAPTERS */}
          {activeTab === "providers" && (
            <div className="space-y-6">
              {/* Architecture Intro */}
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-900">
                    Pluggable Multi-Provider AI Architecture
                  </h2>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    SEVENTS OS supports pluggable cloud LLMs, air-gapped local engines, and custom OpenAI-compatible providers (Groq, DeepSeek, Ollama, OpenRouter).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 rounded-xl bg-indigo-50 border border-indigo-200 px-3.5 py-2 text-xs text-indigo-900">
                    <span className="text-zinc-500 font-medium">Active Engine:</span>
                    <span className="font-bold uppercase tracking-wider text-indigo-700 bg-white px-2.5 py-0.5 rounded shadow-xs border border-indigo-100">
                      {activeProviderId}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAddCustomProviderModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 shadow-xs transition-colors"
                  >
                    <span>+</span> Add Custom AI Provider
                  </button>
                </div>
              </div>

              {/* Providers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {(providers.length > 0
                  ? providers
                  : [
                      {
                        id: "openai",
                        name: "OpenAI",
                        defaultModel: "gpt-4o-mini",
                        supportedModels: ["gpt-4o-mini", "gpt-4o", "text-embedding-3-small"],
                        isConfigured: false,
                        requiresKey: true,
                        isCustom: false,
                      },
                      {
                        id: "gemini",
                        name: "Google Gemini",
                        defaultModel: "gemini-1.5-flash",
                        supportedModels: ["gemini-1.5-flash", "gemini-1.5-pro", "text-embedding-004"],
                        isConfigured: false,
                        requiresKey: true,
                        isCustom: false,
                      },
                      {
                        id: "anthropic",
                        name: "Anthropic Claude",
                        defaultModel: "claude-3-5-sonnet-20241022",
                        supportedModels: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
                        isConfigured: false,
                        requiresKey: true,
                        isCustom: false,
                      },
                      {
                        id: "azure",
                        name: "Azure OpenAI",
                        defaultModel: "gpt-4o",
                        supportedModels: ["gpt-4o", "text-embedding-3-small"],
                        isConfigured: false,
                        requiresKey: true,
                        isCustom: false,
                      },
                      {
                        id: "openrouter",
                        name: "OpenRouter",
                        defaultModel: "openrouter/free",
                        supportedModels: [
                          "openrouter/free",
                          "meta-llama/llama-3.3-70b-instruct:free",
                          "deepseek/deepseek-r1:free",
                          "google/gemini-2.0-flash-exp:free",
                          "mistralai/mistral-7b-instruct:free",
                          "qwen/qwen-2.5-coder-32b-instruct:free",
                        ],
                        isConfigured: false,
                        requiresKey: true,
                        isCustom: false,
                      },
                      {
                        id: "local",
                        name: "SEVENTS Local Engine",
                        defaultModel: "sevents-local-v1",
                        supportedModels: ["sevents-local-v1", "deterministic-1536"],
                        isConfigured: true,
                        requiresKey: false,
                        isCustom: false,
                      },
                    ]
                ).map((prov) => {
                  const testRes = providerTestResults[prov.id];
                  const isTesting = providerTestingId === prov.id;
                  const isActive = prov.id === activeProviderId;

                  return (
                    <div
                      key={prov.id}
                      className={`rounded-2xl border bg-white p-5 shadow-xs flex flex-col justify-between transition-all ${
                        isActive
                          ? "border-emerald-500 ring-2 ring-emerald-500/20"
                          : "border-zinc-200/80 hover:border-zinc-300"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-zinc-900 text-base">{prov.name}</h3>
                            {isActive && (
                              <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-300">
                                ACTIVE
                              </span>
                            )}
                            {prov.isCustom && (
                              <span className="rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 border border-purple-200">
                                Custom
                              </span>
                            )}
                          </div>
                          {prov.isConfigured ? (
                            <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              Configured
                            </span>
                          ) : prov.requiresKey ? (
                            <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              API Key Pending
                            </span>
                          ) : (
                            <span className="rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                              Built-in (Offline)
                            </span>
                          )}
                        </div>

                        {prov.baseUrl && (
                          <div className="mb-2 text-[11px] font-mono text-zinc-500 truncate" title={prov.baseUrl}>
                            URL: {prov.baseUrl}
                          </div>
                        )}

                        <div className="space-y-2 text-xs mb-4">
                          <div className="flex justify-between text-zinc-500">
                            <span>Default Model:</span>
                            <span className="font-mono font-medium text-zinc-800">
                              {prov.defaultModel}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-zinc-500 font-medium">Supported Models:</span>
                              <button
                                onClick={() => {
                                  setActiveAddingModelProviderId(
                                    activeAddingModelProviderId === prov.id ? null : prov.id
                                  );
                                  setNewModelInput("");
                                }}
                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                              >
                                {activeAddingModelProviderId === prov.id ? "Cancel" : "+ Add Model"}
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {prov.supportedModels.map((m) => (
                                <span
                                  key={m}
                                  className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-zinc-700"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                            {activeAddingModelProviderId === prov.id && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <input
                                  type="text"
                                  placeholder="Model ID (e.g. gpt-4.5, deepseek-r1)"
                                  value={newModelInput}
                                  onChange={(e) => setNewModelInput(e.target.value)}
                                  className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs w-full focus:outline-none focus:border-indigo-500"
                                />
                                <button
                                  onClick={() => handleAddModelToProvider(prov.id)}
                                  disabled={savingNewModel || !newModelInput.trim()}
                                  className="rounded-lg bg-indigo-600 text-white px-3 py-1 text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  Save
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Test Result Display */}
                        {testRes && (
                          <div
                            className={`rounded-xl p-3 text-xs mb-3 border ${
                              testRes.ok
                                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                : "bg-rose-50 border-rose-200 text-rose-800"
                            }`}
                          >
                            <div className="flex items-center justify-between font-semibold mb-0.5">
                              <span>{testRes.ok ? "Connected" : "Failed"}</span>
                              <span className="font-mono text-[10px]">{testRes.latencyMs}ms</span>
                            </div>
                            <p className="text-[11px] leading-tight">{testRes.message}</p>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-zinc-100 pt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] text-zinc-400 font-mono">
                          Adapter: {prov.id}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {prov.isCustom && (
                            <button
                              onClick={() => handleDeleteCustomProvider(prov.id)}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
                              title="Delete custom provider"
                            >
                              Delete
                            </button>
                          )}
                          <button
                            onClick={() => handleTestProvider(prov.id)}
                            disabled={isTesting}
                            className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 transition-colors shadow-2xs"
                          >
                            {isTesting ? "Testing..." : "Test"}
                          </button>
                          {isActive ? (
                            <span className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs">
                              ✓ Active Provider
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSelectActiveProvider(prov.id)}
                              disabled={switchingProvider}
                              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow-2xs"
                            >
                              {switchingProvider ? "Switching..." : "Select Provider"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Configuration Guide */}
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-900 text-white p-6 shadow-xs">
                <h3 className="font-bold text-sm text-white mb-2">
                  Environment Configuration Reference (.env)
                </h3>
                <p className="text-xs text-zinc-400 mb-3">
                  Configure your primary provider and credentials in your deployment environment or container secrets:
                </p>
                <div className="rounded-xl bg-zinc-800 p-4 font-mono text-xs text-zinc-200 overflow-x-auto">
                  <p className="text-zinc-400"># Active Provider: "openai" | "gemini" | "anthropic" | "azure" | "local"</p>
                  <p>AI_DEFAULT_PROVIDER=openai</p>
                  <p className="mt-2 text-zinc-400"># Provider Credentials:</p>
                  <p>OPENAI_API_KEY=sk-proj-...</p>
                  <p>GEMINI_API_KEY=AIzaSy...</p>
                  <p>ANTHROPIC_API_KEY=sk-ant-...</p>
                  <p className="mt-2 text-zinc-400"># Azure OpenAI (Enterprise Private Cloud):</p>
                  <p>AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/</p>
                  <p>AZURE_OPENAI_API_KEY=...</p>
                  <p>AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* CREATE / EDIT AGENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-900 px-6 py-4 text-white">
              <h3 className="font-bold text-white text-base">
                {editingAgent ? "Edit Agent Profile" : "Create New AI Agent Profile"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveAgent} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Agent Key *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingAgent}
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    placeholder="e.g. agent.cost_estimator"
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none disabled:bg-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Cost & BOQ Estimator"
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Primary role and scope of this copilot..."
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                  System Persona Prompt *
                </label>
                <textarea
                  rows={4}
                  required
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  placeholder="Define role instructions, tone, and domain guardrails..."
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs font-mono focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase text-zinc-500">
                      Model
                    </label>
                    <button
                      type="button"
                      onClick={() => setUseCustomModelInput(!useCustomModelInput)}
                      className="text-[10px] text-brand hover:underline font-medium"
                    >
                      {useCustomModelInput ? "Select from list" : "✏️ Custom model"}
                    </button>
                  </div>
                  {useCustomModelInput ? (
                    <div>
                      <input
                        type="text"
                        value={formModel}
                        onChange={(e) => setFormModel(e.target.value)}
                        placeholder="e.g. openrouter/free, mistralai/mistral-7b"
                        className="w-full rounded-lg border border-zinc-300 p-2 text-xs font-mono focus:border-brand focus:outline-none"
                      />
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="text-[10px] text-zinc-400">Quick:</span>
                        {[
                          "openrouter/free",
                          "meta-llama/llama-3.3-70b-instruct:free",
                          "deepseek/deepseek-r1:free",
                          "gpt-4o-mini",
                          "gemini-1.5-flash",
                        ].map((qm) => (
                          <button
                            key={qm}
                            type="button"
                            onClick={() => setFormModel(qm)}
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              formModel === qm
                                ? "bg-brand text-white font-medium"
                                : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600"
                            }`}
                          >
                            {qm.replace(":free", "")}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <select
                      value={formModel}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setUseCustomModelInput(true);
                        } else {
                          setFormModel(e.target.value);
                        }
                      }}
                      className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                    >
                      {providers.map((prov) => (
                        <optgroup key={prov.id} label={`${prov.name} (${prov.id})`}>
                          {prov.supportedModels.map((m) => (
                            <option key={`${prov.id}-${m}`} value={m}>
                              {m} {m === prov.defaultModel ? "— (Default)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      {!providers.some((p) => p.supportedModels.includes(formModel)) && (
                        <optgroup label="Current Custom Model">
                          <option value={formModel}>{formModel}</option>
                        </optgroup>
                      )}
                      <option value="__custom__">➕ Enter custom model name...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Temperature ({formTemp})
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={formTemp}
                    onChange={(e) => setFormTemp(parseFloat(e.target.value))}
                    className="w-full mt-2"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    HITL Policy
                  </label>
                  <select
                    value={formHitl}
                    onChange={(e) => setFormHitl(e.target.value as HitlPolicy)}
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                  >
                    <option value="require_for_mutations">Require for Mutations</option>
                    <option value="always">Always Require Approval</option>
                    <option value="never">Autonomous / Never</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-2">
                  Permitted Tools ({formTools.length} selected)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-zinc-200 rounded-xl p-3 bg-zinc-50">
                  {tools.map((t) => (
                    <label
                      key={t.key}
                      className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formTools.includes(t.key)}
                        onChange={() => toggleToolInForm(t.key)}
                        className="rounded border-zinc-300 text-brand focus:ring-brand"
                      />
                      <span>{t.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAgent}
                  className="rounded-lg bg-zinc-900 px-5 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
                >
                  {savingAgent ? "Saving..." : editingAgent ? "Save Changes" : "Create Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONNECT MCP SERVER MODAL */}
      {showAddMcpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Connect Model Context Protocol (MCP) Server</h3>
                <p className="text-xs text-zinc-400">Expose external tools to your AI agents automatically</p>
              </div>
              <button onClick={() => setShowAddMcpModal(false)} className="text-zinc-400 hover:text-zinc-700 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveMcpServer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Server Name *</label>
                <input
                  type="text"
                  required
                  value={mcpName}
                  onChange={(e) => setMcpName(e.target.value)}
                  placeholder="e.g. Autodesk BIM 360 MCP, Primavera Engine, SAP ERP"
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Server Endpoint URL *</label>
                <input
                  type="url"
                  required
                  value={mcpUrl}
                  onChange={(e) => setMcpUrl(e.target.value)}
                  placeholder="e.g. http://localhost:8080/mcp or https://mcp.company.internal/tools"
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Bearer API Key / Token (Optional)</label>
                <input
                  type="password"
                  value={mcpApiKey}
                  onChange={(e) => setMcpApiKey(e.target.value)}
                  placeholder="Optional auth token"
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={mcpDesc}
                  onChange={(e) => setMcpDesc(e.target.value)}
                  placeholder="Brief note on what capabilities this server provides..."
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddMcpModal(false)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingMcp}
                  className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {savingMcp ? "Connecting & Discovering..." : "Connect & Discover Tools"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER CUSTOM TOOL MODAL */}
      {showAddCustomToolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-zinc-900 text-sm">Register Custom Tool / Webhook</h3>
                <p className="text-xs text-zinc-400">Give AI agents a new action capability with an HTTP webhook</p>
              </div>
              <button onClick={() => setShowAddCustomToolModal(false)} className="text-zinc-400 hover:text-zinc-700 text-sm font-bold">✕</button>
            </div>
            <form onSubmit={handleSaveCustomTool} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Tool Unique Key *</label>
                  <input
                    type="text"
                    required
                    value={toolKey}
                    onChange={(e) => setToolKey(e.target.value)}
                    placeholder="e.g. query_external_erp"
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={toolCategory}
                    onChange={(e) => setToolCategory(e.target.value)}
                    placeholder="e.g. finance, bim, legal"
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Human-Readable Name *</label>
                <input
                  type="text"
                  required
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                  placeholder="e.g. Query SAP Supplier Ledger"
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Description (Instructs the LLM when to use this) *</label>
                <textarea
                  required
                  rows={2}
                  value={toolDesc}
                  onChange={(e) => setToolDesc(e.target.value)}
                  placeholder="Explain clearly what this tool queries or executes so the AI picks it at the right time..."
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">Webhook Dispatch URL (Optional)</label>
                <input
                  type="url"
                  value={toolWebhook}
                  onChange={(e) => setToolWebhook(e.target.value)}
                  placeholder="https://api.internal.com/ai/tools/handler"
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="toolIsMutation"
                  checked={toolIsMutation}
                  onChange={(e) => setToolIsMutation(e.target.checked)}
                  className="h-4 w-4 rounded text-brand focus:ring-brand"
                />
                <label htmlFor="toolIsMutation" className="text-xs text-zinc-700 font-medium">
                  State-Modifying Action (Requires Human Review approval before execution)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddCustomToolModal(false)}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomTool}
                  className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {savingCustomTool ? "Registering..." : "Save Tool"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL */}
      {selectedAuditExec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-900 px-6 py-4 text-white">
              <div>
                <h3 className="font-bold text-white text-base">Execution Audit Trail</h3>
                <p className="font-mono text-xs text-zinc-400">{selectedAuditExec.id}</p>
              </div>
              <button
                onClick={() => setSelectedAuditExec(null)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto bg-stone-50/50">
              <div className="grid grid-cols-3 gap-2 text-xs border-b border-zinc-200 pb-3 bg-white p-3 rounded-xl border">
                <div>
                  <span className="text-zinc-400 block">Status</span>
                  <span className="font-bold uppercase text-zinc-800">
                    {selectedAuditExec.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Executed At</span>
                  <span className="text-zinc-800">
                    {new Date(selectedAuditExec.created_at).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400 block">Messages Recorded</span>
                  <span className="font-bold text-zinc-800">
                    {selectedAuditExec.messages.length}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {selectedAuditExec.messages.map((m, idx) => (
                  <div key={idx} className="rounded-xl border border-zinc-200 bg-white p-4 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold uppercase text-zinc-700 text-[10px]">
                        {m.role} {m.toolName ? `[${m.toolName}]` : ""}
                      </span>
                      <span className="text-[10px] text-zinc-400">{m.timestamp}</span>
                    </div>
                    <div className="whitespace-pre-wrap font-mono text-[11px] text-zinc-800">
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end border-t border-zinc-100 bg-zinc-50 px-6 py-3">
              <button
                onClick={() => setSelectedAuditExec(null)}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Custom AI Provider Registration Modal */}
      {showAddCustomProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-900 px-6 py-4 text-white">
              <div>
                <h3 className="font-bold text-white text-base">
                  Register Custom AI Provider
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Connect any OpenAI-compatible engine (Groq, DeepSeek, Ollama, OpenRouter, Mistral, vLLM).
                </p>
              </div>
              <button
                onClick={() => setShowAddCustomProviderModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterCustomProvider} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Provider Identifier *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. groq or deepseek"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Groq LPU Cloud"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                  API Base URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="e.g. https://api.groq.com/openai/v1 or http://localhost:11434/v1"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs font-mono focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                  API Key / Bearer Token (Optional for local)
                </label>
                <input
                  type="password"
                  placeholder="gsk_... or sk-..."
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 p-2 text-xs font-mono focus:border-brand focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Default Model *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. llama-3.3-70b-versatile"
                    value={customDefaultModel}
                    onChange={(e) => setCustomDefaultModel(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs font-mono focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-zinc-500 mb-1">
                    Other Models (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="llama-3.1-8b, mixtral-8x7b"
                    value={customOtherModels}
                    onChange={(e) => setCustomOtherModels(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 p-2 text-xs font-mono focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomProviderModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomProvider}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {savingCustomProvider ? "Registering..." : "Save Provider"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
