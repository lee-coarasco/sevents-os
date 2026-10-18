import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type EquipmentCategory =
  | "heavy_plant"
  | "earthmoving"
  | "lifting_rigging"
  | "power_generation"
  | "fleet_vehicle"
  | "small_tools";

export type OwnershipType = "owned" | "leased" | "hired";

export type EquipmentStatus =
  | "available"
  | "mobilized_on_site"
  | "under_maintenance"
  | "breakdown"
  | "decommissioned";

export type AllocationStatus = "requested" | "approved" | "mobilized" | "demobilized";

export type MaintenanceType =
  | "preventive_service"
  | "breakdown_repair"
  | "safety_inspection"
  | "statutory_certification";

export type CertificateType =
  | "safe_working_load_3rd_party"
  | "lifting_tackle_inspection"
  | "registration_mulkiya"
  | "insurance_policy"
  | "emission_test";

export interface EquipmentAsset {
  id: string;
  asset_code: string;
  name: string;
  category: EquipmentCategory;
  make: string;
  model: string;
  year_of_manufacture: number | null;
  serial_or_vin: string | null;
  ownership_type: OwnershipType;
  hire_vendor_name: string | null;
  daily_rate: number;
  status: EquipmentStatus;
  current_meter_hours: number;
  current_project_id: string | null;
  created_at: string;
}

export interface EquipmentAllocation {
  id: string;
  equipment_id: string;
  project_id: string;
  allocation_number: string;
  mobilization_date: string;
  expected_demobilization_date: string | null;
  actual_demobilization_date: string | null;
  grid_location: string | null;
  status: AllocationStatus;
  requested_by: string;
  approved_by: string | null;
  notes: string | null;
  equipment?: EquipmentAsset;
  created_at: string;
}

export interface EquipmentDailyLog {
  id: string;
  equipment_id: string;
  project_id: string;
  log_date: string;
  operating_hours: number;
  idle_hours: number;
  breakdown_hours: number;
  start_meter_reading: number;
  end_meter_reading: number;
  fuel_added_litres: number;
  operator_name: string;
  work_description: string;
  supervisor_signoff: string | null;
  created_at: string;
}

export interface EquipmentMaintenanceRecord {
  id: string;
  equipment_id: string;
  maintenance_type: MaintenanceType;
  maintenance_date: string;
  meter_hours_at_service: number;
  cost: number;
  performed_by: string;
  description: string;
  next_due_date: string | null;
  next_due_meter_hours: number | null;
  status: "scheduled" | "completed" | "cancelled";
  created_at: string;
}

export interface EquipmentStatutoryCertificate {
  id: string;
  equipment_id: string;
  certificate_type: CertificateType;
  certificate_number: string;
  issuing_authority: string;
  issue_date: string;
  expiry_date: string;
  attachment_url: string | null;
  status: "valid" | "expired" | "pending_renewal";
  created_at: string;
}

interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

