import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApprovalDecision,
  ChangeType,
  ConditionExpression,
  ConfigurationApproval,
  ConfigurationChange,
  ConfigurationRollbackEvent,
  ConfigurationSimulationRun,
  ConfigurationValidationRun,
  DefinitionFilters,
  DefinitionStatus,
  NodeType,
  PublishedConfiguration,
  SimulationResultPayload,
  SimulationTestCase,
  ValidationFinding,
  ValidationResult,
  VersionStatus,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowTransition,
  WorkflowVersion,
  WorkflowVersionGraph,
} from "./types.js";

export interface CreateDefinitionInput {
  key: string;
  name: string;
  description: string | null;
  capabilityKey: string | null;
  createdBy: string | null;
}

export interface InsertVersionInput {
  definitionId: string;
  version: number;
  status: VersionStatus;
  rollbackOfVersion: number | null;
  createdBy: string | null;
}

export interface AddNodeInput {
  versionId: string;
  nodeKey: string;
  nodeType: NodeType;
  config: Record<string, unknown>;
}

export interface AddTransitionInput {
  versionId: string;
  fromNodeId: string;
  toNodeId: string;
  conditionId: string | null;
  orderIndex: number;
}

export interface AddConditionInput {
  versionId: string;
  expression: ConditionExpression;
  description: string | null;
}

export interface RecordApprovalInput {
  versionId: string;
  approverId: string | null;
  decision: ApprovalDecision;
  comment: string | null;
}

export interface InsertPublishedConfigurationInput {
  definitionId: string;
  versionId: string;
  effectiveFrom: string;
  publishedBy: string | null;
}

export interface InsertRollbackEventInput {
  definitionId: string;
  fromVersion: number | null;
  toVersion: number;
  rolledBackBy: string | null;
  reason: string | null;
}

export interface InsertConfigurationChangeInput {
  entityId: string;
  workflowVersionId: string | null;
  changeType: ChangeType;
  diff: Record<string, unknown>;
  reason: string | null;
  changedBy: string | null;
}

export interface InsertValidationRunInput {
  versionId: string;
  runBy: string | null;
  result: ValidationResult;
  findings: ValidationFinding[];
}

export interface InsertSimulationRunInput {
  versionId: string;
  runBy: string | null;
  testCases: SimulationTestCase[];
  result: SimulationResultPayload;
}

/**
 * Same convention as modules/catalogue and modules/authority: every
 * method takes the caller's own access token and goes through the
 * user-scoped client, relying on RLS for tenant isolation. Unlike the
 * catalogue/role_definitions shared-catalogue tables, every table here
 * has a NOT NULL tenant_id (see DECISIONS.md, 2026-10-15 "M06 split...
 * workflow tables use NOT NULL tenant_id") so there is no service-role
 * carve-out — every call is a normal authenticated, tenant-scoped write.
 */
export interface WorkflowRepository {
  createDefinition(
    accessToken: string,
    input: CreateDefinitionInput,
  ): Promise<{ definition: WorkflowDefinition; version: WorkflowVersion }>;
  getDefinition(accessToken: string, id: string): Promise<WorkflowDefinition | null>;
  listDefinitions(accessToken: string, filters: DefinitionFilters): Promise<WorkflowDefinition[]>;
  updateDefinitionStatus(
    accessToken: string,
    id: string,
    status: DefinitionStatus,
    currentVersion: number | null,
    updatedBy: string | null,
  ): Promise<WorkflowDefinition>;

  insertVersion(accessToken: string, input: InsertVersionInput): Promise<WorkflowVersion>;
  getVersion(accessToken: string, id: string): Promise<WorkflowVersion | null>;
  listVersions(accessToken: string, definitionId: string): Promise<WorkflowVersion[]>;
  markVersionPublished(
    accessToken: string,
    id: string,
    publishedBy: string | null,
    effectiveFrom: string,
  ): Promise<WorkflowVersion>;

  addNode(accessToken: string, input: AddNodeInput): Promise<WorkflowNode>;
  addTransition(accessToken: string, input: AddTransitionInput): Promise<WorkflowTransition>;
  addCondition(accessToken: string, input: AddConditionInput): Promise<WorkflowCondition>;
  getVersionGraph(accessToken: string, versionId: string): Promise<WorkflowVersionGraph>;

