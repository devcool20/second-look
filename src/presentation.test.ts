import { describe, it, expect } from "vitest";
import { fixtures } from "./data";
import { assess } from "./domain";
import { explainHold, workflowSummary } from "./presentation";

describe("employee-facing guidance", () => {
  it("does not confuse an invalid repair amount with turnaround", () => {
    expect(
      explainHold(
        "Repair cost: enter a valid non-negative amount (up to ₹10,00,000).",
      ).issue,
    ).toBe("Repair cost needs an amount");
    expect(explainHold("Record a repair turnaround of 1–365 days.").issue).toBe(
      "Repair turnaround is missing",
    );
    const r = fixtures()[2];
    expect(
      assess(r).blockers.filter((b) => b.startsWith("Repair")),
    ).toHaveLength(1);
  });
  it("separates recorded checks, held records and price readiness", () => {
    const held = fixtures()[1];
    expect(held.status).toBe("Held");
    expect(workflowSummary(held)).toEqual({
      inspection: "Evidence needs review",
      price: "Within ceiling",
      next: "Ask seller to remove account lock",
    });
    expect(workflowSummary(fixtures()[2]).next).toBe(
      "Get a technician estimate",
    );
  });
  it("keeps technical constraints out of queue actions", () => {
    for (const r of fixtures())
      expect(workflowSummary(r).next).not.toMatch(
        /1–365|non-negative|DEMO-|valid/,
      );
  });
  it("gives every blocker a next action and a section", () => {
    for (const r of fixtures())
      for (const b of assess(r).blockers) {
        const g = explainHold(b);
        expect(g.issue.length).toBeGreaterThan(5);
        expect(g.action.length).toBeGreaterThan(15);
        expect([0, 1, 2]).toContain(g.step);
      }
  });
  it("retains financial status from final snapshot when current estimates differ", () => {
    const r = fixtures()[3];
    r.resaleDate = "2000-01-01";
    expect(workflowSummary(r).price).toBe("Within ceiling");
  });
});
