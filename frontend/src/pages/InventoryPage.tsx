import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type StoreLocationType = "central_warehouse" | "site_store" | "laydown_yard" | "scrap_yard";

export interface StoreLocation {
  id: string;
  project_id: string | null;
  code: string;
  name: string;
  location_type: StoreLocationType;
  address: string | null;
  is_active: boolean;
}

export type InventoryCategory = "materials" | "plant_spares" | "consumables" | "tools_ppe" | "safety_equipment";

export interface InventoryItem {
  id: string;
  item_code: string;
  name: string;
  category: InventoryCategory;
  uom: string;
  reorder_level: number;
  unit_cost: number;
}

export interface InventoryStockBalance {
  id: string;
  location_id: string;
  item_id: string;
  item_code?: string;
  item_name?: string;
  category?: InventoryCategory;
  uom?: string;
  location_name?: string;
  rack_bin: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
}

export type GrnStatus = "draft" | "inspected" | "accepted" | "rejected";

export interface GoodsReceivedNote {
  id: string;
  project_id: string;
  po_id: string | null;
  po_number?: string;
  location_id: string;
  location_name?: string;
  grn_number: string;
  supplier_delivery_note: string | null;
  carrier_name: string | null;
  vehicle_number: string | null;
  received_date: string;
  status: GrnStatus;
}

export interface GrnItem {
  id: string;
  grn_id: string;
  item_id: string;
  item_code?: string;
  item_name?: string;
  uom?: string;
  quantity_delivered: number;
  quantity_accepted: number;
  quantity_rejected: number;
  rack_bin: string | null;
  rejection_reason: string | null;
}

export type MinStatus = "draft" | "issued" | "returned";

export interface MaterialIssueNote {
  id: string;
  project_id: string;
  location_id: string;
  location_name?: string;
  issue_number: string;
  issue_date: string;
  issued_to: string;
  cost_code: string | null;
  status: MinStatus;
}

export interface MaterialIssueItem {
  id: string;
  issue_id: string;
  item_id: string;
  item_code?: string;
  item_name?: string;
  uom?: string;
  quantity_issued: number;
  quantity_returned: number;
  rack_bin: string | null;
}

export type GatePassType = "inbound" | "outbound" | "transfer" | "returnable" | "disposal";
export type GatePassStatus = "draft" | "approved" | "dispatched" | "closed";

export interface MaterialGatePass {
  id: string;
  project_id: string;
  pass_number: string;
  pass_type: GatePassType;
  status: GatePassStatus;
  vehicle_number: string;
  driver_name: string;
  driver_contact: string | null;
  destination: string;
  authorized_by: string | null;
  exit_time: string | null;
  notes: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  status: string;
}

