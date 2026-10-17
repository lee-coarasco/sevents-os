import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { OrgSetupPage } from "./pages/OrgSetupPage";
import { DepartmentsRolesPage } from "./pages/DepartmentsRolesPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { TaskInboxPage } from "./pages/TaskInboxPage";
import { ApprovalQueuePage } from "./pages/ApprovalQueuePage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { CrmPage } from "./pages/CrmPage";
import { OpportunityDetailPage } from "./pages/OpportunityDetailPage";
import { TenderSubmissionDetailPage } from "./pages/TenderSubmissionDetailPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { DocumentDetailPage } from "./pages/DocumentDetailPage";
import { CataloguePage } from "./pages/CataloguePage";
import { MasterDataPage } from "./pages/masterdata/MasterDataPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="org-setup" element={<OrgSetupPage />} />
            <Route path="departments-roles" element={<DepartmentsRolesPage />} />
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="my-work" element={<TaskInboxPage />} />
            <Route path="approvals" element={<ApprovalQueuePage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="projects/:id" element={<ProjectDetailPage />} />
            <Route path="crm" element={<CrmPage />} />
            <Route path="crm/opportunities/:id" element={<OpportunityDetailPage />} />
            <Route path="tendering/tender-submissions/:id" element={<TenderSubmissionDetailPage />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="documents/:id" element={<DocumentDetailPage />} />
            <Route path="catalogue" element={<CataloguePage />} />
            <Route path="master-data" element={<MasterDataPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
