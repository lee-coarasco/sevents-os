---
id: 134
title: Shared <CurrencyInput> / <CurrencyDisplay> components
status: next
roles: [ui-designer, test-engineer]
priority: 3
created: 2026-10-17
updated: 2026-10-17
---

Split from ticket 0111 (see DECISIONS.md). CLAUDE.md's shared-component
table lists these for "any monetary value." Several existing screens
already render/edit money ad hoc (CRM opportunity `expected_value`,
estimate line amounts, tender submission values) with plain number
inputs/plain text — survey those call sites first, then build the two
components and migrate at least the ones already built.

Remember CLAUDE.md's standing rule: VAT/tax is not in scope here and must
never be assumed or defaulted — this is pure amount formatting/input
(currency code + numeric value), not a tax calculator. Currency code
itself has no system-wide default yet (no localization-pack concept has
been built) — take it as an explicit prop, never hard-code "AED" or any
other code into the component.

## Acceptance
- [ ] `frontend/src/components/CurrencyInput.tsx` — numeric input +
  explicit currency-code prop, sane thousands-separator display while not
  focused, plain numeric editing while focused.
- [ ] `frontend/src/components/CurrencyDisplay.tsx` — read-only formatted
  render of an amount + currency code.
- [ ] At least the CRM opportunity `expected_value` field and estimate
  line amounts migrated onto these.
- [ ] Tests.

## Progress
