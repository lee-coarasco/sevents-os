import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "../lib/api";
import { PermissionGate } from "../components/PermissionGate";

export type StakeholderType = 'client' | 'consultant' | 'subcontractor' | 'authority' | 'community' | 'utility';
export type EngagementLevel = 'low' | 'medium' | 'high';

export interface Stakeholder {
  id: string;
  project_id?: string | null;
  name: string;
  organization: string;
  stakeholder_type: StakeholderType;
  role_title: string;
  email?: string | null;
  phone?: string | null;
  engagement_level: EngagementLevel;
  notes?: string | null;
  created_at: string;
}

export type CommunicationChannel = 'letter' | 'email' | 'site_instruction' | 'transmittal' | 'notice' | 'circular';
export type CommunicationDirection = 'inbound' | 'outbound';
export type CommunicationStatus = 'draft' | 'sent' | 'received' | 'closed';

export interface CommunicationLog {
  id: string;
  project_id?: string | null;
  reference_number: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  sender_name: string;
  recipient_name: string;
  subject: string;
  summary: string;
  requires_response: boolean;
  response_due_date?: string | null;
  status: CommunicationStatus;
  created_at: string;
}

export type MeetingType = 'site_coordination' | 'client_review' | 'technical_clarification' | 'progress_meeting';
export type MeetingStatus = 'draft' | 'published';

export interface ActionItem {
  id: string;
  task: string;
  assignee: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface MeetingMinutes {
  id: string;
  project_id?: string | null;
  meeting_title: string;
  meeting_type: MeetingType;
  meeting_date: string;
  location?: string | null;
  attendees: string[];
  summary: string;
  action_items: ActionItem[];
  status: MeetingStatus;
  created_at: string;
}

export type ComplaintSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ComplaintCategory = 'quality' | 'schedule' | 'safety' | 'billing' | 'conduct' | 'other';
export type ComplaintStatus = 'received' | 'investigating' | 'resolved' | 'closed';

export interface ClientComplaint {
  id: string;
  project_id?: string | null;
  complaint_number: string;
  client_name: string;
  contact_info?: string | null;
  severity: ComplaintSeverity;
  category: ComplaintCategory;
  description: string;
  resolution_plan?: string | null;
  status: ComplaintStatus;
  assigned_to?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

type TabKey = "stakeholders" | "logs" | "minutes" | "complaints";

export function CommunicationsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as TabKey) || "stakeholders";

