/**
 * M11c (ticket 0098): bid/no-bid decision & quote/proposal approval.
 * BRD §10.1 steps 7-8; FR-BID-001. A decision is tied to an estimate
 * (ticket 0097/M11b) and resolved through the same request_approval
 * seam (ticket 0066/M08) every other approval-gated action in this
 * codebase uses.
 */
export type BidRecommendation = "bid" | "no_bid";

export type BidNoBidStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "approved_with_conditions"
  | "rejected"
  | "returned_for_correction";

export interface BidNoBidDecision {
  id: string;
  tenant_id: string;
  estimate_id: string;
  recommendation: BidRecommendation;
  status: BidNoBidStatus;
  /**
   * Set only once an 'approved_with_conditions' resolution lands —
   * copied up from the resolving approver's reason text (service.ts),
   * never typed twice.
   */
  conditions: string | null;
  workflow_instance_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const BID_CRITERIA = [
  "financial_viability",
  "technical_capability",
  "risk_exposure",
  "strategic_fit",
  "resource_availability",
] as const;
export type BidCriterion = (typeof BID_CRITERIA)[number];

export interface BidNoBidCriteriaScore {
  id: string;
  tenant_id: string;
  bid_no_bid_decision_id: string;
  criterion: BidCriterion;
  score: number;
  rationale: string;
  created_at: string;
  updated_at: string;
}

/** BRD §10.1 step 8: what was submitted, when, and to whom, once bid/no-bid is approved. */
export interface BidSubmission {
  id: string;
  tenant_id: string;
  bid_no_bid_decision_id: string;
  submitted_to: string;
  submitted_at: string;
  evidence_reference: string | null;
  submitted_by: string | null;
  created_at: string;
}
