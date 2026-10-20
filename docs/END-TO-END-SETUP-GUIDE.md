# Real-World Master Setup & End-to-End Testing Guide

## 1. Executive Overview & Scenario Context

This guide provides a comprehensive, sequential, and production-realistic walkthrough to populate, configure, test, and audit all capabilities of the **sevents-os** platform. 

Every section contains exact real-world data points, pre-calculated figures, workflow configurations, AI agent setups, and step-by-step verification checkpoints.

### 🏢 The Benchmark Enterprise Scenario
* **Company Name:** **Apex Horizon Infrastructure Pvt. Ltd.**
* **Industry Domain:** Engineering, Procurement & Construction (EPC), Commercial Infra & MEP
* **Headquarters:** Mumbai (HQ) | **Branch Office:** Bengaluru Operations
* **Primary Project:** **The Metro Tech Park – Tower C**
  - **Type:** G+18 Commercial Tech Tower with 2-Level Basement Parking
  - **Contract Value / Budget:** ₹45,00,00,000 INR ($5.45M USD)
  - **Timeline:** 14 Months
  - **Client:** Horizon Realty Developers Ltd. (Lead Architect: Foster & Partners, PMC: Turner & Townsend)

---

## 2. Master Execution Lifecycle (Ideal Real-World Order)

In an enterprise rollout, modules must be configured and tested in their dependency-aware lifecycle:

```
[Phase 1: Foundation & Governance]
   ├── 1. Tenant & Branch Configuration
   ├── 2. Organization, Departments & Roles (RBAC)
   ├── 3. Workforce & User Directory
   ├── 4. Master Data (Currencies, Taxes, UOMs, Cost Centers)
   └── 5. Standard Work-Item Catalogue & Rate Master
           │
           ▼
[Phase 2: Workflow Automation & Rules Engine]
   ├── 6. Workflow Definitions & React Flow Canvas Studio
   └── 7. Authority Matrix & Approval Delegation
           │
           ▼
[Phase 3: Pre-Construction, CRM & Tendering]
   ├── 8. Client Accounts & CRM Pipeline
   └── 9. Tendering, Cost Estimation & Commercial Submission
           │
           ▼
[Phase 4: Project Mobilization, Engineering & Baseline Setup]
   ├── 10. Project Setup & Portfolio Governance
   ├── 11. Technical Engineering, Submittals & RFI Logs
   ├── 12. Drawing Register & Document Vault
   └── 13. Work Breakdown Structure (WBS), Gantt Schedule & Lookahead
           │
           ▼
[Phase 5: Supply Chain, Stores & Subcontractors]
   ├── 14. Procurement (PR -> RFQ -> PO Workflow)
   ├── 15. Stores, Inventory & Goods Receipt Notes (GRN)
   └── 16. Subcontractor Agreements & Trade Labour Mobilization
           │
           ▼
[Phase 6: Field Execution, Quality, Safety & Fleet Operations]
   ├── 17. Daily Progress Reports (DPR) & Site Logs
   ├── 18. Mobile / Offline Field Sync Verification
   ├── 19. Quality Assurance, ITP & Non-Conformance Reports (NCR)
   ├── 20. Safety Governance, Toolbox Talks & Incident Logs
   └── 21. Plant, Equipment & Heavy Fleet Management
           │
           ▼
[Phase 7: Commercial Contracts, Billing, Invoicing & Cash Flow]
   ├── 22. Main Contract, Variation Orders (VOR) & EOT Claims
   ├── 23. Client Billing (RA Bills) & Vendor Payables
   └── 24. Project Budgets, Cost Variance & Cash Flow Analysis
           │
           ▼
[Phase 8: AI Intelligence, Autonomous Agents, Analytics & Auditing]
   ├── 25. Dynamic AI Provider & Model Configuration
   ├── 26. Semantic Knowledge Base & RAG Search
   ├── 27. Autonomous AI Agents & Tool Execution Studio
   ├── 28. Human Review Traces & Audit Trails
   └── 29. Executive Dashboards, KPI Reporting & Data Migration
```

---

## Phase 1: Foundation & System Master Data

### Step 1: Company, Branch & Project Master Data
* **Navigation:** `Settings` > `Organization Setup` (`/tenancy`)

#### Real Test Data:
* **Legal Entity Name:** `Apex Horizon Infrastructure Pvt. Ltd.`
* **Trade Identifier / Registration:** `CIN-U45200MH2021PTC368921`
* **Default Currency:** `INR (₹)`
* **Financial Year Start:** `01-April`
* **Head Office Branch:**
  - Branch Name: `Mumbai Corporate Office`
  - Code: `BR-MUM-HQ`
  - Address: `Level 12, Horizon Towers, Bandra-Kurla Complex (BKC), Mumbai 400051`
* **Regional Operational Branch:**
  - Branch Name: `Bengaluru Projects Division`
  - Code: `BR-BLR-01`
  - Address: `Plot 44, Whitefield Industrial Area, Bengaluru 560066`

