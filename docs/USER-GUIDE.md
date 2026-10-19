# SEVENTS Enterprise OS — Complete User Guide

Welcome to **SEVENTS OS**, the construction enterprise operating system designed for general contractors, project directors, engineers, commercial managers, and site supervisors.

This guide provides end-to-end instructions for every functional area and module across the platform.

---

## Table of Contents
1. [Identity, Authentication & Team Management](#1-identity-authentication--team-management)
2. [Organization Structure, Companies & Authority Matrix](#2-organization-structure-companies--authority-matrix)
3. [Master Data, Units of Measure & Numbering Schemes](#3-master-data-units-of-measure--numbering-schemes)
4. [Work-Item Catalogue & Process Governance](#4-work-item-catalogue--process-governance)
5. [CRM & Tender Bidding Pipeline](#5-crm--tender-bidding-pipeline)
6. [Project Management, WBS & Scheduling](#6-project-management-wbs--scheduling)
7. [Site Operations & Daily Progress Reports (DPR)](#7-site-operations--daily-progress-reports-dpr)
8. [Quality Control, Inspection Requests & NCR/CAPA](#8-quality-control-inspection-requests--ncrcapa)
9. [Health, Safety & Environment (HSE) & Permits to Work (PTW)](#9-health-safety--environment-hse--permits-to-work-ptw)
10. [Commercial Contracts, Claims & Variations](#10-commercial-contracts-claims--variations)
11. [Procurement, Purchase Orders & Material Inventory](#11-procurement-purchase-orders--material-inventory)
12. [Subcontractor & Trade Partner Governance](#12-subcontractor--trade-partner-governance)
13. [Billing, Invoicing & Financial Accounting](#13-billing-invoicing--financial-accounting)
14. [Workflow Engine, Visual Canvas & Task Approvals](#14-workflow-engine-visual-canvas--task-approvals)
15. [Executive Dashboards & Custom Report Builder](#15-executive-dashboards--custom-report-builder)
16. [AI Knowledge Base & Semantic Search](#16-ai-knowledge-base--semantic-search)
17. [AI Agent Studio & Autonomous Copilots](#17-ai-agent-studio--autonomous-copilots)
18. [AI Operations, Human Review & Audit Control Room](#18-ai-operations-human-review--audit-control-room)
19. [Dynamic AI Providers, Custom Models & Key Setup](#19-dynamic-ai-providers-custom-models--key-setup)
20. [Integrations, API Keys & Webhooks](#20-integrations-api-keys--webhooks)
21. [Field Mode & Offline Site Sync](#21-field-mode--offline-site-sync)
22. [Platform Administration, Security & System Health](#22-platform-administration-security--system-health)

---

## 1. Identity, Authentication & Team Management
**Access Path:** `/login`, `/admin/users`

- **Sign In:** Enter your corporate email and password. Multi-factor authentication (MFA) can be enabled or enforced tenant-wide.
- **User Directory:** View all users within your tenant, including their active role, department, and account status.
- **Inviting Team Members:** Click **Invite User**, specify their email address, display name, and initial role. The invited member receives an invitation link to set up their password.
- **Role Assignment:** Administrators can modify user roles dynamically from the user detail screen.
- **Account Deactivation:** Instantly revoke system access without losing historic audit trails or attribution on signed documents.

---

## 2. Organization Structure, Companies & Authority Matrix
**Access Path:** `/org-setup`, `/departments-roles`

- **Multi-Company & Branch Setup:** Configure parent corporations, operating subsidiaries, regional branches, and operating divisions.
- **Department Hierarchy:** Model nested department trees (e.g. Commercial ➔ Estimation ➔ Tendering; Engineering ➔ Civil / MEP).
- **Role Permissions Matrix:** Interactively toggle granular permission switches across all business domains.
- **Authority Delegation:** Temporarily grant acting authority (e.g., during annual leave) with strict start/end timestamps.
- **Financial Delegation of Authority (DoA):** Define monetary approval thresholds per role (e.g., Project Engineer up to AED 10,000; Commercial Manager up to AED 250,000; Project Director up to AED 1,000,000).

---

## 3. Master Data, Units of Measure & Numbering Schemes
**Access Path:** `/masterdata`

- **Standard Units of Measure (UOM):** Pre-seeded engineering and construction units (`M3`, `TON`, `SQM`, `LM`, `KG`, `HOUR`, `NOS`).
- **Cost Code Dictionary:** CSI MasterFormat and customized work breakdown cost codes.
- **Multi-Currency Exchange Rates:** Maintain standard operational currencies (AED, SAR, USD, EUR, GBP) and live or fixed project exchange rates.
- **Auto-Numbering Schemes:** Configurable sequential numbering formats for Purchase Orders, RFIs, NCRs, Subcontracts, and Invoices with prefix, date stamps, and digit padding (e.g. `PO-2026-{SEQ:05}`).

---

## 4. Work-Item Catalogue & Process Governance
**Access Path:** `/catalogue`

- **Pre-Configured Item Library:** Access over 1,300 standardized construction activities and work packages.
- **Risk & Governance Classification:** Categorize work items by technical discipline, risk tier (Low, Medium, High, Extreme), and phase.
- **Process Linkage:** Bind catalogue items to published approval workflows ensuring standard operational compliance.

---

## 5. CRM & Tender Bidding Pipeline
**Access Path:** `/crm`, `/bidding`, `/tendering`

- **Lead & Opportunity Tracking:** Manage prospective client inquiries through pipeline stages (Lead Qualification, Tender Invited, Estimating, Submitted, Clarifications, Won/Lost).
- **Tender Document Repository:** Upload and organize RFP specs, tender addenda, site visit logs, and BOQ workbooks.
- **BOQ Estimation Versions:** Build multi-version cost estimates across Labour, Material, Equipment, and Subcontract components with markup and overhead calculation.
- **Bid / No-Bid Governance:** Conduct structured feasibility assessments and submit management sign-offs prior to commercial commitment.

---

## 6. Project Management, WBS & Scheduling
**Access Path:** `/projects`, `/projects/:id`

- **Project Charter & Setup:** Create projects with client details, start/end dates, contract sums, project director assignments, and currency.
- **Work Breakdown Structure (WBS):** Hierarchical delivery packages mapped from tender handovers to execution baselines.
- **Interactive Gantt & Critical Path:** Track task dependencies, total float, early/late dates, and critical path milestones.
- **Lookahead Planning:** Generate 2-to-6 week lookahead commitments for site foremen and trade teams.
- **Delay Event Tracking:** Register excusable and compensable delay notices with cause categorization and timeline impacts.

---

## 7. Site Operations & Daily Progress Reports (DPR)
**Access Path:** `/site-operations`

- **Daily Progress Reports:** Digital site logs capturing weather conditions, working hours, and operational shifts.
- **Work Package Progress:** Log executed daily quantities against scheduled work items.
- **Manpower & Labour Headcount:** Record site workforce by trade and subcontractor.
- **Plant & Heavy Equipment Logs:** Log active, standby, and breakdown equipment hours.
- **Photo Evidence & Site Diary:** Upload geo-tagged site photographs with contextual notes.

---

## 8. Quality Control, Inspection Requests & NCR/CAPA
**Access Path:** `/quality`

- **Inspection & Test Plans (ITP):** Define hold and witness points for construction activities.
- **Work Inspection Requests (WIR):** Raise inspection calls for consultant engineer review, recording approvals, conditional sign-offs, or rejections.
- **Non-Conformance Reports (NCR):** Formal logging of quality defects, photographic evidence, and root-cause analysis.
- **Corrective & Preventive Action (CAPA):** Assign remedial actions with verification checkpoints prior to closure.

---

## 9. Health, Safety & Environment (HSE) & Permits to Work (PTW)
**Access Path:** `/safety`

- **Safe Work Hours & Incident Logs:** Continuous calculation of safe man-hours, near-misses, and recordable incidents.
- **Permit to Work (PTW) Management:** Digital authorisations for high-risk activities:
  - Hot Work
  - Confined Space Entry
  - Working at Height
  - Deep Excavation
  - Electrical Isolation
- **Job Hazard Analysis (JHA):** Checklists and required PPE verifications before permits are activated.

---

## 10. Commercial Contracts, Claims & Variations
**Access Path:** `/contracts`

- **Main Contract Administration:** Contract terms, baseline values, retention percentages, advance payment amortisation, and milestone payment schedules.
- **Variation Requests & Change Orders:** Capture client-driven variations with cost impact, schedule extension requests, and approval records.
- **Extension of Time (EOT) Claims:** Structured claim dossiers linking delay events, critical path impact, and financial quantum.

---

## 11. Procurement, Purchase Orders & Material Inventory
**Access Path:** `/procurement`

- **Material Requisitions (MR):** Site and engineering teams request materials linked directly to project cost codes and BOQ lines.
- **RFQ & Supplier Comparison:** Disclose vendor quotes, calculate lowest compliant bids, and review technical compliance.
- **Purchase Orders (PO):** Authorize commitments within DoA spending limits, track payment terms, and dispatch vendor confirmations.
- **Goods Receipt Notes (GRN) & Site Stores:** Inspect incoming deliveries against PO lines, record delivery notes, inspect quality, and update site inventory balances.

---

## 12. Subcontractor & Trade Partner Governance
**Access Path:** `/subcontractors`

- **Subcontractor Registry & Prequalification:** Manage trade partner licenses, insurance policies, safety ratings, and past performance scores.
- **Work Orders & Agreements:** Formal trade packages with retention terms, defect liability periods, and back-to-back clauses.
- **Payment Applications (Valuations):** Process interim progress claims, verify executed work quantities, apply retention deductions, and issue payment certificates.

---

## 13. Billing, Invoicing & Financial Accounting
**Access Path:** `/billing`, `/finance`

- **Client Interim Payment Applications (IPA):** Generate cumulative progress billing statements with previous claims, current period progress, and retention release.
- **Accounts Receivable & Cash Inflow:** Track certified payments, credit notes, and bank receipts.
- **Accounts Payable (Vendor Invoices):** 3-way match invoices against approved Purchase Orders and Goods Receipt Notes.
- **Financial Period Governance:** Lock closed accounting periods to prevent retroactive modifications and maintain ledger integrity.

---

## 14. Workflow Engine, Visual Canvas & Task Approvals
**Access Path:** `/workflow/definitions`, `/workflow/definitions/:id`, `/tasks`

- **Workflow Studio:** Create versioned workflow definitions for any process (Purchase Orders, Variations, Inspection Requests).
- **Interactive Visual Canvas:** Drag-and-drop workflow designer powered by modern flow nodes:
  - Action Nodes (Create Task, Send Email, Webhook)
  - Decision & Approval Gates (Role-based, Spending-threshold, Multi-step)
  - Data Collection & Evidence Uploads
- **Task Inbox:** Real-time inbox for pending approvals, urgent reviews, and reassigned tasks with SLA time indicators.

---

## 15. Executive Dashboards & Custom Report Builder
**Access Path:** `/dashboard`

- **Executive Command Center:** Portfolio-wide contract value, delivery health distribution (On-Track, At-Risk, Delayed), and physical completion S-curves.
- **Financial & Commercial View:** Cost variance waterfall comparing Budgets vs. Committed Orders vs. Certified Claims vs. Cash Collections.
- **Operational & Fleet Efficiency:** Manpower mobilization ratios, heavy plant utilization %, and open safety permits.
- **Custom Report Builder:** Dynamic report generator allowing filtering across any operational entity, custom column selection, and instant CSV spreadsheet export.

---

## 16. AI Knowledge Base & Semantic Search
**Access Path:** `/ai/knowledge`

- **Document Vector Ingestion:** Ingest drawings, engineering specifications, contracts, and safety manuals into a searchable vector index.
- **Semantic Similarity Search:** Natural language search returning high-confidence excerpts with source attribution.
- **Grounded AI Assistant (`Ctrl+/`):** In-app copilot answering project queries strictly using indexed facts with zero hallucination.

---

## 17. AI Agent Studio & Autonomous Copilots
**Access Path:** `/ai/agents`

- **Autonomous Agent Profiles:** Configure task-specific AI copilots:
  - *Site Engineering Copilot*: Assists with drawings, specifications, and RFI drafting.
  - *Procurement & Cost Estimator*: Validates inventory levels, evaluates BOQ work items, and computes material lead times.
  - *HSE & Quality Inspector*: Monitors safety compliance, identifies job-site hazards, and drafts inspection observations.
- **Scoped Tool Registry:** Safely bind operational tools (`query_inventory`, `check_schedule_delays`, `draft_rfi`, `create_purchase_order`) with strict role-based access.
- **Human-In-The-Loop (HITL) Policy:** Enforce approval requirements for state-modifying actions (`Require for Mutations`, `Always Require`, `Autonomous`).

---

## 18. AI Operations, Human Review & Audit Control Room
**Access Path:** `/ai/runs`

- **Live Run Queue:** Monitor active, executing, and pending agent runs with token spend, execution latency, and step counts.
- **Human Review Center:** State-modifying actions are safely held in quarantine. Supervisors can inspect proposed parameters, modify arguments in real time, and release or reject mutations.
- **Interactive Step Timeline & Trace:** Deep inspection of multi-step plans, individual reasoning steps, and tool inputs/outputs.
- **Spend & Emergency Kill Switches:** Real-time token and USD cost tracking with emergency pause toggles to halt any agent instantly.
- **Security & Incident Review:** Automated triage for prompt injection attempts, guardrail triggers, and budget overruns.

---

## 19. Dynamic AI Providers, Custom Models & Key Setup
**Access Path:** `/ai/agents` ➔ Tab: **AI Providers & Adapters**

SEVENTS OS provides a universal, pluggable AI architecture supporting both standard enterprise providers and any custom OpenAI-compatible endpoint.

### Built-in Providers:
1. **OpenAI**: `gpt-4o-mini`, `gpt-4o`, `o1-mini`
2. **Google Gemini**: `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`
3. **Anthropic Claude**: `claude-3-5-sonnet`, `claude-3-5-haiku`
4. **Azure OpenAI**: Enterprise private VNet deployment with custom endpoint
5. **SEVENTS Local Engine**: Built-in deterministic/air-gapped local mock

### Adding a Custom AI Provider (Groq, DeepSeek, Ollama, OpenRouter, Mistral, vLLM):
1. Navigate to **AI Agent Studio** ➔ **AI Providers & Adapters**.
2. Click **`+ Add Custom AI Provider`** at the top right.
3. Fill in the connection parameters:
   - **Provider Identifier**: e.g. `groq`, `deepseek`, or `ollama`
   - **Display Name**: e.g. `Groq LPU Cloud` or `Local Ollama`
   - **API Base URL**: e.g. `https://api.groq.com/openai/v1` or `http://localhost:11434/v1`
   - **API Key**: Provider API key (optional for local Ollama)
   - **Default Model**: e.g. `llama-3.3-70b-versatile` or `deepseek-chat`
   - **Other Models**: Comma-separated list of additional model IDs
4. Click **Save Provider**.
5. The provider immediately appears in the grid. Click **Test** to verify connection latency.
6. Click **Select Provider** to activate it system-wide.

### Adding New Models Dynamically:
- On any provider card (built-in or custom), click **`+ Add Model`**.
- Enter the model identifier (e.g. `gpt-4.5`, `deepseek-r1`, `qwen-2.5-72b`) and click **Save**.
- The new model instantly becomes selectable across all Agent Studio profiles.

---

## 20. Integrations, API Keys & Webhooks
**Access Path:** `/integrations`

- **Developer API Keys:** Generate scoped API keys for external ERP, BIM, and automated scripts with rate limiting and instant revocation.
- **Outbound Webhooks:** Subscribe external endpoints to platform events (`project.created`, `invoice.approved`, `ncr.issued`) with HMAC signature verification.
- **Service Connectors:** Ready-to-configure connectors for accounting (Xero, QuickBooks), electronic signatures (DocuSign), and bank WPS payment files.
- **Delivery Audit Logs:** Real-time HTTP log showing dispatch status, latency, and response bodies.

---

## 21. Field Mode & Offline Site Sync
**Access Path:** `/field-mode`

- **Progressive Web App (PWA):** Designed for smartphones and tablets on remote construction job sites with poor network coverage.
- **Offline Data Capture:** Log daily site diary notes, safety observations, and work progress while disconnected.
- **Local Storage Engine:** Stores captured drafts securely in IndexedDB with local timestamp preservation.
- **Auto-Sync Queue:** Automatically uploads queued records to the server when network connectivity is re-established.
- **Financial Security Guardrail:** Financial approvals and commercial agreements are blocked in offline mode by security policy until online.

---

## 22. Platform Administration, Security & System Health
**Access Path:** `/platform-admin`

- **Tenant Profile:** Manage organization identity, standard currency, operational timezone, and fiscal calendar.
- **Security & Session Controls:** Configure idle session timeouts and enforce multi-factor authentication (MFA).
- **Feature Flags:** Toggle system capabilities (e.g., AI copilots, advanced S-curves, offline sync) on a per-tenant basis.
- **System Health Monitor:** Live diagnostics reporting database connection latency, cloud storage utilization, and queue performance.
- **Broadcast Maintenance Announcements:** Schedule system notifications to alert active users before scheduled maintenance.
- **In-App Helpdesk:** Submit and resolve technical support tickets directly within the application.
