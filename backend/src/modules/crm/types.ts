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