---

### Step 2: Master Data Entities (UOM, Tax, Cost Centers)
* **Navigation:** `Settings` > `Master Data` (`/masterdata`)

#### Real Test Data to Input:
1. **Units of Measurement (UOM):**
   - Code: `M3` | Name: `Cubic Meter` | Category: `Volume`
   - Code: `MT` | Name: `Metric Tonne` | Category: `Weight`
   - Code: `SQFT` | Name: `Square Feet` | Category: `Area`
   - Code: `NOS` | Name: `Numbers / Units` | Category: `Quantity`
   - Code: `RMT` | Name: `Running Meter` | Category: `Length`
2. **Tax Rates:**
   - `GST-18`: GST 18% (CGST 9% + SGST 9%) - Goods & Services standard
   - `GST-12`: GST 12% (Works Contract Composite Scheme)
   - `GST-28`: GST 28% (Luxury fixtures & air-conditioning chillers)
3. **Cost Centers:**
   - `CC-100`: `Civil & Substructure`
   - `CC-200`: `Superstructure & Post-Tensioning`
   - `CC-300`: `MEP (Mechanical, Electrical, Plumbing)`
   - `CC-400`: `Finishing & Glazing`
   - `CC-900`: `General Site Overheads & Prelims`

---

### Step 3: Organization, Departments & Roles (RBAC)
* **Navigation:** `Organization` > `Departments & Roles` (`/departments`)

#### Real Test Data:
1. **Departments to Create:**
   - **Executive Board** (Code: `DEPT-EXEC`)
   - **Project Operations** (Code: `DEPT-OPS`)
   - **Commercial & Estimating** (Code: `DEPT-COMM`)
   - **Procurement & Supply Chain** (Code: `DEPT-PROC`)
   - **Quality Assurance & Safety (HSE)** (Code: `DEPT-HSE`)
   - **Finance & Accounts** (Code: `DEPT-FIN`)
2. **Authority & Approval Tiers:**
   - `Tier 1 (Site Engineer)`: Operational sign-offs up to ₹1,00,000
   - `Tier 2 (Procurement / Project Manager)`: PO & WO approval up to ₹10,00,000
   - `Tier 3 (Project Director)`: Financial approvals up to ₹50,00,000
   - `Tier 4 (Managing Director / CFO)`: Unlimited approvals above ₹50,00,000

---

### Step 4: Workforce & User Directory
* **Navigation:** `Workforce` > `Employees` (`/employees`)

#### Create 5 Core Operational Personas:
1. **Vikram Malhotra**
   - Role: `Project Director` (`DEPT-OPS`)
   - Email: `vikram.malhotra@apexhorizon.com`
   - Phone: `+91 98201 11223`
   - Delegated Authority: Tier 3 (₹50,00,000)
2. **Ananya Sharma**
   - Role: `Lead Cost Estimator` (`DEPT-COMM`)
   - Email: `ananya.sharma@apexhorizon.com`
   - Phone: `+91 98112 44556`
3. **Rajesh Verma**
   - Role: `Site QA/QC & Safety Engineer` (`DEPT-HSE`)
   - Email: `rajesh.verma@apexhorizon.com`
   - Phone: `+91 97401 88990`
4. **Sunita Nair**
   - Role: `Head of Procurement` (`DEPT-PROC`)
   - Email: `sunita.nair@apexhorizon.com`
   - Phone: `+91 98330 66778`
   - Delegated Authority: Tier 2 (₹10,00,000)
5. **Karthik Iyer**
   - Role: `Site Operations Supervisor` (`DEPT-OPS`)
   - Email: `karthik.iyer@apexhorizon.com`
   - Phone: `+91 99002 33445`
   - Delegated Authority: Tier 1 (₹1,00,000)

---

### Step 5: Work-Item Catalogue & Disposition (Business Processes & Scope Matrix)
* **Navigation:** `Catalogue` > `Work Items` (`/catalogue`)
* **Purpose & Distinction:**
  > [!NOTE]
  > **Work-Item Catalogue vs. Inventory Stores:**
  > - **Work-Item Catalogue (`/catalogue`)**: Defines the organization-wide master list of standard activities, engineering tasks, compliance obligations, and how the system executes them (its **disposition**: workflow automation, standard form, document record, or manual policy).
  > - **Inventory Stores (`/inventory`)**: Handled later in Phase 5 to track physical stock items, purchase quantities, warehouse bays, and Goods Receipt Notes (GRN).

#### Real Work-Item Catalogue Entries & Dispositions to Configure:
1. **Work Item: Structural Concreting & Pour Clearance**
   - Item Code / Key: `WI-OPS-CONC-POUR`
   - Department: `Civil Engineering & Operations`
   - Description: *Inspection and pour approval protocol prior to placing ready-mix concrete on suspended slabs or foundations.*
   - **Disposition:** `workflow_automation` (routed to the Workflow Engine / Inspection Approval graph)
   - Phase Target: `Phase 1 (Active Site Mobilization)`
   - Status: `Published`
