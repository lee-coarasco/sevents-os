import { useState } from "react";
import { Link } from "react-router-dom";

const sections = [
  {
    id: "overview",
    title: "What is the Configuration Studio?",
    icon: "⚙️",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-700">
          The <strong>Configuration Studio</strong> is where you build the automated workflows that power
          your construction operations. Each workflow is a step-by-step sequence that the system follows
          automatically — creating tasks, routing approvals, sending notifications, and collecting evidence.
        </p>
        <p className="text-zinc-700">
          You design workflows visually using <strong>nodes</strong> (steps), <strong>transitions</strong>{" "}
          (the paths between steps), and <strong>conditions</strong> (rules that decide which path to take).
        </p>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Construction example</p>
          <p className="text-sm text-amber-700 mt-1">
            "Material Request Workflow": Site Engineer submits a form → Project Manager reviews →
            if approved, Procurement raises PO → Supplier delivers → Site Supervisor confirms GRN →
            Finance processes payment. The system automates every handoff automatically.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-semibold text-zinc-700">How it connects to the Catalogue</p>
          <p className="text-sm text-zinc-600 mt-1">
            Work items in the Catalogue describe <em>what</em> needs to happen. Workflows in the
            Configuration Studio describe <em>how</em> the system makes it happen. Each catalogue item
            can be linked to a workflow via the "Workflow Template" field.
          </p>
          <Link to="/catalogue-guide" className="mt-2 inline-block text-sm text-brand font-semibold hover:underline">
            Learn about the Catalogue →
          </Link>
        </div>
      </div>
    ),
  },
  {
    id: "lifecycle",
    title: "Workflow lifecycle",
    icon: "🔄",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-700 text-sm">
          Every workflow goes through a structured lifecycle before it goes live. This ensures that only
          reviewed, tested workflows run in production.
        </p>
        <div className="space-y-2">
          {[
            {
              status: "Draft",
              color: "border-zinc-200 bg-zinc-50",
              badge: "bg-zinc-100 text-zinc-600",
              desc: "You are actively building and editing the workflow. You can add nodes, change transitions, and test it. Nothing is live yet.",
              actions: ["Add/edit/delete nodes", "Add transitions and conditions", "Run simulation tests"],
            },
            {
              status: "Under Review",
              color: "border-blue-200 bg-blue-50",
              badge: "bg-blue-100 text-blue-700",
              desc: "The workflow has been submitted for approval. It cannot be edited until it is approved or rejected.",
              actions: ["Reviewer approves or rejects", "Comments on the version", "View simulation results"],
            },
            {
              status: "Approved",
              color: "border-green-200 bg-green-50",
              badge: "bg-green-100 text-green-700",
              desc: "The workflow has been signed off. It can now be published to go live.",
              actions: ["Publish to make it live", "Set an effective date"],
            },
            {
              status: "Published",
              color: "border-amber-200 bg-amber-50",
              badge: "bg-amber-100 text-amber-700",
              desc: "The workflow is live and the system will follow it for new instances. You cannot edit the published version — create a new version instead.",
              actions: ["Start new version to make changes", "Rollback to previous version if needed"],
            },
            {
              status: "Rollback",
              color: "border-red-200 bg-red-50",
              badge: "bg-red-100 text-red-600",
              desc: "If a published workflow has problems, you can roll back to a previous published version instantly.",
              actions: ["Select any previously published version", "Provide a reason for the rollback"],
            },
          ].map(({ status, color, badge, desc, actions }) => (
            <div key={status} className={`rounded-xl border p-4 ${color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${badge}`}>{status}</span>
              </div>
              <p className="text-sm text-zinc-700 mb-2">{desc}</p>
              <div className="flex flex-wrap gap-1">
                {actions.map((a) => (
                  <span key={a} className="rounded bg-white/60 px-2 py-0.5 text-xs text-zinc-500 border border-white">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "nodes",
    title: "Node types explained",
    icon: "🧩",
    content: (
      <div className="space-y-4">
        <p className="text-zinc-700 text-sm">
          <strong>Nodes</strong> are the individual steps in a workflow. Each node does one specific thing.
          Choose the node type that matches what needs to happen at that step.
        </p>
        <div className="space-y-3">
          {[
            {
              type: "create_task",
              label: "Create Task",
              color: "border-blue-200 bg-blue-50",
              badge: "bg-blue-100 text-blue-700",
              desc: "Creates a task in someone's work queue. The assigned person sees it in their My Work inbox.",
              example: "Create task: 'Review incoming delivery' → assigned to Store Keeper.",
              useWhen: "The step needs a human to perform an action.",
            },
            {
              type: "assign_role_user",
              label: "Assign Role/User",
              color: "border-indigo-200 bg-indigo-50",
              badge: "bg-indigo-100 text-indigo-700",
              desc: "Assigns the workflow to a specific user or role at this point. The system will route subsequent steps to that person.",
              example: "Assign to: QC Manager (whoever holds that role on this project).",
              useWhen: "The next steps should be done by a different role than the one who started.",
            },
            {
              type: "collect_form_data",
              label: "Collect Form Data",
              color: "border-cyan-200 bg-cyan-50",
              badge: "bg-cyan-100 text-cyan-700",
              desc: "Displays a form and waits for the user to fill it in. The submitted data is stored and available to later steps.",
              example: "Form: 'Site Inspection Report' with fields: date, location, findings, severity.",
              useWhen: "Structured data needs to be captured at this step.",
            },
            {
              type: "request_upload_evidence",
              label: "Request Upload/Evidence",
              color: "border-teal-200 bg-teal-50",
              badge: "bg-teal-100 text-teal-700",
              desc: "Asks the user to upload a file or take a photo as evidence. The uploaded file is attached to the workflow instance.",
              example: "Upload: 'Signed delivery note (PDF or photo)'. Required: yes.",
              useWhen: "Proof of completion or a document handover is needed.",
            },
            {
              type: "request_approval",
              label: "Request Approval",
              color: "border-orange-200 bg-orange-50",
              badge: "bg-orange-100 text-orange-700",
              desc: "Sends the workflow to an approver and waits for their decision (Approve / Reject / Return for Correction). The decision determines which path the workflow takes next.",
              example: "Project Manager approves the purchase requisition. Options: Approve, Reject, Return for Correction.",
              useWhen: "A formal sign-off is required before the workflow can proceed.",
            },
            {
              type: "evaluate_condition",
              label: "Evaluate Condition",
              color: "border-yellow-200 bg-yellow-50",
              badge: "bg-yellow-100 text-yellow-700",
              desc: "Checks a field value and routes the workflow down different paths based on the result. This is how you build 'if/else' logic into workflows.",
              example: "If amount > 50,000 → route to Finance Director. Else → route to PM.",
              useWhen: "The next step depends on a value (amount, status, role, etc.).",
            },
            {
              type: "send_notification",
              label: "Send Notification",
              color: "border-pink-200 bg-pink-50",
              badge: "bg-pink-100 text-pink-700",
              desc: "Sends an email or in-app notification to one or more users. Does not wait for a response — the workflow continues automatically.",
              example: "Notify: Project Manager, Site Supervisor. Message: 'NCR #{{id}} has been raised and requires your attention.'",
              useWhen: "Someone needs to be informed but does not need to take action in the workflow.",
            },
            {
              type: "wait_event_time",
              label: "Wait / Timer",
              color: "border-slate-200 bg-slate-50",
              badge: "bg-slate-100 text-slate-600",
              desc: "Pauses the workflow for a set duration (hours/days) or until a specific date. Useful for SLA enforcement and scheduled follow-ups.",
              example: "Wait 48 hours. If not completed by then, escalate automatically.",
              useWhen: "A delay or SLA timer is needed.",
            },
            {
              type: "create_linked_followup",
              label: "Create Linked Follow-up",
              color: "border-violet-200 bg-violet-50",
              badge: "bg-violet-100 text-violet-700",
              desc: "Starts a new workflow instance linked to the current one. The child workflow runs independently but is visible from the parent.",
              example: "When an NCR is raised, automatically start the 'Corrective Action Workflow' linked to it.",
              useWhen: "The current workflow needs to trigger another separate workflow.",
            },
            {
              type: "escalate",
              label: "Escalate",
              color: "border-red-200 bg-red-50",
              badge: "bg-red-100 text-red-600",
              desc: "Escalates the workflow to a senior level. Used when a step has been waiting too long or a critical threshold is crossed.",
              example: "Escalate to: Project Director. Reason: Approval overdue by 24 hours.",
              useWhen: "SLA breaches or severity thresholds need senior intervention.",
            },
            {
              type: "call_service",
              label: "Call Service (API)",
              color: "border-emerald-200 bg-emerald-50",
              badge: "bg-emerald-100 text-emerald-700",
              desc: "Calls an external system's API. Used for integrations: creating a record in ERP, sending data to a third-party service, etc.",
              example: "Call: POST /erp/purchase-orders with the approved PR data.",
              useWhen: "Data needs to be pushed to or pulled from an external system.",
            },
            {
              type: "complete",
              label: "Complete",
              color: "border-green-200 bg-green-50",
              badge: "bg-green-100 text-green-700",
              desc: "Marks the workflow instance as successfully completed. Every workflow must end with either a Complete or a Cancel node.",
              example: "Goods received, payment confirmed, GRN filed. Workflow complete.",
              useWhen: "The successful end of the workflow.",
            },
            {
              type: "cancel",
              label: "Cancel",
              color: "border-zinc-200 bg-zinc-50",
              badge: "bg-zinc-100 text-zinc-500",
              desc: "Terminates the workflow instance without completing it. Use this for rejection paths or when a request is withdrawn.",
              example: "PR rejected by Finance Director. Workflow cancelled.",
              useWhen: "The workflow ends without the desired outcome (rejected, withdrawn, duplicate, etc.).",
            },
          ].map(({ type, label, color, badge, desc, example, useWhen }) => (
            <div key={type} className={`rounded-xl border p-4 ${color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${badge}`}>{label}</span>
                <span className="text-xs text-zinc-400 font-mono">{type}</span>
              </div>
              <p className="text-sm text-zinc-700 mb-2">{desc}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs font-semibold text-zinc-500 mb-0.5">Example</p>
                  <p className="text-xs text-zinc-600 italic">{example}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-500 mb-0.5">Use when</p>
                  <p className="text-xs text-zinc-600">{useWhen}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "transitions-conditions",
    title: "Transitions & conditions",
    icon: "↔️",
    content: (
      <div className="space-y-5">
        <div>
          <h3 className="font-brand text-base font-bold text-zinc-800 mb-2">Transitions</h3>
          <p className="text-zinc-700 text-sm mb-3">
            A <strong>transition</strong> is an arrow connecting two nodes. It tells the system "after this
            step is done, go to this next step". You need at least one transition between each pair of
            connected steps.
          </p>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-700 mb-2">How to add a transition</p>
            <ol className="space-y-1 list-decimal list-inside text-sm text-zinc-600">
              <li>Open a draft workflow version</li>
              <li>Click "Add Transition" in the Transitions tab</li>
              <li>Select the "From" node and the "To" node</li>
              <li>Give it a label (e.g. "Approved", "Rejected", "Next Step")</li>
            </ol>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mt-3">
            <p className="text-sm font-semibold text-amber-800">Example</p>
            <p className="text-sm text-amber-700">
              "Request Approval" node → [Approved] → "Create Task: Issue PO" node<br />
              "Request Approval" node → [Rejected] → "Send Notification: Inform Requestor" node<br />
              "Request Approval" node → [Return for Correction] → "Collect Form Data: Update PR" node
            </p>
          </div>
        </div>

        <div>
          <h3 className="font-brand text-base font-bold text-zinc-800 mb-2">Conditions</h3>
          <p className="text-zinc-700 text-sm mb-3">
            A <strong>condition</strong> is a rule applied to a transition that must be true for that path
            to be taken. Conditions work together with "Evaluate Condition" nodes to implement branching logic.
          </p>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-zinc-700 mb-2">Condition operators</p>
            <div className="space-y-2">
              {[
                { op: "equals", desc: "Field exactly matches a value", ex: "status equals 'approved'" },
                { op: "not_equals", desc: "Field does not match a value", ex: "risk_tier not_equals 'Low'" },
                { op: "greater_than", desc: "Numeric field is greater than a value", ex: "amount greater_than 50000" },
                { op: "less_than", desc: "Numeric field is less than a value", ex: "amount less_than 1000" },
                { op: "contains", desc: "Text field contains a substring", ex: "department contains 'Site'" },
                { op: "not_contains", desc: "Text field does not contain a substring", ex: "notes not_contains 'urgent'" },
                { op: "is_empty", desc: "Field has no value", ex: "approver_comment is_empty" },
                { op: "is_not_empty", desc: "Field has a value", ex: "evidence_file is_not_empty" },
              ].map(({ op, desc, ex }) => (
                <div key={op} className="flex items-start gap-3">
                  <span className="min-w-[120px] rounded bg-zinc-100 px-2 py-0.5 text-xs font-mono text-zinc-700">{op}</span>
                  <div>
                    <p className="text-sm text-zinc-600">{desc}</p>
                    <p className="text-xs text-zinc-400 italic">{ex}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "building",
    title: "Building your first workflow",
    icon: "🏗️",
    content: (
      <div className="space-y-5">
        <p className="text-zinc-700 text-sm">
          Follow these steps to build a workflow from scratch. We'll use a "Site Non-Conformance Report"
          as the example.
        </p>
        <div className="space-y-3">
          {[
            {
              step: "1",
              title: "Create the workflow definition",
              desc: 'Go to Configuration Studio → New Workflow. Name it "Site NCR Workflow". Set the capability key: "site.ncr".',
              tip: "Use a short, consistent naming convention: Module.Action (e.g. site.ncr, procurement.pr, finance.invoice).",
            },
            {
              step: "2",
              title: "Create a version",
              desc: 'Click "New Version" on the workflow detail page. This creates a draft (v1) you can edit.',
              tip: 'All edits are made on a version, not the definition itself. The published version is what runs live.',
            },
            {
              step: "3",
              title: "Plan your nodes first",
              desc: "Before adding nodes, sketch the steps on paper: Who does what? What decisions need to be made? Where does it end?",
              tip: "NCR example: Raise NCR → QC Review → Assign Corrective Action → Corrective Action Done → QC Verify → Close.",
            },
            {
              step: "4",
              title: "Add nodes",
              desc: "Click 'Add Node' for each step. Give each node a unique Key (e.g. 'raise_ncr') and choose the correct type.",
              tip: "Node keys must be unique within the workflow. Use lowercase_underscores. They appear in reports and integrations.",
            },
            {
              step: "5",
              title: "Add transitions",
              desc: "Connect your nodes by adding transitions. Each transition needs a From node, a To node, and a label.",
              tip: "Every node except Complete/Cancel needs at least one outgoing transition. Complete/Cancel should have none.",
            },
            {
              step: "6",
              title: "Add conditions (if needed)",
              desc: "On evaluation nodes, add conditions to the transitions to implement branching. E.g. 'If severity = Critical, route to Director instead of PM.'",
              tip: "Conditions are optional — most transitions don't need them. Use them only when paths diverge based on data.",
            },
            {
              step: "7",
              title: "Run simulation",
              desc: 'Click "Run Simulation" to test the workflow with sample data. The simulation checks for unreachable nodes, missing transitions, and logic errors.',
              tip: "Fix all errors the simulation reports before submitting for review. A green simulation does not mean the workflow is perfect — use the visual diagram to double-check the flow.",
            },
            {
              step: "8",
              title: "Submit for review, then publish",
              desc: 'Click "Submit for Review". A reviewer approves it. Then click "Publish" to make it live.',
              tip: "Set an effective date on publish if you want the workflow to take effect at a future date.",
            },
          ].map(({ step, title, desc, tip }) => (
            <div key={step} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-zinc-900">
                  {step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{title}</p>
                  <p className="text-sm text-zinc-600 mt-1">{desc}</p>
                  {tip && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-2">
                      💡 {tip}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <Link
            to="/config-studio"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim"
          >
            Go to Configuration Studio
          </Link>
          <Link
            to="/catalogue"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            Go to Catalogue
          </Link>
          <Link
            to="/catalogue-guide"
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            ← Catalogue guide
          </Link>
        </div>
      </div>
    ),
  },
];

export function WorkflowGuidePage() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
            <Link to="/config-studio" className="hover:text-zinc-600">Configuration Studio</Link>
            <span>/</span>
            <span>Guide</span>
          </div>
          <h1 className="font-brand text-3xl font-bold text-zinc-900">Configuration Studio Guide</h1>
          <p className="mt-2 text-zinc-500 text-base">
            Everything you need to build, test, and publish workflows that automate your construction operations.
          </p>
        </div>

        <div className="flex gap-6">
          {/* Sidebar nav */}
          <div className="w-56 shrink-0">
            <div className="sticky top-6 rounded-2xl border border-zinc-100 bg-white shadow-sm p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 px-2 mb-2">Sections</p>
              {sections.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeSection === s.id
                      ? "bg-brand text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  <span className="mr-2">{s.icon}</span>
                  {s.title.length > 28 ? s.title.slice(0, 28) + "…" : s.title}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {sections.map((s) =>
              s.id === activeSection ? (
                <div key={s.id} className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6">
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-zinc-100">
                    <span className="text-2xl">{s.icon}</span>
                    <h2 className="font-brand text-xl font-bold text-zinc-900">{s.title}</h2>
                  </div>
                  {s.content}
                </div>
              ) : null,
            )}

            {/* Bottom nav */}
            <div className="mt-4 flex gap-2">
              {sections.map((s, i) => {
                const cur = sections.findIndex((x) => x.id === activeSection);
                if (i === cur - 1 || i === cur + 1) {
                  return (
                    <button
                      key={s.id}
                      onClick={() => setActiveSection(s.id)}
                      className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
                    >
                      {i < cur ? `← ${s.title}` : `${s.title} →`}
                    </button>
                  );
                }
                return null;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
