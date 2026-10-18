import { Link } from "react-router-dom";

const DISPOSITIONS = [
  {
    name: "Configure workflow",
    color: "bg-blue-50 border-blue-200 text-blue-800",
    dot: "bg-blue-500",
    desc: "Automate with a multi-step workflow. Multiple people, multiple steps, approvals in sequence.",
    example: "Material Request → Store Keeper checks stock → PM approves → Procurement issues PO",
    when: "When more than one person is involved and the steps must happen in order.",
  },
  {
    name: "Configure approval/decision",
    color: "bg-purple-50 border-purple-200 text-purple-800",
    dot: "bg-purple-500",
    desc: "A single sign-off or yes/no decision. No multi-step flow needed.",
    example: "Approve subcontractor quote, Sign off on a daily report",
    when: "When only one person needs to say yes/no and there is no handoff chain.",
  },
  {
    name: "Track obligation/document",
    color: "bg-amber-50 border-amber-200 text-amber-800",
    dot: "bg-amber-500",
    desc: "Record that something exists or is in place. No workflow, just a register entry.",
    example: "Insurance certificate on file, Trade licence renewal date",
    when: "When you need to know a document exists or a deadline is approaching.",
  },
  {
    name: "Periodic review/monitor",
    color: "bg-green-50 border-green-200 text-green-800",
    dot: "bg-green-500",
    desc: "A recurring review task — monthly, quarterly, or annually.",
    example: "Monthly safety walkthrough, Quarterly cost-to-complete review",
    when: "When the same check repeats on a schedule.",
  },
  {
    name: "Reference/policy only",
    color: "bg-zinc-50 border-zinc-200 text-zinc-700",
    dot: "bg-zinc-400",
    desc: "No action required. This is documentation or a policy reference.",
    example: "Company HSE Policy, Site access rules",
    when: "When the item is purely informational — no task, no approval, no workflow.",
  },
  {
    name: "Clarify/de-duplicate",
    color: "bg-orange-50 border-orange-200 text-orange-800",
    dot: "bg-orange-500",
    desc: "This item needs more discussion before it can be classified.",
    example: "Overlapping responsibilities between Site Engineer and QC Engineer",
    when: "When you are unsure of the scope or it overlaps with another item.",
  },
  {
    name: "Defer",
    color: "bg-slate-50 border-slate-200 text-slate-600",
    dot: "bg-slate-400",
    desc: "Not in scope for the current phase. Come back later.",
    example: "Complex insurance claims process — defer until Phase 4",
    when: "When it is real work but not a priority for the current rollout phase.",
  },
];

const FIELDS = [
  {
    field: "Work Item Name",
    meaning: "Short, action-oriented name for the work procedure",
    example: "Issue Material Request",
  },
  {
    field: "Department",
    meaning: "The department that owns or initiates this work",
    example: "Site Operations",
  },
  {
    field: "Who is Responsible",
    meaning: "The role (not person) primarily responsible",
    example: "Site Engineer",
  },
  {
    field: "Description",
    meaning: "Plain-language summary of what this work involves",
    example: "Raise a material request form when stock falls below minimum levels on site",
  },
  {
    field: "Trigger",
    meaning: "What event or condition starts this work?",
    example: "Stock level drops below 20% of minimum requirement",
  },
  {
    field: "Action",
    meaning: "What must be done? The core activity.",
    example: "Fill in MRF with item code, quantity, required date, and cost code; submit for approval",
  },
  {
    field: "Output / Evidence",
    meaning: "What is produced? The deliverable or proof of completion.",
    example: "Signed MRF with PM approval, attached to the procurement record",
  },
  {
    field: "Timing",
    meaning: "When does this happen or how long should it take?",
    example: "Within 24 hours of identifying the shortage",
  },
  {
    field: "Disposition",
    meaning: "How should this work item be configured in the system? (See section below)",
    example: "Configure workflow",
  },
  {
    field: "Priority",
    meaning: "Relative importance for the configuration team to set up first",
    example: "High",
  },
  {
    field: "Risk Tier",
    meaning: "Business risk if this process is missed or done incorrectly",
    example: "Critical — site stoppage if materials run out",
  },
  {
    field: "Phase Target",
    meaning: "Which rollout phase should this be live in?",
    example: "Phase 1 – Day 1",
  },
  {
    field: "Configuration Status",
    meaning: "Has this work item been set up in the system? (Unconfigured / In Progress / Configured)",
    example: "In Progress",
  },
];

