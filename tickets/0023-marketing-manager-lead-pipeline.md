---
id: 23
title: "Classify catalogue cluster: Marketing Manager (Lead) campaign and lead pipeline"
status: done
roles: [architect]
priority: 2
created: 2026-10-14
updated: 2026-10-14
---

Phase 0 catalogue classification for all 50 Marketing & Sales rows
carrying "Marketing Manager (Lead)" as `Who is Responsible` (#881-930).
Second batch of the Marketing & Sales department pass (ticket 0007).
This role is the operational layer beneath CMO (ticket 0022) — same
shape as Senior Accountant (Lead)/ticket 0017 and Legal Counsel
(Lead)/ticket 0020: it runs the marketing/lead/proposal-coordination
pipeline the CXO approves into, so it skews to Configure workflow with a
small review/monitor split for explicitly scheduled reporting rows.

## Source rows covered

**A. Market research and operating-plan preparation** — trigger: "the
planning cycle, market change, campaign request or new opportunity
source requires analysis."

| S.No. | Work item |
|---|---|
| 881 | Research construction-market sectors, demand, client needs and opportunity trends |
| 882 | Maintain competitor, pricing-position, service and market-intelligence records |
| 883 | Build and maintain the target-account and market-segment database |
| 884 | Monitor tender portals, referrals, networks and opportunity sources |
| 885 | Prepare the annual and quarterly Marketing & Sales operating plan |
| 886 | Maintain the campaign, content, event and client-engagement calendar |
| 887 | Prepare campaign briefs with audience, message, budget, channel and KPI |
| 888 | Coordinate approved marketing-spend commitments with Procurement and Finance |

**B. Brand, content and campaign execution** — trigger: "an approved
content, campaign, event, website, social-media or supplier activity
becomes due."

| S.No. | Work item |
|---|---|
| 889 | Maintain brand guidelines and the controlled marketing-asset library |
| 890 | Prepare the content plan and production schedule |
| 891 | Prepare approved project credentials, case studies and reference material |
| 892 | Maintain company profiles, capability statements and prequalification content |
| 893 | Maintain approved website service, project and contact information |
| 894 | Maintain the approved social-media publishing calendar |
| 895 | Execute approved digital, email, social, print and direct-marketing campaigns |
| 896 | Coordinate exhibitions, industry events, client visits and promotional activities |
| 897 | Coordinate approved agencies, designers, photographers, media and marketing suppliers |
| 898 | Control content approval, client consent, copyright and publication evidence |

**C. Enquiry intake and lead qualification** — trigger: "a new enquiry,
referral, tender invitation, campaign response, portal lead or
repeat-client opportunity arrives."

| S.No. | Work item |
|---|---|
| 899 | Monitor email, phone, WhatsApp, website, social, portal, referral and repeat-client enquiries |
| 900 | Register each enquiry in FirstBit CRM and assign a unique Lead ID |
| 901 | Identify and merge duplicate client, contact and opportunity records |
| 902 | Record campaign, channel, referral and lead-source attribution |
| 903 | Collect client identity, contact, KYC and communication-consent information |
| 904 | Collect client brief, drawings, photographs, location and available site information |
| 905 | Qualify service need, scope, budget, timing, stakeholders and decision process |
| 906 | Apply the approved lead score, status, priority and qualification outcome |
| 907 | Acknowledge the enquiry and communicate the controlled next action |
| 908 | Assign the qualified lead to the Business Development Executive with response SLA |

**D. Technical handover and proposal coordination** — trigger: "a
qualified lead is ready for technical review, site assessment, concept,
design offer or construction quotation."

| S.No. | Work item |
|---|---|
| 909 | Complete the qualified-lead checklist and controlled handover pack |
| 910 | Create the FirstBit technical pre-assessment handover task for the CTO |
| 911 | Track CTO acceptance, return, clarification and technical-owner assignment |
| 912 | Coordinate site-visit access, client attendance and requirement confirmation |
| 913 | Maintain the client clarification, requirement and decision log |
| 914 | Coordinate the preliminary concept and indicative-budget presentation |
| 915 | Coordinate the CTO-approved detailed-design quotation or agreement process |
| 916 | Coordinate release of the CTO-approved construction quotation and commercial offer |
| 917 | Control proposal revisions, assumptions, exclusions and client-facing versions |
| 918 | Coordinate client feedback and approved technical or commercial clarifications |

**E. Pipeline management, forecasting and award handover** — trigger:
"a CRM update, daily follow-up, weekly forecast, client decision, award
or post-interaction review becomes due."

| S.No. | Work item |
|---|---|
| 919 | Maintain opportunity stage, probability, value, expected close date and next action |
| 920 | Review daily overdue lead, proposal and client-follow-up actions |
| 921 | Prepare the weekly pipeline, conversion and revenue forecast |
| 922 | Prepare campaign, funnel, lead-source and conversion-performance reporting |
| 923 | Maintain controlled pre-contract client communication and approval evidence |
| 924 | Coordinate proposal presentations and negotiation meetings |
| 925 | Capture written client approval, letter of intent, award and decision evidence |
| 926 | Hand won opportunities to Legal, Finance and Technical Engineering |
| 927 | Track contract and financial-activation status before downstream release |
| 928 | Record Hold, No-Go and lost opportunities with standard reason codes |
| 929 | Perform win-loss analysis and maintain corrective-action records |
| 930 | Coordinate client satisfaction, referral and repeat-opportunity follow-up |

All 50 rows: canonical `role.marketing_manager_lead` (already listed in
`docs/canonical-role-map.md`). Shared continuity text throughout A-E: "A
competent authorised marketing professional may provide operational
backup; CMO approvals remain reserved and material brand, spend, client,
pipeline, privacy or proposal exceptions escalate to the CMO" —
operational-role continuity language, distinct from the CMO's own
reserved-decision/delegate language in ticket 0022.

## Disposition

**Configure workflow** for 46 of 50 rows (all of A-D, plus 919, 923-928,
930 in E): each cluster is a bounded, multi-step pipeline with a
sequential intake → preparation/coordination → output → handoff shape
and one shared Output/Evidence per cluster — same
multi-step-pipeline-with-downstream-recipient pattern used for Senior
Accountant (Lead) (ticket 0017), Legal Counsel (Lead) (ticket 0020) and
Contracts & Legal Assistant (ticket 0021). This includes 884 ("monitor
tender portals... opportunity sources" — ongoing environmental scanning
feeding the plan output, not a scheduled report) and 899 ("monitor
email, phone, WhatsApp... enquiries" — inbox-triage intake, not a
reporting action), both kept as workflow for the same reason ticket
0018 kept the Accountant's data-entry rows as workflow despite
monitor-flavoured verbs.

**Periodic review/monitor** for 920, 921, 922, 929: four rows that are
explicitly scheduled review/reporting outputs rather than pipeline
steps — "review daily overdue lead... actions" (920), "prepare the
weekly pipeline... forecast" (921, same disposition as CMO's row 871
one level up), "prepare campaign, funnel... performance reporting"
(922, same as CMO's 872/873), and "perform win-loss analysis... records"
(929, an analytical reporting output, not a pipeline step with a further
consumer). Same per-row split discipline as every "Lead"/operational
role classified so far.

## Acceptance
- [x] All 50 Marketing Manager (Lead) rows (#881-930) classified into 5
      trigger-clusters with the 4 review/monitor rows (920-922, 929)
      split out from their workflow-heavy siblings.
- [x] Confirmed `role.marketing_manager_lead` already exists in
      `docs/canonical-role-map.md` — no change needed there.
- [ ] Authority limits (response SLAs, lead-assignment rules,
      spend-approval thresholds) are the same open PRD §8-9 decision as
      every other role — not re-litigated here.
- [ ] SLA: source `Timing` is "To be confirmed" for all 50 rows — `TBD`.

## Progress
- 2026-10-14: Architect session. Classified all 50 Marketing Manager
  (Lead) rows — second role batch of the Marketing & Sales department
  pass (ticket 0007). 1 raw label / 40 rows remain in Marketing & Sales
  (Business Development Executive).
