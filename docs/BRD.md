# SEVENTS — Agentic Construction ERP
## Master Business Requirements Document (BRD), Configuration Architecture and AI Development Specification

**Document status:** Revised baseline for AI-assisted implementation  
**Version:** 2.1 — Generic, configuration-driven, multi-jurisdiction architecture  
**Date:** 13 October 2026  
**Product type:** Construction-industry ERP + workflow automation + agentic AI  
**Working product name:** SEVENTS (confirm branding before production)  
**Initial deployment profile:** SEVENTS, a UAE-based construction business. **Product architecture:** country-agnostic, multi-company and multi-jurisdiction; UAE localization is the initial configuration profile. GST is not a default requirement. UAE VAT and other tax regimes are configurable and enabled only according to the legal entity’s confirmed tax profile.

---

# 1. Executive Summary

SEVENTS is a construction-specific operating platform built from scratch. It brings the full construction business lifecycle into one system: opportunity intake, bid/no-bid, estimation, contract award, technical engineering, project mobilisation, procurement, inventory, site progress, quality, safety, subcontractors, finance, billing, collections, legal obligations, handover, defects-liability period (DLP) and closeout.

The product combines:
1. A dependable ERP system of record.
2. A configurable workflow and approval engine.
3. A versioned, configurable work-item and process catalogue seeded from the supplied 1,308 work items; the catalogue configures the system and does not define the software architecture.
4. A permission-aware company knowledge assistant.
5. Specialized AI agents that use controlled tools to prepare, check, coordinate, recommend, remind and execute approved low-risk actions.
6. An executive control tower that highlights exceptions, risks, cash, margin and decisions requiring attention.

**Non-negotiable design principle:** AI is an assistant and controlled operator, not the source of truth. All business writes must pass through validated application services, permissions, workflow rules, approval requirements and audit logging. Human approval is mandatory for decisions defined as financial, contractual, engineering-signoff, legal settlement, safety-critical or ownership-level.

## 1.1 Product outcomes

- Reduce manual coordination, duplicate data entry and status chasing.
- Improve project visibility and schedule predictability.
- Protect project margin through cost, procurement, variation and claims controls.
- Accelerate invoice submission and collection follow-up.
- Improve document/version control and auditability.
- Make company processes understandable and executable, not just documented.
- Give management one trusted view of company operations.
- Enable new agents to be added without rebuilding the ERP.

## 1.2 What success means

Measure results against a baseline collected during pilot:
- Administrative hours per project per week.
- On-time completion of work items and milestones.
- RFI and approval cycle time.
- Purchase price variance and emergency purchasing.
- Invoice submission lag and receivable days.
- Variations identified vs approved/claimed.
- Rework/NCR closure time.
- Forecast cost and margin accuracy.
- Percentage of work items with complete evidence.
- Agent suggestion acceptance, error rate, cost per successful task and human override rate.

Do not promise savings before the baseline and pilot results are measured.

---

# 2. Product Vision, Scope and Principles

## 2.1 Vision

Create one easy-to-use operating system for construction businesses where employees work through clear role-based queues, workflows connect departments, and AI agents remove repetitive administration while preserving accountability.

## 2.2 Product principles

1. **Construction-first UX:** project, site, drawing, BOQ, material, contractor, billing and approval are first-class concepts.
2. **One source of truth:** do not create separate unlinked records for the same project, client, vendor, document or financial commitment.
3. **Role-first experience:** show each employee the work, decisions and risks relevant to their role.
4. **Workflow before autonomy:** first digitize and stabilize a process; then automate deterministic steps; then add AI assistance; only then enable limited autonomous execution.
5. **Evidence-based AI:** important AI outputs must cite the source record/document and its version.
6. **Human accountability:** named people remain accountable for approvals and regulated or safety-critical decisions.
7. **Auditability:** preserve who did what, when, under which authority, using which data and agent version.
8. **Idempotent execution:** retries must not create duplicate purchase orders, invoices, messages, tasks or payments.
9. **Configuration-first:** departments, role mappings, workflow templates, triggers, actions, SLAs, approval policies, evidence rules and escalations are configuration data, not hard-coded branches.
10. **Capability-first architecture:** stable construction capabilities define modules; changeable work-item rows define how the modules are used.
11. **Safe configuration:** draft, validate, simulate, approve, publish, version, rollback and audit configuration changes.
12. **Progressive delivery:** ship a usable MVP before building advanced predictive intelligence.
13. **Mobile-first field workflows:** site users often have limited time, connectivity and small screens.
14. **AI vendor independence:** isolate model providers behind an AI gateway.

## 2.3A Multi-country and jurisdiction architecture (mandatory)

SEVENTS is initially being configured for a UAE-based construction company, but the product must remain usable by construction companies in other countries without forking the codebase. Country-specific behavior belongs in versioned localization/compliance packs and legal-entity configuration, not in hard-coded global business logic.

### Required configuration hierarchy
1. Platform defaults: neutral formats and generic capabilities; no country-specific tax assumption.
2. Tenant/company: business identity, preferred language, reporting preferences and enabled modules.
3. Legal entity/branch: country, jurisdiction, tax registrations, accounting settings, fiscal year, base currency and statutory identifiers.
4. Project/site: location, project currency if applicable, local site calendar, units, applicable contract/compliance profile.
5. Transaction/document: immutable snapshot of the relevant entity, jurisdiction, currency, tax treatment and rule/version used at creation or posting.

### Localization and compliance pack
A localization pack may define country/jurisdiction identifiers, currencies and precision, tax types and codes, invoice numbering/mandatory fields, tax registration identifiers, fiscal calendars, date/number formats, languages, units, statutory report mappings and supported integrations. Packs must be versioned, testable, reviewable and explicitly activated by an authorized administrator. Changes must not silently recalculate posted historical transactions.

### Tax architecture — GST must not be assumed
- Do not include GST as a mandatory field or default tax type for SEVENTS.
- Build a generic tax model supporting configurable tax types (for example VAT, GST, sales tax, withholding/retention taxes and reverse-charge treatment where applicable), tax codes, effective dates, jurisdiction, taxable base, inclusive/exclusive pricing, exemptions/zero-rating, recoverability, rounding, tax registration details and transaction-level overrides with authorization.
- For the initial UAE profile, support VAT configuration and UAE tax-invoice fields. Do not assume SEVENTS is VAT-registered, that every transaction is taxable, or that one tax rate applies universally. Tax rates, registration status, exemptions, treatment and filing requirements must be confirmed by SEVENTS finance/tax owners and qualified UAE advisers before activation.
- Corporate tax and income tax are not sales-tax line items. Provide accounting/reporting support through configurable chart-of-accounts mappings, tax-period schedules and report exports; do not promise automated statutory filing unless a validated integration is separately scoped.
- Keep tax calculation rules in a tested tax service or provider adapter. Store the applied tax code/rule version and calculated amounts on the transaction for audit and reproducibility.
- If tax treatment is unknown or the required registration/configuration is missing, flag for finance review rather than silently applying a default rate.

### Country portability acceptance criteria
- A company can be configured for UAE without GST fields being required.
- An authorized administrator can configure another country’s tax types, currencies, date formats, fiscal calendar, statutory IDs and invoice fields without modifying core construction workflows, where supported by existing configuration capabilities.
- A new legal rule that requires a genuinely new calculation, statutory report or integration may require a versioned localization-pack/code release; the platform must not claim every country is fully compliant by configuration alone.
- Separate legal entities in different jurisdictions can coexist in one tenant when permitted by the deployment and data-residency design, with strict access and reporting boundaries.
- Posted documents retain their original tax/jurisdiction snapshots; later configuration changes affect future transactions unless an authorized correction process is used.

## 2.3 In scope

- Construction ERP core modules listed in Section 7.
- Import, classification, validation, versioning and configuration of the 1,308-row source catalogue.
- Generic configuration administration for departments, roles, role assignments, work-item definitions, workflow templates, triggers, actions, outputs/evidence, SLAs, handoffs, approval policies, escalation policies and agent permissions.
- A safe configuration lifecycle: draft → validate → simulate → review/approve → publish → monitor → supersede/rollback.
- Work-item-to-capability mapping and source traceability.
- Role-based access and authority matrix.
- Projects, sales, engineering, procurement, stores, site, quality, safety, finance, billing, contracts and HR workflows.
- Document and drawing control.
- AI knowledge assistant and agent framework.
- Management dashboards, audit, reports, notifications and integrations.
- Multi-company/tenant-ready data model.
- Multi-jurisdiction localization framework with UAE as the initial deployment profile; country, emirate/state/province, legal entity, currency, language, timezone, tax registrations, tax codes, invoice requirements, calendars and statutory settings are configuration—not hard-coded assumptions.

## 2.4 Out of scope for initial MVP

- Fully autonomous contract signing, bank transfers, payroll release or purchase commitments.
- AI making final structural/design approvals.
- AI making safety-critical decisions or authorizing work permits.
- Replacing professional engineering, legal, tax or safety judgement.
- Advanced BIM authoring or full CAD replacement.
- Building a proprietary foundation model.
- Native iOS/Android apps before the PWA has validated the workflows.
- Automatic scraping of external vendor/market data without approved integrations and terms.
- Full general-purpose ERP for unrelated industries.

---

# 3. Users, Personas and Access Model

## 3.1 Primary personas

- Chairman/Owners: ownership decisions, reserved matters, enterprise risk and strategic outcomes.
- CEO: company-wide performance, executive accountability, strategic decisions and escalations.
- COO/Operations Head: project delivery, resources, delivery exceptions and operational recovery.
- CTO/Technical Engineering Head: design standards, technical governance, technical risk and design approvals.
- CFO/Finance Head: budget, cash, commitments, invoices, collections, financial controls and forecasts.
- Department Head: team workload, approvals, KPIs, capacity and exceptions.
- Project Manager: scope, schedule, cost, resources, risks, client and project closeout.
- Site Manager/Site Engineer: daily progress, manpower, materials, site instructions, inspections and blockers.
- Architect/Design Engineer/Discipline Lead: briefs, drawings, revisions, design coordination, RFIs and technical records.
- Estimator/Commercial Manager: BOQ, tender pricing, margins, variations and commercial exposure.
- Procurement Manager/Buyer: RFQs, vendors, comparisons, POs and deliveries.
- Storekeeper: receipts, stock, issues, transfers and reconciliation.
- QA/QC Engineer: inspection plans, tests, NCRs and corrective actions.
- Safety Officer: inductions, permits, observations, incidents and compliance.
- HR/People & Culture: recruitment, employee records, skills, training and workforce planning.
- Legal/Contracts Manager: obligations, notices, claims, disputes, licenses and deadlines.
- Finance Executive/Accountant: invoices, bills, reconciliations, ageing and payment preparation.
- Document Controller: document register, revisions, transmittals, distribution and retention.
- Vendor/Subcontractor: restricted portal for assigned RFQs, documents, delivery status, work measurement and invoices, subject to later-phase scope.
- Client/Consultant: restricted portal for submissions, approvals, progress, claims and handover, subject to later-phase scope.
- Platform Administrator: technical configuration, integrations, tenant support and security operations.

## 3.2 Authorization model

Implement RBAC plus contextual policies:
- Role and permission.
- Company/tenant.
- Department.
- Project membership.
- Record ownership and sensitivity.
- Approval amount/value band.
- Status and workflow stage.
- Delegation validity period.
- Conflict-of-interest restrictions.

Examples:
- A Site Engineer may create a material request but cannot approve a purchase above their configured limit.
- A buyer cannot approve their own vendor award when segregation of duties applies.
- A project team cannot access another project’s confidential documents unless explicitly authorized.
- An agent inherits the requesting user's access scope and must not widen it.
- Sensitive legal, HR, salary and ownership records require explicit permissions.

Every authorization decision must be enforced server-side, not only by hiding UI controls.

---

# 4. Core Business Lifecycle

The platform should support the following configurable lifecycle:

1. Lead/opportunity created.
2. Client and opportunity qualification.
3. Site visit and requirement capture.
4. Technical feasibility and constraints review.
5. Tender/bid decision.
6. Estimate, BOQ, commercial assumptions and risk review.
7. Bid approval and submission.
8. Negotiation and contract review.
9. Contract award and project creation.
10. Sales-to-technical and technical-to-project handover.
11. Project baseline: scope, WBS, schedule, budget, team and risk register.
12. Design brief, surveys, design development and interdisciplinary coordination.
13. Authority submissions, permits and approvals.
14. IFC/construction-ready release.
15. Procurement plan, requisitions, RFQs, evaluation and purchase orders.
16. Material receipt, inspection, inventory and issue to site.
17. Site mobilisation, daily progress, labour/equipment and field coordination.
18. QA/QC, safety, inspections, RFIs and non-conformances.
19. Progress measurement, client billing, vendor bills and cash forecasting.
20. Variations, claims, EOT and contract notices.
21. Project recovery, changes, risk and management reviews.
22. Practical completion, testing/commissioning, as-built records and handover.
23. DLP/defect tracking and retention follow-up.
24. Final account, asset/document handover and project closeout.
25. Lessons learned, final profitability review and archive.

This is a target lifecycle, not a rigid sequence. Some projects omit or reorder stages. Workflow templates must be configurable by project type and contract model.

---

# 5. System Architecture

## 5.1 Recommended stack

- Frontend: Next.js + React + TypeScript.
- UI: Tailwind CSS + shadcn/ui; accessible components and responsive layouts.
- Backend: NestJS + TypeScript modular monolith with versioned REST APIs.
- Primary database: PostgreSQL.
- Vector retrieval: pgvector initially; add a dedicated search engine only if justified.
- Cache/rate limiting: Redis.
- Durable workflow orchestration: Temporal.
- AI services: Python + FastAPI for document processing, evaluation and specialized AI pipelines.
- Agent framework: LangGraph or a comparable graph-based agent runtime behind an internal abstraction.
- LLM provider: configurable provider adapter; no provider-specific logic in domain modules.
- Object storage: S3-compatible object storage.
- Search: PostgreSQL full-text initially.
- Background work: Temporal workers; use a queue for independent async jobs where needed.
- Observability: OpenTelemetry, centralized logs/metrics/traces, error tracking.
- Authentication: managed OIDC provider or Keycloak; MFA for privileged roles.
- CI/CD: GitHub Actions, automated tests, migration checks and deployment gates.
- Hosting: AWS managed services initially; do not require Kubernetes for MVP.
- Deployment: Dockerized services, separate dev/staging/production environments.
- API docs: OpenAPI/Swagger generated from the backend.

Exact cloud sizes, model provider and service choices must be confirmed against expected user count, budget, data residency and client IT policy.

## 5.2 Logical architecture

Web/PWA → API gateway/edge → NestJS application → PostgreSQL / object storage / Redis → Temporal workflows and workers → AI gateway and Python services → approved external integrations.

All agent tool calls must go through application service APIs. Agents must never have direct database write credentials.

## 5.3 Backend module boundaries

Keep a modular monolith initially. Suggested domain modules:
- identity-access
- organization
- master-data
- work-items
- workflows
- tasks
- approvals
- clients-crm
- tenders-estimation
- projects
- engineering-documents
- procurement
- inventory
- site-operations
- quality-safety
- subcontractors-labour
- finance
- billing-collections
- contracts-claims
- people
- equipment
- communications
- knowledge-ai
- agent-runtime
- reports-analytics
- integrations
- audit-compliance
- platform-admin

Modules communicate through explicit services and domain events, not arbitrary cross-module database writes.

## 5.4 Configuration-first architecture (foundational requirement)

The platform must be built around reusable business capabilities and a generic configuration engine. The supplied catalogue is an input for configuration, not a list of 1,308 hard-coded features. The system must support new departments, roles, work items and workflow variants through authorised configuration wherever the underlying capabilities already exist.

### 5.4.1 Configuration domains

1. **Organization configuration:** departments, teams, role definitions, reporting relationships, project membership, acting roles, effective dates and role assignments.
2. **Work-item configuration:** source reference, display title, purpose/reference text, trigger, responsible role, action, expected output/evidence, SLA/timing, dependencies/handoff, escalation, applicable project type, required permissions, risk tier and disposition.
3. **Workflow configuration:** start trigger, entry criteria, steps, branching conditions, task creation, assignments, forms, evidence gates, approval steps, timers, retries, exception paths, cancellation, closure and compensation actions.
4. **Policy configuration:** approval matrices, amount/value bands, segregation-of-duties rules, escalation chains, required fields, document requirements and allowed agent actions.
5. **Agent configuration:** enabled agents, eligible workflows, tool allowlists, permission scope, risk tier, autonomy mode, human approval gates, budgets, rate limits and fallback behavior.
6. **Reference configuration:** statuses, priority rules, project types, document types, cost codes, units, notification templates and local settings.

### 5.4.2 Configuration lifecycle

- Create/edit only in Draft; record author, reason and change ticket/reference.
- Validate required fields, role references, workflow graph integrity, missing transitions, circular dependencies, impossible SLA conditions, unsafe agent permissions and approval-policy conflicts.
- Simulate against representative sample cases and show expected paths, assignments, timers and outputs.
- Require an authorized process owner to approve publication; high-risk financial, contractual, safety or engineering configurations need designated specialist approval.
- Publish an immutable version with effective date, scope and rollback pointer.
- New workflow instances use the published version selected at start. Existing instances remain pinned unless an explicit, audited migration is run.
- Rollback means publish a previous configuration version for future instances; never erase historical versions or rewrite completed approvals.
- Record all changes in an audit trail and show a human-readable diff.

### 5.4.3 Generic workflow runtime contract

A workflow definition must be data-driven and use a finite set of supported step types, including: create task; assign role/user; collect form data; request/upload evidence; evaluate a deterministic condition; call an approved application service; request approval; send notification; wait for event/time; create linked follow-up; escalate; complete/cancel. A new arrangement of supported step types is configuration. A genuinely new business capability or unsupported step type requires engineering work and tests.

LLMs may classify, extract, summarize or recommend, but must not be the sole interpreter of security policies, approval authority, financial calculations or workflow state transitions. Conditions affecting money, legal obligations, engineering release or safety must be deterministic and testable.

### 5.4.4 Configuration admin screens

Provide screens for Organization & Roles, Work-Item Library, Workflow Designer, Approval & Authority Matrix, SLA & Escalation Policies, Agent Policies, Configuration Validation/Simulation, Version History/Publish, and Change Audit. Provide import/export with schema validation and a dry-run preview. Bulk import must not automatically activate workflows.

### 5.4.5 Configuration boundaries

Configuration must not permit an administrator to bypass tenant isolation, server-side authorization, immutable audit, statutory controls or protected human approvals. Role labels in the source workbook are suggestions to map to canonical role IDs, not security identities by themselves. Missing or ambiguous source data must be flagged for review, not silently inferred.

## 5.5 Environment strategy

- Local: Docker Compose with app, PostgreSQL, Redis and mock integrations.
- Development: shared non-production environment with synthetic/sample data.
- Staging: production-like, access-controlled, migration rehearsal and acceptance testing.
- Production: managed database, encrypted storage, backups, monitoring, alerts and release approval.

---

# 6. Data Architecture and Common Rules

## 6.1 Global conventions

- Every entity has immutable ID (UUID), created_at, updated_at, created_by and updated_by where applicable.
- Tenant-owned records carry tenant_id; company-owned records carry company_id; project-related records carry project_id when relevant.
- Use soft deletion only where legally/business appropriate; never silently delete financial/audit records.
- Use explicit status enums or reference tables, not free-text status.
- Store timestamps in UTC and render using user/company timezone.
- Store currency and tax context on financial documents; use decimal types, never floating point for money.
- Use optimistic concurrency/version fields for records that may be edited concurrently.
- Maintain audit history for approvals, financial changes, workflow changes, document revisions and agent actions.
- Define unique constraints and idempotency keys for external requests and write operations.
- Use object storage for binary files; database stores metadata and immutable object references.
- Keep document revision and approval status distinct.
- Every critical record must have a clear owner and lifecycle.

## 6.2 Core entities

- Tenant, Company, LegalEntity, Branch.
- User, Employee, Department, Role, Permission, RoleAssignment, Delegation, ApprovalLimit.
- SourceCatalogue, SourceWorkItem, SourceFieldProvenance, WorkItemDefinition, WorkItemVersion, WorkItemDisposition, WorkItemCapabilityMap, WorkItemInstance, WorkItemDependency, WorkItemEvidence.
- DepartmentDefinition, RoleDefinition, RoleAssignment, RoleMapping, EffectiveDatedPolicy.
- WorkflowDefinition, WorkflowVersion, WorkflowNode, WorkflowTransition, WorkflowCondition, WorkflowInstance, WorkflowStepInstance, WorkflowEvent.
- ConfigurationChange, ConfigurationValidationRun, ConfigurationSimulationRun, ConfigurationApproval, PublishedConfiguration, ConfigurationRollbackEvent.
- ApprovalPolicy, EscalationPolicy, SLAProfile, EvidenceRequirement, AgentPolicy, AgentToolPermission, WorkflowMigration.
- Task, TaskAssignment, Checklist, Comment, Attachment, SLA, Escalation.
- Client, Contact, Lead, Opportunity, SiteVisit, Tender, Bid, Estimate, EstimateLine.
- Project, ProjectType, ProjectBaseline, WBSNode, Milestone, ScheduleActivity, ProgressEntry.
- Budget, CostCode, Commitment, CostTransaction, Forecast, CashFlowEntry.
- Contract, ContractClause, Obligation, Notice, Variation, Claim, EOTEvent, Bond, Guarantee, InsurancePolicy.
- Drawing, Document, DocumentRevision, Transmittal, ApprovalStamp, DocumentAccessGrant.
- BOQ, BOQLine, MaterialItem, UnitOfMeasure, Warehouse, StockLedgerEntry, MaterialRequest, GRN, MaterialIssue.
- Vendor, VendorContact, VendorComplianceDocument, RFQ, VendorQuotation, EvaluationScore, PurchaseRequisition, PurchaseOrder, POChange.
- Subcontractor, Subcontract, WorkMeasurement, SubcontractCertificate.
- SiteDiary, DPR, ManpowerEntry, EquipmentUsage, WeatherEntry, SiteInstruction, RFI.
- InspectionPlan, InspectionRequest, TestResult, NCR, CorrectiveAction, SafetyObservation, Incident, PermitToWork.
- ClientInvoice, InvoiceLine, VendorBill, PaymentRecord, RetentionRecord, Receivable, Payable, Reconciliation.
- EmployeeRecord, Skill, Certification, TrainingRecord, RecruitmentRequest, Candidate, Offer, LeaveRecord.
- EquipmentAsset, MaintenancePlan, MaintenanceEvent, FuelEntry, Allocation.
- KnowledgeSource, KnowledgeChunk, AgentDefinition, AgentVersion, AgentRun, AgentStep, ToolDefinition, ToolCall, EvaluationCase.
- Notification, IntegrationConnection, WebhookEvent, ImportJob, AuditEvent, FeatureFlag.

## 6.3 Configuration and source-of-truth ownership

- The source workbook remains an immutable import/source snapshot. Imported rows preserve original source ID/serial, raw values, source file/version, import timestamp and provenance.
- Canonical department and role records are separate from raw source labels. Many raw labels may map to one canonical role; unresolved mappings remain pending.
- Source work-item row, normalized work-item definition and executable workflow are separate entities. A single work item may map to an existing capability and a shared workflow template; multiple source items may reuse one workflow template.
- Workflow instances reference the exact published workflow/configuration version used at creation.
- Process owners own the meaning and disposition of work items; system administrators own technical publishing permissions; security rules remain enforced by application code.
- Reference/SOP text is searchable context, not a mandatory runtime form field unless a process owner explicitly configures it as such.

## 6.4 Work-item operational contract

The minimum operational fields for a configured actionable item are:

1. Stable work-item ID and source provenance.
2. Department and canonical responsible role (or assignment rule).
3. Trigger / entry condition.
4. Action or supported capability to invoke.
5. Output / evidence and closure criteria.
6. SLA or timing rule, including calendar and pause rules where needed; undocumented timing remains `TBD`.
7. Handoff / dependency and next owner.
8. Exception / escalation rule.
9. Risk tier, permissions, approval requirement and active version.

Governance understanding, SOP creation notes, long descriptions and reviewer metadata remain optional reference fields. They can inform search, agent grounding and future SOP generation but are not mandatory daily task inputs unless deliberately selected by the process owner.

## 6.5 Work-item disposition taxonomy

Every imported row receives a reviewed disposition, not an automatic executable status:

- **Configure workflow:** actionable recurring work that fits supported capabilities.
- **Configure approval/decision:** a decision with an approver, inputs, recorded outcome and follow-up.
- **Track obligation/document:** a filing, signature, renewal, physical-paper step or evidence obligation.
- **Periodic review/monitor:** a scheduled review with a measurable output or exception.
- **Reference/policy only:** general responsibility, principles or descriptive guidance with no discrete task outcome.
- **Clarify/de-duplicate:** ambiguous, overlapping, inconsistent or dependent item requiring owner review.
- **Defer:** valid but not needed in the current delivery phase.

These are dispositions, not mutually exclusive risk classifications; items may also carry risk tier and priority.

## 6.6 Data ownership

The source-of-truth owner for each field must be documented. For example, approved contract terms belong to the contract record; the project schedule baseline belongs to the schedule/baseline module; actual stock belongs to the stock ledger; the approved invoice belongs to billing/finance. AI-generated summaries must never silently overwrite these sources.

---

# 7. Complete Module Catalogue

The modules below define the target product. Phase tags and MVP scope are provided later. Each module needs its own detailed implementation tasks and acceptance tests.