export function EquipmentPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"fleet" | "allocations" | "logs" | "maintenance">("fleet");

  // Data states
  const [assets, setAssets] = useState<EquipmentAsset[]>([]);
  const [allocations, setAllocations] = useState<EquipmentAllocation[]>([]);
  const [dailyLogs, setDailyLogs] = useState<EquipmentDailyLog[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<EquipmentMaintenanceRecord[]>([]);
  const [certificates, setCertificates] = useState<EquipmentStatutoryCertificate[]>([]);

  // Category filter for fleet register
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // UI Error
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showNewAssetModal, setShowNewAssetModal] = useState(false);
  const [showNewAllocModal, setShowNewAllocModal] = useState(false);
  const [showNewLogModal, setShowNewLogModal] = useState(false);
  const [showNewMaintModal, setShowNewMaintModal] = useState(false);
  const [showNewCertModal, setShowNewCertModal] = useState(false);

  // Selected item for drawer/inspection
  const [selectedAsset, setSelectedAsset] = useState<EquipmentAsset | null>(null);

  // Load projects list
  useEffect(() => {
    async function fetchProjects() {
      if (!session?.access_token) return;
      try {
        const data = await apiFetch<any>("/projects", session.access_token);
        const list = Array.isArray(data) ? data : data.projects || [];
        setProjects(list);
        const queryProjectId = searchParams.get("projectId");
        if (queryProjectId && list.some((p: ProjectOption) => p.id === queryProjectId)) {
          setSelectedProjectId(queryProjectId);
        } else if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0].id);
          setSearchParams((prev) => {
            prev.set("projectId", list[0].id);
            return prev;
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to load projects");
      }
    }
    fetchProjects();
  }, [session?.access_token]);

  // Load equipment data
  useEffect(() => {
    if (!session?.access_token) return;
    refreshData();
  }, [selectedProjectId, session?.access_token]);

  async function refreshData() {
    if (!session?.access_token) return;
    try {
      setError(null);
      const [assetsRes, allocsRes, logsRes, maintRes, certsRes] = await Promise.all([
        apiFetch<any>("/equipment/assets", session.access_token),
        apiFetch<any>(
          selectedProjectId
            ? `/equipment/allocations?projectId=${selectedProjectId}`
            : "/equipment/allocations",
          session.access_token
        ),
        apiFetch<any>(
          selectedProjectId
            ? `/equipment/daily-logs?projectId=${selectedProjectId}`
            : "/equipment/daily-logs",
          session.access_token
        ),
        apiFetch<any>("/equipment/maintenance", session.access_token),
        apiFetch<any>("/equipment/certificates", session.access_token),
      ]);

      setAssets(Array.isArray(assetsRes) ? assetsRes : assetsRes.assets || []);
      setAllocations(Array.isArray(allocsRes) ? allocsRes : allocsRes.allocations || []);
      setDailyLogs(Array.isArray(logsRes) ? logsRes : logsRes.logs || []);
      setMaintenanceRecords(Array.isArray(maintRes) ? maintRes : maintRes.records || []);
      setCertificates(Array.isArray(certsRes) ? certsRes : certsRes.certificates || []);
    } catch (err: any) {
      setError(err.message || "Failed to load equipment records");
    }
  }

  const handleProjectSelect = (pid: string) => {
    setSelectedProjectId(pid);
    setSearchParams((prev) => {
      prev.set("projectId", pid);
      return prev;
    });
  };

  const filteredAssets = categoryFilter === "all"
    ? assets
    : assets.filter((a) => a.category === categoryFilter);

  return (
    <div className="space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Equipment, Plant &amp; Fleet Operations</h1>
          <p className="text-sm text-zinc-500">
            Heavy Plant, Earthmoving &amp; Fleet Management: Mobilizations, Run Hours, Maintenance &amp; Statutory Certifications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="project-select" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Project:
          </label>
          <select
            id="project-select"
            value={selectedProjectId}
            onChange={(e) => handleProjectSelect(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm focus:border-brand focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-xs font-semibold text-red-800 underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab("fleet")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "fleet"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Plant &amp; Fleet Master</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {assets.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("allocations")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "allocations"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Mobilizations &amp; Allocations</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {allocations.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "logs"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Daily Utilization &amp; Run Hours</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {dailyLogs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("maintenance")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "maintenance"
              ? "border-brand text-zinc-900 font-semibold"
              : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
          }`}
        >
          <span>Maintenance &amp; Statutory Certs</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 font-normal">
            {maintenanceRecords.length + certificates.length}
          </span>
        </button>
      </div>

      {/* TAB 1: Plant & Fleet Master Register */}
      {activeTab === "fleet" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-500">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700"
              >
                <option value="all">All Categories</option>
                <option value="heavy_plant">Heavy Plant</option>
                <option value="earthmoving">Earthmoving Equipment</option>
                <option value="lifting_rigging">Lifting &amp; Cranes</option>
                <option value="power_generation">Generators &amp; Power</option>
                <option value="fleet_vehicle">Fleet Vehicles</option>
                <option value="small_tools">Small Tools</option>
              </select>
            </div>
            <PermissionGate permission="equipment.asset.manage">
              <button
                onClick={() => setShowNewAssetModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
              >
                + Register New Equipment
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Asset Code</th>
                  <th className="px-4 py-3">Machine / Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Ownership</th>
                  <th className="px-4 py-3">Meter Reading</th>
                  <th className="px-4 py-3">Daily Rate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400">
                      No plant or fleet assets registered yet.
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{asset.asset_code}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{asset.name}</div>
                        <div className="text-xs text-zinc-500">{asset.make} {asset.model} {asset.year_of_manufacture ? `(${asset.year_of_manufacture})` : ""}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 uppercase">
                          {asset.category.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${
                            asset.ownership_type === "owned"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}>
                            {asset.ownership_type.toUpperCase()}
                          </span>
                        </div>
                        {asset.hire_vendor_name && (
                          <div className="text-[11px] text-zinc-500 mt-0.5 truncate max-w-[140px]">{asset.hire_vendor_name}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-900">
                        {asset.current_meter_hours} hrs
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        ${Number(asset.daily_rate).toLocaleString()}/day
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            asset.status === "available"
                              ? "bg-emerald-100 text-emerald-800"
                              : asset.status === "mobilized_on_site"
                              ? "bg-blue-100 text-blue-800"
                              : asset.status === "under_maintenance"
                              ? "bg-amber-100 text-amber-800"
                              : asset.status === "breakdown"
                              ? "bg-rose-100 text-rose-800 font-bold"
                              : "bg-zinc-100 text-zinc-800"
                          }`}
                        >
                          {asset.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedAsset(asset)}
                          className="font-medium text-zinc-900 hover:text-brand underline text-xs"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Mobilizations & Allocations */}
      {activeTab === "allocations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Project plant mobilization requests, site grid placement, and demobilization off-hire approvals.
            </p>
            <PermissionGate permission="equipment.allocation.manage">
              <button
                onClick={() => setShowNewAllocModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
              >
                + Mobilize Equipment
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Alloc #</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Grid Location</th>
                  <th className="px-4 py-3">Mobilized Date</th>
                  <th className="px-4 py-3">Demob Date</th>
                  <th className="px-4 py-3">Requested By</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {allocations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400">
                      No equipment mobilizations recorded for this project.
                    </td>
                  </tr>
                ) : (
                  allocations.map((alloc) => (
                    <tr key={alloc.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{alloc.allocation_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">
                          {alloc.equipment ? alloc.equipment.name : "Asset ID: " + alloc.equipment_id}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {alloc.equipment ? alloc.equipment.asset_code : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600">{alloc.grid_location || "-"}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">{new Date(alloc.mobilization_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        {alloc.actual_demobilization_date
                          ? new Date(alloc.actual_demobilization_date).toLocaleDateString()
                          : alloc.expected_demobilization_date
                          ? `Exp: ${new Date(alloc.expected_demobilization_date).toLocaleDateString()}`
                          : "Active On Site"}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">{alloc.requested_by}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            alloc.status === "mobilized"
                              ? "bg-emerald-100 text-emerald-800"
                              : alloc.status === "approved"
                              ? "bg-blue-100 text-blue-800"
                              : alloc.status === "requested"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {alloc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="equipment.allocation.approve">
                          {alloc.status === "requested" && (
                            <button
                              onClick={async () => {
                                if (!session?.access_token) return;
                                await apiFetch(
                                  `/equipment/allocations/${alloc.id}/authorize`,
                                  session.access_token,
                                  {
                                    method: "POST",
                                    body: JSON.stringify({
                                      status: "mobilized",
                                      approvedBy: session.user.email || "Plant Manager",
                                    }),
                                  }
                                );
                                refreshData();
                              }}
                              className="font-medium text-brand hover:underline text-xs mr-2"
                            >
                              Approve &amp; Mobilize
                            </button>
                          )}
                          {alloc.status === "mobilized" && (
                            <button
                              onClick={async () => {
                                if (!session?.access_token) return;
                                await apiFetch(
                                  `/equipment/allocations/${alloc.id}/authorize`,
                                  session.access_token,
                                  {
                                    method: "POST",
                                    body: JSON.stringify({
                                      status: "demobilized",
                                      approvedBy: session.user.email || "Plant Manager",
                                      actualDemobilizationDate: new Date().toISOString(),
                                    }),
                                  }
                                );
                                refreshData();
                              }}
                              className="font-medium text-rose-600 hover:underline text-xs"
                            >
                              Demobilize / Off-hire
                            </button>
                          )}
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Daily Utilization & Logs */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              Shift run hours, idle time, breakdown downtime, and daily fuel consumption.
            </p>
            <PermissionGate permission="equipment.log.manage">
              <button
                onClick={() => setShowNewLogModal(true)}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 transition shadow-sm"
              >
                + Log Shift Operations
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm text-zinc-700">
              <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Equipment</th>
                  <th className="px-4 py-3">Run Hours</th>
                  <th className="px-4 py-3">Idle / Breakdown</th>
                  <th className="px-4 py-3">Meter (Start &rarr; End)</th>
                  <th className="px-4 py-3">Fuel Added</th>
                  <th className="px-4 py-3">Operator</th>
                  <th className="px-4 py-3">Work Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {dailyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-400">
                      No shift utilization logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  dailyLogs.map((log) => {
                    const matchedAsset = assets.find((a) => a.id === log.equipment_id);
                    return (
                      <tr key={log.id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 font-semibold text-zinc-900">
                          {new Date(log.log_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900">
                            {matchedAsset ? matchedAsset.name : log.equipment_id}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {matchedAsset ? matchedAsset.asset_code : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-emerald-700">{log.operating_hours} hrs</td>
                        <td className="px-4 py-3 text-xs text-zinc-600">
                          <div>Idle: {log.idle_hours} hrs</div>
                          {Number(log.breakdown_hours) > 0 && (
                            <div className="text-rose-600 font-semibold">Breakdown: {log.breakdown_hours} hrs</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-zinc-800">
                          {log.start_meter_reading} &rarr; {log.end_meter_reading}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-zinc-900">
                          {log.fuel_added_litres > 0 ? `${log.fuel_added_litres} L` : "-"}
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{log.operator_name}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600 max-w-xs truncate" title={log.work_description}>
                          {log.work_description}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Maintenance & Statutory Certifications */}
      {activeTab === "maintenance" && (
        <div className="space-y-6">
          {/* Section 1: Maintenance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Preventive Maintenance &amp; Repairs</h3>
                <p className="text-xs text-zinc-500">Periodic service intervals and breakdown workshop repairs.</p>
              </div>
              <PermissionGate permission="equipment.maintenance.manage">
                <button
                  onClick={() => setShowNewMaintModal(true)}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition"
                >
                  + Record Maintenance Event
                </button>
              </PermissionGate>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm text-zinc-700">
                <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Meter Hours</th>
                    <th className="px-4 py-3">Service Provider</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {maintenanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-400">
                        No maintenance records found.
                      </td>
                    </tr>
                  ) : (
                    maintenanceRecords.map((m) => {
                      const matched = assets.find((a) => a.id === m.equipment_id);
                      return (
                        <tr key={m.id} className="hover:bg-zinc-50/50">
                          <td className="px-4 py-3 text-xs text-zinc-600">{new Date(m.maintenance_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 font-medium text-zinc-900">
                            {matched ? matched.name : m.equipment_id}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 uppercase">
                              {m.maintenance_type.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">{m.meter_hours_at_service} hrs</td>
                          <td className="px-4 py-3 text-zinc-700">{m.performed_by}</td>
                          <td className="px-4 py-3 font-semibold text-zinc-900">${Number(m.cost).toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs text-zinc-600 max-w-xs truncate" title={m.description}>{m.description}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Statutory Certificates */}
          <div className="space-y-3 pt-4 border-t border-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-zinc-900">Statutory Third-Party Safety Certifications</h3>
                <p className="text-xs text-zinc-500">
                  Mandatory DAC/EIAC crane safe load indicator calibration, boom certification, and roadworthiness registrations.
                </p>
              </div>
              <PermissionGate permission="equipment.certificate.manage">
                <button
                  onClick={() => setShowNewCertModal(true)}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition"
                >
                  + Add Statutory Certificate
                </button>
              </PermissionGate>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm text-zinc-700">
                <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Cert #</th>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Issuing Authority</th>
                    <th className="px-4 py-3">Issue Date</th>
                    <th className="px-4 py-3">Expiry Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {certificates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-zinc-400">
                        No statutory certificates logged.
                      </td>
                    </tr>
                  ) : (
                    certificates.map((cert) => {
                      const matched = assets.find((a) => a.id === cert.equipment_id);
                      return (
                        <tr key={cert.id} className="hover:bg-zinc-50/50">
                          <td className="px-4 py-3 font-semibold text-zinc-900">{cert.certificate_number}</td>
                          <td className="px-4 py-3 font-medium text-zinc-900">{matched ? matched.name : cert.equipment_id}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 uppercase">
                              {cert.certificate_type.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{cert.issuing_authority}</td>
                          <td className="px-4 py-3 text-xs text-zinc-600">{new Date(cert.issue_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-xs font-semibold text-zinc-900">{new Date(cert.expiry_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                cert.status === "valid"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800 font-bold"
                              }`}
                            >
                              {cert.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Register Asset */}
      {showNewAssetModal && (
        <CreateAssetModal
          onClose={() => setShowNewAssetModal(false)}
          onSuccess={() => {
            setShowNewAssetModal(false);
            refreshData();
          }}
        />
      )}

      {/* MODAL 2: Mobilize Asset */}
      {showNewAllocModal && (
        <CreateAllocationModal
          projectId={selectedProjectId}
          assets={assets}
          onClose={() => setShowNewAllocModal(false)}
          onSuccess={() => {
            setShowNewAllocModal(false);
            refreshData();
          }}
        />
      )}

      {/* MODAL 3: Daily Log */}
      {showNewLogModal && (
        <CreateDailyLogModal
          projectId={selectedProjectId}
          assets={assets}
          onClose={() => setShowNewLogModal(false)}
          onSuccess={() => {
            setShowNewLogModal(false);
            refreshData();
          }}
        />
      )}

      {/* MODAL 4: Maintenance Event */}
      {showNewMaintModal && (
        <CreateMaintenanceModal
          assets={assets}
          onClose={() => setShowNewMaintModal(false)}
          onSuccess={() => {
            setShowNewMaintModal(false);
            refreshData();
          }}
        />
      )}

      {/* MODAL 5: Statutory Cert */}
      {showNewCertModal && (
        <CreateCertModal
          assets={assets}
          onClose={() => setShowNewCertModal(false)}
          onSuccess={() => {
            setShowNewCertModal(false);
            refreshData();
          }}
        />
      )}

      {/* ASSET DETAIL DRAWER */}
      {selectedAsset && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-zinc-500">{selectedAsset.asset_code}</span>
                <h2 className="text-lg font-bold text-zinc-900">{selectedAsset.name}</h2>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
            </div>

            <div className="rounded-lg bg-zinc-50 p-3 space-y-2 border border-zinc-200 text-xs text-zinc-700">
              <div><span className="font-semibold">Category:</span> {selectedAsset.category.replace(/_/g, " ")}</div>
              <div><span className="font-semibold">Make / Model:</span> {selectedAsset.make} {selectedAsset.model}</div>
              <div><span className="font-semibold">Year:</span> {selectedAsset.year_of_manufacture || "-"}</div>
              <div><span className="font-semibold">Serial / VIN:</span> {selectedAsset.serial_or_vin || "-"}</div>
              <div><span className="font-semibold">Ownership:</span> {selectedAsset.ownership_type.toUpperCase()}</div>
              {selectedAsset.hire_vendor_name && (
                <div><span className="font-semibold">Vendor:</span> {selectedAsset.hire_vendor_name}</div>
              )}
              <div><span className="font-semibold">Daily Rate:</span> ${Number(selectedAsset.daily_rate).toLocaleString()}</div>
              <div><span className="font-semibold">Meter Hours:</span> {selectedAsset.current_meter_hours} hrs</div>
              <div><span className="font-semibold">Status:</span> {selectedAsset.status}</div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={() => setSelectedAsset(null)}
              className="w-full rounded-lg border border-zinc-200 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// SUBCOMPONENTS / MODALS
// =========================================================================

function CreateAssetModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assetCode, setAssetCode] = useState(`EQ-${Date.now().toString().slice(-5)}`);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("heavy_plant");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [yearOfManufacture, setYearOfManufacture] = useState(new Date().getFullYear());
  const [serialOrVin, setSerialOrVin] = useState("");
  const [ownershipType, setOwnershipType] = useState<OwnershipType>("owned");
  const [hireVendorName, setHireVendorName] = useState("");
  const [dailyRate, setDailyRate] = useState(500);
  const [currentMeterHours, setCurrentMeterHours] = useState(0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        "/equipment/assets",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            assetCode,
            name,
            category,
            make,
            model,
            yearOfManufacture: Number(yearOfManufacture),
            serialOrVin,
            ownershipType,
            hireVendorName: ownershipType !== "owned" ? hireVendorName : undefined,
            dailyRate: Number(dailyRate),
            currentMeterHours: Number(currentMeterHours),
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to register equipment asset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Register New Equipment Asset</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Asset Code</label>
              <input
                type="text"
                required
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="heavy_plant">Heavy Plant</option>
                <option value="earthmoving">Earthmoving Equipment</option>
                <option value="lifting_rigging">Lifting &amp; Cranes</option>
                <option value="power_generation">Generators &amp; Power</option>
                <option value="fleet_vehicle">Fleet Vehicles</option>
                <option value="small_tools">Small Tools</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Equipment Name / Model Description</label>
            <input
              type="text"
              required
              placeholder="e.g. Komatsu PC210 Hydraulic Excavator"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Make / Manufacturer</label>
              <input
                type="text"
                required
                placeholder="e.g. Komatsu"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Model</label>
              <input
                type="text"
                required
                placeholder="e.g. PC210-10M0"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Year</label>
              <input
                type="number"
                value={yearOfManufacture}
                onChange={(e) => setYearOfManufacture(parseInt(e.target.value) || 2020)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Chassis / VIN / Serial #</label>
              <input
                type="text"
                value={serialOrVin}
                onChange={(e) => setSerialOrVin(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Ownership Type</label>
              <select
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="owned">Company Owned</option>
                <option value="hired">Hired / Rental</option>
                <option value="leased">Financial Lease</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Daily Charge-out Rate ($)</label>
              <input
                type="number"
                min="0"
                value={dailyRate}
                onChange={(e) => setDailyRate(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {ownershipType !== "owned" && (
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Hire / Rental Vendor</label>
              <input
                type="text"
                placeholder="e.g. Al Shirawi Equipment Rental"
                value={hireVendorName}
                onChange={(e) => setHireVendorName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Starting Meter Hours</label>
            <input
              type="number"
              min="0"
              value={currentMeterHours}
              onChange={(e) => setCurrentMeterHours(parseFloat(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Registering..." : "Register Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateAllocationModal({
  projectId,
  assets,
  onClose,
  onSuccess,
}: {
  projectId: string;
  assets: EquipmentAsset[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [allocNumber, setAllocNumber] = useState(`MOB-${Date.now().toString().slice(-5)}`);
  const [equipmentId, setEquipmentId] = useState(assets[0]?.id || "");
  const [mobilizationDate, setMobilizationDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDemobDate, setExpectedDemobDate] = useState(
    new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10)
  );
  const [gridLocation, setGridLocation] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        "/equipment/allocations",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            equipmentId,
            projectId,
            allocationNumber: allocNumber,
            mobilizationDate: new Date(mobilizationDate).toISOString(),
            expectedDemobilizationDate: expectedDemobDate ? new Date(expectedDemobDate).toISOString() : undefined,
            gridLocation,
            requestedBy: session.user.email || "Site Engineer",
            notes,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to request mobilization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Mobilize Equipment to Site</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Allocation #</label>
            <input
              type="text"
              required
              value={allocNumber}
              onChange={(e) => setAllocNumber(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Select Equipment Machine</label>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_code} - {a.name} ({a.status})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Mobilization Date</label>
              <input
                type="date"
                required
                value={mobilizationDate}
                onChange={(e) => setMobilizationDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Expected Demob Date</label>
              <input
                type="date"
                value={expectedDemobDate}
                onChange={(e) => setExpectedDemobDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">On-Site Grid Location</label>
            <input
              type="text"
              placeholder="e.g. Basement Shoring Zone C"
              value={gridLocation}
              onChange={(e) => setGridLocation(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Notes / Scope of Work</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Submitting..." : "Submit Mobilization"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateDailyLogModal({
  projectId,
  assets,
  onClose,
  onSuccess,
}: {
  projectId: string;
  assets: EquipmentAsset[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [equipmentId, setEquipmentId] = useState(assets[0]?.id || "");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [operatingHours, setOperatingHours] = useState(8);
  const [idleHours, setIdleHours] = useState(1);
  const [breakdownHours, setBreakdownHours] = useState(0);
  const selected = assets.find((a) => a.id === equipmentId);
  const [startMeterReading, setStartMeterReading] = useState(selected?.current_meter_hours || 0);
  const [endMeterReading, setEndMeterReading] = useState((selected?.current_meter_hours || 0) + 8);
  const [fuelAddedLitres, setFuelAddedLitres] = useState(0);
  const [operatorName, setOperatorName] = useState("");
  const [workDescription, setWorkDescription] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        "/equipment/daily-logs",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            equipmentId,
            projectId,
            logDate,
            operatingHours: Number(operatingHours),
            idleHours: Number(idleHours),
            breakdownHours: Number(breakdownHours),
            startMeterReading: Number(startMeterReading),
            endMeterReading: Number(endMeterReading),
            fuelAddedLitres: Number(fuelAddedLitres),
            operatorName,
            workDescription,
            supervisorSignoff: session.user.email || "Site Engineer",
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to record daily log");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Log Daily Shift Operations</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Machine / Equipment</label>
            <select
              value={equipmentId}
              onChange={(e) => {
                const id = e.target.value;
                setEquipmentId(id);
                const ast = assets.find((a) => a.id === id);
                if (ast) {
                  setStartMeterReading(ast.current_meter_hours);
                  setEndMeterReading(ast.current_meter_hours + operatingHours);
                }
              }}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Shift Date</label>
              <input
                type="date"
                required
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Operator Name</label>
              <input
                type="text"
                required
                placeholder="Name of plant operator"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Operating (hrs)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={operatingHours}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setOperatingHours(val);
                  setEndMeterReading(startMeterReading + val);
                }}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Idle (hrs)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={idleHours}
                onChange={(e) => setIdleHours(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Breakdown (hrs)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={breakdownHours}
                onChange={(e) => setBreakdownHours(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Start Meter (hrs)</label>
              <input
                type="number"
                step="0.1"
                required
                value={startMeterReading}
                onChange={(e) => setStartMeterReading(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">End Meter (hrs)</label>
              <input
                type="number"
                step="0.1"
                required
                value={endMeterReading}
                onChange={(e) => setEndMeterReading(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Fuel Added (Litres)</label>
              <input
                type="number"
                min="0"
                value={fuelAddedLitres}
                onChange={(e) => setFuelAddedLitres(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Work Activity Performed</label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Backfilling along retaining wall Grid D1-D5"
              value={workDescription}
              onChange={(e) => setWorkDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Recording..." : "Save Shift Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateMaintenanceModal({
  assets,
  onClose,
  onSuccess,
}: {
  assets: EquipmentAsset[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [equipmentId, setEquipmentId] = useState(assets[0]?.id || "");
  const [maintenanceType, setMaintenanceType] = useState<MaintenanceType>("preventive_service");
  const [maintenanceDate, setMaintenanceDate] = useState(new Date().toISOString().slice(0, 10));
  const selected = assets.find((a) => a.id === equipmentId);
  const [meterHoursAtService, setMeterHoursAtService] = useState(selected?.current_meter_hours || 0);
  const [cost, setCost] = useState(500);
  const [performedBy, setPerformedBy] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        "/equipment/maintenance",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            equipmentId,
            maintenanceType,
            maintenanceDate,
            meterHoursAtService: Number(meterHoursAtService),
            cost: Number(cost),
            performedBy,
            description,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to log maintenance");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Record Maintenance Event</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Equipment</label>
            <select
              value={equipmentId}
              onChange={(e) => {
                const id = e.target.value;
                setEquipmentId(id);
                const ast = assets.find((a) => a.id === id);
                if (ast) setMeterHoursAtService(ast.current_meter_hours);
              }}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Maintenance Type</label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="preventive_service">Preventive Service</option>
                <option value="breakdown_repair">Breakdown Repair</option>
                <option value="safety_inspection">Periodic Safety Inspection</option>
                <option value="statutory_certification">Statutory Certification</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Service Date</label>
              <input
                type="date"
                required
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Meter Reading (hrs)</label>
              <input
                type="number"
                value={meterHoursAtService}
                onChange={(e) => setMeterHoursAtService(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Cost ($)</label>
              <input
                type="number"
                min="0"
                value={cost}
                onChange={(e) => setCost(parseFloat(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Performed By (Technician / Agency)</label>
            <input
              type="text"
              required
              placeholder="e.g. In-house mechanical gang / Al Shirawi workshop"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Description of Service</label>
            <textarea
              rows={2}
              required
              placeholder="Detail replacement parts, oil changes, or repair work..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Recording..." : "Log Maintenance"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateCertModal({
  assets,
  onClose,
  onSuccess,
}: {
  assets: EquipmentAsset[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [equipmentId, setEquipmentId] = useState(assets[0]?.id || "");
  const [certificateType, setCertificateType] = useState<CertificateType>("safe_working_load_3rd_party");
  const [certificateNumber, setCertificateNumber] = useState(`CERT-${Date.now().toString().slice(-6)}`);
  const [issuingAuthority, setIssuingAuthority] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [expiryDate, setExpiryDate] = useState(
    new Date(Date.now() + 365 * 86400 * 1000).toISOString().slice(0, 10)
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    try {
      await apiFetch(
        "/equipment/certificates",
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({
            equipmentId,
            certificateType,
            certificateNumber,
            issuingAuthority,
            issueDate,
            expiryDate,
          }),
        }
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to log certificate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-lg font-bold text-zinc-900">Add Statutory Calibration / Certificate</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Machine / Asset</label>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset_code} - {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Certificate Type</label>
              <select
                value={certificateType}
                onChange={(e) => setCertificateType(e.target.value as any)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              >
                <option value="safe_working_load_3rd_party">Safe Working Load (SWL 3rd Party)</option>
                <option value="lifting_tackle_inspection">Lifting Tackle Inspection</option>
                <option value="registration_mulkiya">Vehicle Registration / Mulkiya</option>
                <option value="insurance_policy">Comprehensive Plant Insurance</option>
                <option value="emission_test">Environmental Emission Test</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Certificate #</label>
              <input
                type="text"
                required
                value={certificateNumber}
                onChange={(e) => setCertificateNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-500">Issuing Authority / Agency</label>
            <input
              type="text"
              required
              placeholder="e.g. Bureau Veritas / TUV / RTA Dubai"
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Issue Date</label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-zinc-500">Expiry Date</label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading ? "Recording..." : "Save Certificate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
