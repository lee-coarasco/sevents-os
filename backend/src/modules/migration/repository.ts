import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MigrationJob,
  MigrationEntityType,
  MigrationJobStatus,
  RowError,
} from "./types.js";

export interface MigrationRepository {
  createJob(
    token: string,
    data: {
      tenant_id: string;
      entity_type: MigrationEntityType;
      file_name: string;
      status: MigrationJobStatus;
      total_rows: number;
      valid_rows: number;
      error_rows: number;
      row_errors: RowError[];
      created_by?: string;
    }
  ): Promise<MigrationJob>;

  getJobById(token: string, id: string): Promise<MigrationJob | null>;

  listJobs(token: string, limit?: number): Promise<MigrationJob[]>;

  updateJob(
    token: string,
    id: string,
    updates: Partial<MigrationJob>
  ): Promise<MigrationJob>;

  checkExistingKeys(
    token: string,
    entityType: MigrationEntityType,
    keys: string[]
  ): Promise<Set<string>>;

  insertBatch(
    token: string,
    entityType: MigrationEntityType,
    rows: Record<string, unknown>[]
  ): Promise<string[]>;

  deleteBatch(
    token: string,
    entityType: MigrationEntityType,
    ids: string[]
  ): Promise<number>;
}

export function createSupabaseMigrationRepository(
  getUserScopedClient: (token: string) => SupabaseClient
): MigrationRepository {
  return {
    async createJob(token, data) {
      const client = getUserScopedClient(token);
      const { data: job, error } = await client
        .from("migration_jobs")
        .insert({
          tenant_id: data.tenant_id,
          entity_type: data.entity_type,
          file_name: data.file_name,
          status: data.status,
          total_rows: data.total_rows,
          valid_rows: data.valid_rows,
          error_rows: data.error_rows,
          row_errors: data.row_errors,
          rollback_snapshot: [],
          created_by: data.created_by,
        })
        .select()
        .single();

      if (error) throw new Error(`createJob failed: ${error.message}`);
      return job as MigrationJob;
    },

    async getJobById(token, id) {
      const client = getUserScopedClient(token);
      const { data: job, error } = await client
        .from("migration_jobs")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw new Error(`getJobById failed: ${error.message}`);
      return (job as MigrationJob) || null;
    },

    async listJobs(token, limit = 50) {
      const client = getUserScopedClient(token);
      const { data: jobs, error } = await client
        .from("migration_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(`listJobs failed: ${error.message}`);
      return (jobs as MigrationJob[]) || [];
    },

    async updateJob(token, id, updates) {
      const client = getUserScopedClient(token);
      const { data: job, error } = await client
        .from("migration_jobs")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(`updateJob failed: ${error.message}`);
      return job as MigrationJob;
    },

    async checkExistingKeys(token, entityType, keys) {
      if (keys.length === 0) return new Set<string>();
      const client = getUserScopedClient(token);
      const existing = new Set<string>();

      try {
        if (entityType === "work_items") {
          const { data } = await client
            .from("catalogue_items")
            .select("item_code")
            .in("item_code", keys);
          data?.forEach((r: { item_code: string }) => existing.add(r.item_code.toLowerCase()));
        } else if (entityType === "cost_codes") {
          const { data } = await client
            .from("cost_codes")
            .select("code")
            .in("code", keys);
          data?.forEach((r: { code: string }) => existing.add(r.code.toLowerCase()));
        } else if (entityType === "employees") {
          const { data } = await client
            .from("employees")
            .select("work_email")
            .in("work_email", keys);
          data?.forEach((r: { work_email: string }) => existing.add(r.work_email.toLowerCase()));
        } else if (entityType === "vendors") {
          const { data } = await client
            .from("vendors")
            .select("name")
            .in("name", keys);
          data?.forEach((r: { name: string }) => existing.add(r.name.toLowerCase()));
        } else if (entityType === "inventory_items") {
          const { data } = await client
            .from("inventory_items")
            .select("item_code")
            .in("item_code", keys);
          data?.forEach((r: { item_code: string }) => existing.add(r.item_code.toLowerCase()));
        }
      } catch (err) {
        console.warn("[MigrationRepo] duplicate check query non-fatal warning:", err);
      }

      return existing;
    },

    async insertBatch(token, entityType, rows) {
      const client = getUserScopedClient(token);
      let targetTable = "";

      switch (entityType) {
        case "work_items":
          targetTable = "catalogue_items";
          break;
        case "cost_codes":
          targetTable = "cost_codes";
          break;
        case "employees":
          targetTable = "employees";
          break;
        case "vendors":
          targetTable = "vendors";
          break;
        case "inventory_items":
          targetTable = "inventory_items";
          break;
        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }

      const { data, error } = await client
        .from(targetTable)
        .insert(rows)
        .select("id");

      if (error) {
        throw new Error(`Batch insert failed into ${targetTable}: ${error.message}`);
      }

      return (data as { id: string }[]).map((r) => r.id);
    },

    async deleteBatch(token, entityType, ids) {
      if (ids.length === 0) return 0;
      const client = getUserScopedClient(token);
      let targetTable = "";

      switch (entityType) {
        case "work_items":
          targetTable = "catalogue_items";
          break;
        case "cost_codes":
          targetTable = "cost_codes";
          break;
        case "employees":
          targetTable = "employees";
          break;
        case "vendors":
          targetTable = "vendors";
          break;
        case "inventory_items":
          targetTable = "inventory_items";
          break;
        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }

      const { error, count } = await client
        .from(targetTable)
        .delete({ count: "exact" })
        .in("id", ids);

      if (error) {
        throw new Error(`Batch rollback delete failed on ${targetTable}: ${error.message}`);
      }

      return count ?? ids.length;
    },
  };
}
