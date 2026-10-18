import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch, ApiError } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type VendorCategory = "materials" | "plant_machinery" | "services" | "specialist_contractor";
export type VendorStatus = "pending_kyc" | "active" | "suspended" | "blacklisted";

export interface Vendor {
  id: string;
  name: string;
  trade_license_number: string | null;
  tax_registration_number: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: VendorCategory;
  rating: number;
  status: VendorStatus;
  created_at: string;
}

export type RequisitionPriority = "low" | "normal" | "urgent";
export type RequisitionStatus = "draft" | "submitted" | "approved" | "rejected" | "ordered" | "cancelled";

export interface PurchaseRequisition {
  id: string;
  project_id: string;
  pr_number: string;
  title: string;
  required_date: string;
  priority: RequisitionPriority;
  status: RequisitionStatus;
  requested_by: string | null;
  total_estimated_amount: number;
  currency: string;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface PurchaseRequisitionItem {
  id: string;
  requisition_id: string;
  item_description: string;
  cost_code: string | null;
  quantity: number;
  uom: string;
  estimated_unit_rate: number;
  estimated_total_amount: number;
  notes: string | null;
}

export type PoStatus = "draft" | "issued" | "partially_delivered" | "delivered" | "closed" | "cancelled";
export type PoItemDeliveryStatus = "pending" | "partial" | "delivered";

export interface PurchaseOrder {
  id: string;
  project_id: string;
  vendor_id: string;
  vendor_name?: string;
  requisition_id: string | null;
  po_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  delivery_address: string | null;
  payment_terms: string | null;
  status: PoStatus;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  notes: string | null;
  created_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  item_description: string;
  quantity: number;
  uom: string;
  unit_price: number;
  total_amount: number;
  delivery_status: PoItemDeliveryStatus;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  status: string;
}

export function ProcurementPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<"pr" | "po" | "avl">("pr");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [requisitions, setRequisitions] = useState<PurchaseRequisition[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals & Drawers
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showPrModal, setShowPrModal] = useState(false);
  const [showPoModal, setShowPoModal] = useState(false);
  const [rejectModalPr, setRejectModalPr] = useState<PurchaseRequisition | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Detailed views
  const [selectedPrDetail, setSelectedPrDetail] = useState<{
    requisition: PurchaseRequisition;
    items: PurchaseRequisitionItem[];
  } | null>(null);

  const [selectedPoDetail, setSelectedPoDetail] = useState<{
    order: PurchaseOrder;
    items: PurchaseOrderItem[];
  } | null>(null);

  // New Vendor Form
  const [newVendor, setNewVendor] = useState({
    name: "",
    trade_license_number: "",
    tax_registration_number: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    category: "materials" as VendorCategory,
    rating: 3,
    status: "active" as VendorStatus,
  });

  // New PR Form
  const [newPr, setNewPr] = useState({
    pr_number: `PR-${Date.now().toString().slice(-5)}`,
    title: "",
    required_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    priority: "normal" as RequisitionPriority,
    notes: "",
  });

  // New PR Item Form
  const [newPrItem, setNewPrItem] = useState({
    item_description: "",
    cost_code: "",
    quantity: 1,
    uom: "NOS",
    estimated_unit_rate: 0,
    notes: "",
  });

  // New PO Form
  const [newPo, setNewPo] = useState({
    vendor_id: "",
    requisition_id: "",
    po_number: `PO-${Date.now().toString().slice(-5)}`,
    order_date: new Date().toISOString().slice(0, 10),
    expected_delivery_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    delivery_address: "Project Main Site Store, Dubai, UAE",
    payment_terms: "30 Days PDC upon delivery and store GRN",
    notes: "",
  });

  // New PO Item Form
  const [newPoItem, setNewPoItem] = useState({
    item_description: "",
    quantity: 1,
    uom: "NOS",
    unit_price: 0,
  });

  // Vendor category filter
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState<string>("all");

  const notify = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Load Projects & Vendors on mount
  useEffect(() => {
    if (!session?.access_token) return;
    loadProjects();
    loadVendors();
  }, [session?.access_token]);

  // Load PR & PO when project changes
  useEffect(() => {
    if (!session?.access_token || !selectedProjectId) return;
    loadRequisitions(selectedProjectId);
    loadOrders(selectedProjectId);
  }, [session?.access_token, selectedProjectId]);

