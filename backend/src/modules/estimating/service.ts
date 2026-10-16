import type { WorkflowRepository } from "../workflow/repository.js";
import { getWorkflowInstance, startWorkflowInstance } from "../workflow/service.js";
import type {
  CreateEstimateLineInput,
  EstimatingRepository,
  UpdateEstimateInput,
} from "./repository.js";
import type { CostCategory, Estimate, EstimateLine, EstimateLineSource } from "./types.js";

export class NotFoundError extends Error {
  constructor(message = "not found") {
    super(message);
  }
}

/** FR-EST-003: an approved estimate version is locked — no in-place edits. */
export class EstimateLockedError extends Error {}

export class EstimateNotDraftError extends Error {}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function recomputeTotals(estimate: Estimate, lines: EstimateLine[]): Pick<Estimate, "subtotal_amount" | "total_amount"> {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.line_total, 0));
  const total = round2(subtotal + estimate.taxes + estimate.overheads + estimate.contingency + estimate.margin);
  return { subtotal_amount: subtotal, total_amount: total };
}

async function requireEstimate(repo: EstimatingRepository, accessToken: string, estimateId: string): Promise<Estimate> {
  const estimate = await repo.getEstimate(accessToken, estimateId);
  if (!estimate) throw new NotFoundError();
  return estimate;
}

/**
 * FR-EST-003: only a draft (or returned-for-correction, which is just
 * a draft that was sent back by an approver — same editable intent)
 * estimate version may be mutated in place. `approved` is the one
 * status that is ever truly locked; `rejected`/`superseded` are dead
 * ends too (create a new version instead of resurrecting them).
 */
function requireDraft(estimate: Estimate): void {
  if (estimate.status === "draft" || estimate.status === "returned_for_correction") return;
  if (estimate.status === "approved") {
    throw new EstimateLockedError(
      `estimate ${estimate.id} is approved and locked; create a new version to make further changes`,
    );
  }
  throw new EstimateNotDraftError(`estimate ${estimate.id} is ${estimate.status}, not draft`);
}

export interface CreateEstimateServiceInput {
  tenderSubmissionId: string;
  assumptions?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  taxes?: number;
  overheads?: number;
  contingency?: number;
  margin?: number;
  createdBy: string | null;
}

/**
 * Creates the next version for a tender submission (v1 if none exist
 * yet). Always a draft — never pre-approved — same "approval only ever
 * comes from the workflow seam" discipline as project baselines, minus
 * ticket 0075's special-cased "v1 is approved directly" carve-out:
 * FR-EST-003 names approval for *every* estimate version, not just
 * changes to one, so there is no un-gated initial version here.
 */
export async function createEstimateVersion(
  repo: EstimatingRepository,
  accessToken: string,
  input: CreateEstimateServiceInput,
): Promise<Estimate> {
  const existing = await repo.listEstimates(accessToken, input.tenderSubmissionId);
  const nextVersion = Math.max(0, ...existing.map((e) => e.version)) + 1;
  return repo.createEstimate(accessToken, {
    tender_submission_id: input.tenderSubmissionId,
    version: nextVersion,
    status: "draft",
    assumptions: input.assumptions ?? null,
    inclusions: input.inclusions ?? null,
    exclusions: input.exclusions ?? null,
    taxes: input.taxes ?? 0,
    overheads: input.overheads ?? 0,
    contingency: input.contingency ?? 0,
    margin: input.margin ?? 0,
    created_by: input.createdBy,
  });
}

export async function listEstimateVersions(
  repo: EstimatingRepository,
  accessToken: string,
  tenderSubmissionId: string,
): Promise<Estimate[]> {
  return repo.listEstimates(accessToken, tenderSubmissionId);
}

export async function getEstimate(repo: EstimatingRepository, accessToken: string, estimateId: string): Promise<Estimate> {
  return requireEstimate(repo, accessToken, estimateId);
}

export interface UpdateEstimateFieldsInput {
  assumptions?: string | null;
  inclusions?: string | null;
  exclusions?: string | null;
  taxes?: number;
  overheads?: number;
  contingency?: number;
  margin?: number;
}

