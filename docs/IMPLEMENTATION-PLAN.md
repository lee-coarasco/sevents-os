# SEVENTS Construction ERP — Generic Architecture Implementation Plan

**Version:** 2.1 — UAE-first deployment, country-agnostic architecture  
**Date:** 13 October 2026  
**Purpose:** Executable delivery plan for AI-assisted development based on the configuration-first Master BRD.

## 1. Architecture decision (locked baseline)

Build reusable construction ERP capabilities, a generic configuration studio/workflow runtime, and a controlled AI agent framework. Do not build 1,308 separate features. The work-item catalogue supplies business configuration and traceability; it does not dictate module boundaries.

### Stable software capabilities

- Identity, tenant/company, departments, roles, permissions and authority.
- Projects, clients, contracts, documents, engineering, procurement, stores, site operations, quality/safety, finance and closeout.
- Generic tasks, approvals, evidence, notifications, audit and reporting.
- Configuration lifecycle, workflow runtime and policy evaluation.
- AI gateway, retrieval, agent registry, tool execution and evaluation.

### Changeable configuration data

- Department/role mappings; work-item definitions and dispositions.
- Triggers, assignments, supported action steps, output/evidence rules, SLAs, dependencies, handoffs and escalation.
- Approval thresholds and routes, project-type variations, notification templates and agent permissions.

## 1A. Multi-country architecture and initial UAE profile

SEVENTS is a UAE-based company. The product baseline must not assume India, INR or GST. Use a country-agnostic core with versioned localization packs and legal-entity-level configuration; configure UAE as the first target profile.

Required implementation decisions:
- Model tenant/company, legal entity, branch, project/site and transaction jurisdiction separately.
- Keep country-specific tax, invoice, statutory ID, fiscal calendar, currency, date/number format, language, unit and compliance rules in configuration/localization packs.
- Implement a generic tax service. GST must not be mandatory. Support configurable tax types such as VAT, GST, sales tax and withholding/retention where relevant.
- For the UAE profile, make VAT configurable but do not assume SEVENTS is registered or apply a default tax rate until finance/tax owners confirm the company’s position and transaction treatment. UAE VAT rules and registration obligations require validation by qualified UAE advisers and official guidance.
- Keep corporate tax reporting separate from transaction-level VAT/GST calculations. Do not claim automatic statutory filing without a separately scoped and validated integration.
- Snapshot jurisdiction, tax code/rule version, currency and calculated amounts on posted transactions. Do not silently recalculate historical posted documents after a rules change.
- Add regression tests for no-tax, tax-inclusive, tax-exclusive, exempt/zero-rated and jurisdiction-specific cases only where the chosen localization pack supports them.
- Mark unsupported jurisdiction-specific compliance as a gap; configuration cannot replace a new calculation, report, integration or expert legal review when required.

Phase 0 must confirm SEVENTS’ legal entities, UAE VAT registration status, accounting basis, invoice requirements, fiscal year, reporting currency, project/contract footprint and any other countries of operation. Do not block generic core development on unresolved rates, but block activation of consequential tax posting until approved.

## 2. Catalogue operating model

Import source workbook rows without losing raw fields. Maintain source and normalized records separately. Each row is triaged as one of: Configure workflow; Configure approval/decision; Track obligation/document; Periodic review/monitor; Reference/policy only; Clarify/de-duplicate; Defer.

Minimum operational contract for actionable items:

1. Trigger / entry condition.
2. Responsible canonical role or assignment rule.
3. Action mapped to an existing capability/step type.
4. Output/evidence and closure criteria.
5. SLA/timing or explicitly approved no-SLA rule.
6. Handoff/dependency and next owner.
7. Exception/escalation.
8. Risk tier, required permissions, approval policy and version.

Long governance/SOP fields are searchable reference context. Source reviewer columns are provenance only. Do not invent undocumented values.

## 3. Phased delivery roadmap

### Phase 0 — Discovery and configuration design

**Deliverables:** baseline metrics; pilot project type; canonical role map; catalogue import; classification/disposition workbook; configuration schema; high-priority workflow list; decisions/open questions.

**Exit criteria:** every source row imported and traceable; classification status visible; top workflows selected with process owners; unknown SLAs and authority limits flagged; no claim that every item is ready to execute.

### Phase 1 — Secure platform foundation

**Build:** repo/CI, environments, authentication, tenant/company, department/role model, permissions, audit, master data, project register, file metadata/storage.

**Exit criteria:** authorization tests pass; tenant isolation tested; audit captures sensitive changes; basic project and user administration works.

### Phase 2 — Configuration studio and workflow runtime

**Build:** raw source import; normalized catalogue; dispositions; role mapping; workflow schema; supported step types; deterministic condition engine; forms/evidence; SLA calendars; approval and escalation policies; simulation; versioned publish/rollback; task queues.

**Exit criteria:** an administrator can add a role and configure a workflow from existing capabilities without code changes; invalid workflow publication is blocked; active instances stay version-pinned; changes are audited.

### Phase 3 — One construction vertical slice

Choose one pilot flow, preferably **material request → procurement review → quotation comparison → approval → purchase order → delivery/GRN → site issue** or another process confirmed by the business owner.

**Build:** end-to-end domain records, role queues, document/evidence, approvals, notifications, audit, exceptions, reporting and acceptance tests. Configuration must drive assignments and transitions.