  const [projectId] = useState<string>("");
  const [, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [minutesList, setMinutesList] = useState<MeetingMinutes[]>([]);
  const [complaints, setComplaints] = useState<ClientComplaint[]>([]);

  // Modals
  const [showStakeholderModal, setShowStakeholderModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showMinutesModal, setShowMinutesModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [resolvingComplaint, setResolvingComplaint] = useState<ClientComplaint | null>(null);

  // Form states
  const [newStakeholder, setNewStakeholder] = useState({
    name: "",
    organization: "",
    stakeholder_type: "client" as StakeholderType,
    role_title: "",
    email: "",
    phone: "",
    engagement_level: "medium" as EngagementLevel,
    notes: "",
  });

  const [newLog, setNewLog] = useState({
    reference_number: "",
    channel: "letter" as CommunicationChannel,
    direction: "outbound" as CommunicationDirection,
    sender_name: "",
    recipient_name: "",
    subject: "",
    summary: "",
    requires_response: false,
    response_due_date: "",
    status: "draft" as CommunicationStatus,
  });

  const [newMinutes, setNewMinutes] = useState({
    meeting_title: "",
    meeting_type: "site_coordination" as MeetingType,
    meeting_date: new Date().toISOString().split("T")[0],
    location: "",
    attendees: "",
    summary: "",
    action_items_raw: "", // Task | Assignee | DueDate per line
    status: "published" as MeetingStatus,
  });

  const [newComplaint, setNewComplaint] = useState({
    client_name: "",
    contact_info: "",
    severity: "medium" as ComplaintSeverity,
    category: "quality" as ComplaintCategory,
    description: "",
    assigned_to: "",
  });

  const [resolutionPlanText, setResolutionPlanText] = useState("");

  const loadData = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);

    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";

    try {
      if (currentTab === "stakeholders") {
        const res = await apiFetch<{ stakeholders: Stakeholder[] }>(
          `/communications/stakeholders${query}`,
          session.access_token
        );
        setStakeholders(res.stakeholders || []);
      } else if (currentTab === "logs") {
        const res = await apiFetch<{ logs: CommunicationLog[] }>(
          `/communications/logs${query}`,
          session.access_token
        );
        setLogs(res.logs || []);
      } else if (currentTab === "minutes") {
        const res = await apiFetch<{ minutes: MeetingMinutes[] }>(
          `/communications/meeting-minutes${query}`,
          session.access_token
        );
        setMinutesList(res.minutes || []);
      } else if (currentTab === "complaints") {
        const res = await apiFetch<{ complaints: ClientComplaint[] }>(
          `/communications/complaints${query}`,
          session.access_token
        );
        setComplaints(res.complaints || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load communications records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session?.access_token, currentTab, projectId]);

  const handleTabChange = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  // Form Submissions
  const handleCreateStakeholder = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ stakeholder: Stakeholder }>("/communications/stakeholders", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...newStakeholder,
          project_id: projectId || null,
        }),
      });
      setShowStakeholderModal(false);
      setNewStakeholder({
        name: "",
        organization: "",
        stakeholder_type: "client",
        role_title: "",
        email: "",
        phone: "",
        engagement_level: "medium",
        notes: "",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to create stakeholder");
    }
  };

  const handleDeleteStakeholder = async (id: string) => {
    if (!session?.access_token) return;
    if (!confirm("Are you sure you want to remove this stakeholder?")) return;
    try {
      await apiFetch(`/communications/stakeholders/${id}`, session.access_token, {
        method: "DELETE",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to delete stakeholder");
    }
  };

  const handleCreateLog = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ log: CommunicationLog }>("/communications/logs", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...newLog,
          project_id: projectId || null,
          response_due_date: newLog.response_due_date || null,
        }),
      });
      setShowLogModal(false);
      setNewLog({
        reference_number: "",
        channel: "letter",
        direction: "outbound",
        sender_name: "",
        recipient_name: "",
        subject: "",
        summary: "",
        requires_response: false,
        response_due_date: "",
        status: "draft",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to record communication log");
    }
  };

  const handleUpdateLogStatus = async (id: string, status: CommunicationStatus) => {
    if (!session?.access_token) return;
    try {
      await apiFetch(`/communications/logs/${id}/status`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update log status");
    }
  };

  const handleCreateMinutes = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;

    // Parse attendees (comma-separated)
    const attendeesList = newMinutes.attendees
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    // Parse action items: line by line "Task | Assignee | DueDate"
    const parsedActionItems = newMinutes.action_items_raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return {
          id: "",
          task: parts[0] || "General Action",
          assignee: parts[1] || "Unassigned",
          due_date: parts[2] || newMinutes.meeting_date,
          status: "pending" as const,
        };
      });

    try {
      await apiFetch<{ minutes: MeetingMinutes }>("/communications/meeting-minutes", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          project_id: projectId || null,
          meeting_title: newMinutes.meeting_title,
          meeting_type: newMinutes.meeting_type,
          meeting_date: newMinutes.meeting_date,
          location: newMinutes.location || null,
          attendees: attendeesList,
          summary: newMinutes.summary,
          action_items: parsedActionItems,
          status: newMinutes.status,
        }),
      });
      setShowMinutesModal(false);
      setNewMinutes({
        meeting_title: "",
        meeting_type: "site_coordination",
        meeting_date: new Date().toISOString().split("T")[0],
        location: "",
        attendees: "",
        summary: "",
        action_items_raw: "",
        status: "published",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to record meeting minutes");
    }
  };

  const handleToggleActionStatus = async (
    meetingId: string,
    actionId: string,
    currentStatus: "pending" | "in_progress" | "completed"
  ) => {
    if (!session?.access_token) return;
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    try {
      await apiFetch(`/communications/meeting-minutes/${meetingId}/actions/${actionId}`, session.access_token, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to update action item");
    }
  };

  const handleCreateComplaint = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    try {
      await apiFetch<{ complaint: ClientComplaint }>("/communications/complaints", session.access_token, {
        method: "POST",
        body: JSON.stringify({
          ...newComplaint,
          project_id: projectId || null,
        }),
      });
      setShowComplaintModal(false);
      setNewComplaint({
        client_name: "",
        contact_info: "",
        severity: "medium",
        category: "quality",
        description: "",
        assigned_to: "",
      });
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to log complaint");
    }
  };

  const handleResolveComplaint = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !resolvingComplaint) return;
    try {
      await apiFetch<{ complaint: ClientComplaint }>(
        `/communications/complaints/${resolvingComplaint.id}/resolve`,
        session.access_token,
        {
          method: "POST",
          body: JSON.stringify({ resolutionPlan: resolutionPlanText }),
        }
      );
      setResolvingComplaint(null);
      setResolutionPlanText("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to resolve complaint");
    }
  };

  // Metrics
  const criticalComplaints = complaints.filter((c) => c.severity === "critical" && c.status !== "resolved").length;
  const pendingActions = minutesList.reduce(
    (acc, m) => acc + (m.action_items?.filter((a) => a.status !== "completed").length || 0),
    0
  );
  const unreadLogs = logs.filter((l) => l.requires_response && l.status !== "closed").length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-display">
            Customer & Stakeholder Communications
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage client, consultant, and statutory communications, formal notices, meeting minutes, and client escalations.
          </p>
        </div>

        {/* Global Action Button Based on Active Tab */}
        <div className="flex items-center gap-3">
          {currentTab === "stakeholders" && (
            <PermissionGate permission="communications.stakeholder.manage">
              <button
                onClick={() => setShowStakeholderModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                + Add Stakeholder
              </button>
            </PermissionGate>
          )}

          {currentTab === "logs" && (
            <PermissionGate permission="communications.log.manage">
              <button
                onClick={() => setShowLogModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                + Log Correspondence
              </button>
            </PermissionGate>
          )}

          {currentTab === "minutes" && (
            <PermissionGate permission="communications.minutes.manage">
              <button
                onClick={() => setShowMinutesModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              >
                + Record Minutes (MOM)
              </button>
            </PermissionGate>
          )}

          {currentTab === "complaints" && (
            <PermissionGate permission="communications.complaint.manage">
              <button
                onClick={() => setShowComplaintModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                + Log Client Complaint
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Registered Stakeholders
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 font-display">
            {stakeholders.length}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Clients, consultants & authorities</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Notices Requiring Action
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-amber-600 font-display">
            {unreadLogs}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Formal response deadlines pending</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Pending MOM Action Items
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-indigo-600 font-display">
            {pendingActions}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Open tasks across all meetings</div>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Critical Escalations
          </div>
          <div className="mt-2 text-3xl font-bold tracking-tight text-red-600 font-display">
            {criticalComplaints}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Unresolved high-priority issues</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => handleTabChange("stakeholders")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "stakeholders"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Stakeholder Directory
          </button>
          <button
            onClick={() => handleTabChange("logs")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "logs"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Communication Logs & Notices
          </button>
          <button
            onClick={() => handleTabChange("minutes")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "minutes"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Meeting Minutes (MOM)
          </button>
          <button
            onClick={() => handleTabChange("complaints")}
            className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              currentTab === "complaints"
                ? "border-amber-500 text-amber-600 font-semibold"
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            }`}
          >
            Client Complaints & Escalations
          </button>
        </nav>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Tab 1: Stakeholders Directory */}
      {currentTab === "stakeholders" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Name & Role</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Engagement Level</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {stakeholders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                      No stakeholders registered yet. Add key client, consultant, or authority contacts.
                    </td>
                  </tr>
                ) : (
                  stakeholders.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <div>{s.name}</div>
                        <div className="text-xs text-zinc-400">{s.role_title}</div>
                      </td>
                      <td className="px-4 py-3">{s.organization}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize bg-zinc-100 text-zinc-700">
                          {s.stakeholder_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {s.email && <div>{s.email}</div>}
                        {s.phone && <div className="text-zinc-400">{s.phone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            s.engagement_level === "high"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : s.engagement_level === "medium"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {s.engagement_level} priority
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="communications.stakeholder.manage">
                          <button
                            onClick={() => handleDeleteStakeholder(s.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Remove
                          </button>
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

      {/* Tab 2: Communication Logs & Formal Notices */}
      {currentTab === "logs" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Ref & Channel</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">Subject & Summary</th>
                  <th className="px-4 py-3">Sender / Recipient</th>
                  <th className="px-4 py-3">Response Due</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No correspondence logged. Record formal letters, site instructions, and submittals.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <div>{log.reference_number}</div>
                        <div className="text-xs uppercase font-semibold text-zinc-400">{log.channel}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wider ${
                            log.direction === "inbound"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {log.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900">{log.subject}</div>
                        <div className="text-xs text-zinc-500 max-w-md truncate">{log.summary}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div>From: {log.sender_name}</div>
                        <div className="text-zinc-400">To: {log.recipient_name}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {log.requires_response ? (
                          <span className="font-semibold text-amber-600">
                            {log.response_due_date || "Required"}
                          </span>
                        ) : (
                          <span className="text-zinc-400">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize bg-zinc-100 text-zinc-700">
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="communications.log.manage">
                          {log.status === "draft" && (
                            <button
                              onClick={() => handleUpdateLogStatus(log.id, "sent")}
                              className="text-xs text-amber-600 hover:text-amber-800 font-medium"
                            >
                              Mark Sent
                            </button>
                          )}
                          {log.status === "sent" && log.requires_response && (
                            <button
                              onClick={() => handleUpdateLogStatus(log.id, "closed")}
                              className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                            >
                              Close Response
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

      {/* Tab 3: Meeting Minutes (MOM) & Action Items */}
      {currentTab === "minutes" && (
        <div className="space-y-6">
          {minutesList.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center text-zinc-400 shadow-sm">
              No meeting minutes recorded yet. Click "+ Record Minutes (MOM)" to add project coordination meetings.
            </div>
          ) : (
            minutesList.map((m) => (
              <div key={m.id} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 font-display">{m.meeting_title}</h3>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                      <span>Date: {m.meeting_date}</span>
                      <span>•</span>
                      <span className="capitalize">Type: {m.meeting_type.replace("_", " ")}</span>
                      {m.location && (
                        <>
                          <span>•</span>
                          <span>Location: {m.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize bg-amber-50 text-amber-700 border border-amber-200 self-start md:self-auto">
                    {m.status}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Attendees
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {m.attendees?.map((att, idx) => (
                      <span key={idx} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">
                        {att}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Meeting Summary & Key Decisions
                  </div>
                  <p className="text-sm text-zinc-700 whitespace-pre-line bg-zinc-50 rounded-lg p-3 border border-zinc-100">
                    {m.summary}
                  </p>
                </div>

                {/* Action Items List */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Extracted Action Items ({m.action_items?.length || 0})
                  </div>
                  <div className="divide-y divide-zinc-100 border border-zinc-100 rounded-lg overflow-hidden">
                    {m.action_items?.length === 0 ? (
                      <div className="p-3 text-xs text-zinc-400 italic">No formal action items assigned.</div>
                    ) : (
                      m.action_items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 text-sm bg-white hover:bg-zinc-50/50"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={item.status === "completed"}
                              onChange={() => handleToggleActionStatus(m.id, item.id, item.status)}
                              className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                            />
                            <div className={item.status === "completed" ? "line-through text-zinc-400" : "text-zinc-800"}>
                              <span className="font-medium">{item.task}</span>
                              <div className="text-xs text-zinc-400">
                                Assigned to: {item.assignee} • Due: {item.due_date}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                              item.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {item.status.replace("_", " ")}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Client Complaints & Escalations */}
      {currentTab === "complaints" && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase font-semibold text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Number & Client</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {complaints.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No customer complaints recorded. Excellent client satisfaction standing.
                    </td>
                  </tr>
                ) : (
                  complaints.map((c) => (
                    <tr key={c.id} className="hover:bg-zinc-50/50">
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        <div>{c.complaint_number}</div>
                        <div className="text-xs text-zinc-400">{c.client_name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                            c.severity === "critical"
                              ? "bg-red-100 text-red-800 border border-red-300"
                              : c.severity === "high"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {c.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 capitalize text-xs">{c.category}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate text-zinc-800">{c.description}</div>
                        {c.resolution_plan && (
                          <div className="text-xs text-emerald-600 mt-0.5 italic">
                            Plan: {c.resolution_plan}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{c.assigned_to || "Unassigned"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                            c.status === "resolved"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PermissionGate permission="communications.complaint.resolve">
                          {c.status !== "resolved" && (
                            <button
                              onClick={() => {
                                setResolvingComplaint(c);
                                setResolutionPlanText("");
                              }}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800"
                            >
                              Resolve
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

      {/* Modal: Add Stakeholder */}
      {showStakeholderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Add Stakeholder</h2>
            <p className="text-xs text-zinc-500 mt-1">Register an external or statutory project contact.</p>

            <form onSubmit={handleCreateStakeholder} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newStakeholder.name}
                  onChange={(e) => setNewStakeholder({ ...newStakeholder, name: e.target.value })}
                  placeholder="e.g. Engr. Khalid Mansoori"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Organization *</label>
                  <input
                    type="text"
                    required
                    value={newStakeholder.organization}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, organization: e.target.value })}
                    placeholder="e.g. Apex Master Developers"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Role Title *</label>
                  <input
                    type="text"
                    required
                    value={newStakeholder.role_title}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, role_title: e.target.value })}
                    placeholder="e.g. Senior Project Manager"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Stakeholder Type</label>
                  <select
                    value={newStakeholder.stakeholder_type}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, stakeholder_type: e.target.value as StakeholderType })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="client">Client</option>
                    <option value="consultant">Consultant</option>
                    <option value="subcontractor">Subcontractor</option>
                    <option value="authority">Government / Statutory</option>
                    <option value="utility">Utility Provider</option>
                    <option value="community">Community / Public</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700">Engagement Level</label>
                  <select
                    value={newStakeholder.engagement_level}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, engagement_level: e.target.value as EngagementLevel })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Email</label>
                  <input
                    type="email"
                    value={newStakeholder.email}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, email: e.target.value })}
                    placeholder="khalid@apex.com"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Phone</label>
                  <input
                    type="tel"
                    value={newStakeholder.phone}
                    onChange={(e) => setNewStakeholder({ ...newStakeholder, phone: e.target.value })}
                    placeholder="+971 50 123 4567"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowStakeholderModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Save Stakeholder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Correspondence */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Log Correspondence / Notice</h2>
            <p className="text-xs text-zinc-500 mt-1">Record inbound or outbound contractual notices.</p>

            <form onSubmit={handleCreateLog} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Reference Number *</label>
                  <input
                    type="text"
                    required
                    value={newLog.reference_number}
                    onChange={(e) => setNewLog({ ...newLog, reference_number: e.target.value })}
                    placeholder="e.g. LTR-2026-0042"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Channel *</label>
                  <select
                    value={newLog.channel}
                    onChange={(e) => setNewLog({ ...newLog, channel: e.target.value as CommunicationChannel })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="letter">Formal Letter</option>
                    <option value="email">Email</option>
                    <option value="site_instruction">Site Instruction (SI)</option>
                    <option value="transmittal">Transmittal / Submittal</option>
                    <option value="notice">Notice</option>
                    <option value="circular">Circular</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Direction *</label>
                  <select
                    value={newLog.direction}
                    onChange={(e) => setNewLog({ ...newLog, direction: e.target.value as CommunicationDirection })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="outbound">Outbound (Sent)</option>
                    <option value="inbound">Inbound (Received)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Initial Status</label>
                  <select
                    value={newLog.status}
                    onChange={(e) => setNewLog({ ...newLog, status: e.target.value as CommunicationStatus })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="received">Received</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Sender *</label>
                  <input
                    type="text"
                    required
                    value={newLog.sender_name}
                    onChange={(e) => setNewLog({ ...newLog, sender_name: e.target.value })}
                    placeholder="e.g. Lead Project Manager"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Recipient *</label>
                  <input
                    type="text"
                    required
                    value={newLog.recipient_name}
                    onChange={(e) => setNewLog({ ...newLog, recipient_name: e.target.value })}
                    placeholder="e.g. Supervising Consultant"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Subject *</label>
                <input
                  type="text"
                  required
                  value={newLog.subject}
                  onChange={(e) => setNewLog({ ...newLog, subject: e.target.value })}
                  placeholder="e.g. Notice of Delay Due to Heavy Rainfall"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Summary / Notes *</label>
                <textarea
                  required
                  rows={3}
                  value={newLog.summary}
                  onChange={(e) => setNewLog({ ...newLog, summary: e.target.value })}
                  placeholder="Brief summary of key contents and referenced clauses..."
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="requiresResponse"
                    checked={newLog.requires_response}
                    onChange={(e) => setNewLog({ ...newLog, requires_response: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  <label htmlFor="requiresResponse" className="text-xs font-medium text-zinc-700">
                    Requires Response
                  </label>
                </div>
                {newLog.requires_response && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Due Date</label>
                    <input
                      type="date"
                      value={newLog.response_due_date}
                      onChange={(e) => setNewLog({ ...newLog, response_due_date: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Save Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record MOM */}
      {showMinutesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl border border-zinc-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Record Meeting Minutes (MOM)</h2>
            <p className="text-xs text-zinc-500 mt-1">Structured meeting minutes with actionable item extraction.</p>

            <form onSubmit={handleCreateMinutes} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Meeting Title *</label>
                <input
                  type="text"
                  required
                  value={newMinutes.meeting_title}
                  onChange={(e) => setNewMinutes({ ...newMinutes, meeting_title: e.target.value })}
                  placeholder="e.g. Weekly Progress & Site Coordination Meeting #12"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Meeting Type *</label>
                  <select
                    value={newMinutes.meeting_type}
                    onChange={(e) => setNewMinutes({ ...newMinutes, meeting_type: e.target.value as MeetingType })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="site_coordination">Site Coordination</option>
                    <option value="client_review">Client Review</option>
                    <option value="technical_clarification">Technical Clarification</option>
                    <option value="progress_meeting">Progress Meeting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Date *</label>
                  <input
                    type="date"
                    required
                    value={newMinutes.meeting_date}
                    onChange={(e) => setNewMinutes({ ...newMinutes, meeting_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Location</label>
                <input
                  type="text"
                  value={newMinutes.location}
                  onChange={(e) => setNewMinutes({ ...newMinutes, location: e.target.value })}
                  placeholder="e.g. Site Office Conf Room or Microsoft Teams"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Attendees (Comma-separated)</label>
                <input
                  type="text"
                  value={newMinutes.attendees}
                  onChange={(e) => setNewMinutes({ ...newMinutes, attendees: e.target.value })}
                  placeholder="e.g. Sara Lee (Consultant), John Doe (PM), Mike Tan (MEP)"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Summary & Discussion *</label>
                <textarea
                  required
                  rows={4}
                  value={newMinutes.summary}
                  onChange={(e) => setNewMinutes({ ...newMinutes, summary: e.target.value })}
                  placeholder="Highlights, milestones discussed, major blockers..."
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">
                  Action Items (Format: Task | Assignee | DueDate per line)
                </label>
                <textarea
                  rows={3}
                  value={newMinutes.action_items_raw}
                  onChange={(e) => setNewMinutes({ ...newMinutes, action_items_raw: e.target.value })}
                  placeholder="Submit revised fire fighting layout | Mike Tan | 2026-10-25&#10;Coordinate electrical tie-in with DEWA | John Doe | 2026-10-28"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-mono text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowMinutesModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
                >
                  Publish Minutes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log Complaint */}
      {showComplaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Log Client Complaint / Escalation</h2>
            <p className="text-xs text-zinc-500 mt-1">Register client issues with severity triage and action tracking.</p>

            <form onSubmit={handleCreateComplaint} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Client Name *</label>
                  <input
                    type="text"
                    required
                    value={newComplaint.client_name}
                    onChange={(e) => setNewComplaint({ ...newComplaint, client_name: e.target.value })}
                    placeholder="e.g. Apex Master Developers"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Contact Info</label>
                  <input
                    type="text"
                    value={newComplaint.contact_info}
                    onChange={(e) => setNewComplaint({ ...newComplaint, contact_info: e.target.value })}
                    placeholder="e.g. email or phone"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Severity *</label>
                  <select
                    value={newComplaint.severity}
                    onChange={(e) => setNewComplaint({ ...newComplaint, severity: e.target.value as ComplaintSeverity })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="critical">Critical (Immediate Stop/Escalation)</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700">Category *</label>
                  <select
                    value={newComplaint.category}
                    onChange={(e) => setNewComplaint({ ...newComplaint, category: e.target.value as ComplaintCategory })}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    <option value="quality">Quality / Workmanship</option>
                    <option value="schedule">Schedule / Milestones</option>
                    <option value="safety">Safety / Environmental</option>
                    <option value="billing">Billing / Payments</option>
                    <option value="conduct">Site Conduct</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Assigned To (Internal)</label>
                <input
                  type="text"
                  value={newComplaint.assigned_to}
                  onChange={(e) => setNewComplaint({ ...newComplaint, assigned_to: e.target.value })}
                  placeholder="e.g. QA/QC Manager or Project Director"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Description of Issue *</label>
                <textarea
                  required
                  rows={3}
                  value={newComplaint.description}
                  onChange={(e) => setNewComplaint({ ...newComplaint, description: e.target.value })}
                  placeholder="Provide precise details of the grievance or escalation..."
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowComplaintModal(false)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Log Complaint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Resolve Complaint */}
      {resolvingComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-100">
            <h2 className="text-lg font-bold text-zinc-900 font-display">Resolve Client Complaint</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Complaint {resolvingComplaint.complaint_number} - {resolvingComplaint.client_name}
            </p>

            <form onSubmit={handleResolveComplaint} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Original Grievance</label>
                <div className="mt-1 p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-xs text-zinc-700">
                  {resolvingComplaint.description}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Corrective Action & Resolution Plan *</label>
                <textarea
                  required
                  rows={4}
                  value={resolutionPlanText}
                  onChange={(e) => setResolutionPlanText(e.target.value)}
                  placeholder="Describe the remediation actions taken and client acceptance details..."
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setResolvingComplaint(null)}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