  recordApproval(accessToken: string, input: RecordApprovalInput): Promise<ConfigurationApproval>;
  insertPublishedConfiguration(
    accessToken: string,
    input: InsertPublishedConfigurationInput,
  ): Promise<PublishedConfiguration>;
  insertRollbackEvent(accessToken: string, input: InsertRollbackEventInput): Promise<ConfigurationRollbackEvent>;
  insertConfigurationChange(accessToken: string, input: InsertConfigurationChangeInput): Promise<ConfigurationChange>;

  /** Known canonical role ids (M03's role_definitions) — used to catch a dangling assign_role_user reference. */
  listRoleIds(accessToken: string): Promise<string[]>;
  insertValidationRun(accessToken: string, input: InsertValidationRunInput): Promise<ConfigurationValidationRun>;
  getLatestValidationRun(accessToken: string, versionId: string): Promise<ConfigurationValidationRun | null>;
  insertSimulationRun(accessToken: string, input: InsertSimulationRunInput): Promise<ConfigurationSimulationRun>;
}

/**
 * Supabase-backed implementation. Not exercised against a live Supabase
 * project in this session (no reachable credentials in this sandbox,
 * same recurring gap as every Phase 1/2 ticket so far) — service.test.ts
 * / routes.test.ts cover the business logic through the interface above
 * via FakeWorkflowRepository instead.
 */