2. **Work Item: Major Procurement Approval (PO > ₹10 Lakhs)**
   - Item Code / Key: `WI-PROC-HIGH-VALUE-PO`
   - Department: `Procurement & Supply Chain`
   - Description: *Two-tier commercial sign-off for critical material orders exceeding ten lakh rupees.*
   - **Disposition:** `workflow_automation` (linked to `wf.po_approval` in Step 6)
   - Phase Target: `Phase 1 (Immediate)`
   - Status: `Published`
3. **Work Item: Site Quality Non-Conformance Closure (NCR)**
   - Item Code / Key: `WI-QA-NCR-DISPOSITION`
   - Department: `Quality Assurance & HSE`
   - Description: *Root cause analysis, corrective action verification, and engineering sign-off for site defects.*
   - **Disposition:** `standard_form` (handled by Quality Inspection & NCR module)
   - Status: `Published`
4. **Work Item: Weekly Critical Path Delay Assessment**
   - Item Code / Key: `WI-AI-SCHEDULE-ANALYSIS`
   - Department: `Project Controls & Planning`
   - Description: *Automated lookahead variance calculation and liquidated damage exposure assessment.*
   - **Disposition:** `ai_agent_task` (delegated to the Project Delay Analyst Agent)
   - Status: `Published`

---

## Phase 2: Workflow Automation & Rules Engine

### Step 6: Workflow Definitions & Visual React Flow Canvas Studio
* **Navigation:** `Workflows` > `Definitions` (`/workflow/definitions`)

We will configure the **High-Value Purchase Order Approval Workflow** (`WF-PO-APPROVAL`).

#### Setup Workflow Definition:
* **Workflow Key:** `wf.po_approval`
* **Name:** `Purchase Order Multi-Tier Approval Workflow`
* **Capability:** `Procurement & Commitments`
* **Click:** `+ Create Workflow` $\to$ Enter detail page $\to$ `+ Add Version (Draft)`.

#### Build Graph on the React Flow Canvas Studio (`/workflow/versions/:id`):
1. **Node 1: Start (create_task)**
   - Key: `start_po`
   - Form Template: `po_submission`
   - Required Fields: `po_number, vendor_name, total_amount, cost_center`
2. **Node 2: Evaluate Financial Threshold (evaluate_condition)**
   - Key: `check_threshold`
   - Field to Evaluate: `total_amount`
   - Operator: `greater_than`
   - Value: `1000000` (₹10 Lakhs)
3. **Node 3: Tier 2 Approval (request_approval)**
   - Key: `procurement_head_approval`
   - Assign to Role: `Head of Procurement` (`Sunita Nair`)
   - SLA Deadline: `24 hours`
4. **Node 4: Tier 3 Director Approval (request_approval)**
   - Key: `project_director_approval`
   - Assign to Role: `Project Director` (`Vikram Malhotra`)
   - SLA Deadline: `48 hours`
5. **Node 5: Dispatch PO to Vendor (call_service)**
   - Key: `send_po_webhook`
   - Webhook URL: `https://api.apexhorizon.com/integrations/vendor-dispatch`
   - Method: `POST`
6. **Node 6: Complete (complete)**
   - Key: `po_issued_complete`

#### Connect Edges:
* Connect `start_po` $\to$ `check_threshold`
* If $\le$ ₹10L: `check_threshold` $\to$ `procurement_head_approval` $\to$ `send_po_webhook` $\to$ `po_issued_complete`
* If $>$ ₹10L: `check_threshold` $\to$ `project_director_approval` $\to$ `send_po_webhook` $\to$ `po_issued_complete`
* **Action:** Click `Validate Graph` $\to$ Ensure 0 errors $\to$ Click `Publish Version`.

---

## Phase 3: Pre-Construction, CRM & Tendering

### Step 7: Client CRM & Pipeline Opportunity
* **Navigation:** `CRM` > `Opportunities` (`/crm`)

#### Real Test Data:
* **Client Organization:** `Horizon Realty Developers Ltd.`
* **Client Contact:** `Gautam Singhania (Vice President - Projects)`
* **Contact Phone:** `+91 99200 44321` | **Email:** `gautam.s@horizonrealty.com`
* **Opportunity Title:** `The Metro Tech Park - Tower C Construction Package`
* **Expected Tender Value:** `₹45,00,00,000`
* **Target Handover Date:** `2027-12-31`
* **Stage:** Move from `Lead` $\to$ `Qualified` $\to$ `Tender In Progress`.

---

### Step 8: Tendering, Cost Estimation & Commercial Submission
* **Navigation:** `Tendering & Estimating` (`/tendering`)

