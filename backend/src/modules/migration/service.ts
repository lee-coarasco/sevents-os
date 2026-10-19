import type { MigrationRepository } from "./repository.js";
import type {
  MigrationEntityType,
  RowError,
  ValidationResult,
  ImportResult,
  RollbackResult,
  MigrationJob,
} from "./types.js";

export interface MigrationService {
  getSampleTemplate(entityType: MigrationEntityType): { fileName: string; csvContent: string };
  validateImport(
    token: string,
    tenantId: string,
    entityType: MigrationEntityType,
    fileName: string,
    rows: Record<string, string>[],
    userId?: string
  ): Promise<ValidationResult>;
  commitImport(
    token: string,
    tenantId: string,
    jobId: string,
    rows: Record<string, string>[],
    userId?: string
  ): Promise<ImportResult>;
  rollbackImport(
    token: string,
    tenantId: string,
    jobId: string,
    userId?: string
  ): Promise<RollbackResult>;
  listJobs(token: string, limit?: number): Promise<MigrationJob[]>;
  getJob(token: string, jobId: string): Promise<MigrationJob | null>;
}

export function createMigrationService(repo: MigrationRepository): MigrationService {
  return {
    getSampleTemplate(entityType: MigrationEntityType) {
      switch (entityType) {
        case "work_items":
          return {
            fileName: "work_items_template.csv",
            csvContent:
              "item_code,title,description,unit,category\n" +
              "CON-001,Substructure Excavation,Bulk earth excavation in soft rock,m3,Civil & Structural\n" +
              "CON-002,Reinforced Concrete Slab 200mm,Grade 40 ready-mix concrete with formwork,m2,Concrete Works\n" +
              "MEP-101,HVAC Chilled Water Piping,Schedule 40 seamless carbon steel pipe 100mm dia,m,Mechanical Works\n",
          };
        case "cost_codes":
          return {
            fileName: "cost_codes_cbs_template.csv",
            csvContent:
              "code,name,category,description\n" +
              "01-100,Project Management & Supervision,Preliminaries,Site management and HSE staff overheads\n" +
              "02-200,Substructure Earthworks,Direct Costs,Excavation backfilling and shoring\n" +
              "03-300,Concrete & Reinforcement,Direct Costs,Structural concrete formwork and rebar\n",
          };
        case "employees":
          return {
            fileName: "employee_directory_template.csv",
            csvContent:
              "first_name,last_name,work_email,job_title,department_code\n" +
              "Ahmed,Al-Mansoor,ahmed.mansoor@sevents.test,Senior Project Manager,OPS\n" +
              "Priya,Nair,priya.nair@sevents.test,Lead Quantity Surveyor,COMM\n" +
              "Tariq,Mahmoud,tariq.m@sevents.test,QHSE Engineer,HSE\n",
          };
        case "vendors":
          return {
            fileName: "approved_vendors_template.csv",
            csvContent:
              "name,trade_category,trn_number,contact_email,phone\n" +
              "Gulf Ready Mix LLC,Concrete Supplier,100234567800003,sales@gulfreadymix.ae,+971 4 888 1234\n" +
              "Emirates Steel Industries,Rebar Supplier,100987654300003,orders@emiratessteel.ae,+971 2 550 5678\n" +
              "Apex Electromechanical Subcontracting,MEP Subcontractor,100112233400003,tenders@apex-mep.ae,+971 4 330 9999\n",
          };
        case "inventory_items":
          return {
            fileName: "inventory_catalogue_template.csv",
            csvContent:
              "item_code,name,uom,reorder_point,unit_cost\n" +
              "MAT-CEM-01,Portland Cement OPC 50kg bag,bag,200,18.50\n" +
              "MAT-STL-16,High Yield Deformed Rebar 16mm,ton,15,2650.00\n" +
              "MAT-PVC-110,UPVC Drainage Pipe 110mm x 6m,length,50,45.00\n",
          };
        default:
          throw new Error(`Unsupported entity type: ${entityType}`);
      }
    },

    async validateImport(token, tenantId, entityType, fileName, rows, userId) {
      const errors: RowError[] = [];
      const seenKeysInFile = new Set<string>();
      const candidateDbKeys: string[] = [];

      // Pass 1: Syntax & Required Fields validation
      rows.forEach((row, idx) => {
        const rowNum = idx + 2; // header is row 1
        let key = "";

        if (entityType === "work_items") {
          key = (row.item_code || "").trim();
          if (!key) errors.push({ row: rowNum, field: "item_code", message: "Item code is mandatory" });
          if (!row.title?.trim()) errors.push({ row: rowNum, field: "title", message: "Item title is mandatory" });
          if (!row.unit?.trim()) errors.push({ row: rowNum, field: "unit", message: "Unit of measure is mandatory" });
        } else if (entityType === "cost_codes") {
          key = (row.code || "").trim();
          if (!key) errors.push({ row: rowNum, field: "code", message: "Cost code is mandatory" });
          if (!row.name?.trim()) errors.push({ row: rowNum, field: "name", message: "Code name is mandatory" });
        } else if (entityType === "employees") {
          key = (row.work_email || "").trim().toLowerCase();
          if (!row.first_name?.trim()) errors.push({ row: rowNum, field: "first_name", message: "First name is mandatory" });
          if (!row.last_name?.trim()) errors.push({ row: rowNum, field: "last_name", message: "Last name is mandatory" });
          if (!key) {
            errors.push({ row: rowNum, field: "work_email", message: "Work email is mandatory" });
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) {
            errors.push({ row: rowNum, field: "work_email", message: "Invalid email format" });
          }
        } else if (entityType === "vendors") {
          key = (row.name || "").trim().toLowerCase();
          if (!key) errors.push({ row: rowNum, field: "name", message: "Vendor company name is mandatory" });
          if (!row.trade_category?.trim()) errors.push({ row: rowNum, field: "trade_category", message: "Trade category is mandatory" });
        } else if (entityType === "inventory_items") {
          key = (row.item_code || "").trim();
          if (!key) errors.push({ row: rowNum, field: "item_code", message: "Item SKU code is mandatory" });
          if (!row.name?.trim()) errors.push({ row: rowNum, field: "name", message: "Material name is mandatory" });
          if (!row.uom?.trim()) errors.push({ row: rowNum, field: "uom", message: "Unit of measure (UOM) is mandatory" });
        }

        if (key) {
          const lowerKey = key.toLowerCase();
          if (seenKeysInFile.has(lowerKey)) {
            errors.push({
              row: rowNum,
              field: "duplicate",
              message: `Duplicate identifier "${key}" found multiple times within this import file`,
            });
          } else {
            seenKeysInFile.add(lowerKey);
            candidateDbKeys.push(key);
          }
        }
      });

      // Pass 2: Duplicate check against Database
      if (candidateDbKeys.length > 0) {
        const existingInDb = await repo.checkExistingKeys(token, entityType, candidateDbKeys);
        rows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const k = (
            row.item_code ||
            row.code ||
            row.work_email ||
            row.name ||
            ""
          ).trim().toLowerCase();
          if (k && existingInDb.has(k)) {
            errors.push({
              row: rowNum,
              field: "database_conflict",
              message: `Record with key "${k}" already exists in the system database`,
              severity: "warning",
            });
          }
        });
      }

      const totalRows = rows.length;
      const errorRows = new Set(errors.filter((e) => e.severity !== "warning").map((e) => e.row)).size;
      const validRows = Math.max(0, totalRows - errorRows);
      const isValid = errorRows === 0;

      // Save dry-run job record
      const job = await repo.createJob(token, {
        tenant_id: tenantId,
        entity_type: entityType,
        file_name: fileName,
        status: isValid ? "validated" : "draft",
        total_rows: totalRows,
        valid_rows: validRows,
        error_rows: errorRows,
        row_errors: errors,
        created_by: userId,
      });

      return {
        valid: isValid,
        jobId: job.id,
        entityType,
        fileName,
        totalRows,
        validRows,
        errorRows,
        errors,
        preview: rows.slice(0, 5),
      };
    },

    async commitImport(token, tenantId, jobId, rows, _userId) {
      const job = await repo.getJobById(token, jobId);
      if (!job) {
        throw new Error(`Migration job with ID "${jobId}" not found`);
      }
      if (job.status === "imported") {
        throw new Error("This migration batch has already been imported.");
      }

      // Map rows according to entity schema
      const mappedRows: Record<string, unknown>[] = rows.map((r) => {
        const base: Record<string, unknown> = {
          tenant_id: tenantId,
        };

        if (job.entity_type === "work_items") {
          return {
            ...base,
            item_code: r.item_code?.trim(),
            title: r.title?.trim(),
            description: r.description?.trim() || "",
            unit: r.unit?.trim(),
            category: r.category?.trim() || "General Works",
            status: "active",
          };
        } else if (job.entity_type === "cost_codes") {
          return {
            ...base,
            code: r.code?.trim(),
            name: r.name?.trim(),
            category: r.category?.trim() || "General",
            description: r.description?.trim() || "",
          };
        } else if (job.entity_type === "employees") {
          return {
            ...base,
            first_name: r.first_name?.trim(),
            last_name: r.last_name?.trim(),
            work_email: r.work_email?.trim().toLowerCase(),
            job_title: r.job_title?.trim() || "Employee",
            department_code: r.department_code?.trim() || "OPS",
            status: "active",
          };
        } else if (job.entity_type === "vendors") {
          return {
            ...base,
            name: r.name?.trim(),
            trade_category: r.trade_category?.trim() || "Supplier",
            trn_number: r.trn_number?.trim() || null,
            contact_email: r.contact_email?.trim() || null,
            phone: r.phone?.trim() || null,
            status: "active",
          };
        } else if (job.entity_type === "inventory_items") {
          return {
            ...base,
            item_code: r.item_code?.trim(),
            name: r.name?.trim(),
            uom: r.uom?.trim(),
            reorder_point: Number(r.reorder_point) || 0,
            unit_cost: Number(r.unit_cost) || 0,
          };
        }
        return base;
      });

      // Insert and capture rollback snapshot
      const insertedIds = await repo.insertBatch(token, job.entity_type, mappedRows);

      // Update job to imported
      const updated = await repo.updateJob(token, jobId, {
        status: "imported",
        rollback_snapshot: insertedIds,
        imported_at: new Date().toISOString(),
      });

      return {
        success: true,
        jobId: updated.id,
        importedCount: insertedIds.length,
        status: "imported",
      };
    },

    async rollbackImport(token, _tenantId, jobId, _userId) {
      const job = await repo.getJobById(token, jobId);
      if (!job) {
        throw new Error(`Migration job with ID "${jobId}" not found`);
      }
      if (job.status !== "imported") {
        throw new Error(`Only jobs with 'imported' status can be rolled back. Current status is '${job.status}'.`);
      }

      const snapshotIds = job.rollback_snapshot || [];
      const deletedCount = await repo.deleteBatch(token, job.entity_type, snapshotIds);

      await repo.updateJob(token, jobId, {
        status: "rolled_back",
        rolled_back_at: new Date().toISOString(),
      });

      return {
        success: true,
        jobId: job.id,
        deletedCount,
        status: "rolled_back",
      };
    },

    async listJobs(token, limit) {
      return repo.listJobs(token, limit);
    },

    async getJob(token, jobId) {
      return repo.getJobById(token, jobId);
    },
  };
}