| ID | Module | Responsibility | Primary users |
| M01 | Identity, Authentication & Sessions | Secure sign-in, MFA, password recovery, session control, SSO-ready architecture, account lifecycle, invited users, deactivation and audit trail. | All users; Platform Admin |
| M02 | Company, Branch, Project & Tenant Setup | Company profile, legal entities, branches, operating regions, currencies, fiscal year, project numbering, document numbering, configurable settings. Design tenant_id into all tenant-owned data from day one. | Platform Admin; Company Admin |
| M03 | Organization, Departments, Roles & Authority | Department tree, role catalogue, reporting lines, acting/deputy roles, role-to-work-item mapping, authority matrix, approval limits, segregation of duties and effective-dated changes. | Company Admin; HR; Department Heads |
| M04 | Employee Directory & Workforce | Employee profiles, employment status, skills, certifications, project allocation, onboarding/offboarding, site assignments, emergency contacts, documents and training validity. Payroll details can be phased separately. | HR; Managers; Employees |
| M05 | Work-Item Catalogue & Disposition | Import all 1,308 rows as source data; preserve provenance; map raw department/role labels to canonical records; classify disposition; map actionable items to reusable capabilities/workflows; version normalized definitions. Long governance/SOP text is reference context, not mandatory task data. | Process Owners; Department Heads; Process Admin |
| M06 | Configuration Studio & Workflow Engine | Configure reusable triggers, supported steps, branching, dependencies, forms, evidence, SLA calendars, approval policies, escalations, exceptions and closure criteria. Validate/simulate before approval and publication; pin active instances to immutable versions. | Process Admin; Workflow Owners; Security/Domain Approvers |
| M07 | Tasks, My Work & Work Queues | Personal/team queues, assignment, priority, due date, dependencies, checklist, evidence, comments, reassignment, delegation, pause reason, blocked status, overdue tracking and bulk actions. | All employees; Managers |
| M08 | Approvals & Delegation | Configurable sequential/parallel approvals, value thresholds, role-based approvers, substitute approvers, rejection with reasons, resubmission, escalation, immutable decision records and no self-approval controls. | Managers; Department Heads; CXOs; CEO; Chairman |
| M09 | Project & Portfolio Management | Project register, client, contract, scope, location, project type, budget baseline, WBS, milestones, schedules, progress, risk/issue register, dependencies, resources, change control, health score, forecasts and closeout. | Project Managers; COO; CEO |
| M10 | Client, CRM & Sales Pipeline | Lead capture, qualification, contacts, site visit, opportunity stages, tender calendar, bid/no-bid, client communication log, handover checklist, proposals, pipeline forecast and sales-to-technical handoff. | Sales; Marketing; Technical |
| M11 | Tendering, Estimation & Commercials | Tender document register, scope matrix, quantity take-off inputs, estimate versions, labour/material/equipment/subcontractor costs, overheads, contingency, taxes, risk allowances, margin scenarios, exclusions, quote approvals and bid submission evidence. | Estimator; Commercial; Technical; Finance |
| M12 | Technical Engineering & Design Control | Design brief, survey, discipline deliverables, design basis, codes/criteria, drawing register, revision control, technical review, coordination, clash/RFI management, specifications, BOQ validation, IFC release, authority submissions and as-built closeout. | CTO; Architect; Engineers; Document Controller |
| M13 | Documents, Drawings & Records | Versioned files, metadata, tags, access classification, check-in/out where required, approval stamps, superseded status, OCR/extraction, transmittals, revision comparisons, document requests, retention and legal hold. | All permitted roles; Document Controller |
| M14 | Procurement & Vendor Management | Purchase requisitions, material plans, vendor onboarding/KYC, RFQ, quotation comparison, approved vendor list, technical/commercial evaluation, purchase orders, delivery tracking, GRN, returns, vendor scorecards and procurement commitments. | Procurement; Project; Stores; Finance |
| M15 | Inventory, Stores & Material Movement | Items/catalogue, units of measure, warehouses/site stores, stock ledger, receipts, issues, transfers, returns, reservations, batch/serial/expiry where applicable, minimum stock, reconciliation, wastage and material consumption against BOQ/activity. | Storekeeper; Procurement; Site Engineer |
| M16 | Subcontractor & Labour Operations | Subcontractor onboarding, scope/BOQ, work orders, manpower deployment, daily attendance, measured work, certification, productivity, safety induction, claims, deductions, retention and subcontractor performance. | Projects; HR; Commercial; Safety |
| M17 | Site Operations, DPR & Field Capture | Mobile-first site diary, daily progress report, manpower, equipment, weather, work quantities, material consumption, photos, geo/time stamps where lawful, site instructions, blockers, incidents, inspections, offline draft/sync and supervisor verification. | Site Engineer; Site Manager; Project Manager |
| M18 | Schedule, Progress & Resource Planning | Baseline and updated schedule, activity dependencies, planned vs actual, critical path integration-ready model, lookahead plans, resource histograms, delay reasons, recovery plans, milestone forecasts and variance explanations. | Planner; Project Manager; COO |
| M19 | Quality, Inspection & NCR | Inspection and test plans, checklists, inspection requests, hold/witness points, test results, non-conformance reports, corrective/preventive actions, reinspection, defect lists, quality evidence and closure sign-off. | QA/QC; Site; Technical |
| M20 | Safety, Incidents & Compliance | Induction, permits-to-work, toolbox talks, hazard observations, risk assessments, incident/near-miss reporting, corrective actions, safety inspections, certificates and compliance deadlines. Safety decisions remain human-controlled. | Safety Officer; Site Manager; Project Leadership |
| M21 | Finance, Budgets & Cost Control | Project cost codes, budgets, commitments, actuals, accruals, cost-to-complete, forecasts, cash flow, cost variance, margin forecast, expense claims, payment approvals, bank reconciliation integration-ready ledger and financial period controls. | Finance; CFO; Project Managers |
| M22 | Billing, Invoicing, Receivables & Payables | Client applications for payment, measurement sheets, progress claims, tax invoices, retention, advances, deductions, credit notes, vendor bills, payment runs, ageing, collection actions, dispute reasons and invoice status tracking. | Finance; Commercial; Project; Procurement |
| M23 | Contracts, Claims, Variations & EOT | Contract repository, clause/obligation register, notices, deadlines, variation requests, change orders, extension-of-time events, evidence chronology, claims valuation, approvals, disputes, bonds/guarantees, insurance, DLP and closeout obligations. | Contracts; Legal; Commercial; Project |
| M24 | People, Recruitment & Performance | Manpower requests, requisitions, candidate pipeline, interviews, offers, onboarding, training, competency matrix, attendance/leave integrations, performance objectives, reviews, employee relations and offboarding. | HR; Hiring Managers; Employees |
| M25 | Equipment, Plant & Fleet | Asset register, ownership/lease, allocation to project, utilisation, fuel, maintenance, inspection, certificates, breakdowns, downtime, operator competency, hire costs and replacement planning. | Plant Manager; Projects; Finance |
| M26 | Customer/Stakeholder Communications | Communication log, approved templates, email ingestion integration-ready, meeting minutes, decisions, action extraction, reminders, client complaints, stakeholder register and escalation history. | Sales; Project; CEO Office |
| M27 | Legal, Licences & Regulatory Register | Legal matters, requests, external counsel, filings, permits, licence renewals, compliance obligations, notices, evidence, privilege/access restrictions and deadline alerts. | Legal; Compliance; Company Leadership |
| M28 | AI Knowledge Assistant & Search | Permission-aware answers grounded in approved work items, SOPs, contracts, drawings and company records; citations to source and version; abstention when unsupported; feedback and knowledge-gap reporting. | All authorized users |
| M29 | AI Agent Studio & Tool Registry | Agent definitions, objectives, allowed tools, input/output schemas, retrieval scope, model settings, guardrails, approval requirements, max steps, budgets, timeouts, retries, versioning, evaluation tests and disable/rollback controls. | AI Admin; Security; Product Owner |
| M30 | Agent Runs, Human Review & Audit | Run queue, plan/steps, tool calls, evidence, confidence, approvals, failures, retries, token/cost tracking, human intervention, replay-safe actions, audit log, redaction and incident review. | Authorized operators; Auditors |
| M31 | Notifications, SLA & Escalations | In-app/email notifications initially; configurable templates, reminders, digest, SLA timers, escalation ladders, quiet hours, delivery status, deduplication and preference management. WhatsApp/SMS as later integrations. | All roles; Admin |
| M32 | Dashboards, Reports & KPI Builder | Role-specific dashboards, project health, work ageing, bottlenecks, margin, cost variance, procurement savings, receivables, workforce utilisation, agent success, time saved, export and metric definitions. | Employees; Managers; Executives |
| M33 | Master Data & Configuration | Items, units, cost codes, tax settings, document types, project types, risk categories, status dictionaries, numbering schemes, currencies, approval bands and import/export validation. | Company Admin; Data Steward |
| M34 | Integrations & API Management | REST APIs, webhooks, import/export, email/calendar, accounting/banking, e-sign, OCR/LLM, mapping services, weather, vendor portals and client systems. Integration status, retries, dead-letter review and credential rotation. | Integration Admin; IT |
| M35 | Audit, Security, Privacy & Retention | Append-only business audit, login/session audit, permission review, encryption, retention rules, legal hold, data export/deletion policy, incident handling, backup/restore tests and access to sensitive HR/legal/financial records. | Security Admin; Compliance; Auditors |
| M36 | Platform Administration & Support | Feature flags, tenant/company configuration, user support, system health, job queues, failed workflow repair, agent kill switch, maintenance banners, release notes and support ticket triage. | Platform Admin; Support |
| M37 | Mobile/PWA & Offline Site Mode | Responsive PWA, installability, camera/file upload, low-bandwidth forms, offline drafts for approved field forms, conflict resolution, sync queue and visible sync status. Do not permit offline financial approvals without explicit policy. | Site and field users |
| M38 | Implementation, Migration & Data Quality | Excel import wizard, column mapping, validation errors, duplicate detection, dry-run, import report, reconciliation totals, source references, rollback plan and staged activation of the 1,308 work-item library. | Implementation Admin; Data Owners |

---

# 8. Functional Requirements by Module

The following requirements are mandatory baseline behavior. AI development agents must convert each requirement into implementation tasks, tests and acceptance evidence.

## 8.1 Identity, organization and authority

- FR-IAM-001: Users can sign in, sign out, recover access and terminate sessions securely.
- FR-IAM-002: Privileged users can require MFA.
- FR-IAM-003: Admins can invite, deactivate and reactivate users.
- FR-IAM-004: Access is checked server-side on every protected operation.
- FR-ORG-001: Admins can maintain company, department, role and reporting hierarchy.
- FR-ORG-002: Role assignments and delegations have effective dates and audit history.
- FR-ORG-003: Temporary delegation expires automatically.
- FR-ORG-004: Approval authority is configurable by action type, project, value band and role.
- FR-ORG-005: A requester cannot approve their own transaction when segregation-of-duties rules prohibit it.

## 8.2 Work-item catalogue, configuration studio and workflow engine

- Import the source catalogue idempotently; re-imports must not duplicate source rows.
- Preserve original source fields and store normalized fields separately. Never overwrite raw source text during normalization.
- Support one-to-many mappings from a source item to capabilities, and many-to-one reuse of workflow templates.
- Support disposition, priority, owner, validation state, configuration status, risk tier and phase target.
- Provide filters/search by source ID, department, role, disposition, status, workflow mapping, risk and missing data.
- Provide bulk actions only with preview, validation results and permission checks.
- Keep reference-only items searchable and linkable without generating tasks.
- Support workflow templates, reusable subflows, form schemas, deterministic conditions, event triggers, timers, approval gates, retries, compensation, pause/resume, cancellation and escalation.
- Validate required triggers/actions/outputs/handoffs and ensure referenced roles, permissions, SLA calendars and policies exist.
- Simulate workflows using test cases before publication; display branch coverage and unreachable steps.
- Support effective dates, immutable versions, change diffs, approvals, publish/rollback and version-pinned runtime instances.
- Existing active instances are not silently rewritten when a template changes. Provide an explicit migration workflow with preview, impact summary, approvals and audit.
- Separate workflow definition from task instance and business record; task completion may update domain records only through authorized service commands.
- Provide configuration APIs and import/export schemas so changes can be managed via UI or reviewed configuration files, with the same validation and publication controls.


- FR-WI-001: Import all 1,308 source work items with source serial number and source field provenance.
- FR-WI-002: Preserve original wording and source values; corrections are versioned rather than destructive.
- FR-WI-003: A work-item definition includes purpose, responsible role, trigger, inputs, action, output/evidence, handoff, escalation, timing, governance notes and SOP inputs.
- FR-WI-004: Work-item definitions are separate from executable instances.
- FR-WI-005: Admins can map each definition to a workflow template, event trigger, task template, SLA and evidence checklist.
- FR-WI-006: Definitions may be Draft, Under Review, Approved, Published, Retired.
- FR-WI-007: Published definition changes require versioning and impact review.
- FR-WI-008: Instances record the exact definition/workflow version used.
- FR-WI-009: Dependencies support predecessor/successor, blocking, conditional and parallel steps.
- FR-WI-010: A work item cannot close until required checklist/evidence/approvals are satisfied, unless an authorized exception is recorded.
- FR-WI-011: Workflow changes do not silently mutate active instances.
- FR-WI-012: Admins can simulate/test a workflow before publishing.
- FR-WI-013: Work item library supports search, filters, department/role views and export.

## 8.3 Task execution and approvals

- FR-TASK-001: Users can view My Work, Team Work, Due Soon, Overdue, Blocked, Waiting Approval and Completed.
- FR-TASK-002: Tasks support owner, assignee, reviewer, due date, priority, dependency, comments, evidence and status.
- FR-TASK-003: Status transitions are validated server-side.
- FR-TASK-004: Blocked tasks require a reason and optional dependency.
- FR-TASK-005: Reassignment and delegation are audited.
- FR-APP-001: Approval steps support sequential and parallel approval.
- FR-APP-002: Approver sees the request, supporting evidence, policy/authority, risk flags and audit history.
- FR-APP-003: Approval, rejection, return-for-correction and delegation require identity and timestamp; rejection/return requires reason.
- FR-APP-004: Approvals are checked against current authority and conflicts.
- FR-APP-005: Thresholds are configurable and versioned.
- FR-APP-006: An approval can be revoked/corrected only through a controlled compensating process, never by deleting history.

## 8.4 Project, schedule and cost

- FR-PROJ-001: Create a project only through authorized manual entry or an approved opportunity/contract-award workflow.
- FR-PROJ-002: Project setup captures client, location, type, contract, project manager, baseline dates, budget and document register.
- FR-PROJ-003: Support WBS, milestones, activities, dependencies and planned/actual progress.
- FR-PROJ-004: Baseline changes require reason, impact analysis and approval.
- FR-PROJ-005: Track issues, risks, decisions, assumptions, dependencies and change requests.
- FR-PROJ-006: Project health must show the contributing factors and last refresh time; never display an unexplained AI score as fact.
- FR-PROJ-007: Forecast cost and completion date are distinguishable from approved baseline.
- FR-PROJ-008: Project closeout checklist includes required handover records, final account, defects/DLP and lessons learned.

## 8.5 CRM, tendering and estimation

- FR-CRM-001: Lead/opportunity has source, client, owner, stage, expected value, probability, next action and due date.
- FR-CRM-002: Duplicate client/contact detection is supported.
- FR-CRM-003: Tender deadlines and submission evidence are tracked.
- FR-BID-001: Bid/no-bid decision captures criteria, score/rationale, approvers and conditions.
- FR-EST-001: Estimates are versioned and traceable to quantities, rates, assumptions, inclusions, exclusions, taxes, overheads, contingency and margin.
- FR-EST-002: AI may extract quantities or suggest rates only with source and confidence; a qualified person validates before approval.
- FR-EST-003: Approved estimate version is locked against silent edits.
- FR-CRM-004: Won opportunity handover cannot complete while mandatory handover fields are missing, unless an authorized exception is recorded.

## 8.6 Engineering and document control

- FR-ENG-001: Design brief, assumptions, exclusions, criteria, discipline deliverables and deadlines are versioned.
- FR-DOC-001: Documents have type, number, title, project, discipline, revision, status, originator, reviewer, approver and access class.
- FR-DOC-002: Superseded drawings are visibly marked and excluded from current-for-construction views.
- FR-DOC-003: IFC release requires configured reviews and approvals.
- FR-DOC-004: Transmittals record recipient, package, revision, purpose and delivery status.
- FR-ENG-002: RFI records issue, location, related drawings/revisions, question, priority, owner, due date, response and closure evidence.
- FR-ENG-003: Potential clashes found by AI are labelled as candidates, not confirmed defects, until reviewed.
- FR-ENG-004: BOQ validation records drawing/quantity basis, exceptions and reviewer.
- FR-ENG-005: Authority submissions track package, authority, submission date, reference, response, conditions and expiry/renewal where applicable.

## 8.7 Procurement, vendor and inventory

- FR-PROC-001: Material requests reference project, BOQ/WBS/activity, required date, quantity, unit and specification.
- FR-PROC-002: Stock, reservations, open POs and expected deliveries are checked before purchase recommendation.
- FR-PROC-003: RFQ can be issued to multiple approved vendors with a common scope/specification.
- FR-PROC-004: Quotation comparison separates price, tax, freight, quality, compliance, payment terms, lead time and risk.
- FR-PROC-005: AI recommendation explains trade-offs and cites evidence; lowest price is not automatically selected.
- FR-PROC-006: PO approval follows authority matrix and budget/commitment checks.
- FR-PROC-007: PO creation and sending are idempotent and audited.
- FR-INV-001: GRN records actual received quantities, shortages, damage, inspection and supporting evidence.
- FR-INV-002: Stock movements are ledger entries; do not update balance without a corresponding movement.
- FR-INV-003: Negative stock is blocked unless explicitly enabled for a controlled business case.
- FR-INV-004: Material issue and consumption can be linked to project/activity/BOQ line.
- FR-VEND-001: Vendor evaluation is based on recorded criteria and performance evidence.

## 8.8 Site operations, quality and safety

- FR-SITE-001: Site users can submit DPRs with work quantities, planned vs actual, manpower, equipment, material use, weather, blockers and photos.
- FR-SITE-002: Draft/offline entries display sync status and resolve conflicts visibly.
- FR-SITE-003: Site progress requires a designated reviewer where company policy requires verification.
- FR-QUAL-001: Inspections follow project-specific ITP/checklists with pass/fail, measurements, photos and sign-off.
- FR-QUAL-002: NCRs have severity, responsible party, containment, root cause, corrective action, due date, reinspection and closure approval.
- FR-SAFE-001: Safety incidents and hazards can be reported promptly with restricted access.
- FR-SAFE-002: AI can summarize and flag patterns but cannot approve a permit-to-work or determine a worksite is safe.
- FR-SAFE-003: Critical safety alerts follow a configured human escalation path and must not be suppressed by AI confidence thresholds.

## 8.9 Finance, billing and contracts

- FR-FIN-001: Budgets distinguish approved budget, commitments, actual cost, accruals and forecast-to-complete.
- FR-FIN-002: Every financial transaction has currency, date, source document, project/cost code and approval status as appropriate.
- FR-FIN-003: Financial period close and corrections are controlled and audited.
- FR-BILL-001: Client invoice/payment applications link to contract, milestones or measured progress.
- FR-BILL-002: Track submitted, certified, disputed, approved, invoiced, paid, retained and overdue amounts separately.
- FR-BILL-003: Vendor invoice matching can compare PO, GRN/service confirmation and invoice; exceptions are routed for review.
- FR-BILL-004: AI can draft collection reminders but cannot alter a due amount or mark an invoice paid without verified evidence.
- FR-CON-001: Contract clauses/obligations are linked to the source clause/page and confidence.
- FR-CON-002: Notice deadlines create tasks with owner, due date and escalation.
- FR-CON-003: Variation/claim records link event chronology, instruction, scope impact, quantity, cost/time impact, contract basis, evidence and approval.
- FR-CON-004: AI-detected claim opportunities are suggestions requiring commercial/legal validation.
- FR-CON-005: Legal settlement, contract execution and formal notice issuance require designated human approval.

## 8.10 AI knowledge, agents and governance

- FR-AI-001: Answers from company knowledge include citations to authorized source documents and revisions.
- FR-AI-002: Retrieval respects document-level and project-level permissions.
- FR-AI-003: If evidence is missing or conflicting, the assistant states the uncertainty and asks for clarification or routes to a person.
- FR-AI-004: AI outputs are typed (summary, extracted field, recommendation, draft, proposed action) and are not treated as approved business records by default.
- FR-AG-001: Every agent has owner, purpose, allowed tools, data scope, model/provider, version, timeout, retry limit, cost budget and risk tier.
- FR-AG-002: Tool calls use schema validation, authorization, idempotency and audit.
- FR-AG-003: Agents cannot access arbitrary network, shell, secrets or direct database credentials.
- FR-AG-004: High-risk actions require human approval.
- FR-AG-005: Every agent run records inputs/references, plan/steps, tool calls, outputs, latency, model cost, approval, error and outcome.
- FR-AG-006: Administrators can pause/disable an agent globally or by tenant.
- FR-AG-007: Agent changes are versioned and tested against evaluation cases before production.
- FR-AG-008: Prompt injection in documents/emails is treated as untrusted content; document instructions cannot override system policy.
- FR-AG-009: Agent execution is bounded by max steps, time, spend and tool permissions.
- FR-AG-010: Agent-generated writes are previewed or staged unless explicitly classified as low risk and approved for automation.

## 8.11 Reporting, notifications and audit

- FR-REP-001: Metrics have a defined formula, owner, refresh frequency and source.
- FR-REP-002: Dashboard filters respect the viewer's access rights.
- FR-NOT-001: Reminders and escalations are deduplicated and traceable.
- FR-NOT-002: Delivery failure is visible and retried under policy.
- FR-AUD-001: Audit logs record actor (human/agent/system), action, entity, timestamp, request/correlation ID and before/after values where appropriate.
- FR-AUD-002: Audit records are access-controlled and protected from normal users' alteration.
- FR-IMP-001: Import wizard supports dry-run, field mapping, row errors, duplicate checks, reconciliation counts and rollback strategy.

---

## 8.12 Configuration administration and governance

- Admin can create departments and role definitions without code deployment; role grants are permission-based and must be reviewed.
- Raw source roles must map to canonical role IDs. Unknown labels are quarantined for mapping; never create a privileged role solely because it appears in imported data.
- Admin can configure assignment rules (role, project team, department queue, named user, round-robin where justified) with fallback behavior when no eligible assignee exists.
- SLA configuration supports business calendars, holidays, time zones, start/stop conditions, pause reasons, warning thresholds and escalation actions. Unknown source timing is marked unconfirmed, not converted into a guessed SLA.
- Approval policy supports amount bands, project/company scope, role hierarchy, sequential/parallel approvals, quorum where required, separation of duties, delegation expiry and no-self-approval.
- Configuration publication requires change reason, validation report and required approver(s). High-risk policy changes need domain owner approval and a second-person review.
- Configuration history is queryable and exportable; audit captures before/after diff, author, reviewer, approver, effective date and impacted templates.
- Provide a configuration impact report showing affected departments, role queues, active templates and agent permissions before publish.
- Provide a configuration health dashboard for unmapped roles, unconfigured actionable items, missing SLA values, orphaned dependencies, disabled owners, stale versions and workflows with repeated exceptions.

# 9. AI Agent Catalogue and Boundaries

Build agents as capabilities over the same platform, not as separate apps with their own databases.

## 9.1 Initial agents

### A. Company Knowledge Assistant
- Answers questions about roles, work items, SOPs and policies.
- Cites source and version.
- Can draft a task or checklist but requires confirmation before creating records.

### B. Work Item Copilot
- Explains a work item, identifies prerequisites, checks required evidence and proposes next steps.
- Reads workflow and authority definitions.
- Cannot mark a task complete without required evidence and user action/authorized rule.

### C. Document Intelligence Agent
- Classifies documents, extracts metadata, identifies dates/amounts/parties, compares revisions and flags missing fields.
- Extracted fields remain “unverified” until accepted where accuracy matters.

### D. Meeting-to-Actions Agent
- Converts approved meeting notes/transcripts into proposed decisions, owners, deadlines and linked tasks.
- Human confirms decisions and assignments before publication if source is ambiguous.

### E. Project Control Agent
- Summarizes schedule/cost/procurement/RFI/quality/collection risks.
- Shows source metrics, reasons, last-updated time and recommended actions.
- Does not invent progress or alter baseline.

### F. Procurement Intelligence Agent
- Checks stock, existing orders, specification fit, quotation comparison and vendor performance.
- Recommends; authorized human approves supplier/PO according to limits.

### G. Finance & Collections Assistant
- Identifies overdue invoices, missing backup, mismatches and collection next actions.
- Drafts reminders; only verified finance events change balances/status.

### H. Contract/Claims Assistant
- Extracts obligations, notice dates and clauses; creates draft variation/claim packs with evidence links.
- Legal/commercial team validates all formal claims/notices.

## 9.2 Later agents

- Technical Engineering/RFI assistant.
- Estimation and BOQ review assistant.
- Schedule/delay prediction agent.
- Material price and delivery risk agent.
- Vendor performance agent.
- QA/NCR pattern agent.
- HR workforce planning assistant.
- Equipment utilisation/maintenance assistant.
- Client communication drafting agent.
- Executive Control Tower agent.
- Cross-department coordinator.

## 9.3 Agent risk tiers

- **Tier 0 — Read-only:** search, summarize, explain.
- **Tier 1 — Draft:** create draft text, report or proposed task.
- **Tier 2 — Reversible low-risk write:** create a draft task, reminder or document classification, within strict permission and idempotency controls.
- **Tier 3 — Controlled business action:** RFQ issue, client message, work reassignment or workflow transition; explicit configured approval or pre-authorized policy required.
- **Tier 4 — High-risk:** financial commitments/payments, contract signature, formal legal notices, engineering sign-off, safety authorization, payroll release, ownership/CEO reserved matters. Human approval and any required multi-party controls are mandatory; some actions should remain human-only.

## 9.4 Agent execution contract

Every agent action must include:
- User/tenant/project context.
- Objective and bounded scope.
- Data sources used.
- Proposed action and typed parameters.
- Policy/permission check.
- Risk tier.
- Approval requirement.
- Idempotency key.
- Expected side effect.
- Success/failure result.
- Audit record.
- Rollback/compensation path where possible.

---

# 10. Critical End-to-End Workflows

## 10.1 Opportunity to project

1. Create lead/opportunity.
2. Validate client/contact and project basics.
3. Capture brief and site information.
4. Technical feasibility review.
5. Tender documents and deadline register.
6. Estimate and risk review.
7. Bid/no-bid approval.
8. Proposal approval and submission.
9. Negotiation and contract/legal review.
10. Award approval.
11. Create project, WBS, team, budget and document register.
12. Generate project-specific workflows from templates.
13. Run sales-to-technical and technical-to-project handovers.
14. Mobilisation readiness approval.

Control: no project should be treated as fully mobilized without the configured prerequisites or an explicitly approved exception.

## 10.2 Design-to-IFC

1. Approved brief and assumptions.
2. Survey and constraints.
3. Design basis and applicable codes.
4. Discipline deliverables and programme.
5. Draft designs and revision control.
6. Interdisciplinary review and coordination.
7. RFI/clash resolution.
8. Technical specifications and BOQ check.
9. Internal QA and designated sign-offs.
10. Authority submission/approval where applicable.
11. IFC release with current revision and transmittal.
12. Withdraw or visibly supersede previous construction copies.

Control: AI may flag inconsistencies, but qualified designers/approvers own technical sign-off.

## 10.3 Material requirement to payment

1. Project/activity identifies material requirement.
2. Check stock, reservations, open POs and forecast demand.
3. Create requisition and check budget/authority.
4. Obtain RFQs and vendor quotations.
5. Compare landed cost, specification, lead time, quality, payment terms and vendor risk.
6. Approve supplier and PO per authority matrix.
7. Track delivery.
8. Receive and inspect; create GRN and discrepancy record.
9. Update stock ledger and issue material to activity/site.
10. Match vendor bill against PO and GRN/service evidence.
11. Route mismatch for resolution.
12. Approve payment through finance controls.

Control: the system must prevent duplicate PO creation and clearly separate commitment, receipt, invoice and payment.

## 10.4 Daily site reporting to recovery action

1. Site user enters DPR.
2. Attach evidence/photos and record quantities/manpower/materials/blockers.
3. Site manager verifies as required.
4. Compare planned vs actual.
5. Update progress and resource data.
6. If variance exceeds configured threshold, create issue/recovery task.
7. Project Control Agent summarizes possible cause and impact.
8. Project Manager validates cause and recovery plan.
9. Notify impacted procurement/technical/finance/contracts teams.
10. Track actions to closure.

## 10.5 Variation / claim protection

1. Capture event from site instruction, drawing revision, RFI, client communication or delay.
2. Link source evidence and date.
3. Identify potentially affected scope, quantity, cost and time.
4. Agent suggests relevant contract clauses and notice dates with citations.
5. Commercial/Legal validates entitlement and deadlines.
6. Prepare draft notice/variation/claim.
7. Human approval before formal issue.
8. Track submission, response, negotiation and certification.
9. Update approved contract value/budget only through approved change control.

## 10.6 Invoice-to-cash

1. Identify billing milestone or measured progress.
2. Validate measurement and supporting documents.
3. Prepare application/invoice draft.
4. Approve and submit to client.
5. Track certification, dispute, invoice issue and due date.
6. Send scheduled reminders and escalate overdue items.
7. Record verified receipt and reconcile.
8. Update receivable/cash flow and project forecast.
9. Track retention and final account separately.

## 10.7 Contract obligation management

1. Upload approved contract.
2. Extract parties, values, milestones, notice periods, payment terms, retention, LD, DLP, bonds, insurance and termination clauses.
3. Link every extracted item to clause/page and confidence.
4. Contract owner verifies extracted data.
5. Create obligation register, owners, due dates and reminders.
6. Escalate deadlines and missing documents.
7. Close obligation only with evidence and authorized confirmation.

## 10.8 Project closeout and DLP

1. Check practical completion prerequisites.
2. Complete testing/commissioning and punch list.
3. Collect as-built drawings, O&M manuals, warranties, certificates and handover records.
4. Client/consultant sign-off.
5. Final measurement, claims, retention and final account.
6. Track DLP defects and response times.
7. Track release of retention/bonds/guarantees.
8. Close financial and operational records.
9. Archive documents and capture lessons learned.

---

# 11. UX and Navigation

## 11.1 Main navigation

- Home / My Dashboard
- My Work
- Projects
- Sales & Tenders
- Technical & Drawings
- Procurement
- Inventory / Stores
- Site Operations
- Quality & Safety
- Finance
- Billing & Collections
- Contracts & Claims
- People
- Equipment
- Documents
- Reports
- AI Assistant
- Agent Runs / Approvals (for permitted roles)
- Administration

Navigation is role-configurable; users should not see irrelevant modules by default.

## 11.2 Key screens

- Login / MFA.
- My Work inbox.
- Work-item detail with purpose, trigger, inputs, checklist, action, evidence, handoff, timing, escalation and linked SOP.
- Workflow instance timeline.
- Approval inbox with evidence and authority.
- Project overview and project health.
- WBS/schedule and milestones.
- Project cost/margin forecast.
- Document register/drawing revision viewer.
- RFI and technical query board.
- Material request, RFQ comparison, PO and GRN screens.
- Site DPR mobile form.
- Inspection/NCR/safety forms.
- Invoice/receivable/payable screens.
- Contract obligation and notice calendar.
- AI chat with citations and suggested actions.
- Agent run detail with tool steps, evidence, costs, approvals and failures.
- Executive control tower.
- Admin configuration and audit search.

## 11.3 UX requirements

- Responsive desktop/tablet/mobile; prioritize site forms for mobile.
- Every list supports search, filters, sorting, pagination and saved views where relevant.
- Long forms support draft save and clear validation.
- Destructive/high-impact actions require confirmation and reason.
- Show status labels and next owner clearly.
- Show last-updated timestamps and data source for dashboards.
- Make overdue, blocked and approval-needed states visible without relying on color alone.
- Accessible keyboard navigation and readable contrast.
- Use plain business language; avoid exposing AI implementation jargon to regular users.

---

# 12. API Design

All APIs are versioned under `/api/v1`. Use consistent JSON envelopes, validation, pagination, correlation IDs and standardized error codes. Exact DTOs and OpenAPI contracts are generated during implementation.

## 12.1 Representative endpoint groups

