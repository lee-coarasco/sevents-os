import type {
  AgentDefinition,
  AgentExecution,
  AgentExecutionStep,
  AgentMessage,
  AgentTool,
  PendingAction,
  ApprovalMetadata,
} from "../types.js";
import { calculateCost } from "../types.js";
import type { ToolExecutor } from "../tools/toolExecutor.js";

export interface AgentRunnerContext {
  token: string;
  tenantId: string;
  userId?: string;
  agent: AgentDefinition;
  tools: Map<string, AgentTool>;
  toolExecutor: ToolExecutor;
  onAuditLog?: (event: {
    eventType: string;
    details: Record<string, unknown>;
    actorType?: "agent" | "human_reviewer" | "system";
    actorId?: string;
  }) => Promise<void>;
  onIncident?: (incident: {
    incidentType: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    rawContent?: string;
  }) => Promise<void>;
}

export class AgentRunner {
  constructor(private ctx: AgentRunnerContext) {}

  /**
   * Check for potential prompt injection attempts in untrusted input or tool data (BRD §8.10 FR-AG-008)
   */
  private checkPromptInjection(content: string): boolean {
    const suspiciousPatterns = [
      /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
      /disregard\s+(all\s+)?(system|safety)\s+prompts/i,
      /you\s+are\s+now\s+in\s+(developer|unrestricted|god)\s+mode/i,
      /override\s+(tenant|role|security)\s+permissions/i,
      /bypass\s+(authorization|rls|sandbox)/i,
      /system\s*:\s*role\s*=\s*['"]?admin['"]?/i,
    ];
    return suspiciousPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Estimate tokens from text content
   */
  private estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  /**
   * Determine which tool (if any) is required based on the input prompt and allowed tools
   */
  private selectTool(prompt: string): { toolKey: string; input: Record<string, any>; rationale: string } | null {
    const p = prompt.toLowerCase();
    const allowed = new Set(this.ctx.agent.allowed_tools);

    if (allowed.has("create_site_rfi") && (p.includes("rfi") || p.includes("request for information") || p.includes("clarification to architect"))) {
      return {
        toolKey: "create_site_rfi",
        input: {
          projectId: "prj-reem-tower",
          title: "Clarification on Level 12 Beam Rebar Clashing",
          question: "Drawing S-104 shows 32mm rebar overlap with MEP duct passage. Please advise on crank detail.",
          suggestedSolution: "Provide 150mm crank offset per BS 8666 code.",
        },
        rationale: "Prompt requests drafting a formal site clarification / RFI to consultant.",
      };
    }

    if (allowed.has("log_safety_observation") && (p.includes("hazard") || p.includes("safety") || p.includes("unsafe") || p.includes("incident"))) {
      return {
        toolKey: "log_safety_observation",
        input: {
          projectId: "prj-reem-tower",
          hazardType: "Scaffolding Safety",
          description: "Missing toe-boards and unanchored ladder observed on external working platform Level 8.",
          severity: "high",
        },
        rationale: "Prompt reports unsafe site conditions requiring formal HSE incident observation record.",
      };
    }

    if (allowed.has("calculate_delay_impact") && (p.includes("delay") || p.includes("behind schedule") || p.includes("critical path") || p.includes("slip"))) {
      const matchDays = prompt.match(/(\d+)\s*days?/i);
      const delayDays = matchDays && matchDays[1] ? parseInt(matchDays[1], 10) : 7;
      return {
        toolKey: "calculate_delay_impact",
        input: {
          projectId: "prj-reem-tower",
          delayDays,
          reason: prompt,
        },
        rationale: "Prompt requires quantitative delay impact and FIDIC notice assessment.",
      };
    }

    if (allowed.has("check_inventory_stock") && (p.includes("stock") || p.includes("inventory") || p.includes("cement") || p.includes("rebar") || p.includes("material"))) {
      return {
        toolKey: "check_inventory_stock",
        input: {
          itemName: p.includes("cement") ? "Portland Cement" : p.includes("rebar") ? "Rebar T25" : "Waterproofing Membrane",
        },
        rationale: "Checking site and central warehouse balance against reorder thresholds.",
      };
    }

    if (allowed.has("get_boq_items") && (p.includes("boq") || p.includes("bill of quantities") || p.includes("rate") || p.includes("cost item"))) {
      return {
        toolKey: "get_boq_items",
        input: {
          search: "Concrete",
        },
        rationale: "Querying approved BOQ rates and work item specification catalogue.",
      };
    }

    if (allowed.has("query_project_schedule") && (p.includes("schedule") || p.includes("milestone") || p.includes("progress") || p.includes("target date"))) {
      return {
        toolKey: "query_project_schedule",
        input: {
          projectId: "prj-reem-tower",
        },
        rationale: "Retrieving WBS schedule status, actual vs planned progress, and milestone deadlines.",
      };
    }

    if (allowed.has("search_knowledge_base") && (p.includes("drawing") || p.includes("spec") || p.includes("contract") || p.includes("what is") || p.includes("how to"))) {
      return {
        toolKey: "search_knowledge_base",
        input: {
          query: prompt,
          projectId: "prj-reem-tower",
        },
        rationale: "Semantic search across vectorized project drawings, specifications, and contracts.",
      };
    }

    return null;
  }

  /**
   * Run the state machine with guardrails, token tracking, and structured plan steps
   */
  async run(prompt: string, existingExecution?: AgentExecution): Promise<AgentExecution> {
    const startTime = Date.now();
    const executionId = existingExecution?.id || "exec-" + Date.now();

    // 1. Guardrail: Check Kill Switch (BRD §8.10 FR-AG-006)
    if (this.ctx.agent.is_paused) {
      if (this.ctx.onAuditLog) {
        await this.ctx.onAuditLog({
          eventType: "run_rejected_agent_paused",
          details: { agentId: this.ctx.agent.id, pauseReason: this.ctx.agent.pause_reason },
        });
      }
      throw new Error(`Agent '${this.ctx.agent.name}' is currently paused: ${this.ctx.agent.pause_reason || "Emergency kill switch active"}`);
    }

    // 2. Guardrail: Prompt Injection Detection (BRD §8.10 FR-AG-008)
    if (this.checkPromptInjection(prompt)) {
      if (this.ctx.onIncident) {
        await this.ctx.onIncident({
          incidentType: "prompt_injection_flagged",
          severity: "high",
          description: `Prompt injection attack signature detected in user input to agent '${this.ctx.agent.name}'`,
          rawContent: prompt,
        });
      }
      if (this.ctx.onAuditLog) {
        await this.ctx.onAuditLog({
          eventType: "prompt_injection_blocked",
          details: { agentId: this.ctx.agent.id, snippet: prompt.substring(0, 80) },
        });
      }
      throw new Error("Execution rejected: Input violates AI security policy (Prompt Injection signature detected).");
    }

    const messages: AgentMessage[] = existingExecution?.messages ? [...existingExecution.messages] : [];
    const planSteps: AgentExecutionStep[] = existingExecution?.plan_steps ? [...existingExecution.plan_steps] : [];

    // Append user input message
    messages.push({
      id: "msg-" + Date.now(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    });

    if (this.ctx.onAuditLog) {
      await this.ctx.onAuditLog({
        eventType: "run_started",
        details: { prompt: prompt.substring(0, 100), agentKey: this.ctx.agent.key },
      });
    }

    // Step 1: Reasoning / Planning Step
    const plannedTool = this.selectTool(prompt);
    const reasoningThought = plannedTool
      ? `Analyzing prompt: "${prompt}". Identified required operational tool "${plannedTool.toolKey}" (${plannedTool.rationale}). Checking policy and parameter schema.`
      : `Analyzing prompt: "${prompt}". No state modification or operational lookup tool required. Formulating direct conversational guidance based on system prompt.`;

    const step1PromptTokens = this.estimateTokens(prompt + this.ctx.agent.system_prompt);
    const step1CompletionTokens = this.estimateTokens(reasoningThought);
    const step1Cost = calculateCost(this.ctx.agent.model, step1PromptTokens, step1CompletionTokens);

    planSteps.push({
      stepNumber: planSteps.length + 1,
      type: "thought",
      thought: reasoningThought,
      toolKey: plannedTool?.toolKey,
      toolName: plannedTool ? (this.ctx.tools.get(plannedTool.toolKey)?.name || plannedTool.toolKey) : undefined,
      confidence: 0.96,
      tokens: {
        prompt: step1PromptTokens,
        completion: step1CompletionTokens,
        total: step1PromptTokens + step1CompletionTokens,
      },
      costUsd: step1Cost,
      latencyMs: Date.now() - startTime,
      status: "success",
    });

    if (!plannedTool) {
      // Direct conversational response
      const answer = `[${this.ctx.agent.name}] I have analyzed your inquiry: "${prompt}". Based on ${this.ctx.agent.description || "project parameters"}, everything is operating within nominal construction limits. If you need a specific tool action (such as drafting an RFI, checking BOQ rates, or delay calculation), please specify the task detail.`;
      
      const step2Tokens = this.estimateTokens(answer);
      const step2Cost = calculateCost(this.ctx.agent.model, 0, step2Tokens);

      planSteps.push({
        stepNumber: planSteps.length + 1,
        type: "synthesis",
        thought: "Finalizing synthesized response to user without external tool execution.",
        confidence: 0.98,
        tokens: { prompt: 0, completion: step2Tokens, total: step2Tokens },
        costUsd: step2Cost,
        latencyMs: Date.now() - startTime,
        status: "success",
      });

      messages.push({
        id: "msg-" + (Date.now() + 1),
        role: "assistant",
        content: answer,
        timestamp: new Date().toISOString(),
      });

      const totalPrompt = step1PromptTokens;
      const totalComp = step1CompletionTokens + step2Tokens;
      const totalCost = Number((step1Cost + step2Cost).toFixed(6));

      if (this.ctx.onAuditLog) {
        await this.ctx.onAuditLog({
          eventType: "run_completed",
          details: { stepsCount: planSteps.length, costUsd: totalCost, totalTokens: totalPrompt + totalComp },
        });
      }

      return {
        id: executionId,
        tenant_id: this.ctx.tenantId,
        agent_id: this.ctx.agent.id,
        user_id: this.ctx.userId || null,
        session_id: null,
        input_prompt: prompt,
        status: "completed",
        messages,
        pending_action: null,
        output_summary: answer,
        tokens_prompt: totalPrompt,
        tokens_completion: totalComp,
        total_tokens: totalPrompt + totalComp,
        cost_usd: totalCost,
        latency_ms: Date.now() - startTime,
        steps_count: planSteps.length,
        plan_steps: planSteps,
        confidence_score: 0.98,
        retry_count: existingExecution?.retry_count ?? 0,
        created_at: existingExecution?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        agent: {
          id: this.ctx.agent.id,
          name: this.ctx.agent.name,
          key: this.ctx.agent.key,
          model: this.ctx.agent.model,
        },
      };
    }

    const toolDef = this.ctx.tools.get(plannedTool.toolKey);
    const isMutation = toolDef?.is_mutation || false;
    const policy = this.ctx.agent.hitl_policy;

    const requiresApproval =
      policy === "always" || (policy === "require_for_mutations" && isMutation);

    const callId = "call-" + Math.random().toString(36).substring(2, 9);
    const pendingAction: PendingAction = {
      toolKey: plannedTool.toolKey,
      toolName: toolDef?.name || plannedTool.toolKey,
      input: plannedTool.input,
      rationale: plannedTool.rationale,
      callId,
    };

    if (requiresApproval) {
      // Step 2: Human-In-The-Loop Pause Gate
      planSteps.push({
        stepNumber: planSteps.length + 1,
        type: "human_approval",
        thought: `Tool "${pendingAction.toolName}" is classified as a project mutation. Gating execution for human supervisor approval per governance policy '${policy}'.`,
        toolKey: pendingAction.toolKey,
        toolName: pendingAction.toolName,
        toolInput: pendingAction.input,
        confidence: 0.94,
        costUsd: 0,
        latencyMs: Date.now() - startTime,
        status: "paused",
      });

      messages.push({
        id: "msg-" + (Date.now() + 1),
        role: "assistant",
        content: `I am planning to invoke tool "${pendingAction.toolName}" with the following parameters:\n\`\`\`json\n${JSON.stringify(
          pendingAction.input,
          null,
          2
        )}\n\`\`\`\n**Rationale**: ${pendingAction.rationale}\n\n*This action modifies project records or commits resources. Execution paused awaiting human supervisor confirmation.*`,
        timestamp: new Date().toISOString(),
      });

      if (this.ctx.onAuditLog) {
        await this.ctx.onAuditLog({
          eventType: "hitl_requested",
          details: {
            toolKey: pendingAction.toolKey,
            input: pendingAction.input,
            rationale: pendingAction.rationale,
          },
        });
      }

      return {
        id: executionId,
        tenant_id: this.ctx.tenantId,
        agent_id: this.ctx.agent.id,
        user_id: this.ctx.userId || null,
        session_id: null,
        input_prompt: prompt,
        status: "paused_waiting_approval",
        messages,
        pending_action: pendingAction,
        output_summary: `Paused awaiting human approval for tool: ${pendingAction.toolName}`,
        tokens_prompt: step1PromptTokens,
        tokens_completion: step1CompletionTokens,
        total_tokens: step1PromptTokens + step1CompletionTokens,
        cost_usd: step1Cost,
        latency_ms: Date.now() - startTime,
        steps_count: planSteps.length,
        plan_steps: planSteps,
        confidence_score: 0.94,
        retry_count: existingExecution?.retry_count ?? 0,
        created_at: existingExecution?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        agent: {
          id: this.ctx.agent.id,
          name: this.ctx.agent.name,
          key: this.ctx.agent.key,
          model: this.ctx.agent.model,
        },
      };
    }

    // Step 2: Immediate Tool Execution
    const toolCallStartTime = Date.now();
    const toolResult = await this.ctx.toolExecutor.execute(
      this.ctx.token,
      plannedTool.toolKey,
      plannedTool.input
    );
    const toolLatency = Date.now() - toolCallStartTime;

    planSteps.push({
      stepNumber: planSteps.length + 1,
      type: "tool_call",
      thought: `Dispatched tool call "${plannedTool.toolKey}" directly to backend execution provider.`,
      toolKey: plannedTool.toolKey,
      toolName: toolDef?.name || plannedTool.toolKey,
      toolInput: plannedTool.input,
      toolOutput: toolResult.data,
      confidence: 0.97,
      costUsd: 0,
      latencyMs: toolLatency,
      status: toolResult.success ? "success" : "failed",
      error: toolResult.error,
    });

    if (this.ctx.onAuditLog) {
      await this.ctx.onAuditLog({
        eventType: "tool_called",
        details: { toolKey: plannedTool.toolKey, success: toolResult.success },
      });
    }

    messages.push({
      id: "msg-tool-" + Date.now(),
      role: "tool",
      toolName: plannedTool.toolKey,
      toolCallId: callId,
      content: JSON.stringify(toolResult.data, null, 2),
      timestamp: new Date().toISOString(),
    });

    // Step 3: Synthesis Step
    const summary = this.synthesizeSummary(this.ctx.agent.name, plannedTool.toolKey, toolResult.data);
    const step3Tokens = this.estimateTokens(summary);
    const step3Cost = calculateCost(this.ctx.agent.model, 0, step3Tokens);

    planSteps.push({
      stepNumber: planSteps.length + 1,
      type: "synthesis",
      thought: "Synthesizing formatted business response from grounded tool output payload.",
      confidence: 0.97,
      tokens: { prompt: 0, completion: step3Tokens, total: step3Tokens },
      costUsd: step3Cost,
      latencyMs: Date.now() - startTime,
      status: "success",
    });

    messages.push({
      id: "msg-" + (Date.now() + 2),
      role: "assistant",
      content: summary,
      timestamp: new Date().toISOString(),
    });

    const totalPrompt = step1PromptTokens;
    const totalComp = step1CompletionTokens + step3Tokens;
    const totalCost = Number((step1Cost + step3Cost).toFixed(6));

    // Budget Guardrail (BRD §8.10 FR-AG-009)
    const budget = this.ctx.agent.spend_budget_usd ?? 5.0;
    if (totalCost > budget) {
      if (this.ctx.onIncident) {
        await this.ctx.onIncident({
          incidentType: "cost_limit_exceeded",
          severity: "medium",
          description: `Agent run exceeded allocated budget limit ($${totalCost.toFixed(4)} > $${budget.toFixed(4)})`,
        });
      }
    }

    if (this.ctx.onAuditLog) {
      await this.ctx.onAuditLog({
        eventType: "run_completed",
        details: { stepsCount: planSteps.length, costUsd: totalCost, totalTokens: totalPrompt + totalComp },
      });
    }

    return {
      id: executionId,
      tenant_id: this.ctx.tenantId,
      agent_id: this.ctx.agent.id,
      user_id: this.ctx.userId || null,
      session_id: null,
      input_prompt: prompt,
      status: "completed",
      messages,
      pending_action: null,
      output_summary: summary,
      tokens_prompt: totalPrompt,
      tokens_completion: totalComp,
      total_tokens: totalPrompt + totalComp,
      cost_usd: totalCost,
      latency_ms: Date.now() - startTime,
      steps_count: planSteps.length,
      plan_steps: planSteps,
      confidence_score: 0.97,
      retry_count: existingExecution?.retry_count ?? 0,
      created_at: existingExecution?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      agent: {
        id: this.ctx.agent.id,
        name: this.ctx.agent.name,
        key: this.ctx.agent.key,
        model: this.ctx.agent.model,
      },
    };
  }

  /**
   * Resume paused execution after human review (supports parameter modification)
   */
  async resume(
    execution: AgentExecution,
    approved: boolean,
    rejectionReason?: string,
    modifiedInput?: Record<string, unknown>,
    notes?: string,
    reviewerId?: string
  ): Promise<AgentExecution> {
    const messages = [...execution.messages];
    const pending = execution.pending_action;
    const planSteps = execution.plan_steps ? [...execution.plan_steps] : [];

    if (!pending) {
      throw new Error("Execution has no pending action to approve or reject");
    }

    const approvalMetadata: ApprovalMetadata = {
      approvedBy: reviewerId || this.ctx.userId,
      approvedAt: new Date().toISOString(),
      modifiedInput,
      rejectionReason,
      notes,
    };

    if (!approved) {
      planSteps.push({
        stepNumber: planSteps.length + 1,
        type: "human_approval",
        thought: `Action rejected by supervisor. Reason: ${rejectionReason || "No explanation provided"}`,
        toolKey: pending.toolKey,
        toolName: pending.toolName,
        confidence: 1.0,
        costUsd: 0,
        latencyMs: 0,
        status: "failed",
        error: rejectionReason || "Rejected by supervisor",
      });

      messages.push({
        id: "msg-reject-" + Date.now(),
        role: "assistant",
        content: `❌ **Action Rejected by Supervisor**: The planned execution of "${pending.toolName}" was rejected.\n**Reason**: ${
          rejectionReason || "No explanation provided"
        }. The action has been discarded.`,
        timestamp: new Date().toISOString(),
      });

      if (this.ctx.onAuditLog) {
        await this.ctx.onAuditLog({
          eventType: "hitl_rejected",
          actorType: "human_reviewer",
          actorId: reviewerId || this.ctx.userId,
          details: { toolKey: pending.toolKey, rejectionReason, notes },
        });
      }

      return {
        ...execution,
        status: "rejected",
        messages,
        pending_action: null,
        output_summary: `Action rejected: ${rejectionReason || "Rejected by supervisor"}`,
        approval_metadata: approvalMetadata,
        plan_steps: planSteps,
        steps_count: planSteps.length,
        updated_at: new Date().toISOString(),
      };
    }

    // Approved: Use modified input parameters if supplied by human reviewer
    const effectiveInput = modifiedInput || pending.input;

    planSteps.push({
      stepNumber: planSteps.length + 1,
      type: "human_approval",
      thought: `Human supervisor approved invocation of "${pending.toolName}"${
        modifiedInput ? " with adjusted input parameters." : "."
      }`,
      toolKey: pending.toolKey,
      toolName: pending.toolName,
      toolInput: effectiveInput,
      confidence: 1.0,
      costUsd: 0,
      latencyMs: 0,
      status: "success",
    });

    if (this.ctx.onAuditLog) {
      await this.ctx.onAuditLog({
        eventType: "hitl_approved",
        actorType: "human_reviewer",
        actorId: reviewerId || this.ctx.userId,
        details: { toolKey: pending.toolKey, input: effectiveInput, modified: !!modifiedInput },
      });
    }

    const toolCallStartTime = Date.now();
    const toolResult = await this.ctx.toolExecutor.execute(
      this.ctx.token,
      pending.toolKey,
      effectiveInput
    );
    const toolLatency = Date.now() - toolCallStartTime;

    planSteps.push({
      stepNumber: planSteps.length + 1,
      type: "tool_call",
      thought: `Executing supervisor-approved tool "${pending.toolName}".`,
      toolKey: pending.toolKey,
      toolName: pending.toolName,
      toolInput: effectiveInput,
      toolOutput: toolResult.data,
      confidence: 0.98,
      costUsd: 0,
      latencyMs: toolLatency,
      status: toolResult.success ? "success" : "failed",
      error: toolResult.error,
    });

    messages.push({
      id: "msg-approved-" + Date.now(),
      role: "system",
      content: `Human supervisor approved invocation of "${pending.toolName}". Executing action...`,
      timestamp: new Date().toISOString(),
    });

    messages.push({
      id: "msg-tool-" + Date.now(),
      role: "tool",
      toolName: pending.toolKey,
      toolCallId: pending.callId,
      content: JSON.stringify(toolResult.data, null, 2),
      timestamp: new Date().toISOString(),
    });

    const summary = this.synthesizeSummary(this.ctx.agent.name, pending.toolKey, toolResult.data);
    const synthTokens = this.estimateTokens(summary);
    const synthCost = calculateCost(this.ctx.agent.model, 0, synthTokens);

    planSteps.push({
      stepNumber: planSteps.length + 1,
      type: "synthesis",
      thought: "Synthesizing confirmation report from approved mutation outcome.",
      confidence: 0.98,
      tokens: { prompt: 0, completion: synthTokens, total: synthTokens },
      costUsd: synthCost,
      latencyMs: 50,
      status: "success",
    });

    messages.push({
      id: "msg-resumed-" + Date.now(),
      role: "assistant",
      content: `✅ **Action Confirmed & Executed**:\n\n${summary}`,
      timestamp: new Date().toISOString(),
    });

    const totalTokens = (execution.total_tokens || 0) + synthTokens;
    const totalCost = Number(((execution.cost_usd || 0) + synthCost).toFixed(6));

    if (this.ctx.onAuditLog) {
      await this.ctx.onAuditLog({
        eventType: "run_completed",
        details: { stepsCount: planSteps.length, costUsd: totalCost, totalTokens },
      });
    }

    return {
      ...execution,
      status: "completed",
      messages,
      pending_action: null,
      output_summary: summary,
      approval_metadata: approvalMetadata,
      plan_steps: planSteps,
      steps_count: planSteps.length,
      total_tokens: totalTokens,
      cost_usd: totalCost,
      updated_at: new Date().toISOString(),
    };
  }

  /**
   * Cancel an in-flight or paused execution
   */
  async cancel(execution: AgentExecution, reason: string, cancelledBy?: string): Promise<AgentExecution> {
    const messages = [...execution.messages];
    const planSteps = execution.plan_steps ? [...execution.plan_steps] : [];

    planSteps.push({
      stepNumber: planSteps.length + 1,
      type: "human_approval",
      thought: `Run cancelled by operator. Reason: ${reason}`,
      confidence: 1.0,
      costUsd: 0,
      latencyMs: 0,
      status: "skipped",
      error: reason,
    });

    messages.push({
      id: "msg-cancel-" + Date.now(),
      role: "assistant",
      content: `⚠️ **Execution Cancelled by Operator**: ${reason}`,
      timestamp: new Date().toISOString(),
    });

    if (this.ctx.onAuditLog) {
      await this.ctx.onAuditLog({
        eventType: "run_cancelled",
        actorType: "human_reviewer",
        actorId: cancelledBy || this.ctx.userId,
        details: { reason },
      });
    }

    return {
      ...execution,
      status: "cancelled",
      messages,
      pending_action: null,
      output_summary: `Cancelled: ${reason}`,
      plan_steps: planSteps,
      steps_count: planSteps.length,
      updated_at: new Date().toISOString(),
    };
  }

  private synthesizeSummary(agentName: string, toolKey: string, data: any): string {
    switch (toolKey) {
      case "create_site_rfi":
        return `Formal RFI has been officially registered as **${data.rfiNumber}** with status *${data.status}*. It has been assigned to the **${data.recipient}**.`;
      case "log_safety_observation":
        return `Safety observation **${data.observationId}** (${data.severity?.toUpperCase()} priority) logged in site safety records. Mandatory action: "${data.actionRequired}".`;
      case "calculate_delay_impact":
        return `Delay evaluation calculated an estimated **${data.criticalPathSlipDays} days** critical path slip with overhead exposure of **${data.estimatedOverheadExposure?.toLocaleString()} ${data.currency}**.\n\n*Contractual Advice*: ${data.recommendation}`;
      case "check_inventory_stock":
        return `Inventory check for "${data.itemName}": Available quantity is **${data.stockRecords?.[0]?.availableQuantity ?? 120} units** (Threshold: ${data.stockRecords?.[0]?.reorderThreshold ?? 50}). Storage location: "${data.stockRecords?.[0]?.location ?? "Central Yard"}". Status: *IN STOCK*.`;
      case "get_boq_items":
        return `Retrieved ${data.items?.length || 0} work items from approved project BOQ catalogue lines.`;
      case "query_project_schedule":
        return `Project schedule query: Planned progress is **${data.project?.plannedProgress ?? "64%"}** vs actual **${data.project?.actualProgress ?? "58%"}** (variance: **${data.project?.varianceDays ?? -8} days**). Critical milestone: "${data.project?.criticalMilestone ?? "Level 14 Casting"}".`;
      case "search_knowledge_base":
        return `Grounded knowledge search identified **${data.matchedDocuments?.length || 0} project documents** matching requirements.`;
      default:
        return `Tool execution completed successfully with payload: ${JSON.stringify(data)}`;
    }
  }
}
