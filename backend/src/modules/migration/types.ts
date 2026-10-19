export type MigrationEntityType =
  | "work_items"
  | "cost_codes"
  | "employees"
  | "vendors"
  | "inventory_items";

export type MigrationJobStatus =
  | "draft"
  | "validated"
  | "imported"
  | "rolled_back"
  | "failed";

export interface RowError {
  row: number;
  field: string;
  message: string;
  severity?: "error" | "warning";
}

export interface MigrationJob {
  id: string;
  tenant_id: string;
  entity_type: MigrationEntityType;
  file_name: string;
  status: MigrationJobStatus;
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  row_errors: RowError[];
  rollback_snapshot: string[];
  imported_at?: string | null;
  rolled_back_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValidationResult {
  valid: boolean;
  jobId: string;
  entityType: MigrationEntityType;
  fileName: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: RowError[];
  preview: Record<string, unknown>[];
}

export interface ImportResult {
  success: boolean;
  jobId: string;
  importedCount: number;
  status: MigrationJobStatus;
}

export interface RollbackResult {
  success: boolean;
  jobId: string;
  deletedCount: number;
  status: MigrationJobStatus;
}
