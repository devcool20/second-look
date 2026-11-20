import {
  checks,
  decide,
  newInspection,
  today,
  type Inspection,
} from "./domain";
export function fixtures(): Inspection[] {
  const models = [
    "iPhone 13",
    "Samsung Galaxy S22",
    "Google Pixel 7",
    "iPhone 12",
    "OnePlus 10R",
    "Samsung Galaxy A54",
  ];
  const records = models.map((model, i) => {
    const r = newInspection();
    Object.assign(r, {
      id: `seed-${i}`,
      reference: `DEMO-010${i + 1}`,
      model,
      storage: i === 1 ? "256 GB" : "128 GB",
      inspector: i % 2 ? "Inspector B (demo)" : "Inspector A (demo)",
      cosmetic: "Light surface scratches",
      resaleSource: "Synthetic comparison price — manually created",
      resaleDate: today(),
      activeSeconds: 240 + i * 48,
    });
    r.money = {
      asking: "16000",
      resale: "23000",
      repair: "0",
      other: "500",
      profit: "3000",
      reserve: "1000",
      agreed: "16000",
    };
    for (const c of checks) r.observations[c.id] = { result: "pass", note: "" };
    return r;
  });
  records[1].observations.lock = {
    result: "unknown",
    note: "Seller has not removed the account lock in this synthetic example.",
  };
  records[1] = decide(
    records[1],
    "Held",
    "Await account removal and repeat the check.",
  );
  records[2].observations.screen = {
    result: "issue",
    note: "A dead touch strip on the right edge.",
  };
  records[2].money.repair = "";
  records[2].turnaround = "";
  records[3] = decide(
    records[3],
    "Bought",
    "All checks recorded; agreed price is within the ceiling.",
  );
  records[4].money.asking = "24000";
  records[4] = decide(
    records[4],
    "Declined",
    "Asking price exceeds our purchase ceiling.",
  );
  records[5].observations.battery = { result: "", note: "" };
  records[5].observations.camera = { result: "", note: "" };
  return records;
}
export const STORAGE_KEY = "swavid.inspections.v1";
function isRecord(value: unknown, snapshot = false): value is Inspection {
  if (!value || typeof value !== "object") return false;
  const r = value as Inspection;
  if (
    !["Draft", "Held", "Bought", "Declined"].includes(r.status) ||
    !Number.isFinite(r.activeSeconds) ||
    r.activeSeconds < 0
  )
    return false;
  const strings = [
    "id",
    "reference",
    "model",
    "storage",
    "inspector",
    "updatedAt",
    "sellerHistory",
    "cosmetic",
    "batteryHealth",
    "batterySource",
    "resaleSource",
    "resaleDate",
    "turnaround",
  ] as const;
  if (
    strings.some((k) => typeof r[k] !== "string") ||
    Number.isNaN(Date.parse(r.updatedAt))
  )
    return false;
  if (
    typeof r.liquid !== "boolean" ||
    typeof r.seriousBattery !== "boolean" ||
    (r.otherCostUnknown !== undefined &&
      typeof r.otherCostUnknown !== "boolean") ||
    !r.money ||
    !r.observations
  )
    return false;
  if (
    ["asking", "resale", "repair", "other", "profit", "reserve", "agreed"].some(
      (k) => typeof r.money[k as keyof Inspection["money"]] !== "string",
    )
  )
    return false;
  if (
    checks.some(
      (c) =>
        !r.observations[c.id] ||
        !["", "pass", "issue", "unknown"].includes(
          r.observations[c.id].result,
        ) ||
        typeof r.observations[c.id].note !== "string",
    )
  )
    return false;
  if (r.decision) {
    const d = r.decision;
    if (
      !["Held", "Bought", "Declined"].includes(d.kind) ||
      typeof d.reason !== "string" ||
      d.kind !== r.status ||
      typeof d.at !== "string" ||
      Number.isNaN(Date.parse(d.at)) ||
      !d.assessment ||
      !["Hold", "Decline at current price", "Buy candidate"].includes(
        d.assessment.kind,
      ) ||
      !(
        d.assessment.ceiling === null ||
        Number.isSafeInteger(d.assessment.ceiling)
      ) ||
      !Number.isInteger(d.assessment.completed) ||
      d.assessment.completed < 0 ||
      d.assessment.completed > checks.length ||
      !Array.isArray(d.assessment.blockers) ||
      !d.assessment.blockers.every((item) => typeof item === "string") ||
      !Array.isArray(d.assessment.warnings) ||
      !d.assessment.warnings.every((item) => typeof item === "string") ||
      !d.evidence ||
      d.evidence.id !== r.id ||
      !isRecord({ ...d.evidence, decision: undefined }, true)
    )
      return false;
  }
  return (
    snapshot ||
    !["Bought", "Declined", "Held"].includes(r.status) ||
    !!r.decision
  );
}
export function load(storage: Pick<Storage, "getItem">): Inspection[] | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1 ||
    !("records" in value) ||
    !Array.isArray(value.records) ||
    !value.records.every((item) => isRecord(item)) ||
    new Set(value.records.map((r) => r.id)).size !== value.records.length
  )
    throw new Error("Saved data could not be read. It has not been replaced.");
  return value.records;
}
export function save(storage: Pick<Storage, "setItem">, records: Inspection[]) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records }));
}
