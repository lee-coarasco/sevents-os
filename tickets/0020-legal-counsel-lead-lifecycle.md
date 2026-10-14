---
id: 20
title: "Classify catalogue cluster: Legal Counsel (Lead) matter/contract lifecycle"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 50 Legal rows carrying "Legal
Counsel (Lead)" as `Who is Responsible` (#1219-1268). Second batch of the
Legal department pass (ticket 0007). Unlike CLO (ticket 0019, almost all
Configure approval/decision), this role executes the multi-step legal
pipeline itself — same pattern as Senior Accountant (Lead) in Finance
(ticket 0017): the "Lead" operational role runs the process, the CXO
approves/decides.

## Source rows covered

**A. Legal matter intake and advice lifecycle** — trigger: "a department
submits a legal request, issue, decision deadline or potential exposure."

| S.No. | Work item |
|---|---|
| 1219 | Triage legal service requests and assign matter risk, priority and response deadline |
| 1220 | Conduct conflict checks and complete the matter-opening review |
| 1221 | Confirm facts, instructions, objectives, decision owner and required deadline |
| 1222 | Identify the applicable contract, authority, policy and regulatory framework |
| 1223 | Research legal issues and validate the current legal position |
| 1224 | Prepare written legal advice, options and recommended controls |
| 1225 | Record advice assumptions, limitations, actions and business-owner acceptance |
| 1226 | Close the advice matter and confirm implementation or outstanding actions |

**B. Tender/client contract review and drafting lifecycle** — trigger:
"a tender or client contract package is received for qualification,
drafting, negotiation or final approval."

| S.No. | Work item |
|---|---|
| 1227 | Review tender invitations and conditions of participation |
| 1228 | Prepare the tender legal-risk and deviation matrix |
| 1229 | Review contract scope, schedules, document priority and interpretation clauses |
| 1230 | Review price, payment, certification, set-off and retention clauses |
| 1231 | Review programme, delay, liquidated-damages and extension-of-time clauses |
| 1232 | Review variation, change-control and additional-work clauses |
| 1233 | Review warranty, defects-liability and performance-obligation clauses |
| 1234 | Review indemnity, liability, exclusion and limitation clauses |
| 1235 | Review insurance, bond, guarantee and security clauses |
| 1236 | Review suspension, default, termination and step-in clauses |
| 1237 | Draft and negotiate client construction and design contracts |
| 1238 | Prepare the final client-contract legal approval pack |

**C. Non-client agreement drafting/review lifecycle** — trigger:
"Procurement or another department submits a complete agreement request
and approved business terms."

| S.No. | Work item |
|---|---|
| 1239 | Draft and review supplier purchase terms and non-standard purchase-order clauses |
| 1240 | Draft and review construction and specialist subcontract agreements |
| 1241 | Draft and review consultancy and professional-services agreements |
| 1242 | Draft and review non-disclosure and confidentiality agreements |
| 1243 | Draft and review memoranda of understanding, letters of intent and heads of terms |
| 1244 | Draft and review joint-venture, consortium and partnership agreements |
| 1245 | Draft and review agency, referral and marketing-service agreements |
| 1246 | Draft and review lease, facility and operational-service agreements |
| 1247 | Draft and review amendments, addenda, novations and assignments |
| 1248 | Prepare the final agreement execution and business-owner handover pack |

**D. Project contract administration and claims lifecycle** — trigger:
"a project instruction, change, delay, payment issue, breach, claim
event or contractual deadline occurs."

| S.No. | Work item |
|---|---|
| 1249 | Prepare the contract-obligations matrix and notice schedule |
| 1250 | Conduct the project legal kickoff and contract-administration handover |
| 1251 | Review client, consultant and contract-administrator instructions |
| 1252 | Draft contractual notices that preserve company rights and remedies |
| 1253 | Review variations, additional works and change instructions for legal effect |
| 1254 | Prepare extension-of-time, delay and disruption claim submissions |
| 1255 | Prepare payment, non-certification and non-payment notices |
| 1256 | Prepare breach, default, cure and remedy notices |
| 1257 | Prepare suspension, termination and reservation-of-rights notices |
| 1258 | Build the claim chronology and coordinate entitlement and quantum evidence |
| 1259 | Prepare responses to claim rejections, counterclaims and contractual allegations |
| 1260 | Update the claim and dispute strategy with recommended next actions |

