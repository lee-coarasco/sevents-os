import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OrgSetupPage } from "./pages/OrgSetupPage";
import { DepartmentsRolesPage } from "./pages/DepartmentsRolesPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { EmployeeDetailPage } from "./pages/EmployeeDetailPage";
import { TaskInboxPage } from "./pages/TaskInboxPage";
import { ApprovalQueuePage } from "./pages/ApprovalQueuePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { CrmPage } from "./pages/CrmPage";
import { CrmClientDetailPage } from "./pages/CrmClientDetailPage";
import { OpportunityDetailPage } from "./pages/OpportunityDetailPage";
import { TenderingPage } from "./pages/TenderingPage";
import { TenderSubmissionDetailPage } from "./pages/TenderSubmissionDetailPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { SiteOperationsPage } from "./pages/SiteOperationsPage";
import { CataloguePage } from "./pages/CataloguePage";
import { CatalogueGuidePage } from "./pages/CatalogueGuidePage";
import { MasterDataPage } from "./pages/masterdata/MasterDataPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { WorkflowDefinitionsPage } from "./pages/WorkflowDefinitionsPage";
import { WorkflowDefinitionDetailPage } from "./pages/WorkflowDefinitionDetailPage";
import { WorkflowVersionDetailPage } from "./pages/WorkflowVersionDetailPage";
import { WorkflowGuidePage } from "./pages/WorkflowGuidePage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { ProcurementPage } from "./pages/ProcurementPage";
import { InventoryPage } from "./pages/InventoryPage";
import { SubcontractorsPage } from "./pages/SubcontractorsPage";
import { QualityPage } from "./pages/QualityPage";
import { SafetyPage } from "./pages/SafetyPage";
import { EquipmentPage } from "./pages/EquipmentPage";
import { FinancePage } from "./pages/FinancePage";
import { BillingPage } from "./pages/BillingPage";
import { ContractsPage } from "./pages/ContractsPage";
import { PeoplePage } from "./pages/PeoplePage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { LegalPage } from "./pages/LegalPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { PlatformAdminPage } from "./pages/PlatformAdminPage";
import { FieldModePage } from "./pages/FieldModePage";
import { MigrationPage } from "./pages/MigrationPage";
import { AiKnowledgePage } from "./pages/AiKnowledgePage";
import { AiAgentsPage } from "./pages/AiAgentsPage";
import { AiAgentRunsPage } from "./pages/AiAgentRunsPage";
import { PermissionsProvider } from "./context/PermissionsContext";
import { OfflineSyncProvider } from "./context/OfflineSyncContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <PermissionsProvider>
      <OfflineSyncProvider>{children}</OfflineSyncProvider>
    </PermissionsProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route
              path="org-setup"
              element={
                <ProtectedRoute anyPermission={["tenancy.company.manage", "tenancy.branch.manage", "tenancy.project.manage"]}>
                  <OrgSetupPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="departments-roles"
              element={
                <ProtectedRoute anyPermission={["authority.role.manage", "authority.department.manage"]}>
                  <DepartmentsRolesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="employees"
              element={
                <ProtectedRoute permission="employee.directory.manage">
                  <EmployeesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="employees/:id"
              element={
                <ProtectedRoute permission="employee.directory.manage">
                  <EmployeeDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="my-work" element={<TaskInboxPage />} />
            <Route path="tasks" element={<Navigate to="/my-work" replace />} />
            <Route path="approvals" element={<ApprovalQueuePage />} />
            <Route
              path="projects"
              element={
                <ProtectedRoute anyPermission={["tenancy.project.manage", "project.progress.record", "project.baseline.manage", "project.closeout.manage"]}>
                  <ProjectsPage />
                </ProtectedRoute>
              }
            />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route
              path="site"
              element={
                <ProtectedRoute anyPermission={["site.dpr.manage", "site.dpr.approve", "site.instruction.manage"]}>
                  <SiteOperationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="field"
              element={
                <ProtectedRoute anyPermission={["site.dpr.manage", "site.dpr.approve", "site.instruction.manage", "safety.hazard.manage", "quality.inspection.manage"]}>
                  <FieldModePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="crm"
              element={
                <ProtectedRoute permission="crm.lead.manage">
                  <CrmPage />
                </ProtectedRoute>
              }
            />
            <Route path="crm/clients/:id" element={<CrmClientDetailPage />} />
            <Route path="crm/opportunities/:id" element={<OpportunityDetailPage />} />
            <Route
              path="tendering"
              element={
                <ProtectedRoute anyPermission={["tendering.document.manage", "crm.lead.manage"]}>
                  <TenderingPage />
                </ProtectedRoute>
              }
            />
            <Route path="tendering/tender-submissions/:id" element={<TenderSubmissionDetailPage />} />
            <Route
              path="documents"
              element={
                <ProtectedRoute permission="documents.register.manage">
                  <DocumentsPage />
                </ProtectedRoute>
              }
            />
            <Route path="documents/:id" element={<DocumentDetailPage />} />
            <Route
              path="procurement"
              element={
                <ProtectedRoute anyPermission={["procurement.requisition.manage", "procurement.po.manage", "procurement.vendor.manage"]}>
                  <ProcurementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <ProtectedRoute anyPermission={["inventory.stock.view", "inventory.store.manage", "inventory.grn.manage", "inventory.issue.manage", "inventory.gatepass.manage"]}>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="subcontractors"
              element={
                <ProtectedRoute anyPermission={["subcontractor.workorder.view", "subcontractor.workorder.manage", "subcontractor.attendance.manage", "subcontractor.claims.manage", "subcontractor.claims.certify"]}>
                  <SubcontractorsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="quality"
              element={
                <ProtectedRoute anyPermission={["quality.inspection.manage", "quality.inspection.signoff", "quality.ncr.manage", "quality.itp.manage", "quality.ncr.close"]}>
                  <QualityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="safety"
              element={
                <ProtectedRoute anyPermission={["safety.ptw.manage", "safety.ptw.approve", "safety.incident.manage", "safety.incident.investigate", "safety.hazard.manage", "safety.tbt.manage"]}>
                  <SafetyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="equipment"
              element={
                <ProtectedRoute anyPermission={["equipment.asset.manage", "equipment.allocation.manage", "equipment.allocation.approve", "equipment.log.manage", "equipment.maintenance.manage", "equipment.certificate.manage"]}>
                  <EquipmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="finance"
              element={
                <ProtectedRoute anyPermission={["finance.budget.manage", "finance.budget.approve", "finance.forecast.manage", "finance.expense.manage", "finance.expense.approve", "finance.period.manage"]}>
                  <FinancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="billing"
              element={
                <ProtectedRoute anyPermission={["billing.application.manage", "billing.application.certify", "billing.invoice.manage", "billing.receipt.record", "billing.vendor_bill.manage", "billing.vendor_bill.approve", "billing.retention.manage"]}>
                  <BillingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="contracts"
              element={
                <ProtectedRoute anyPermission={["contracts.contract.manage", "contracts.variation.manage", "contracts.variation.approve", "contracts.claim.manage", "contracts.claim.assess", "contracts.security.manage"]}>
                  <ContractsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="people"
              element={
                <ProtectedRoute anyPermission={["people.manpower.manage", "people.manpower.approve", "people.recruitment.manage", "people.competency.manage", "people.appraisal.manage"]}>
                  <PeoplePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="communications"
              element={
                <ProtectedRoute anyPermission={["communications.stakeholder.manage", "communications.log.manage", "communications.minutes.manage", "communications.complaint.manage", "communications.complaint.resolve"]}>
                  <CommunicationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="legal"
              element={
                <ProtectedRoute anyPermission={["legal.licence.manage", "legal.licence.renew", "legal.matter.manage", "legal.matter.view_privileged", "legal.counsel.manage", "legal.compliance.manage"]}>
                  <LegalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="integrations"
              element={
                <ProtectedRoute anyPermission={["integrations.api_key.manage", "integrations.webhook.manage", "integrations.connector.manage", "integrations.log.view"]}>
                  <IntegrationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="platform-admin"
              element={
                <ProtectedRoute anyPermission={["platform.settings.view", "platform.settings.manage", "platform.feature_flags.manage", "platform.health.view", "platform.maintenance.manage", "platform.support.view", "platform.support.manage"]}>
                  <PlatformAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="migration"
              element={
                <ProtectedRoute anyPermission={["migration.job.view", "migration.import.execute"]}>
                  <MigrationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai/knowledge"
              element={
                <ProtectedRoute anyPermission={["ai.assistant.query", "ai.knowledge.manage"]}>
                  <AiKnowledgePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai/agents"
              element={
                <ProtectedRoute anyPermission={["ai.agent.execute", "ai.agent.manage"]}>
                  <AiAgentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="ai/runs"
              element={
                <ProtectedRoute anyPermission={["ai.agent.execute", "ai.agent.manage", "ai.agent.audit"]}>
                  <AiAgentRunsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="catalogue"
              element={
                <ProtectedRoute permission="catalogue.workitem.manage">
                  <CataloguePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="master-data"
              element={
                <ProtectedRoute permission="master-data.manage">
                  <MasterDataPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/users"
              element={
                <ProtectedRoute anyPermission={["identity.user.invite", "admin.users.manage"]}>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="config-studio"
              element={
                <ProtectedRoute permission="workflow.definition.manage">
                  <WorkflowDefinitionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="config-studio/:definitionId"
              element={
                <ProtectedRoute permission="workflow.definition.manage">
                  <WorkflowDefinitionDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="config-studio/:definitionId/versions/:versionId"
              element={
                <ProtectedRoute permission="workflow.definition.manage">
                  <WorkflowVersionDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="catalogue/guide" element={<CatalogueGuidePage />} />
            <Route path="config-studio/guide" element={<WorkflowGuidePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