#### Build Estimation Sheet for the Bid:
1. **Civil & Structural Core Package:**
   - RMC Concrete M30: 12,000 M3 @ ₹4,200 = ₹5,04,00,000
   - TMT Reinforcement Steel Fe500D: 1,800 MT @ ₹64,500 = ₹11,61,00,000
   - Shuttering & Scaffolding Labour: 42,000 SQFT @ ₹120 = ₹50,40,000
2. **MEP Services & Plant:**
   - 500 TR Chillers (3 Units) @ ₹48,00,000 = ₹1,44,00,000
   - Electrical Substations, Transformers & Cabling = ₹4,20,00,000
   - Plumbing & Firefighting Sprinkler Grid = ₹2,10,00,000
3. **Façade & Architectural Finishes:**
   - Unitized Double Glazed Façade: 85,000 SQFT @ ₹950 = ₹8,07,50,000
   - Granite & Vitrified Tile Flooring = ₹3,40,00,000
4. **General Overheads, Safety & Preliminaries:** ₹4,63,10,000
5. **Contractor Margin:** 8.5% (₹4,00,00,000)
* **Total Tender Price:** **₹45,00,00,000**
* **Submission Action:** Mark Tender Status as `Submitted` $\to$ then mark `Awarded / Won`.

---

## Phase 4: Project Mobilization & Engineering Control

### Step 9: Project Setup & Budget Allocation
* **Navigation:** `Projects` > `Project Directory` (`/projects`)

#### Create the Active Project:
* **Project Name:** `The Metro Tech Park – Tower C`
* **Project Code:** `PRJ-MTP-TC`
* **Client:** `Horizon Realty Developers Ltd.`
* **Lead Project Manager:** `Vikram Malhotra`
* **Start Date:** `2026-11-01` | **Target Completion Date:** `2027-12-31` (14 Months)
* **Base Budget:** `₹45,00,00,000`
* **Location:** `IT Corridor, Outer Ring Road, Mahadevapura, Bengaluru`

---

### Step 10: Technical Engineering, Drawings & RFI Submittals
* **Navigation:** `Projects` > Select `PRJ-MTP-TC` > `Engineering & Submittals`

#### Real Engineering Data:
1. **Register Engineering Drawings:**
   - Drawing # `DWG-STR-FND-001` Rev `R2`: *Mat Foundation Rebar Placement & Pile Cap Detail* (Status: `Approved for Construction - AFC`)
   - Drawing # `DWG-MEP-HVAC-102` Rev `R1`: *Basement Ventilation & Smoke Exhaust Duct Routing* (Status: `Under Consultant Review`)
2. **Raise Request for Information (RFI):**
   - Click `+ New RFI`
   - **RFI Code:** `RFI-MTP-001`
   - **Subject:** *Conflict between Main Fire Sprinkler Header and Structural Beam B-14 in Basement 1*
   - **Question to Consultant:** *Duct routing at Grid D-4 clashes with bottom of drop panel. Can we sleeve through beam or lower ceiling by 150mm?*
   - **Suggested Solution:** *Lower ceiling soffit locally by 150mm without affecting clearance.*
   - **Status:** Set to `Submitted to Consultant`.

---

### Step 11: Schedule, WBS & Progress Planning
* **Navigation:** `Projects` > Select `PRJ-MTP-TC` > `Schedule & Lookahead`

#### Real WBS Schedule to Populate:
| WBS Code | Activity Name | Duration | Predecessor | Planned Weightage |
| :--- | :--- | :---: | :---: | :---: |
| `1.1` | Site Clearance, Mobilization & Shoring | 30 Days | None | 5% |
| `1.2` | Basement Excavation & Piling Works | 45 Days | 1.1 | 12% |
| `1.3` | Raft Foundation & Substructure Concrete | 40 Days | 1.2 | 15% |
| `2.1` | Superstructure Columns & Slabs (L1 to L9) | 90 Days | 1.3 | 25% |
| `2.2` | Superstructure Columns & Slabs (L10 to L18)| 80 Days | 2.1 | 20% |
| `3.1` | Unitized External Façade Glazing | 60 Days | 2.1 | 10% |
| `3.2` | MEP Rough-ins, Chillers & Commissioning | 75 Days | 2.2 | 8% |
| `4.1` | Testing, Snagging & Final Handover | 30 Days | 3.1, 3.2 | 5% |

* **Verification:** Check the interactive Gantt chart and verify milestone dates calculate properly.

---

## Phase 5: Supply Chain, Stores & Subcontractors

### Step 12: Procurement (PR $\to$ RFQ $\to$ PO Execution)
* **Navigation:** `Supply Chain` > `Procurement` (`/procurement`)

#### Step 12.1: Raise Purchase Requisition (PR)
* **PR Number:** `PR-2026-0089`
* **Project:** `PRJ-MTP-TC`
* **Requested Item:** `TMT Reinforcement Steel Fe500D (25mm)`
* **Quantity Requested:** `200 MT`
* **Required by Date:** `2026-11-15`
* **Estimated Value:** `₹1,29,00,000`