| Domain | Example endpoints |
|---|---|
| Auth / users | `POST /auth/login`, `POST /auth/logout`, `GET /users/me`, `GET /users` |
| Organization | `GET/POST /departments`, `GET/POST /roles`, `GET/POST /authority-rules` |
| Work items | `GET /work-item-definitions`, `POST /work-item-definitions/import`, `POST /work-item-definitions/{id}/publish` |
| Instances/tasks | `POST /work-items/{definitionId}/start`, `GET /tasks/my-work`, `PATCH /tasks/{id}`, `POST /tasks/{id}/evidence` |
| Workflow | `POST /workflow-definitions`, `POST /workflow-instances`, `GET /workflow-instances/{id}/timeline` |
| Approvals | `GET /approvals/inbox`, `POST /approvals/{id}/approve`, `POST /approvals/{id}/return` |
| Projects | `GET/POST /projects`, `GET /projects/{id}/health`, `POST /projects/{id}/baseline-change` |
| CRM/tenders | `GET/POST /opportunities`, `POST /bids/{id}/decision`, `POST /estimates/{id}/versions` |
| Documents | `POST /documents/upload`, `POST /documents/{id}/revisions`, `POST /documents/{id}/transmittals` |
| Engineering | `POST /rfis`, `POST /rfis/{id}/responses`, `POST /drawings/{id}/release-ifc` |
| Procurement | `POST /material-requests`, `POST /rfqs`, `POST /purchase-orders`, `POST /grns` |
| Inventory | `GET /inventory/balances`, `POST /inventory/issues`, `POST /inventory/transfers` |
| Site | `POST /site/dprs`, `POST /site/inspections`, `POST /site/incidents` |
| Finance | `GET /projects/{id}/cost-report`, `POST /vendor-bills`, `POST /client-invoices` |
| Contracts | `POST /contracts/{id}/obligations`, `POST /variations`, `POST /claims` |
| AI knowledge | `POST /ai/ask`, `POST /ai/documents/{id}/extract` |
| Agents | `POST /agents/{id}/runs`, `GET /agent-runs/{id}`, `POST /agent-runs/{id}/approve-action` |
| Reports | `GET /reports/project-health`, `GET /reports/receivables`, `GET /reports/agent-roi` |
| Audit | `GET /audit-events` |

## 12.2 API rules

- Use DTO validation and strict schemas.
- Return structured error codes, safe messages and correlation ID.
- Paginate all collection endpoints.
- Apply tenant/project authorization to reads and writes.
- Require idempotency keys for external/financial side effects.
- Use optimistic concurrency for edits that may conflict.
- Never expose secrets, internal prompts or inaccessible document snippets.
- Generate OpenAPI and contract tests.
- Webhooks are signed, replay-protected and retryable.
- Record external integration requests and results without logging sensitive credentials.

---

# 13. Security, Privacy and Compliance

- Enforce least privilege and separation of duties.
- Encrypt data in transit and at rest.
- Use managed secret storage and rotate credentials.
- MFA for privileged and sensitive access.
- Restrict sensitive HR/legal/ownership/financial records.
- Validate uploads, scan files where supported and prevent unsafe file execution.
- Use signed, short-lived download links.
- Protect against SQL injection, XSS, CSRF, SSRF, broken access control and insecure direct object references.
- Rate-limit authentication, public APIs and AI endpoints.
- Apply tenant isolation to database queries, storage paths, vector retrieval, caches and logs.
- Keep PII out of prompts unless needed and authorized; redact where possible.
- Define retention and deletion rules with legal/business owners.
- Maintain audit trails for approvals, document releases, financial changes and AI actions.
- Use backups and regularly test restore.
- Perform dependency scanning, secret scanning, static analysis and security tests in CI.
- AI prompt injection: treat emails, PDFs, drawings and retrieved text as untrusted data, never as policy instructions.
- Restrict agent tools to allowlists; no arbitrary shell or unbounded external network access.
- Provide an emergency kill switch for agents and integrations.
- Establish incident response and breach notification processes consistent with applicable law and contracts.
- Validate the active jurisdiction’s tax, accounting, employment, construction safety, privacy, invoicing and statutory requirements with qualified local domain owners; do not treat generated legal/tax text as authoritative. UAE is the initial localization target, not a universal legal template.

---

# 14. Non-Functional Requirements

Initial targets are proposed and must be validated in discovery/pilot.

- Availability target: 99.5% monthly for initial production, with higher target considered after usage and budget review.
- Standard API latency: p95 under 500 ms for common non-reporting operations under agreed load.
- Dashboard/report latency: target p95 under 3 seconds for common filtered views; heavy reports run asynchronously.
- Agent tasks: asynchronous for long-running work; UI shows queued/running/needs-review/completed/failed.
- Scalability: horizontal scale for API and workers; database indexing and connection pooling.
- Reliability: retries with exponential backoff, idempotency and dead-letter visibility.
- Recovery: define RPO/RTO with client; initial proposal RPO ≤ 24 hours and RTO ≤ 8 hours, improve based on business criticality.
- Accessibility: aim for WCAG 2.2 AA for primary workflows.
- Localization: English initially, with configurable language labels, timezone, date/number formats, units of measure and currency per company/user/project where appropriate.
- Maintainability: linting, formatting, type checks, unit/integration/E2E tests, migration discipline and API documentation.
- Observability: logs, metrics, traces, alerts, workflow backlog and AI cost visibility.
- Auditability: critical decisions and side effects traceable to a user, agent or system process.
- Portability: containers and provider adapters reduce unnecessary lock-in.

---

# 15. Analytics and ROI

## 15.1 Operational KPIs

- Work item completion and overdue rate.
- Average cycle time by work item and department.
- Handoff rejection/rework rate.
- Approval turnaround time.
- Project schedule variance.
- Forecast cost at completion vs budget.
- Forecast margin vs approved margin.
- RFI response time.
- Drawing revision/rework frequency.
- Procurement price variance and on-time delivery.
- Stock variance and material wastage.
- NCR frequency and closure time.
- Invoice submission lag, certification cycle and receivable ageing.
- Variation/claim identification, submission and recovery.
- Equipment utilization and downtime.
- Employee time spent on manual reporting/coordination.

## 15.2 AI KPIs

- AI suggestion acceptance rate.
- Human correction rate.
- Unsupported answer rate in evaluation tests.
- Source citation correctness.
- Tool-call failure rate.
- Duplicate side-effect count (target zero).
- Agent run completion and retry rate.
- Cost per successful agent task.
- Minutes saved validated by users.
- False-positive/false-negative rate for risk flags.
- Human override rate and reasons.
- Safety/financial policy violations (target zero).

## 15.3 ROI formula

Calculate value per use case, not one generic AI-savings estimate.

**Net annual benefit** =
validated labor capacity value + realized procurement savings + realized avoided rework/loss + recovered/recognized claims benefit + financing benefit from faster collections − software/AI/cloud cost − implementation/support cost.

Avoid double-counting:
- Hours saved are not automatically cash savings unless capacity is redeployed or cost is reduced.
- Faster collections improve working capital; they are not the same as profit.
- A detected claim is not realized revenue until validated and recovered.
- Price reduction counts only against comparable specification, quality and terms.

Pilot each agent against a pre-AI baseline and compare outcomes over a defined period.

---

# 16. Delivery Roadmap and Phases

The roadmap is a sequence, not a promise of fixed calendar dates. Actual duration depends on team capacity, client availability, integrations and data quality.

## Phase 0 — Discovery and process baseline
**Deliverables**
- Confirm product owner and decision-makers.
- Review 1,308 work items and resolve duplicates, missing fields and role naming.
- Map critical end-to-end flows and dependencies.
- Define MVP project type(s) and pilot team.
- Confirm authority matrix and approval thresholds.
- Define data migration and document sensitivity.
- Capture current baseline metrics and ROI hypotheses.
- Convert requirements into epics/stories/acceptance tests.

**Exit gate:** signed-off MVP scope, critical workflows, data model and approval rules.

## Phase 1 — ERP foundation
- Authentication, company/tenant, departments, roles, permissions.
- Master data and audit.
- Work-item definition import and versioning.
- Tasks, My Work, comments, evidence and attachments.
- Approval engine and notifications.
- Admin tools and import validation.

**Exit gate:** authorized user can start, assign, execute, approve and audit a work item end-to-end.

## Phase 2 — Workflow and documents
- Workflow designer/templates.
- Durable workflow execution.
- SLA timers, dependencies and escalation.
- Document repository, revisions, transmittals and access control.
- Search, export, logs and failed-workflow operations.

**Exit gate:** one cross-department workflow runs reliably, resumes after failure and has evidence/audit.

## Phase 3 — Project and commercial core
- CRM/opportunities/tenders.
- Estimation and quote approval.
- Project setup, WBS, milestones, budget and risks.
- Technical handover and mobilisation.
- Project dashboard and document register.

**Exit gate:** an approved opportunity can be converted to a controlled project.

## Phase 4 — Field, engineering and procurement
- Design/drawing control, RFIs, IFC release.
- Material requests, RFQ, vendor comparison, PO.
- Inventory, GRN and material issues.
- DPR, field evidence, progress and blockers.
- Quality, NCR and safety reporting.

**Exit gate:** project activity can link technical documents, materials, site progress and issue closure.

## Phase 5 — Finance and contracts
- Budget/commitment/actual/forecast.
- Client billing, receivables, vendor bills and payment workflow.
- Contract obligations, notices, variations, claims, EOT and DLP.
- Cost/margin and cash dashboards.

**Exit gate:** a project’s financial and contractual lifecycle is traceable from approved baseline to closeout.

## Phase 6 — AI foundation and first agents
- AI gateway, retrieval, citations, document extraction and evaluation.
- Company Knowledge Assistant.
- Work Item Copilot.
- Meeting-to-Actions Agent.
- Document Intelligence Agent.
- Agent audit, cost limits, human review and kill switch.

**Exit gate:** agents pass evaluation set, cite evidence, respect permissions and cannot bypass approval controls.

## Phase 7 — ROI agents
Start with:
1. Project Control Agent.
2. Procurement Intelligence Agent.
3. Finance & Collections Assistant.
4. Contract/Claims Assistant.
5. Technical/RFI Assistant.

Each agent is piloted on real cases with human review and measurable baseline.

## Phase 8 — Cross-department orchestration
- Event-driven handoffs between project, technical, procurement, finance and legal.
- Shared exception/decision queues.
- Duplicate-event protection and failure recovery.
- CEO/COO/CFO control tower.

## Phase 9 — Predictive and controlled autonomy
- Delay/cost/cash forecasts after sufficient quality historical data exists.
- Limited pre-approved low-risk actions.
- Continuous evaluation, monitoring and rollback.
- Expand to more project types and tenants only after pilot success.

---

# 17. MVP Definition

Do not attempt all 38 modules in the first release. MVP must prove that the platform can execute business work reliably.

## MVP must include

- Configuration-first foundation: canonical departments/roles, source catalogue, work-item dispositions, reusable workflow templates, configurable SLAs/approvals/escalations, versioned publishing and audit.
- One end-to-end workflow configured from the catalogue without hard-coding its department/role labels in application logic.
- Authentication, company, departments, roles and permissions.
- Import/search/view the 1,308 work-item definitions.
- Work item definition versions and role mapping.
- Task instance, My Work, due dates, evidence and comments.
- Workflow/approval engine with audit.
- Document upload and access control.
- Notifications and escalations.
- Basic project register, client and project assignment.
- Admin screens and import validation.
- AI Knowledge Assistant with source citations.
- Work Item Copilot that proposes actions but does not execute privileged actions.
- Agent run logs, permission enforcement and kill switch.

## MVP should not include
- Full accounting ledger if not needed for pilot.
- Complex critical-path scheduling engine.
- Automated structural drawing approval.
- Autonomous PO issuance/payment.
- Unsupervised legal notice issuance.
- Predictive ML without historical data.
- All client/vendor portals.
- Every advanced integration.

## MVP demo scenario
1. Admin imports the work-item directory.
2. Admin maps a published work item to an executable workflow.
3. Manager creates a project and assigns a role/team.
4. Workflow creates tasks and required evidence.
5. Employee completes a task and attaches evidence.
6. Approver reviews and approves/returns with reason.
7. AI assistant explains the next step using the work-item definition and approved SOP.
8. System escalates an overdue item.
9. Audit view shows all actions and authority checks.

---

# 18. Testing and Acceptance

## 18.1 Required test layers
- Unit tests for domain rules, calculations and policy checks.
- Integration tests for database transactions, workflow execution, storage and notifications.
- API contract tests generated from OpenAPI.
- E2E tests for critical user journeys.
- Role/tenant isolation tests.
- Approval matrix and self-approval tests.
- Workflow retry/replay/idempotency tests.
- Import tests with valid, malformed, duplicate and partial data.
- Document access and signed URL tests.
- AI evaluation tests with grounded, ambiguous, conflicting and adversarial documents.
- Load/performance tests for agreed target volumes.
- Backup/restore and disaster recovery exercises.
- Security scanning and penetration testing before broad production rollout.

## 18.2 Definition of Done
A feature is complete only when:
- Acceptance criteria pass.
- Authorization and tenant isolation tests pass.
- Audit trail exists for important changes.
- Error/loading/empty states are implemented.
- Logs and monitoring are present for background work.
- API schema and user-facing help are updated.
- Migration and rollback strategy is documented.
- Unit/integration/E2E tests are included as appropriate.
- No secrets or sensitive sample data are committed.
- AI features have evaluation cases and failure handling.

## 18.3 Critical acceptance criteria

### Configuration-first acceptance criteria

1. An authorized administrator can add a department and role mapping without code changes or deployment.
2. An authorized process owner can configure a workflow using supported step types, validate it, simulate paths, request approval, publish a version and roll back future instances.
3. New workflow instances use the selected published version; existing instances remain pinned unless an audited migration is approved.
4. Missing trigger, responsible role, action, output/closure, required handoff or policy mapping blocks publication for actionable workflows.
5. Missing/uncertain SLA does not silently become a guessed deadline; the item is flagged for resolution or uses an explicitly approved “no SLA” policy.
6. A reference-only work item does not create an executable task.
7. A source work item can map to a reusable capability or shared workflow template; no one-to-one feature-per-row assumption is present.
8. AI agent permissions cannot exceed the requesting user, workflow policy or tool allowlist.
9. Configuration changes produce an audit event and human-readable diff; historical versions remain queryable.
10. A sample change to assignment, SLA or escalation takes effect for future instances after publication without application code modification.

- A user cannot access another tenant/project's restricted data by changing an ID.
- An unauthorized person cannot approve a transaction by calling the API directly.
- Retrying a PO/invoice action does not create duplicates.
- A workflow resumes from persisted state after worker restart.
- An AI answer about a company rule cites the source; unsupported questions are answered with uncertainty.
- A document cannot instruct an agent to bypass its policies.
- Superseded drawings cannot be mistaken for current IFC drawings.
- A work item cannot close while mandatory evidence is missing unless an authorized exception is logged.
- Every AI-triggered write identifies the agent run and the initiating user/policy.

---

# 19. AI Development Workflow Instructions

This section is intended to be fed to the user's AI development workflow.

## 19.1 Build instructions for coding agents

**Architecture rule:** do not implement each source work-item row as a separate feature. Implement stable construction capabilities plus a generic, validated configuration engine. Catalogue rows configure reusable capabilities and workflows; they do not dictate code/module boundaries.


1. Treat this BRD as the baseline specification. Do not generate the entire product in one unreviewed pass.
2. First create a requirement register mapping each BRD requirement to module, implementation story, acceptance criteria, test and status.
3. Import the supplied source workbook as immutable source data; preserve all 1,308 work items and their original field provenance. Keep raw source values separate from normalized operational configuration.
4. Before coding each phase, create a concise technical design, schema changes, API contract, UI route list, authorization matrix and test plan.
5. Build the platform as a modular monolith with clear module boundaries.
6. Use migrations for all schema changes; never rely on manual production database edits.
7. Generate OpenAPI from validated DTOs and keep frontend API clients typed.
8. Enforce authorization in backend services and database queries.
9. Implement audit, idempotency and error handling before enabling agent write tools.
10. Build a thin vertical slice end-to-end before broad CRUD generation.
10a. Build and test configuration lifecycle (draft/validate/simulate/approve/publish/version/rollback) before allowing workflow configuration to trigger production tasks.
10b. Prove configurability with a test that adds a department, maps a role, creates a workflow from existing step types and activates it without changing application code.
10c. Treat source fields as follows: operational fields drive execution; governance/SOP understanding and review columns are reference/provenance unless explicitly configured as a requirement.
10d. Never invent an SLA, trigger, handoff, approver or authority threshold when source data is missing or inconsistent; mark it pending owner confirmation.
11. Never invent missing business policy. Mark it `TBD—Business Owner Decision`, provide safe defaults where possible and block high-risk actions until resolved.
12. Do not use hard-coded approval limits, tax rates, statutory deadlines, vendor ratings or ROI figures unless confirmed by the business owner.
13. Do not let LLM output directly become trusted financial, legal, engineering or safety data.
14. Use synthetic demo data; do not put production contracts, employee PII or credentials into development prompts/logs.
15. Add tests with each feature and run all affected tests before marking a task complete.
16. Keep a `DECISIONS.md` for architecture/business decisions, `OPEN_QUESTIONS.md` for unresolved items and `CHANGELOG.md` for material changes.
17. Keep `IMPLEMENTATION_STATUS.md` updated after each development run.
18. Every AI tool must have an explicit input/output schema, permission scope, risk tier, timeout, cost budget, idempotency and audit.
19. Provide a human-review mode for all new agents until an owner explicitly enables a lower-risk automation policy.
20. Never claim a feature is implemented unless code, tests and a working path demonstrate it.

## 19.2 Repository layout suggestion

```text
sevents/
  apps/
    web/                    # Next.js PWA
    api/                    # NestJS REST API
    ai-service/             # Python/FastAPI AI services
    workflow-workers/       # Temporal workers
  packages/
    ui/                     # Shared UI components
    api-client/             # Generated typed API client
    shared-types/           # Shared contracts/enums
    policy/                 # Permission/authority contracts
    workflow-contracts/     # Workflow schemas/events
  infra/
    docker/
    terraform/
    ci/
  docs/
    BRD.md
    ARCHITECTURE.md
    DATA_MODEL.md
    API_STANDARDS.md
    SECURITY.md
    DECISIONS.md
    OPEN_QUESTIONS.md
    IMPLEMENTATION_STATUS.md
  tests/
    e2e/
    contract/
    ai-evaluations/
```

Monorepo tooling can be chosen by the development team; keep package boundaries explicit and avoid circular dependencies.

## 19.3 Required outputs from each AI coding run
- Files created/modified.
- Requirements implemented.
- Tests added and test results.
- Database migrations.
- API routes/contracts.
- UI routes and screenshots or test evidence where relevant.
- Security/permission implications.
- Known limitations and open decisions.
- Next smallest executable task.
- Updated implementation status.

## 19.4 Task execution strategy
Work in vertical slices:
1. Schema + service + API + UI + permissions + audit + tests.
2. Verify manually and through automated tests.
3. Merge only when acceptance criteria pass.
4. Continue to the next dependency-ready task.

Do not generate all module screens as disconnected mockups and call the ERP complete.

---

# 20. Initial Backlog / Epics

- EPIC-01: Product foundation, repo, environments, CI/CD.
- EPIC-02: Authentication, tenant/company and organization.
- EPIC-03: Roles, permissions, authority matrix and delegation.
- EPIC-04: Source catalogue import, provenance, classification, disposition and role mapping.
- EPIC-05: Configuration studio, schema validation, simulation, approval, versioned publish/rollback.
- EPIC-06: Reusable workflow runtime, dependencies, SLA calendars, evidence and escalation.
- EPIC-08: Tasks, My Work, evidence, comments and attachments.
- EPIC-08: Approval inbox and decision audit.
- EPIC-09: Documents and revision control.
- EPIC-10: Client/CRM and tendering.
- EPIC-11: Project register, WBS, milestones, budget and risks.
- EPIC-12: Technical design, drawing register, RFI and IFC.
- EPIC-13: Procurement, vendor, RFQ, PO, GRN and inventory.
- EPIC-14: Site DPR, manpower, material consumption and progress.
- EPIC-15: Quality, inspections, NCR and safety.
- EPIC-16: Finance, cost control, billing and collections.
- EPIC-17: Contract obligations, variations, claims, EOT and DLP.
- EPIC-18: AI gateway, knowledge retrieval and citations.
- EPIC-19: Agent registry, run engine, tool security and evaluation.
- EPIC-20: Project/Procurement/Finance/Claims agents.
- EPIC-21: Control Tower, analytics and ROI reporting.
- EPIC-22: Integrations, data import and migration.
- EPIC-23: Client/vendor portals and later expansion.

Each epic must be broken into small stories with explicit dependencies and acceptance tests.

---

# 21. Business Decisions Still Required

These decisions must be collected during discovery; AI development agents must not silently invent answers.

1. Final product brand and tenant/company model.
2. Number of initial users, concurrent users, projects and document storage volume.
3. First pilot project type (e.g., commercial building, residential, fit-out, civil/infrastructure).
4. Contract models and project types that must be supported first.
5. Department/role naming, reporting lines and acting deputies.
6. Actual approval limits by role and transaction type.
7. Work-item dispositions, canonical role mappings and owner-confirmed triggers/actions/outputs/handoffs; broad leadership duties are reference-only unless they create a record, decision, obligation, measurable outcome or follow-up.
8. Project schedule complexity required in MVP.
9. Accounting depth: project cost-control only vs full double-entry accounting.
10. GST/tax configuration and invoice requirements reviewed by finance/tax owners.
11. Payroll scope and any existing attendance/bank/accounting integrations.
12. Vendor/client portal requirement and rollout timing.
13. Required integrations (email, calendar, e-sign, banking, accounting, mapping, weather, WhatsApp).
14. Data hosting/residency, retention, privacy and client security requirements.
15. AI provider, budget limits, model/data handling requirements and fallback behavior.
16. Human approval thresholds and prohibited autonomous actions.
17. Languages needed for UI and site users.
18. Offline site operation requirements.
19. Target uptime, RPO/RTO and support SLA.
20. Pilot baseline metrics and business case/ROI approval.

---

# 22. Source Work-Item Directory

The supplied `SEVENTS-WORKITEMS-V2.xlsx` contains 1,308 work items across the following departments. The original work-item identifiers, department, name and responsible role must be preserved during import.

| Department | Work items | Distinct responsible-role labels |
|---|---:|---:|
| Projects | 304 | 14 |
| Technical Engineering | 196 | 8 |
| Procurement | 160 | 4 |
| Finance | 120 | 3 |
| Legal | 120 | 3 |
| Marketing & Sales | 120 | 3 |
| Research & Development | 120 | 2 |
| People & Culture | 98 | 5 |
| Company / Leadership | 70 | 2 |

### Source field mapping and runtime use

| Source workbook field | Storage / mapping | Runtime treatment |
|---|---|---|
| `S.No.` | `source_serial_number` plus immutable source-row key | Traceability only; UUID is system ID |
| `Department` | Raw label + mapping to canonical department ID | Operational after mapping/validation |
| `Work Item Name` | Raw title + normalized display title | Catalogue label; not automatically a feature |
| `Who is Responsible` | Raw role label + mapping to canonical role/assignment rule | Operational only after mapping and authority review |
| `Description` | Preserve full source text | Reference; selectively derive normalized fields for owner review |
| `Trigger` | Preserve raw value + normalized trigger definition | Operational only after validated |
| `Action` | Preserve raw value + mapped capability/step(s) | Operational only after mapped to supported actions |
| `Output/Evidence` | Preserve raw value + evidence/closure rule | Operational when required by process owner |
| `Control/Handoff` | Preserve raw value + dependency/next-owner rule | Operational when validated |
| `Continuity/Escalation` | Preserve raw value + exception/escalation policy | Operational when validated |
| `Timing` | Preserve raw value + normalized SLA profile | Do not invent; unknown/unreliable values remain `TBD` |
| `Governance Understanding` | Reference text | Search/agent context; not mandatory task input by default |
| `Governance Inputs for SOP Creation` | Reference text | Optional process-design/SOP aid; not mandatory task input by default |
| `Reviewed by Kali`, `Reviewed by Sharique` | Source review metadata | Provenance only; not approval to publish or execute |

The source workbook is a source catalogue, not an executable specification by itself. Each item must be classified and validated by its process owner before an operational workflow is published. Long narrative fields should not be copied into every runtime task form unless a concrete operational need exists.

### Required catalogue review fields

Add normalized fields in a separate review/configuration dataset: `disposition`, `capability_mapping`, `workflow_template_id`, `priority`, `risk_tier`, `process_owner`, `mapping_status`, `trigger_confirmed`, `action_mapping_confirmed`, `output_confirmed`, `handoff_confirmed`, `sla_confirmed`, `approval_policy_id`, `agent_policy_id`, `phase_target`, `review_notes`, `reviewed_by`, `reviewed_at`, `published_version`.

### Leadership, paper-based and broad-responsibility items

- Create an executable task only if there is a clear trigger, accountable owner, output/decision/obligation and closure/follow-up.
- Strategic leadership statements without a discrete deliverable remain reference/policy records.
- Meetings may create decision records and action items; the meeting itself is not automatically an ERP task.
- Paper signatures may be tracked as a physical-signature-required step, custody/location record, scan/evidence attachment and completion status. Do not assume a scanned image is a legally valid e-signature.
- Reserved ownership decisions, material contract/finance approvals, engineering sign-off and safety-critical authorization remain human decisions, with configurable routing and evidence capture.
- A general responsibility may produce periodic review tasks only when the business owner defines a meaningful cadence and output.

## 22.1 Full source work-item index

The following appendix preserves the original work-item names and role labels for traceability. Detailed source fields remain in the source workbook and should be imported as structured data rather than manually retyped.

