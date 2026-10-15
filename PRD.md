# SEVENTS — Pilot PRD (Phase 3 Vertical Slice)

**Status:** Draft, pilot scope only. Awaiting business-owner confirmation on the open
decisions in Section 9 before `BUILDING` begins. Scope source: `docs/BRD.md`
(sections 1-4, 6, 7, 10.3, 16, 17, 20, 21) and `docs/IMPLEMENTATION-PLAN.md` (Phase 3).

This PRD does not cover the full 38-module BRD. It defines the one end-to-end
slice SEVENTS must prove before expanding, per Implementation Plan Phase 3 and
BRD §17 (MVP Definition). Later phases (Phase 4+) are out of scope here and
remain tracked in the BRD roadmap.

---

## 1. Pilot flow

**Material requirement → procurement review → quotation comparison → approval
→ purchase order → delivery/GRN → site issue.**

This is the default named in `CLAUDE.md` and matches BRD §10.3 ("Material
requirement to payment"), truncated before invoice/payment matching — that
tail (vendor-bill 3-way match, payment approval) is explicitly Phase 5
(Finance and contracts) in both the BRD roadmap and Implementation Plan, not
part of this slice. See `DECISIONS.md` for why this flow was chosen as the
default rather than an alternative BRD §10 flow, and the open question for
the business owner to confirm or redirect it.

### 1.1 Steps in scope

1. A project role identifies a material requirement and raises a requisition.
2. System checks stock, reservations, open POs (where that data exists) —
   full demand-forecast intelligence is out of scope for the pilot; a basic
   "is there already an open PO or stock for this item" check is in scope.
3. Procurement receives, registers and validates the requisition against
   budget/authority (authority limits are config, not hard-coded — see §9).
4. Procurement issues RFQs and logs vendor quotations.
5. Procurement prepares a quotation comparison (price, lead time, compliance).
6. Named approver(s) approve the vendor/PO per the configured approval policy.
7. Procurement issues the purchase order.
8. Delivery is tracked; Storekeeper receives, inspects and creates a GRN,
   recording any discrepancy.
9. Stock ledger updates; Storekeeper issues material against an authorised
   material request to the originating project/site activity.

Everything after step 9 (vendor-bill matching, payment, retention, cost
variance reporting) is Phase 5 and out of scope for the pilot.

### 1.2 Traceability to the source catalogue

The pilot flow is directly supported by these existing catalogue rows
(`docs/catalogue/source-catalogue.json`, S.No. column; full text in
`docs/BRD.md` §22 appendix and the source workbook):

| Step | Department | Role | S.No. range (representative) |
|---|---|---|---|
| Raise requirement | Projects | Site Civil/MEP Engineer, Quantity Surveyor | 334, 361, 518-519 |
| Register/validate requisition | Procurement | Procurement Lead | 601-610 |
| RFQ / quotation comparison | Procurement | Procurement Lead | 618-630 |
| PO approval | Procurement | Chief Procurement Officer (CPO) | 582, 584 |
| PO issue | Procurement | Procurement Lead | 631-640 |
| Delivery / logistics | Procurement | Logistics Coordinator | 656-690 |
| GRN / receipt / inspection | Procurement | Storekeeper | 692-705 |
| Stock & site issue | Procurement | Storekeeper | 714-725 |
| Verify receipt at site | Projects | Site Civil/MEP Engineer, QHSE Engineer | 343, 371, 557 |

These rows are reference input, not an executable spec by themselves (BRD
§6.3) — see the import tickets under `tickets/` for the normalization work
(disposition, trigger/action/SLA confirmation) each row still needs before
being wired into a published workflow.

---

## 2. Personas in the pilot

Subset of BRD §3.1, mapped to canonical roles in `docs/canonical-role-map.md`:

- **Site Civil/MEP Engineer** — raises the material requirement.
- **Quantity Surveyor** — verifies quantity against BOQ/budget, creates the
  ERP requisition.
- **Procurement Lead** (canonical: Procurement Manager/Buyer) — RFQ,
  comparison, PO drafting.
- **Chief Procurement Officer** (canonical: Department Head — Procurement) —
  PO approval within delegated authority.
- **Logistics Coordinator** — delivery tracking.
- **Storekeeper** — GRN, stock ledger, material issue.
- **Platform Administrator** — configures the workflow, roles and approval
  policy (no domain decisions).

CFO/Finance is **not** in the pilot's approval chain unless the configured
approval policy routes a PO above a threshold to Finance — that threshold is
one of the open decisions in §9, not assumed here.

---

## 3. Core entities needed for the pilot

Minimum subset of BRD §6.2, built on the generic configuration/workflow
runtime (Implementation Plan §4), not as pilot-specific tables:

- `DepartmentDefinition`, `RoleDefinition`, `RoleMapping`, `RoleAssignment`,
  `ApprovalLimit`.
- `Project`, `WBSNode` (reference only — scope is "attach to a project",
  not full WBS/schedule build-out).
- `MaterialItem`, `UnitOfMeasure`, `Warehouse`, `StockLedgerEntry`,
  `MaterialRequest`, `MaterialIssue`.
- `Vendor`, `RFQ`, `VendorQuotation`, `EvaluationScore`,
  `PurchaseRequisition`, `PurchaseOrder`, `POChange`.
- `GRN`.
- `WorkflowDefinition`, `WorkflowVersion`, `WorkflowInstance`,
  `WorkflowStepInstance`, `SLAProfile`, `ApprovalPolicy`, `EvidenceRequirement`.
- `Task`, `TaskAssignment`, `Attachment`, `Comment`.
- `AuditEvent`, `Notification`.

No client-billing, contract, or payment entities are required for this slice.

---

## 4. Supported workflow step types used

From Implementation Plan §5 (the only step types this pilot may use — a new
step type is a code change, not configuration):

1. Start from business event (requisition raised).
2. Create/update task via application service.
3. Assign to role/queue (Procurement, Storekeeper).
4. Collect structured form fields (requisition, RFQ, GRN discrepancy).
5. Request/validate evidence (vendor quotation docs, delivery note, GRN photo).
6. Evaluate deterministic condition (value above/below approval threshold).
7. Request sequential approval (CPO, and Finance if threshold routes there).
8. Send notification/reminder.
9. Wait for SLA threshold (quotation deadline, delivery due date).
10. Create linked follow-up task (discrepancy resolution).
11. Escalate/reject/cancel/complete.

---

## 5. Acceptance criteria

From Implementation Plan §3 Phase 3 exit criteria and BRD §17 MVP demo
scenario, adapted to this flow:

- [ ] A Site Engineer/Quantity Surveyor can raise a material requirement
      that creates a `PurchaseRequisition` linked to a project and (where
      configured) a cost code.
- [ ] Procurement can register the requisition, issue RFQs, and record at
      least two competing quotations with a comparison view.
- [ ] The configured approval policy (sequential, by value band) must
      approve before a PO is issued; rejection returns the item with a
      reason and does not silently drop it.
- [ ] A PO cannot be issued twice from the same approved requisition (no
      duplicate-write on retry).
- [ ] Storekeeper can record a GRN against the PO, including a
      discrepancy/rejection path, and the stock ledger reflects the
      accepted quantity.
- [ ] Material issue against the GRN'd stock requires an authorised
      material request; the issuing role and quantity are audited.
- [ ] Every step (requisition, RFQ, approval, PO, GRN, issue) is visible in
      an audit trail: who, when, under what authority, which workflow
      version.
- [ ] The full path runs in a staging environment with realistic sample
      data; reject/exception paths work, not just the happy path.
- [ ] None of this requires VAT/tax posting to be active (tax activation is
      explicitly out of scope — see §9).

---

## 6. Out of scope for the pilot

- Vendor-bill 3-way match, payment approval/release, retention (Phase 5).
- Full WBS/critical-path scheduling.
- Subcontractor work orders and labour certification.
- Client-facing billing/invoicing.
- AI agents of any kind (knowledge assistant, copilot) — the pilot is pure
  workflow/ERP; agents are Phase 6+ per the BRD roadmap.
- Vendor/client self-service portals.
- Any country other than the UAE profile; and within UAE, no VAT
  calculation or posting (configurable field may exist, but is not
  activated — see §9 and BRD §2.3A).
- Mobile offline mode (site users may use the PWA online; offline drafting
  is a later M37 concern).

---

## 7. Non-functional guardrails (carried from BRD, not new for pilot)

- Every write goes through a validated application service with
  server-side permission checks — never UI-only enforcement.
- Idempotent writes: retrying a PO/GRN submission must not create a
  duplicate record.
- Immutable audit trail on requisition, approval, PO, GRN and issue events.
- Workflow instances pin to the published workflow version active at their
  creation; a later republish does not silently change an in-flight
  requisition's rules.
- No AI involvement in this slice; nothing here authorizes AI to execute
  procurement actions.

---

## 8. Role authority — explicitly not invented here

Approval value thresholds, who sits above the CPO in the approval chain for
large POs, and segregation-of-duties specifics (e.g. can the same person
raise and approve a requisition) are **not** defined in this PRD. BRD §21
item 6 lists "actual approval limits by role and transaction type" as a
business decision still required. Building the approval *engine* (config-
driven, supports value bands, sequential/parallel, segregation-of-duties
checks) is in scope; populating it with real numbers is not — see the open
decision below.

---

## 9. Open decisions for the business owner

These block *activation* of the pilot with real authority limits, not the
build of the configurable engine itself. Tracked as a ticket-level
`## Needs approval` (not `NEEDS_APPROVAL.md`, since other Phase 0 work can
continue without an answer):

1. **Approval value bands for PO issuance** — who approves at what value,
   and whether Finance (CFO) sits above the CPO for high-value POs. No
   default will be invented; the pilot's approval policy stays in draft/
   simulation state until the owner confirms real bands.
2. **First pilot project/project type** — BRD §21 item 3 (commercial,
   residential, fit-out, civil/infrastructure) is still open; it affects
   what sample data populates the staging demo in acceptance criterion 8.
3. **Segregation-of-duties rule for this flow** — can one person raise and
   approve, or must requisition-raiser and PO-approver always differ?

None of these block Phase 0 documentation/ticket work. They block turning
the configured workflow from "simulated" to "published/active" per the
configuration lifecycle (BRD §5.4.2, Implementation Plan §6).

---

## 10. Relationship to later phases

This PRD intentionally does not re-litigate the full BRD. Phases 1-2
(platform foundation, configuration studio) must exist before this flow can
be configured rather than coded; Phase 4 widens to the rest of procurement/
engineering/site; Phase 5 adds the finance tail this PRD deliberately stops
short of. See `docs/IMPLEMENTATION-PLAN.md` §3 for the full sequence.
