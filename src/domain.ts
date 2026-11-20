export const checks = [
  {
    id: "ownership",
    title: "Identity & ownership evidence",
    instruction:
      "Compare the fictional device reference with the supplied demo ownership record. This is not theft verification.",
    critical: true,
  },
  {
    id: "lock",
    title: "Account lock & reset readiness",
    instruction:
      "Confirm the demo device is signed out and ready to reset. Do not record account credentials.",
    critical: true,
  },
  {
    id: "screen",
    title: "Screen & touch",
    instruction:
      "Observe the display and test touch across the screen. Note dead areas, lines or cracks.",
    critical: false,
  },
  {
    id: "body",
    title: "Body & liquid indicators",
    instruction:
      "Observe external damage and any visible liquid indicator. Do not open the device. Record suspected liquid damage separately below.",
    critical: false,
  },
  {
    id: "battery",
    title: "Charging & battery",
    instruction:
      "Observe normal charging. If swelling or a serious battery concern is present, stop inspection and refer to a technician.",
    critical: false,
  },
  {
    id: "camera",
    title: "Cameras & audio",
    instruction:
      "Check front/rear cameras, microphone and speaker with a short test.",
    critical: false,
  },
  {
    id: "operation",
    title: "Buttons, connectivity & operation",
    instruction:
      "Check physical buttons, Wi-Fi and basic operation. Note intermittent behaviour.",
    critical: false,
  },
] as const;
export type CheckId = (typeof checks)[number]["id"];
export type Result = "" | "pass" | "issue" | "unknown";
export type Status = "Draft" | "Held" | "Bought" | "Declined";
export type MoneyKey =
  "asking" | "resale" | "repair" | "other" | "profit" | "reserve" | "agreed";
export const moneyLabels: Record<MoneyKey, string> = {
  asking: "Seller asking price",
  resale: "Expected resale price",
  repair: "Repair cost",
  other: "Other selling costs",
  profit: "Target profit",
  reserve: "Risk reserve",
  agreed: "Agreed purchase price",
};
export interface Inspection {
  id: string;
  reference: string;
  model: string;
  storage: string;
  inspector: string;
  status: Status;
  updatedAt: string;
  activeSeconds: number;
  sellerHistory: string;
  observations: Record<CheckId, { result: Result; note: string }>;
  cosmetic: string;
  liquid: boolean;
  seriousBattery: boolean;
  batteryHealth: string;
  batterySource: string;
  money: Record<MoneyKey, string>;
  resaleSource: string;
  resaleDate: string;
  turnaround: string;
  otherCostUnknown?: boolean;
  decision?: {
    kind: Exclude<Status, "Draft">;
    reason: string;
    at: string;
    assessment: Assessment;
    evidence: Omit<Inspection, "decision">;
  };
}
export interface Assessment {
  kind: "Hold" | "Decline at current price" | "Buy candidate";
  blockers: string[];
  warnings: string[];
  ceiling: number | null;
  completed: number;
}
export function today(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function paise(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, decimal = ""] = value.trim().split(".");
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(result) && result <= 100_000_000 ? result : null;
}
export const inr = (amount: number | null) =>
  amount === null
    ? "—"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(amount / 100);
export const isFinal = (r: Inspection) =>
  r.status === "Bought" || r.status === "Declined";