const PHASES = [
  {
    phase: "Phase 1 – Day 1",
    color: "bg-red-50 border-red-200 text-red-800",
    desc: "Must be live before go-live. Core operations cannot run without these.",
    example: "Material requests, daily site report, subcontractor attendance",
  },
  {
    phase: "Phase 2 – Q1",
    color: "bg-amber-50 border-amber-200 text-amber-800",
    desc: "Target the first quarter after go-live.",
    example: "Variation orders, client billing, site inspection checklists",
  },
  {
    phase: "Phase 3 – Q2",
    color: "bg-blue-50 border-blue-200 text-blue-800",
    desc: "Second quarter. Important but not blocking.",
    example: "HR performance reviews, quarterly forecasts, trade licence renewals",
  },
  {
    phase: "Phase 4 – Q3",
    color: "bg-green-50 border-green-200 text-green-800",
    desc: "Third quarter or later in the year.",
    example: "Complex insurance claims, advanced analytics dashboards",
  },
  {
    phase: "Defer",
    color: "bg-zinc-50 border-zinc-200 text-zinc-600",
    desc: "No target date yet. Park it for later.",
    example: "Processes still being defined by management",
  },
];

export function CatalogueGuidePage() {
  return (
    <div className="min-h-screen bg-stone-50 font-body">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/catalogue"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-4"
          >
            ← Back to Catalogue
          </Link>
          <h1 className="font-brand text-3xl font-bold text-zinc-900">Work Item Catalogue Guide</h1>
          <p className="mt-2 text-zinc-500 text-base max-w-2xl">
            Everything you need to know to classify and configure the 1,308 work procedures in your construction
            company.
          </p>
        </div>

        {/* Section 1: What is the catalogue */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-3">What is the Work Item Catalogue?</h2>
          <p className="text-zinc-700 mb-3">
            The catalogue is the <strong>master list of every work procedure</strong> your company must perform —
            1,308 items covering all departments. Each item is one piece of work, from "Issue Material Request" to
            "Approve Subcontractor Invoice" to "Conduct Monthly Safety Audit".
          </p>
          <p className="text-zinc-700 mb-3">
            Before you can automate anything in SEVENTS, you first <strong>classify</strong> each item: decide what
            type of work it is (the <em>Disposition</em>), how urgent it is to configure (<em>Priority</em> and{" "}
            <em>Phase Target</em>), and how risky it is if it goes wrong (<em>Risk Tier</em>).
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
            <p className="text-amber-900 text-sm font-medium">
              💡 Think of the catalogue as a blueprint. You read through it, mark up each item, and then the
              configuration work begins — building workflows, approvals, and trackers for each classified item.
            </p>
          </div>
        </div>

        {/* Section 2: Field reference */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-4">Understanding Each Field</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400 w-36">
                    Field
                  </th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    What it means
                  </th>
                  <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Construction example
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {FIELDS.map((f) => (
                  <tr key={f.field}>
                    <td className="py-3 pr-4 font-medium text-zinc-800 align-top">{f.field}</td>
                    <td className="py-3 pr-4 text-zinc-600 align-top">{f.meaning}</td>
                    <td className="py-3 text-zinc-500 italic align-top">{f.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Dispositions */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-2">The 7 Dispositions</h2>
          <p className="text-zinc-500 text-sm mb-5">
            The disposition tells the system <em>how</em> to handle this work item. Choose the one that best matches
            the nature of the work.
          </p>
          <div className="space-y-4">
            {DISPOSITIONS.map((d) => (
              <div key={d.name} className={`rounded-xl border p-4 ${d.color}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${d.dot}`} />
                  <span className="font-semibold text-sm">{d.name}</span>
                </div>
                <p className="text-sm mb-1.5">{d.desc}</p>
                <p className="text-xs opacity-80">
                  <strong>Example:</strong> {d.example}
                </p>
                <p className="text-xs opacity-70 mt-1">
                  <strong>Use when:</strong> {d.when}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Phase Target */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-2">Phase Target Explained</h2>
          <p className="text-zinc-500 text-sm mb-5">
            The Phase Target tells the configuration team <em>when</em> this item must be ready. Not everything needs
            to go live on Day 1.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {PHASES.map((p) => (
              <div key={p.phase} className={`rounded-xl border p-4 ${p.color}`}>
                <p className="font-semibold text-sm mb-1">{p.phase}</p>
                <p className="text-xs mb-1.5">{p.desc}</p>
                <p className="text-xs opacity-75 italic">{p.example}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: How to classify */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-4">
            Step-by-Step: How to Classify a Work Item
          </h2>
          <ol className="space-y-4">
            {[
              {
                step: "Open the Catalogue page",
                detail:
                  "Go to Catalogue in the sidebar. You will see the full list of work items. Use the filters to narrow by department or disposition.",
              },
              {
                step: 'Click a row to open the edit panel',
                detail:
                  "Click anywhere on a row to open the detail panel on the right. All fields are editable.",
              },
              {
                step: "Read the description, trigger, and action",
                detail:
                  "Understand what the work item involves before classifying it. If the description is vague, update it.",
              },
              {
                step: "Set the Disposition",
                detail:
                  "Choose from the 7 dispositions. Most items (about 995) will be 'Configure workflow' or 'Configure approval/decision'.",
              },
              {
                step: "Set Priority, Risk Tier, and Phase Target",
                detail:
                  "Use High/Medium/Low for priority. Risk Tier reflects business impact. Phase Target controls when it goes live.",
              },
              {
                step: "Save and move to the next item",
                detail:
                  "The panel saves when you click Save. Work through department by department.",
              },
              {
                step: "Build the workflow (for 'Configure workflow' items)",
                detail:
                  "Once classified, go to Config Studio to build the actual workflow. Then come back and set the Workflow Template ID on the work item.",
              },
            ].map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-brand text-zinc-900 text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-zinc-800">{s.step}</p>
                  <p className="text-zinc-500 text-sm mt-0.5">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Section 6: Link to workflows */}
        <div className="rounded-2xl border border-zinc-100 bg-white shadow-sm p-6 mb-6">
          <h2 className="font-brand text-xl font-semibold text-zinc-900 mb-3">
            How the Catalogue Links to Workflows
          </h2>
          <p className="text-zinc-700 mb-4">
            A work item with <strong>Disposition = "Configure workflow"</strong> needs a real workflow built for it.
            Here is how the two connect:
          </p>
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            {[
              {
                label: "1. Classify",
                sub: "Set Disposition = Configure workflow on the work item",
                icon: "📋",
              },
              {
                label: "2. Build",
                sub: "Go to Config Studio → New Workflow Definition → design the steps",
                icon: "⚙️",
              },
              {
                label: "3. Link",
                sub: "Come back to the catalogue, open the work item, set Workflow Template ID",
                icon: "🔗",
              },
              {
                label: "4. Publish",
                sub: "Publish the workflow version. The work item is now fully configured.",
                icon: "✅",
              },
            ].map((step) => (
              <div
                key={step.label}
                className="flex-1 rounded-xl border border-zinc-100 bg-stone-50 p-4 text-center"
              >
                <div className="text-2xl mb-2">{step.icon}</div>
                <p className="font-semibold text-zinc-800 text-sm">{step.label}</p>
                <p className="text-zinc-500 text-xs mt-1">{step.sub}</p>
              </div>
            ))}
          </div>
          <p className="text-zinc-500 text-sm mt-4">
            Once linked, the system knows which workflow template to launch when that work item is triggered. You can
            see the link in the Catalogue under the "Workflow" column.
          </p>
          <div className="mt-4">
            <Link
              to="/config-studio/guide"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-700 hover:text-zinc-900 underline"
            >
              Read the Config Studio Guide →
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <Link
            to="/catalogue"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand text-zinc-900 font-semibold text-sm hover:bg-brand-dim transition-colors"
          >
            ← Back to Catalogue
          </Link>
        </div>
      </div>
    </div>
  );
}
