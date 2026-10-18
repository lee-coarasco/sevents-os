import { Link } from "react-router-dom";

const NODE_TYPES = [
  {
    key: "create_task",
    label: "Create Task",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
    what: "Creates a task card in someone's work queue.",
    when: "Whenever a person needs to do something — fill a form, inspect something, call a vendor.",
    example: "Create a task for the Store Keeper to check stock availability and confirm quantities.",
  },
  {
    key: "assign_role_user",
    label: "Assign Role / User",
    color: "bg-indigo-100 text-indigo-800 border-indigo-200",
    dot: "bg-indigo-500",
    what: "Sets who is responsible for the current step — by role (e.g. 'Site Engineer') or a specific person.",
    when: "At the start of a workflow or after a branch where a different person takes over.",
    example: "Assign the Procurement Officer role to handle all steps after PM approval.",
  },
  {
    key: "collect_form_data",
    label: "Collect Form Data",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
    dot: "bg-cyan-500",
    what: "Shows the assignee a form to fill in and submit.",
    when: "Whenever you need structured data captured: quantities, dates, cost codes, names.",
    example: "Material Request form: item code, quantity needed, required-by date, cost code.",
  },
  {
    key: "request_upload_evidence",
    label: "Request Upload / Evidence",
    color: "bg-teal-100 text-teal-800 border-teal-200",
    dot: "bg-teal-500",
    what: "Prompts the assignee to upload a file or photo as proof.",
    when: "When you need documentary evidence — a signed form, a photo, a test certificate.",
    example: "Upload the signed delivery note after goods arrive on site.",
  },
  {
    key: "evaluate_condition",
    label: "Evaluate Condition",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "bg-yellow-500",
    what: "A decision point that branches the workflow based on a rule.",
    when: "When different things should happen depending on a value — amount, status, quantity.",
    example:
      "If request amount < AED 10,000 → go to direct approval. If ≥ AED 10,000 → go to manager escalation.",
  },
  {
    key: "call_service",
    label: "Call Service",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
    what: "Calls an external system or API automatically — no human action needed.",
    when: "When data needs to be pushed to or pulled from an integration (ERP, accounting, etc.).",
    example: "Push the approved PO to the accounting system to create a payable.",
  },
  {
    key: "request_approval",
    label: "Request Approval",
    color: "bg-rose-100 text-rose-800 border-rose-200",
    dot: "bg-rose-500",
    what: "Sends the record to an approver who can approve, reject, or return for correction.",
    when: "Any time a sign-off is required before the work continues.",
    example: "PM approves the material request. On approval → route to procurement. On rejection → notify requestor.",
  },
  {
    key: "send_notification",
    label: "Send Notification",
    color: "bg-pink-100 text-pink-800 border-pink-200",
    dot: "bg-pink-500",
    what: "Sends an in-app notification or email to one or more people.",
    when: "When you want to inform someone without requiring action from them.",
    example: "Notify the Site Engineer when their material request has been approved and dispatched.",
  },
  {
    key: "wait_event_time",
    label: "Wait / Timer",
    color: "bg-violet-100 text-violet-800 border-violet-200",
    dot: "bg-violet-500",
    what: "Pauses the workflow until a time duration passes or an external event occurs.",
    when: "When there is a required waiting period or an SLA deadline to enforce.",
    example: "Wait 24 hours. If no response received → auto-escalate to department head.",
  },
  {
    key: "create_linked_followup",
    label: "Create Linked Follow-up",
    color: "bg-sky-100 text-sky-800 border-sky-200",
    dot: "bg-sky-500",
    what: "Starts a child workflow linked to the current one.",
    when: "When completing this work triggers another separate process.",
    example: "Approved PO → automatically start a GRN (Goods Receipt) workflow linked to the PO.",
  },
  {
    key: "escalate",
    label: "Escalate",
    color: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-500",
    what: "Routes the work to a higher authority and raises its urgency.",
    when: "When a deadline is missed, an approval is stuck, or a threshold is exceeded.",
    example: "If not approved within 48 hours, escalate to the Division Director.",
  },
  {
    key: "complete",
    label: "Complete",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot: "bg-emerald-500",
    what: "Marks the workflow instance as successfully finished.",
    when: "At the end of the happy path — all steps done, all approvals received.",
    example: "PO issued, delivery confirmed, GRN signed — workflow complete.",
  },
  {
    key: "cancel",
    label: "Cancel",
    color: "bg-zinc-100 text-zinc-700 border-zinc-200",
    dot: "bg-zinc-400",
    what: "Terminates the workflow instance without completing it.",
    when: "When the work is abandoned, rejected, or no longer needed.",
    example: "Requestor cancels the material request before approval → workflow cancelled.",
  },
];

