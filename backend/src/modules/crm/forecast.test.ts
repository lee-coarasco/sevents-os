import { describe, expect, it } from "vitest";
import { computePipelineForecast } from "./forecast.js";
import type { Opportunity } from "./types.js";

function opportunity(overrides: Partial<Opportunity>): Opportunity {
  return {
    id: "opp-1",
    tenant_id: "tenant-a",
    client_id: "client-1",
    title: "Test",
    source: "referral",
    owner_id: "owner-1",
    stage: "lead",
    expected_value: null,
    probability: null,
    next_action: null,
    due_date: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    handover_completed_at: null,
    handover_completed_by: null,
    ...overrides,
  };
}

describe("computePipelineForecast", () => {
  it("groups by stage and computes weighted value = expected_value * probability", () => {
    const forecast = computePipelineForecast(
      [
        opportunity({ id: "1", stage: "lead", expected_value: 100000, probability: 50 }),
        opportunity({ id: "2", stage: "lead", expected_value: 200000, probability: 25 }),
        opportunity({ id: "3", stage: "won", expected_value: 50000, probability: 100 }),
      ],
      "stage",
    );

    expect(forecast.groupBy).toBe("stage");
    const lead = forecast.groups.find((g) => g.key === "lead")!;
    expect(lead.opportunityCount).toBe(2);
    expect(lead.totalExpectedValue).toBe(300000);
    expect(lead.weightedValue).toBe(50000 + 50000);

    const won = forecast.groups.find((g) => g.key === "won")!;
    expect(won.weightedValue).toBe(50000);

    expect(forecast.totals.opportunityCount).toBe(3);
    expect(forecast.totals.totalExpectedValue).toBe(350000);
  });

  it("groups by owner", () => {
    const forecast = computePipelineForecast(
      [
        opportunity({ id: "1", owner_id: "owner-a", expected_value: 100000, probability: 50 }),
        opportunity({ id: "2", owner_id: "owner-b", expected_value: 100000, probability: 50 }),
      ],
      "owner",
    );

    expect(forecast.groups.map((g) => g.key).sort()).toEqual(["owner-a", "owner-b"]);
  });

  it("groups by due-date window (calendar month), with a no_due_date bucket for null/invalid dates", () => {
    const forecast = computePipelineForecast(
      [
        opportunity({ id: "1", due_date: "2026-11-05", expected_value: 100000, probability: 100 }),
        opportunity({ id: "2", due_date: "2026-11-20", expected_value: 100000, probability: 100 }),
        opportunity({ id: "3", due_date: null }),
      ],
      "dueDateWindow",
    );

    const november = forecast.groups.find((g) => g.key === "2026-11")!;
    expect(november.opportunityCount).toBe(2);
    const noDueDate = forecast.groups.find((g) => g.key === "no_due_date")!;
    expect(noDueDate.opportunityCount).toBe(1);
  });

  it("treats a null expected_value or probability as zero rather than throwing", () => {
    const forecast = computePipelineForecast([opportunity({ expected_value: null, probability: null })], "stage");

    expect(forecast.groups[0]!.totalExpectedValue).toBe(0);
    expect(forecast.groups[0]!.weightedValue).toBe(0);
  });

  it("returns an empty group list for no opportunities", () => {
    const forecast = computePipelineForecast([], "stage");

    expect(forecast.groups).toHaveLength(0);
    expect(forecast.totals).toEqual({ opportunityCount: 0, totalExpectedValue: 0, weightedValue: 0 });
  });
});
