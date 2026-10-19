import type { DashboardRepository } from "./repository.js";
import type {
  DashboardSummary,
  ExecutiveAnalytics,
  FinancialAnalytics,
  OperationsAnalytics,
  DashboardReport,
  CreateReportInput,
  ReportCategory,
  ReportDataResult,
} from "./types.js";

export function createDashboardService(repository: DashboardRepository) {
  return {
    async getSummary(tenantId: string): Promise<DashboardSummary> {
      return repository.getSummary(tenantId);
    },

    async getExecutiveAnalytics(
      tenantId: string,
      projectId?: string
    ): Promise<ExecutiveAnalytics> {
      return repository.getExecutiveAnalytics(tenantId, projectId);
    },

    async getFinancialAnalytics(
      tenantId: string,
      projectId?: string
    ): Promise<FinancialAnalytics> {
      return repository.getFinancialAnalytics(tenantId, projectId);
    },

    async getOperationsAnalytics(
      tenantId: string,
      projectId?: string
    ): Promise<OperationsAnalytics> {
      return repository.getOperationsAnalytics(tenantId, projectId);
    },

    async listReports(
      tenantId: string,
      category?: ReportCategory
    ): Promise<DashboardReport[]> {
      return repository.listReports(tenantId, category);
    },

    async createReport(
      tenantId: string,
      input: CreateReportInput
    ): Promise<DashboardReport> {
      if (!input.name || input.name.trim().length === 0) {
        throw new Error("Report name is required");
      }
      return repository.createReport(tenantId, {
        ...input,
        name: input.name.trim(),
      });
    },

    async deleteReport(tenantId: string, id: string): Promise<boolean> {
      return repository.deleteReport(tenantId, id);
    },

    async generateReportData(
      tenantId: string,
      entity: string,
      filters?: Record<string, unknown>
    ): Promise<ReportDataResult> {
      if (!entity) {
        throw new Error("Entity is required to generate report");
      }
      return repository.generateReportData(tenantId, entity, filters);
    },
  };
}