export function WorkflowGuidePage() {
  return (
    <div className="min-h-screen bg-stone-50 font-body">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/config-studio"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-4"
          >
            ← Back to Config Studio
          </Link>
          <h1 className="font-brand text-3xl font-bold text-zinc-900">Config Studio Guide</h1>
          <p className="mt-2 text-zinc-500 text-base max-w-2xl">
            How to build, connect and publish workflows for your classified catalogue items.
          </p>
        </div>

        {/* Core Concepts */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-4">Core Concepts</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            {[
              {
                term: "Workflow Definition",
                icon: "📐",
                desc: "The template. Defines what steps exist, in what order, with what rules. Think of it as a blueprint that can be used many times.",
              },
              {
                term: "Version",
                icon: "📄",
                desc: "A snapshot of the workflow at a point in time. You always edit a Draft version. Once published, a version is locked.",
              },
              {
                term: "Instance",
                icon: "⚡",
                desc: "One live run of the workflow. Each time a Material Request is submitted, a new instance starts. Instances track real work.",
              },
              {
                term: "Node",
                icon: "⬜",
                desc: "A single step in the workflow — a task, an approval, a decision, a notification. Nodes are the building blocks.",
              },
              {
                term: "Transition",
                icon: "→",
                desc: "An arrow connecting two nodes. It says: after this step, go to that step. Every node needs at least one outgoing transition.",
              },
              {
                term: "Condition",
                icon: "🔀",
                desc: "A rule on a transition that says: only take this path if this is true. Used on branches from an Evaluate Condition node.",
              },
            ].map((c) => (
              <div key={c.term} className="flex gap-3 p-3 rounded-xl bg-stone-50 border border-zinc-100">
                <span className="text-xl flex-shrink-0 mt-0.5">{c.icon}</span>
                <div>
                  <p className="font-semibold text-zinc-800 text-sm">{c.term}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-900 text-sm">
              <strong>The flow:</strong> Definition → create a Draft Version → add Nodes → add Transitions →
              Validate → Publish. Instances are created from published versions.
            </p>
          </div>
        </div>

        {/* 13 Node Types */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-2">All 13 Node Types</h2>
          <p className="text-zinc-500 text-sm mb-5">
            Each node type does a different kind of work. Pick the right one for what needs to happen at that step.
          </p>
          <div className="space-y-3">
            {NODE_TYPES.map((n) => (
              <div key={n.key} className={`rounded-xl border p-4 ${n.color}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${n.dot}`} />
                  <span className="font-semibold text-sm">{n.label}</span>
                  <code className="text-xs opacity-60 font-mono ml-1">{n.key}</code>
                </div>
                <p className="text-sm mb-1">{n.what}</p>
                <p className="text-xs opacity-80">
                  <strong>Use when:</strong> {n.when}
                </p>
                <p className="text-xs opacity-70 mt-1 italic">
                  <strong>Example:</strong> {n.example}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Transitions */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-3">Understanding Transitions</h2>
          <p className="text-zinc-700 mb-3">
            Transitions are the arrows that connect nodes. Without them, the workflow cannot move from one step to
            the next.
          </p>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-xl bg-stone-50 border border-zinc-100">
              <p className="font-medium text-zinc-800 mb-1">From Node Key → To Node Key</p>
              <p className="text-zinc-500">
                Each transition has a source ("from") node and a target ("to") node. The node key is a short
                identifier like <code className="text-xs bg-zinc-100 px-1 py-0.5 rounded">step_1_create_task</code>.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-zinc-100">
              <p className="font-medium text-zinc-800 mb-1">Label (optional)</p>
              <p className="text-zinc-500">
                Give a transition a label to make the diagram readable: "On Approval", "On Rejection", "Low
                Value", "High Value".
              </p>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-zinc-100">
              <p className="font-medium text-zinc-800 mb-1">One in, one or many out</p>
              <p className="text-zinc-500">
                Each node can have multiple outgoing transitions (for branches) but the workflow follows only the
                one whose conditions are met. A <strong>complete</strong> or <strong>cancel</strong> node has no
                outgoing transitions.
              </p>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-3">Understanding Conditions</h2>
          <p className="text-zinc-700 mb-3">
            Conditions let the workflow take different paths based on data values. They always live on a transition
            that leaves an <strong>evaluate_condition</strong> node.
          </p>
          <div className="space-y-3 text-sm mb-4">
            <div className="p-3 rounded-xl bg-yellow-50 border border-yellow-200">
              <p className="font-medium text-yellow-800 mb-1">How a branch works</p>
              <ol className="text-yellow-800 space-y-1 list-decimal list-inside text-xs">
                <li>Add an evaluate_condition node</li>
                <li>Add two transitions from it — one for the True path, one for the False path</li>
                <li>On the True transition, add a condition: field | operator | value</li>
                <li>The False transition has no condition (it is the else/default path)</li>
              </ol>
            </div>
            <div className="p-3 rounded-xl bg-stone-50 border border-zinc-100">
              <p className="font-medium text-zinc-800 mb-2">Operators explained</p>
              <table className="w-full text-xs text-zinc-600">
                <tbody className="divide-y divide-zinc-100">
                  {[
                    ["Equals", "Value is exactly this"],
                    ["Does not equal", "Value is anything else"],
                    ["Greater than", "Number is above this"],
                    ["Less than", "Number is below this"],
                    ["Greater than or equal", "Number is this or above"],
                    ["Less than or equal", "Number is this or below"],
                    ["Contains", "Text includes this string"],
                    ["Is empty", "No value set (leave value blank)"],
                    ["Is not empty", "Some value is present"],
                  ].map(([op, desc]) => (
                    <tr key={op}>
                      <td className="py-1.5 pr-4 font-medium text-zinc-700 w-44">{op}</td>
                      <td className="py-1.5">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
            <strong>Example:</strong> Amount ≥ 10,000 AED needs Director approval.
            <br />
            Condition on True transition: <code className="text-xs bg-amber-100 px-1 py-0.5 rounded">amount</code>{" "}
            <strong>Greater than or equal</strong>{" "}
            <code className="text-xs bg-amber-100 px-1 py-0.5 rounded">10000</code> → route to Director Approval
            node.
          </div>
        </div>

        {/* Walkthrough: Material Request */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-4">
            Step-by-Step: Build a Material Request Workflow
          </h2>
          <ol className="space-y-5">
            {[
              {
                title: "Create a Workflow Definition",
                detail:
                  "Go to Config Studio → click New Workflow. Name it 'Material Request'. Click Create.",
              },
              {
                title: "Open the latest version (Draft)",
                detail:
                  "Click into the definition, then click on the Draft version. This opens the version editor.",
              },
              {
                title: "Add the first node: Collect Form Data",
                detail:
                  "Click Add Step. Type: collect_form_data. Label: 'Fill Material Request Form'. Fields: item_code (text), quantity (number), required_by (date), cost_code (text).",
              },
              {
                title: "Add node 2: Request Approval",
                detail:
                  "Add Step. Type: request_approval. Label: 'PM Approval'. Approver Role: Project Manager.",
              },
              {
                title: "Add node 3: Create Task (for procurement)",
                detail:
                  "Add Step. Type: create_task. Label: 'Issue Purchase Order'. Assigned Role: Procurement Officer.",
              },
              {
                title: "Add node 4: Send Notification",
                detail:
                  "Add Step. Type: send_notification. Label: 'Notify Requestor'. Recipients: requestor. Message: 'Your material request has been approved and is being processed.'",
              },
              {
                title: "Add node 5: Complete",
                detail: "Add Step. Type: complete. Label: 'Workflow Complete'.",
              },
              {
                title: "Add Transitions",
                detail:
                  "Connect the nodes: Step 1 → Step 2 (label: 'Submitted'). Step 2 → Step 3 (label: 'Approved'). Step 3 → Step 4 (label: 'PO Issued'). Step 4 → Step 5.",
              },
              {
                title: "Add a rejection path",
                detail:
                  "Add node 6: type cancel, label 'Rejected'. Add transition from Step 2 → Step 6, label 'Rejected'.",
              },
              {
                title: "Validate and Publish",
                detail:
                  "Click the Validation tab to check for errors. Fix any issues. Then click Publish Version to make it live.",
              },
            ].map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand text-zinc-900 text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-zinc-800">{s.title}</p>
                  <p className="text-zinc-500 text-sm mt-0.5">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Walkthrough: Conditional branch */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-4">
            Step-by-Step: Add a Conditional Branch
          </h2>
          <p className="text-zinc-600 text-sm mb-4">
            Scenario: Approve directly if amount &lt; AED 10,000. Escalate to Director if ≥ AED 10,000.
          </p>
          <ol className="space-y-5">
            {[
              {
                title: "After the form step, add an Evaluate Condition node",
                detail:
                  "Add Step. Type: evaluate_condition. Label: 'Check Amount'. Field to evaluate: amount.",
              },
              {
                title: "Add the PM Approval node (low value path)",
                detail: "Add Step. Type: request_approval. Label: 'PM Approval'. Approver Role: Project Manager.",
              },
              {
                title: "Add the Director Approval node (high value path)",
                detail:
                  "Add Step. Type: request_approval. Label: 'Director Approval'. Approver Role: Division Director.",
              },
              {
                title: "Transition: True path (high value) → Director",
                detail:
                  "Add Transition from Evaluate Condition → Director Approval. Label: 'High Value'. Then add a Condition on this transition: field=amount, operator=Greater than or equal, value=10000.",
              },
              {
                title: "Transition: False path (low value) → PM",
                detail:
                  "Add Transition from Evaluate Condition → PM Approval. Label: 'Low Value'. No condition needed — this is the default path.",
              },
              {
                title: "Continue both paths to Complete",
                detail:
                  "Both approval nodes should have a transition → Complete node on approval, and a transition → Cancel node on rejection.",
              },
            ].map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand text-zinc-900 text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-zinc-800">{s.title}</p>
                  <p className="text-zinc-500 text-sm mt-0.5">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer */}
        <div className="flex gap-3 justify-center py-4">
          <Link
            to="/config-studio"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-zinc-900 font-semibold text-sm hover:bg-brand-dim transition-colors"
          >
            ← Back to Config Studio
          </Link>
          <Link
            to="/catalogue/guide"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-zinc-200 bg-white text-zinc-700 font-semibold text-sm hover:bg-stone-50 transition-colors"
          >
            Catalogue Guide →
          </Link>
        </div>
      </div>
    </div>
  );
}
