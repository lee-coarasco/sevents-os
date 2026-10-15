# SEVENTS — Product Requirements Document

**Status:** Active — `PHASE_1` in progress. Build in module order defined below.
**Owner confirmed:** 2026-10-15
**Source:** `docs/BRD.md`, `docs/IMPLEMENTATION-PLAN.md`, `docs/canonical-role-map.md`, `docs/catalogue/disposition-workbook.csv`

---

## 1. Product vision

UAE-first, country-agnostic construction ERP with workflow automation and controlled AI agents. Configuration-first architecture: stable capabilities define the modules; the 1,308-row work-item catalogue defines how those modules are used by each role.

The system must work for any construction company in any country, with UAE as the initial localization profile. No country-specific tax rates, statutory IDs, invoice formats or filing requirements are hard-coded — these live in localization configuration packs.

---

## 2. Build order

Build modules in BRD dependency order. Do not start a module before its prerequisites are done. Do not jump to procurement, material, or finance modules early — they sit at M14–M22 and depend on identity, tenancy, roles, workflow engine, projects and tasks being solid first.

### Phase 1 — Secure platform foundation
| Module | What it builds |
|---|---|
| **M01** Identity, Authentication & Sessions | Sign-in, MFA, session control, SSO-ready, account lifecycle, audit trail |
| **M02** Company, Branch, Project & Tenant Setup | Company profile, legal entities, branches, currencies, fiscal year, tenant isolation |
| **M03** Organization, Departments, Roles & Authority | Department tree, role catalogue, authority matrix, approval limits, segregation of duties |

Exit criteria: authorization tests pass; tenant isolation verified; basic user and role administration works; audit captures sensitive changes.

### Phase 2 — Configuration studio and workflow runtime
| Module | What it builds |
|---|---|
| **M05** Work-Item Catalogue & Disposition | Import/normalize the 1,308-row catalogue; disposition; canonical role mapping; version definitions |
| **M06** Configuration Studio & Workflow Engine | Triggers, step types, branching, forms, evidence, SLA calendars, approval policies, simulation, versioned publish/rollback |
| **M33** Master Data & Configuration | Items, units, cost codes, document types, project types, numbering schemes, currencies |

Exit criteria: an administrator can configure a workflow from existing capabilities without code changes; invalid publication is blocked; active instances stay version-pinned.

### Phase 3 — Core operations foundation
| Module | What it builds |
|---|---|
| **M04** Employee Directory & Workforce | Profiles, skills, certifications, project allocation, onboarding/offboarding |
| **M07** Tasks, My Work & Work Queues | Personal/team queues, assignment, priority, due date, evidence, comments, overdue tracking |
| **M08** Approvals & Delegation | Sequential/parallel approvals, value thresholds, substitutes, rejection, resubmission, escalation, immutable decisions |
| **M09** Project & Portfolio Management | Project register, client, contract, scope, location, WBS, milestones, budgets, risk register, change control |
| **M35** Audit, Security, Privacy & Retention | Append-only audit, session audit, encryption, retention, data export/deletion |
| **M31** Notifications, SLA & Escalations | In-app/email notifications, configurable templates, SLA timers, escalation ladders |

### Phase 4 — Commercial and technical modules
| Module | What it builds |
|---|---|
| **M10** Client, CRM & Sales Pipeline | Leads, contacts, tender calendar, pipeline forecast, handover |
| **M11** Tendering, Estimation & Commercials | Tender documents, quantity take-off, estimate versions, costs, margin scenarios, quote approvals |
| **M12** Technical Engineering & Design Control | Design brief, drawing register, revision control, RFI, IFC release, as-built closeout |
| **M13** Documents, Drawings & Records | Versioned files, metadata, approvals, transmittals, OCR, retention |
| **M18** Schedule, Progress & Resource Planning | Baseline schedule, WBS, planned vs actual, critical path, lookahead plans, delay reasons |

### Phase 5 — Procurement, stores and site operations
| Module | What it builds |
|---|---|
| **M14** Procurement & Vendor Management | Requisitions, vendor onboarding, RFQ, quotation comparison, approved vendor list, POs, delivery tracking, GRN |
| **M15** Inventory, Stores & Material Movement | Stock ledger, receipts, issues, transfers, reservations, reconciliation, wastage |
| **M16** Subcontractor & Labour Operations | Work orders, manpower, attendance, measured work, claims, retention |
| **M17** Site Operations, DPR & Field Capture | Site diary, daily progress, manpower, weather, quantities, photos, offline drafts |
| **M19** Quality, Inspection & NCR | Inspection plans, checklists, NCRs, corrective actions, evidence, closure |
| **M20** Safety, Incidents & Compliance | Permits-to-work, hazard observations, incidents, corrective actions. Safety decisions remain human-controlled. |
| **M25** Equipment, Plant & Fleet | Asset register, allocation, utilisation, maintenance, certificates |