#### Step 12.2: Convert to Purchase Order (PO)
* **PO Number:** `PO-2026-0045`
* **Vendor:** `Tata Steel Industrial Solutions Ltd.`
* **Delivery Site:** `The Metro Tech Park, Gate 2 Material Yard`
* **Payment Terms:** `30 Days Net from GRN Verification`
* **Line Item:** `200 MT` @ `₹64,500/MT` = `₹1,29,00,000` + 18% GST (`₹23,22,000`) = `₹1,52,22,000`
* **Workflow Test Point:** Submit PO $\to$ Because value exceeds ₹10,00,000, verify the task routes to `Vikram Malhotra` (Project Director) in his **Approval Queue** (`/approvals`). Approve the PO.

---

### Step 13: Stores, Inventory & Goods Receipt Notes (GRN)
* **Navigation:** `Supply Chain` > `Inventory & Stores` (`/inventory`)

#### Step 13.1: Configure Inventory Material Master (Physical Stock Items)
Before receiving site shipments, ensure the material master has the physical commodities configured:
1. **Ready Mix Concrete M30 Grade**: Code `INV-CONC-M30` | Category: `Bulk Materials` | UOM: `M3` | Min Safety Stock: `50 M3`
2. **TMT Reinforcement Steel Fe500D (25mm)**: Code `INV-STEEL-25MM` | Category: `Structural Steel` | UOM: `MT` | Min Safety Stock: `20 MT` | Storage Bay: `Central Yard - Bay A`
3. **Centrifugal Water Chiller 500 TR**: Code `INV-MEP-CHILL` | Category: `HVAC Equipment` | UOM: `NOS` | Storage Bay: `Plant Room Staging`

#### Step 13.2: Receive Delivery at Site (Goods Receipt Note):
* **Click:** `+ Create Goods Receipt Note (GRN)`
* **GRN Number:** `GRN-MTP-0012`
* **Against PO:** `PO-2026-0045` (Tata Steel)
* **Vendor Delivery Challan #:** `DC-TATA-88391`
* **Vehicle / Trailer #:** `KA-01-EA-4910`
* **Quantity Received:** `200 MT`
* **Physical Condition:** `Passed visual inspection, mill test certificates (MTC) attached`
* **Storage Location:** `Central Yard - Bay A (Heavy Rebar Rack)`
* **Action:** Submit GRN $\to$ Check Stock Ledger: Verify `STEEL-FE500-25` shows `+200 MT` on hand.

---

### Step 14: Subcontractor Agreements & Trade Labour
* **Navigation:** `Supply Chain` > `Subcontractors` (`/subcontractors`)

#### Mobilize Trade Contractors:
* **Contractor Name:** `Star Formwork & Shuttering Solutions LLP`
* **Trade:** `Formwork, Staging & Concrete Pouring`
* **Work Order (WO) #:** `WO-SUB-MTP-003`
* **Scope:** `Formwork erection & stripping for Raft & Columns Level B2 to Ground Floor`
* **WO Value:** `₹38,00,000`
* **Daily Labour Deployment:** `45 Carpenters, 30 Bar Benders, 20 Riggers`

---

## Phase 6: Field Execution, Quality, Safety & Fleet

### Step 15: Site Operations & Daily Progress Reporting (DPR)
* **Navigation:** `Field Operations` > `Daily Progress Reports` (`/site`)

#### Submit Daily Progress Report:
* **DPR Number:** `DPR-MTP-2026-11-04`
* **Date:** `2026-11-04`
* **Shift:** `Day Shift (08:00 to 18:00)`
* **Weather:** `Sunny, 28°C, 0mm Rainfall`
* **Site Manpower:**
  - Apex Horizon Staff: 12 Engineers & Supervisors
  - Subcontractor Labour: 95 Workers (Star Formwork & Bar Benders)
* **Major Completed Works:**
  - Cast Raft Foundation Bay 2: Poured 180 M3 concrete using Boom Pump BP-01.
  - Placed 24 MT of 25mm rebar on grid lines F1 through F8.
* **Delays / Constraints:** *Concrete transit mixer delayed 45 minutes due to Outer Ring Road traffic bottleneck.*

---

### Step 16: Mobile / Offline Field Mode Testing
* **Navigation:** `Field Mode` (`/field-mode`)

#### Test Offline Capabilities:
1. Open Developer Tools (`F12`) $\to$ `Network` $\to$ Set Throttling to **Offline**.
2. Notice the top banner updates to **"Offline Mode - Changes Cached Locally"**.
3. Create a quick site observation:
   - Text: *"Water accumulation observed near footing F-4 during evening rounds."*
   - Urgency: `Medium`
   - Click `Save Observation`.
4. Return Network to **Online** $\to$ Verify the offline queue automatically synchronizes with the server database.

---

### Step 17: Quality Assurance, ITP & Non-Conformance (NCR)
* **Navigation:** `Quality & HSE` > `Quality Inspections` (`/quality`)