export function assess(r: Inspection, now = new Date()): Assessment {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (
    !r.model.trim() ||
    !r.storage ||
    !r.inspector.trim() ||
    !/^DEMO-[A-Z0-9-]+$/.test(r.reference)
  )
    blockers.push("Complete device details with a DEMO- reference.");
  for (const c of checks) {
    const o = r.observations[c.id];
    const nextAction =
      c.id === "ownership"
        ? "Get the missing demo ownership evidence and compare it again."
        : c.id === "lock"
          ? "Ask the seller to remove the account lock, then repeat the check."
          : "Repeat the check or ask a technician to verify it.";
    if (!o.result)
      blockers.push(
        `${c.title}: not checked. Complete this check or save on hold.`,
      );
    else if (o.result === "unknown")
      blockers.push(`${c.title}: unable to verify. ${nextAction}`);
    else if (o.result === "issue" && c.critical)
      blockers.push(`${c.title}: unresolved issue. ${nextAction}`);
    if (o.result && o.result !== "pass" && !o.note.trim())
      blockers.push(`${c.title}: add an observation.`);
  }
  if (!r.cosmetic) blockers.push("Select an observable cosmetic condition.");
  if (r.liquid)
    blockers.push("Suspected liquid damage: hold for technician review.");
  if (r.seriousBattery)
    blockers.push(
      "Serious battery concern: stop inspection and refer to a technician.",
    );
  if (
    r.batteryHealth &&
    (!/^\d{1,3}$/.test(r.batteryHealth) ||
      Number(r.batteryHealth) > 100 ||
      !r.batterySource.trim())
  )
    blockers.push("Battery health needs a value from 0–100 and its source.");
  const repairNeeded = checks.some(
    (c) => !c.critical && r.observations[c.id].result === "issue",
  );
  const repair = paise(r.money.repair);
  if (
    repairNeeded &&
    (repair === null ||
      repair <= 0 ||
      !/^\d+$/.test(r.turnaround) ||
      Number(r.turnaround) < 1 ||
      Number(r.turnaround) > 365)
  )
    blockers.push(
      "Repair cost or turnaround is unresolved. Get a technician estimate and record the cost and turnaround (1–365 days).",
    );
  if (
    !repairNeeded &&
    repair !== null &&
    repair > 0 &&
    (!/^\d+$/.test(r.turnaround) ||
      Number(r.turnaround) < 1 ||
      Number(r.turnaround) > 365)
  )
    blockers.push("Record a repair turnaround of 1–365 days.");
  const keys: MoneyKey[] = [
    "asking",
    "resale",
    "repair",
    "other",
    "profit",
    "reserve",
  ];
  for (const k of keys)
    if (k === "other" && r.otherCostUnknown)
      blockers.push(
        "Selling costs are unknown. Enter a working estimate for fees, packaging and delivery, or save on hold until these costs are available.",
      );
    else if (paise(r.money[k]) === null && !(k === "repair" && repairNeeded))
      blockers.push(
        k === "other"
          ? "Selling costs are missing. Enter a working estimate or mark them unknown; do not assume zero."
          : `${moneyLabels[k]}: enter a valid non-negative amount (up to ₹10,00,000).`,
      );
  if (!r.resaleSource.trim())
    blockers.push("Record the source of the resale estimate.");
  const date = new Date(`${r.resaleDate}T00:00:00`);
  const current = new Date(`${today(now)}T00:00:00`);
  if (
    !r.resaleDate ||
    Number.isNaN(date.getTime()) ||
    today(date) !== r.resaleDate ||
    date > current
  )
    blockers.push(
      "Enter a valid resale observation date, no later than today.",
    );
  else if ((current.getTime() - date.getTime()) / 86_400_000 > 7)
    blockers.push(
      "Resale estimate is over seven days old. Review it before buying.",
    );
  const values = ["resale", "repair", "other", "profit", "reserve"].map((k) =>
    paise(r.money[k as MoneyKey]),
  );
  const ceiling =
    !r.otherCostUnknown && values.every((v) => v !== null)
      ? values[0]! - values.slice(1).reduce<number>((sum, v) => sum + v!, 0)
      : null;
  if (repairNeeded)
    warnings.push(
      `Repair needed${r.turnaround ? ` · ${r.turnaround} day turnaround` : ""}. This delays resale.`,
    );
  if (!r.batteryHealth)
    warnings.push(
      "Battery health percentage not provided; longevity remains uncertain.",
    );
  warnings.push(
    "Quick inspection only. Hidden faults and future performance are not guaranteed.",
  );
  return {
    kind: blockers.length
      ? "Hold"
      : ceiling !== null && (ceiling <= 0 || paise(r.money.asking)! > ceiling)
        ? "Decline at current price"
        : "Buy candidate",
    blockers,
    warnings,
    ceiling,
    completed: checks.filter((c) => r.observations[c.id].result).length,
  };
}
export function decide(
  r: Inspection,
  kind: Exclude<Status, "Draft">,
  reason: string,
  now = new Date(),
): Inspection {
  if (isFinal(r)) throw new Error("This decision is final and read-only.");
  if (!reason.trim()) throw new Error("Add a reason for the decision.");
  const a = assess(r, now);
  const agreed = paise(r.money.agreed);
  if (
    kind === "Bought" &&
    (a.blockers.length ||
      a.ceiling === null ||
      a.ceiling <= 0 ||
      agreed === null ||
      agreed <= 0 ||
      agreed > a.ceiling)
  )
    throw new Error(
      "Buying requires complete evidence and a positive agreed price within the purchase ceiling.",
    );
  const { decision: previous, ...evidence } = r;
  void previous;
  return {
    ...r,
    status: kind,
    updatedAt: now.toISOString(),
    decision: {
      kind,
      reason: reason.trim(),
      at: now.toISOString(),
      assessment: a,
      evidence: structuredClone(evidence),
    },
  };
}
export function newInspection(): Inspection {
  const id = crypto.randomUUID();
  return {
    id,
    reference: `DEMO-${id.slice(0, 8).toUpperCase()}`,
    model: "",
    storage: "",
    inspector: "",
    status: "Draft",
    updatedAt: new Date().toISOString(),
    activeSeconds: 0,
    sellerHistory: "",
    observations: Object.fromEntries(
      checks.map((c) => [c.id, { result: "", note: "" }]),
    ) as Inspection["observations"],
    cosmetic: "",
    liquid: false,
    seriousBattery: false,
    batteryHealth: "",
    batterySource: "",
    money: {
      asking: "",
      resale: "",
      repair: "",
      other: "",
      profit: "",
      reserve: "",
      agreed: "",
    },
    resaleSource: "",
    resaleDate: "",
    turnaround: "",
  };
}
