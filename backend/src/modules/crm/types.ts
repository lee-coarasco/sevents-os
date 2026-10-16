export type OpportunityStage = "lead" | "qualified" | "site_visit" | "tender" | "negotiation" | "won" | "lost";

export const OPPORTUNITY_STAGES: OpportunityStage[] = [
  "lead",
  "qualified",
  "site_visit",
  "tender",
  "negotiation",
  "won",
  "lost",
];

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  trade_license_number: string | null;
  registration_country: string | null;
  primary_contact_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  tenant_id: string;
  client_id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  tenant_id: string;
  client_id: string;
  title: string;
  source: string;
  owner_id: string;
  stage: OpportunityStage;
  expected_value: number | null;
  probability: number | null;
  next_action: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** FR-CRM-004: set only once completeHandover's gate passes — see ticket 0092 (M10c). */
  handover_completed_at: string | null;
  handover_completed_by: string | null;
}

export interface SiteVisit {
  id: string;
  tenant_id: string;
  opportunity_id: string;
  visited_by: string;
  visit_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** FR-CRM-003: a tender deadline plus whatever evidence shows what was submitted and when. */
export interface TenderSubmission {
  id: string;
  tenant_id: string;
  opportunity_id: string;
  deadline_date: string;
  submitted_at: string | null;
  evidence_reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A log entry, not a two-way messaging feature — no send/receive here. */
export interface ClientCommunication {
  id: string;
  tenant_id: string;
  client_id: string;
  opportunity_id: string | null;
  channel: string;
  summary: string;
  logged_by: string;
  occurred_at: string;
  created_at: string;
}

/**
 * FR-CRM-004: the CRM module's own "sales-to-technical handoff"
 * checklist (BRD §7's M10 row, §10.1 step 13) — a fixed four-item
 * list, same CLOSEOUT_ITEM_KEYS-style convention as ticket 0077's
 * project closeout checklist, not a configurable checklist builder
 * (that's M06's job). This is a separate, earlier gate from M09's
 * project closeout checklist: it covers handing a *won opportunity*
 * to Technical, not closing out the project built from it.
 */
export const HANDOVER_ITEM_KEYS = [
  "client_confirmation",
  "commercial_terms_locked",
  "site_information_handed_over",
  "technical_owner_assigned",
] as const;
export type HandoverItemKey = (typeof HANDOVER_ITEM_KEYS)[number];
export type HandoverItemStatus = "pending" | "complete";

export interface OpportunityHandoverChecklistItem {
  id: string;
  tenant_id: string;
  opportunity_id: string;
  item_key: HandoverItemKey;
  status: HandoverItemStatus;
  completed_by: string | null;
  completed_at: string | null;
}

export type HandoverExceptionStatus = "pending" | "approved" | "rejected" | "returned_for_correction";

/**
 * FR-CRM-004's "unless an authorized exception is recorded" path —
 * same request/resolve-via-workflow-instance shape as ticket 0075's
 * ProjectBaselineChangeRequest and ticket 0080's DataRequest, reusing
 * the M08 request_approval seam rather than a second approval
 * mechanism.
 */
export interface OpportunityHandoverException {
  id: string;
  tenant_id: string;
  opportunity_id: string;
  reason: string;
  requested_by: string | null;
  workflow_instance_id: string;
  status: HandoverExceptionStatus;
  created_at: string;
  updated_at: string;
}
