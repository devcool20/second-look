import {
  assess,
  checks,
  isFinal,
  paise,
  type Inspection,
  type Assessment,
} from "./domain";
import { validationTargets } from "./validation";

export function workflowSummary(r: Inspection) {
  const a = shownAssessment(r);
  const targets = validationTargets(r, a);
  const incomplete = checks.some((c) => !r.observations[c.id].result);
  const inspection = incomplete
    ? "Checks in progress"
    : targets.some((t) => t.step === 1)
      ? "Evidence needs review"
      : "Checks recorded";
  const priceMissing =
    targets.some((t) => t.step === 2) || paise(r.money.asking) === null;
  const price = priceMissing
    ? "Estimates needed"
    : a.ceiling !== null &&
        ((paise(r.money.asking) ?? 0) > a.ceiling || a.ceiling <= 0)
      ? "Above ceiling"
      : "Within ceiling";
  let next = "Review and record a decision";
  if (isFinal(r)) next = "View saved decision";
  else if (r.seriousBattery) next = "Stop and refer to a technician";
  else if (r.liquid) next = "Ask a technician about liquid damage";
  else if (r.observations.lock.result && r.observations.lock.result !== "pass")
    next = "Ask seller to remove account lock";
  else if (!r.model.trim() || !r.storage || !r.inspector.trim())
    next = "Add the device details";
  else if (incomplete) next = "Finish the remaining checks";
  else if (targets.some((t) => t.step === 1))
    next = "Resolve the inspection evidence";
  else if (
    checks.some(
      (c) => !c.critical && r.observations[c.id].result === "issue",
    ) &&
    targets.some((t) => t.label.startsWith("Repair"))
  )
    next = "Get a technician estimate";
  else if (r.otherCostUnknown || paise(r.money.other) === null)
    next = "Estimate selling costs or keep on hold";
  else if (priceMissing) next = "Complete the price estimates";
  else if (price === "Above ceiling")
    next = "Negotiate a lower price or decline";
  return { inspection, price, next };
}

export function explainHold(message: string): {
  issue: string;
  action: string;
  step: number;
} {
  if (message.startsWith("Complete device details"))
    return {
      issue: "Device details are incomplete",
      action:
        "Enter the model, storage, inspector and a fictional DEMO reference.",
      step: 0,
    };
  if (message.includes("not checked."))
    return {
      issue: message.split(":")[0] + ": not checked",
      action: "Perform this check and record Pass, Issue or Unable to verify.",
      step: 1,
    };
  const split = message.indexOf(". ");
  if (split >= 0)
    return {
      issue: message.slice(0, split),
      action: message.slice(split + 2),
      step:
        message.startsWith("Selling") ||
        message.startsWith("Repair") ||
        message.startsWith("Resale")
          ? 2
          : 1,
    };
  if (message.startsWith("Record a repair turnaround"))
    return {
      issue: "Repair turnaround is missing",
      action:
        "Ask the technician how many days the repair will take and record their estimate.",
      step: 2,
    };
  if (message.includes("add an observation"))
    return {
      issue: message.split(":")[0] + ": observation missing",
      action: "Describe what you saw or could not verify.",
      step: 1,
    };
  if (message.includes("liquid"))
    return {
      issue: "Possible liquid damage",
      action:
        "Keep on hold. Ask a technician to inspect the concern before buying.",
      step: 1,
    };
  if (message.includes("battery concern"))
    return {
      issue: "Serious battery concern",
      action: "Stop inspection and refer to a technician. Keep on hold.",
      step: 1,
    };
  if (message.startsWith("Battery health"))
    return {
      issue: "Battery reading needs a source",
      action:
        "Enter a percentage from 0–100 with its source, or leave this optional reading blank.",
      step: 1,
    };
  if (message.includes("cosmetic"))
    return {
      issue: "Cosmetic condition not recorded",
      action: "Choose the description that matches the damage you can see.",
      step: 1,
    };
  if (message.includes("resale") || message.includes("Resale"))
    return {
      issue: "Resale estimate needs review",
      action:
        "Record the estimate source and a valid observation date within the last seven days.",
      step: 2,
    };
  return {
    issue: message.split(":")[0] + " needs an amount",
    action:
      "Enter an amount from ₹0 to ₹10,00,000, with at most two decimal places. Use a labelled estimate where needed.",
    step: message.startsWith("Seller") ? 0 : 2,
  };
}

export function shownAssessment(r: Inspection): Assessment {
  return isFinal(r) && r.decision ? r.decision.assessment : assess(r);
}