**Exit criteria:** users complete the flow in a staging environment with realistic sample data; exception and rejection paths work; no duplicate writes on retries; baseline and post-pilot metrics can be compared.

### Phase 4 — Core construction operations

Expand in dependency order: project/WBS/schedule and cost; CRM/tender/estimate; engineering/drawing/RFI; procurement/inventory; site diary/progress; quality/safety; subcontractor/labour; finance/billing/collections; contracts/claims/variations; handover/DLP/closeout.

Each module is a vertical slice with schema, APIs, UI, permissions, audit, migration, tests and user acceptance.

### Phase 5 — Knowledge assistant and document intelligence

Add permission-aware retrieval, citations to source documents/revisions, OCR/extraction, summaries, meeting action extraction and review queues. Extracted data remains draft until validated where consequential.

### Phase 6 — Controlled AI agents

Start in read-only/suggestion mode. Add tools through allowlisted application service APIs. Enable low-risk reversible writes only after evaluations and explicit policy approval. High-risk financial, contractual, legal, engineering and safety actions retain human approval.

### Phase 7 — Cross-department orchestration and ROI

Connect published workflows across departments; surface stalled handoffs and risks; measure time saved, cycle time, rework, cost/margin variance and agent error/override rates. Only enable predictive/limited autonomous behavior where measured reliability and business authorization support it.

## 4. Required configuration objects

- `DepartmentDefinition`, `RoleDefinition`, `RoleMapping`, `RoleAssignment`.
- `SourceCatalogue`, `SourceWorkItem`, `WorkItemDefinition`, `WorkItemVersion`, `WorkItemDisposition`, `WorkItemCapabilityMap`.
- `WorkflowDefinition`, `WorkflowVersion`, `WorkflowNode`, `WorkflowTransition`, `WorkflowInstance`, `WorkflowStepInstance`.
- `SLAProfile`, `ApprovalPolicy`, `EscalationPolicy`, `EvidenceRequirement`, `AgentPolicy`, `AgentToolPermission`.
- `ConfigurationChange`, `ConfigurationValidationRun`, `ConfigurationSimulationRun`, `ConfigurationApproval`, `PublishedConfiguration`, `ConfigurationRollbackEvent`.

Use immutable IDs, tenant/company scope, created/updated metadata, effective dates, audit events and version references. Do not store the only copy of operational rules as free text.

## 5. Supported workflow step types (initial set)

1. Start from business event or schedule.
2. Create/update task using an authorized application service.
3. Assign to role, user, project team or department queue.
4. Collect structured form fields.
5. Request/validate evidence.
6. Evaluate deterministic condition.
7. Request sequential/parallel approval.
8. Send notification/reminder.
9. Wait for event/time/SLA threshold.
10. Call an allowlisted domain service or integration.
11. Create linked follow-up task/obligation.
12. Escalate, pause, resume, reject, cancel or complete.

New combinations of supported steps are configuration. A genuinely new business capability or step type requires code, tests and a versioned release.

## 6. Configuration safety gates

Before publication: schema validation; reference validation; workflow graph checks; unreachable step/circular dependency checks; missing assignee fallback; missing SLA/policy checks; permission analysis; high-risk action checks; simulation of success/reject/timeout/error branches; approval by process owner and required domain approver.

Never permit configuration to disable tenant isolation, audit, server-side authorization, segregation-of-duties controls or required human approvals. Publish immutable versions; rollback affects future instances unless an explicit migration is approved.

## 7. AI coding workflow

For each story, require:

- Requirement ID and configuration/domain capability impacted.
- Design note and data/API contracts.
- UI route and role/permission matrix.
- Migration and rollback plan.
- Unit, integration, contract, permission, workflow-path and relevant AI evaluation tests.
- Evidence from tests and a working end-to-end path.
- Updated `IMPLEMENTATION_STATUS.md`, `DECISIONS.md`, `OPEN_QUESTIONS.md` and `CHANGELOG.md`.

AI coding agents must not invent authority limits, SLA values, tax rules, legal deadlines, approval policies or production data. Do not hard-code GST, INR, India-only identifiers or any country’s statutory requirements into the generic core; use approved localization configuration and tested adapters. They should create `TBD—Business Owner Decision` entries and block consequential activation where needed.

## 8. First release acceptance checklist

- [ ] User, company, department and role administration works with server-side permissions.
- [ ] Catalogue import is repeatable and does not duplicate rows.
- [ ] Raw source values remain intact and source provenance is visible.
- [ ] Items can be classified without creating tasks automatically.
- [ ] New department/role mapping is configured without code changes.
- [ ] Workflow can be created from supported steps, validated, simulated, approved and published.
- [ ] A published version is immutable and auditable.
- [ ] Active workflow instances stay pinned to their original version by default.
- [ ] Missing/uncertain SLA remains unresolved instead of being guessed.
- [ ] Reference-only work items do not create tasks.
- [ ] Human approval gates block high-risk actions.
- [ ] A complete construction workflow works from trigger through evidence and closure.
- [ ] Dashboard reports task aging, SLA breaches, failed handoffs and workflow exceptions.
- [ ] ROI baseline and post-pilot metrics can be compared.

## 9. Decisions to resolve before expanding the pilot

Pilot project type and contract model; canonical organization/role structure; first workflow; approval limits; SLA calendars; accounting scope; UAE localization/tax review and multi-country configuration requirements; integrations; hosting and data residency; user languages/offline needs; retention/security policies; AI model and cost limits; business owners and approvers.