**E. Dispute resolution, investigation and closeout support** — trigger:
"a dispute, proceeding, investigation, employment issue, compliance
renewal or contract closeout requires Legal action."

| S.No. | Work item |
|---|---|
| 1261 | Conduct early dispute assessment and structured resolution planning |
| 1262 | Prepare settlement proposals, settlement agreements, releases and waivers |
| 1263 | Prepare litigation, arbitration and expert-matter instructions and evidence packs |
| 1264 | Manage external-counsel deliverables, advice, hearings and critical deadlines |
| 1265 | Provide legal support for employee conduct, grievance and termination matters |
| 1266 | Support investigations, whistleblowing, fraud response and legal holds |
| 1267 | Review corporate licence, registration, compliance and renewal issues |
| 1268 | Complete contract and project legal closeout for final account, retention and DLP |

All 50 rows: canonical `role.legal_counsel_lead` (already listed in
`docs/canonical-role-map.md`). Shared continuity text throughout A-E:
"Another authorised qualified Legal Counsel may provide case backup using
the controlled matter file; material exposure, conflicting instructions,
missed deadlines, settlements and precedent-setting positions escalate to
the CLO" — operational-role continuity language (peer backup, named
escalation trigger), distinct from the CLO's own
reserved-decision/delegate language in ticket 0019.

## Disposition

**Configure workflow** for all 50 rows. Each cluster (A-E) is a bounded,
multi-step pipeline with a sequential intake → analysis/drafting →
output → handoff/closure shape and one shared Output/Evidence per
cluster ("a controlled Legal matter with verified instructions,
analysis, written advice, actions, assumptions and closure status" for
A; "a contract review checklist, legal-risk/deviation matrix, negotiated
draft and complete CLO approval pack" for B; etc.) — the same
multi-step-pipeline-with-downstream-recipient pattern used to justify
Configure workflow for CTO (ticket 0008), Architect (Lead) (ticket 0009)
and Senior Accountant (Lead) (ticket 0017), not the single-decision shape
that put CLO/CFO rows into Configure approval/decision. Individual rows
read as "review X clause" or "prepare Y notice" because they are
sub-steps feeding one pipeline output, not standalone bounded decisions
with their own approver and outcome — same reasoning ticket 0017 used to
keep its clause-by-clause rows inside one workflow rather than splitting
each into its own approval.

No Defer split: unlike ticket 0017 (vendor-bill-matching/payment
explicitly excluded from the pilot per DECISIONS.md), nothing here maps
to an already-decided later-phase exclusion — Legal capability sits
outside the pilot vertical slice entirely, same as most of Technical
Engineering and Finance, but disposition classification records the
target system design independent of what Phase 0 happens to be building
first (BRD §6.5 dispositions are not phase/sequencing judgments except
where DECISIONS.md already recorded one).

## Acceptance
- [x] All 50 Legal Counsel (Lead) rows (#1219-1268) classified into 5
      trigger-clusters, each as one Configure workflow capability.
- [x] Confirmed `role.legal_counsel_lead` already exists in
      `docs/canonical-role-map.md` — no change needed there.
- [ ] Authority limits (who may sign/finalize each agreement type,
      monetary/risk thresholds for CLO escalation) are the same open PRD
      §8-9 decision as every other role — not re-litigated here.
- [ ] SLA: source `Timing` is "To be confirmed" for all 50 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 50 Legal Counsel (Lead)
  rows — second role batch of the Legal department pass (ticket 0007).
  1 raw label / 40 rows remain in Legal (Contracts & Legal Assistant).
