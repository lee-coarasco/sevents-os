import { DISPOSITIONS, type Disposition, type DispositionRow, type RawCatalogueRow } from "./types.js";

export interface MergedCatalogueRow {
  source_serial: number;
  department: string;
  work_item_name: string;
  who_is_responsible: string;
  description: string | null;
  trigger_text: string | null;
  action_text: string | null;
  output_evidence: string | null;
  control_handoff: string | null;
  continuity_escalation: string | null;
  timing: string | null;
  canonical_role_id: string | null;
  disposition: Disposition;
  ticket_ref: string;
}

export interface MergeIssue {
  source_serial: number;
  reason: string;
}

export interface MergeResult {
  rows: MergedCatalogueRow[];
  issues: MergeIssue[];
}

function isDisposition(value: string): value is Disposition {
  return (DISPOSITIONS as readonly string[]).includes(value);
}

/**
 * Pure merge of the two source artifacts by source serial (S.No. / s_no).
 * No filesystem/network access — keeps this unit-testable with small
 * fixtures instead of the real 1,308-row files.
 */
export function mergeCatalogueRows(rawRows: RawCatalogueRow[], dispositionRows: DispositionRow[]): MergeResult {
  const dispositionBySerial = new Map<number, DispositionRow>();
  for (const row of dispositionRows) {
    const serial = Number(row.s_no);
    if (dispositionBySerial.has(serial)) {
      throw new Error(`duplicate s_no in disposition workbook: ${serial}`);
    }
    dispositionBySerial.set(serial, row);
  }

  const seenSerials = new Set<number>();
  const rows: MergedCatalogueRow[] = [];
  const issues: MergeIssue[] = [];

  for (const raw of rawRows) {
    const serial = raw["S.No."];
    if (seenSerials.has(serial)) {
      throw new Error(`duplicate S.No. in raw catalogue rows: ${serial}`);
    }
    seenSerials.add(serial);

    const disposition = dispositionBySerial.get(serial);
    if (!disposition) {
      issues.push({ source_serial: serial, reason: "no disposition-workbook row for this S.No." });
      continue;
    }
    if (!isDisposition(disposition.disposition)) {
      issues.push({
        source_serial: serial,
        reason: `disposition "${disposition.disposition}" is not one of the BRD §6.5 values`,
      });
      continue;
    }

    rows.push({
      source_serial: serial,
      department: raw.Department,
      work_item_name: raw["Work Item Name"],
      who_is_responsible: raw["Who is Responsible"],
      description: raw.Description ?? null,
      trigger_text: raw.Trigger ?? null,
      action_text: raw.Action ?? null,
      output_evidence: raw["Output/Evidence"] ?? null,
      control_handoff: raw["Control/Handoff"] ?? null,
      continuity_escalation: raw["Continuity/Escalation"] ?? null,
      timing: raw.Timing ?? null,
      canonical_role_id: disposition.canonical_role_id || null,
      disposition: disposition.disposition,
      ticket_ref: disposition.ticket_id,
    });
  }

  return { rows, issues };
}
