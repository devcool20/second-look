import {
  assess,
  checks,
  paise,
  today,
  type Inspection,
  type MoneyKey,
} from "./domain";

// Match input labels so cross-section validation can lead back to the actual control.
export function validationTargets(r: Inspection, assessment = assess(r)) {
  const targets: { label: string; step: number; error: string }[] = [];
  function add(condition: boolean, label: string, step: number, error: string) {
    if (condition) targets.push({ label, step, error });
  }
  add(!r.model.trim(), "Model", 0, "Enter the smartphone model.");
  add(!r.storage, "Storage", 0, "Select the storage capacity.");
  add(
    !/^DEMO-[A-Z0-9-]+$/.test(r.reference),
    "Internal demo reference",
    0,
    "Use a fictional reference beginning DEMO-.",
  );
  add(
    !r.inspector.trim(),
    "Inspector",
    0,
    "Enter a fictional inspector label.",
  );
  add(
    paise(r.money.asking) === null,
    "Seller asking price (₹)",
    0,
    "Enter a valid asking price.",
  );
  for (const c of checks) {
    const o = r.observations[c.id];
    add(
      !o.result ||
        o.result === "unknown" ||
        (o.result === "issue" && c.critical) ||
        !!(o.result !== "pass" && o.result && !o.note.trim()),
      c.title,
      1,
      "Resolve this check and its observation before buying.",
    );
  }
  add(
    !r.cosmetic,
    "Observable cosmetic condition",
    1,
    "Select the observed condition.",
  );
  add(
    r.liquid,
    "Suspected liquid damage — technician review needed",
    1,
    "Hold for technician review.",
  );
  add(
    r.seriousBattery,
    "Swelling or serious battery concern — stop and refer",
    1,
    "Stop and refer to a technician.",
  );
  add(
    !!r.batteryHealth &&
      (!/^\d{1,3}$/.test(r.batteryHealth) || Number(r.batteryHealth) > 100),
    "Reported battery health % (optional)",
    1,
    "Enter a percentage from 0 to 100.",
  );
  add(
    !!r.batteryHealth && !r.batterySource.trim(),
    "Battery reading source",
    1,
    "Record the source of this percentage.",
  );
  const labels: Record<string, string> = {
    resale: "Expected resale price",
    repair: "Repair cost",
    other: "Other selling costs",
    profit: "Target profit",
    reserve: "Risk reserve",
  };
  for (const k of Object.keys(labels))
    add(
      paise(r.money[k as MoneyKey]) === null ||
        (k === "other" && !!r.otherCostUnknown),
      k === "other" && r.otherCostUnknown
        ? "Selling costs are unknown"
        : `${labels[k]} (₹)`,
      2,
      k === "other"
        ? "Enter a working estimate or save on hold while selling costs are unknown."
        : "Enter a non-negative amount, including an explicit zero if appropriate.",
    );
  const repairs = checks.some(
    (c) => !c.critical && r.observations[c.id].result === "issue",
  );
  add(
    repairs && (paise(r.money.repair) ?? 0) <= 0,
    "Repair cost (₹)",
    2,
    "An observed repair issue needs a positive repair estimate.",
  );
  add(
    (repairs || (paise(r.money.repair) ?? 0) > 0) &&
      (!/^\d+$/.test(r.turnaround) ||
        Number(r.turnaround) < 1 ||
        Number(r.turnaround) > 365),
    "Repair turnaround (days)",
    2,
    "Enter a turnaround of 1–365 days.",
  );
  add(
    assessment.blockers.some(
      (b) =>
        b.startsWith("Enter a valid resale") ||
        b.startsWith("Resale estimate is"),
    ),
    "Resale observation date",
    2,
    `Review the estimate and enter a valid date within seven days of ${today()}.`,
  );
  add(
    !r.resaleSource.trim(),
    "Resale estimate source",
    2,
    "Record the estimate source.",
  );
  return targets;
}
