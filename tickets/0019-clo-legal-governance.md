---
id: 19
title: "Classify catalogue cluster: CLO legal governance and approval chain"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 30 Legal rows carrying "Chief
Legal Officer (CLO)" as `Who is Responsible` (#1189-1218). First batch
of the Legal department pass (ticket 0007) — the second department
(after Finance) where the CXO row skews heavily toward
Configure approval/decision, same pattern as CFO (ticket 0016), but with
a larger reporting/advisory slice given how many Legal rows use "oversee,"
"review," "advise," "chair," "present" and "sponsor" rather than "approve."

## Source rows covered

**A. Legal strategy and control framework** — trigger: "the annual
planning cycle, policy review, authority change or material legal-control
issue requires direction."

| S.No. | Work item |
|---|---|
| 1189 | Set Legal strategy, policies and annual operating objectives |
| 1190 | Define legal risk appetite, materiality thresholds and escalation criteria |
| 1191 | Approve Legal Delegation of Authority and reserved-matter matrix |
| 1192 | Approve contract standards, clause library and deviation controls |
| 1193 | Approve matter classification, confidentiality, privilege and access controls |

**B. Client/commercial contract legal gate** — trigger: "a tender, client
award, material contract, subcontract or strategic agreement reaches the
legal approval gate."

| S.No. | Work item |
|---|---|
| 1194 | Approve legal review strategy for client construction and design contracts |
| 1195 | Approve tender qualifications, exclusions and legal risk positions |
| 1196 | Approve material client contract deviations before signature |
| 1197 | Approve material supplier, subcontract and consultancy contract deviations |
| 1198 | Approve joint venture, consortium, partnership, MOU and NDA positions |

**C. Claims, dispute and proceedings authority** — trigger: "a claim
event, adverse notice, unresolved dispute, settlement proposal or formal
proceeding requires legal authority."

| S.No. | Work item |
|---|---|
| 1199 | Approve contractual notice and claim strategy |
| 1200 | Approve variation, extension-of-time and delay-claim legal positions |
| 1201 | Approve dispute escalation, without-prejudice negotiation and settlement strategy |
| 1202 | Approve litigation, arbitration and expert-determination strategy |
| 1203 | Appoint and direct external counsel, experts and claims advisers |

**D. Compliance, regulatory and investigation matters** — trigger: "a
licence, corporate-authority, regulatory, investigation, privacy,
intellectual-property or compliance matter becomes due or material."

| S.No. | Work item |
|---|---|
| 1204 | Oversee corporate licences, registrations, permits and renewals |
| 1205 | Approve corporate authorities, powers of attorney and signatory controls |
| 1206 | Review the legal compliance register and material regulatory obligations |
| 1207 | Direct internal investigations, whistleblowing and fraud-related legal response |
| 1208 | Approve data privacy, intellectual property, brand and confidentiality legal controls |

**E. Project legal gate** — trigger: "a contract-activation, security,
default, termination, final-account or project-risk decision reaches the
Legal gate."

| S.No. | Work item |
|---|---|
| 1209 | Approve the contract-activation legal gate and project legal handover |
| 1210 | Approve insurance, bond, guarantee, security and indemnity legal positions |
| 1211 | Approve suspension, default, termination and step-in strategies |
| 1212 | Approve final-account, release, retention and defects-liability-period legal closeout |
| 1213 | Advise the CEO on material liability, compliance, client and counterparty exposure |

**F. Weekly/monthly review, budget and continuity** — trigger: "the
weekly/monthly review, budget cycle, absence, access failure, control gap
or improvement need occurs."

| S.No. | Work item |
|---|---|
| 1214 | Chair the weekly legal deadline, claim and exception review |
| 1215 | Present the monthly Legal dashboard, exposure report and corrective actions |
| 1216 | Approve the Legal budget and external-counsel fee strategy |
| 1217 | Approve Legal delegation, backup, continuity and records-recovery arrangements |
| 1218 | Sponsor legal templates, training, workflow and control improvements |

All 30 rows: canonical `role.clo` (already listed in
`docs/canonical-role-map.md`'s Legal section). Shared escalation throughout A-F: "A CEO-approved qualified legal delegate
may coordinate routine matters, but material deviations, settlements,
proceedings, termination, regulatory response and reserved legal
decisions remain with the CLO or escalate under the Delegation of
Authority" — same reserved-decision pattern as CFO (ticket 0016) and CTO
(ticket 0008).

## Disposition

**Configure approval/decision** for 24 of 30 rows (all of A-E except
1204, 1206, 1213): each has a named approver (CLO), a bounded trigger and
a recorded outcome ("approved legal strategy," "approved legal review
strategy," "approved notice/claim/dispute/settlement," "approved project
legal position," etc.) with no further recurring task — matches BRD
§6.5's approval/decision definition and the shared Output/Evidence text
each cluster carries. This includes 1203 ("appoint and direct external
counsel") and 1207 ("direct internal investigations"): despite the
action-style verb, both produce the same bounded, recorded
decision/authority-record outcome as their cluster siblings, not an
ongoing multi-step workflow.

**Periodic review/monitor** for 1204, 1206, 1213, 1214, 1215, 1218: six
rows that are explicitly oversight/reporting/sponsorship actions rather
than bounded decisions — "oversee corporate licences... and renewals"
(1204, continuous administrative oversight, not a single approval event),
"review the legal compliance register" (1206), "advise the CEO on
material... exposure" (1213, an advisory output, not an approval — same
distinction as CFO's row 735 "report... to the CEO"), "chair the weekly
legal deadline... review" (1215) and "present the monthly Legal
dashboard" (1215), and "sponsor legal templates, training, workflow and
control improvements" (1218, an ongoing improvement programme, not a
bounded decision). Same per-row split discipline as ticket 0016's
735/742/748 split out of the CFO cluster.

Legal has a larger review/monitor share (6/30) than CFO (3/30) because
more Legal rows use oversight/advisory verbs ("oversee," "review,"
"advise," "chair," "present," "sponsor") rather than "approve" — a
feature of this role's source text, not an inconsistency in applying the
same disposition test.

## Acceptance
- [x] All 30 CLO rows (#1189-1218) classified into 6 trigger-clusters
      with the 6 review/monitor rows (1204, 1206, 1213, 1214, 1215, 1218)
      split out from their decision-heavy siblings.
- [x] Confirmed `role.clo` already exists in `docs/canonical-role-map.md`
      (Legal department section) — no change needed there.
- [ ] Authority limits/signatory/delegation values referenced throughout
      (1191, 1205, 1216, 1217) are the same open PRD §8-9 decision as
      every other role — not re-litigated here.
- [ ] SLA: source `Timing` is "To be confirmed" for all 30 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 30 CLO rows — first role
  batch of the Legal department pass (ticket 0007). 2 raw labels / 90
  rows remain in Legal (Legal Counsel (Lead), Contracts & Legal
  Assistant).