/** FR-EST-001 field edits. Draft-only — see requireDraft. */
export async function updateEstimateFields(
  repo: EstimatingRepository,
  accessToken: string,
  estimateId: string,
  input: UpdateEstimateFieldsInput,
): Promise<Estimate> {
  const estimate = await requireEstimate(repo, accessToken, estimateId);
  requireDraft(estimate);
  const merged: UpdateEstimateInput = { ...input };
  const lines = await repo.listEstimateLines(accessToken, estimateId);
  const { subtotal_amount, total_amount } = recomputeTotals({ ...estimate, ...input }, lines);
  const updated = await repo.updateEstimate(accessToken, estimateId, {
    ...merged,
    subtotal_amount,
    total_amount,
  });
  if (!updated) throw new NotFoundError();
  return updated;
}

export interface AddEstimateLineInput {
  item: string;
  quantity: number;
  unit: string;
  rate: number;
  costCategory: CostCategory;
  source?: EstimateLineSource;
  confidence?: number | null;
}

/** line_total is always computed server-side, never trusted from the caller. */
export async function addEstimateLine(
  repo: EstimatingRepository,
  accessToken: string,
  estimateId: string,
  input: AddEstimateLineInput,
): Promise<EstimateLine> {
  const estimate = await requireEstimate(repo, accessToken, estimateId);
  requireDraft(estimate);
  const lineInput: CreateEstimateLineInput = {
    estimate_id: estimateId,
    item: input.item,
    quantity: input.quantity,
    unit: input.unit,
    rate: input.rate,
    cost_category: input.costCategory,
    line_total: round2(input.quantity * input.rate),
    source: input.source ?? "manual",
    confidence: input.confidence ?? null,
  };
  const line = await repo.createEstimateLine(accessToken, lineInput);
  const allLines = await repo.listEstimateLines(accessToken, estimateId);
  const totals = recomputeTotals(estimate, allLines);
  await repo.updateEstimate(accessToken, estimateId, totals);
  return line;
}

export async function listEstimateLines(
  repo: EstimatingRepository,
  accessToken: string,
  estimateId: string,
): Promise<EstimateLine[]> {
  return repo.listEstimateLines(accessToken, estimateId);
}

export async function removeEstimateLine(
  repo: EstimatingRepository,
  accessToken: string,
  estimateId: string,
  lineId: string,
): Promise<void> {
  const estimate = await requireEstimate(repo, accessToken, estimateId);
  requireDraft(estimate);
  const deleted = await repo.deleteEstimateLine(accessToken, lineId);
  if (!deleted) throw new NotFoundError();
  const remainingLines = await repo.listEstimateLines(accessToken, estimateId);
  const totals = recomputeTotals(estimate, remainingLines);
  await repo.updateEstimate(accessToken, estimateId, totals);
}

/**
 * Copies forward a new draft version from an approved (or any) prior
 * version's FR-EST-001 fields and lines — the only legal way to change
 * an approved estimate, per FR-EST-003. Mirrors ticket 0075's
 * supersede-on-new-version shape, except the "copy forward" step lives
 * here rather than at resolve time, since an estimate (unlike a
 * baseline) carries its own line items that need duplicating too.
 */
export async function createNextEstimateVersionFrom(
  repo: EstimatingRepository,
  accessToken: string,
  estimateId: string,
  createdBy: string | null,
): Promise<Estimate> {
  const source = await requireEstimate(repo, accessToken, estimateId);
  const sourceLines = await repo.listEstimateLines(accessToken, estimateId);
  const siblings = await repo.listEstimates(accessToken, source.tender_submission_id);
  const nextVersion = Math.max(0, ...siblings.map((e) => e.version)) + 1;

  const next = await repo.createEstimate(accessToken, {
    tender_submission_id: source.tender_submission_id,
    version: nextVersion,
    status: "draft",
    assumptions: source.assumptions,
    inclusions: source.inclusions,
    exclusions: source.exclusions,
    taxes: source.taxes,
    overheads: source.overheads,
    contingency: source.contingency,
    margin: source.margin,
    created_by: createdBy,
  });

  for (const line of sourceLines) {
    await repo.createEstimateLine(accessToken, {
      estimate_id: next.id,
      item: line.item,
      quantity: line.quantity,
      unit: line.unit,
      rate: line.rate,
      cost_category: line.cost_category,
      line_total: line.line_total,
      source: line.source,
      confidence: line.confidence,
    });
  }

  const totals = recomputeTotals(next, sourceLines);
  const updated = await repo.updateEstimate(accessToken, next.id, totals);
  return updated ?? next;
}