#### Test Quality Non-Conformance Workflow:
* **Click:** `+ Raise NCR`
* **NCR Number:** `NCR-MTP-2026-003`
* **Element:** `Column C-14 at Grid E-3 (Level B1)`
* **Defect Description:** *Severe honeycombing and exposed rebar noticed after formwork stripping over a 400mm x 250mm patch.*
* **Root Cause:** *Insufficient needle vibrator compaction due to dense steel congestion around mechanical anchor bolts.*
* **Severity:** `Major`
* **Corrective & Preventive Action (CAPA):**
  - Chipping back loose concrete to sound substrate.
  - Surface preparation and pressure grouting with high-strength non-shrink micro-concrete (SikaGrout 214).
  - Use pencil vibrators on all future congested anchor nodes.
* **Assignee:** `Rajesh Verma (Quality Engineer)`
* **Status:** `Open - Awaiting Rectification & Re-inspection`.

---

### Step 18: Safety Governance, Incidents & Toolbox Talks
* **Navigation:** `Quality & HSE` > `Safety & Incidents` (`/safety`)

#### Real Safety Records:
1. **Toolbox Talk (TBT):**
   - Topic: *Safe Rigging & Anti-Fall Harness Protocols during Tower Crane Lifting Operations*
   - Attendees Count: `82 site workers` | Conducted by: `Rajesh Verma`
2. **Log Near-Miss Observation:**
   - Code: `NM-2026-019`
   - Description: *A 2-inch scaffolding coupler fell from Level 4 edge protection to safety netting below. No workers injured.*
   - Action Taken: *Installed toe-boards and debris containment netting along perimeter within 2 hours.*

---

### Step 19: Plant, Equipment & Heavy Fleet
* **Navigation:** `Fleet & Assets` > `Equipment Register` (`/equipment`)

#### Equipment Master & Daily Operating Log:
* **Asset ID:** `EQ-TC-01`
* **Name:** `Liebherr 85 EC-B Flat-Top Tower Crane`
* **Capacity:** `5 Tonnes @ 50m Jib`
* **Operational Hours Today:** `8.5 Hours`
* **Fuel Log:** `95 Litres High-Speed Diesel (HSD)`
* **Maintenance Status:** `Valid Third-Party Certification (valid until 2027-06-30)`
* **Assigned Operator:** `Mohan Lal (Licence #OPR-CRANE-9912)`

---

## Phase 7: Commercial Contracts, Billing & Finance

### Step 20: Main Client Contract & Variation Orders (VOR)
* **Navigation:** `Commercial` > `Contracts & Variations` (`/contracts`)

#### Real Contract & Variation Data:
* **Contract Reference:** `CNT-HORIZON-2026-MTP`
* **Contract Type:** `Item Rate with Escalation Clause (FIDIC Red Book derivative)`
* **Total Contract Sum:** `₹45,00,00,000`
* **Retention Guarantee:** `5% from every running account bill`
* **Raise Variation Order Request (VOR):**
  - **VOR Number:** `VOR-MTP-001`
  - **Title:** *Specification Upgrade of Main Entrance Lobby to Italian Statuario Marble & Double Acoustic Gypsum Ceiling*
  - **Reason:** *Client architectural redesign requested by Foster & Partners.*
  - **Net Financial Addition:** `+ ₹32,50,000`
  - **Time Extension Impact:** `+ 14 Calendar Days`
  - **Status:** Set to `Approved by Client Representative`.

---

### Step 21: Client Billing (RA Bills) & Vendor Payables
* **Navigation:** `Finance` > `Billing & Invoicing` (`/billing`)

#### Step 21.1: Generate Client Running Account (RA) Bill #01
* **Bill Reference:** `RA-MTP-001`
* **Period:** `01-Nov-2026 to 30-Nov-2026`
* **Gross Certified Value of Works Done:**
  - Site Mobilization (100%): ₹2,25,00,000
  - Piling & Foundation Excavation (60%): ₹3,24,00,000
* **Gross Bill Amount:** `₹5,49,00,000`
* **Deductions:**
  - 5% Retention Money: `- ₹27,45,000`
  - 10% Mobilization Advance Recovery: `- ₹54,90,000`
* **Net Taxable Amount:** `₹4,66,65,000`
* **GST (12% Works Contract):** `+ ₹55,99,800`
* **Net Payable by Client:** **₹5,22,64,800**
* **Action:** Generate Invoice $\to$ Mark as `Issued to Client`.

---

### Step 22: Project Budget vs Actual Cost Variance
* **Navigation:** `Finance` > `Cost Control & Budgets` (`/finance`)

#### Verify Financial Health:
* **Approved Budget:** `₹45,32,50,000` (incorporating approved VOR-001)
* **Committed Costs (PO + Subcontracts):** `₹1,90,22,000`
* **Actual Invoiced Spend:** `₹1,52,22,000`
* **Client Revenue Billed:** `₹5,49,00,000`
* **Net Cash Margin:** `+ ₹3,96,78,000`
* **Project CPI (Cost Performance Index):** `1.04` (Tracking favorably under budget)
* **Project SPI (Schedule Performance Index):** `0.98` (2% slight lead delay on piling)

