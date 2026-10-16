/**
 * M11a (ticket 0096): tender document register & scope matrix/
 * clarification log — both are child rows of M10b's (ticket 0091)
 * `tender_submissions`, not a new tender entity.
 */
export interface TenderDocument {
  id: string;
  tenant_id: string;
  tender_submission_id: string;
  document_type: string;
  title: string;
  document_number: string | null;
  revision: string | null;
  received_date: string | null;
  /** Plain text/URL reference only — no bespoke upload pipeline here; that's M13's job. */
  storage_reference: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** BRD §10.1 step 5's clarification log: item raised, and (eventually) its response. */
export interface TenderClarification {
  id: string;
  tenant_id: string;
  tender_submission_id: string;
  item: string;
  raised_by: string;
  raised_at: string;
  response: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}
