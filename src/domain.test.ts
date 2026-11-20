import { describe, expect, it } from "vitest";
import { assess, decide, paise } from "./domain";
import { fixtures, load, save, STORAGE_KEY } from "./data";

describe("purchase decisions", () => {
  it("unknown selling costs never use a retained estimate or a zero to permit buying", () => {
    const r = fixtures()[0];
    r.otherCostUnknown = true;
    expect(assess(r).kind).toBe("Hold");
    expect(assess(r).ceiling).toBeNull();
    expect(() => decide(r, "Bought", "Ignore missing costs")).toThrow();
    const held = decide(r, "Held", "Get selling cost estimate");
    expect(held.decision!.evidence.otherCostUnknown).toBe(true);
    r.otherCostUnknown = false;
    expect(assess(r).kind).toBe("Buy candidate");
  });
  it("uses exact paise and rejects invalid amounts", () => {
    expect(paise("1200.01")).toBe(120001);
    for (const value of [
      "",
      "-1",
      "NaN",
      "Infinity",
      "1e3",
      "1.001",
      "1000001",
    ])
      expect(paise(value)).toBeNull();
  });
  it("accepts the exact ceiling, but not one paise above", () => {
    const r = fixtures()[0];
    r.money.asking = "18500";
    expect(assess(r).ceiling).toBe(1850000);
    expect(assess(r).kind).toBe("Buy candidate");
    r.money.asking = "18500.01";
    expect(assess(r).kind).toBe("Decline at current price");
    r.money.agreed = "18500";
    expect(decide(r, "Bought", "Negotiated within ceiling").status).toBe(
      "Bought",
    );
    r.money.agreed = "18500.01";
    expect(() => decide(r, "Bought", "Too high")).toThrow();
  });
  it("unknown evidence invalidates a previously favourable assessment", () => {
    const r = fixtures()[0];
    expect(assess(r).kind).toBe("Buy candidate");
    r.observations.lock = {
      result: "unknown",
      note: "Account removal pending",
    };
    expect(assess(r).kind).toBe("Hold");
    expect(() => decide(r, "Bought", "Attempt")).toThrow();
  });
  it("holds incomplete or unsafe evidence", () => {
    for (const field of ["liquid", "seriousBattery"] as const) {
      const r = fixtures()[0];
      r[field] = true;
      expect(assess(r).kind).toBe("Hold");
    }
    const r = fixtures()[0];
    r.observations.camera.result = "";
    expect(assess(r).kind).toBe("Hold");
  });
  it("requires repair cost, observed issue notes and turnaround", () => {
    const r = fixtures()[2];
    expect(assess(r).kind).toBe("Hold");
    r.money.repair = "1000";
    expect(assess(r).kind).toBe("Hold");
    r.turnaround = "2";
    expect(assess(r).kind).toBe("Buy candidate");
    r.observations.screen.note = "";
    expect(assess(r).kind).toBe("Hold");
  });
  it("requires explicit zero costs and valid optional battery readings", () => {
    const r = fixtures()[0];
    r.money.other = "";
    expect(assess(r).kind).toBe("Hold");
    r.money.other = "0";
    expect(assess(r).kind).toBe("Buy candidate");
    r.batteryHealth = "90";
    expect(assess(r).kind).toBe("Hold");
    r.batterySource = "Demo settings";
    expect(assess(r).kind).toBe("Buy candidate");
    r.batteryHealth = "101";
    expect(assess(r).kind).toBe("Hold");
  });
  it("requires dated sources and uses a seven-calendar-day window", () => {
    const now = new Date("2026-11-19T12:00:00");
    const r = fixtures()[0];
    r.resaleDate = "2026-11-12";
    expect(assess(r, now).kind).toBe("Buy candidate");
    for (const date of ["2026-11-11", "2026-11-20", "2026-02-30", ""]) {
      r.resaleDate = date;
      expect(assess(r, now).kind).toBe("Hold");
    }
    r.resaleDate = "2026-11-19";
    r.resaleSource = "";
    expect(assess(r, now).kind).toBe("Hold");
  });
  it("prevents invalid purchases, including non-positive ceilings", () => {
    const r = fixtures()[0];
    r.money.resale = "0";
    expect(assess(r).kind).toBe("Decline at current price");
    expect(() => decide(r, "Bought", "Bad economics")).toThrow();
    expect(() => decide(r, "Held", "")).toThrow();
  });
  it("retains an independent snapshot and makes final records immutable", () => {
    const r = fixtures()[0];
    const bought = decide(r, "Bought", "Evidence complete");
    r.money.resale = "999";
    expect(bought.decision!.evidence.money.resale).toBe("23000");
    expect(() => decide(bought, "Held", "Try again")).toThrow();
  });
});
describe("local persistence", () => {
  function memory() {
    let raw: string | null = null;
    return {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    };
  }
  it("preserves the final snapshot across reload", () => {
    const storage = memory();
    const records = fixtures();
    save(storage, records);
    expect(load(storage)).toEqual(records);
  });
  it("preserves a resumed and re-held decision across reload", () => {
    const storage = memory();
    const held = decide(fixtures()[1], "Held", "Still awaiting evidence");
    save(storage, [held]);
    expect(load(storage)).toEqual([held]);
  });
  it("rejects corrupt and wrong-version records without writing", () => {
    let writes = 0;
    const storage = {
      getItem: () => "{broken",
      setItem: () => {
        writes++;
      },
    };
    expect(() => load(storage)).toThrow();
    expect(writes).toBe(0);
    expect(() =>
      load({ getItem: () => JSON.stringify({ version: 2, records: [] }) }),
    ).toThrow();
    const records = fixtures();
    records[0].observations.lock.result = "bad" as never;
    expect(() =>
      load({ getItem: () => JSON.stringify({ version: 1, records }) }),
    ).toThrow();
  });
  it("surfaces storage failures instead of reporting success", () => {
    expect(() =>
      save(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        fixtures(),
      ),
    ).toThrow("quota");
    expect(
      load({ getItem: (key) => (key === STORAGE_KEY ? null : "unexpected") }),
    ).toBeNull();
  });
});