  async function loadProjects() {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<Project[] | { projects: Project[] }>("/projects", session.access_token);
      const list = Array.isArray(data) ? data : data.projects || [];
      const activeProjects = list.filter((p) => p.status !== "archived");
      setProjects(activeProjects);
      if (activeProjects.length > 0 && !selectedProjectId) {
        const paramId = searchParams.get("projectId");
        const defaultProj = activeProjects.find((p) => p.id === paramId) || activeProjects[0];
        setSelectedProjectId(defaultProj.id);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  }

  async function loadVendors() {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<Vendor[]>("/procurement/vendors", session.access_token);
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load vendors", err);
    }
  }

  async function loadRequisitions(projId: string) {
    if (!session?.access_token) return;
    setError(null);
    try {
      const data = await apiFetch<PurchaseRequisition[]>(
        `/projects/${projId}/procurement/requisitions`,
        session.access_token
      );
      setRequisitions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load purchase requisitions");
    }
  }

  async function loadOrders(projId: string) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<PurchaseOrder[]>(
        `/projects/${projId}/procurement/orders`,
        session.access_token
      );
      setPurchaseOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load purchase orders", err);
    }
  }

  async function openPrDrawer(pr: PurchaseRequisition) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ requisition: PurchaseRequisition; items: PurchaseRequisitionItem[] }>(
        `/procurement/requisitions/${pr.id}`,
        session.access_token
      );
      setSelectedPrDetail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open requisition details");
    }
  }

  async function openPoDrawer(po: PurchaseOrder) {
    if (!session?.access_token) return;
    try {
      const data = await apiFetch<{ order: PurchaseOrder; items: PurchaseOrderItem[] }>(
        `/procurement/orders/${po.id}`,
        session.access_token
      );
      setSelectedPoDetail(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open order details");
    }
  }

  // --- Vendor Handlers ---
  async function handleCreateVendor(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token) return;
    setError(null);
    try {
      await apiFetch<Vendor>("/procurement/vendors", session.access_token, {
        method: "POST",
        body: JSON.stringify(newVendor),
      });
      setShowVendorModal(false);
      setNewVendor({
        name: "",
        trade_license_number: "",
        tax_registration_number: "",
        contact_person: "",
        email: "",
        phone: "",
        address: "",
        category: "materials",
        rating: 3,
        status: "active",
      });
      notify("Vendor added successfully to Approved Vendor List (AVL)");
      loadVendors();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create vendor");
    }
  }

  // --- PR Handlers ---
  async function handleCreatePr(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedProjectId) return;
    setError(null);
    try {
      const res = await apiFetch<PurchaseRequisition>(
        `/projects/${selectedProjectId}/procurement/requisitions`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify(newPr),
        }
      );
      setShowPrModal(false);
      notify(`Requisition ${res.pr_number} created successfully.`);
      loadRequisitions(selectedProjectId);
      openPrDrawer(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create requisition");
    }
  }

  async function handleAddPrItem(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedPrDetail) return;
    setError(null);
    try {
      await apiFetch(
        `/procurement/requisitions/${selectedPrDetail.requisition.id}/items`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify(newPrItem),
        }
      );
      setNewPrItem({
        item_description: "",
        cost_code: "",
        quantity: 1,
        uom: "NOS",
        estimated_unit_rate: 0,
        notes: "",
      });
      notify("Line item added.");
      openPrDrawer(selectedPrDetail.requisition);
      loadRequisitions(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add line item");
    }
  }

  async function handleDeletePrItem(itemId: string) {
    if (!session?.access_token || !selectedPrDetail) return;
    try {
      await apiFetch(
        `/procurement/requisitions/${selectedPrDetail.requisition.id}/items/${itemId}`,
        session.access_token,
        {
          method: "DELETE",
        }
      );
      notify("Line item removed.");
      openPrDrawer(selectedPrDetail.requisition);
      loadRequisitions(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove item");
    }
  }

  async function handleSubmitPr(prId: string) {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/procurement/requisitions/${prId}/submit`, session.access_token, {
        method: "POST",
      });
      notify("Requisition submitted for approval.");
      if (selectedPrDetail) openPrDrawer({ ...selectedPrDetail.requisition, id: prId });
      loadRequisitions(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit requisition");
    }
  }

  async function handleApprovePr(prId: string) {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/procurement/requisitions/${prId}/approve`, session.access_token, {
        method: "POST",
      });
      notify("Requisition approved.");
      if (selectedPrDetail) openPrDrawer({ ...selectedPrDetail.requisition, id: prId });
      loadRequisitions(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to approve requisition");
    }
  }

  async function handleRejectPr(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !rejectModalPr) return;
    try {
      await apiFetch(`/procurement/requisitions/${rejectModalPr.id}/reject`, session.access_token, {
        method: "POST",
        body: JSON.stringify({ reason: rejectionReason }),
      });
      setRejectModalPr(null);
      setRejectionReason("");
      notify("Requisition rejected with feedback.");
      if (selectedPrDetail && selectedPrDetail.requisition.id === rejectModalPr.id) {
        openPrDrawer({ ...selectedPrDetail.requisition, id: rejectModalPr.id });
      }
      loadRequisitions(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reject requisition");
    }
  }

  // --- PO Handlers ---
  async function handleCreatePo(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedProjectId) return;
    setError(null);
    try {
      const res = await apiFetch<PurchaseOrder>(
        `/projects/${selectedProjectId}/procurement/orders`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify(newPo),
        }
      );
      setShowPoModal(false);
      notify(`Purchase Order ${res.po_number} created.`);
      loadOrders(selectedProjectId);
      openPoDrawer(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create Purchase Order");
    }
  }

  async function handleAddPoItem(e: FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !selectedPoDetail) return;
    setError(null);
    try {
      await apiFetch(`/procurement/orders/${selectedPoDetail.order.id}/items`, session.access_token, {
        method: "POST",
        body: JSON.stringify(newPoItem),
      });
      setNewPoItem({
        item_description: "",
        quantity: 1,
        uom: "NOS",
        unit_price: 0,
      });
      notify("PO item added. Subtotal & 5% VAT recomputed.");
      openPoDrawer(selectedPoDetail.order);
      loadOrders(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add PO item");
    }
  }

  async function handleIssuePo(poId: string) {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/procurement/orders/${poId}/issue`, session.access_token, {
        method: "POST",
      });
      notify("Purchase Order issued to vendor.");
      if (selectedPoDetail) openPoDrawer({ ...selectedPoDetail.order, id: poId });
      loadOrders(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to issue PO");
    }
  }

  async function handleUpdatePoDelivery(poId: string, itemId: string, delivery_status: PoItemDeliveryStatus) {
    if (!session?.access_token) return;
    try {
      await apiFetch(
        `/procurement/orders/${poId}/items/${itemId}/delivery`,
        session.access_token,
        {
          method: "PATCH",
          body: JSON.stringify({ delivery_status }),
        }
      );
      notify("Item delivery status updated.");
      if (selectedPoDetail) openPoDrawer({ ...selectedPoDetail.order, id: poId });
      loadOrders(selectedProjectId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update delivery");
    }
  }

  const filteredVendors = vendors.filter((v) =>
    vendorCategoryFilter === "all" ? true : v.category === vendorCategoryFilter
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-200 pb-6">
        <div>
          <h1 className="font-syne text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Procurement &amp; Purchase Orders
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Material requisitions, Approved Vendor List (AVL), and purchase orders with 5% UAE VAT &amp; site delivery tracking.
          </p>
        </div>

        {/* Project Selector */}
        <div className="flex items-center gap-3">
          <label htmlFor="procurement-project-select" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Project:
          </label>
          <select
            id="procurement-project-select"
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

      {/* Tabs */}
      <div className="mt-6 border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("pr")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "pr"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Purchase Requisitions (PR)
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {requisitions.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("po")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "po"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Purchase Orders (PO)
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {purchaseOrders.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("avl")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "avl"
                ? "border-brand text-zinc-900 font-bold"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            Approved Vendor List (AVL)
            <span className="ml-2 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">
              {vendors.length}
            </span>
          </button>
        </nav>
      </div>

      {/* TAB 1: REQUISITIONS (PR) */}
      {activeTab === "pr" && (
        <div className="mt-6 space-y-6">
          {/* PR Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-zinc-400">Total PRs</span>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{requisitions.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-zinc-400">Draft</span>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {requisitions.filter((r) => r.status === "draft").length}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-zinc-400">Pending Approval</span>
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {requisitions.filter((r) => r.status === "submitted").length}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-zinc-400">Approved</span>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {requisitions.filter((r) => r.status === "approved").length}
              </p>
            </div>
          </div>

          {/* PR Table Header Actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Requisitions for Current Project</h2>
            <PermissionGate permission="procurement.requisition.manage">
              <button
                onClick={() => setShowPrModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + New Requisition
              </button>
            </PermissionGate>
          </div>

          {/* PR Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">PR Number</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Required Date</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3 text-right">Estimated Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {requisitions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No purchase requisitions logged for this project yet.
                    </td>
                  </tr>
                ) : (
                  requisitions.map((pr) => (
                    <tr key={pr.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="px-4 py-3 font-semibold text-zinc-900">{pr.pr_number}</td>
                      <td className="px-4 py-3 font-medium text-zinc-800">{pr.title}</td>
                      <td className="px-4 py-3">{pr.required_date}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            pr.priority === "urgent"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : pr.priority === "low"
                              ? "bg-zinc-100 text-zinc-600"
                              : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {pr.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        AED {pr.total_estimated_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                            pr.status === "approved"
                              ? "bg-emerald-100 text-emerald-800"
                              : pr.status === "submitted"
                              ? "bg-blue-100 text-blue-800"
                              : pr.status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {pr.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openPrDrawer(pr)}
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

      {/* TAB 2: PURCHASE ORDERS (PO) */}
      {activeTab === "po" && (
        <div className="mt-6 space-y-6">
          {/* PO Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-zinc-400">Total POs</span>
              <p className="mt-1 text-2xl font-bold text-zinc-900">{purchaseOrders.length}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-zinc-400">Issued</span>
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {purchaseOrders.filter((p) => p.status === "issued").length}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-zinc-400">Partially Delivered</span>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {purchaseOrders.filter((p) => p.status === "partially_delivered").length}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-zinc-400">Fully Delivered</span>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {purchaseOrders.filter((p) => p.status === "delivered").length}
              </p>
            </div>
          </div>

          {/* PO Actions */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-800">Purchase Orders for Current Project</h2>
            <PermissionGate permission="procurement.po.manage">
              <button
                onClick={() => setShowPoModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + New Purchase Order
              </button>
            </PermissionGate>
          </div>

          {/* PO Table */}
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 font-medium text-zinc-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">PO Number</th>
                  <th className="px-4 py-3">Vendor</th>
                  <th className="px-4 py-3">Order Date</th>
                  <th className="px-4 py-3">Delivery Date</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">VAT (5%)</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-zinc-400">
                      No purchase orders recorded for this project yet.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => {
                    const vendor = vendors.find((v) => v.id === po.vendor_id);
                    return (
                      <tr key={po.id} className="hover:bg-zinc-50/80 transition-colors">
                        <td className="px-4 py-3 font-semibold text-zinc-900">{po.po_number}</td>
                        <td className="px-4 py-3 font-medium text-zinc-800">{vendor?.name || po.vendor_name || "—"}</td>
                        <td className="px-4 py-3">{po.order_date}</td>
                        <td className="px-4 py-3">{po.expected_delivery_date || "—"}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">
                          AED {po.subtotal_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-zinc-500">
                          AED {po.tax_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900">
                          AED {po.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                              po.status === "delivered"
                                ? "bg-emerald-100 text-emerald-800"
                                : po.status === "partially_delivered"
                                ? "bg-amber-100 text-amber-800"
                                : po.status === "issued"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {po.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openPoDrawer(po)}
                            className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
                          >
                            Manage
                          </button>
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

      {/* TAB 3: APPROVED VENDOR LIST (AVL) */}
      {activeTab === "avl" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label htmlFor="vendor-category-filter" className="text-xs font-semibold uppercase text-zinc-500">
                Filter Category:
              </label>
              <select
                id="vendor-category-filter"
                value={vendorCategoryFilter}
                onChange={(e) => setVendorCategoryFilter(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 focus:border-brand focus:outline-none"
              >
                <option value="all">All Categories ({vendors.length})</option>
                <option value="materials">Materials &amp; Rebar</option>
                <option value="plant_machinery">Plant &amp; Machinery</option>
                <option value="services">Engineering Services</option>
                <option value="specialist_contractor">Specialist Subcontractor</option>
              </select>
            </div>
            <PermissionGate permission="procurement.vendor.manage">
              <button
                onClick={() => setShowVendorModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-zinc-800"
              >
                + Register New Vendor
              </button>
            </PermissionGate>
          </div>

          {/* Vendors Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map((vendor) => (
              <div
                key={vendor.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-zinc-900 text-base">{vendor.name}</h3>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                        vendor.status === "active"
                          ? "bg-emerald-100 text-emerald-800"
                          : vendor.status === "pending_kyc"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {vendor.status.replace("_", " ")}
                    </span>
                  </div>

                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
                    {vendor.category.replace("_", " ")}
                  </p>

                  <div className="mt-3 space-y-1.5 text-xs text-zinc-600">
                    {vendor.trade_license_number && (
                      <p>
                        <span className="font-medium text-zinc-400">TL:</span> {vendor.trade_license_number}
                      </p>
                    )}
                    {vendor.tax_registration_number && (
                      <p>
                        <span className="font-medium text-zinc-400">TRN:</span> {vendor.tax_registration_number}
                      </p>
                    )}
                    {vendor.contact_person && (
                      <p>
                        <span className="font-medium text-zinc-400">Contact:</span> {vendor.contact_person}
                      </p>
                    )}
                    {vendor.email && (
                      <p>
                        <span className="font-medium text-zinc-400">Email:</span> {vendor.email}
                      </p>
                    )}
                    {vendor.phone && (
                      <p>
                        <span className="font-medium text-zinc-400">Phone:</span> {vendor.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
                  <div className="flex items-center text-amber-500 text-xs">
                    {"★".repeat(vendor.rating)}
                    {"☆".repeat(5 - vendor.rating)}
                    <span className="ml-1 text-zinc-400">({vendor.rating}/5)</span>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Added {new Date(vendor.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- PR DETAILS DRAWER --- */}
      {selectedPrDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white min-h-screen shadow-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 font-syne">
                    Requisition {selectedPrDetail.requisition.pr_number}
                  </h2>
                  <p className="text-sm text-zinc-500">{selectedPrDetail.requisition.title}</p>
                </div>
                <button
                  onClick={() => setSelectedPrDetail(null)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>

              {/* Status Header */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-3 text-xs">
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Status:</span>
                  <p className="font-bold capitalize text-zinc-800">{selectedPrDetail.requisition.status}</p>
                </div>
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Priority:</span>
                  <p className="font-bold capitalize text-zinc-800">{selectedPrDetail.requisition.priority}</p>
                </div>
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Required By:</span>
                  <p className="font-bold text-zinc-800">{selectedPrDetail.requisition.required_date}</p>
                </div>
              </div>

              {selectedPrDetail.requisition.rejection_reason && (
                <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                  <span className="font-bold">Rejection Reason:</span> {selectedPrDetail.requisition.rejection_reason}
                </div>
              )}

              {/* Line items table */}
              <div className="mt-6">
                <h3 className="font-semibold text-zinc-800 text-sm mb-3">Requisition Line Items</h3>
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="min-w-full divide-y divide-zinc-200 text-xs">
                    <thead className="bg-zinc-50 font-semibold text-zinc-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-left">Cost Code</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-left">UOM</th>
                        <th className="px-3 py-2 text-right">Est Rate</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {selectedPrDetail.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 font-medium text-zinc-800">{item.item_description}</td>
                          <td className="px-3 py-2 text-zinc-500">{item.cost_code || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                          <td className="px-3 py-2 text-zinc-500">{item.uom}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {item.estimated_unit_rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-zinc-900">
                            {item.estimated_total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {(selectedPrDetail.requisition.status === "draft" ||
                              selectedPrDetail.requisition.status === "rejected") && (
                              <button
                                onClick={() => handleDeletePrItem(item.id)}
                                className="text-red-600 hover:text-red-900 font-bold"
                              >
                                ×
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {selectedPrDetail.items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-4 text-center text-zinc-400">
                            No items added to this requisition yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-zinc-50 font-bold">
                      <tr>
                        <td colSpan={5} className="px-3 py-2 text-right text-zinc-700">
                          Total Estimated Value:
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-900">
                          AED{" "}
                          {selectedPrDetail.requisition.total_estimated_amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Add Item Form (Only when draft or rejected) */}
              {(selectedPrDetail.requisition.status === "draft" || selectedPrDetail.requisition.status === "rejected") && (
                <form onSubmit={handleAddPrItem} className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">+ Add Line Item</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Item description / specification"
                        required
                        value={newPrItem.item_description}
                        onChange={(e) => setNewPrItem({ ...newPrItem, item_description: e.target.value })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Cost Code (e.g. 03-CONC)"
                        value={newPrItem.cost_code}
                        onChange={(e) => setNewPrItem({ ...newPrItem, cost_code: e.target.value })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="UOM (e.g. M3, TON, NOS)"
                        required
                        value={newPrItem.uom}
                        onChange={(e) => setNewPrItem({ ...newPrItem, uom: e.target.value })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Quantity"
                        min="0.01"
                        step="0.01"
                        required
                        value={newPrItem.quantity}
                        onChange={(e) => setNewPrItem({ ...newPrItem, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Est. Rate (AED)"
                        min="0"
                        step="0.01"
                        required
                        value={newPrItem.estimated_unit_rate}
                        onChange={(e) =>
                          setNewPrItem({ ...newPrItem, estimated_unit_rate: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-md bg-zinc-800 py-1.5 text-xs font-semibold text-white hover:bg-zinc-900"
                  >
                    Add Item to PR
                  </button>
                </form>
              )}
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="border-t border-zinc-200 pt-4 flex items-center justify-between gap-3">
              {selectedPrDetail.requisition.status === "draft" && (
                <PermissionGate permission="procurement.requisition.manage">
                  <button
                    onClick={() => handleSubmitPr(selectedPrDetail.requisition.id)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700"
                  >
                    Submit for Approval
                  </button>
                </PermissionGate>
              )}

              {selectedPrDetail.requisition.status === "submitted" && (
                <PermissionGate permission="procurement.requisition.approve">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprovePr(selectedPrDetail.requisition.id)}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700"
                    >
                      Approve Requisition
                    </button>
                    <button
                      onClick={() => setRejectModalPr(selectedPrDetail.requisition)}
                      className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-rose-700"
                    >
                      Reject / Return
                    </button>
                  </div>
                </PermissionGate>
              )}

              <button
                onClick={() => setSelectedPrDetail(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PO DETAILS DRAWER --- */}
      {selectedPoDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white min-h-screen shadow-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 font-syne">
                    Purchase Order {selectedPoDetail.order.po_number}
                  </h2>
                  <p className="text-sm text-zinc-500">
                    Vendor: {vendors.find((v) => v.id === selectedPoDetail.order.vendor_id)?.name || "—"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPoDetail(null)}
                  className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  ✕
                </button>
              </div>

              {/* Status Header */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-zinc-50 p-3 text-xs">
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Status:</span>
                  <p className="font-bold capitalize text-zinc-800">
                    {selectedPoDetail.order.status.replace("_", " ")}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Order Date:</span>
                  <p className="font-bold text-zinc-800">{selectedPoDetail.order.order_date}</p>
                </div>
                <div>
                  <span className="text-zinc-400 uppercase font-semibold">Expected Delivery:</span>
                  <p className="font-bold text-zinc-800">{selectedPoDetail.order.expected_delivery_date || "—"}</p>
                </div>
              </div>

              {/* Line items table with delivery status */}
              <div className="mt-6">
                <h3 className="font-semibold text-zinc-800 text-sm mb-3">PO Line Items &amp; Delivery Tracking</h3>
                <div className="overflow-hidden rounded-lg border border-zinc-200">
                  <table className="min-w-full divide-y divide-zinc-200 text-xs">
                    <thead className="bg-zinc-50 font-semibold text-zinc-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-left">UOM</th>
                        <th className="px-3 py-2 text-right">Rate</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-center">Delivery Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {selectedPoDetail.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 font-medium text-zinc-800">{item.item_description}</td>
                          <td className="px-3 py-2 text-right font-mono">{item.quantity}</td>
                          <td className="px-3 py-2 text-zinc-500">{item.uom}</td>
                          <td className="px-3 py-2 text-right font-mono">
                            {item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-zinc-900">
                            {item.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <select
                              value={item.delivery_status}
                              onChange={(e) =>
                                handleUpdatePoDelivery(
                                  selectedPoDetail.order.id,
                                  item.id,
                                  e.target.value as PoItemDeliveryStatus
                                )
                              }
                              className="rounded border border-zinc-300 text-[11px] py-0.5 px-1 font-semibold"
                            >
                              <option value="pending">Pending</option>
                              <option value="partial">Partial</option>
                              <option value="delivered">Delivered</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                      {selectedPoDetail.items.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-4 text-center text-zinc-400">
                            No line items in this purchase order.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-zinc-50 font-medium">
                      <tr>
                        <td colSpan={4} className="px-3 py-1.5 text-right text-zinc-600">
                          Subtotal:
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-zinc-900">
                          AED{" "}
                          {selectedPoDetail.order.subtotal_amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={4} className="px-3 py-1.5 text-right text-zinc-600">
                          UAE VAT (5%):
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-zinc-900">
                          AED{" "}
                          {selectedPoDetail.order.tax_amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td></td>
                      </tr>
                      <tr className="font-bold border-t border-zinc-200">
                        <td colSpan={4} className="px-3 py-2 text-right text-zinc-900">
                          Total Order Value:
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-zinc-900">
                          AED{" "}
                          {selectedPoDetail.order.total_amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                          })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Add Item Form (Only when draft) */}
              {selectedPoDetail.order.status === "draft" && (
                <form onSubmit={handleAddPoItem} className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-600">+ Add Order Item</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <input
                        type="text"
                        placeholder="Item description"
                        required
                        value={newPoItem.item_description}
                        onChange={(e) => setNewPoItem({ ...newPoItem, item_description: e.target.value })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="UOM (e.g. M3, TON, NOS)"
                        required
                        value={newPoItem.uom}
                        onChange={(e) => setNewPoItem({ ...newPoItem, uom: e.target.value })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Quantity"
                        min="0.01"
                        step="0.01"
                        required
                        value={newPoItem.quantity}
                        onChange={(e) => setNewPoItem({ ...newPoItem, quantity: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <input
                        type="number"
                        placeholder="Unit Price (AED excl VAT)"
                        min="0"
                        step="0.01"
                        required
                        value={newPoItem.unit_price}
                        onChange={(e) => setNewPoItem({ ...newPoItem, unit_price: parseFloat(e.target.value) || 0 })}
                        className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-md bg-zinc-800 py-1.5 text-xs font-semibold text-white hover:bg-zinc-900"
                  >
                    Add Line to PO (5% Tax will be added)
                  </button>
                </form>
              )}
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="border-t border-zinc-200 pt-4 flex items-center justify-between gap-3">
              {selectedPoDetail.order.status === "draft" && (
                <PermissionGate permission="procurement.po.approve">
                  <button
                    onClick={() => handleIssuePo(selectedPoDetail.order.id)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700"
                  >
                    Issue Purchase Order
                  </button>
                </PermissionGate>
              )}

              <button
                onClick={() => setSelectedPoDetail(null)}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CREATE PR MODAL --- */}
      {showPrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 font-syne">Create Purchase Requisition</h3>
            <p className="text-xs text-zinc-500 mt-1">Specify material / service requirements for project site.</p>
            <form onSubmit={handleCreatePr} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">PR Number</label>
                <input
                  type="text"
                  required
                  value={newPr.pr_number}
                  onChange={(e) => setNewPr({ ...newPr, pr_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Title / Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ready-Mix Concrete for Foundation"
                  value={newPr.title}
                  onChange={(e) => setNewPr({ ...newPr, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Required By Date</label>
                  <input
                    type="date"
                    required
                    value={newPr.required_date}
                    onChange={(e) => setNewPr({ ...newPr, required_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Priority</label>
                  <select
                    value={newPr.priority}
                    onChange={(e) => setNewPr({ ...newPr, priority: e.target.value as RequisitionPriority })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Notes / Delivery Instructions</label>
                <textarea
                  rows={2}
                  value={newPr.notes}
                  onChange={(e) => setNewPr({ ...newPr, notes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPrModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800"
                >
                  Create PR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE PO MODAL --- */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 font-syne">Create Purchase Order</h3>
            <p className="text-xs text-zinc-500 mt-1">Issue an official purchase order to an approved vendor.</p>
            <form onSubmit={handleCreatePo} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Select Vendor (AVL)</label>
                <select
                  required
                  value={newPo.vendor_id}
                  onChange={(e) => setNewPo({ ...newPo, vendor_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors
                    .filter((v) => v.status === "active")
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.category})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">PO Number</label>
                <input
                  type="text"
                  required
                  value={newPo.po_number}
                  onChange={(e) => setNewPo({ ...newPo, po_number: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Order Date</label>
                  <input
                    type="date"
                    required
                    value={newPo.order_date}
                    onChange={(e) => setNewPo({ ...newPo, order_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Expected Delivery</label>
                  <input
                    type="date"
                    value={newPo.expected_delivery_date}
                    onChange={(e) => setNewPo({ ...newPo, expected_delivery_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Delivery Address</label>
                <input
                  type="text"
                  value={newPo.delivery_address}
                  onChange={(e) => setNewPo({ ...newPo, delivery_address: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Payment Terms</label>
                <input
                  type="text"
                  value={newPo.payment_terms}
                  onChange={(e) => setNewPo({ ...newPo, payment_terms: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowPoModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800"
                >
                  Create PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CREATE VENDOR MODAL --- */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 font-syne">Register Vendor (AVL)</h3>
            <p className="text-xs text-zinc-500 mt-1">Add a supplier or subcontractor to the Approved Vendor List.</p>
            <form onSubmit={handleCreateVendor} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Company Name</label>
                <input
                  type="text"
                  required
                  value={newVendor.name}
                  onChange={(e) => setNewVendor({ ...newVendor, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Category</label>
                  <select
                    value={newVendor.category}
                    onChange={(e) => setNewVendor({ ...newVendor, category: e.target.value as VendorCategory })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="materials">Materials &amp; Rebar</option>
                    <option value="plant_machinery">Plant &amp; Machinery</option>
                    <option value="services">Engineering Services</option>
                    <option value="specialist_contractor">Specialist Subcontractor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Status</label>
                  <select
                    value={newVendor.status}
                    onChange={(e) => setNewVendor({ ...newVendor, status: e.target.value as VendorStatus })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="active">Active (KYC Complete)</option>
                    <option value="pending_kyc">Pending KYC</option>
                    <option value="suspended">Suspended</option>
                    <option value="blacklisted">Blacklisted</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Trade License (TL)</label>
                  <input
                    type="text"
                    value={newVendor.trade_license_number}
                    onChange={(e) => setNewVendor({ ...newVendor, trade_license_number: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Tax Registration (TRN)</label>
                  <input
                    type="text"
                    value={newVendor.tax_registration_number}
                    onChange={(e) => setNewVendor({ ...newVendor, tax_registration_number: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Contact Person</label>
                  <input
                    type="text"
                    value={newVendor.contact_person}
                    onChange={(e) => setNewVendor({ ...newVendor, contact_person: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Phone</label>
                  <input
                    type="text"
                    value={newVendor.phone}
                    onChange={(e) => setNewVendor({ ...newVendor, phone: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Email Address</label>
                <input
                  type="email"
                  value={newVendor.email}
                  onChange={(e) => setNewVendor({ ...newVendor, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-700">Performance Rating (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={newVendor.rating}
                  onChange={(e) => setNewVendor({ ...newVendor, rating: parseInt(e.target.value, 10) || 3 })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowVendorModal(false)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-zinc-800"
                >
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- REJECT PR MODAL --- */}
      {rejectModalPr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-zinc-900 font-syne">Return / Reject Requisition</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Provide feedback for the site engineer before returning PR {rejectModalPr.pr_number}.
            </p>
            <form onSubmit={handleRejectPr} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-700">Reason for Rejection / Revision</label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Rate exceeds baseline BOQ allowance; obtain secondary supplier quote."
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModalPr(null);
                    setRejectionReason("");
                  }}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-700"
                >
                  Reject Requisition
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