export function InventoryPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"stock" | "grn" | "issue" | "gatepass">("stock");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [locations, setLocations] = useState<StoreLocation[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [balances, setBalances] = useState<InventoryStockBalance[]>([]);
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [issues, setIssues] = useState<MaterialIssueNote[]>([]);
  const [gatePasses, setGatePasses] = useState<MaterialGatePass[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & Drawers
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showGatePassModal, setShowGatePassModal] = useState(false);

  // Selected Detail Drawers
  const [selectedGrnDetail, setSelectedGrnDetail] = useState<{
    grn: GoodsReceivedNote;
    items: GrnItem[];
  } | null>(null);

  const [selectedIssueDetail, setSelectedIssueDetail] = useState<{
    issue: MaterialIssueNote;
    items: MaterialIssueItem[];
  } | null>(null);

  // New Location Form
  const [newLocation, setNewLocation] = useState({
    code: "",
    name: "",
    locationType: "site_store" as StoreLocationType,
    address: "",
  });

  // New Item Form
  const [newItem, setNewItem] = useState({
    itemCode: "",
    name: "",
    category: "materials" as InventoryCategory,
    uom: "NOS",
    reorderLevel: 0,
    unitCost: 0,
  });

  // New GRN Form
  const [newGrn, setNewGrn] = useState({
    locationId: "",
    grnNumber: `GRN-${Date.now().toString().slice(-5)}`,
    supplierDeliveryNote: "",
    carrierName: "",
    vehicleNumber: "",
    receivedDate: new Date().toISOString().slice(0, 10),
  });

  // New GRN Line Item Form
  const [newGrnItem, setNewGrnItem] = useState({
    itemId: "",
    quantityDelivered: 1,
    quantityAccepted: 1,
    quantityRejected: 0,
    rackBin: "BIN-A1",
    rejectionReason: "",
  });

  // New Issue Form
  const [newIssue, setNewIssue] = useState({
    locationId: "",
    issueNumber: `MIN-${Date.now().toString().slice(-5)}`,
    issueDate: new Date().toISOString().slice(0, 10),
    issuedTo: "",
    costCode: "03-CONC",
  });

  // New Issue Item Form
  const [newIssueItem, setNewIssueItem] = useState({
    itemId: "",
    quantityIssued: 1,
    rackBin: "BIN-A1",
  });

  // New Gate Pass Form
  const [newGatePass, setNewGatePass] = useState({
    passNumber: `GP-${Date.now().toString().slice(-5)}`,
    passType: "outbound" as GatePassType,
    vehicleNumber: "",
    driverName: "",
    driverContact: "",
    destination: "",
    notes: "",
  });

  const notify = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Load Projects on Mount
  useEffect(() => {
    if (!session?.access_token) return;
    loadProjects();
    loadItems();
  }, [session?.access_token]);

  // Load Project-specific data when selected project changes
  useEffect(() => {
    if (!session?.access_token || !selectedProjectId) return;
    loadLocations(selectedProjectId);
    loadBalances();
    loadGrns(selectedProjectId);
    loadIssues(selectedProjectId);
    loadGatePasses(selectedProjectId);
  }, [session?.access_token, selectedProjectId]);

  async function loadProjects() {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<Project[] | { projects: Project[] }>("/projects", session.access_token);
      const list = Array.isArray(data) ? data : data.projects || [];
      const active = list.filter((p) => p.status !== "archived");
      setProjects(active);
      if (active.length > 0 && !selectedProjectId) {
        const paramId = searchParams.get("projectId");
        const defaultProj = active.find((p) => p.id === paramId) || active[0];
        setSelectedProjectId(defaultProj.id);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  }

  async function loadLocations(projId: string) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ locations: StoreLocation[] }>(
        `/inventory/locations?projectId=${projId}`,
        session.access_token
      );
      setLocations(data.locations || []);
      if (data.locations && data.locations.length > 0 && !newGrn.locationId) {
        setNewGrn((prev) => ({ ...prev, locationId: data.locations[0].id }));
        setNewIssue((prev) => ({ ...prev, locationId: data.locations[0].id }));
      }
    } catch (err) {
      console.error("Failed to load store locations", err);
    }
  }

  async function loadItems() {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ items: InventoryItem[] }>("/inventory/items", session.access_token);
      setItems(data.items || []);
      if (data.items && data.items.length > 0) {
        setNewGrnItem((prev) => ({ ...prev, itemId: data.items[0].id }));
        setNewIssueItem((prev) => ({ ...prev, itemId: data.items[0].id }));
      }
    } catch (err) {
      console.error("Failed to load inventory items", err);
    }
  }

  async function loadBalances() {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ balances: InventoryStockBalance[] }>(
        "/inventory/stock-balances",
        session.access_token
      );
      setBalances(data.balances || []);
    } catch (err) {
      console.error("Failed to load stock balances", err);
    }
  }

  async function loadGrns(projId: string) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ grns: GoodsReceivedNote[] }>(
        `/projects/${projId}/inventory/grns`,
        session.access_token
      );
      setGrns(data.grns || []);
    } catch (err) {
      console.error("Failed to load GRNs", err);
    }
  }

  async function loadIssues(projId: string) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ issues: MaterialIssueNote[] }>(
        `/projects/${projId}/inventory/issues`,
        session.access_token
      );
      setIssues(data.issues || []);
    } catch (err) {
      console.error("Failed to load Material Issues", err);
    }
  }

  async function loadGatePasses(projId: string) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ gatePasses: MaterialGatePass[] }>(
        `/projects/${projId}/inventory/gate-passes`,
        session.access_token
      );
      setGatePasses(data.gatePasses || []);
    } catch (err) {
      console.error("Failed to load Gate Passes", err);
    }
  }

  async function openGrnDrawer(grn: GoodsReceivedNote) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ grn: GoodsReceivedNote; items: GrnItem[] }>(
        `/inventory/grns/${grn.id}`,
        session.access_token
      );
      setSelectedGrnDetail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open GRN details");
    }
  }

  async function openIssueDrawer(issue: MaterialIssueNote) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ issue: MaterialIssueNote; items: MaterialIssueItem[] }>(
        `/inventory/issues/${issue.id}`,
        session.access_token
      );
      setSelectedIssueDetail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open Issue details");
    }
  }

  // --- Handlers ---
  async function handleCreateLocation(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedProjectId) return;
    setError(null);
    try {
      await apiFetch("/inventory/locations", session.access_token, {
        method: "POST",
        body: JSON.stringify({ ...newLocation, projectId: selectedProjectId }),
      });
      setShowLocationModal(false);
      setNewLocation({ code: "", name: "", locationType: "site_store", address: "" });
      notify("Store location created.");
      loadLocations(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create location");
    }
  }

  async function handleCreateItem(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token) return;
    setError(null);
    try {
      await apiFetch("/inventory/items", session.access_token, {
        method: "POST",
        body: JSON.stringify(newItem),
      });
      setShowItemModal(false);
      setNewItem({ itemCode: "", name: "", category: "materials", uom: "NOS", reorderLevel: 0, unitCost: 0 });
      notify("Inventory item added to catalog.");
      loadItems();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create item");
    }
  }

  async function handleCreateGrn(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedProjectId) return;
    setError(null);
    try {
      const res = await apiFetch<{ grn: GoodsReceivedNote }>(
        `/projects/${selectedProjectId}/inventory/grns`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify(newGrn),
        }
      );
      setShowGrnModal(false);
      notify(`GRN ${res.grn.grn_number} created.`);
      loadGrns(selectedProjectId);
      openGrnDrawer(res.grn);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create GRN");
    }
  }

  async function handleAddGrnItem(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedGrnDetail) return;
    setError(null);
    try {
      await apiFetch(`/inventory/grns/${selectedGrnDetail.grn.id}/items`, session.access_token, {
        method: "POST",
        body: JSON.stringify(newGrnItem),
      });
      notify("GRN item added.");
      openGrnDrawer(selectedGrnDetail.grn);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add item to GRN");
    }
  }

  async function handleAcceptGrn(grnId: string) {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/inventory/grns/${grnId}/accept`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ inspectedBy: "Storekeeper Sign-off", inspectionNotes: "Accepted into store." }),
      });
      notify("GRN accepted! Quantities updated in warehouse stock ledger.");
      if (selectedGrnDetail) openGrnDrawer({ ...selectedGrnDetail.grn, id: grnId });
      loadGrns(selectedProjectId);
      loadBalances();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to accept GRN");
    }
  }

  async function handleCreateIssue(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedProjectId) return;
    setError(null);
    try {
      const res = await apiFetch<{ issue: MaterialIssueNote }>(
        `/projects/${selectedProjectId}/inventory/issues`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify(newIssue),
        }
      );
      setShowIssueModal(false);
      notify(`Material Issue ${res.issue.issue_number} created.`);
      loadIssues(selectedProjectId);
      openIssueDrawer(res.issue);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create Material Issue");
    }
  }

  async function handleAddIssueItem(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedIssueDetail) return;
    setError(null);
    try {
      await apiFetch(`/inventory/issues/${selectedIssueDetail.issue.id}/items`, session.access_token, {
        method: "POST",
        body: JSON.stringify(newIssueItem),
      });
      notify("Issue line item added.");
      openIssueDrawer(selectedIssueDetail.issue);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add item to Issue Note");
    }
  }

  async function handleDispatchIssue(issueId: string) {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/inventory/issues/${issueId}/dispatch`, session.access_token, {
        method: "POST",
      });
      notify("Material dispatched to site! Stock balances deducted.");
      if (selectedIssueDetail) openIssueDrawer({ ...selectedIssueDetail.issue, id: issueId });
      loadIssues(selectedProjectId);
      loadBalances();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to dispatch material");
    }
  }

  async function handleCreateGatePass(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedProjectId) return;
    setError(null);
    try {
      await apiFetch(`/projects/${selectedProjectId}/inventory/gate-passes`, session.access_token, {
        method: "POST",
        body: JSON.stringify(newGatePass),
      });
      setShowGatePassModal(false);
      setNewGatePass({
        passNumber: `GP-${Date.now().toString().slice(-5)}`,
        passType: "outbound",
        vehicleNumber: "",
        driverName: "",
        driverContact: "",
        destination: "",
        notes: "",
      });
      notify("Material Gate Pass registered.");
      loadGatePasses(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create Gate Pass");
    }
  }

  async function handleApproveGatePass(passId: string) {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/inventory/gate-passes/${passId}/approve`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ authorizedBy: "Site Security Lead" }),
      });
      notify("Gate pass approved for dispatch.");
      loadGatePasses(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to approve Gate Pass");
    }
  }

  async function handleDispatchGatePass(passId: string) {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/inventory/gate-passes/${passId}/dispatch`, session.access_token, {
        method: "POST",
      });
      notify("Vehicle dispatched through gate.");
      loadGatePasses(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to dispatch vehicle");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-200 pb-6">
        <div>
          <h1 className="font-syne text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Inventory &amp; Site Stores
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Real-time stock ledger, Goods Received Notes (GRN), Material Issue Slips (MIN), and Security Gate Passes.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="inventory-project-select" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Project:
          </label>
          <select
            id="inventory-project-select"
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setSearchParams({ projectId: e.target.value });
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `[${p.code}] ` : ""}
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert Banners */}
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-900 font-bold ml-4">
            ×
          </button>
        </div>
      )}
      {successMsg && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mt-6 border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === "stock"}
            onClick={() => setActiveTab("stock")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "stock"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Stock Balances &amp; Stores
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {balances.length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "grn"}
            onClick={() => setActiveTab("grn")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "grn"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Goods Received Notes (GRN)
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {grns.length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "issue"}
            onClick={() => setActiveTab("issue")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "issue"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Material Issues (MIN)
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {issues.length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "gatepass"}
            onClick={() => setActiveTab("gatepass")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "gatepass"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Material Gate Passes
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {gatePasses.length}
            </span>
          </button>
        </nav>
      </div>

      {/* TAB 1: STOCK BALANCES & STORES */}
      {activeTab === "stock" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Warehouse &amp; Site Stock Ledger</h2>
            <div className="flex gap-2">
              <PermissionGate permission="inventory.item.manage">
                <button
                  onClick={() => setShowItemModal(true)}
                  className="rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-sm font-semibold text-zinc-700 shadow-sm hover:bg-zinc-50"
                >
                  + Add Catalog Item
                </button>
              </PermissionGate>
              <PermissionGate permission="inventory.store.manage">
                <button
                  onClick={() => setShowLocationModal(true)}
                  className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
                >
                  + New Store Location
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* Locations Summary Bar */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {locations.map((loc) => (
              <div key={loc.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  {loc.location_type.replace("_", " ")}
                </span>
                <p className="mt-1 text-base font-bold text-zinc-900">{loc.name}</p>
                <p className="text-xs text-zinc-500 font-mono">Code: {loc.code}</p>
              </div>
            ))}
            {locations.length === 0 && (
              <div className="col-span-full rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-400">
                No store locations defined for this project yet. Click "+ New Store Location" to establish a warehouse or site store.
              </div>
            )}
          </div>

          {/* Stock Balances Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Item Code</th>
                  <th className="px-4 py-3">Item Description</th>
                  <th className="px-4 py-3">Location / Yard</th>
                  <th className="px-4 py-3">Rack / Bin</th>
                  <th className="px-4 py-3 text-right">On Hand</th>
                  <th className="px-4 py-3">UOM</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {balances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No stock balances recorded in this project yet. Accept a GRN to populate warehouse inventory.
                    </td>
                  </tr>
                ) : (
                  balances.map((sb) => (
                    <tr key={sb.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-900">{sb.item_code}</td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{sb.item_name}</td>
                      <td className="px-4 py-3">{sb.location_name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-zinc-600">{sb.rack_bin || "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                        {sb.quantity_on_hand.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-500 font-medium">{sb.uom}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          In Stock
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GOODS RECEIVED NOTES (GRN) */}
      {activeTab === "grn" && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Goods Received Notes (Inbound Deliveries)</h2>
            <PermissionGate permission="inventory.grn.manage">
              <button
                onClick={() => setShowGrnModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + New GRN Receipt
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">GRN Number</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Store Location</th>
                  <th className="px-4 py-3">Delivery Note</th>
                  <th className="px-4 py-3">Carrier / Vehicle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {grns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No Goods Received Notes recorded for this project yet.
                    </td>
                  </tr>
                ) : (
                  grns.map((grn) => (
                    <tr key={grn.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{grn.grn_number}</td>
                      <td className="px-4 py-3">{grn.received_date}</td>
                      <td className="px-4 py-3">{grn.location_name || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{grn.supplier_delivery_note || "—"}</td>
                      <td className="px-4 py-3 text-xs">
                        {grn.carrier_name ? `${grn.carrier_name} (${grn.vehicle_number || "—"})` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            grn.status === "accepted"
                              ? "bg-emerald-100 text-emerald-800"
                              : grn.status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {grn.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openGrnDrawer(grn)}
                          className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
                        >
                          View Items
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

      {/* TAB 3: MATERIAL ISSUES (MIN) */}
      {activeTab === "issue" && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Material Issue Slips (Outbound to Site)</h2>
            <PermissionGate permission="inventory.issue.manage">
              <button
                onClick={() => setShowIssueModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + New Issue Note
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Issue Number</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Store Location</th>
                  <th className="px-4 py-3">Issued To</th>
                  <th className="px-4 py-3">Cost Code</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {issues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No material issue slips issued for this project yet.
                    </td>
                  </tr>
                ) : (
                  issues.map((min) => (
                    <tr key={min.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{min.issue_number}</td>
                      <td className="px-4 py-3">{min.issue_date}</td>
                      <td className="px-4 py-3">{min.location_name || "—"}</td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{min.issued_to}</td>
                      <td className="px-4 py-3 font-mono text-xs">{min.cost_code || "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            min.status === "issued"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {min.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openIssueDrawer(min)}
                          className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
                        >
                          Manage
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

      {/* TAB 4: MATERIAL GATE PASSES */}
      {activeTab === "gatepass" && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Site Security Material Gate Passes</h2>
            <PermissionGate permission="inventory.gatepass.manage">
              <button
                onClick={() => setShowGatePassModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + New Gate Pass
              </button>
            </PermissionGate>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Pass Number</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Vehicle #</th>
                  <th className="px-4 py-3">Driver Name</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {gatePasses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No material gate passes registered for this project yet.
                    </td>
                  </tr>
                ) : (
                  gatePasses.map((gp) => (
                    <tr key={gp.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{gp.pass_number}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase bg-zinc-100 text-zinc-700">
                          {gp.pass_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold">{gp.vehicle_number}</td>
                      <td className="px-4 py-3">{gp.driver_name}</td>
                      <td className="px-4 py-3 text-xs">{gp.destination}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            gp.status === "dispatched"
                              ? "bg-purple-100 text-purple-800"
                              : gp.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {gp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {gp.status === "draft" && (
                          <PermissionGate permission="inventory.gatepass.manage">
                            <button
                              onClick={() => handleApproveGatePass(gp.id)}
                              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-emerald-700 mr-2"
                            >
                              Approve
                            </button>
                          </PermissionGate>
                        )}
                        {gp.status === "approved" && (
                          <PermissionGate permission="inventory.gatepass.manage">
                            <button
                              onClick={() => handleDispatchGatePass(gp.id)}
                              className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-zinc-800"
                            >
                              Dispatch Exit
                            </button>
                          </PermissionGate>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- GRN DRAWER --- */}
      {selectedGrnDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white min-h-screen shadow-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 font-syne">
                    Goods Received Note {selectedGrnDetail.grn.grn_number}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Location: {selectedGrnDetail.grn.location_name || "—"} | Date: {selectedGrnDetail.grn.received_date}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedGrnDetail(null)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>

              {/* Status Header */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-3 text-xs">
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Status:</span>
                  <p className="font-bold capitalize text-zinc-800">{selectedGrnDetail.grn.status}</p>
                </div>
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Delivery Note:</span>
                  <p className="font-bold text-zinc-800">{selectedGrnDetail.grn.supplier_delivery_note || "—"}</p>
                </div>
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Vehicle:</span>
                  <p className="font-bold text-zinc-800">{selectedGrnDetail.grn.vehicle_number || "—"}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="mt-6">
                <h3 className="font-semibold text-zinc-800 text-sm mb-3">Delivered Line Items</h3>
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="min-w-full divide-y divide-zinc-200 text-xs">
                    <thead className="bg-zinc-50 font-semibold text-zinc-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-right">Delivered</th>
                        <th className="px-3 py-2 text-right">Accepted</th>
                        <th className="px-3 py-2 text-right">Rejected</th>
                        <th className="px-3 py-2 text-left">Bin</th>
                        <th className="px-3 py-2 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {selectedGrnDetail.items.map((it) => (
                        <tr key={it.id}>
                          <td className="px-3 py-2 font-medium text-zinc-800">{it.item_name || it.item_code}</td>
                          <td className="px-3 py-2 text-right font-mono">{it.quantity_delivered}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                            {it.quantity_accepted}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-rose-600">
                            {it.quantity_rejected}
                          </td>
                          <td className="px-3 py-2 font-mono text-zinc-600">{it.rack_bin || "—"}</td>
                          <td className="px-3 py-2 text-zinc-500">{it.rejection_reason || "—"}</td>
                        </tr>
                      ))}
                      {selectedGrnDetail.items.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-zinc-400">
                            No line items added to this GRN yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add GRN Line Item Form */}
              {(selectedGrnDetail.grn.status === "draft" || selectedGrnDetail.grn.status === "inspected") && (
                <form onSubmit={handleAddGrnItem} className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">+ Add Received Item</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[11px] font-medium text-zinc-600">Select Item</label>
                      <select
                        required
                        value={newGrnItem.itemId}
                        onChange={(e) => setNewGrnItem({ ...newGrnItem, itemId: e.target.value })}
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      >
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            [{it.item_code}] {it.name} ({it.uom})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-600">Delivered Qty</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={newGrnItem.quantityDelivered}
                        onChange={(e) =>
                          setNewGrnItem({
                            ...newGrnItem,
                            quantityDelivered: parseFloat(e.target.value) || 0,
                            quantityAccepted: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-600">Accepted Qty</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={newGrnItem.quantityAccepted}
                        onChange={(e) => setNewGrnItem({ ...newGrnItem, quantityAccepted: parseFloat(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-600">Rejected Qty</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newGrnItem.quantityRejected}
                        onChange={(e) => setNewGrnItem({ ...newGrnItem, quantityRejected: parseFloat(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-600">Storage Rack / Bin</label>
                      <input
                        type="text"
                        placeholder="e.g. BAY-01 / SHELF-C"
                        value={newGrnItem.rackBin}
                        onChange={(e) => setNewGrnItem({ ...newGrnItem, rackBin: e.target.value })}
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-md bg-zinc-800 py-1.5 text-xs font-semibold text-white hover:bg-zinc-900"
                  >
                    Add Line Item to GRN
                  </button>
                </form>
              )}
            </div>

            {/* Lifecycle Buttons */}
            <div className="border-t border-zinc-200 pt-4 flex items-center justify-between gap-3">
              {selectedGrnDetail.grn.status !== "accepted" && selectedGrnDetail.items.length > 0 && (
                <PermissionGate permission="inventory.grn.manage">
                  <button
                    onClick={() => handleAcceptGrn(selectedGrnDetail.grn.id)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700"
                  >
                    Accept GRN &amp; Update Stock
                  </button>
                </PermissionGate>
              )}
              <button
                onClick={() => setSelectedGrnDetail(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MIN DRAWER --- */}
      {selectedIssueDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white min-h-screen shadow-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 font-syne">
                    Material Issue Slip {selectedIssueDetail.issue.issue_number}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Issued To: {selectedIssueDetail.issue.issued_to} | Cost Code: {selectedIssueDetail.issue.cost_code || "—"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedIssueDetail(null)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>

              {/* Status Header */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-3 text-xs">
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Status:</span>
                  <p className="font-bold capitalize text-zinc-800">{selectedIssueDetail.issue.status}</p>
                </div>
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Date:</span>
                  <p className="font-bold text-zinc-800">{selectedIssueDetail.issue.issue_date}</p>
                </div>
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Location:</span>
                  <p className="font-bold text-zinc-800">{selectedIssueDetail.issue.location_name || "—"}</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="mt-6">
                <h3 className="font-semibold text-zinc-800 text-sm mb-3">Issued Line Items</h3>
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="min-w-full divide-y divide-zinc-200 text-xs">
                    <thead className="bg-zinc-50 font-semibold text-zinc-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Item Code</th>
                        <th className="px-3 py-2 text-left">Item Description</th>
                        <th className="px-3 py-2 text-right">Issued Qty</th>
                        <th className="px-3 py-2 text-left">UOM</th>
                        <th className="px-3 py-2 text-left">Bin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {selectedIssueDetail.items.map((it) => (
                        <tr key={it.id}>
                          <td className="px-3 py-2 font-mono font-medium text-zinc-900">{it.item_code}</td>
                          <td className="px-3 py-2 font-medium text-zinc-800">{it.item_name}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-zinc-900">
                            {it.quantity_issued}
                          </td>
                          <td className="px-3 py-2 text-zinc-500">{it.uom}</td>
                          <td className="px-3 py-2 font-mono text-zinc-600">{it.rack_bin || "—"}</td>
                        </tr>
                      ))}
                      {selectedIssueDetail.items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-zinc-400">
                            No items added to this issue slip yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Item Form */}
              {selectedIssueDetail.issue.status === "draft" && (
                <form onSubmit={handleAddIssueItem} className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">+ Add Material Line</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-[11px] font-medium text-zinc-600">Select Item</label>
                      <select
                        required
                        value={newIssueItem.itemId}
                        onChange={(e) => setNewIssueItem({ ...newIssueItem, itemId: e.target.value })}
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      >
                        {items.map((it) => (
                          <option key={it.id} value={it.id}>
                            [{it.item_code}] {it.name} ({it.uom})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-600">Quantity to Issue</label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        required
                        value={newIssueItem.quantityIssued}
                        onChange={(e) =>
                          setNewIssueItem({ ...newIssueItem, quantityIssued: parseFloat(e.target.value) || 0 })
                        }
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-600">Pick From Rack / Bin</label>
                      <input
                        type="text"
                        value={newIssueItem.rackBin}
                        onChange={(e) => setNewIssueItem({ ...newIssueItem, rackBin: e.target.value })}
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-md bg-zinc-800 py-1.5 text-xs font-semibold text-white hover:bg-zinc-900"
                  >
                    Add Item to Issue Slip
                  </button>
                </form>
              )}
            </div>

            {/* Lifecycle Buttons */}
            <div className="border-t border-zinc-200 pt-4 flex items-center justify-between gap-3">
              {selectedIssueDetail.issue.status === "draft" && selectedIssueDetail.items.length > 0 && (
                <PermissionGate permission="inventory.issue.manage">
                  <button
                    onClick={() => handleDispatchIssue(selectedIssueDetail.issue.id)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700"
                  >
                    Dispatch Material &amp; Deduct Stock
                  </button>
                </PermissionGate>
              )}
              <button
                onClick={() => setSelectedIssueDetail(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE LOCATION MODAL --- */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 font-syne">New Store Location</h3>
            <p className="text-xs text-zinc-500 mt-1">Register a central warehouse, site store, or laydown yard.</p>
            <form onSubmit={handleCreateLocation} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Location Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SITE-STORE-1"
                  value={newLocation.code}
                  onChange={(e) => setNewLocation({ ...newLocation, code: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Location Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tower A Ground Store"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Type</label>
                <select
                  value={newLocation.locationType}
                  onChange={(e) =>
                    setNewLocation({ ...newLocation, locationType: e.target.value as StoreLocationType })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="site_store">Site Store</option>
                  <option value="laydown_yard">Laydown Yard</option>
                  <option value="central_warehouse">Central Warehouse</option>
                  <option value="scrap_yard">Scrap Yard</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Address / Description</label>
                <input
                  type="text"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowLocationModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE ITEM MODAL --- */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 font-syne">Add Inventory Item</h3>
            <p className="text-xs text-zinc-500 mt-1">Add material / plant part to stock master catalog.</p>
            <form onSubmit={handleCreateItem} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Item Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STL-REB-16"
                  value={newItem.itemCode}
                  onChange={(e) => setNewItem({ ...newItem, itemCode: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm uppercase"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Steel Rebar 16mm"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value as InventoryCategory })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="materials">Materials</option>
                    <option value="consumables">Consumables</option>
                    <option value="plant_spares">Plant Spares</option>
                    <option value="tools_ppe">Tools &amp; PPE</option>
                    <option value="safety_equipment">Safety Equipment</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">UOM</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TON, BAGS, NOS"
                    value={newItem.uom}
                    onChange={(e) => setNewItem({ ...newItem, uom: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800"
                >
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE GRN MODAL --- */}
      {showGrnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 font-syne">Receive Material (GRN)</h3>
            <p className="text-xs text-zinc-500 mt-1">Record a delivery from supplier at the store or site gate.</p>
            <form onSubmit={handleCreateGrn} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Receiving Store Location</label>
                <select
                  required
                  value={newGrn.locationId}
                  onChange={(e) => setNewGrn({ ...newGrn, locationId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">-- Choose Store --</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">GRN Number</label>
                <input
                  type="text"
                  required
                  value={newGrn.grnNumber}
                  onChange={(e) => setNewGrn({ ...newGrn, grnNumber: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Supplier Delivery Note #</label>
                <input
                  type="text"
                  placeholder="e.g. DN-88192"
                  value={newGrn.supplierDeliveryNote}
                  onChange={(e) => setNewGrn({ ...newGrn, supplierDeliveryNote: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Carrier Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Al Futtaim Logistics"
                    value={newGrn.carrierName}
                    onChange={(e) => setNewGrn({ ...newGrn, carrierName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Vehicle #</label>
                  <input
                    type="text"
                    placeholder="e.g. DXB-48190"
                    value={newGrn.vehicleNumber}
                    onChange={(e) => setNewGrn({ ...newGrn, vehicleNumber: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowGrnModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800"
                >
                  Create GRN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE ISSUE MODAL --- */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 font-syne">Issue Material (MIN)</h3>
            <p className="text-xs text-zinc-500 mt-1">Issue materials from store to site crew or subcontractor.</p>
            <form onSubmit={handleCreateIssue} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Issuing Store Location</label>
                <select
                  required
                  value={newIssue.locationId}
                  onChange={(e) => setNewIssue({ ...newIssue, locationId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">-- Choose Store --</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Issue Number</label>
                <input
                  type="text"
                  required
                  value={newIssue.issueNumber}
                  onChange={(e) => setNewIssue({ ...newIssue, issueNumber: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Issued To (Subcontractor / Foreman)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al Naboodah Steel Crew"
                  value={newIssue.issuedTo}
                  onChange={(e) => setNewIssue({ ...newIssue, issuedTo: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Cost Code</label>
                <input
                  type="text"
                  placeholder="e.g. 03-CONC"
                  value={newIssue.costCode}
                  onChange={(e) => setNewIssue({ ...newIssue, costCode: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800"
                >
                  Create Issue Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE GATE PASS MODAL --- */}
      {showGatePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 font-syne">Issue Material Gate Pass</h3>
            <p className="text-xs text-zinc-500 mt-1">Security authorization for vehicles carrying project goods.</p>
            <form onSubmit={handleCreateGatePass} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Pass Number</label>
                <input
                  type="text"
                  required
                  value={newGatePass.passNumber}
                  onChange={(e) => setNewGatePass({ ...newGatePass, passNumber: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Type</label>
                  <select
                    value={newGatePass.passType}
                    onChange={(e) => setNewGatePass({ ...newGatePass, passType: e.target.value as GatePassType })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="outbound">Outbound</option>
                    <option value="inbound">Inbound</option>
                    <option value="transfer">Transfer</option>
                    <option value="returnable">Returnable</option>
                    <option value="disposal">Disposal</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Vehicle Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DXB-77123"
                    value={newGatePass.vehicleNumber}
                    onChange={(e) => setNewGatePass({ ...newGatePass, vehicleNumber: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Driver Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sultan Khan"
                    value={newGatePass.driverName}
                    onChange={(e) => setNewGatePass({ ...newGatePass, driverName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Driver Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +97150..."
                    value={newGatePass.driverContact}
                    onChange={(e) => setNewGatePass({ ...newGatePass, driverContact: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Destination</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fabrication Yard, Sharjah"
                  value={newGatePass.destination}
                  onChange={(e) => setNewGatePass({ ...newGatePass, destination: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowGatePassModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800"
                >
                  Create Pass
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