---

## Phase 8: AI Intelligence, Autonomous Agents & System Auditing

### Step 23: Dynamic AI Provider & Model Configuration
* **Navigation:** `AI & Automation` > `AI Agents & Models` (`/ai/agents`)

#### Configure Live AI Provider:
1. In the **AI Provider Connections** panel, review the supported providers:
   - **Google Gemini** (Gemini 2.5 Flash, Gemini Pro)
   - **OpenAI** (GPT-4o, GPT-4o-mini)
   - **Anthropic Claude** (Claude 3.5 Sonnet)
   - **Ollama / Local LLM** (e.g. `llama3.2`, `mistral`)
   - **Custom OpenAI-Compatible Provider** (e.g. Groq, vLLM, DeepSeek, Together AI)
2. **Add Custom AI Provider (Test Use Case):**
   - Click `+ Add Custom Provider`
   - Provider Name: `Groq Cloud Fast Inference`
   - Base URL: `https://api.groq.com/openai/v1`
   - API Key: `gsk_demo_test_key_abc123`
   - Default Model: `llama-3.3-70b-versatile`
   - Click `Test & Save Connection` $\to$ Verify green status badge.
3. Click `+ Add Model` on the newly created card $\to$ Add `mixtral-8x7b-32768`.

---

### Step 24: Knowledge Documents & Grounded RAG Search
* **Navigation:** `AI & Automation` > `Knowledge Assistant` (`/ai/knowledge`)

#### Upload & Ground Project Specifications:
1. Click `+ Ingest Knowledge Document`
2. **Document Title:** `The Metro Tech Park - Technical Specification Manual v2.1`
3. **Category:** `Engineering & Structural Specifications`
4. **Project Tag:** `The Metro Tech Park - Tower C` (`PRJ-MTP-TC`)
5. **Content / Summary:**
   > *"All substructure concrete in contact with soil must use Sulfate Resistant Portland Cement (SRPC) with minimum cement content of 380 kg/m3 and water-cement ratio not exceeding 0.42. Water-retaining basement slabs require dual-torch APP bituminous 4mm membrane with 100mm laps."*
6. **Test Query in Semantic Search Box:**
   - Search: *"What is the minimum cement content and water-cement ratio required for basement concrete?"*
   - **Verification:** The RAG engine returns the exact citation snippet from Technical Specification Manual v2.1 with confidence score $\ge 0.92$.

---

### Step 25: Autonomous AI Agent Execution
* **Navigation:** `AI & Automation` > `AI Agents & Models` (`/ai/agents`)

#### Test the Pre-Built Autonomous Agents:
1. **Agent 1: Project Delay & Lookahead Analyst Agent**
   - Trigger Agent with Input:
     ```json
     {
       "projectId": "PRJ-MTP-TC",
       "delayDays": 6,
       "reason": "Traffic congestion delaying ready-mix concrete transit mixers during peak morning hours"
     }
     ```
   - Tool Execution: Automatically calls tool `calculate_delay_impact` and `query_project_schedule`.
   - **Verification:** The agent returns:
     - Critical path slip: `5.1 days`
     - Overhead exposure: `₹27,000 / day`
     - Actionable Advice: *"Issue Contractor Notice of Delay (NOD) under Contract Clause 20.1 and resequence lookahead night-pours."*
2. **Agent 2: Site Safety Incident Auditor**
   - Trigger Input:
     ```json
     {
       "projectId": "PRJ-MTP-TC",
       "hazardType": "Working at Heights / Scaffolding",
       "description": "Coupler detachment on Level 4 perimeter scaffold",
       "severity": "high"
     }
     ```
   - Tool Execution: Calls tool `log_safety_observation`.
   - **Verification:** Observation `OBS-xxxx` logged and assigned to `Rajesh Verma` for immediate 4-hour inspection.

---

### Step 26: Human-in-the-Loop Agent Run Audit
* **Navigation:** `AI & Automation` > `Agent Execution Traces` (`/ai/agent-runs`)

1. Inspect the live trace list:
   - Verify every tool call step, input payload, output schema, and LLM reasoning tokens are displayed.
2. Select any high-risk agent action flagged for **Human Review**:
   - Review proposed action: *"Issue Formal Variation Claim Notice to Client"*
   - Click **Approve Execution** or **Reject with Feedback**.
   - Verify state transitions from `awaiting_approval` $\to$ `completed`.

---

### Step 27: Executive Dashboards, Reports & System Auditing
* **Navigation:** `Dashboards` > `Executive Overview` (`/dashboard`)

#### Validate Final Unified Metrics:
1. **Executive Financial Waterfall:**
   - Total Booked Revenue: `₹45,00,00,000`
   - Billed to Date: `₹5,49,00,000`
   - Paid Received: `₹5,22,64,800`
   - Total Committed Cost: `₹1,90,22,000`
   - Projected Net Profit Margin: `11.8%`