### Company / Leadership — #1 
- **Work item:** Approve the company vision, purpose and ownership expectations
- **Responsible role:** Chairman
### Company / Leadership — #2 
- **Work item:** Approve annual strategic priorities and enterprise risk appetite
- **Responsible role:** Chairman
### Company / Leadership — #3 
- **Work item:** Approve the ownership reserved-matter and Delegation-of-Authority matrix
- **Responsible role:** Chairman
### Company / Leadership — #4 
- **Work item:** Approve material changes to ownership, legal structure or capital structure
- **Responsible role:** Chairman
### Company / Leadership — #5 
- **Work item:** Maintain the ownership governance calendar and decision discipline
- **Responsible role:** Chairman
### Company / Leadership — #6 
- **Work item:** Appoint the CEO and approve the CEO mandate and employment terms
- **Responsible role:** Chairman
### Company / Leadership — #7 
- **Work item:** Approve the CEO's annual objectives, KPIs and authority boundaries
- **Responsible role:** Chairman
### Company / Leadership — #8 
- **Work item:** Conduct periodic CEO performance and leadership reviews
- **Responsible role:** Chairman
### Company / Leadership — #9 
- **Work item:** Approve CEO succession, emergency cover and leadership-continuity arrangements
- **Responsible role:** Chairman
### Company / Leadership — #10 
- **Work item:** Resolve strategic accountability deadlocks between the CEO and executives
- **Responsible role:** Chairman
### Company / Leadership — #11 
- **Work item:** Approve the annual company budget and capital-allocation envelope
- **Responsible role:** Chairman
### Company / Leadership — #12 
- **Work item:** Approve major investments, borrowing, guarantees and commitments above authority
- **Responsible role:** Chairman
### Company / Leadership — #13 
- **Work item:** Review annual financial statements, audit findings and management responses
- **Responsible role:** Chairman
### Company / Leadership — #14 
- **Work item:** Review liquidity, solvency, major exposure and enterprise-financial risk
- **Responsible role:** Chairman
### Company / Leadership — #15 
- **Work item:** Decide shareholder funding, retained earnings and distribution recommendations
- **Responsible role:** Chairman
### Company / Leadership — #16 
- **Work item:** Review company performance, strategic portfolio and corrective priorities
- **Responsible role:** Chairman
### Company / Leadership — #17 
- **Work item:** Approve entry into or exit from major markets, services and strategic alliances
- **Responsible role:** Chairman
### Company / Leadership — #18 
- **Work item:** Review material legal, regulatory, ethical and reputation matters
- **Responsible role:** Chairman
### Company / Leadership — #19 
- **Work item:** Direct the ownership response to enterprise crisis and business-continuity threats
- **Responsible role:** Chairman
### Company / Leadership — #20 
- **Work item:** Chair ownership meetings, approve minutes and monitor reserved actions
- **Responsible role:** Chairman
### Company / Leadership — #21 
- **Work item:** Translate ownership vision into the multi-year company strategy
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #22 
- **Work item:** Convert company strategy into the annual operating plan and priorities
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #23 
- **Work item:** Set company-wide objectives, KPIs and executive success measures
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #24 
- **Work item:** Approve departmental plans, resource priorities and operating assumptions
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #25 
- **Work item:** Communicate approved strategy and annual priorities to all functional chiefs
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #26 
- **Work item:** Set the executive-governance calendar and management-review cadence
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #27 
- **Work item:** Approve departmental mandates, accountabilities and process ownership
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #28 
- **Work item:** Approve executive authority limits, deputies and temporary delegations
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #29 
- **Work item:** Chair executive meetings and control the company decision/action register
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #30 
- **Work item:** Resolve cross-department ownership, priority and authority conflicts
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #31 
- **Work item:** Review the integrated company performance dashboard and material exceptions
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #32 
- **Work item:** Review project portfolio progress, profitability, cash and delivery exposure
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #33 
- **Work item:** Direct company and project recovery plans and corrective priorities
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #34 
- **Work item:** Approve executive hold, recovery, restart or closure decisions within authority
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #35 
- **Work item:** Report company performance, risks and decisions to the Chairman
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #36 
- **Work item:** Approve bid/no-bid decisions for major and strategic opportunities
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #37 
- **Work item:** Approve integrated commercial strategy and exceptions within CEO authority
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #38 
- **Work item:** Review pipeline quality, conversion, backlog and strategic revenue exposure
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #39 
- **Work item:** Lead executive engagement and resolution for strategic client escalations
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #40 
- **Work item:** Approve contract-award readiness after all functional clearances are complete
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #41 
- **Work item:** Approve the management budget before ownership submission
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #42 
- **Work item:** Approve company forecasts, reforecasts and financial recovery assumptions
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #43 
- **Work item:** Review cash flow, working capital, collections and payment priorities
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #44 
- **Work item:** Authorise commitments and exceptions above functional limits within CEO authority
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #45 
- **Work item:** Approve investment and funding business cases for Chairman consideration
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #46 
- **Work item:** Approve executive project-mobilisation readiness and strategic conditions
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #47 
- **Work item:** Review critical project progress, delay, margin and recovery requirements
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #48 
- **Work item:** Resolve competing project-resource and organisational priorities
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #49 
- **Work item:** Decide major delivery, quality, safety and client exceptions within authority
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #50 
- **Work item:** Approve executive handover, DLP and project-closeout gate decisions
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #51 
- **Work item:** Approve company organisation design and workforce priorities
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #52 
- **Work item:** Appoint functional chiefs and approve their annual objectives within authority
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #53 
- **Work item:** Approve executive succession, development and temporary-cover plans
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #54 
- **Work item:** Approve compensation, policy and employment exceptions above CPCO authority
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #55 
- **Work item:** Review culture, engagement, executive performance and leadership conduct
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #56 
- **Work item:** Own the enterprise-risk review and executive risk-treatment priorities
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #57 
- **Work item:** Review high-risk contracts, claims, disputes and settlement strategies
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #58 
- **Work item:** Approve executive responses to regulators and serious incidents
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #59 
- **Work item:** Lead company crisis, emergency and business-continuity management
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #60 
- **Work item:** Review insurance, licence, compliance and remediation status
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #61 
- **Work item:** Sponsor the company operating system and SOP-governance programme
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #62 
- **Work item:** Approve the FirstBit roadmap and material workflow changes within authority
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #63 
- **Work item:** Approve enterprise master-data, access and digital-control principles
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #64 
- **Work item:** Review process performance, audit findings and improvement closure
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #65 
- **Work item:** Approve innovation pilots and scale-up decisions within CEO authority
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #66 
- **Work item:** Prepare complete ownership submissions and reserved-matter recommendations
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #67 
- **Work item:** Represent the company with strategic stakeholders and institutional partners
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #68 
- **Work item:** Approve corporate communications and executive reputation responses
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #69 
- **Work item:** Maintain the CEO decision, risk, dependency and executive-action registers
- **Responsible role:** Chief Executive Officer (CEO)
### Company / Leadership — #70 
- **Work item:** Maintain CEO continuity, emergency delegation and acting-authority readiness
- **Responsible role:** Chief Executive Officer (CEO)
### Technical Engineering — #71 
- **Work item:** Set Technical Engineering strategy, design standards and annual objectives
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #72 
- **Work item:** Assign technical process owners, discipline responsibilities and authority limits
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #73 
- **Work item:** Approve technical resource plan, competency requirements and external consultant use
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #74 
- **Work item:** Report Technical Engineering workload, KPIs, risks and corrective actions
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #75 
- **Work item:** Accept qualified lead and verify the technical handover package
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #76 
- **Work item:** Approve preliminary site-visit and survey plan
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #77 
- **Work item:** Decide preliminary feasibility, constraints and technical no-go conditions
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #78 
- **Work item:** Approve preliminary concept and indicative budget basis for client alignment
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #79 
- **Work item:** Define paid detailed-design scope, deliverables, programme and fee basis
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #80 
- **Work item:** Approve design quotation or agreement before client issue
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #81 
- **Work item:** Confirm client acceptance and Finance payment before design activation
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #82 
- **Work item:** Chair detailed-design kickoff and assign discipline deliverables
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #83 
- **Work item:** Approve project design basis, codes, assumptions and technical criteria
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #84 
- **Work item:** Direct multidisciplinary design coordination and clash closure
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #85 
- **Work item:** Approve technical specifications, materials and approved-brand requirements
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #86 
- **Work item:** Approve construction-ready design after interdisciplinary QA review
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #87 
- **Work item:** Approve controlled IFC release and revision status
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #88 
- **Work item:** Approve authority, permit and NOC strategy and submission responsibility
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #89 
- **Work item:** Review and authorise authority submission packages
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #90 
- **Work item:** Decide material design deviations, value engineering and technical changes
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #91 
- **Work item:** Control critical RFIs, technical clarifications and site design issues
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #92 
- **Work item:** Validate final civil and MEP BOQ against coordinated design
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #93 
- **Work item:** Approve consolidated technical quotation basis, exclusions and margin inputs
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #94 
- **Work item:** Conduct formal CTO-to-COO construction-ready handover
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #95 
- **Work item:** Approve technical closeout, as-built, final-inspection and lessons-learned package
- **Responsible role:** Chief Technical Officer (CTO)
### Technical Engineering — #96 
- **Work item:** Receive and validate client brief, lead record and technical handover
- **Responsible role:** Architect (Lead)
### Technical Engineering — #97 
- **Work item:** Plan architectural site survey, measurement and information requirements
- **Responsible role:** Architect (Lead)
### Technical Engineering — #98 
- **Work item:** Record site conditions, photographs, dimensions, constraints and interfaces
- **Responsible role:** Architect (Lead)
### Technical Engineering — #99 
- **Work item:** Prepare controlled architectural design brief, assumptions and exclusions
- **Responsible role:** Architect (Lead)
### Technical Engineering — #100 
- **Work item:** Identify planning, access, authority and project-specific design constraints
- **Responsible role:** Architect (Lead)
### Technical Engineering — #101 
- **Work item:** Develop preliminary site planning and space programme
- **Responsible role:** Architect (Lead)
### Technical Engineering — #102 
- **Work item:** Prepare alternative architectural concept options
- **Responsible role:** Architect (Lead)
### Technical Engineering — #103 
- **Work item:** Prepare concept drawings, massing and material intent
- **Responsible role:** Architect (Lead)
### Technical Engineering — #104 
- **Work item:** Present concept and feasibility basis to client and internal reviewers
- **Responsible role:** Architect (Lead)
### Technical Engineering — #105 
- **Work item:** Record client comments, design decisions and concept-freeze status
- **Responsible role:** Architect (Lead)
### Technical Engineering — #106 
- **Work item:** Prepare coordinated architectural plans, elevations and sections
- **Responsible role:** Architect (Lead)
### Technical Engineering — #107 
- **Work item:** Develop architectural details, schedules and specification requirements
- **Responsible role:** Architect (Lead)
### Technical Engineering — #108 
- **Work item:** Coordinate finishes, materials, colours and sample requirements
- **Responsible role:** Architect (Lead)
### Technical Engineering — #109 
- **Work item:** Coordinate accessibility, fire-life-safety and planning design requirements
- **Responsible role:** Architect (Lead)
### Technical Engineering — #110 
- **Work item:** Review constructability, tolerances, waterproofing and buildability interfaces
- **Responsible role:** Architect (Lead)
### Technical Engineering — #111 
- **Work item:** Maintain area schedules, room data and design deliverable registers
- **Responsible role:** Architect (Lead)
### Technical Engineering — #112 
- **Work item:** Monitor architectural programme, deliverable status and overdue actions
- **Responsible role:** Architect (Lead)
### Technical Engineering — #113 
- **Work item:** Coordinate architectural design with structural requirements
- **Responsible role:** Architect (Lead)
### Technical Engineering — #114 
- **Work item:** Coordinate architectural design with HVAC, plumbing and electrical routes
- **Responsible role:** Architect (Lead)
### Technical Engineering — #115 
- **Work item:** Coordinate openings, builders work, plant spaces and ceiling interfaces
- **Responsible role:** Architect (Lead)
### Technical Engineering — #116 
- **Work item:** Lead clash review, design-comment allocation and closure
- **Responsible role:** Architect (Lead)
### Technical Engineering — #117 
- **Work item:** Review specialist-consultant and vendor design interfaces
- **Responsible role:** Architect (Lead)
### Technical Engineering — #118 
- **Work item:** Compile architectural authority and NOC submission package
- **Responsible role:** Architect (Lead)
### Technical Engineering — #119 
- **Work item:** Respond to architectural authority comments and resubmission requirements
- **Responsible role:** Architect (Lead)
### Technical Engineering — #120 
- **Work item:** Close authority comments and update the approved architectural design basis
- **Responsible role:** Architect (Lead)
### Technical Engineering — #121 
- **Work item:** Perform final architectural IFC completeness and coordination check
- **Responsible role:** Architect (Lead)
### Technical Engineering — #122 
- **Work item:** Issue controlled architectural package and revision index to Document Control
- **Responsible role:** Architect (Lead)
### Technical Engineering — #123 
- **Work item:** Conduct architectural technical handover to Projects
- **Responsible role:** Architect (Lead)
### Technical Engineering — #124 
- **Work item:** Respond to site RFIs and review architectural shop drawings and material submittals
- **Responsible role:** Architect (Lead)
### Technical Engineering — #125 
- **Work item:** Review architectural as-built records, close design punch items and capture lessons learned
- **Responsible role:** Architect (Lead)
### Technical Engineering — #126 
- **Work item:** Receive approved architectural inputs, mark-ups and drawing instructions
- **Responsible role:** Civil Draftsman
### Technical Engineering — #127 
- **Work item:** Set up project CAD files, coordinates, layers, title blocks and drawing standards
- **Responsible role:** Civil Draftsman
### Technical Engineering — #128 
- **Work item:** Maintain approved drawing templates, symbols and standard details
- **Responsible role:** Civil Draftsman
### Technical Engineering — #129 
- **Work item:** Prepare existing-condition and measured-survey drawings
- **Responsible role:** Civil Draftsman
### Technical Engineering — #130 
- **Work item:** Prepare location, site and setting-out drawings
- **Responsible role:** Civil Draftsman
### Technical Engineering — #131 
- **Work item:** Prepare architectural floor plans
- **Responsible role:** Civil Draftsman
### Technical Engineering — #132 
- **Work item:** Prepare architectural elevations and sections
- **Responsible role:** Civil Draftsman
### Technical Engineering — #133 
- **Work item:** Prepare enlarged plans and construction details
- **Responsible role:** Civil Draftsman
### Technical Engineering — #134 
- **Work item:** Prepare door, window, finish and room schedules
- **Responsible role:** Civil Draftsman
### Technical Engineering — #135 
- **Work item:** Prepare external works and civil interface drawings
- **Responsible role:** Civil Draftsman
### Technical Engineering — #136 
- **Work item:** Prepare presentation and authority drawing sheets
- **Responsible role:** Civil Draftsman
### Technical Engineering — #137 
- **Work item:** Overlay and coordinate structural drawing backgrounds
- **Responsible role:** Civil Draftsman
### Technical Engineering — #138 
- **Work item:** Overlay and coordinate MEP routes, openings and builders-work information
- **Responsible role:** Civil Draftsman
### Technical Engineering — #139 
- **Work item:** Incorporate approved design-review and clash-resolution comments
- **Responsible role:** Civil Draftsman
### Technical Engineering — #140 
- **Work item:** Prepare IFC drawing sheets from approved design information
- **Responsible role:** Civil Draftsman
### Technical Engineering — #141 
- **Work item:** Maintain drawing numbers, revisions, status and issue purpose
- **Responsible role:** Civil Draftsman
### Technical Engineering — #142 
- **Work item:** Issue corrected drawings for Architect and CTO checking
- **Responsible role:** Civil Draftsman
### Technical Engineering — #143 
- **Work item:** Update drawing register and transmit approved files to Document Control
- **Responsible role:** Civil Draftsman
### Technical Engineering — #144 
- **Work item:** Prepare architectural and civil as-built drawings from verified red-lines
- **Responsible role:** Civil Draftsman
### Technical Engineering — #145 
- **Work item:** Archive controlled editable files, references and superseded drawing history
- **Responsible role:** Civil Draftsman
### Technical Engineering — #146 
- **Work item:** Review architectural brief, site survey and available geotechnical information
- **Responsible role:** Structural Designer
### Technical Engineering — #147 
- **Work item:** Establish structural design criteria, codes, loads and assumptions
- **Responsible role:** Structural Designer
### Technical Engineering — #148 
- **Work item:** Develop preliminary structural system and framing options
- **Responsible role:** Structural Designer
### Technical Engineering — #149 
- **Work item:** Identify required tests, investigations and missing structural inputs
- **Responsible role:** Structural Designer
### Technical Engineering — #150 
- **Work item:** Prepare structural analysis model and calculation basis
- **Responsible role:** Structural Designer
### Technical Engineering — #151 
- **Work item:** Design foundations and substructure elements
- **Responsible role:** Structural Designer
### Technical Engineering — #152 
- **Work item:** Design slabs, beams, columns and load-bearing elements
- **Responsible role:** Structural Designer
### Technical Engineering — #153 
- **Work item:** Design structural steel or specialist structural elements where applicable
- **Responsible role:** Structural Designer
### Technical Engineering — #154 
- **Work item:** Design retaining walls, tanks and external structural elements where applicable
- **Responsible role:** Structural Designer
### Technical Engineering — #155 
- **Work item:** Prepare reinforcement, structural details and connection requirements
- **Responsible role:** Structural Designer
### Technical Engineering — #156 
- **Work item:** Prepare structural member, reinforcement and design schedules
- **Responsible role:** Structural Designer
### Technical Engineering — #157 
- **Work item:** Maintain controlled structural calculations and design-check records
- **Responsible role:** Structural Designer
### Technical Engineering — #158 
- **Work item:** Coordinate structural grids, levels and geometry with Architecture
- **Responsible role:** Structural Designer
### Technical Engineering — #159 
- **Work item:** Coordinate structural openings, sleeves, plant loads and MEP requirements
- **Responsible role:** Structural Designer
### Technical Engineering — #160 
- **Work item:** Review structural constructability, sequence and temporary-condition risks
- **Responsible role:** Structural Designer
### Technical Engineering — #161 
- **Work item:** Complete independent structural check and close review comments
- **Responsible role:** Structural Designer
### Technical Engineering — #162 
- **Work item:** Prepare structural authority submission drawings and calculations
- **Responsible role:** Structural Designer
### Technical Engineering — #163 
- **Work item:** Respond to structural authority comments and revise controlled design
- **Responsible role:** Structural Designer
### Technical Engineering — #164 
- **Work item:** Release checked structural IFC package with calculation and revision evidence
- **Responsible role:** Structural Designer
### Technical Engineering — #165 
- **Work item:** Respond to structural RFIs, design clarifications and approved variations
- **Responsible role:** Structural Designer
### Technical Engineering — #166 
- **Work item:** Review structural shop drawings, material submittals and critical work inspections
- **Responsible role:** Structural Designer
### Technical Engineering — #167 
- **Work item:** Review structural as-built information and close outstanding technical actions
- **Responsible role:** Structural Designer
### Technical Engineering — #168 
- **Work item:** Receive approved architectural brief and MEP scope
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #169 
- **Work item:** Survey existing HVAC, plumbing and drainage services where applicable
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #170 
- **Work item:** Establish HVAC and plumbing design criteria, assumptions and authority requirements
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #171 
- **Work item:** Identify missing utility data, tests, capacities and specialist inputs
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #172 
- **Work item:** Prepare cooling-load and ventilation calculations
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #173 
- **Work item:** Select preliminary HVAC systems and equipment capacities
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #174 
- **Work item:** Prepare HVAC zoning, ductwork and air-distribution layouts
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #175 
- **Work item:** Prepare refrigerant, chilled-water or condensate piping layouts where applicable
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #176 
- **Work item:** Size ducts, pipes and major HVAC components
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #177 
- **Work item:** Prepare HVAC schematics, details and equipment schedules
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #178 
- **Work item:** Coordinate ventilation, exhaust and fresh-air requirements
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #179 
- **Work item:** Prepare water-demand and storage calculations
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #180 
- **Work item:** Prepare domestic water-supply layouts and schematics
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #181 
- **Work item:** Prepare soil, waste and vent drainage layouts
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #182 
- **Work item:** Prepare storm-water drainage layouts where applicable
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #183 
- **Work item:** Prepare pump, tank, heater and plumbing-equipment schedules
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #184 
- **Work item:** Size plumbing pipes, drainage and water-service components
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #185 
- **Work item:** Prepare plumbing risers, details and fixture schedules
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #186 
- **Work item:** Coordinate HVAC and plumbing plant spaces, routes, ceilings and access
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #187 
- **Work item:** Coordinate MEP openings, sleeves and builders-work requirements
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #188 
- **Work item:** Prepare HVAC and plumbing authority submission and comment responses
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #189 
- **Work item:** Release checked HVAC and plumbing IFC package and revision index
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #190 
- **Work item:** Respond to HVAC and plumbing RFIs and review technical submittals
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #191 
- **Work item:** Support HVAC and plumbing testing, commissioning and inspection requirements
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #192 
- **Work item:** Review HVAC and plumbing as-built drawings and close technical actions
- **Responsible role:** HVAC & Plumbing Draftsman
### Technical Engineering — #193 
- **Work item:** Receive approved architectural brief and electrical scope
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #194 
- **Work item:** Survey existing electrical and ELV services where applicable
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #195 
- **Work item:** Establish electrical design criteria, assumptions and authority requirements
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #196 
- **Work item:** Identify missing utility data, loads and specialist-system inputs
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #197 
- **Work item:** Prepare connected-load, demand and diversity assessment
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #198 
- **Work item:** Prepare power-distribution concept and single-line diagrams
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #199 
- **Work item:** Prepare MDB, SMDB and DB schedules
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #200 
- **Work item:** Prepare power, socket and equipment-connection layouts
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #201 
- **Work item:** Prepare cable, containment and routing requirements
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #202 
- **Work item:** Prepare earthing, bonding and lightning-protection layouts where applicable
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #203 
- **Work item:** Prepare lighting layouts and control-zone requirements
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #204 
- **Work item:** Prepare emergency and exit-lighting layouts
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #205 
- **Work item:** Prepare fire-alarm layouts and interfaces where within approved scope
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #206 
- **Work item:** Prepare data, telephone, CCTV and access-control layouts where within approved scope
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #207 
- **Work item:** Prepare ELV schematics, schedules and equipment requirements
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #208 
- **Work item:** Coordinate generator, UPS and specialist-power systems where applicable
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #209 
- **Work item:** Coordinate electrical containment, ceiling and MEP interfaces
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #210 
- **Work item:** Coordinate builders-work openings, equipment loads and plant connections
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #211 
- **Work item:** Prepare electrical authority calculations, forms and submission drawings
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #212 
- **Work item:** Respond to authority and interdisciplinary review comments
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #213 
- **Work item:** Release checked electrical and ELV IFC package and revision index
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #214 
- **Work item:** Respond to electrical RFIs and review technical submittals
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #215 
- **Work item:** Support electrical testing, commissioning and inspection requirements
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #216 
- **Work item:** Review electrical and ELV as-built drawings and close technical actions
- **Responsible role:** Electrical Draftsman
### Technical Engineering — #217 
- **Work item:** Receive and register civil tender package and submission deadline
- **Responsible role:** Civil Estimator
### Technical Engineering — #218 
- **Work item:** Review civil, architectural and structural tender scope
- **Responsible role:** Civil Estimator
### Technical Engineering — #219 
- **Work item:** Identify missing civil information, contradictions and commercial risks
- **Responsible role:** Civil Estimator
### Technical Engineering — #220 
- **Work item:** Prepare civil tender queries, assumptions and clarification log
- **Responsible role:** Civil Estimator
### Technical Engineering — #221 
- **Work item:** Attend civil tender site visit and record pricing constraints
- **Responsible role:** Civil Estimator
### Technical Engineering — #222 
- **Work item:** Prepare civil and earthworks quantity takeoff
- **Responsible role:** Civil Estimator
### Technical Engineering — #223 
- **Work item:** Prepare architectural and finishing quantity takeoff
- **Responsible role:** Civil Estimator
### Technical Engineering — #224 
- **Work item:** Prepare structural concrete and reinforcement quantity takeoff
- **Responsible role:** Civil Estimator
### Technical Engineering — #225 
- **Work item:** Prepare masonry, waterproofing and roofing quantity takeoff
- **Responsible role:** Civil Estimator
### Technical Engineering — #226 
- **Work item:** Prepare external works and provisional-item quantity takeoff
- **Responsible role:** Civil Estimator
### Technical Engineering — #227 
- **Work item:** Reconcile civil takeoff against BOQ, drawings and specifications
- **Responsible role:** Civil Estimator
### Technical Engineering — #228 
- **Work item:** Prepare civil supplier and subcontractor RFQ packages
- **Responsible role:** Civil Estimator
### Technical Engineering — #229 
- **Work item:** Coordinate civil market quotations through Procurement
- **Responsible role:** Civil Estimator
### Technical Engineering — #230 
- **Work item:** Prepare civil quotation comparison and compliance review
- **Responsible role:** Civil Estimator
### Technical Engineering — #231 
- **Work item:** Resolve civil vendor exclusions, deviations and unpriced scope
- **Responsible role:** Civil Estimator
### Technical Engineering — #232 
- **Work item:** Prepare civil labour, material, plant and subcontract rate build-ups
- **Responsible role:** Civil Estimator
### Technical Engineering — #233 
- **Work item:** Apply civil productivity, wastage and logistics assumptions
- **Responsible role:** Civil Estimator
### Technical Engineering — #234 
- **Work item:** Price preliminaries, temporary works and project constraints
- **Responsible role:** Civil Estimator
### Technical Engineering — #235 
- **Work item:** Prepare civil risk, opportunity, exclusion and contingency register
- **Responsible role:** Civil Estimator
### Technical Engineering — #236 
- **Work item:** Develop civil value-engineering and alternative pricing options
- **Responsible role:** Civil Estimator
### Technical Engineering — #237 
- **Work item:** Prepare priced civil BOQ and commercial summary
- **Responsible role:** Civil Estimator
### Technical Engineering — #238 
- **Work item:** Complete civil estimate self-check and reconciliation
- **Responsible role:** Civil Estimator
### Technical Engineering — #239 
- **Work item:** Submit civil estimate for CTO review and approved margin integration
- **Responsible role:** Civil Estimator
### Technical Engineering — #240 
- **Work item:** Revise civil offer for client clarification and negotiation
- **Responsible role:** Civil Estimator
### Technical Engineering — #241 
- **Work item:** Handover final civil estimate, assumptions and cost baseline after award
- **Responsible role:** Civil Estimator
### Technical Engineering — #242 
- **Work item:** Receive and register MEP tender package and submission deadline
- **Responsible role:** MEP Estimator
### Technical Engineering — #243 
- **Work item:** Review HVAC, plumbing, electrical and ELV tender scope
- **Responsible role:** MEP Estimator
### Technical Engineering — #244 
- **Work item:** Identify missing MEP information, contradictions and commercial risks
- **Responsible role:** MEP Estimator
### Technical Engineering — #245 
- **Work item:** Prepare MEP tender queries, assumptions and clarification log
- **Responsible role:** MEP Estimator
### Technical Engineering — #246 
- **Work item:** Attend MEP tender site visit and record services constraints
- **Responsible role:** MEP Estimator
### Technical Engineering — #247 
- **Work item:** Prepare HVAC equipment, ductwork and piping quantity takeoff
- **Responsible role:** MEP Estimator
### Technical Engineering — #248 
- **Work item:** Prepare plumbing, drainage and water-system quantity takeoff
- **Responsible role:** MEP Estimator
### Technical Engineering — #249 
- **Work item:** Prepare fire-protection quantity takeoff where included in scope
- **Responsible role:** MEP Estimator
### Technical Engineering — #250 
- **Work item:** Prepare electrical power and lighting quantity takeoff
- **Responsible role:** MEP Estimator
### Technical Engineering — #251 
- **Work item:** Prepare ELV, containment and specialist-system quantity takeoff
- **Responsible role:** MEP Estimator
### Technical Engineering — #252 
- **Work item:** Reconcile MEP takeoff against BOQ, drawings and specifications
- **Responsible role:** MEP Estimator
### Technical Engineering — #253 
- **Work item:** Prepare MEP supplier and specialist-subcontractor RFQ packages
- **Responsible role:** MEP Estimator
### Technical Engineering — #254 
- **Work item:** Coordinate MEP market quotations through Procurement
- **Responsible role:** MEP Estimator
### Technical Engineering — #255 
- **Work item:** Prepare MEP quotation comparison and technical-commercial compliance review
- **Responsible role:** MEP Estimator
### Technical Engineering — #256 
- **Work item:** Resolve MEP vendor exclusions, deviations and unpriced scope
- **Responsible role:** MEP Estimator
### Technical Engineering — #257 
- **Work item:** Prepare MEP labour, material, equipment and subcontract rate build-ups
- **Responsible role:** MEP Estimator
### Technical Engineering — #258 
- **Work item:** Apply MEP productivity, access, testing and logistics assumptions
- **Responsible role:** MEP Estimator
### Technical Engineering — #259 
- **Work item:** Price builders-work, authority, testing and commissioning allowances
- **Responsible role:** MEP Estimator
### Technical Engineering — #260 
- **Work item:** Prepare MEP risk, opportunity, exclusion and contingency register
- **Responsible role:** MEP Estimator
### Technical Engineering — #261 
- **Work item:** Develop MEP value-engineering and alternative-system pricing options
- **Responsible role:** MEP Estimator
### Technical Engineering — #262 
- **Work item:** Prepare priced MEP BOQ and commercial summary
- **Responsible role:** MEP Estimator
### Technical Engineering — #263 
- **Work item:** Complete MEP estimate self-check and reconciliation
- **Responsible role:** MEP Estimator
### Technical Engineering — #264 
- **Work item:** Submit MEP estimate for CTO review and approved margin integration
- **Responsible role:** MEP Estimator
### Technical Engineering — #265 
- **Work item:** Revise MEP offer for client clarification and negotiation
- **Responsible role:** MEP Estimator
### Technical Engineering — #266 
- **Work item:** Handover final MEP estimate, assumptions and cost baseline after award
- **Responsible role:** MEP Estimator
### Projects — #267 
- **Work item:** Set Projects strategy, delivery standards and annual operating objectives
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #268 
- **Work item:** Approve Projects organisation, delegated authority and accountability structure
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #269 
- **Work item:** Prioritise the project portfolio and allocate delivery capacity
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #270 
- **Work item:** Establish portfolio KPIs, risk thresholds and exception-reporting rules
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #271 
- **Work item:** Report portfolio delivery, resource and corrective-action status to the CEO
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #272 
- **Work item:** Review the CTO construction-ready handover package for completeness
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #273 
- **Work item:** Accept, conditionally accept or reject the technical-commercial-financial handover
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #274 
- **Work item:** Appoint the Responsible Project Engineer and confirm execution accountability
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #275 
- **Work item:** Approve the project readiness and mobilisation gate conditions
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #276 
- **Work item:** Approve execution governance, reporting cadence and project stage gates
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #277 
- **Work item:** Conduct the weekly project performance and exception review
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #278 
- **Work item:** Review daily critical delivery, safety, client and supply-chain exceptions
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #279 
- **Work item:** Review monthly forecast-at-completion, margin and cash inputs with Finance
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #280 
- **Work item:** Approve cross-project manpower, plant and equipment reallocation
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #281 
- **Work item:** Monitor portfolio procurement, authority, client and technical dependencies
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #282 
- **Work item:** Approve material programme recovery plans and controlled rebaselines
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #283 
- **Work item:** Decide major construction-sequence, temporary-work and site-strategy exceptions
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #284 
- **Work item:** Resolve cross-department conflicts affecting project delivery
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #285 
- **Work item:** Approve suspension and controlled restart of affected project work
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #286 
- **Work item:** Escalate project exceptions beyond delegated authority to the CEO
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #287 
- **Work item:** Approve project testing, commissioning and completion readiness
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #288 
- **Work item:** Confirm practical completion and formal client handover readiness
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #289 
- **Work item:** Govern DLP defect closure, retention and outstanding obligations
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #290 
- **Work item:** Approve operational closeout and release of project resources
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #291 
- **Work item:** Sponsor lessons learned, root-cause actions and operating-process improvements
- **Responsible role:** Chief Operations Officer (COO)
### Projects — #292 
- **Work item:** Accept project assignment and verify the COO handover record
- **Responsible role:** Project Engineer (Lead)
### Projects — #293 
- **Work item:** Validate contract scope, IFC package, BOQ, permits and approved assumptions
- **Responsible role:** Project Engineer (Lead)
### Projects — #294 
- **Work item:** Establish project codes, controlled files, registers and baseline references
- **Responsible role:** Project Engineer (Lead)
### Projects — #295 
- **Work item:** Prepare project organisation, RACI and communication matrix
- **Responsible role:** Project Engineer (Lead)
### Projects — #296 
- **Work item:** Open project risk, constraint, decision and assumption registers
- **Responsible role:** Project Engineer (Lead)
### Projects — #297 
- **Work item:** Prepare the project work breakdown structure and baseline programme
- **Responsible role:** Project Engineer (Lead)
### Projects — #298 
- **Work item:** Prepare mobilisation, access, temporary-facility and site-logistics plans
- **Responsible role:** Project Engineer (Lead)
### Projects — #299 
- **Work item:** Prepare manpower, subcontractor, plant and equipment resource plans
- **Responsible role:** Project Engineer (Lead)
### Projects — #300 
- **Work item:** Prepare procurement-package, long-lead and required-on-site schedules
- **Responsible role:** Project Engineer (Lead)
### Projects — #301 
- **Work item:** Prepare method-statement, inspection, submittal and authority schedules
- **Responsible role:** Project Engineer (Lead)
### Projects — #302 
- **Work item:** Prepare rolling two-week and four-week lookahead plans and work-front releases
- **Responsible role:** Project Engineer (Lead)
### Projects — #303 
- **Work item:** Chair the daily site coordination and constraint-removal meeting
- **Responsible role:** Project Engineer (Lead)
### Projects — #304 
- **Work item:** Release and coordinate civil and MEP work fronts
- **Responsible role:** Project Engineer (Lead)
### Projects — #305 
- **Work item:** Coordinate subcontractors, logistics, plant and shared site access
- **Responsible role:** Project Engineer (Lead)
### Projects — #306 
- **Work item:** Maintain RFI, submittal, inspection, NCR and action registers
- **Responsible role:** Project Engineer (Lead)
### Projects — #307 
- **Work item:** Control latest approved drawings and prevent superseded site use
- **Responsible role:** Project Engineer (Lead)
### Projects — #308 
- **Work item:** Consolidate daily progress, manpower, material and equipment records
- **Responsible role:** Project Engineer (Lead)
### Projects — #309 
- **Work item:** Submit verified procurement requisitions linked to IFC, BOQ and need dates
- **Responsible role:** Project Engineer (Lead)
### Projects — #310 
- **Work item:** Coordinate procurement status, expediting and critical deliveries
- **Responsible role:** Project Engineer (Lead)
### Projects — #311 
- **Work item:** Certify site receipt, allocation and acceptance evidence for project materials
- **Responsible role:** Project Engineer (Lead)
### Projects — #312 
- **Work item:** Review Quantity Surveyor measurements, variations and billing support
- **Responsible role:** Project Engineer (Lead)
### Projects — #313 
- **Work item:** Certify supplier and subcontractor operational evidence for payment processing
- **Responsible role:** Project Engineer (Lead)
### Projects — #314 
- **Work item:** Coordinate project billing, collection and cash-priority actions with Finance
- **Responsible role:** Project Engineer (Lead)
### Projects — #315 
- **Work item:** Analyse weekly progress against baseline, productivity and critical path
- **Responsible role:** Project Engineer (Lead)
### Projects — #316 
- **Work item:** Prepare weekly project report, recovery plan and management exceptions
- **Responsible role:** Project Engineer (Lead)
### Projects — #317 
- **Work item:** Maintain delay, disruption and extension-of-time evidence and notices
- **Responsible role:** Project Engineer (Lead)
### Projects — #318 
- **Work item:** Control site instructions, variations and approved scope changes
- **Responsible role:** Project Engineer (Lead)
### Projects — #319 
- **Work item:** Maintain client and consultant communication and action tracker
- **Responsible role:** Project Engineer (Lead)
### Projects — #320 
- **Work item:** Coordinate RFIs, technical clarifications and design changes with the CTO
- **Responsible role:** Project Engineer (Lead)
### Projects — #321 
- **Work item:** Prepare and coordinate the testing and commissioning plan
- **Responsible role:** Project Engineer (Lead)
### Projects — #322 
- **Work item:** Prepare snag and punch lists and drive closure by responsible owners
- **Responsible role:** Project Engineer (Lead)
### Projects — #323 
- **Work item:** Coordinate authority, consultant and client final inspections
- **Responsible role:** Project Engineer (Lead)
### Projects — #324 
- **Work item:** Compile as-built, O&M, warranty, quality and completion dossiers
- **Responsible role:** Project Engineer (Lead)
### Projects — #325 
- **Work item:** Coordinate formal client handover, completion evidence and final billing inputs
- **Responsible role:** Project Engineer (Lead)
### Projects — #326 
- **Work item:** Track DLP defects and coordinate final project closeout
- **Responsible role:** Project Engineer (Lead)
### Projects — #327 
- **Work item:** Verify civil site access, survey benchmarks and existing conditions
- **Responsible role:** Site Civil Engineer
### Projects — #328 
- **Work item:** Review civil IFC drawings, specifications, BOQ scope and latest revisions
- **Responsible role:** Site Civil Engineer
### Projects — #329 
- **Work item:** Assess civil work-front constructability, interfaces and temporary-work needs
- **Responsible role:** Site Civil Engineer
### Projects — #330 
- **Work item:** Confirm civil permits, approved method statements and pre-start conditions
- **Responsible role:** Site Civil Engineer
### Projects — #331 
- **Work item:** Prepare daily civil work plans, crew allocations and resource requirements
- **Responsible role:** Site Civil Engineer
### Projects — #332 
- **Work item:** Control setting-out, grids, levels, coordinates and survey records
- **Responsible role:** Site Civil Engineer
### Projects — #333 
- **Work item:** Prepare civil method-statement, risk-assessment and ITP technical inputs
- **Responsible role:** Site Civil Engineer
### Projects — #334 
- **Work item:** Raise civil material, plant, tool and specialist-subcontract requirements
- **Responsible role:** Site Civil Engineer
### Projects — #335 
- **Work item:** Coordinate civil subcontractor activities and technical deliverables
- **Responsible role:** Site Civil Engineer
### Projects — #336 
- **Work item:** Coordinate civil openings, sleeves, embeds and MEP interfaces
- **Responsible role:** Site Civil Engineer
### Projects — #337 
- **Work item:** Supervise earthworks, excavation, backfilling and substructure execution
- **Responsible role:** Site Civil Engineer
### Projects — #338 
- **Work item:** Supervise formwork, reinforcement and concrete execution
- **Responsible role:** Site Civil Engineer
### Projects — #339 
- **Work item:** Supervise masonry, plaster, waterproofing and roofing execution
- **Responsible role:** Site Civil Engineer
### Projects — #340 
- **Work item:** Supervise architectural finishes and external civil works
- **Responsible role:** Site Civil Engineer
### Projects — #341 
- **Work item:** Control civil dimensions, tolerances, productivity and approved sequence
- **Responsible role:** Site Civil Engineer
### Projects — #342 
- **Work item:** Protect completed civil work and control temporary conditions
- **Responsible role:** Site Civil Engineer
### Projects — #343 
- **Work item:** Verify civil materials against approved submittals and storage requirements
- **Responsible role:** Site Civil Engineer
### Projects — #344 
- **Work item:** Perform civil pre-inspection and raise work-inspection requests
- **Responsible role:** Site Civil Engineer
### Projects — #345 
- **Work item:** Inspect civil work before concealment, covering or subsequent trade release
- **Responsible role:** Site Civil Engineer
### Projects — #346 
- **Work item:** Raise civil RFIs for missing, conflicting or impractical information
- **Responsible role:** Site Civil Engineer
### Projects — #347 
- **Work item:** Record civil defects, NCRs, rework and corrective-action closure
- **Responsible role:** Site Civil Engineer
### Projects — #348 
- **Work item:** Verify daily civil material consumption, wastage and balance at site
- **Responsible role:** Site Civil Engineer
### Projects — #349 
- **Work item:** Record daily civil progress, quantities, photographs and constraints
- **Responsible role:** Site Civil Engineer
### Projects — #350 
- **Work item:** Verify civil measurements and completed quantities with the Quantity Surveyor
- **Responsible role:** Site Civil Engineer
### Projects — #351 
- **Work item:** Maintain civil red-lines and verified as-built information
- **Responsible role:** Site Civil Engineer
### Projects — #352 
- **Work item:** Coordinate civil snag identification and closure
- **Responsible role:** Site Civil Engineer
### Projects — #353 
- **Work item:** Support civil authority, consultant and client inspections
- **Responsible role:** Site Civil Engineer
### Projects — #354 
- **Work item:** Handover the civil completion and closeout evidence package
- **Responsible role:** Site Civil Engineer
### Projects — #355 
- **Work item:** Review MEP IFC drawings, specifications, BOQ scope and latest revisions
- **Responsible role:** Site MEP Engineer
### Projects — #356 
- **Work item:** Survey existing utilities, services, connection points and site constraints
- **Responsible role:** Site MEP Engineer
### Projects — #357 
- **Work item:** Coordinate MEP zones, plant spaces, builders work and access requirements
- **Responsible role:** Site MEP Engineer
### Projects — #358 
- **Work item:** Confirm MEP permits, approved methods and authority pre-start conditions
- **Responsible role:** Site MEP Engineer
### Projects — #359 
- **Work item:** Prepare daily MEP work plans, crew allocations and resource requirements
- **Responsible role:** Site MEP Engineer
### Projects — #360 
- **Work item:** Confirm MEP shop drawings, material submittals and technical approvals are ready
- **Responsible role:** Site MEP Engineer
### Projects — #361 
- **Work item:** Raise MEP material, equipment, tool and specialist-subcontract requirements
- **Responsible role:** Site MEP Engineer
### Projects — #362 
- **Work item:** Coordinate MEP specialist subcontractors and vendor technical deliverables
- **Responsible role:** Site MEP Engineer
### Projects — #363 
- **Work item:** Coordinate MEP routes, ceilings, openings, sleeves and interdisciplinary interfaces
- **Responsible role:** Site MEP Engineer
### Projects — #364 
- **Work item:** Prepare MEP inspection, testing, commissioning and authority schedules
- **Responsible role:** Site MEP Engineer
### Projects — #365 
- **Work item:** Supervise HVAC installation, equipment, ductwork and piping execution
- **Responsible role:** Site MEP Engineer
### Projects — #366 
- **Work item:** Supervise plumbing, drainage, water and pump-system execution
- **Responsible role:** Site MEP Engineer
### Projects — #367 
- **Work item:** Supervise electrical power, lighting, containment and earthing execution
- **Responsible role:** Site MEP Engineer
### Projects — #368 
- **Work item:** Supervise ELV, fire-alarm and life-safety system execution within scope
- **Responsible role:** Site MEP Engineer
### Projects — #369 
- **Work item:** Supervise MEP equipment installation, alignment and service connections
- **Responsible role:** Site MEP Engineer
### Projects — #370 
- **Work item:** Control MEP builders work, firestopping, access and approved installation sequence
- **Responsible role:** Site MEP Engineer
### Projects — #371 
- **Work item:** Verify MEP materials and equipment against approved submittals and storage rules
- **Responsible role:** Site MEP Engineer
### Projects — #372 
- **Work item:** Perform MEP pre-inspection and raise work-inspection requests
- **Responsible role:** Site MEP Engineer
### Projects — #373 
- **Work item:** Witness pressure, leakage, insulation, continuity and functional pre-tests
- **Responsible role:** Site MEP Engineer
### Projects — #374 
- **Work item:** Raise MEP RFIs for missing, conflicting or impractical information
- **Responsible role:** Site MEP Engineer
### Projects — #375 
- **Work item:** Record MEP defects, NCRs, rework and corrective-action closure
- **Responsible role:** Site MEP Engineer
### Projects — #376 
- **Work item:** Verify daily MEP material use, equipment protection and site allocation
- **Responsible role:** Site MEP Engineer
### Projects — #377 
- **Work item:** Record daily MEP progress, quantities, photographs and constraints
- **Responsible role:** Site MEP Engineer
### Projects — #378 
- **Work item:** Verify MEP measurements and completed quantities with the Quantity Surveyor
- **Responsible role:** Site MEP Engineer
### Projects — #379 
- **Work item:** Coordinate integrated MEP testing and commissioning activities
- **Responsible role:** Site MEP Engineer
### Projects — #380 
- **Work item:** Maintain MEP red-lines and verified as-built information
- **Responsible role:** Site MEP Engineer
### Projects — #381 
- **Work item:** Coordinate MEP snag identification and closure
- **Responsible role:** Site MEP Engineer
### Projects — #382 
- **Work item:** Compile MEP O&M, warranty, test and handover evidence
- **Responsible role:** Site MEP Engineer
### Projects — #383 
- **Work item:** Receive the approved daily civil work plan and latest drawings
- **Responsible role:** Civil Supervisor
### Projects — #384 
- **Work item:** Check civil work-front access, benchmarks and pre-start readiness
- **Responsible role:** Civil Supervisor
### Projects — #385 
- **Work item:** Allocate civil crews and chargehands to approved work fronts
- **Responsible role:** Civil Supervisor
### Projects — #386 
- **Work item:** Check civil materials, tools, scaffolds, plant and access arrangements
- **Responsible role:** Civil Supervisor
### Projects — #387 
- **Work item:** Deliver the civil method and safety briefing with the engineer and QHSE team
- **Responsible role:** Civil Supervisor
### Projects — #388 
- **Work item:** Supervise civil setting-out, earthworks and substructure activities
- **Responsible role:** Civil Supervisor
### Projects — #389 
- **Work item:** Supervise formwork, reinforcement and concrete activities
- **Responsible role:** Civil Supervisor
### Projects — #390 
- **Work item:** Supervise masonry, plaster, waterproofing and roofing activities
- **Responsible role:** Civil Supervisor
### Projects — #391 
- **Work item:** Supervise finishing and external-works activities
- **Responsible role:** Civil Supervisor
### Projects — #392 
- **Work item:** Control temporary works, protection and civil work sequence
- **Responsible role:** Civil Supervisor
### Projects — #393 
- **Work item:** Monitor civil crew productivity against the daily target
- **Responsible role:** Civil Supervisor
### Projects — #394 
- **Work item:** Check civil dimensions, levels, workmanship and tolerances
- **Responsible role:** Civil Supervisor
### Projects — #395 
- **Work item:** Control civil material use, wastage and work-front stock
- **Responsible role:** Civil Supervisor
### Projects — #396 
- **Work item:** Correct minor civil defects before engineer inspection
- **Responsible role:** Civil Supervisor
### Projects — #397 
- **Work item:** Record civil delays, shortages, rework and access constraints
- **Responsible role:** Civil Supervisor
### Projects — #398 
- **Work item:** Record civil attendance, overtime and crew deployment
- **Responsible role:** Civil Supervisor
### Projects — #399 
- **Work item:** Report civil completed quantities and daily work status
- **Responsible role:** Civil Supervisor
### Projects — #400 
- **Work item:** Escalate civil resource, drawing and work-front requirements
- **Responsible role:** Civil Supervisor
### Projects — #401 
- **Work item:** Handover completed civil work for engineer and QHSE inspection
- **Responsible role:** Civil Supervisor
### Projects — #402 
- **Work item:** Secure, clean and protect the civil work front at shift end
- **Responsible role:** Civil Supervisor
### Projects — #403 
- **Work item:** Receive the approved daily MEP work plan and latest drawings
- **Responsible role:** MEP Supervisor
### Projects — #404 
- **Work item:** Check MEP work-front access, permits and pre-start readiness
- **Responsible role:** MEP Supervisor
### Projects — #405 
- **Work item:** Allocate MEP crews and chargehands to approved work fronts
- **Responsible role:** MEP Supervisor
### Projects — #406 
- **Work item:** Check MEP materials, tools, access equipment and testing instruments
- **Responsible role:** MEP Supervisor
### Projects — #407 
- **Work item:** Deliver the MEP method and safety briefing with the engineer and QHSE team
- **Responsible role:** MEP Supervisor
### Projects — #408 
- **Work item:** Supervise HVAC ductwork, piping and equipment installation
- **Responsible role:** MEP Supervisor
### Projects — #409 
- **Work item:** Supervise plumbing, drainage and water-system installation
- **Responsible role:** MEP Supervisor
### Projects — #410 
- **Work item:** Supervise electrical containment, cabling, power and lighting installation
- **Responsible role:** MEP Supervisor
### Projects — #411 
- **Work item:** Supervise ELV, fire-alarm and specialist-system installation within scope
- **Responsible role:** MEP Supervisor
### Projects — #412 
- **Work item:** Supervise MEP testing, final connections and service integration
- **Responsible role:** MEP Supervisor
### Projects — #413 
- **Work item:** Monitor MEP crew productivity against the daily target
- **Responsible role:** MEP Supervisor
### Projects — #414 
- **Work item:** Check MEP installation workmanship, levels, supports and access
- **Responsible role:** MEP Supervisor
### Projects — #415 
- **Work item:** Control MEP material use, wastage and work-front stock
- **Responsible role:** MEP Supervisor
### Projects — #416 
- **Work item:** Correct minor MEP defects before engineer inspection
- **Responsible role:** MEP Supervisor
### Projects — #417 
- **Work item:** Record MEP delays, shortages, rework and access constraints
- **Responsible role:** MEP Supervisor
### Projects — #418 
- **Work item:** Record MEP attendance, overtime and crew deployment
- **Responsible role:** MEP Supervisor
### Projects — #419 
- **Work item:** Report MEP completed quantities and daily work status
- **Responsible role:** MEP Supervisor
### Projects — #420 
- **Work item:** Escalate MEP resource, drawing and work-front requirements
- **Responsible role:** MEP Supervisor
### Projects — #421 
- **Work item:** Handover completed MEP work for engineer and QHSE inspection
- **Responsible role:** MEP Supervisor
### Projects — #422 
- **Work item:** Secure, clean and protect the MEP work front at shift end
- **Responsible role:** MEP Supervisor
### Projects — #423 
- **Work item:** Receive the supervisor daily target, drawing and approved work method
- **Responsible role:** Foreman
### Projects — #424 
- **Work item:** Conduct the crew toolbox and work-method briefing
- **Responsible role:** Foreman
### Projects — #425 
- **Work item:** Confirm work-front access, tools, materials and PPE readiness
- **Responsible role:** Foreman
### Projects — #426 
- **Work item:** Identify missing information, hazards and constraints before starting
- **Responsible role:** Foreman
### Projects — #427 
- **Work item:** Organise chargehands and crews by location and task
- **Responsible role:** Foreman
### Projects — #428 
- **Work item:** Sequence daily work to protect preceding and following trades
- **Responsible role:** Foreman
### Projects — #429 
- **Work item:** Control use of tools, access equipment and work-front materials
- **Responsible role:** Foreman
### Projects — #430 
- **Work item:** Coordinate trade interfaces and avoid damage to completed work
- **Responsible role:** Foreman
### Projects — #431 
- **Work item:** Maintain housekeeping and safe access during execution
- **Responsible role:** Foreman
### Projects — #432 
- **Work item:** Monitor crew output against the approved daily target
- **Responsible role:** Foreman
### Projects — #433 
- **Work item:** Check work against drawing, dimensions and workmanship standard
- **Responsible role:** Foreman
### Projects — #434 
- **Work item:** Correct minor defects and prevent repeated rework
- **Responsible role:** Foreman
### Projects — #435 
- **Work item:** Record idle time, shortages, delays and productivity loss
- **Responsible role:** Foreman
### Projects — #436 
- **Work item:** Control material wastage and protect issued materials
- **Responsible role:** Foreman
### Projects — #437 
- **Work item:** Report attendance, completed quantities and remaining work
- **Responsible role:** Foreman
### Projects — #438 
- **Work item:** Request next-shift materials, tools and access requirements
- **Responsible role:** Foreman
### Projects — #439 
- **Work item:** Present completed work to the supervisor for inspection
- **Responsible role:** Foreman
### Projects — #440 
- **Work item:** Secure the area and hand over end-of-shift status
- **Responsible role:** Foreman
### Projects — #441 
- **Work item:** Receive the foreman work instruction and target
- **Responsible role:** Chargehand
### Projects — #442 
- **Work item:** Allocate individual tasks to assigned workers
- **Responsible role:** Chargehand
### Projects — #443 
- **Work item:** Demonstrate the required work method and quality standard
- **Responsible role:** Chargehand
### Projects — #444 
- **Work item:** Confirm workers have correct tools, materials and PPE
- **Responsible role:** Chargehand
### Projects — #445 
- **Work item:** Supervise worker sequence and task coordination
- **Responsible role:** Chargehand
### Projects — #446 
- **Work item:** Monitor attendance, tool use and work-front discipline
- **Responsible role:** Chargehand
### Projects — #447 
- **Work item:** Maintain continuous supply of approved materials to the crew
- **Responsible role:** Chargehand
### Projects — #448 
- **Work item:** Coordinate minor interfaces with adjacent crews
- **Responsible role:** Chargehand
### Projects — #449 
- **Work item:** Check workmanship during execution and correct minor defects
- **Responsible role:** Chargehand
### Projects — #450 
- **Work item:** Stop unsafe or unauthorised work and notify the foreman
- **Responsible role:** Chargehand
### Projects — #451 
- **Work item:** Protect completed work, materials and company tools
- **Responsible role:** Chargehand
### Projects — #452 
- **Work item:** Maintain work-front housekeeping and safe access
- **Responsible role:** Chargehand
### Projects — #453 
- **Work item:** Record crew output and completed task quantities
- **Responsible role:** Chargehand
### Projects — #454 
- **Work item:** Report shortages, hazards, delays and missing information
- **Responsible role:** Chargehand
### Projects — #455 
- **Work item:** Return unused material and tools to controlled storage
- **Responsible role:** Chargehand
### Projects — #456 
- **Work item:** Confirm completed work and shift status to the foreman
- **Responsible role:** Chargehand
### Projects — #457 
- **Work item:** Attend the toolbox briefing and confirm the assigned skilled task
- **Responsible role:** Skilled Labour
### Projects — #458 
- **Work item:** Inspect tools, equipment, materials and work-front condition
- **Responsible role:** Skilled Labour
### Projects — #459 
- **Work item:** Verify the latest work instruction, dimensions and quality expectation
- **Responsible role:** Skilled Labour
### Projects — #460 
- **Work item:** Report any unsafe, missing or conflicting requirement before work
- **Responsible role:** Skilled Labour
### Projects — #461 
- **Work item:** Execute the assigned skilled trade work to approved drawings and method
- **Responsible role:** Skilled Labour
### Projects — #462 
- **Work item:** Maintain required dimensions, levels, tolerances and finish
- **Responsible role:** Skilled Labour
### Projects — #463 
- **Work item:** Use materials, tools and equipment only for the authorised task
- **Responsible role:** Skilled Labour
### Projects — #464 
- **Work item:** Coordinate the assigned work with adjacent trades through the chargehand
- **Responsible role:** Skilled Labour
### Projects — #465 
- **Work item:** Self-check completed skilled work and correct minor defects
- **Responsible role:** Skilled Labour
### Projects — #466 
- **Work item:** Maintain PPE, safe access and work-front housekeeping
- **Responsible role:** Skilled Labour
### Projects — #467 
- **Work item:** Protect completed work, issued materials and company assets
- **Responsible role:** Skilled Labour
### Projects — #468 
- **Work item:** Report completed quantity, defect, delay or material shortage
- **Responsible role:** Skilled Labour
### Projects — #469 
- **Work item:** Clean and hand over the completed skilled work front
- **Responsible role:** Skilled Labour
### Projects — #470 
- **Work item:** Return tools and unused material through the approved route
- **Responsible role:** Skilled Labour
### Projects — #471 
- **Work item:** Attend the toolbox briefing and receive the assigned support task
- **Responsible role:** Unskilled Labour
### Projects — #472 
- **Work item:** Check PPE, access route and basic tools before starting
- **Responsible role:** Unskilled Labour
### Projects — #473 
- **Work item:** Report unsafe conditions or unclear instructions
- **Responsible role:** Unskilled Labour
### Projects — #474 
- **Work item:** Move, stage and prepare materials safely for the work crew
- **Responsible role:** Unskilled Labour
### Projects — #475 
- **Work item:** Support skilled trades in the authorised activity
- **Responsible role:** Unskilled Labour
### Projects — #476 
- **Work item:** Assist with protection, barricading and access preparation
- **Responsible role:** Unskilled Labour
### Projects — #477 
- **Work item:** Maintain housekeeping, waste segregation and clear access routes
- **Responsible role:** Unskilled Labour
### Projects — #478 
- **Work item:** Use manual-handling methods and basic tools safely
- **Responsible role:** Unskilled Labour
### Projects — #479 
- **Work item:** Protect materials, completed work and company property
- **Responsible role:** Unskilled Labour
### Projects — #480 
- **Work item:** Report damage, shortage, hazard or delay to the chargehand
- **Responsible role:** Unskilled Labour
### Projects — #481 
- **Work item:** Clear debris and clean the assigned work area
- **Responsible role:** Unskilled Labour
### Projects — #482 
- **Work item:** Return tools and hand over shift completion status
- **Responsible role:** Unskilled Labour
### Projects — #483 
- **Work item:** Complete the vehicle pre-use safety and condition inspection
- **Responsible role:** Driver
### Projects — #484 
- **Work item:** Verify licence, registration, insurance and vehicle documents
- **Responsible role:** Driver
### Projects — #485 
- **Work item:** Confirm the authorised trip request, route, load and timing
- **Responsible role:** Driver
### Projects — #486 
- **Work item:** Check load security, capacity and required delivery documents
- **Responsible role:** Driver
### Projects — #487 
- **Work item:** Collect and transport authorised materials, staff or equipment
- **Responsible role:** Driver
### Projects — #488 
- **Work item:** Follow approved route, speed, rest and site-access controls
- **Responsible role:** Driver
### Projects — #489 
- **Work item:** Protect transported goods and prevent unauthorised passengers or loads
- **Responsible role:** Driver
### Projects — #490 
- **Work item:** Coordinate loading, unloading and delivery access safely
- **Responsible role:** Driver
### Projects — #491 
- **Work item:** Obtain delivery, transfer or passenger-completion evidence
- **Responsible role:** Driver
### Projects — #492 
- **Work item:** Maintain trip, fuel, mileage, toll and vehicle-use records
- **Responsible role:** Driver
### Projects — #493 
- **Work item:** Report delay, traffic, route or delivery exception promptly
- **Responsible role:** Driver
### Projects — #494 
- **Work item:** Report accident, breakdown, damage or vehicle defect immediately
- **Responsible role:** Driver
### Projects — #495 
- **Work item:** Coordinate authorised recovery, maintenance and replacement transport
- **Responsible role:** Driver
### Projects — #496 
- **Work item:** Secure the vehicle and submit end-of-shift records and keys
- **Responsible role:** Driver
### Projects — #497 
- **Work item:** Complete plant and equipment pre-start inspection
- **Responsible role:** Plant & Equipment Operator
### Projects — #498 
- **Work item:** Verify operator competency, certification and equipment documents
- **Responsible role:** Plant & Equipment Operator
### Projects — #499 
- **Work item:** Confirm authorised activity, location, lift or operating plan
- **Responsible role:** Plant & Equipment Operator
### Projects — #500 
- **Work item:** Check guards, alarms, attachments, fuel and safety devices
- **Responsible role:** Plant & Equipment Operator
### Projects — #501 
- **Work item:** Operate plant only within rated capacity and authorised task
- **Responsible role:** Plant & Equipment Operator
### Projects — #502 
- **Work item:** Maintain the exclusion zone, banksman communication and safe movement
- **Responsible role:** Plant & Equipment Operator
### Projects — #503 
- **Work item:** Follow approved lifting, excavation or equipment operating method
- **Responsible role:** Plant & Equipment Operator
### Projects — #504 
- **Work item:** Prevent damage to utilities, structures, materials and completed work
- **Responsible role:** Plant & Equipment Operator
### Projects — #505 
- **Work item:** Record operating hours, output, idle time, fuel and utilisation
- **Responsible role:** Plant & Equipment Operator
### Projects — #506 
- **Work item:** Monitor abnormal sound, temperature, leakage and performance
- **Responsible role:** Plant & Equipment Operator
### Projects — #507 
- **Work item:** Stop equipment on unsafe condition or unauthorised instruction
- **Responsible role:** Plant & Equipment Operator
### Projects — #508 
- **Work item:** Report downtime, damage, near miss and productivity constraint
- **Responsible role:** Plant & Equipment Operator
### Projects — #509 
- **Work item:** Coordinate preventive maintenance and statutory inspection due dates
- **Responsible role:** Plant & Equipment Operator
### Projects — #510 
- **Work item:** Report defects and isolate unsafe equipment from use
- **Responsible role:** Plant & Equipment Operator
### Projects — #511 
- **Work item:** Complete authorised refuelling, cleaning and minor daily care
- **Responsible role:** Plant & Equipment Operator
### Projects — #512 
- **Work item:** Park, secure and submit shift utilisation and defect records
- **Responsible role:** Plant & Equipment Operator
### Projects — #513 
- **Work item:** Receive the awarded BOQ, estimate, contract and approved budget baseline
- **Responsible role:** Quantity Surveyor
### Projects — #514 
- **Work item:** Establish project cost codes, quantity control and commitment structure
- **Responsible role:** Quantity Surveyor
### Projects — #515 
- **Work item:** Reconcile awarded scope against IFC quantities and estimate assumptions
- **Responsible role:** Quantity Surveyor
### Projects — #516 
- **Work item:** Prepare project cash-flow, value and commercial milestone schedule
- **Responsible role:** Quantity Surveyor
### Projects — #517 
- **Work item:** Maintain the project commercial risk, allowance and contingency register
- **Responsible role:** Quantity Surveyor
### Projects — #518 
- **Work item:** Verify site requisition quantity against BOQ, budget and installed balance
- **Responsible role:** Quantity Surveyor
### Projects — #519 
- **Work item:** Create ERP requisitions linked to cost code and required-on-site date
- **Responsible role:** Quantity Surveyor
### Projects — #520 
- **Work item:** Review procurement comparisons for quantity and scope completeness
- **Responsible role:** Quantity Surveyor
### Projects — #521 
- **Work item:** Maintain committed-cost and uncommitted-budget tracking
- **Responsible role:** Quantity Surveyor
### Projects — #522 
- **Work item:** Measure completed civil work and maintain quantity records
- **Responsible role:** Quantity Surveyor
### Projects — #523 
- **Work item:** Measure completed MEP work and maintain quantity records
- **Responsible role:** Quantity Surveyor
### Projects — #524 
- **Work item:** Verify subcontractor progress measurements and supporting evidence
- **Responsible role:** Quantity Surveyor
### Projects — #525 
- **Work item:** Reconcile material consumption, installed quantity and site balance
- **Responsible role:** Quantity Surveyor
### Projects — #526 
- **Work item:** Maintain measurement sheets, joint records and consultant certification status
- **Responsible role:** Quantity Surveyor
### Projects — #527 
- **Work item:** Open and maintain the project variation and additional-work register
- **Responsible role:** Quantity Surveyor
### Projects — #528 
- **Work item:** Measure and value instructed variations and scope changes
- **Responsible role:** Quantity Surveyor
### Projects — #529 
- **Work item:** Prepare variation substantiation, rate build-up and supporting evidence
- **Responsible role:** Quantity Surveyor
### Projects — #530 
- **Work item:** Track variation submission, negotiation, approval and rejection status
- **Responsible role:** Quantity Surveyor
### Projects — #531 
- **Work item:** Maintain delay, disruption and commercial-notice support with the Project Engineer
- **Responsible role:** Quantity Surveyor
### Projects — #532 
- **Work item:** Prepare client progress-valuation and invoice-support packages
- **Responsible role:** Quantity Surveyor
### Projects — #533 
- **Work item:** Reconcile certified value, retention, advance recovery and prior billing
- **Responsible role:** Quantity Surveyor
### Projects — #534 
- **Work item:** Review subcontractor valuation and payment-certificate quantities
- **Responsible role:** Quantity Surveyor
### Projects — #535 
- **Work item:** Verify supplier and subcontractor commercial evidence for payment
- **Responsible role:** Quantity Surveyor
### Projects — #536 
- **Work item:** Track client certification, invoice, collection and commercial actions
- **Responsible role:** Quantity Surveyor
### Projects — #537 
- **Work item:** Prepare monthly cost-to-complete and forecast-at-completion
- **Responsible role:** Quantity Surveyor
### Projects — #538 
- **Work item:** Report budget variance, margin exposure and commercial corrective actions
- **Responsible role:** Quantity Surveyor
### Projects — #539 
- **Work item:** Prepare final account, variation reconciliation and retention schedule
- **Responsible role:** Quantity Surveyor
### Projects — #540 
- **Work item:** Handover final commercial closeout records to Finance and the COO
- **Responsible role:** Quantity Surveyor
### Projects — #541 
- **Work item:** Prepare the project HSE plan and site-specific safety arrangements
- **Responsible role:** QHSE Engineer
### Projects — #542 
- **Work item:** Prepare the project quality plan and inspection-control structure
- **Responsible role:** QHSE Engineer
### Projects — #543 
- **Work item:** Establish legal, authority, permit and client QHSE requirement registers
- **Responsible role:** QHSE Engineer
### Projects — #544 
- **Work item:** Establish emergency, welfare, environmental and waste-management controls
- **Responsible role:** QHSE Engineer
### Projects — #545 
- **Work item:** Verify mobilisation and pre-start QHSE readiness before work release
- **Responsible role:** QHSE Engineer
### Projects — #546 
- **Work item:** Review method statements and task risk assessments before approval
- **Responsible role:** QHSE Engineer
### Projects — #547 
- **Work item:** Prepare and control inspection and test plans and checklists
- **Responsible role:** QHSE Engineer
### Projects — #548 
- **Work item:** Review material submittals, samples and quality-document requirements
- **Responsible role:** QHSE Engineer
### Projects — #549 
- **Work item:** Maintain permit-to-work and high-risk activity control registers
- **Responsible role:** QHSE Engineer
### Projects — #550 
- **Work item:** Verify competency, certification and third-party inspection requirements
- **Responsible role:** QHSE Engineer
### Projects — #551 
- **Work item:** Conduct daily site safety inspection and record corrective actions
- **Responsible role:** QHSE Engineer
### Projects — #552 
- **Work item:** Conduct planned quality inspections and surveillance
- **Responsible role:** QHSE Engineer
### Projects — #553 
- **Work item:** Verify toolbox talks, PPE, access, housekeeping and welfare controls
- **Responsible role:** QHSE Engineer
### Projects — #554 
- **Work item:** Inspect scaffolds, lifting, excavation, hot work and confined-space controls
- **Responsible role:** QHSE Engineer
### Projects — #555 
- **Work item:** Issue stop-work instruction for immediate danger or unauthorised activity
- **Responsible role:** QHSE Engineer
### Projects — #556 
- **Work item:** Review work-inspection requests before consultant submission
- **Responsible role:** QHSE Engineer
### Projects — #557 
- **Work item:** Verify material receipt, quarantine, rejection and release status
- **Responsible role:** QHSE Engineer
### Projects — #558 
- **Work item:** Witness required tests and retain calibrated test evidence
- **Responsible role:** QHSE Engineer
### Projects — #559 
- **Work item:** Raise and control NCR, defect and corrective-action records
- **Responsible role:** QHSE Engineer
### Projects — #560 
- **Work item:** Verify corrective-action effectiveness and formally close QHSE findings
- **Responsible role:** QHSE Engineer
### Projects — #561 
- **Work item:** Report and coordinate accident, incident and near-miss response
- **Responsible role:** QHSE Engineer
### Projects — #562 
- **Work item:** Secure evidence and support incident investigation and root-cause analysis
- **Responsible role:** QHSE Engineer
### Projects — #563 
- **Work item:** Notify management and authorities within required thresholds and timing
- **Responsible role:** QHSE Engineer
### Projects — #564 
- **Work item:** Track incident corrective and preventive actions to closure
- **Responsible role:** QHSE Engineer
### Projects — #565 
- **Work item:** Conduct emergency drills and update response arrangements
- **Responsible role:** QHSE Engineer
### Projects — #566 
- **Work item:** Prepare daily and weekly QHSE performance reports
- **Responsible role:** QHSE Engineer
### Projects — #567 
- **Work item:** Maintain QHSE KPIs, audit findings and overdue-action dashboard
- **Responsible role:** QHSE Engineer
### Projects — #568 
- **Work item:** Compile inspection, test, material and NCR closeout records
- **Responsible role:** QHSE Engineer
### Projects — #569 
- **Work item:** Support testing, commissioning, snag and final-inspection readiness
- **Responsible role:** QHSE Engineer
### Projects — #570 
- **Work item:** Handover the approved quality and HSE closeout dossier
- **Responsible role:** QHSE Engineer
### Procurement — #571 
- **Work item:** Set Procurement strategy, policies and annual operating objectives
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #572 
- **Work item:** Approve the procurement-control framework, Delegation of Authority and segregation of duties
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #573 
- **Work item:** Approve ethical-sourcing, conflict-of-interest, gifts and anti-bribery controls
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #574 
- **Work item:** Approve vendor-governance, prequalification, suspension and blacklisting rules
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #575 
- **Work item:** Approve standard RFQ, purchase-order, subcontract and procurement-record templates
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #576 
- **Work item:** Approve project procurement strategy and work-package structure
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #577 
- **Work item:** Approve the programme-linked procurement schedule and long-lead register
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #578 
- **Work item:** Approve category, framework, local and international sourcing strategies
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #579 
- **Work item:** Approve competitive-tender, single-source, sole-source and emergency procurement routes
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #580 
- **Work item:** Approve Procurement resource, system, capability and annual improvement plans
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #581 
- **Work item:** Approve supplier and subcontractor selections within delegated authority
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #582 
- **Work item:** Approve purchase orders within delegated authority
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #583 
- **Work item:** Approve subcontractor appointments and subcontract awards within delegated authority
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #584 
- **Work item:** Approve material commercial deviations, negotiated terms and award qualifications
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #585 
- **Work item:** Approve procurement commitments above authority through the required CEO, CFO or Legal route
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #586 
- **Work item:** Review critical-path procurement status and direct supply-recovery actions
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #587 
- **Work item:** Review committed cost, procurement variance, savings and cost-avoidance performance
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #588 
- **Work item:** Approve value-engineering and alternative-source recommendations with Technical Engineering
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #589 
- **Work item:** Resolve major supplier, subcontractor, quality, delivery and capacity risks
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #590 
- **Work item:** Approve suspension, termination, replacement or claim strategy for material supply failure
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #591 
- **Work item:** Approve strategic-vendor development and performance-improvement actions
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #592 
- **Work item:** Approve vendor master-data control and sensitive bank-detail verification rules
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #593 
- **Work item:** Approve inventory, stockholding, surplus, scrap and disposal-control principles
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #594 
- **Work item:** Oversee procurement audit, contractual, insurance, tax and regulatory compliance
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #595 
- **Work item:** Approve supplier and subcontractor business-continuity and concentration-risk actions
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #596 
- **Work item:** Review the weekly Procurement exception and long-lead dashboard
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #597 
- **Work item:** Review the monthly Procurement performance, savings, exposure and vendor scorecard
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #598 
- **Work item:** Report material procurement commitments, risks and decisions to the CEO
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #599 
- **Work item:** Approve Procurement access-control, backup, delegation and continuity arrangements
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #600 
- **Work item:** Sponsor procurement-process, FirstBit, data-quality and automation improvements
- **Responsible role:** Chief Procurement Officer (CPO)
### Procurement — #601 
- **Work item:** Receive and register purchase and subcontract requisitions
- **Responsible role:** Procurement Lead
### Procurement — #602 
- **Work item:** Validate IFC, BOQ, specification, approved-brand and revision references
- **Responsible role:** Procurement Lead
### Procurement — #603 
- **Work item:** Validate quantity, budget, project code, cost code and required-on-site date
- **Responsible role:** Procurement Lead
### Procurement — #604 
- **Work item:** Return incomplete, duplicated, unapproved or unclear requisitions for correction
- **Responsible role:** Procurement Lead
### Procurement — #605 
- **Work item:** Split approved requirements into material, equipment and subcontract packages
- **Responsible role:** Procurement Lead
### Procurement — #606 
- **Work item:** Maintain the project procurement-package register
- **Responsible role:** Procurement Lead
### Procurement — #607 
- **Work item:** Maintain the long-lead, critical-item and client-nominated-supplier register
- **Responsible role:** Procurement Lead
### Procurement — #608 
- **Work item:** Build the procurement schedule backward from required-on-site dates
- **Responsible role:** Procurement Lead
### Procurement — #609 
- **Work item:** Identify market-capacity, lead-time, technical and commercial sourcing constraints
- **Responsible role:** Procurement Lead
### Procurement — #610 
- **Work item:** Review procurement priorities and constraints with Projects and Technical Engineering
- **Responsible role:** Procurement Lead
### Procurement — #611 
- **Work item:** Maintain the approved supplier and subcontractor database
- **Responsible role:** Procurement Lead
### Procurement — #612 
- **Work item:** Create and control supplier and subcontractor master-data requests
- **Responsible role:** Procurement Lead
### Procurement — #613 
- **Work item:** Collect trade licence, tax, ownership, banking, insurance and capability documents
- **Responsible role:** Procurement Lead
### Procurement — #614 
- **Work item:** Perform supplier and subcontractor prequalification due diligence
- **Responsible role:** Procurement Lead
### Procurement — #615 
- **Work item:** Verify experience, capacity, references, quality, HSE and delivery capability
- **Responsible role:** Procurement Lead
### Procurement — #616 
- **Work item:** Screen conflicts, related parties, sanctions, debarment and ethical-sourcing concerns
- **Responsible role:** Procurement Lead
### Procurement — #617 
- **Work item:** Prepare the technically suitable bidder shortlist
- **Responsible role:** Procurement Lead
### Procurement — #618 
- **Work item:** Prepare complete RFQ and subcontract-enquiry packages
- **Responsible role:** Procurement Lead
### Procurement — #619 
- **Work item:** Issue controlled RFQs and maintain the bidder and communication log
- **Responsible role:** Procurement Lead
### Procurement — #620 
- **Work item:** Manage bidder clarifications, addenda, site visits and controlled information release
- **Responsible role:** Procurement Lead
### Procurement — #621 
- **Work item:** Control quotation receipt, tender cutoff, confidentiality and late-bid exceptions
- **Responsible role:** Procurement Lead
### Procurement — #622 
- **Work item:** Check quotation completeness and commercial compliance
- **Responsible role:** Procurement Lead
### Procurement — #623 
- **Work item:** Normalise prices, quantities, exclusions, payment terms and delivery assumptions
- **Responsible role:** Procurement Lead
### Procurement — #624 
- **Work item:** Coordinate technical compliance, material-submittal and approved-brand review
- **Responsible role:** Procurement Lead
### Procurement — #625 
- **Work item:** Evaluate manufacturing capacity, lead time, logistics and programme compliance
- **Responsible role:** Procurement Lead
### Procurement — #626 
- **Work item:** Prepare the technical-commercial comparison and deviation register
- **Responsible role:** Procurement Lead
### Procurement — #627 
- **Work item:** Prepare and approve the negotiation plan within delegated authority
- **Responsible role:** Procurement Lead
### Procurement — #628 
- **Work item:** Negotiate price, payment, delivery, warranty, retention and risk terms
- **Responsible role:** Procurement Lead
### Procurement — #629 
- **Work item:** Record negotiated savings, cost avoidance and remaining qualifications
- **Responsible role:** Procurement Lead
### Procurement — #630 
- **Work item:** Prepare the documented procurement recommendation and approval route
- **Responsible role:** Procurement Lead
### Procurement — #631 
- **Work item:** Prepare the purchase-order award package
- **Responsible role:** Procurement Lead
### Procurement — #632 
- **Work item:** Prepare the subcontractor appointment and award package
- **Responsible role:** Procurement Lead
### Procurement — #633 
- **Work item:** Draft the purchase order with controlled scope, quantities, price and revisions
- **Responsible role:** Procurement Lead
### Procurement — #634 
- **Work item:** Draft the subcontract with BOQ, scope, drawings and specification schedules
- **Responsible role:** Procurement Lead
### Procurement — #635 
- **Work item:** Define delivery milestones, call-off terms, access and required-on-site obligations
- **Responsible role:** Procurement Lead
### Procurement — #636 
- **Work item:** Define submittal, sample, inspection, quality and acceptance requirements
- **Responsible role:** Procurement Lead
### Procurement — #637 
- **Work item:** Define payment, advance-recovery, retention, tax and invoice-document requirements
- **Responsible role:** Procurement Lead
### Procurement — #638 
- **Work item:** Define warranty, DLP, liquidated-damages, security and insurance requirements
- **Responsible role:** Procurement Lead
### Procurement — #639 
- **Work item:** Coordinate Legal review of non-standard or material contractual terms
- **Responsible role:** Procurement Lead
### Procurement — #640 
- **Work item:** Route signature, record vendor acceptance and issue the controlled FirstBit commitment
- **Responsible role:** Procurement Lead
### Procurement — #641 
- **Work item:** Conduct the supplier or subcontractor post-award kick-off
- **Responsible role:** Procurement Lead
### Procurement — #642 
- **Work item:** Maintain the material-submittal, sample and technical-approval register
- **Responsible role:** Procurement Lead
### Procurement — #643 
- **Work item:** Track shop drawings, samples, manufacturing and inspection-release milestones
- **Responsible role:** Procurement Lead
### Procurement — #644 
- **Work item:** Expedite long-lead and critical packages against the procurement schedule
- **Responsible role:** Procurement Lead
### Procurement — #645 
- **Work item:** Confirm delivery call-offs with Logistics, Store and the Project Engineer
- **Responsible role:** Procurement Lead
### Procurement — #646 
- **Work item:** Control purchase-order and subcontract variations, amendments and revised commitments
- **Responsible role:** Procurement Lead
### Procurement — #647 
- **Work item:** Control suspension, cancellation, replacement-source and termination actions
- **Responsible role:** Procurement Lead
### Procurement — #648 
- **Work item:** Manage supplier and subcontractor claims, disputes and commercial correspondence
- **Responsible role:** Procurement Lead
### Procurement — #649 
- **Work item:** Coordinate rejected-material return, replacement, debit note and credit-note evidence
- **Responsible role:** Procurement Lead
### Procurement — #650 
- **Work item:** Verify supplier invoice packages against PO, GRN, delivery and tax requirements
- **Responsible role:** Procurement Lead
### Procurement — #651 
- **Work item:** Verify subcontractor payment packages against certification, retention and contract terms
- **Responsible role:** Procurement Lead
### Procurement — #652 
- **Work item:** Submit complete supplier and subcontractor payment packs to Finance
- **Responsible role:** Procurement Lead
### Procurement — #653 
- **Work item:** Maintain supplier and subcontractor performance scorecards and corrective actions
- **Responsible role:** Procurement Lead
### Procurement — #654 
- **Work item:** Prepare weekly and monthly procurement status, commitments and exception reports
- **Responsible role:** Procurement Lead
### Procurement — #655 
- **Work item:** Close purchase orders and subcontracts with final account, retention, warranty and archive records
- **Responsible role:** Procurement Lead
### Procurement — #656 
- **Work item:** Create the delivery and transport register from approved purchase orders
- **Responsible role:** Logistics Coordinator
### Procurement — #657 
- **Work item:** Translate required-on-site dates into supplier dispatch and delivery call-offs
- **Responsible role:** Logistics Coordinator
### Procurement — #658 
- **Work item:** Confirm supplier manufacturing, packing and dispatch readiness
- **Responsible role:** Logistics Coordinator
### Procurement — #659 
- **Work item:** Confirm project access, route, gate, work-front and delivery-window restrictions
- **Responsible role:** Logistics Coordinator
### Procurement — #660 
- **Work item:** Obtain transport or carrier quotations and prepare the logistics recommendation
- **Responsible role:** Logistics Coordinator
### Procurement — #661 
- **Work item:** Arrange vehicle permits, lifting equipment, unloading labour and traffic control
- **Responsible role:** Logistics Coordinator
### Procurement — #662 
- **Work item:** Confirm storage space, laydown area, protection and receiving resources
- **Responsible role:** Logistics Coordinator
### Procurement — #663 
- **Work item:** Prepare delivery-risk, weather, access and contingency actions
- **Responsible role:** Logistics Coordinator
### Procurement — #664 
- **Work item:** Book the approved vehicle, carrier or freight movement
- **Responsible role:** Logistics Coordinator
### Procurement — #665 
- **Work item:** Coordinate supplier collection, release and dispatch authorisation
- **Responsible role:** Logistics Coordinator
### Procurement — #666 
- **Work item:** Verify packing list, package marking, dimensions, weight and handling requirements
- **Responsible role:** Logistics Coordinator
### Procurement — #667 
- **Work item:** Verify vehicle, driver, carrier, insurance and statutory transport documents
- **Responsible role:** Logistics Coordinator
### Procurement — #668 
- **Work item:** Prepare import, export and customs documents when cross-border movement applies
- **Responsible role:** Logistics Coordinator
### Procurement — #669 
- **Work item:** Coordinate HS-code, duty, clearance and broker requirements when applicable
- **Responsible role:** Logistics Coordinator
### Procurement — #670 
- **Work item:** Arrange cargo or transit insurance for controlled high-risk movements
- **Responsible role:** Logistics Coordinator
### Procurement — #671 
- **Work item:** Track shipment, vehicle and consignment location against plan
- **Responsible role:** Logistics Coordinator
### Procurement — #672 
- **Work item:** Maintain dispatch evidence and transport-document control
- **Responsible role:** Logistics Coordinator
### Procurement — #673 
- **Work item:** Communicate dispatch, ETA and delivery status to supplier, Store and Projects
- **Responsible role:** Logistics Coordinator
### Procurement — #674 
- **Work item:** Book site gate access and confirm authorised delivery personnel
- **Responsible role:** Logistics Coordinator
### Procurement — #675 
- **Work item:** Coordinate lifting, unloading, traffic and temporary-access arrangements
- **Responsible role:** Logistics Coordinator
### Procurement — #676 
- **Work item:** Coordinate logistics HSE briefing, method statement and lifting controls
- **Responsible role:** Logistics Coordinator
### Procurement — #677 
- **Work item:** Coordinate Store, Project and QHSE attendance for receiving inspection
- **Responsible role:** Logistics Coordinator
### Procurement — #678 
- **Work item:** Obtain signed delivery note, proof of delivery and receipt evidence
- **Responsible role:** Logistics Coordinator
### Procurement — #679 
- **Work item:** Record waiting time, demurrage, detention and access-delay evidence
- **Responsible role:** Logistics Coordinator
### Procurement — #680 
- **Work item:** Coordinate approved after-hours, urgent and emergency deliveries
- **Responsible role:** Logistics Coordinator
### Procurement — #681 
- **Work item:** Escalate late dispatch or delivery and implement the approved recovery plan
- **Responsible role:** Logistics Coordinator
### Procurement — #682 
- **Work item:** Record shortage, damage, contamination, temperature or handling exceptions
- **Responsible role:** Logistics Coordinator
### Procurement — #683 
- **Work item:** Coordinate rejected-material collection and return to supplier
- **Responsible role:** Logistics Coordinator
### Procurement — #684 
- **Work item:** Coordinate replacement, redelivery and missed-delivery recovery
- **Responsible role:** Logistics Coordinator
### Procurement — #685 
- **Work item:** Coordinate warehouse-to-project material transfers
- **Responsible role:** Logistics Coordinator
### Procurement — #686 
- **Work item:** Coordinate project-to-warehouse and inter-project material transfers
- **Responsible role:** Logistics Coordinator
### Procurement — #687 
- **Work item:** Coordinate rental plant and equipment mobilisation and demobilisation
- **Responsible role:** Logistics Coordinator
### Procurement — #688 
- **Work item:** Maintain the daily delivery status and outstanding-logistics action register
- **Responsible role:** Logistics Coordinator
### Procurement — #689 
- **Work item:** Prepare logistics cost, carrier-performance and exception reporting
- **Responsible role:** Logistics Coordinator
### Procurement — #690 
- **Work item:** Close each delivery file and hand receipt evidence to Procurement, Store and Finance
- **Responsible role:** Logistics Coordinator
### Procurement — #691 
- **Work item:** Prepare the daily receiving plan, unloading zone and storage space
- **Responsible role:** Storekeeper
### Procurement — #692 
- **Work item:** Verify delivery booking, purchase order and authorised supplier or carrier
- **Responsible role:** Storekeeper
### Procurement — #693 
- **Work item:** Receive and segregate incoming materials, equipment and tools
- **Responsible role:** Storekeeper
### Procurement — #694 
- **Work item:** Count delivered quantities against the delivery note and purchase order
- **Responsible role:** Storekeeper
### Procurement — #695 
- **Work item:** Inspect visible condition, packaging, damage and handling status
- **Responsible role:** Storekeeper
### Procurement — #696 
- **Work item:** Verify item, model, size, batch and project allocation against the purchase order
- **Responsible role:** Storekeeper
### Procurement — #697 
- **Work item:** Verify approved submittal, sample, material code and revision status
- **Responsible role:** Storekeeper
### Procurement — #698 
- **Work item:** Capture delivery photographs, signatures and initial receiving evidence
- **Responsible role:** Storekeeper
### Procurement — #699 
- **Work item:** Coordinate Project and QHSE receiving inspection when required
- **Responsible role:** Storekeeper
### Procurement — #700 
- **Work item:** Segregate and quarantine unapproved, damaged or nonconforming material
- **Responsible role:** Storekeeper
### Procurement — #701 
- **Work item:** Create shortage, excess, damage and discrepancy records
- **Responsible role:** Storekeeper
### Procurement — #702 
- **Work item:** Create rejection and supplier-return records
- **Responsible role:** Storekeeper
### Procurement — #703 
- **Work item:** Create the FirstBit GRN for accepted quantities
- **Responsible role:** Storekeeper
### Procurement — #704 
- **Work item:** Link GRN, delivery note, inspection and project-allocation evidence
- **Responsible role:** Storekeeper
### Procurement — #705 
- **Work item:** Submit GRN and invoice-support records to Procurement and Finance
- **Responsible role:** Storekeeper
### Procurement — #706 
- **Work item:** Assign controlled warehouse, yard, rack and bin locations
- **Responsible role:** Storekeeper
### Procurement — #707 
- **Work item:** Label material by project, item, status, batch and ownership
- **Responsible role:** Storekeeper
### Procurement — #708 
- **Work item:** Store material to prevent weather, moisture, impact and contamination damage
- **Responsible role:** Storekeeper
### Procurement — #709 
- **Work item:** Control hazardous material, SDS, ventilation and segregation requirements
- **Responsible role:** Storekeeper
### Procurement — #710 
- **Work item:** Control shelf-life, batch, expiry and first-expiry-first-out requirements
- **Responsible role:** Storekeeper
### Procurement — #711 
- **Work item:** Secure high-value, controlled, client-supplied and small attractive items
- **Responsible role:** Storekeeper
### Procurement — #712 
- **Work item:** Maintain housekeeping, fire access, stacking and safe-load conditions
- **Responsible role:** Storekeeper
### Procurement — #713 
- **Work item:** Perform scheduled preservation and storage-condition inspections
- **Responsible role:** Storekeeper
### Procurement — #714 
- **Work item:** Maintain real-time FirstBit stock and bin-location records
- **Responsible role:** Storekeeper
### Procurement — #715 
- **Work item:** Maintain minimum, maximum and reorder-level information
- **Responsible role:** Storekeeper
### Procurement — #716 
- **Work item:** Reserve and allocate stock to approved projects and work fronts
- **Responsible role:** Storekeeper
### Procurement — #717 
- **Work item:** Maintain serial-number, batch, warranty and traceability records
- **Responsible role:** Storekeeper
### Procurement — #718 
- **Work item:** Perform scheduled cycle counts
- **Responsible role:** Storekeeper
### Procurement — #719 
- **Work item:** Perform the monthly physical inventory count
- **Responsible role:** Storekeeper
### Procurement — #720 
- **Work item:** Reconcile physical stock to FirstBit and investigate variances
- **Responsible role:** Storekeeper
### Procurement — #721 
- **Work item:** Report slow-moving, obsolete, surplus, damaged and expired stock
- **Responsible role:** Storekeeper
### Procurement — #722 
- **Work item:** Maintain stock-value, consumption and inventory-exception schedules for review
- **Responsible role:** Storekeeper
### Procurement — #723 
- **Work item:** Issue material only against an authorised material request
- **Responsible role:** Storekeeper
### Procurement — #724 
- **Work item:** Verify recipient, project, cost code, quantity and work-front before issue
- **Responsible role:** Storekeeper
### Procurement — #725 
- **Work item:** Record material issues, consumption, balances and acknowledgements
- **Responsible role:** Storekeeper
### Procurement — #726 
- **Work item:** Receive and record unused, excess and returned project material
- **Responsible role:** Storekeeper
### Procurement — #727 
- **Work item:** Execute authorised warehouse, site and inter-project stock transfers
- **Responsible role:** Storekeeper
### Procurement — #728 
- **Work item:** Control tool, equipment and asset issue, return, condition and custody records
- **Responsible role:** Storekeeper
### Procurement — #729 
- **Work item:** Report loss, theft, damage and unauthorised stock movement for investigation
- **Responsible role:** Storekeeper
### Procurement — #730 
- **Work item:** Close project stock with surplus transfer, approved disposal and archived records
- **Responsible role:** Storekeeper
### Finance — #731 
- **Work item:** Set Finance strategy, policies and annual operating objectives
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #732 
- **Work item:** Approve the financial-control framework, chart-of-account governance and segregation of duties
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #733 
- **Work item:** Approve banking mandates, signatory limits and payment-authority controls
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #734 
- **Work item:** Establish financial KPIs, materiality thresholds, reporting standards and closing calendar
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #735 
- **Work item:** Report financial performance, liquidity, compliance and control risk to the CEO
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #736 
- **Work item:** Lead the annual budget and financial operating-plan process
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #737 
- **Work item:** Approve departmental budgets, project budgets and cost-control baselines
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #738 
- **Work item:** Approve the rolling forecast, cash-flow forecast and funding plan
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #739 
- **Work item:** Review capital expenditure, financing needs and major financial commitments
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #740 
- **Work item:** Approve budget-variance, reforecast and corrective-action decisions
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #741 
- **Work item:** Approve weekly cash priorities and the controlled payment plan
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #742 
- **Work item:** Monitor bank balances, liquidity runway, facilities and cash concentration
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #743 
- **Work item:** Approve bank transfers, foreign-exchange transactions and financing drawdowns
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #744 
- **Work item:** Govern bank guarantees, letters of credit and project security instruments
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #745 
- **Work item:** Approve emergency liquidity, funding and collection-recovery actions
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #746 
- **Work item:** Approve project financial activation and work-before-payment exceptions
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #747 
- **Work item:** Approve quotation margins, commercial assumptions and financial deviations
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #748 
- **Work item:** Review project committed cost, actual cost, revenue, margin and forecast-at-completion
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #749 
- **Work item:** Approve material credit notes, write-offs, provisions and retention strategy
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #750 
- **Work item:** Resolve project cost, revenue, cash and collection exceptions with functional chiefs
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #751 
- **Work item:** Approve monthly and year-end financial close
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #752 
- **Work item:** Approve management accounts, cash-flow reporting and executive financial pack
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #753 
- **Work item:** Approve VAT and corporate-tax returns, positions and payments
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #754 
- **Work item:** Oversee external audit, statutory reporting and regulator or bank submissions
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #755 
- **Work item:** Direct response to suspected fraud, financial-control breach and material misstatement
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #756 
- **Work item:** Approve supplier, subcontractor and employee-expense payments within authority
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #757 
- **Work item:** Approve payroll, WPS, end-of-service and employee-settlement payments
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #758 
- **Work item:** Approve owner-related, exceptional and restricted payments under delegated authority
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #759 
- **Work item:** Approve final account, retention release and project financial closeout
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #760 
- **Work item:** Approve Finance continuity, access-control, backup and recovery arrangements
- **Responsible role:** Chief Financial Officer (CFO)
### Finance — #761 
- **Work item:** Plan the Finance operating calendar, cutoffs and recurring control timetable
- **Responsible role:** Senior Accountant (Lead)
### Finance — #762 
- **Work item:** Control customer, supplier, project, bank and cost-code master-data changes
- **Responsible role:** Senior Accountant (Lead)
### Finance — #763 
- **Work item:** Review daily FirstBit posting quality, document completeness and exception status
- **Responsible role:** Senior Accountant (Lead)
### Finance — #764 
- **Work item:** Maintain the Finance issue, correction and overdue-action register
- **Responsible role:** Senior Accountant (Lead)
### Finance — #765 
- **Work item:** Allocate accounting work and verify completion of daily Finance controls
- **Responsible role:** Senior Accountant (Lead)
### Finance — #766 
- **Work item:** Verify the project financial-activation file and contractual billing terms
- **Responsible role:** Senior Accountant (Lead)
### Finance — #767 
- **Work item:** Review proforma and advance invoices before controlled issue
- **Responsible role:** Senior Accountant (Lead)
### Finance — #768 
- **Work item:** Prepare progress billing from certified quantities, milestones and contract terms
- **Responsible role:** Senior Accountant (Lead)
### Finance — #769 
- **Work item:** Review tax-invoice and credit-note basis before approval or issue
- **Responsible role:** Senior Accountant (Lead)
### Finance — #770 
- **Work item:** Maintain customer receivables, ageing and overdue-invoice status
- **Responsible role:** Senior Accountant (Lead)
### Finance — #771 
- **Work item:** Coordinate client collection follow-up and document payment commitments
- **Responsible role:** Senior Accountant (Lead)
### Finance — #772 
- **Work item:** Track retention balances, due dates, release conditions and recovery actions
- **Responsible role:** Senior Accountant (Lead)
### Finance — #773 
- **Work item:** Reconcile customer accounts, disputed balances and unapplied receipts
- **Responsible role:** Senior Accountant (Lead)
### Finance — #774 
- **Work item:** Control the supplier and subcontractor invoice register and period cutoff
- **Responsible role:** Senior Accountant (Lead)
### Finance — #775 
- **Work item:** Review the PO, GRN, invoice and approval three-way match
- **Responsible role:** Senior Accountant (Lead)
### Finance — #776 
- **Work item:** Review subcontractor certification, retention and advance-recovery calculations
- **Responsible role:** Senior Accountant (Lead)
### Finance — #777 
- **Work item:** Validate supplier bank, tax and master-data changes before payment
- **Responsible role:** Senior Accountant (Lead)
### Finance — #778 
- **Work item:** Review expense, petty-cash and employee-reimbursement packages
- **Responsible role:** Senior Accountant (Lead)
### Finance — #779 
- **Work item:** Prepare the payment proposal by due date, priority, cash availability and approval
- **Responsible role:** Senior Accountant (Lead)
### Finance — #780 
- **Work item:** Review payment vouchers, bank-upload files and authorisation evidence
- **Responsible role:** Senior Accountant (Lead)
### Finance — #781 
- **Work item:** Reconcile supplier statements, disputed invoices and debit balances
- **Responsible role:** Senior Accountant (Lead)
### Finance — #782 
- **Work item:** Review daily bank, cash, receipt and payment posting status
- **Responsible role:** Senior Accountant (Lead)
### Finance — #783 
- **Work item:** Prepare and review monthly bank reconciliations
- **Responsible role:** Senior Accountant (Lead)
### Finance — #784 
- **Work item:** Review customer, supplier, employee and related control-account reconciliations
- **Responsible role:** Senior Accountant (Lead)
### Finance — #785 
- **Work item:** Reconcile general-ledger balances to subledgers and supporting schedules
- **Responsible role:** Senior Accountant (Lead)
### Finance — #786 
- **Work item:** Review accruals, prepayments, provisions and cutoff adjustments
- **Responsible role:** Senior Accountant (Lead)
### Finance — #787 
- **Work item:** Review project revenue, cost, work-in-progress and margin-recognition schedules
- **Responsible role:** Senior Accountant (Lead)
### Finance — #788 
- **Work item:** Lead the month-end closing checklist and close unresolved posting exceptions
- **Responsible role:** Senior Accountant (Lead)
### Finance — #789 
- **Work item:** Prepare the trial balance, financial statements and management-account schedules
- **Responsible role:** Senior Accountant (Lead)
### Finance — #790 
- **Work item:** Issue the payroll timetable and verify the approved HR-to-Finance handover
- **Responsible role:** Senior Accountant (Lead)
### Finance — #791 
- **Work item:** Review attendance, overtime, leave, salary and deduction inputs
- **Responsible role:** Senior Accountant (Lead)
### Finance — #792 
- **Work item:** Prepare and review the monthly payroll calculation
- **Responsible role:** Senior Accountant (Lead)
### Finance — #793 
- **Work item:** Control employee advances, loans, deductions and recovery balances
- **Responsible role:** Senior Accountant (Lead)
### Finance — #794 
- **Work item:** Prepare end-of-service, leave-salary and final-settlement calculations
- **Responsible role:** Senior Accountant (Lead)
### Finance — #795 
- **Work item:** Prepare WPS or bank payroll files and reconcile payroll payments
- **Responsible role:** Senior Accountant (Lead)
### Finance — #796 
- **Work item:** Review VAT coding, tax invoices and recoverability documentation
- **Responsible role:** Senior Accountant (Lead)
### Finance — #797 
- **Work item:** Prepare VAT reconciliations, return schedules and filing package
- **Responsible role:** Senior Accountant (Lead)
### Finance — #798 
- **Work item:** Maintain the corporate-tax compliance file and return-support schedules
- **Responsible role:** Senior Accountant (Lead)
### Finance — #799 
- **Work item:** Maintain the fixed-asset register, depreciation and disposal controls
- **Responsible role:** Senior Accountant (Lead)
### Finance — #800 
- **Work item:** Control prepayments, deposits, guarantees and other long-term balance schedules
- **Responsible role:** Senior Accountant (Lead)
### Finance — #801 
- **Work item:** Prepare project cost, revenue, margin and forecast-at-completion reporting
- **Responsible role:** Senior Accountant (Lead)
### Finance — #802 
- **Work item:** Prepare the weekly and monthly company cash forecast
- **Responsible role:** Senior Accountant (Lead)
### Finance — #803 
- **Work item:** Prepare the monthly Finance management pack and variance commentary
- **Responsible role:** Senior Accountant (Lead)
### Finance — #804 
- **Work item:** Prepare audit schedules and coordinate responses to audit queries
- **Responsible role:** Senior Accountant (Lead)
### Finance — #805 
- **Work item:** Control final billing, final account, retention and DLP financial tracking
- **Responsible role:** Senior Accountant (Lead)
### Finance — #806 
- **Work item:** Receive and register Finance documents and transaction requests
- **Responsible role:** Accountant
### Finance — #807 
- **Work item:** Verify required approvals, supporting evidence and FirstBit references
- **Responsible role:** Accountant
### Finance — #808 
- **Work item:** Assign document numbers, project codes, cost codes and filing references
- **Responsible role:** Accountant
### Finance — #809 
- **Work item:** Return missing, duplicate, incorrect or unauthorised transaction packages
- **Responsible role:** Accountant
### Finance — #810 
- **Work item:** Maintain the daily posting queue and transaction-completion status
- **Responsible role:** Accountant
### Finance — #811 
- **Work item:** Create the customer and project billing record from approved master data
- **Responsible role:** Accountant
### Finance — #812 
- **Work item:** Create proforma and advance invoices from approved agreements
- **Responsible role:** Accountant
### Finance — #813 
- **Work item:** Create tax invoices from approved billing or payment evidence
- **Responsible role:** Accountant
### Finance — #814 
- **Work item:** Create progress invoices from certified billing packages
- **Responsible role:** Accountant
### Finance — #815 
- **Work item:** Prepare credit-note entries from approved supporting documents
- **Responsible role:** Accountant
### Finance — #816 
- **Work item:** Post customer receipts and retain bank or cash evidence
- **Responsible role:** Accountant
### Finance — #817 
- **Work item:** Allocate receipts against invoices, advances and project balances
- **Responsible role:** Accountant
### Finance — #818 
- **Work item:** Prepare customer statements, collection logs and unapplied-receipt schedules
- **Responsible role:** Accountant
### Finance — #819 
- **Work item:** Register supplier invoices and verify invoice-control information
- **Responsible role:** Accountant
### Finance — #820 
- **Work item:** Match supplier invoices to purchase orders, GRNs and approvals
- **Responsible role:** Accountant
### Finance — #821 
- **Work item:** Post approved purchase invoices to the correct project and cost code
- **Responsible role:** Accountant
### Finance — #822 
- **Work item:** Record subcontractor invoices, certifications, retention and advances
- **Responsible role:** Accountant
### Finance — #823 
- **Work item:** Record approved employee expenses and reimbursement claims
- **Responsible role:** Accountant
### Finance — #824 
- **Work item:** Prepare payment vouchers with the complete supporting package
- **Responsible role:** Accountant
### Finance — #825 
- **Work item:** Post approved bank, cheque and online supplier payments
- **Responsible role:** Accountant
### Finance — #826 
- **Work item:** Prepare supplier-statement reconciliations and missing-invoice lists
- **Responsible role:** Accountant
### Finance — #827 
- **Work item:** Prepare debit-note, rejection and invoice-correction entries
- **Responsible role:** Accountant
### Finance — #828 
- **Work item:** Download or receive bank statements and record bank transactions
- **Responsible role:** Accountant
### Finance — #829 
- **Work item:** Maintain petty-cash vouchers, limits and replenishment records
- **Responsible role:** Accountant
### Finance — #830 
- **Work item:** Record cash receipts, cash payments and controlled cash transfers
- **Responsible role:** Accountant
### Finance — #831 
- **Work item:** Perform petty-cash and physical-cash counts and reconcile differences
- **Responsible role:** Accountant
### Finance — #832 
- **Work item:** Prepare bank-reconciliation working papers and unmatched-item schedules
- **Responsible role:** Accountant
### Finance — #833 
- **Work item:** Record cheque deposits, returned cheques and bank charges
- **Responsible role:** Accountant
### Finance — #834 
- **Work item:** Retain payment-file, transfer and bank-confirmation evidence
- **Responsible role:** Accountant
### Finance — #835 
- **Work item:** Prepare and post approved journal entries with supporting schedules
- **Responsible role:** Accountant
### Finance — #836 
- **Work item:** Post accrual, prepayment and provision entries from approved calculations
- **Responsible role:** Accountant
### Finance — #837 
- **Work item:** Maintain customer, supplier, employee and clearing-account schedules
- **Responsible role:** Accountant
### Finance — #838 
- **Work item:** Apply correct VAT coding and validate tax-document fields
- **Responsible role:** Accountant
### Finance — #839 
- **Work item:** Prepare VAT input, output and exception schedules
- **Responsible role:** Accountant
### Finance — #840 
- **Work item:** Record fixed-asset additions, transfers, disposals and supporting documents
- **Responsible role:** Accountant
### Finance — #841 
- **Work item:** Post depreciation and fixed-asset reconciliation entries
- **Responsible role:** Accountant
### Finance — #842 
- **Work item:** Reconcile GRN, inventory, advance and deposit clearing accounts
- **Responsible role:** Accountant
### Finance — #843 
- **Work item:** Reconcile employee, payroll, loan and advance balances
- **Responsible role:** Accountant
### Finance — #844 
- **Work item:** Validate payroll source files and approved employee master-data changes
- **Responsible role:** Accountant
### Finance — #845 
- **Work item:** Post payroll, WPS, benefit, deduction and employer-cost entries
- **Responsible role:** Accountant
### Finance — #846 
- **Work item:** Record end-of-service and employee final-settlement transactions
- **Responsible role:** Accountant
### Finance — #847 
- **Work item:** Prepare monthly ledger, balance-sheet and expense schedules
- **Responsible role:** Accountant
### Finance — #848 
- **Work item:** Complete assigned month-end close tasks and correction entries
- **Responsible role:** Accountant
### Finance — #849 
- **Work item:** Prepare documents and schedules requested for audit or management review
- **Responsible role:** Accountant
### Finance — #850 
- **Work item:** Archive Finance records, approvals, returns and bank evidence by retention rule
- **Responsible role:** Accountant
### Marketing & Sales — #851 
- **Work item:** Set Marketing & Sales strategy, policies and annual operating objectives
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #852 
- **Work item:** Define priority services, sectors, project types, markets and client segments
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #853 
- **Work item:** Approve company brand positioning, value proposition and core market messages
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #854 
- **Work item:** Approve sales governance, Delegation of Authority and ethical-conduct controls
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #855 
- **Work item:** Approve CRM ownership, data standards, stage definitions and access controls
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #856 
- **Work item:** Approve annual revenue, qualified-lead, pipeline and conversion targets
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #857 
- **Work item:** Approve target-account, key-account and relationship-development strategy
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #858 
- **Work item:** Approve the annual marketing budget and channel allocation
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #859 
- **Work item:** Approve campaign, event, partnership, referral and business-development plans
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #860 
- **Work item:** Align sales targets and opportunity priorities with technical, delivery and financial capacity
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #861 
- **Work item:** Approve lead-scoring, qualification and opportunity-priority rules
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #862 
- **Work item:** Make Go, Hold or No-Go decisions for major opportunities
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #863 
- **Work item:** Approve tender and bid participation decisions
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #864 
- **Work item:** Approve strategic-client, credit or commercial exceptions through the required authority route
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #865 
- **Work item:** Approve qualified lead handover to Technical Engineering
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #866 
- **Work item:** Approve release of CTO-approved quotations and proposals to clients
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #867 
- **Work item:** Approve client-facing discount, clarification and negotiation boundaries
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #868 
- **Work item:** Lead senior client presentations, relationship meetings and negotiations
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #869 
- **Work item:** Approve changes to client requirements or commitments before downstream handover
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #870 
- **Work item:** Accept client award evidence and initiate Legal contract finalisation
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #871 
- **Work item:** Review the weekly pipeline, probability, value and revenue forecast
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #872 
- **Work item:** Review conversion, sales-cycle, win-rate and stalled-opportunity performance
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #873 
- **Work item:** Review campaign, channel, lead-source and marketing-return performance
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #874 
- **Work item:** Review key-account health, client satisfaction, referrals and repeat-business potential
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #875 
- **Work item:** Resolve material client complaints, pre-contract disputes and reputation risks
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #876 
- **Work item:** Approve marketing privacy, consent, copyright, advertising and communication controls
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #877 
- **Work item:** Approve crisis, public-statement and reputation-response actions
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #878 
- **Work item:** Approve Marketing & Sales access, delegation, backup and continuity arrangements
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #879 
- **Work item:** Sponsor FirstBit CRM, analytics, workflow and sales-process improvements
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #880 
- **Work item:** Report performance, forecast, risks and corrective actions to the CEO
- **Responsible role:** Chief Marketing Officer (CMO)
### Marketing & Sales — #881 
- **Work item:** Research construction-market sectors, demand, client needs and opportunity trends
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #882 
- **Work item:** Maintain competitor, pricing-position, service and market-intelligence records
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #883 
- **Work item:** Build and maintain the target-account and market-segment database
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #884 
- **Work item:** Monitor tender portals, referrals, networks and opportunity sources
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #885 
- **Work item:** Prepare the annual and quarterly Marketing & Sales operating plan
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #886 
- **Work item:** Maintain the campaign, content, event and client-engagement calendar
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #887 
- **Work item:** Prepare campaign briefs with audience, message, budget, channel and KPI
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #888 
- **Work item:** Coordinate approved marketing-spend commitments with Procurement and Finance
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #889 
- **Work item:** Maintain brand guidelines and the controlled marketing-asset library
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #890 
- **Work item:** Prepare the content plan and production schedule
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #891 
- **Work item:** Prepare approved project credentials, case studies and reference material
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #892 
- **Work item:** Maintain company profiles, capability statements and prequalification content
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #893 
- **Work item:** Maintain approved website service, project and contact information
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #894 
- **Work item:** Maintain the approved social-media publishing calendar
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #895 
- **Work item:** Execute approved digital, email, social, print and direct-marketing campaigns
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #896 
- **Work item:** Coordinate exhibitions, industry events, client visits and promotional activities
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #897 
- **Work item:** Coordinate approved agencies, designers, photographers, media and marketing suppliers
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #898 
- **Work item:** Control content approval, client consent, copyright and publication evidence
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #899 
- **Work item:** Monitor email, phone, WhatsApp, website, social, portal, referral and repeat-client enquiries
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #900 
- **Work item:** Register each enquiry in FirstBit CRM and assign a unique Lead ID
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #901 
- **Work item:** Identify and merge duplicate client, contact and opportunity records
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #902 
- **Work item:** Record campaign, channel, referral and lead-source attribution
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #903 
- **Work item:** Collect client identity, contact, KYC and communication-consent information
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #904 
- **Work item:** Collect client brief, drawings, photographs, location and available site information
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #905 
- **Work item:** Qualify service need, scope, budget, timing, stakeholders and decision process
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #906 
- **Work item:** Apply the approved lead score, status, priority and qualification outcome
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #907 
- **Work item:** Acknowledge the enquiry and communicate the controlled next action
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #908 
- **Work item:** Assign the qualified lead to the Business Development Executive with response SLA
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #909 
- **Work item:** Complete the qualified-lead checklist and controlled handover pack
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #910 
- **Work item:** Create the FirstBit technical pre-assessment handover task for the CTO
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #911 
- **Work item:** Track CTO acceptance, return, clarification and technical-owner assignment
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #912 
- **Work item:** Coordinate site-visit access, client attendance and requirement confirmation
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #913 
- **Work item:** Maintain the client clarification, requirement and decision log
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #914 
- **Work item:** Coordinate the preliminary concept and indicative-budget presentation
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #915 
- **Work item:** Coordinate the CTO-approved detailed-design quotation or agreement process
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #916 
- **Work item:** Coordinate release of the CTO-approved construction quotation and commercial offer
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #917 
- **Work item:** Control proposal revisions, assumptions, exclusions and client-facing versions
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #918 
- **Work item:** Coordinate client feedback and approved technical or commercial clarifications
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #919 
- **Work item:** Maintain opportunity stage, probability, value, expected close date and next action
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #920 
- **Work item:** Review daily overdue lead, proposal and client-follow-up actions
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #921 
- **Work item:** Prepare the weekly pipeline, conversion and revenue forecast
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #922 
- **Work item:** Prepare campaign, funnel, lead-source and conversion-performance reporting
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #923 
- **Work item:** Maintain controlled pre-contract client communication and approval evidence
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #924 
- **Work item:** Coordinate proposal presentations and negotiation meetings
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #925 
- **Work item:** Capture written client approval, letter of intent, award and decision evidence
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #926 
- **Work item:** Hand won opportunities to Legal, Finance and Technical Engineering
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #927 
- **Work item:** Track contract and financial-activation status before downstream release
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #928 
- **Work item:** Record Hold, No-Go and lost opportunities with standard reason codes
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #929 
- **Work item:** Perform win-loss analysis and maintain corrective-action records
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #930 
- **Work item:** Coordinate client satisfaction, referral and repeat-opportunity follow-up
- **Responsible role:** Marketing Manager (Lead)
### Marketing & Sales — #931 
- **Work item:** Maintain the assigned target-account and prospect list
- **Responsible role:** Business Development Executive
### Marketing & Sales — #932 
- **Work item:** Research client organisations, decision makers, influencers and project interests
- **Responsible role:** Business Development Executive
### Marketing & Sales — #933 
- **Work item:** Verify prospect contact details, relevance and communication consent
- **Responsible role:** Business Development Executive
### Marketing & Sales — #934 
- **Work item:** Identify planned villas, warehouses, retrofit and design-and-build opportunities
- **Responsible role:** Business Development Executive
### Marketing & Sales — #935 
- **Work item:** Monitor assigned tender portals, notices and invitation sources
- **Responsible role:** Business Development Executive
### Marketing & Sales — #936 
- **Work item:** Build approved referral, consultant, partner and professional-network relationships
- **Responsible role:** Business Development Executive
### Marketing & Sales — #937 
- **Work item:** Prepare daily and weekly prospecting, meeting and follow-up plans
- **Responsible role:** Business Development Executive
### Marketing & Sales — #938 
- **Work item:** Submit new market, client, competitor and opportunity signals to the Marketing Manager
- **Responsible role:** Business Development Executive
### Marketing & Sales — #939 
- **Work item:** Conduct approved calls, emails, WhatsApp messages, visits and networking outreach
- **Responsible role:** Business Development Executive
### Marketing & Sales — #940 
- **Work item:** Use only approved scripts, credentials, presentations and company information
- **Responsible role:** Business Development Executive
### Marketing & Sales — #941 
- **Work item:** Schedule introductory, discovery and follow-up meetings
- **Responsible role:** Business Development Executive
### Marketing & Sales — #942 
- **Work item:** Record each outreach attempt, response and agreed next action in FirstBit CRM
- **Responsible role:** Business Development Executive
### Marketing & Sales — #943 
- **Work item:** Respond to assigned enquiries within the approved service level
- **Responsible role:** Business Development Executive
### Marketing & Sales — #944 
- **Work item:** Collect initial project type, location, scope, budget and timing information
- **Responsible role:** Business Development Executive
### Marketing & Sales — #945 
- **Work item:** Identify decision makers, approval stakeholders and procurement route
- **Responsible role:** Business Development Executive
### Marketing & Sales — #946 
- **Work item:** Flag duplicate, unsuitable, suspicious or out-of-strategy enquiries for review
- **Responsible role:** Business Development Executive
### Marketing & Sales — #947 
- **Work item:** Prepare the client and opportunity briefing before each meeting
- **Responsible role:** Business Development Executive
### Marketing & Sales — #948 
- **Work item:** Conduct the approved discovery meeting and record complete meeting notes
- **Responsible role:** Business Development Executive
### Marketing & Sales — #949 
- **Work item:** Capture client business need, required service, scope and expected outcome
- **Responsible role:** Business Development Executive
### Marketing & Sales — #950 
- **Work item:** Confirm indicative budget, target programme, decision date and selection criteria
- **Responsible role:** Business Development Executive
### Marketing & Sales — #951 
- **Work item:** Coordinate site-visit timing, access, attendance and available documents
- **Responsible role:** Business Development Executive
### Marketing & Sales — #952 
- **Work item:** Record site access information, photographs, drawings and client-provided evidence
- **Responsible role:** Business Development Executive
### Marketing & Sales — #953 
- **Work item:** Raise missing-information and clarification requests through the Marketing Manager
- **Responsible role:** Business Development Executive
### Marketing & Sales — #954 
- **Work item:** Confirm the client’s next action, Sevents owner and follow-up date
- **Responsible role:** Business Development Executive
### Marketing & Sales — #955 
- **Work item:** Support preparation of the qualified-lead handover to Technical Engineering
- **Responsible role:** Business Development Executive
### Marketing & Sales — #956 
- **Work item:** Follow up missing drawings, briefs, KYC and decision information
- **Responsible role:** Business Development Executive
### Marketing & Sales — #957 
- **Work item:** Support approved concept, capability, proposal and quotation presentations
- **Responsible role:** Business Development Executive
### Marketing & Sales — #958 
- **Work item:** Issue only approved and revision-controlled client documents
- **Responsible role:** Business Development Executive
### Marketing & Sales — #959 
- **Work item:** Record client feedback, questions, objections and clarification requests
- **Responsible role:** Business Development Executive
### Marketing & Sales — #960 
- **Work item:** Follow up quotation, design-agreement, award and contract decisions
- **Responsible role:** Business Development Executive
### Marketing & Sales — #961 
- **Work item:** Support negotiations only within CMO-approved boundaries
- **Responsible role:** Business Development Executive
### Marketing & Sales — #962 
- **Work item:** Convert verbal client commitments into written confirmation and CRM evidence
- **Responsible role:** Business Development Executive
### Marketing & Sales — #963 
- **Work item:** Maintain current CRM stage, notes, contacts, tasks and next-action dates
- **Responsible role:** Business Development Executive
### Marketing & Sales — #964 
- **Work item:** Update opportunity probability, value, expected close date and decision status
- **Responsible role:** Business Development Executive
### Marketing & Sales — #965 
- **Work item:** Report daily and weekly pipeline movement, delays and support requirements
- **Responsible role:** Business Development Executive
### Marketing & Sales — #966 
- **Work item:** Maintain the approved client relationship and communication cadence
- **Responsible role:** Business Development Executive
### Marketing & Sales — #967 
- **Work item:** Coordinate client satisfaction, referral and repeat-business discussions
- **Responsible role:** Business Development Executive
### Marketing & Sales — #968 
- **Work item:** Record no-response, Hold, No-Go and loss reasons accurately
- **Responsible role:** Business Development Executive
### Marketing & Sales — #969 
- **Work item:** Capture competitor, client, price-position and market intelligence
- **Responsible role:** Business Development Executive
### Marketing & Sales — #970 
- **Work item:** Protect confidential information and escalate complaints, conflicts or ethical concerns
- **Responsible role:** Business Development Executive
### People & Culture — #971 
- **Work item:** Set workforce organisation and People & Culture strategy
- **Responsible role:** Chief People & Culture Officer (CPCO)
### People & Culture — #972 
- **Work item:** Approve manpower plan, recruitment and compensation proposals
- **Responsible role:** Chief People & Culture Officer (CPCO)
### People & Culture — #973 
- **Work item:** Approve employment, salary, leave and termination decisions
- **Responsible role:** Chief People & Culture Officer (CPCO)
### People & Culture — #974 
- **Work item:** Review performance, capability and succession risks
- **Responsible role:** Chief People & Culture Officer (CPCO)
### People & Culture — #975 
- **Work item:** Govern employee relations, discipline and grievance cases
- **Responsible role:** Chief People & Culture Officer (CPCO)
### People & Culture — #976 
- **Work item:** Report workforce cost, compliance and People & Culture KPIs
- **Responsible role:** Chief People & Culture Officer (CPCO)
### People & Culture — #977 
- **Work item:** Evaluate and shortlist candidates
- **Responsible role:** HR & Admin Lead
### People & Culture — #978 
- **Work item:** Confirm approved salary package and joining date
- **Responsible role:** HR & Admin Lead
### People & Culture — #979 
- **Work item:** Deliver company induction and policy briefing
- **Responsible role:** HR & Admin Lead
### People & Culture — #980 
- **Work item:** Introduce employee to team and reporting line
- **Responsible role:** HR & Admin Lead
### People & Culture — #981 
- **Work item:** Collect first-week performance and onboarding feedback
- **Responsible role:** HR & Admin Lead
### People & Culture — #982 
- **Work item:** Confirm departmental work handover
- **Responsible role:** HR & Admin Lead
### People & Culture — #983 
- **Work item:** Coordinate staff accommodation and requirements
- **Responsible role:** HR & Admin Lead
### People & Culture — #984 
- **Work item:** Prepare warning letters and disciplinary memos
- **Responsible role:** HR & Admin Lead
### People & Culture — #985 
- **Work item:** Draft employment contracts
- **Responsible role:** HR & Admin Lead
### People & Culture — #986 
- **Work item:** Coordinate employee performance appraisals
- **Responsible role:** HR & Admin Lead
### People & Culture — #987 
- **Work item:** Issue and track quarterly appraisal forms
- **Responsible role:** HR & Admin Lead
### People & Culture — #988 
- **Work item:** Update ERP timesheets and verify payroll inputs
- **Responsible role:** HR & Admin Lead
### People & Culture — #989 
- **Work item:** Administer employee medical and workers compensation insurance
- **Responsible role:** HR & Admin Lead
### People & Culture — #990 
- **Work item:** Follow up approved People & Culture payments with Accounts
- **Responsible role:** HR & Admin Lead
### People & Culture — #991 
- **Work item:** Process salary advance requests for approval
- **Responsible role:** HR & Admin Lead
### People & Culture — #992 
- **Work item:** Coordinate People & Culture requirements with site engineers
- **Responsible role:** HR & Admin Lead
### People & Culture — #993 
- **Work item:** Prepare and control company policies for management approval
- **Responsible role:** HR & Admin Lead
### People & Culture — #994 
- **Work item:** Prepare company event communications and announcements
- **Responsible role:** HR & Admin Lead
### People & Culture — #995 
- **Work item:** Coordinate contractor's all-risk insurance for projects
- **Responsible role:** HR & Admin Lead
### People & Culture — #996 
- **Work item:** Prepare and route project undertakings for approval
- **Responsible role:** HR & Admin Lead
### People & Culture — #997 
- **Work item:** Coordinate approved vendors for systems, uniforms, software and supplies
- **Responsible role:** HR & Admin Lead
### People & Culture — #998 
- **Work item:** Validate manpower requisition and budget before recruitment
- **Responsible role:** HR & Admin Lead
### People & Culture — #999 
- **Work item:** Manage formal offer approval and issuance
- **Responsible role:** HR & Admin Lead
### People & Culture — #1000 
- **Work item:** Process employee transfers, promotions and salary changes
- **Responsible role:** HR & Admin Lead
### People & Culture — #1001 
- **Work item:** Manage grievance and disciplinary case workflow
- **Responsible role:** HR & Admin Lead
### People & Culture — #1002 
- **Work item:** Coordinate exit clearance, final settlement and exit interview
- **Responsible role:** HR & Admin Lead
### People & Culture — #1003 
- **Work item:** Maintain employee training and competency plan
- **Responsible role:** HR & Admin Lead
### People & Culture — #1004 
- **Work item:** Pre-screen white-collar candidates through approved recruitment channels
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1005 
- **Work item:** Pre-screen blue-collar candidates through approved recruitment channels or agencies
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1006 
- **Work item:** Schedule and prepare candidate interviews
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1007 
- **Work item:** Complete background checks for locally hired employees
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1008 
- **Work item:** Collect and verify pre-employment documents
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1009 
- **Work item:** Maintain candidate follow-up until joining
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1010 
- **Work item:** Obtain signed employment agreement
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1011 
- **Work item:** Collect completed employee information form
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1012 
- **Work item:** Manage passport receipt and acknowledgement under approved policy
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1013 
- **Work item:** Register employee biometric attendance
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1014 
- **Work item:** Confirm employment record in employee register and ERP
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1015 
- **Work item:** Process work permit and visa cancellation
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1016 
- **Work item:** Update ERP termination status and last working date
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1017 
- **Work item:** Return passport or controlled personal documents and obtain acknowledgement
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1018 
- **Work item:** Process employee visas and renewals
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1019 
- **Work item:** Arrange approved visit visas and air tickets
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1020 
- **Work item:** Coordinate authorised PRO transactions
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1021 
- **Work item:** Manage approved Instagram and LinkedIn updates
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1022 
- **Work item:** Prepare employee and administrative request letters
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1023 
- **Work item:** Maintain employee master data in Excel and ERP
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1024 
- **Work item:** Maintain physical and digital employee files
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1025 
- **Work item:** Distribute payslips securely
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1026 
- **Work item:** Track annual leave balances and requests
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1027 
- **Work item:** Consolidate site and office attendance
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1028 
- **Work item:** Submit Emirates ID data for C3 payroll card processing
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1029 
- **Work item:** Track expiry and renewal of company documents, licences and visas
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1030 
- **Work item:** Process authorised transactions on the MOHRE portal
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1031 
- **Work item:** Process authorised transactions on the Invest in Dubai portal
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1032 
- **Work item:** Track DEQ portal updates and required actions
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1033 
- **Work item:** Track probation deadlines and confirmation decisions
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1034 
- **Work item:** Maintain controlled HR forms, templates and revision index
- **Responsible role:** HR & Admin Assistant
### People & Culture — #1035 
- **Work item:** Conduct office and facility orientation
- **Responsible role:** Office Assistant
### People & Culture — #1036 
- **Work item:** Allocate workstation and company assets
- **Responsible role:** Office Assistant
### People & Culture — #1037 
- **Work item:** Arrange approved employee transportation
- **Responsible role:** Office Assistant
### People & Culture — #1038 
- **Work item:** Issue uniforms and colour-coded safety helmets
- **Responsible role:** Office Assistant
### People & Culture — #1039 
- **Work item:** Collect and reconcile vehicle tracking sheets
- **Responsible role:** Office Assistant
### People & Culture — #1040 
- **Work item:** Maintain controlled company document files
- **Responsible role:** Office Assistant
### People & Culture — #1041 
- **Work item:** Handle office correspondence, calls and shared email
- **Responsible role:** Office Assistant
### People & Culture — #1042 
- **Work item:** Coordinate vehicle insurance and Mulkiya renewal
- **Responsible role:** Office Assistant
### People & Culture — #1043 
- **Work item:** Coordinate RTA fines, testing and vehicle passing
- **Responsible role:** Office Assistant
### People & Culture — #1044 
- **Work item:** Register Salik for new vehicles
- **Responsible role:** Office Assistant
### People & Culture — #1045 
- **Work item:** Register vehicles in ENOC VIP
- **Responsible role:** Office Assistant
### People & Culture — #1046 
- **Work item:** Upload approved purchase details and receipts to Pluto
- **Responsible role:** Office Assistant
### People & Culture — #1047 
- **Work item:** Maintain office and pantry supplies
- **Responsible role:** Office Assistant
### People & Culture — #1048 
- **Work item:** Coordinate office requirements with building management
- **Responsible role:** Office Assistant
### People & Culture — #1049 
- **Work item:** Coordinate GPS installation for new vehicles
- **Responsible role:** Office Assistant
### People & Culture — #1050 
- **Work item:** Maintain the PWD sheet after purpose and data-standard approval
- **Responsible role:** Office Assistant
### People & Culture — #1051 
- **Work item:** Track cleaner attendance and service completion
- **Responsible role:** Office Assistant
### People & Culture — #1052 
- **Work item:** Prepare meeting rooms, refreshments and internal logistics
- **Responsible role:** Office Assistant
### People & Culture — #1053 
- **Work item:** Support filing, scanning, copying and dispatch
- **Responsible role:** Office Assistant
### People & Culture — #1054 
- **Work item:** Report facility maintenance and office safety issues
- **Responsible role:** Office Assistant
### People & Culture — #1055 
- **Work item:** Maintain office support request and completion log
- **Responsible role:** Office Assistant
### People & Culture — #1056 
- **Work item:** Prepare system, software, email and server access before joining
- **Responsible role:** IT Support Engineer
### People & Culture — #1057 
- **Work item:** Issue approved email and ERP access and deliver system training
- **Responsible role:** IT Support Engineer
### People & Culture — #1058 
- **Work item:** Revoke user access and recover company-controlled accounts
- **Responsible role:** IT Support Engineer
### People & Culture — #1059 
- **Work item:** Recover and reconcile company assets
- **Responsible role:** IT Support Engineer
### People & Culture — #1060 
- **Work item:** Manage IT asset allocation and return
- **Responsible role:** IT Support Engineer
### People & Culture — #1061 
- **Work item:** Configure employee software and systems
- **Responsible role:** IT Support Engineer
### People & Culture — #1062 
- **Work item:** Maintain company website in WIX
- **Responsible role:** IT Support Engineer
### People & Culture — #1063 
- **Work item:** Create approved company email accounts
- **Responsible role:** IT Support Engineer
### People & Culture — #1064 
- **Work item:** Create approved ERP user accounts
- **Responsible role:** IT Support Engineer
### People & Culture — #1065 
- **Work item:** Maintain IT asset, software licence and access registers
- **Responsible role:** IT Support Engineer
### People & Culture — #1066 
- **Work item:** Resolve user hardware, software and connectivity incidents
- **Responsible role:** IT Support Engineer
### People & Culture — #1067 
- **Work item:** Perform backup, endpoint security and patch controls
- **Responsible role:** IT Support Engineer
### People & Culture — #1068 
- **Work item:** Report security incidents, downtime and recurring IT issues
- **Responsible role:** IT Support Engineer
### Research & Development — #1069 
- **Work item:** Set R&D and process-excellence strategy, policies and annual objectives
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1070 
- **Work item:** Define priorities for process, data, digital, knowledge and innovation improvement
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1071 
- **Work item:** Maintain the company improvement and innovation initiative portfolio
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1072 
- **Work item:** Approve initiative charters, business cases, owners and stage-gate plans
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1073 
- **Work item:** Align the R&D portfolio with company strategy, budget and delivery capacity
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1074 
- **Work item:** Report portfolio value, progress, risks and decisions to the CEO
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1075 
- **Work item:** Design and maintain the end-to-end company process architecture
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1076 
- **Work item:** Define process hierarchy, naming, numbering and classification standards
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1077 
- **Work item:** Maintain the process inventory and accountable process-owner register
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1078 
- **Work item:** Define cross-department inputs, outputs, handoffs and service levels
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1079 
- **Work item:** Resolve duplicated, conflicting, missing or unowned company work
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1080 
- **Work item:** Maintain RACI, Delegation-of-Authority and approval-control links
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1081 
- **Work item:** Set the SOP framework, templates, lifecycle and minimum control requirements
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1082 
- **Work item:** Maintain the annual SOP creation, review and expiry calendar
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1083 
- **Work item:** Lead process-discovery and SOP-design workshops with process owners
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1084 
- **Work item:** Verify SOP triggers, actions, outputs, evidence, controls and escalations
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1085 
- **Work item:** Route new and revised SOPs through functional and executive approval
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1086 
- **Work item:** Govern temporary process deviations, waivers and exception expiry
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1087 
- **Work item:** Receive and qualify FirstBit ERP workflow requirements from departments
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1088 
- **Work item:** Map approved processes into statuses, roles, approvals and exception routes
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1089 
- **Work item:** Approve workflow blueprints, mandatory fields, permissions and audit evidence
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1090 
- **Work item:** Coordinate ERP build, user-acceptance testing, deployment and controlled release
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1091 
- **Work item:** Control FirstBit workflow change requests and configuration versions
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1092 
- **Work item:** Monitor workflow adoption, overdue steps, bypasses and audit-trail quality
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1093 
- **Work item:** Set master-data taxonomy, naming, ownership and mandatory-field standards
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1094 
- **Work item:** Review new item, service, project and other master-data requests
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1095 
- **Work item:** Verify master-data completeness, uniqueness, classification and source ownership
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1096 
- **Work item:** Create approved master-data records in FirstBit ERP
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1097 
- **Work item:** Control master-data correction, merge, deactivation and reactivation requests
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1098 
- **Work item:** Measure master-data quality and direct recurring-error corrective actions
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1099 
- **Work item:** Define the company process KPI dictionary, owners and reporting frequency
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1100 
- **Work item:** Design process dashboards, service levels and exception thresholds
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1101 
- **Work item:** Validate performance data sources, calculations and reconciliation controls
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1102 
- **Work item:** Issue weekly and monthly process-performance and compliance analysis
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1103 
- **Work item:** Identify workflow bottlenecks, ageing, rework, delay and control leakage
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1104 
- **Work item:** Assign performance corrective actions and verify effective closure
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1105 
- **Work item:** Register improvement requests, audit findings and recurring process failures
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1106 
- **Work item:** Prioritise improvements by risk, value, frequency and implementation effort
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1107 
- **Work item:** Map the current state and identify waste, failure points and root causes
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1108 
- **Work item:** Design the future-state workflow, roles, controls and measurable benefits
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1109 
- **Work item:** Coordinate controlled improvement trials, feedback and issue correction
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1110 
- **Work item:** Verify benefit realisation, control effectiveness and improvement closure
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1111 
- **Work item:** Scan construction, operational and management innovations relevant to Sevents
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1112 
- **Work item:** Benchmark contractor practices, workflows, tools and productivity methods
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1113 
- **Work item:** Evaluate automation, analytics, AI and digital-workflow opportunities
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1114 
- **Work item:** Prepare innovation business cases with cost, benefit, risk and ownership
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1115 
- **Work item:** Coordinate proof-of-concept and pilot testing with affected departments
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1116 
- **Work item:** Recommend scale-up, modification, deferment or termination of pilots
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1117 
- **Work item:** Collect lessons from stage gates, incidents, failures and project closeout
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1118 
- **Work item:** Facilitate structured lessons-learned and root-cause review sessions
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1119 
- **Work item:** Maintain the company knowledge repository and controlled taxonomy
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1120 
- **Work item:** Convert accepted lessons into SOP, workflow, checklist or training changes
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1121 
- **Work item:** Coordinate knowledge-sharing workshops and cross-project learning sessions
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1122 
- **Work item:** Track lesson adoption, reuse and recurrence of previously identified failures
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1123 
- **Work item:** Assess stakeholder, role, system, data and control impacts of approved changes
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1124 
- **Work item:** Approve change communication, training, deployment and readiness plans
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1125 
- **Work item:** Coordinate process and system training with CPCO and functional owners
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1126 
- **Work item:** Monitor adoption, resistance, hypercare issues and stabilisation actions
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1127 
- **Work item:** Govern R&D access, delegation, backup and business-continuity arrangements
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1128 
- **Work item:** Maintain R&D risk, decision, dependency and executive-action registers
- **Responsible role:** Chief Research Officer (CRO)
### Research & Development — #1129 
- **Work item:** Receive and acknowledge each document-control submission
- **Responsible role:** Document Controller
### Research & Development — #1130 
- **Work item:** Verify the document author, owner, reviewer and approval authority
- **Responsible role:** Document Controller
### Research & Development — #1131 
- **Work item:** Verify title, category, project, discipline and required metadata
- **Responsible role:** Document Controller
### Research & Development — #1132 
- **Work item:** Assign the approved unique document number
- **Responsible role:** Document Controller
### Research & Development — #1133 
- **Work item:** Register source, receipt date, status, owner and required response date
- **Responsible role:** Document Controller
### Research & Development — #1134 
- **Work item:** Return incomplete, duplicate or unauthorised submissions for correction
- **Responsible role:** Document Controller
### Research & Development — #1135 
- **Work item:** Classify document type, confidentiality, retention and distribution level
- **Responsible role:** Document Controller
### Research & Development — #1136 
- **Work item:** Apply approved file-naming and folder-structure conventions
- **Responsible role:** Document Controller
### Research & Development — #1137 
- **Work item:** Assign revision, issue purpose and document-status codes
- **Responsible role:** Document Controller
### Research & Development — #1138 
- **Work item:** Maintain document version history and revision traceability
- **Responsible role:** Document Controller
### Research & Development — #1139 
- **Work item:** Apply approved access, editing and distribution permissions
- **Responsible role:** Document Controller
### Research & Development — #1140 
- **Work item:** Maintain the controlled document index and repository structure
- **Responsible role:** Document Controller
### Research & Development — #1141 
- **Work item:** Route documents through the approved review and approval workflow
- **Responsible role:** Document Controller
### Research & Development — #1142 
- **Work item:** Track reviewer comments, due dates and overdue review actions
- **Responsible role:** Document Controller
### Research & Development — #1143 
- **Work item:** Return consolidated review comments to the document author
- **Responsible role:** Document Controller
### Research & Development — #1144 
- **Work item:** Verify approval evidence, authority, signatures and release conditions
- **Responsible role:** Document Controller
### Research & Development — #1145 
- **Work item:** Issue only the approved controlled document version
- **Responsible role:** Document Controller
### Research & Development — #1146 
- **Work item:** Record approval, issue, status and supersession evidence
- **Responsible role:** Document Controller
### Research & Development — #1147 
- **Work item:** Prepare controlled document transmittals with complete issue details
- **Responsible role:** Document Controller
### Research & Development — #1148 
- **Work item:** Distribute approved documents to authorised internal and external recipients
- **Responsible role:** Document Controller
### Research & Development — #1149 
- **Work item:** Record recipients, issue dates, acknowledgements and delivery evidence
- **Responsible role:** Document Controller
### Research & Development — #1150 
- **Work item:** Register incoming client, consultant, authority and supplier correspondence
- **Responsible role:** Document Controller
### Research & Development — #1151 
- **Work item:** Register approved outgoing company and project correspondence
- **Responsible role:** Document Controller
### Research & Development — #1152 
- **Work item:** Track correspondence response owners, commitments, due dates and closure
- **Responsible role:** Document Controller
### Research & Development — #1153 
- **Work item:** Maintain the project drawing and revision register
- **Responsible role:** Document Controller
### Research & Development — #1154 
- **Work item:** Maintain specifications, BOQ, schedule and technical-document registers
- **Responsible role:** Document Controller
### Research & Development — #1155 
- **Work item:** Maintain material, shop-drawing and technical-submittal status registers
- **Responsible role:** Document Controller
### Research & Development — #1156 
- **Work item:** Maintain RFI, technical-clarification and response registers
- **Responsible role:** Document Controller
### Research & Development — #1157 
- **Work item:** Maintain authority, client and consultant submission and approval registers
- **Responsible role:** Document Controller
### Research & Development — #1158 
- **Work item:** Control IFC handover completeness, revision alignment and transmittal evidence
- **Responsible role:** Document Controller
### Research & Development — #1159 
- **Work item:** Maintain the controlled SOP register and scheduled-review status
- **Responsible role:** Document Controller
### Research & Development — #1160 
- **Work item:** Maintain controlled policies, manuals and governance documents
- **Responsible role:** Document Controller
### Research & Development — #1161 
- **Work item:** Maintain approved forms, templates, checklists and work instructions
- **Responsible role:** Document Controller
### Research & Development — #1162 
- **Work item:** Maintain controlled organisation charts, job descriptions and process maps
- **Responsible role:** Document Controller
### Research & Development — #1163 
- **Work item:** Maintain RACI, authority, approval and responsibility matrices
- **Responsible role:** Document Controller
### Research & Development — #1164 
- **Work item:** Maintain controlled standards, references and supporting corporate records
- **Responsible role:** Document Controller
### Research & Development — #1165 
- **Work item:** Register and issue approved meeting agendas, minutes and attendance records
- **Responsible role:** Document Controller
### Research & Development — #1166 
- **Work item:** Maintain the cross-department and project action registers
- **Responsible role:** Document Controller
### Research & Development — #1167 
- **Work item:** Maintain executive, technical and project decision registers
- **Responsible role:** Document Controller
### Research & Development — #1168 
- **Work item:** Maintain risk, assumption, issue, constraint and change registers
- **Responsible role:** Document Controller
### Research & Development — #1169 
- **Work item:** Register daily, weekly and monthly project reports
- **Responsible role:** Document Controller
### Research & Development — #1170 
- **Work item:** Register approvals, inspections, tests, certificates and completion evidence
- **Responsible role:** Document Controller
### Research & Development — #1171 
- **Work item:** Register document-change requests and affected-document references
- **Responsible role:** Document Controller
### Research & Development — #1172 
- **Work item:** Verify change impact, dependencies and required reapproval route
- **Responsible role:** Document Controller
### Research & Development — #1173 
- **Work item:** Coordinate revised document review, approval and controlled reissue
- **Responsible role:** Document Controller
### Research & Development — #1174 
- **Work item:** Withdraw and supersede obsolete document versions
- **Responsible role:** Document Controller
### Research & Development — #1175 
- **Work item:** Recall uncontrolled copies and notify affected recipients
- **Responsible role:** Document Controller
### Research & Development — #1176 
- **Work item:** Record document-control nonconformities and corrective-action closure
- **Responsible role:** Document Controller
### Research & Development — #1177 
- **Work item:** Prepare the project document-handover and final-record index
- **Responsible role:** Document Controller
### Research & Development — #1178 
- **Work item:** Reconcile the latest approved drawings, documents and register status
- **Responsible role:** Document Controller
### Research & Development — #1179 
- **Work item:** Compile as-built, O&M, warranty, certificate and approval records
- **Responsible role:** Document Controller
### Research & Development — #1180 
- **Work item:** Close missing transmittal, correspondence, action and approval records
- **Responsible role:** Document Controller
### Research & Development — #1181 
- **Work item:** Archive final project records, lessons learned and closeout evidence
- **Responsible role:** Document Controller
### Research & Development — #1182 
- **Work item:** Apply retention, retrieval, legal-hold and approved-disposal controls
- **Responsible role:** Document Controller
### Research & Development — #1183 
- **Work item:** Issue the weekly overdue-document, review and response status report
- **Responsible role:** Document Controller
### Research & Development — #1184 
- **Work item:** Prepare the monthly document-control KPI and exception report
- **Responsible role:** Document Controller
### Research & Development — #1185 
- **Work item:** Perform document-register and controlled-repository spot checks
- **Responsible role:** Document Controller
### Research & Development — #1186 
- **Work item:** Train and support users on document-control procedures and templates
- **Responsible role:** Document Controller
### Research & Development — #1187 
- **Work item:** Maintain document-control access, backup and absence-cover arrangements
- **Responsible role:** Document Controller
### Research & Development — #1188 
- **Work item:** Test archive retrieval and document-recovery readiness with IT
- **Responsible role:** Document Controller
### Legal — #1189 
- **Work item:** Set Legal strategy, policies and annual operating objectives
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1190 
- **Work item:** Define legal risk appetite, materiality thresholds and escalation criteria
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1191 
- **Work item:** Approve Legal Delegation of Authority and reserved-matter matrix
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1192 
- **Work item:** Approve contract standards, clause library and deviation controls
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1193 
- **Work item:** Approve matter classification, confidentiality, privilege and access controls
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1194 
- **Work item:** Approve legal review strategy for client construction and design contracts
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1195 
- **Work item:** Approve tender qualifications, exclusions and legal risk positions
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1196 
- **Work item:** Approve material client contract deviations before signature
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1197 
- **Work item:** Approve material supplier, subcontract and consultancy contract deviations
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1198 
- **Work item:** Approve joint venture, consortium, partnership, MOU and NDA positions
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1199 
- **Work item:** Approve contractual notice and claim strategy
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1200 
- **Work item:** Approve variation, extension-of-time and delay-claim legal positions
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1201 
- **Work item:** Approve dispute escalation, without-prejudice negotiation and settlement strategy
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1202 
- **Work item:** Approve litigation, arbitration and expert-determination strategy
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1203 
- **Work item:** Appoint and direct external counsel, experts and claims advisers
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1204 
- **Work item:** Oversee corporate licences, registrations, permits and renewals
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1205 
- **Work item:** Approve corporate authorities, powers of attorney and signatory controls
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1206 
- **Work item:** Review the legal compliance register and material regulatory obligations
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1207 
- **Work item:** Direct internal investigations, whistleblowing and fraud-related legal response
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1208 
- **Work item:** Approve data privacy, intellectual property, brand and confidentiality legal controls
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1209 
- **Work item:** Approve the contract-activation legal gate and project legal handover
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1210 
- **Work item:** Approve insurance, bond, guarantee, security and indemnity legal positions
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1211 
- **Work item:** Approve suspension, default, termination and step-in strategies
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1212 
- **Work item:** Approve final-account, release, retention and defects-liability-period legal closeout
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1213 
- **Work item:** Advise the CEO on material liability, compliance, client and counterparty exposure
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1214 
- **Work item:** Chair the weekly legal deadline, claim and exception review
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1215 
- **Work item:** Present the monthly Legal dashboard, exposure report and corrective actions
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1216 
- **Work item:** Approve the Legal budget and external-counsel fee strategy
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1217 
- **Work item:** Approve Legal delegation, backup, continuity and records-recovery arrangements
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1218 
- **Work item:** Sponsor legal templates, training, workflow and control improvements
- **Responsible role:** Chief Legal Officer (CLO)
### Legal — #1219 
- **Work item:** Triage legal service requests and assign matter risk, priority and response deadline
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1220 
- **Work item:** Conduct conflict checks and complete the matter-opening review
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1221 
- **Work item:** Confirm facts, instructions, objectives, decision owner and required deadline
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1222 
- **Work item:** Identify the applicable contract, authority, policy and regulatory framework
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1223 
- **Work item:** Research legal issues and validate the current legal position
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1224 
- **Work item:** Prepare written legal advice, options and recommended controls
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1225 
- **Work item:** Record advice assumptions, limitations, actions and business-owner acceptance
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1226 
- **Work item:** Close the advice matter and confirm implementation or outstanding actions
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1227 
- **Work item:** Review tender invitations and conditions of participation
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1228 
- **Work item:** Prepare the tender legal-risk and deviation matrix
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1229 
- **Work item:** Review contract scope, schedules, document priority and interpretation clauses
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1230 
- **Work item:** Review price, payment, certification, set-off and retention clauses
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1231 
- **Work item:** Review programme, delay, liquidated-damages and extension-of-time clauses
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1232 
- **Work item:** Review variation, change-control and additional-work clauses
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1233 
- **Work item:** Review warranty, defects-liability and performance-obligation clauses
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1234 
- **Work item:** Review indemnity, liability, exclusion and limitation clauses
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1235 
- **Work item:** Review insurance, bond, guarantee and security clauses
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1236 
- **Work item:** Review suspension, default, termination and step-in clauses
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1237 
- **Work item:** Draft and negotiate client construction and design contracts
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1238 
- **Work item:** Prepare the final client-contract legal approval pack
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1239 
- **Work item:** Draft and review supplier purchase terms and non-standard purchase-order clauses
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1240 
- **Work item:** Draft and review construction and specialist subcontract agreements
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1241 
- **Work item:** Draft and review consultancy and professional-services agreements
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1242 
- **Work item:** Draft and review non-disclosure and confidentiality agreements
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1243 
- **Work item:** Draft and review memoranda of understanding, letters of intent and heads of terms
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1244 
- **Work item:** Draft and review joint-venture, consortium and partnership agreements
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1245 
- **Work item:** Draft and review agency, referral and marketing-service agreements
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1246 
- **Work item:** Draft and review lease, facility and operational-service agreements
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1247 
- **Work item:** Draft and review amendments, addenda, novations and assignments
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1248 
- **Work item:** Prepare the final agreement execution and business-owner handover pack
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1249 
- **Work item:** Prepare the contract-obligations matrix and notice schedule
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1250 
- **Work item:** Conduct the project legal kickoff and contract-administration handover
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1251 
- **Work item:** Review client, consultant and contract-administrator instructions
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1252 
- **Work item:** Draft contractual notices that preserve company rights and remedies
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1253 
- **Work item:** Review variations, additional works and change instructions for legal effect
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1254 
- **Work item:** Prepare extension-of-time, delay and disruption claim submissions
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1255 
- **Work item:** Prepare payment, non-certification and non-payment notices
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1256 
- **Work item:** Prepare breach, default, cure and remedy notices
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1257 
- **Work item:** Prepare suspension, termination and reservation-of-rights notices
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1258 
- **Work item:** Build the claim chronology and coordinate entitlement and quantum evidence
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1259 
- **Work item:** Prepare responses to claim rejections, counterclaims and contractual allegations
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1260 
- **Work item:** Update the claim and dispute strategy with recommended next actions
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1261 
- **Work item:** Conduct early dispute assessment and structured resolution planning
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1262 
- **Work item:** Prepare settlement proposals, settlement agreements, releases and waivers
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1263 
- **Work item:** Prepare litigation, arbitration and expert-matter instructions and evidence packs
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1264 
- **Work item:** Manage external-counsel deliverables, advice, hearings and critical deadlines
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1265 
- **Work item:** Provide legal support for employee conduct, grievance and termination matters
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1266 
- **Work item:** Support investigations, whistleblowing, fraud response and legal holds
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1267 
- **Work item:** Review corporate licence, registration, compliance and renewal issues
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1268 
- **Work item:** Complete contract and project legal closeout for final account, retention and DLP
- **Responsible role:** Legal Counsel (Lead)
### Legal — #1269 
- **Work item:** Register each incoming Legal request and assign a unique matter ID
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1270 
- **Work item:** Acknowledge the request and record counsel owner, priority and deadline
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1271 
- **Work item:** Issue and track the conflict-check questionnaire and result
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1272 
- **Work item:** Prepare the matter-opening checklist and required-document list
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1273 
- **Work item:** Collect instructions, contracts, correspondence and supporting evidence
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1274 
- **Work item:** Create the controlled electronic matter folder and approved access permissions
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1275 
- **Work item:** Apply Legal file-naming, version and status conventions
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1276 
- **Work item:** Return incomplete requests and track missing information to closure
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1277 
- **Work item:** Populate approved standard contract, notice and letter templates
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1278 
- **Work item:** Format draft agreements, notices, advice and legal correspondence
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1279 
- **Work item:** Prepare document comparisons and tracked-change mark-ups
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1280 
- **Work item:** Maintain the negotiation comment and deviation matrix
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1281 
- **Work item:** Compile schedules, annexures, exhibits and referenced documents
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1282 
- **Work item:** Verify document references, defined terms, cross-references and pagination
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1283 
- **Work item:** Proofread draft documents and record quality-control corrections
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1284 
- **Work item:** Issue the counsel-approved controlled final version for action
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1285 
- **Work item:** Prepare signature-authority and execution-checklist packs
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1286 
- **Work item:** Coordinate approved signature circulation and execution sequence
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1287 
- **Work item:** Track counterparty signatures and outstanding execution actions
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1288 
- **Work item:** Receive and reconcile executed originals and certified copies
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1289 
- **Work item:** Coordinate notarisation, legalisation and attestation when instructed
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1290 
- **Work item:** Compile powers of attorney, board resolutions and signatory evidence
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1291 
- **Work item:** Coordinate document dispatch, formal service, courier and delivery proof
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1292 
- **Work item:** Distribute executed copies and update agreement execution status
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1293 
- **Work item:** Maintain the client, supplier, subcontract and other contracts register
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1294 
- **Work item:** Maintain the contractual-obligations, expiry and renewal register
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1295 
- **Work item:** Maintain the claims, notices, variations and extension-of-time register
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1296 
- **Work item:** Maintain the dispute, court, arbitration and hearing register
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1297 
- **Work item:** Maintain the external-counsel, expert and legal-adviser register
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1298 
- **Work item:** Maintain the corporate licence, permit, authority and renewal register
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1299 
- **Work item:** Maintain the insurance, bond, guarantee and security register
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1300 
- **Work item:** Issue deadline reminders and escalate overdue Legal actions
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1301 
- **Work item:** Coordinate the Legal calendar, meetings, agendas and attendance records
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1302 
- **Work item:** Prepare Legal meeting minutes and maintain the action tracker
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1303 
- **Work item:** Register external-counsel invoices and supporting fee narratives
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1304 
- **Work item:** Maintain Legal budget commitments, purchase-order and payment-status records
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1305 
- **Work item:** Compile weekly and monthly Legal status and deadline reports
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1306 
- **Work item:** Maintain the evidence index and preserve legal-hold materials
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1307 
- **Work item:** Archive superseded and executed Legal records under the retention rules
- **Responsible role:** Contracts & Legal Assistant
### Legal — #1308 
- **Work item:** Close the matter file and verify the complete closure checklist
- **Responsible role:** Contracts & Legal Assistant

---

# 23. Final Implementation Directive

Build SEVENTS as a reliable construction ERP first, a workflow platform second, and an agentic operating system third. The 1,308 work items are the process catalogue and initial discovery input—not proof that every process is already ready for automation.

The first release must establish trustworthy identity, permissions, work execution, approvals, documents and audit. Then deliver project/technical/procurement/site/finance flows in prioritized vertical slices. Add AI only where there is clear data, a measurable user problem, safe tool boundaries and a validation path.

**Release gate:** no phase is considered complete until its acceptance criteria pass, critical permissions are tested, errors are observable, and a named business owner accepts the workflow.
