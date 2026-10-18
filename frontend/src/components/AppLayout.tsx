import { NavLink, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthContext";
import { NotificationBell } from "./NotificationBell";
import { PermissionGate } from "./PermissionGate";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? "bg-brand text-zinc-900"
      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

export function AppLayout() {
  const { session } = useAuth();
  const initials = session?.user.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50 font-body">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col bg-zinc-900 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
            <span className="font-brand text-sm font-bold text-zinc-900">S</span>
          </div>
          <span className="font-brand text-base font-semibold tracking-wide text-white">
            SEVENTS
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 px-3 pb-4">
          <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Overview
          </p>
          <NavLink to="/" className={navLinkClass} end>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </NavLink>

          <PermissionGate
            anyPermission={[
              "tenancy.company.manage",
              "tenancy.branch.manage",
              "tenancy.project.manage",
              "authority.role.manage",
              "authority.department.manage",
              "catalogue.workitem.manage",
              "master-data.manage",
              "identity.user.invite",
              "admin.users.manage",
              "workflow.definition.manage",
            ]}
          >
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Configuration
            </p>
            <PermissionGate anyPermission={["tenancy.company.manage", "tenancy.branch.manage", "tenancy.project.manage"]}>
              <NavLink to="/org-setup" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Company / Branch / Project
              </NavLink>
            </PermissionGate>
            <PermissionGate anyPermission={["authority.role.manage", "authority.department.manage"]}>
              <NavLink to="/departments-roles" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Departments &amp; Roles
              </NavLink>
            </PermissionGate>
            <PermissionGate permission="catalogue.workitem.manage">
              <NavLink to="/catalogue" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21m13.378.217l.217-.86A3 3 0 0018.75 12l-.395-.197a3 3 0 00-2.682 0l-.218.11a3 3 0 01-2.682 0l-.218-.11a3 3 0 00-2.682 0l-.395.197a3 3 0 00-1.995 2.567l.217.86m13.378.217L19.428 15.428zM3.75 12h.007v.008H3.75V12zm0-6h.007v.008H3.75V6zm0 12h.007v.008H3.75V18zM4.5 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0-6a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                Work-Item Catalogue
              </NavLink>
            </PermissionGate>
            <PermissionGate permission="master-data.manage">
              <NavLink to="/master-data" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm4-2v4m8-4v4M4 11h16" />
                </svg>
                Master Data
              </NavLink>
            </PermissionGate>
            <PermissionGate anyPermission={["identity.user.invite", "admin.users.manage"]}>
              <NavLink to="/admin/users" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Users
              </NavLink>
            </PermissionGate>
            <PermissionGate permission="workflow.definition.manage">
              <NavLink to="/config-studio" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.828c-.293.242-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.828c.292-.242.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.991l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configuration Studio
              </NavLink>
            </PermissionGate>
          </PermissionGate>

          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            Work
          </p>
          <NavLink to="/my-work" className={navLinkClass}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            My Work
          </NavLink>
          <NavLink to="/approvals" className={navLinkClass}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Approvals
          </NavLink>

          <PermissionGate
            anyPermission={[
              "tenancy.project.manage",
              "project.progress.record",
              "project.baseline.manage",
              "project.closeout.manage",
              "crm.lead.manage",
              "documents.register.manage",
              "site.dpr.manage",
              "site.dpr.approve",
              "site.instruction.manage",
              "procurement.requisition.manage",
              "procurement.po.manage",
              "procurement.vendor.manage",
              "inventory.stock.view",
              "inventory.store.manage",
              "inventory.grn.manage",
              "inventory.issue.manage",
              "inventory.gatepass.manage",
              "subcontractor.workorder.view",
              "subcontractor.workorder.manage",
              "subcontractor.attendance.manage",
              "subcontractor.claims.manage",
              "subcontractor.claims.certify",
              "quality.inspection.manage",
              "quality.inspection.signoff",
              "quality.ncr.manage",
              "quality.itp.manage",
              "quality.ncr.close",
              "safety.ptw.manage",
              "safety.ptw.approve",
              "safety.incident.manage",
              "safety.incident.investigate",
              "safety.hazard.manage",
              "safety.tbt.manage",
            ]}
          >
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Projects
            </p>
            <PermissionGate anyPermission={["tenancy.project.manage", "project.progress.record", "project.baseline.manage", "project.closeout.manage"]}>
              <NavLink to="/projects" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Projects
              </NavLink>
            </PermissionGate>
            <PermissionGate anyPermission={["site.dpr.manage", "site.dpr.approve", "site.instruction.manage"]}>
              <NavLink to="/site" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
                </svg>
                Site Operations &amp; DPR
              </NavLink>
            </PermissionGate>
            <PermissionGate anyPermission={["procurement.requisition.manage", "procurement.po.manage", "procurement.vendor.manage"]}>
              <NavLink to="/procurement" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                Procurement &amp; Orders
              </NavLink>
            </PermissionGate>
            <PermissionGate anyPermission={["inventory.stock.view", "inventory.store.manage", "inventory.grn.manage", "inventory.issue.manage", "inventory.gatepass.manage"]}>
              <NavLink to="/inventory" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                Inventory &amp; Stores
              </NavLink>
            </PermissionGate>
            <PermissionGate anyPermission={["subcontractor.workorder.view", "subcontractor.workorder.manage", "subcontractor.attendance.manage", "subcontractor.claims.manage", "subcontractor.claims.certify"]}>
              <NavLink to="/subcontractors" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
                Subcontractors &amp; Labour
              </NavLink>
            </PermissionGate>
            <PermissionGate anyPermission={["quality.inspection.manage", "quality.inspection.signoff", "quality.ncr.manage", "quality.itp.manage", "quality.ncr.close"]}>
              <NavLink to="/quality" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
                Quality &amp; Inspection
              </NavLink>
            </PermissionGate>
            <PermissionGate anyPermission={["safety.ptw.manage", "safety.ptw.approve", "safety.incident.manage", "safety.incident.investigate", "safety.hazard.manage", "safety.tbt.manage"]}>
              <NavLink to="/safety" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Safety &amp; HSE
              </NavLink>
            </PermissionGate>
            <PermissionGate anyPermission={["equipment.asset.manage", "equipment.allocation.manage", "equipment.allocation.approve", "equipment.log.manage", "equipment.maintenance.manage", "equipment.certificate.manage"]}>
              <NavLink to="/equipment" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V3.75a.75.75 0 00-.75-.75h-7.5a.75.75 0 00-.75.75v10.5M3 14.25h11.25" />
                </svg>
                Equipment &amp; Fleet
              </NavLink>
            </PermissionGate>
            <PermissionGate permission="crm.lead.manage">
              <NavLink to="/crm" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M7 20H2v-2a3 3 0 015.356-1.857m0 0a5.002 5.002 0 019.288 0M9 7a3 3 0 106 0 3 3 0 00-6 0z" />
                </svg>
                Clients &amp; CRM
              </NavLink>
            </PermissionGate>
            <PermissionGate permission="documents.register.manage">
              <NavLink to="/documents" className={navLinkClass}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Documents &amp; Drawings
              </NavLink>
            </PermissionGate>
          </PermissionGate>

          <PermissionGate permission="employee.directory.manage">
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Workforce
            </p>
            <NavLink to="/employees" className={navLinkClass}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Employee Directory
            </NavLink>
          </PermissionGate>
        </nav>

        {/* User footer */}
        <div className="border-t border-zinc-800 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold text-zinc-300">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-zinc-300">{session?.user.email}</p>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              title="Sign out"
              className="rounded p-1 text-zinc-500 hover:text-zinc-300"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-100 bg-white px-8">
          <div />
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
              Feedback
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
