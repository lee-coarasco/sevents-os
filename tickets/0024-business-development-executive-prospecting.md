---
id: 24
title: "Classify catalogue cluster: Business Development Executive prospecting-to-handover pipeline"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 40 Marketing & Sales rows
carrying "Business Development Executive" as `Who is Responsible`
(#931-970). Third and final batch of the Marketing & Sales department
pass (ticket 0007) — completes Marketing & Sales (120/120 rows). This
role is the most junior/operational layer in the commercial chain,
beneath Marketing Manager (Lead) (ticket 0023) and CMO (ticket 0022):
prospecting, outreach, discovery-meeting support, technical-handover
support and CRM/pipeline hygiene, explicitly barred from making
commercial commitments outside delegated authority.

## Source rows covered

**A. Prospecting and account-planning** — trigger: "the approved account
plan, prospecting cycle, tender alert or market signal requires action."

| S.No. | Work item |
|---|---|
| 931 | Maintain the assigned target-account and prospect list |
| 932 | Research client organisations, decision makers, influencers and project interests |
| 933 | Verify prospect contact details, relevance and communication consent |
| 934 | Identify planned villas, warehouses, retrofit and design-and-build opportunities |
| 935 | Monitor assigned tender portals, notices and invitation sources |
| 936 | Build approved referral, consultant, partner and professional-network relationships |
| 937 | Prepare daily and weekly prospecting, meeting and follow-up plans |
| 938 | Submit new market, client, competitor and opportunity signals to the Marketing Manager |

**B. Outreach and first-response** — trigger: "an assigned prospect or
enquiry reaches the outreach and first-response stage."

| S.No. | Work item |
|---|---|
| 939 | Conduct approved calls, emails, WhatsApp messages, visits and networking outreach |
| 940 | Use only approved scripts, credentials, presentations and company information |
| 941 | Schedule introductory, discovery and follow-up meetings |
| 942 | Record each outreach attempt, response and agreed next action in FirstBit CRM |
| 943 | Respond to assigned enquiries within the approved service level |
| 944 | Collect initial project type, location, scope, budget and timing information |
| 945 | Identify decision makers, approval stakeholders and procurement route |
| 946 | Flag duplicate, unsuitable, suspicious or out-of-strategy enquiries for review |

**C. Discovery meeting and site visit** — trigger: "an approved
discovery meeting or site visit is scheduled."

| S.No. | Work item |
|---|---|
| 947 | Prepare the client and opportunity briefing before each meeting |
| 948 | Conduct the approved discovery meeting and record complete meeting notes |
| 949 | Capture client business need, required service, scope and expected outcome |
| 950 | Confirm indicative budget, target programme, decision date and selection criteria |
| 951 | Coordinate site-visit timing, access, attendance and available documents |
| 952 | Record site access information, photographs, drawings and client-provided evidence |
| 953 | Raise missing-information and clarification requests through the Marketing Manager |
| 954 | Confirm the client's next action, Sevents owner and follow-up date |

**D. Technical handover, proposal and negotiation support** — trigger:
"the opportunity requires technical handover, proposal presentation,
quotation follow-up, negotiation support or written confirmation."

| S.No. | Work item |
|---|---|
| 955 | Support preparation of the qualified-lead handover to Technical Engineering |
| 956 | Follow up missing drawings, briefs, KYC and decision information |
| 957 | Support approved concept, capability, proposal and quotation presentations |
| 958 | Issue only approved and revision-controlled client documents |
| 959 | Record client feedback, questions, objections and clarification requests |
| 960 | Follow up quotation, design-agreement, award and contract decisions |
| 961 | Support negotiations only within CMO-approved boundaries |
| 962 | Convert verbal client commitments into written confirmation and CRM evidence |

**E. CRM/pipeline maintenance and relationship management** — trigger:
"a client interaction, task due date, pipeline cutoff, relationship
review or market observation occurs."

| S.No. | Work item |
|---|---|
| 963 | Maintain current CRM stage, notes, contacts, tasks and next-action dates |
| 964 | Update opportunity probability, value, expected close date and decision status |
| 965 | Report daily and weekly pipeline movement, delays and support requirements |
| 966 | Maintain the approved client relationship and communication cadence |
| 967 | Coordinate client satisfaction, referral and repeat-business discussions |
| 968 | Record no-response, Hold, No-Go and loss reasons accurately |
| 969 | Capture competitor, client, price-position and market intelligence |
| 970 | Protect confidential information and escalate complaints, conflicts or ethical concerns |

All 40 rows: canonical `role.business_development_executive` (already
listed in `docs/canonical-role-map.md`). Shared continuity text
throughout A-E: "A trained authorised Business Development Executive may
provide activity backup using controlled CRM access; client
commitments, pricing, scope, contract, credit and material complaint
decisions escalate to the Marketing Manager or CMO" — the narrowest
delegated-authority boundary of any Marketing & Sales role, consistent
with this being the most junior operational layer.

## Disposition

**Configure workflow** for 39 of 40 rows: each cluster (A-E) is a
bounded, multi-step pipeline — prospecting → outreach → discovery
meeting → technical-handover support → CRM hygiene — with one shared
Output/Evidence per cluster, feeding Marketing Manager (Lead)'s own
pipeline clusters one level up (ticket 0023). Same reasoning applied
throughout this department: 935 ("monitor assigned tender portals...")
and 938 ("submit new market... signals to the Marketing Manager") are
intake/escalation steps within cluster A's pipeline, not standalone
reports, matching how ticket 0023 treated the equivalent Marketing
Manager row 884.

**Periodic review/monitor** for 965 ("report daily and weekly pipeline
movement, delays and support requirements"): the one row that is
explicitly a scheduled reporting output rather than a pipeline step —
same disposition as Marketing Manager (Lead)'s equivalent rows 921/922
in ticket 0023.

## Acceptance
- [x] All 40 Business Development Executive rows (#931-970) classified
      into 5 trigger-clusters with the 1 review/monitor row (965) split
      out from its workflow-heavy siblings.
- [x] Confirmed `role.business_development_executive` already exists in
      `docs/canonical-role-map.md` — no change needed there.
- [x] Marketing & Sales department now fully classified: 120/120 rows
      across 3 roles (tickets 0022-0024).
- [ ] SLA: source `Timing` is "To be confirmed" for all 40 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 40 Business Development
  Executive rows — third and final role in Marketing & Sales. Department
  complete (120/120 rows, tickets 0022-0024). Next department per ticket
  0007's table: People & Culture (98 rows, not started).