### Phase 6 — Finance, billing and contracts
| Module | What it builds |
|---|---|
| **M21** Finance, Budgets & Cost Control | Cost codes, budgets, actuals, accruals, forecasts, cash flow, expense claims |
| **M22** Billing, Invoicing, Receivables & Payables | Applications for payment, progress claims, tax invoices, vendor bills, payment runs |
| **M23** Contracts, Claims, Variations & EOT | Contract repository, notices, variation requests, claims valuation, bonds, DLP |
| **M24** People, Recruitment & Performance | Manpower requests, recruitment, training, performance, offboarding |
| **M26** Customer/Stakeholder Communications | Communication log, meeting minutes, action extraction, client complaints |
| **M27** Legal, Licences & Regulatory Register | Legal matters, permits, compliance obligations, deadline alerts |

### Phase 7 — AI and intelligence layer
| Module | What it builds |
|---|---|
| **M28** AI Knowledge Assistant & Search | Permission-aware answers grounded in approved records; citations; feedback |
| **M29** AI Agent Studio & Tool Registry | Agent definitions, allowed tools, guardrails, approval requirements, evaluation tests |
| **M30** Agent Runs, Human Review & Audit | Run queue, plan/steps, tool calls, human intervention, audit, cost tracking |

### Phase 8 — Platform completion
| Module | What it builds |
|---|---|
| **M32** Dashboards, Reports & KPI Builder | Role-specific dashboards, project health, cost variance, agent metrics, export |
| **M34** Integrations & API Management | REST APIs, webhooks, accounting/banking, e-sign, OCR/LLM, vendor portals |
| **M36** Platform Administration & Support | Feature flags, tenant config, health, job queues, failed workflow repair, release notes |
| **M37** Mobile/PWA & Offline Site Mode | PWA, installability, offline drafts for field forms, sync queue |
| **M38** Implementation, Migration & Data Quality | Excel import wizard, validation, dry-run, import report, staged activation |

---

## 3. Key personas (from BRD §3.1 + canonical-role-map.md)

All 44 raw catalogue roles are mapped in `docs/canonical-role-map.md`. Key personas by phase:

**Phase 1–2 (Platform setup):** Platform Administrator, Company Administrator  
**Phase 3 (Operations):** All department heads, managers and employees — task queues and approvals apply to every role  
**Phase 5 (Procurement/site):** Site Civil/MEP Engineer, Quantity Surveyor, Procurement Lead, CPO, Logistics Coordinator, Storekeeper, QHSE Engineer, Site Manager  
**Phase 6 (Finance):** CFO, Senior Accountant, Accountant, CLO, Legal Counsel  
**Phase 7 (AI):** AI Admin, authorized operators, auditors  

---

## 4. Non-functional requirements (all phases)

- Every write goes through a validated application service with server-side permission checks — no UI-only enforcement.
- Idempotent writes: retrying any submission (PO, approval, GRN, invoice) must not create a duplicate record.
- Immutable audit trail on all consequential actions.
- Workflow instances pin to the published version active at creation; a later republish does not silently change in-flight instances.
- Tenant isolation via Supabase Row-Level Security on every table — no query may return another tenant's data.
- VAT/tax fields are configurable but not activated by default. Finance owner sign-off required before any tax posting goes live (BRD §2.3A).
- No country-specific logic hard-coded in the generic core.
- Safety decisions (M20) remain human-controlled — AI agents may suggest, never action.

---

## 5. Open decisions for the business owner

These do not block Phase 1–2 build. They must be resolved before the relevant module goes live:

1. **Approval value bands** (needed before M08 is activated with real limits) — who approves at what value threshold, across which modules. No default will be invented.
2. **UAE VAT position** (needed before M21/M22 go live) — whether the company is VAT-registered, what rates apply, and which transactions are taxable. Requires UAE tax adviser confirmation.
3. **First pilot project type** (needed for M09 sample data) — commercial, residential, fit-out or civil/infrastructure.
4. **Segregation-of-duties rules** — e.g. can one person raise and approve the same requisition?
5. **Frontend framework** — architect to propose in NEEDS_APPROVAL.md during Phase 1.
6. **Hosting target** — architect to propose in NEEDS_APPROVAL.md during Phase 1.

---

## 6. Catalogue traceability

All 1,308 source-catalogue rows are imported and classified in `docs/catalogue/disposition-workbook.csv`:
- 995 rows → Configure workflow (executable steps in M06–M20)
- 215 rows → Configure approval/decision (approval policies in M08)
- 60 rows → Periodic review/monitor (dashboards/reports in M32)
- 21 rows → Track obligation/document (document register in M13, M27)
- 17 rows → Defer (vendor payments, finance tail — Phase 6)

Tickets 0001–0051 in `tickets/` contain the detailed disposition per role cluster.

---

## 7. What this PRD is not

- It is not a detailed spec for each module — that lives in the tickets the architect creates at the start of each phase.
- It is not a data model — that lives in migration files under `supabase/migrations/`.
- It does not invent authority limits, SLA values, tax rates or approval policies — those are business decisions tracked in open decisions above.
