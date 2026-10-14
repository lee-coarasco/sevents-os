---
id: 21
title: "Classify catalogue cluster: Contracts & Legal Assistant support operations"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 40 Legal rows carrying
"Contracts & Legal Assistant" as `Who is Responsible` (#1269-1308). Third
and final batch of the Legal department pass (ticket 0007) — completes
Legal (120/120 rows). This role is the administrative-support layer
beneath Legal Counsel (Lead) (ticket 0020), same shape as Accountant
(ticket 0018) sitting beneath Senior Accountant (Lead) (ticket 0017):
intake, drafting/formatting support, execution/dispatch coordination,
register-keeping and meeting/reporting administration, explicitly barred
from giving legal advice or approving legal positions.

## Source rows covered

**A. Legal matter intake administration** — trigger: "a Legal request or
new matter arrives through the approved channel."

| S.No. | Work item |
|---|---|
| 1269 | Register each incoming Legal request and assign a unique matter ID |
| 1270 | Acknowledge the request and record counsel owner, priority and deadline |
| 1271 | Issue and track the conflict-check questionnaire and result |
| 1272 | Prepare the matter-opening checklist and required-document list |
| 1273 | Collect instructions, contracts, correspondence and supporting evidence |
| 1274 | Create the controlled electronic matter folder and approved access permissions |
| 1275 | Apply Legal file-naming, version and status conventions |
| 1276 | Return incomplete requests and track missing information to closure |

**B. Drafting, formatting and quality-control support** — trigger:
"Legal Counsel issues a controlled drafting, comparison, formatting or
finalisation instruction."

| S.No. | Work item |
|---|---|
| 1277 | Populate approved standard contract, notice and letter templates |
| 1278 | Format draft agreements, notices, advice and legal correspondence |
| 1279 | Prepare document comparisons and tracked-change mark-ups |
| 1280 | Maintain the negotiation comment and deviation matrix |
| 1281 | Compile schedules, annexures, exhibits and referenced documents |
| 1282 | Verify document references, defined terms, cross-references and pagination |
| 1283 | Proofread draft documents and record quality-control corrections |
| 1284 | Issue the counsel-approved controlled final version for action |

**C. Execution, signature and dispatch support** — trigger: "an
agreement or legal document is approved for execution, formal service,
notarisation, legalisation or registration support."

| S.No. | Work item |
|---|---|
| 1285 | Prepare signature-authority and execution-checklist packs |
| 1286 | Coordinate approved signature circulation and execution sequence |
| 1287 | Track counterparty signatures and outstanding execution actions |
| 1288 | Receive and reconcile executed originals and certified copies |
| 1289 | Coordinate notarisation, legalisation and attestation when instructed |
| 1290 | Compile powers of attorney, board resolutions and signatory evidence |
| 1291 | Coordinate document dispatch, formal service, courier and delivery proof |
| 1292 | Distribute executed copies and update agreement execution status |

**D. Legal register maintenance** — trigger: "a contract, obligation,
notice, claim, proceeding, licence, security or deadline is created or
changes."

| S.No. | Work item |
|---|---|
| 1293 | Maintain the client, supplier, subcontract and other contracts register |
| 1294 | Maintain the contractual-obligations, expiry and renewal register |
| 1295 | Maintain the claims, notices, variations and extension-of-time register |
| 1296 | Maintain the dispute, court, arbitration and hearing register |
| 1297 | Maintain the external-counsel, expert and legal-adviser register |
| 1298 | Maintain the corporate licence, permit, authority and renewal register |
| 1299 | Maintain the insurance, bond, guarantee and security register |
| 1300 | Issue deadline reminders and escalate overdue Legal actions |

**E. Legal meetings, fees, reporting, archive and closure** — trigger:
"a Legal meeting, external fee, reporting cutoff, legal hold, archive
event or matter closure becomes due."

| S.No. | Work item |
|---|---|
| 1301 | Coordinate the Legal calendar, meetings, agendas and attendance records |
| 1302 | Prepare Legal meeting minutes and maintain the action tracker |
| 1303 | Register external-counsel invoices and supporting fee narratives |
| 1304 | Maintain Legal budget commitments, purchase-order and payment-status records |
| 1305 | Compile weekly and monthly Legal status and deadline reports |
| 1306 | Maintain the evidence index and preserve legal-hold materials |
| 1307 | Archive superseded and executed Legal records under the retention rules |
| 1308 | Close the matter file and verify the complete closure checklist |

All 40 rows: canonical `role.contracts_legal_assistant` (already listed
in `docs/canonical-role-map.md`). Shared control note throughout A-E:
"The Assistant performs administrative intake only and does not give
legal advice or approve legal positions" (A/B wording) / "[a]ll
substantive wording remains subject to Legal Counsel review" (B) /
"[s]ignature authority is verified before circulation" (C) — same
administrative-support, no-legal-judgment boundary running through every
cluster, with escalation to Legal Counsel for anything requiring legal
judgment, authority defects, confidentiality incidents, urgent deadlines
or incomplete evidence.

## Disposition

**Configure workflow** for 37 of 40 rows (all of A-D, plus 1301-1304 and
1308 in E): each is a recurring administrative task with a traceable
next consumer — intake feeds Legal Counsel's matter lifecycle (ticket
0020 cluster A), drafting/formatting support feeds Legal Counsel's
drafting clusters (ticket 0020 B-C), execution/dispatch support feeds
the agreement's execution record, and register maintenance keeps the
data that Legal Counsel and the CLO (ticket 0019) review and escalate
against — same "ongoing task with a downstream consumer" test ticket
0018 used to keep the Accountant's posting/register rows as workflow
rather than Track obligation/document.

**Periodic review/monitor** for 1305 ("compile weekly and monthly Legal
status and deadline reports"): an explicitly scheduled reporting output,
same distinction as ticket 0016's row 735 and ticket 0019's 1214/1215.

**Track obligation/document** for 1306 ("maintain the evidence index and
preserve legal-hold materials") and 1307 ("archive superseded and
executed Legal records under the retention rules"): both are the
discrete evidence-preservation/retention-rule obligation itself, not a
task feeding a further step — same reasoning as ticket 0018's row 850
("archive... by retention rule").

Cluster C (execution/signature/notarisation/dispatch) is kept as
Configure workflow rather than Track obligation/document despite BRD
§6.5 using "signature" and "physical-paper step" as Track
obligation/document examples: these 8 rows form one sequential
multi-step pipeline (prepare pack → circulate → track → receive
originals → notarise → compile PoA → dispatch → distribute) with a
single shared Output/Evidence, the same multi-step-pipeline shape that
put the pilot's own delivery/GRN cluster (ticket 0005) into Configure
workflow despite also involving physical signatures and receipts — not a
standalone single tracked obligation.

## Acceptance
- [x] All 40 Contracts & Legal Assistant rows (#1269-1308) classified
      into 5 trigger-clusters with per-row splits recorded (E) where
      output shape differs.
- [x] Confirmed `role.contracts_legal_assistant` already exists in
      `docs/canonical-role-map.md` — no change needed there.
- [x] Legal department now fully classified: 120/120 rows across 3 roles
      (tickets 0019-0021).
- [ ] SLA: source `Timing` is "To be confirmed" for all 40 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 40 Contracts & Legal
  Assistant rows — third and final role in Legal. Department complete
  (120/120 rows, tickets 0019-0021). Next department per ticket 0007's
  table: Marketing & Sales (120 rows, not started).
