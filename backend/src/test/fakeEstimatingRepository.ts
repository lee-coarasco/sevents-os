import type {
  CreateEstimateInput,
  CreateEstimateLineInput,
  EstimatingRepository,
  UpdateEstimateInput,
} from "../modules/estimating/repository.js";
import type { Estimate, EstimateLine } from "../modules/estimating/types.js";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory stand-in for EstimatingRepository. Mutating/reads are
 * keyed off an access token's own session (same convention as every
 * other fake repository in this test suite) so "wrong tenant = not
 * found" is actually exercised, not just asserted.
 */
export class FakeEstimatingRepository implements EstimatingRepository {
  sessions = new Map<string, { tenantId: string }>();
  estimates = new Map<string, Estimate>();
  estimateLines = new Map<string, EstimateLine>();

  addSession(accessToken: string, tenantId: string) {
    this.sessions.set(accessToken, { tenantId });
  }

  private tenantOf(accessToken: string): string {
    const context = this.sessions.get(accessToken);
    if (!context) throw new Error("no caller context for this access token");
    return context.tenantId;
  }

  async createEstimate(accessToken: string, input: CreateEstimateInput) {
    const tenant_id = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const estimate: Estimate = {
      id: nextId("estimate"),
      tenant_id,
      tender_submission_id: input.tender_submission_id,
      version: input.version,
      status: input.status ?? "draft",
      assumptions: input.assumptions ?? null,
      inclusions: input.inclusions ?? null,
      exclusions: input.exclusions ?? null,
      taxes: input.taxes ?? 0,
      overheads: input.overheads ?? 0,
      contingency: input.contingency ?? 0,
      margin: input.margin ?? 0,
      subtotal_amount: input.subtotal_amount ?? 0,
      total_amount: input.total_amount ?? 0,
      workflow_instance_id: input.workflow_instance_id ?? null,
      created_by: input.created_by,
      created_at: now,
      updated_at: now,
    };
    this.estimates.set(estimate.id, estimate);
    return estimate;
  }

  async listEstimates(accessToken: string, tenderSubmissionId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.estimates.values()]
      .filter((e) => e.tenant_id === tenant_id && e.tender_submission_id === tenderSubmissionId)
      .sort((a, b) => a.version - b.version);
  }

  async getEstimate(accessToken: string, estimateId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const estimate = this.estimates.get(estimateId);
    if (!estimate || estimate.tenant_id !== tenant_id) return null;
    return estimate;
  }

  async updateEstimate(accessToken: string, estimateId: string, input: UpdateEstimateInput) {
    const tenant_id = this.tenantOf(accessToken);
    const estimate = this.estimates.get(estimateId);
    if (!estimate || estimate.tenant_id !== tenant_id) return null;
    const updated: Estimate = { ...estimate, ...input, updated_at: new Date().toISOString() };
    this.estimates.set(estimateId, updated);
    return updated;
  }

  async createEstimateLine(accessToken: string, input: CreateEstimateLineInput) {
    const tenant_id = this.tenantOf(accessToken);
    const now = new Date().toISOString();
    const line: EstimateLine = {
      id: nextId("estimate-line"),
      tenant_id,
      estimate_id: input.estimate_id,
      item: input.item,
      quantity: input.quantity,
      unit: input.unit,
      rate: input.rate,
      cost_category: input.cost_category,
      line_total: input.line_total,
      source: input.source ?? "manual",
      confidence: input.confidence ?? null,
      created_at: now,
      updated_at: now,
    };
    this.estimateLines.set(line.id, line);
    return line;
  }

  async listEstimateLines(accessToken: string, estimateId: string) {
    const tenant_id = this.tenantOf(accessToken);
    return [...this.estimateLines.values()].filter(
      (line) => line.tenant_id === tenant_id && line.estimate_id === estimateId,
    );
  }

  async deleteEstimateLine(accessToken: string, lineId: string) {
    const tenant_id = this.tenantOf(accessToken);
    const line = this.estimateLines.get(lineId);
    if (!line || line.tenant_id !== tenant_id) return false;
    this.estimateLines.delete(lineId);
    return true;
  }
}