export interface SubmitEstimateForApprovalInput {
  estimateId: string;
  /** Whoever configured this feature in the Configuration Studio names which published approval workflow to run — same "no automatic resolution" convention as ticket 0066's explicit approverUserIds/ticket 0075's proposeBaselineChange; this module does not guess a definition. */
  definitionId: string;
  submittedBy: string | null;
}

/**
 * FR-EST-003: starts a real `request_approval` workflow instance
 * (ticket 0066/0062's seam), the exact same shape as ticket 0075's
 * proposeBaselineChange, rather than inventing a parallel approval
 * mechanism. The estimate only records which instance is deciding it;
 * resolveEstimateApproval reads the outcome back out of that instance.
 */
export async function submitEstimateForApproval(
  repo: EstimatingRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  input: SubmitEstimateForApprovalInput,
): Promise<Estimate> {
  const estimate = await requireEstimate(repo, accessToken, input.estimateId);
  requireDraft(estimate);

  const { instance } = await startWorkflowInstance(workflowRepo, accessToken, input.definitionId, input.submittedBy, {
    estimateId: estimate.id,
    tenderSubmissionId: estimate.tender_submission_id,
  });

  const updated = await repo.updateEstimate(accessToken, estimate.id, {
    status: "pending_approval",
    workflow_instance_id: instance.id,
  });
  if (!updated) throw new NotFoundError();
  return updated;
}

/**
 * The polling half of the seam: no event bus exists in this codebase,
 * so an estimate's approval outcome is read back on demand by
 * inspecting its workflow instance's step instances for the one whose
 * output carries a `decision` (only a resolved request_approval step's
 * completeStepInstance call ever writes that key — see ticket 0066's
 * decideApprovalStep). Idempotent: once an estimate is no longer
 * `pending_approval`, this is a no-op read, never re-applies the
 * outcome twice. On approval, supersedes whichever other version of
 * the same tender submission was previously `approved` — mirrors
 * ticket 0075's resolveBaselineChangeRequest exactly.
 */
export async function resolveEstimateApproval(
  repo: EstimatingRepository,
  workflowRepo: WorkflowRepository,
  accessToken: string,
  estimateId: string,
): Promise<Estimate> {
  const estimate = await requireEstimate(repo, accessToken, estimateId);
  if (estimate.status !== "pending_approval") return estimate;
  if (!estimate.workflow_instance_id) return estimate;

  const { stepInstances } = await getWorkflowInstance(workflowRepo, accessToken, estimate.workflow_instance_id);
  const decidedStep = stepInstances.find((s) => typeof s.output?.decision === "string");
  if (!decidedStep) return estimate;

  const decision = decidedStep.output.decision as string;
  if (decision === "approved") {
    const siblings = await repo.listEstimates(accessToken, estimate.tender_submission_id);
    const previouslyApproved = siblings.find((e) => e.id !== estimate.id && e.status === "approved");
    if (previouslyApproved) {
      await repo.updateEstimate(accessToken, previouslyApproved.id, { status: "superseded" });
    }
    const updated = await repo.updateEstimate(accessToken, estimateId, { status: "approved" });
    return updated!;
  }

  // "rejected" and "returned_for_correction" are both legal
  // ApprovalChainDecision values (ticket 0066) and are kept as their
  // own distinct estimate statuses, same literal pass-through ticket
  // 0075's resolveBaselineChangeRequest uses for its change-request
  // status. A returned_for_correction estimate is still editable (see
  // requireDraft) so the submitter can fix it and resubmit without
  // creating a whole new version.
  const updated = await repo.updateEstimate(accessToken, estimateId, {
    status: decision as "rejected" | "returned_for_correction",
  });
  return updated!;
}
