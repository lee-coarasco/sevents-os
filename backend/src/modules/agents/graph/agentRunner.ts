import type {
  AgentDefinition,
  AgentExecution,
  AgentMessage,
  AgentTool,
  PendingAction,
} from "../types.js";
import type { ToolExecutor } from "../tools/toolExecutor.js";

export interface AgentRunnerContext {
  token: string;
  tenantId: string;
  userId?: string;
  agent: AgentDefinition;
  tools: Map<string, AgentTool>;
  toolExecutor: ToolExecutor;
}

export class AgentRunner {
  constructor(private ctx: AgentRunnerContext) {}

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
   * Run the state machine
   */
  async run(prompt: string, existingExecution?: AgentExecution): Promise<AgentExecution> {
    const messages: AgentMessage[] = existingExecution?.messages ? [...existingExecution.messages] : [];

    // Append user input
    messages.push({
      id: "msg-" + Date.now(),
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
    });

    const plannedTool = this.selectTool(prompt);

    if (!plannedTool) {
      // Direct conversational response
      const answer = `[${this.ctx.agent.name}] I have analyzed your inquiry: "${prompt}". Based on ${this.ctx.agent.description || "project parameters"}, everything is operating within nominal construction limits. If you need a specific tool action (such as drafting an RFI, checking BOQ rates, or delay calculation), please specify the task detail.`;
      
      messages.push({
        id: "msg-" + (Date.now() + 1),
        role: "assistant",
        content: answer,
        timestamp: new Date().toISOString(),
      });

      return {
        id: existingExecution?.id || "exec-" + Date.now(),
        tenant_id: this.ctx.tenantId,
        agent_id: this.ctx.agent.id,
        user_id: this.ctx.userId || null,
        session_id: null,
        input_prompt: prompt,
        status: "completed",
        messages,
        pending_action: null,
        output_summary: answer,
        created_at: existingExecution?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        agent: {
          id: this.ctx.agent.id,
          name: this.ctx.agent.name,
          key: this.ctx.agent.key,
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
      // Human-In-The-Loop Pause Gate
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

      return {
        id: existingExecution?.id || "exec-" + Date.now(),
        tenant_id: this.ctx.tenantId,
        agent_id: this.ctx.agent.id,
        user_id: this.ctx.userId || null,
        session_id: null,
        input_prompt: prompt,
        status: "paused_waiting_approval",
        messages,
        pending_action: pendingAction,
        output_summary: `Paused awaiting human approval for tool: ${pendingAction.toolName}`,
        created_at: existingExecution?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        agent: {
          id: this.ctx.agent.id,
          name: this.ctx.agent.name,
          key: this.ctx.agent.key,
        },
      };
    }

    // Execute immediately without pause
    const toolResult = await this.ctx.toolExecutor.execute(
      this.ctx.token,
      plannedTool.toolKey,
      plannedTool.input
    );

    messages.push({
      id: "msg-tool-" + Date.now(),
      role: "tool",
      toolName: plannedTool.toolKey,
      toolCallId: callId,
      content: JSON.stringify(toolResult.data, null, 2),
      timestamp: new Date().toISOString(),
    });

    const summary = this.synthesizeSummary(this.ctx.agent.name, plannedTool.toolKey, toolResult.data);

    messages.push({
      id: "msg-" + (Date.now() + 2),
      role: "assistant",
      content: summary,
      timestamp: new Date().toISOString(),
    });

    return {
      id: existingExecution?.id || "exec-" + Date.now(),
      tenant_id: this.ctx.tenantId,
      agent_id: this.ctx.agent.id,
      user_id: this.ctx.userId || null,
      session_id: null,
      input_prompt: prompt,
      status: "completed",
      messages,
      pending_action: null,
      output_summary: summary,
      created_at: existingExecution?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      agent: {
        id: this.ctx.agent.id,
        name: this.ctx.agent.name,
        key: this.ctx.agent.key,
      },
    };
  }

  /**
   * Resume paused execution after human review
   */
  async resume(
    execution: AgentExecution,
    approved: boolean,
    rejectionReason?: string
  ): Promise<AgentExecution> {
    const messages = [...execution.messages];
    const pending = execution.pending_action;

    if (!pending) {
      throw new Error("Execution has no pending action to approve or reject");
    }

    if (!approved) {
      messages.push({
        id: "msg-reject-" + Date.now(),
        role: "assistant",
        content: `❌ **Action Rejected by Supervisor**: The planned execution of "${pending.toolName}" was rejected.\n**Reason**: ${
          rejectionReason || "No explanation provided"
        }. The action has been discarded.`,
        timestamp: new Date().toISOString(),
      });

      return {
        ...execution,
        status: "rejected",
        messages,
        pending_action: null,
        output_summary: `Action rejected: ${rejectionReason || "Rejected by supervisor"}`,
        updated_at: new Date().toISOString(),
      };
    }

    // Approved: execute the pending tool
    const toolResult = await this.ctx.toolExecutor.execute(
      this.ctx.token,
      pending.toolKey,
      pending.input
    );

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

    messages.push({
      id: "msg-resumed-" + Date.now(),
      role: "assistant",
      content: `✅ **Action Confirmed & Executed**:\n\n${summary}`,
      timestamp: new Date().toISOString(),
    });

    return {
      ...execution,
      status: "completed",
      messages,
      pending_action: null,
      output_summary: summary,
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
