import { Link } from "react-router-dom";

export function CatalogueGuidePage() {
  return (
    <div className="space-y-8 pb-16">
      <div className="flex items-center gap-4">
        <Link to="/catalogue" className="text-sm text-zinc-400 hover:text-zinc-600">← Back to Catalogue</Link>
      </div>

      <div>
        <h1 className="font-brand text-2xl font-bold text-zinc-900">Work-Item Catalogue Guide</h1>
        <p className="mt-1 text-sm text-zinc-500">
          How to use the catalogue to classify, configure and connect your organisation's work items to workflows.
        </p>
      </div>

      {/* What is the catalogue */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-brand text-lg font-semibold text-zinc-900">What is the Work-Item Catalogue?</h2>
        <p className="text-sm text-zinc-600 leading-relaxed">
          The catalogue is a master list of every activity, obligation, review and process that your organisation needs
          to manage. It was pre-populated from a 1,308-row Excel workbook covering all departments in a UAE construction
          company. Each row is called a <strong>work item</strong>.
        </p>
        <p className="text-sm text-zinc-600 leading-relaxed">
          A work item on its own is just a description. Your job here is to:
        </p>
        <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-600">
          <li>Assign a <strong>disposition</strong> — what kind of system feature should handle this?</li>
          <li>Set a <strong>priority</strong> and <strong>phase target</strong> so you know what to build first.</li>
          <li>Link a <strong>workflow template</strong> once you've built one in Config Studio.</li>
          <li>Publish it when it's ready to go live.</li>
        </ol>
      </div>

      {/* The 7 dispositions */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-brand text-lg font-semibold text-zinc-900">The 7 Dispositions (What Will Handle This?)</h2>
        <p className="text-sm text-zinc-600">
          A disposition tells the system <em>how</em> to handle a work item. Choose the one that best describes what the
          item actually requires.
        </p>
        <div className="space-y-3 mt-2">
          {[
            {
              name: "Configure workflow",
              count: "~995 items",
              desc: "A step-by-step process that needs to be designed in Config Studio.",
              example: "Review and approve a purchase order → build a workflow with a review step, an approval step and a notification.",
            },
            {
              name: "Configure approval/decision",
              count: "~215 items",
              desc: "A single decision gate (approve/reject) without a full multi-step flow.",
              example: "Site manager approves daily progress report.",
            },
            {
              name: "Track obligation/document",
              count: "~21 items",
              desc: "A regulatory or contractual deadline that must be recorded and monitored.",
              example: "Submit VAT return by 28th of each month.",
            },
            {
              name: "Periodic review/monitor",
              count: "~60 items",
              desc: "A recurring check that does not produce a document or approval decision.",
              example: "Monthly site safety walk-through by the HSE officer.",
            },
            {
              name: "Reference/policy only",
              count: "occasional",
              desc: "The item is a policy reference, not an actionable task. No system feature needed.",
              example: "Employees must not share project drawings externally.",
            },
            {
              name: "Clarify/de-duplicate",
              count: "occasional",
              desc: "The item overlaps with another or needs more information before it can be classified.",
              example: "Two rows that both say 'review drawings' — merge before classifying.",
            },
            {
              name: "Defer",
              count: "~17 items",
              desc: "The item is out of scope for now. It will be revisited in a later phase.",
              example: "Advanced financial reconciliation — defer until Phase 4.",
            },
          ].map((d) => (
            <div key={d.name} className="rounded-xl bg-stone-50 p-4">
              <div className="flex items-baseline gap-3">
                <span className="font-semibold text-zinc-800 text-sm">{d.name}</span>
                <span className="text-xs text-zinc-400">{d.count}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-600">{d.desc}</p>
              <p className="mt-1 text-xs text-zinc-400 italic">Example: {d.example}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Field meanings */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-brand text-lg font-semibold text-zinc-900">What Each Field Means</h2>
        <div className="space-y-3">
          {[
            { field: "Work Item Name", desc: "The short name from the source catalogue. Edit it if needed." },
            { field: "Who is Responsible", desc: "The role or person accountable for this activity." },
            { field: "Description", desc: "A plain-English explanation of what the work item is." },
            { field: "Trigger", desc: "What event causes this activity to start? (e.g. 'On receipt of invoice')" },
            { field: "Action", desc: "The specific step that must be taken." },
            { field: "Output / Evidence", desc: "What document or record proves it was done?" },
            { field: "Timing", desc: "How long should this take, or when must it happen? (e.g. 'Within 2 business days')" },
            { field: "Disposition", desc: "How this item will be handled in the system (see above)." },
            { field: "Status", desc: "draft → under review → approved → published → retired." },
            { field: "Priority", desc: "High / Medium / Low — which items to configure first." },
            { field: "Risk Tier", desc: "Critical / High / Medium / Low — how serious if this step is missed?" },
            { field: "Phase Target", desc: "Which release phase will deliver this item's configuration?" },
            { field: "Configuration Status", desc: "Whether the workflow/approval for this item has been set up yet." },
            { field: "Capability Key", desc: "A dot-separated code that links this item to a system capability (optional)." },
            { field: "Workflow Template", desc: "The workflow you built in Config Studio that implements this item." },
          ].map((f) => (
            <div key={f.field} className="grid grid-cols-[160px,1fr] gap-4 py-2 border-t border-zinc-50 first:border-0">
              <span className="text-xs font-semibold text-zinc-500 pt-0.5">{f.field}</span>
              <span className="text-sm text-zinc-600">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Phase target explained */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-3">
        <h2 className="font-brand text-lg font-semibold text-zinc-900">Why Phase Target?</h2>
        <p className="text-sm text-zinc-600 leading-relaxed">
          You have 1,308 work items and you cannot configure all of them on day one. Phase Target lets you group items
          into delivery milestones so you can see what to build in each quarter:
        </p>
        <ul className="space-y-1 text-sm text-zinc-600">
          <li><strong>Phase 1 – Day 1:</strong> Must-have for go-live (critical compliance, key approvals).</li>
          <li><strong>Phase 2 – Q1:</strong> Important but not blocking (most procurement, HR approvals).</li>
          <li><strong>Phase 3 – Q2:</strong> Secondary operations (site monitoring, reporting).</li>
          <li><strong>Phase 4 – Q3:</strong> Advanced features (AI-assisted reviews, analytics).</li>
          <li><strong>Defer:</strong> Out of scope entirely for this implementation.</li>
        </ul>
        <div className="mt-2 rounded-xl bg-brand-soft p-4 text-sm text-zinc-700">
          <strong>Tip:</strong> Start by setting Phase Target for all "Configure workflow" and "Configure approval/decision"
          items. Filter by disposition → set phase target in bulk by editing items one by one, using the highest-priority
          ones first.
        </div>
      </div>

      {/* How to set up */}
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="font-brand text-lg font-semibold text-zinc-900">Step-by-Step: Setting Up a Work Item</h2>
        <ol className="space-y-4">
          {[
            {
              step: "1. Find the item",
              desc: "Use the search box or filter by department/disposition. Click Edit on the row you want to configure.",
            },
            {
              step: "2. Check the source information",
              desc: "Review the Work Item Name, Description, Trigger, Action and Output/Evidence fields. Correct anything that is wrong or missing — these fields feed into your workflow documentation.",
            },
            {
              step: "3. Set the disposition",
              desc: "If it needs a step-by-step process, choose 'Configure workflow'. If it's just an approve/reject, choose 'Configure approval/decision'.",
            },
            {
              step: "4. Set Priority, Risk Tier and Phase Target",
              desc: "These three fields drive your implementation roadmap. High Priority + Critical Risk + Phase 1 means build it first.",
            },
            {
              step: "5. Build the workflow",
              desc: "Go to Config Studio (sidebar → Config Studio) and create a Workflow Definition. Design the steps, add nodes and publish a version.",
            },
            {
              step: "6. Link the workflow",
              desc: "Come back here, click Edit on the work item, and select the workflow you just built from the Workflow Template dropdown.",
            },
            {
              step: "7. Publish",
              desc: "Change the Status to 'published'. This signals that the configuration is complete and the item is live in the system.",
            },
          ].map((s) => (
            <div key={s.step} className="flex gap-4">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-zinc-900">
                {s.step[0]}
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">{s.step}</p>
                <p className="mt-0.5 text-sm text-zinc-600">{s.desc}</p>
              </div>
            </div>
          ))}
        </ol>
      </div>

      {/* Link to Config Studio Guide */}
      <div className="rounded-2xl border border-brand/30 bg-brand-soft p-6">
        <h3 className="font-brand text-base font-semibold text-zinc-900">Ready to build a workflow?</h3>
        <p className="mt-1 text-sm text-zinc-600">
          The Config Studio Guide explains nodes, conditions, transitions and how to design a complete approval flow.
        </p>
        <Link
          to="/config-studio/guide"
          className="mt-3 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-brand-dim"
        >
          Open Config Studio Guide →
        </Link>
      </div>
    </div>
  );
}
