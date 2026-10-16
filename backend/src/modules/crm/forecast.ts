import type { Opportunity } from "./types.js";

/**
 * Ticket 0092 (M10c): plain rollup over whatever's already in the
 * pipeline — no forecasting/ML model. "weighted pipeline value" is
 * sum(expected_value * probability) grouped by stage, owner, or
 * due-date window (calendar month), exactly the three groupings the
 * ticket names. Pure function, no repository access, same
 * "no mocked client" pattern as ticket 0078's filterAndPaginate.
 */
export type ForecastGroupBy = "stage" | "owner" | "dueDateWindow";

export const FORECAST_GROUP_BY_VALUES: ForecastGroupBy[] = ["stage", "owner", "dueDateWindow"];

export interface ForecastGroup {
  key: string;
  opportunityCount: number;
  totalExpectedValue: number;
  weightedValue: number;
}

export interface PipelineForecast {
  groupBy: ForecastGroupBy;
  groups: ForecastGroup[];
  totals: { opportunityCount: number; totalExpectedValue: number; weightedValue: number };
}

const NO_DUE_DATE_KEY = "no_due_date";

function dueDateWindowKey(dueDate: string | null): string {
  if (!dueDate) return NO_DUE_DATE_KEY;
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return NO_DUE_DATE_KEY;
  return parsed.toISOString().slice(0, 7);
}

function groupKeyFor(opportunity: Opportunity, groupBy: ForecastGroupBy): string {
  if (groupBy === "stage") return opportunity.stage;
  if (groupBy === "owner") return opportunity.owner_id;
  return dueDateWindowKey(opportunity.due_date);
}

export function computePipelineForecast(opportunities: Opportunity[], groupBy: ForecastGroupBy): PipelineForecast {
  const groups = new Map<string, { opportunityCount: number; totalExpectedValue: number; weightedValue: number }>();

  for (const opportunity of opportunities) {
    const key = groupKeyFor(opportunity, groupBy);
    const expectedValue = opportunity.expected_value ?? 0;
    const weightedValue = expectedValue * ((opportunity.probability ?? 0) / 100);
    const existing = groups.get(key) ?? { opportunityCount: 0, totalExpectedValue: 0, weightedValue: 0 };
    existing.opportunityCount += 1;
    existing.totalExpectedValue += expectedValue;
    existing.weightedValue += weightedValue;
    groups.set(key, existing);
  }

  const sortedGroups = [...groups.entries()]
    .map(([key, totals]) => ({ key, ...totals }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const totals = sortedGroups.reduce(
    (acc, group) => ({
      opportunityCount: acc.opportunityCount + group.opportunityCount,
      totalExpectedValue: acc.totalExpectedValue + group.totalExpectedValue,
      weightedValue: acc.weightedValue + group.weightedValue,
    }),
    { opportunityCount: 0, totalExpectedValue: 0, weightedValue: 0 },
  );

  return { groupBy, groups: sortedGroups, totals };
}
