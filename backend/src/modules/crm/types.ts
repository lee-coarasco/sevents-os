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