export function createSupabaseWorkflowRepository(
  userScopedClientFactory: (accessToken: string) => SupabaseClient,
): WorkflowRepository {
  return {
    async createDefinition(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data: definition, error: defError } = await client
        .from("workflow_definitions")
        .insert({
          key: input.key,
          name: input.name,
          description: input.description,
          capability_key: input.capabilityKey,
          status: "draft",
          current_version: null,
          created_by: input.createdBy,
          updated_by: input.createdBy,
        })
        .select("*")
        .single();
      if (defError || !definition) throw new Error(`createDefinition: ${defError?.message ?? "no row returned"}`);

      const { data: version, error: versionError } = await client
        .from("workflow_versions")
        .insert({
          workflow_definition_id: definition.id as string,
          version: 1,
          status: "draft",
          rollback_of_version: null,
          created_by: input.createdBy,
        })
        .select("*")
        .single();
      if (versionError || !version) throw new Error(`createDefinition (version): ${versionError?.message ?? "no row returned"}`);

      return { definition: definition as WorkflowDefinition, version: version as WorkflowVersion };
    },

    async getDefinition(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("workflow_definitions").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getDefinition: ${error.message}`);
      return (data as WorkflowDefinition | null) ?? null;
    },

    async listDefinitions(accessToken, filters) {
      const client = userScopedClientFactory(accessToken);
      let query = client.from("workflow_definitions").select("*");
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.key) query = query.eq("key", filters.key);
      const { data, error } = await query;
      if (error) throw new Error(`listDefinitions: ${error.message}`);
      return (data as WorkflowDefinition[]) ?? [];
    },

    async updateDefinitionStatus(accessToken, id, status, currentVersion, updatedBy) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_definitions")
        .update({ status, current_version: currentVersion, updated_by: updatedBy })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) throw new Error(`updateDefinitionStatus: ${error?.message ?? "no row returned"}`);
      return data as WorkflowDefinition;
    },

    async insertVersion(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_versions")
        .insert({
          workflow_definition_id: input.definitionId,
          version: input.version,
          status: input.status,
          rollback_of_version: input.rollbackOfVersion,
          created_by: input.createdBy,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertVersion: ${error?.message ?? "no row returned"}`);
      return data as WorkflowVersion;
    },

    async getVersion(accessToken, id) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("workflow_versions").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(`getVersion: ${error.message}`);
      return (data as WorkflowVersion | null) ?? null;
    },

    async listVersions(accessToken, definitionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_versions")
        .select("*")
        .eq("workflow_definition_id", definitionId)
        .order("version", { ascending: true });
      if (error) throw new Error(`listVersions: ${error.message}`);
      return (data as WorkflowVersion[]) ?? [];
    },

    async markVersionPublished(accessToken, id, publishedBy, effectiveFrom) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_versions")
        .update({ status: "published", published_by: publishedBy, published_at: effectiveFrom, effective_from: effectiveFrom })
        .eq("id", id)
        .select("*")
        .single();
      if (error || !data) throw new Error(`markVersionPublished: ${error?.message ?? "no row returned"}`);
      return data as WorkflowVersion;
    },

    async addNode(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_nodes")
        .insert({ workflow_version_id: input.versionId, node_key: input.nodeKey, node_type: input.nodeType, config: input.config })
        .select("*")
        .single();
      if (error || !data) throw new Error(`addNode: ${error?.message ?? "no row returned"}`);
      return data as WorkflowNode;
    },

    async addTransition(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_transitions")
        .insert({
          workflow_version_id: input.versionId,
          from_node_id: input.fromNodeId,
          to_node_id: input.toNodeId,
          condition_id: input.conditionId,
          order_index: input.orderIndex,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`addTransition: ${error?.message ?? "no row returned"}`);
      return data as WorkflowTransition;
    },

    async addCondition(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("workflow_conditions")
        .insert({ workflow_version_id: input.versionId, expression: input.expression, description: input.description })
        .select("*")
        .single();
      if (error || !data) throw new Error(`addCondition: ${error?.message ?? "no row returned"}`);
      return data as WorkflowCondition;
    },

    async getVersionGraph(accessToken, versionId) {
      const client = userScopedClientFactory(accessToken);
      const [{ data: nodes, error: nodesError }, { data: transitions, error: transitionsError }, { data: conditions, error: conditionsError }] =
        await Promise.all([
          client.from("workflow_nodes").select("*").eq("workflow_version_id", versionId),
          client.from("workflow_transitions").select("*").eq("workflow_version_id", versionId),
          client.from("workflow_conditions").select("*").eq("workflow_version_id", versionId),
        ]);
      if (nodesError) throw new Error(`getVersionGraph (nodes): ${nodesError.message}`);
      if (transitionsError) throw new Error(`getVersionGraph (transitions): ${transitionsError.message}`);
      if (conditionsError) throw new Error(`getVersionGraph (conditions): ${conditionsError.message}`);
      return {
        nodes: (nodes as WorkflowNode[]) ?? [],
        transitions: (transitions as WorkflowTransition[]) ?? [],
        conditions: (conditions as WorkflowCondition[]) ?? [],
      };
    },

    async recordApproval(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("configuration_approvals")
        .insert({
          workflow_version_id: input.versionId,
          approver_id: input.approverId,
          decision: input.decision,
          comment: input.comment,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`recordApproval: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationApproval;
    },

    async insertPublishedConfiguration(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("published_configurations")
        .insert({
          workflow_definition_id: input.definitionId,
          workflow_version_id: input.versionId,
          effective_from: input.effectiveFrom,
          published_by: input.publishedBy,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertPublishedConfiguration: ${error?.message ?? "no row returned"}`);
      return data as PublishedConfiguration;
    },

    async insertRollbackEvent(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("configuration_rollback_events")
        .insert({
          workflow_definition_id: input.definitionId,
          from_version: input.fromVersion,
          to_version: input.toVersion,
          rolled_back_by: input.rolledBackBy,
          reason: input.reason,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertRollbackEvent: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationRollbackEvent;
    },

    async insertConfigurationChange(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("configuration_changes")
        .insert({
          entity_type: "workflow_definition",
          entity_id: input.entityId,
          workflow_version_id: input.workflowVersionId,
          change_type: input.changeType,
          diff: input.diff,
          reason: input.reason,
          changed_by: input.changedBy,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertConfigurationChange: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationChange;
    },

    async listRoleIds(accessToken) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client.from("role_definitions").select("id");
      if (error) throw new Error(`listRoleIds: ${error.message}`);
      return (data ?? []).map((row) => row.id as string);
    },

    async insertValidationRun(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("configuration_validation_runs")
        .insert({
          workflow_version_id: input.versionId,
          run_by: input.runBy,
          result: input.result,
          findings: input.findings,
          started_at: now,
          finished_at: now,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertValidationRun: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationValidationRun;
    },

    async getLatestValidationRun(accessToken, versionId) {
      const client = userScopedClientFactory(accessToken);
      const { data, error } = await client
        .from("configuration_validation_runs")
        .select("*")
        .eq("workflow_version_id", versionId)
        .order("finished_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`getLatestValidationRun: ${error.message}`);
      return (data as ConfigurationValidationRun | null) ?? null;
    },

    async insertSimulationRun(accessToken, input) {
      const client = userScopedClientFactory(accessToken);
      const now = new Date().toISOString();
      const { data, error } = await client
        .from("configuration_simulation_runs")
        .insert({
          workflow_version_id: input.versionId,
          run_by: input.runBy,
          test_cases: input.testCases,
          result: input.result,
          started_at: now,
          finished_at: now,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(`insertSimulationRun: ${error?.message ?? "no row returned"}`);
      return data as ConfigurationSimulationRun;
    },
  };
}