2. **Operational Project Health Card:**
   - Open RFIs: `1` (RFI-MTP-001)
   - Open Quality NCRs: `1` (NCR-MTP-2026-003)
   - Safety Days Without Lost Time Injury (LTI): `184 Days`
3. **Report Builder:**
   - Click `Generate Monthly Project Status Pack (PDF/CSV)`.
   - Verify file compiles data across WBS, Procurement, Billing, and NCRs cleanly.

---

## 3. Comprehensive Module Verification Checklist

Use this table during testing to note your observations:

| # | Domain & Capability | Navigation Path | Key Test Action | Expected Result | Status |
| :-: | :--- | :--- | :--- | :--- | :-: |
| 1 | **Tenancy & Branches** | `/tenancy` | Setup Mumbai HQ & BLR Branch | Hierarchy visible on all selectors | [ ] |
| 2 | **Master Data** | `/masterdata` | Add UOMs, Tax codes & Cost Centers | Autocomplete available in forms | [ ] |
| 3 | **Departments & Roles** | `/departments` | Configure 6 Depts & 4 Approval Tiers | RBAC authority limits enforced | [ ] |
| 4 | **Workforce** | `/employees` | Add 5 core personas | User profiles linked to approval queues | [ ] |
| 5 | **Work Catalogue** | `/catalogue` | Add RMC, Steel, Chiller & Façade items | Rates propagate to estimations & POs | [ ] |
| 6 | **Workflow Studio** | `/workflow/definitions` | Build PO Approval Flow on React Flow | Multi-tier thresholds evaluate | [ ] |
| 7 | **CRM Pipeline** | `/crm` | Add Horizon Realty & Tower C deal | Pipeline stage drag-and-drop works | [ ] |
| 8 | **Tendering** | `/tendering` | Build ₹45 Cr estimate & award bid | Converts directly to Project | [ ] |
| 9 | **Project Detail** | `/projects` | View `PRJ-MTP-TC` project hub | KPIs, timeline & budget sync | [ ] |
| 10 | **Engineering RFIs** | `/projects` (RFI Tab) | Submit RFI-MTP-001 for beam clash | Tracks status and consultant reply | [ ] |
| 11 | **Schedule & Gantt** | `/projects` (Schedule) | Inspect 8 WBS packages | Critical path & lookahead displayed | [ ] |
| 12 | **Procurement** | `/procurement` | Submit & Approve ₹1.52 Cr Steel PO | Routes to Vikram Malhotra for sign-off | [ ] |
| 13 | **Stores & Inventory** | `/inventory` | Create GRN-0012 for 200 MT steel | Inventory ledger increases by 200 MT | [ ] |
| 14 | **Subcontractors** | `/subcontractors` | Issue Formwork WO & log attendance | Daily headcount feeds into DPR | [ ] |
| 15 | **Site DPR** | `/site` | Submit daily log with 180 M3 concrete | Progress updates linked WBS item | [ ] |
| 16 | **Offline Field Mode**| `/field-mode` | Disconnect internet & save note | Syncs to server on reconnect | [ ] |
| 17 | **Quality & NCR** | `/quality` | Raise Column C-14 Honeycombing NCR | CAPA workflow triggers | [ ] |
| 18 | **Safety & HSE** | `/safety` | Log Scaffolding Coupler Near-Miss | Observation assigned for closure | [ ] |
| 19 | **Fleet & Assets** | `/equipment` | Log Tower Crane hours & 95L fuel | Equipment utilization calculated | [ ] |
| 20 | **Contracts & VOR** | `/contracts` | Approve +₹32.5L Marble VOR | Project budget increases to ₹45.32 Cr | [ ] |
| 21 | **Billing & Invoices**| `/billing` | Generate Client RA Bill #01 | Retention & Advance deducted accurately| [ ] |
| 22 | **Cost Control** | `/finance` | Review Cost Variance & CPI/SPI | Financial health waterfall balanced | [ ] |
| 23 | **AI Dynamic Setup** | `/ai/agents` | Connect custom Groq / Ollama model | Model available in Agent Studio | [ ] |
| 24 | **Knowledge RAG** | `/ai/knowledge` | Ingest concrete spec & query assistant | Retrieves grounded citation snippet | [ ] |
| 25 | **AI Agent Runner** | `/ai/agents` | Run Delay & Safety Agents | Runs tools & returns structured plan | [ ] |
| 26 | **Audit & Traces** | `/ai/agent-runs` | Review tool step execution logs | Audit history immutable and clear | [ ] |
| 27 | **Executive Dashboard**| `/dashboard` | View full project scorecard & export | Real-time charts reflect all inputs | [ ] |

---
*Created for Apex Horizon Infrastructure Pvt. Ltd. on the sevents-os Enterprise Platform.*
