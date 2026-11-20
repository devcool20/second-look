import {
  Children,
  createContext,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useContext,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  Search,
  Plus,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  CircleAlert,
  CircleCheck,
  LockKeyhole,
  LayoutList,
  MessageSquareQuote,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import {
  checks,
  decide,
  inr,
  isFinal,
  moneyLabels,
  newInspection,
  paise,
  today,
  type Inspection,
  type MoneyKey,
  type Status,
} from "./domain";
import { fixtures, load, save } from "./data";
import { validationTargets } from "./validation";
import { workflowSummary, explainHold, shownAssessment } from "./presentation";
const FieldErrors = createContext<Record<string, string>>({});

const steps = [
  "Device details",
  "Inspection",
  "Purchase assessment",
  "Decision record",
];
const stamp = (s: string) =>
  new Date(s).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
function boot() {
  try {
    return { records: load(localStorage) ?? fixtures(), error: "" };
  } catch {
    return {
      records: [] as Inspection[],
      error:
        "Saved data is unavailable or damaged. It has not been replaced. You can retry or explicitly reset demo data.",
    };
  }
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const error = useContext(FieldErrors)[label];
  const controls = Children.toArray(children);
  const isControl = (child: ReactNode) =>
    isValidElement(child) &&
    typeof child.type === "string" &&
    ["input", "select", "textarea"].includes(child.type);
  const control = controls.find(isControl) as
    ReactElement<{ id?: string }> | undefined;
  const id = control?.props.id ?? generatedId;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {controls.map((child) =>
        isControl(child)
          ? cloneElement(
              child as ReactElement<{
                id?: string;
                "aria-describedby"?: string;
                "aria-invalid"?: boolean;
              }>,
              {
                id,
                "aria-describedby":
                  [hint ? `${id}-hint` : "", error ? `${id}-error` : ""]
                    .filter(Boolean)
                    .join(" ") || undefined,
                ...(error ? { "aria-invalid": true } : {}),
              },
            )
          : child,
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <span className="field-error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  );
}
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`badge status-${status.toLowerCase()}`}>
      <span className="dot" />
      {status}
    </span>
  );
}

export default function App() {
  const [initial] = useState(boot);
  const [records, setRecords] = useState(initial.records);
  const [storageError, setStorageError] = useState(initial.error);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All inspections");
  const [reason, setReason] = useState("");
  const [decisionKind, setDecisionKind] = useState<
    "Bought" | "Held" | "Declined"
  >("Held");
  const [decisionError, setDecisionError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const writeBlocked = useRef(!!initial.error);
  const r = records.find((record) => record.id === selected);
  const final = r ? isFinal(r) : false;
  const a = r ? shownAssessment(r) : null;

  function persist(next: Inspection[]) {
    setSaved(false);
    if (writeBlocked.current) return;
    try {
      save(localStorage, next);
      setStorageError("");
      setSaved(true);
    } catch {
      setStorageError(
        "Changes are not saved. Keep this page open and retry saving.",
      );
    }
  }
  useEffect(() => {
    persist(records);
  }, [records]);
  useEffect(() => {
    if (!selected) return;
    const timer = window.setInterval(
      () =>
        setRecords((previous) =>
          previous.map((item) =>
            item.id === selected &&
            !isFinal(item) &&
            document.visibilityState === "visible"
              ? { ...item, activeSeconds: item.activeSeconds + 1 }
              : item,
          ),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [selected]);
  useEffect(() => {
    heading.current?.focus();
  }, [step, selected]);
  useEffect(() => {
    if (resetOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [resetOpen]);

  function update(patch: Partial<Inspection>) {
    if (!r || isFinal(r)) return;
    setRecords((previous) =>
      previous.map((item) =>
        item.id === r.id
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    setDecisionError("");
  }
  function open(record: Inspection) {
    setSelected(record.id);
    setStep(isFinal(record) ? 3 : record.status === "Held" ? 1 : 0);
    setReason("");
    setAttempted(false);
    setDecisionError("");
    setDecisionKind("Held");
  }
  function money(k: MoneyKey) {
    return (
      <input
        id={`money-${k}`}
        name={k}
        inputMode="decimal"
        disabled={k === "other" && !!r!.otherCostUnknown}
        value={r!.money[k]}
        onChange={(e) =>
          update({ money: { ...r!.money, [k]: e.target.value } })
        }
        aria-invalid={r!.money[k] !== "" && paise(r!.money[k]) === null}
        placeholder="0.00"
      />
    );
  }
  function moneyField(k: MoneyKey) {
    const invalid =
      !(k === "other" && r!.otherCostUnknown) &&
      r!.money[k] !== "" &&
      paise(r!.money[k]) === null;
    return (
      <Field
        label={`${moneyLabels[k]} (₹)`}
        hint={
          k === "other"
            ? r!.otherCostUnknown
              ? "Unknown: no purchase ceiling can be calculated yet. Save on hold or enter an estimate."
              : "Working estimate, not verified. Include platform fees, packaging and delivery. Enter zero only if none apply."
            : undefined
        }
      >
        {money(k)}
        {invalid && (
          <span className="field-error">
            Enter 0–10,00,000, with at most two decimal places.
          </span>
        )}
      </Field>
    );
  }
  function go(next: number) {
    setStep(next);
    setAttempted(false);
    setDecisionError("");
  }
  function recordDecision() {
    if (!r) return;
    setAttempted(true);
    try {
      const next = decide(r, decisionKind, reason);
      const updated = recordsRef.current.map((item) =>
        item.id === r.id ? next : item,
      );
      setRecords(updated);
      persist(updated);
      setDecisionError("");
    } catch (error) {
      setDecisionError((error as Error).message);
      if (reason.trim() && decisionKind === "Bought") {
        const target = validationTargets(r)[0];
        if (target) {
          setStep(target.step);
          window.setTimeout(() => {
            const label = Array.from(document.querySelectorAll("label")).find(
              (el) => el.textContent === target.label,
            );
            if (label?.htmlFor) document.getElementById(label.htmlFor)?.focus();
            else if (label?.querySelector("input"))
              label.querySelector("input")?.focus();
            else
              document
                .querySelector<HTMLElement>(
                  `[aria-label="${target.label}"] button`,
                )
                ?.focus();
          }, 0);
          return;
        }
      }
      window.setTimeout(
        () =>
          document
            .getElementById(
              !reason.trim()
                ? "decision-reason"
                : decisionKind === "Bought"
                  ? "money-agreed"
                  : "decision-reason",
            )
            ?.focus(),
        0,
      );
    }
  }
  function startInspection() {
    const record = newInspection();
    setRecords((prev) => [record, ...prev]);
    open(record);
  }
  const visible = records.filter(
    (item) =>
      (filter === "All inspections" || item.status === filter) &&
      `${item.model} ${item.reference}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );

  return (
    <FieldErrors.Provider
      value={
        r && attempted
          ? Object.fromEntries(
              validationTargets(r).map((t) => [t.label, t.error]),
            )
          : {}
      }
    >
      <a className="skip" href="#main">
        Skip to workspace
      </a>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setSelected(null);
          }}
          aria-label="SwaVid inspection queue"
        >
          <span className="brand-mark">
            <ClipboardCheck size={21} />
          </span>
          SwaVid
          <span className="brand-divider" />
          Device intake
        </a>
        <div className="top-right">
          <span className="demo-label">
            <span className="dot" />
            Synthetic demo data
          </span>
          <span className="local-label">Single workstation</span>
        </div>
      </header>
      {storageError && (
        <div className="storage-warning" role="alert">
          <CircleAlert size={18} />
          <span>{storageError}</span>
          <button
            onClick={() => {
              if (writeBlocked.current) {
                const recovered = boot();
                if (!recovered.error) {
                  writeBlocked.current = false;
                  setRecords(recovered.records);
                  setStorageError("");
                }
              } else persist(records);
            }}
          >
            Retry {writeBlocked.current ? "loading" : "saving"}
          </button>
          <button onClick={() => setResetOpen(true)}>Reset demo data</button>
        </div>
      )}
      <aside className="desk-nav" aria-label="Buying desk navigation">
        <div className="desk-identity">
          <span className="desk-avatar">S</span>
          <div>
            <strong>SwaVid studio</strong>
            <small>Buying workspace</small>
          </div>
        </div>
        <div className="nav-section-name">Workspace</div>
        <button
          className={!r ? "nav-active" : ""}
          onClick={() => setSelected(null)}
          aria-label="View all inspections"
        >
          <LayoutList size={18} />
          <span>Inspections</span>
          <span className="nav-count">{records.length}</span>
        </button>
        <button onClick={startInspection} aria-label="Start device inspection">
          <Plus size={18} />
          <span>Start a device</span>
        </button>
        <div className="nav-policy">
          <ShieldCheck size={20} />
          <strong>A considered purchase.</strong>
          <p>
            Record the evidence.
            <br />
            Keep uncertainty visible.
            <br />
            Let a person decide.
          </p>
          <span>Demo policy · not certification</span>
        </div>
        <div className="desk-person">
          <span className="desk-avatar small-avatar">D</span>
          <div>
            <strong>Demo workstation</strong>
            <small>Local records only</small>
          </div>
        </div>
      </aside>
      <main id="main" className="shell">
        {!r ? (
          <>
            <div className="page-title">
              <div>
                <div className="context-line">Your buying workspace</div>
                <h1 ref={heading} tabIndex={-1}>
                  Inspection queue
                </h1>
                <p>
                  Know what you’re buying. Keep the evidence with the decision.
                </p>
              </div>
              <button className="primary" onClick={startInspection}>
                <Plus size={17} />
                New inspection
              </button>
            </div>
            <div
              className="queue-overview"
              aria-label="Filter inspections by record status"
            >
              {(["Draft", "Held", "Bought", "Declined"] as Status[]).map(
                (status, i) => (
                  <button
                    key={status}
                    className={`overview-${status.toLowerCase()} ${filter === status ? "overview-selected" : ""}`}
                    aria-pressed={filter === status}
                    aria-label={`Show ${status} inspections`}
                    onClick={() =>
                      setFilter(filter === status ? "All inspections" : status)
                    }
                  >
                    <span className="overview-title">
                      {
                        [
                          <ClipboardCheck size={18} />,
                          <Clock3 size={18} />,
                          <CheckCheck size={18} />,
                          <CircleAlert size={18} />,
                        ][i]
                      }
                      {status === "Draft"
                        ? "In progress"
                        : status === "Held"
                          ? "On hold"
                          : status}
                    </span>
                    <span className="overview-bottom">
                      <strong>
                        {records.filter((x) => x.status === status).length}
                      </strong>
                      <span>
                        {
                          [
                            "Continue an inspection",
                            "Resolve before buying",
                            "Decisions recorded",
                            "Purchases passed on",
                          ][i]
                        }
                      </span>
                    </span>
                  </button>
                ),
              )}
            </div>
            <div className="queue-panel">
              <div className="toolbar">
                <div className="search">
                  <Search size={18} />
                  <input
                    aria-label="Search inspections"
                    placeholder="Search model or reference…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filter status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  {[
                    "All inspections",
                    "Draft",
                    "Held",
                    "Bought",
                    "Declined",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <span className="count">
                  {visible.length} inspection{visible.length !== 1 ? "s" : ""}
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Reference</th>
                    <th>Record status</th>
                    <th>Inspection / price</th>
                    <th>Next action</th>
                    <th>Inspector</th>
                    <th>Updated</th>
                    <th>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => {
                    const summary = workflowSummary(item);
                    return (
                      <tr key={item.id}>
                        <td>
                          <button
                            className="device-link"
                            onClick={() => open(item)}
                          >
                            <span className="device-icon">
                              <Smartphone size={23} />
                            </span>
                            <span>
                              <strong>{item.model || "New smartphone"}</strong>
                              <small>
                                {item.storage || "Details not entered"}
                              </small>
                            </span>
                          </button>
                        </td>
                        <td className="reference">{item.reference}</td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="workflow-cell">
                          <span>{summary.inspection}</span>
                          <small>Price: {summary.price}</small>
                        </td>
                        <td className="consideration">{summary.next}</td>
                        <td>
                          {item.inspector.replace(" (demo)", "") ||
                            "Unassigned"}
                        </td>
                        <td className="date">{stamp(item.updatedAt)}</td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Open ${item.reference}`}
                            onClick={() => open(item)}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visible.length && (
                <div className="empty">
                  <Search size={28} />
                  <h2>
                    {records.length
                      ? "No matching inspections"
                      : "Start with a device"}
                  </h2>
                  <p>
                    {records.length
                      ? "Try a different model, reference or status."
                      : "Create an inspection to capture evidence before buying."}
                  </p>
                </div>
              )}
              <div className="table-footer">
                <span>
                  <ShieldCheck size={15} />
                  Fictional devices and prices. No real personal data.
                </span>
                <button
                  className="text-button"
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw size={14} />
                  Reset demo data
                </button>
              </div>
            </div>
            <div className="queue-note">
              <ClipboardCheck size={20} />
              <div>
                <strong>A short inspection. A considered decision.</strong>
                <p>
                  Record what you observed, keep uncertainty visible, and stay
                  within a 15-minute inspection.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="workspace-top">
              <button className="text-button" onClick={() => setSelected(null)}>
                <ArrowLeft size={16} />
                Inspection queue
              </button>
              <span className="save-state" role="status">
                {saved ? <CheckCheck size={15} /> : <CircleAlert size={15} />}{" "}
                {saved ? "Saved locally" : "Not saved"}
              </span>
            </div>
            <div className="page-title workspace-title">
              <div>
                <div className="context-line">
                  {r.reference} <span>Record status</span>
                  <StatusBadge status={r.status} />
                </div>
                <h1 ref={heading} tabIndex={-1}>
                  {r.model || "New smartphone inspection"}
                </h1>
                <p>
                  {final
                    ? "Decision recorded. This inspection is read-only."
                    : "Inspect the device, then make an informed purchase decision."}
                </p>
              </div>
              <div
                className={`timer ${r.activeSeconds >= 900 ? "overdue" : ""}`}
              >
                <Clock3 size={18} />
                <div>
                  <strong>
                    {Math.floor(r.activeSeconds / 60)
                      .toString()
                      .padStart(2, "0")}
                    :{(r.activeSeconds % 60).toString().padStart(2, "0")}
                  </strong>
                  <small>of 15 min · active on this page</small>
                </div>
              </div>
            </div>
            {r.activeSeconds >= 900 && !final && (
              <div className="notice">
                <CircleAlert size={18} />
                <span>
                  15-minute target reached. Keep incomplete checks visible and
                  save on hold if more time is needed.
                </span>
                <button
                  onClick={() => {
                    go(3);
                    setDecisionKind("Held");
                  }}
                >
                  Save on hold
                </button>
              </div>
            )}
            <nav className="steps" aria-label="Inspection sections">
              {steps.map((label, i) => (
                <button
                  key={label}
                  aria-current={step === i ? "step" : undefined}
                  className={step === i ? "current" : ""}
                  onClick={() => go(i)}
                >
                  <span>{i + 1}</span>
                  {label}
                </button>
              ))}
            </nav>
            <div className="workspace-grid">
              <section className="work-panel" aria-label={steps[step]}>
                <div className="section-heading">
                  <h2>{steps[step]}</h2>
                  <p>
                    {
                      [
                        "Identify the device without collecting personal information.",
                        "Record observations, not assumptions. Every check needs an explicit response.",
                        "Use dated estimates to set a clear buying boundary.",
                        "Keep the human decision and the evidence together.",
                      ][step]
                    }
                  </p>
                </div>
                <fieldset disabled={final}>
                  {step === 0 && (
                    <div className="section-content">
                      <div className="form-grid">
                        <Field label="Model">
                          <input
                            value={r.model}
                            onChange={(e) => update({ model: e.target.value })}
                            placeholder="e.g. iPhone 13"
                            maxLength={100}
                          />
                        </Field>
                        <Field label="Storage">
                          <select
                            value={r.storage}
                            onChange={(e) =>
                              update({ storage: e.target.value })
                            }
                          >
                            <option value="">Choose storage</option>
                            {[
                              "64 GB",
                              "128 GB",
                              "256 GB",
                              "512 GB",
                              "1 TB",
                            ].map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </Field>
                        <Field
                          label="Internal demo reference"
                          hint="Use DEMO- followed by letters, numbers or hyphens. Never enter a real serial number."
                        >
                          <input
                            value={r.reference}
                            onChange={(e) =>
                              update({
                                reference: e.target.value.toUpperCase(),
                              })
                            }
                            maxLength={40}
                          />
                        </Field>
                        <Field label="Inspector">
                          <input
                            value={r.inspector}
                            onChange={(e) =>
                              update({ inspector: e.target.value })
                            }
                            placeholder="Use a fictional staff label"
                            maxLength={80}
                          />
                        </Field>
                        {moneyField("asking")}
                      </div>
                      <div className="seller-evidence">
                        <div className="evidence-heading">
                          <MessageSquareQuote size={18} />
                          <strong>What the seller says</strong>
                          <span>Unverified</span>
                        </div>
                        <Field
                          label="Seller-reported history (optional)"
                          hint="Unverified claim. Keep your own observations in the inspection section."
                        >
                          <textarea
                            value={r.sellerHistory}
                            onChange={(e) =>
                              update({ sellerHistory: e.target.value })
                            }
                            placeholder="e.g. Seller reports a screen replacement; not yet verified."
                            maxLength={2000}
                          />
                        </Field>
                      </div>
                      <div className="info-note">
                        <ShieldCheck size={18} />
                        <p>
                          This demo uses fictional devices only. Do not enter
                          seller contact details, identity documents,
                          credentials or real device identifiers. Real ownership
                          verification is outside this demonstration.
                        </p>
                      </div>
                    </div>
                  )}
                  {step === 1 && (
                    <div className="checklist">
                      <div className="employee-evidence">
                        <div className="evidence-heading">
                          <Eye size={18} />
                          <strong>What you observe</strong>
                          <span>Employee evidence</span>
                        </div>
                        {r.sellerHistory ? (
                          <blockquote>
                            <small>Seller’s claim · not verified</small>
                            {r.sellerHistory}
                          </blockquote>
                        ) : (
                          <p>
                            No seller claim recorded. Check the device directly;
                            do not assume a pass.
                          </p>
                        )}
                        <p>
                          Your answers below are separate from the seller’s
                          account. Record any disagreement in the employee
                          observation.
                        </p>
                      </div>
                      {checks.map((c, i) => {
                        const o = r.observations[c.id];
                        return (
                          <div className="check-row" key={c.id}>
                            <div className="check-header">
                              <span
                                className={`check-number ${o.result === "pass" ? "done" : ""}`}
                              >
                                {o.result === "pass" ? (
                                  <Check size={15} />
                                ) : (
                                  i + 1
                                )}
                              </span>
                              <div>
                                <h3>{c.title}</h3>
                                <p>{c.instruction}</p>
                              </div>
                            </div>
                            <div className="check-controls">
                              <div
                                className="segments"
                                role="group"
                                aria-label={c.title}
                              >
                                {(
                                  [
                                    { value: "pass", text: "Pass" },
                                    { value: "issue", text: "Issue" },
                                    {
                                      value: "unknown",
                                      text: "Unable to verify",
                                    },
                                  ] as const
                                ).map((option) => (
                                  <button
                                    type="button"
                                    key={option.value}
                                    aria-pressed={o.result === option.value}
                                    className={
                                      o.result === option.value
                                        ? `selected result-${option.value}`
                                        : ""
                                    }
                                    onClick={() =>
                                      update({
                                        observations: {
                                          ...r.observations,
                                          [c.id]: {
                                            ...o,
                                            result: option.value,
                                            note:
                                              option.value === "pass"
                                                ? ""
                                                : o.note,
                                          },
                                        },
                                      })
                                    }
                                  >
                                    {o.result === option.value && (
                                      <Check size={14} />
                                    )}{" "}
                                    {option.text}
                                  </button>
                                ))}
                              </div>
                              {o.result && o.result !== "pass" && (
                                <Field
                                  label="Employee observation"
                                  hint="Required for an issue or an unverified check."
                                >
                                  <textarea
                                    value={o.note}
                                    onChange={(e) =>
                                      update({
                                        observations: {
                                          ...r.observations,
                                          [c.id]: {
                                            ...o,
                                            note: e.target.value,
                                          },
                                        },
                                      })
                                    }
                                    maxLength={2000}
                                  />
                                  {!o.note.trim() && (
                                    <span className="field-error">
                                      Explain what you observed or could not
                                      verify.
                                    </span>
                                  )}
                                </Field>
                              )}
                              {c.id === "body" && (
                                <>
                                  <Field label="Observable cosmetic condition">
                                    <select
                                      value={r.cosmetic}
                                      onChange={(e) =>
                                        update({ cosmetic: e.target.value })
                                      }
                                    >
                                      <option value="">Select condition</option>
                                      {[
                                        "No visible damage",
                                        "Light surface scratches",
                                        "Deep scratches",
                                        "Cracks / dents",
                                      ].map((x) => (
                                        <option key={x}>{x}</option>
                                      ))}
                                    </select>
                                  </Field>
                                  <label className="checkbox">
                                    <input
                                      type="checkbox"
                                      checked={r.liquid}
                                      onChange={(e) =>
                                        update({ liquid: e.target.checked })
                                      }
                                    />
                                    Suspected liquid damage — technician review
                                    needed
                                  </label>
                                </>
                              )}
                              {c.id === "battery" && (
                                <>
                                  <label className="checkbox">
                                    <input
                                      type="checkbox"
                                      checked={r.seriousBattery}
                                      onChange={(e) =>
                                        update({
                                          seriousBattery: e.target.checked,
                                        })
                                      }
                                    />
                                    Swelling or serious battery concern — stop
                                    and refer
                                  </label>
                                  <div className="form-grid">
                                    <Field label="Reported battery health % (optional)">
                                      <input
                                        inputMode="numeric"
                                        value={r.batteryHealth}
                                        onChange={(e) =>
                                          update({
                                            batteryHealth: e.target.value,
                                          })
                                        }
                                      />
                                    </Field>
                                    <Field
                                      label="Battery reading source"
                                      hint="Required when a percentage is entered."
                                    >
                                      <input
                                        value={r.batterySource}
                                        onChange={(e) =>
                                          update({
                                            batterySource: e.target.value,
                                          })
                                        }
                                        placeholder="e.g. device settings"
                                      />
                                    </Field>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {step === 2 && (
                    <div className="section-content">
                      <div className="notice compact">
                        <CircleAlert size={18} />
                        <p>
                          Manual demo assumptions, not a market valuation.
                          Resale estimates must be no more than seven days old.
                        </p>
                      </div>
                      <div className="form-grid">
                        {(
                          [
                            "resale",
                            "repair",
                            "other",
                            "profit",
                            "reserve",
                          ] as MoneyKey[]
                        ).map((k) => (
                          <div key={k}>
                            {moneyField(k)}
                            {k === "other" && (
                              <label className="checkbox">
                                <input
                                  type="checkbox"
                                  checked={!!r.otherCostUnknown}
                                  onChange={(e) =>
                                    update({
                                      otherCostUnknown: e.target.checked,
                                    })
                                  }
                                />
                                Selling costs are unknown
                              </label>
                            )}
                            {k === "repair" &&
                              !checks.some(
                                (c) =>
                                  !c.critical &&
                                  r.observations[c.id].result === "issue",
                              ) && (
                                <button
                                  className="text-button zero"
                                  onClick={() =>
                                    update({
                                      money: { ...r.money, repair: "0" },
                                      turnaround: "",
                                    })
                                  }
                                >
                                  No repair needed · set ₹0
                                </button>
                              )}
                          </div>
                        ))}
                        <Field
                          label="Repair turnaround (days)"
                          hint="Required for repair work; 1–365 days."
                        >
                          <input
                            inputMode="numeric"
                            value={r.turnaround}
                            onChange={(e) =>
                              update({ turnaround: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Resale observation date">
                          <input
                            type="date"
                            max={today()}
                            value={r.resaleDate}
                            onChange={(e) =>
                              update({ resaleDate: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Resale estimate source">
                          <input
                            value={r.resaleSource}
                            onChange={(e) =>
                              update({ resaleSource: e.target.value })
                            }
                            placeholder="e.g. synthetic comparison price"
                            maxLength={200}
                          />
                        </Field>
                      </div>
                      <div className="calculation">
                        <h3>Purchase ceiling</h3>
                        {(
                          [
                            "resale",
                            "repair",
                            "other",
                            "profit",
                            "reserve",
                          ] as MoneyKey[]
                        ).map((k, i) => (
                          <div key={k}>
                            <span>
                              {i ? "− " : ""}
                              {moneyLabels[k]}
                            </span>
                            <span>
                              {k === "other" && r.otherCostUnknown
                                ? "Unknown"
                                : inr(paise(r.money[k]))}
                            </span>
                          </div>
                        ))}
                        <div className="total">
                          <strong>Maximum purchase price</strong>
                          <strong>{inr(a!.ceiling)}</strong>
                        </div>
                        <p>
                          Repair cost and time reduce the appeal of a purchase.
                          This demo does not model daily depreciation.
                        </p>
                      </div>
                    </div>
                  )}
                </fieldset>
                {step === 3 && (
                  <div className="section-content">
                    {r.decision && (
                      <div className="record-summary">
                        <div className="record-label">
                          <LockKeyhole size={17} />
                          {final
                            ? "Final decision snapshot"
                            : "Last held decision"}
                        </div>
                        <h3>
                          {r.decision.kind === "Bought"
                            ? "Purchase recorded"
                            : r.decision.kind === "Declined"
                              ? "Purchase declined"
                              : "Saved on hold"}
                        </h3>
                        <p>{r.decision.reason}</p>
                        <dl>
                          <div>
                            <dt>Recorded</dt>
                            <dd>{stamp(r.decision.at)}</dd>
                          </div>
                          <div>
                            <dt>Ceiling at decision</dt>
                            <dd>{inr(r.decision.assessment.ceiling)}</dd>
                          </div>
                          <div>
                            <dt>Agreed price at decision</dt>
                            <dd>
                              {inr(paise(r.decision.evidence.money.agreed))}
                            </dd>
                          </div>
                        </dl>
                        {!final && (
                          <small>
                            Current assessment uses your latest evidence; the
                            previous hold snapshot is retained until the next
                            decision.
                          </small>
                        )}
                      </div>
                    )}
                    {!final && (
                      <>
                        <div
                          className="decision-choices"
                          role="group"
                          aria-label="Human decision"
                        >
                          {(["Bought", "Held", "Declined"] as const).map(
                            (kind) => (
                              <button
                                aria-pressed={decisionKind === kind}
                                className={
                                  decisionKind === kind ? "selected" : ""
                                }
                                onClick={() => {
                                  setDecisionKind(kind);
                                  setDecisionError("");
                                }}
                                key={kind}
                              >
                                {kind === "Bought" ? (
                                  <CircleCheck size={18} />
                                ) : kind === "Held" ? (
                                  <Clock3 size={18} />
                                ) : (
                                  <CircleAlert size={18} />
                                )}
                                <strong>
                                  {kind === "Bought"
                                    ? "Buy"
                                    : kind === "Held"
                                      ? "Hold"
                                      : "Decline"}
                                </strong>
                                <small>
                                  {kind === "Bought"
                                    ? "Within the buying boundary"
                                    : kind === "Held"
                                      ? "Resolve evidence or estimates"
                                      : "Do not proceed with purchase"}
                                </small>
                              </button>
                            ),
                          )}
                        </div>
                        {decisionKind === "Bought" && (
                          <>
                            {moneyField("agreed")}
                            {(a!.blockers.length > 0 ||
                              a!.ceiling === null ||
                              a!.ceiling <= 0) && (
                              <div className="field-error">
                                Resolve the assessment blockers before recording
                                a purchase.
                              </div>
                            )}
                          </>
                        )}
                        <Field label="Decision reason">
                          <textarea
                            id="decision-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain the decision and any follow-up needed."
                            maxLength={2000}
                            aria-invalid={attempted && !reason.trim()}
                          />
                          {attempted && !reason.trim() && (
                            <span className="field-error">
                              Add a reason for the decision.
                            </span>
                          )}
                        </Field>
                        {decisionError && (
                          <p className="field-error" role="alert">
                            {decisionError}
                          </p>
                        )}
                        <button className="primary" onClick={recordDecision}>
                          {decisionKind === "Bought"
                            ? "Record purchase"
                            : decisionKind === "Held"
                              ? "Save on hold"
                              : "Record decline"}
                          <ArrowRight size={16} />
                        </button>
                      </>
                    )}
                    <div className="info-note">
                      <ShieldCheck size={18} />
                      <p>
                        This records a buying decision, not a device
                        certification or warranty. Hidden faults and future
                        battery performance remain uncertain.
                      </p>
                    </div>
                  </div>
                )}
                <div className="section-footer">
                  <button disabled={step === 0} onClick={() => go(step - 1)}>
                    <ArrowLeft size={16} />
                    Back
                  </button>
                  {step < 3 ? (
                    <button className="primary" onClick={() => go(step + 1)}>
                      {step === 0
                        ? "Continue to inspection"
                        : step === 1
                          ? "Continue to assessment"
                          : "Continue to decision"}
                      <ArrowRight size={16} />
                    </button>
                  ) : (
                    <button onClick={() => setSelected(null)}>
                      Return to queue
                      <ArrowRight size={16} />
                    </button>
                  )}
                </div>
              </section>
              <aside className="assessment-rail">
                <div className="rail-device">
                  <span className="device-icon">
                    <Smartphone size={28} />
                  </span>
                  <div>
                    <strong>{r.model || "Device not entered"}</strong>
                    <small>
                      {r.storage || "Storage not entered"} · {r.reference}
                    </small>
                  </div>
                </div>
                <div className="progress-section">
                  <div>
                    <strong>Inspection coverage</strong>
                    <span>
                      {a!.completed} / {checks.length}
                    </span>
                  </div>
                  <progress
                    value={a!.completed}
                    max={checks.length}
                    aria-label="Checks answered"
                  />
                  <small>
                    {workflowSummary(r).inspection}. Answered does not mean
                    passed.
                  </small>
                </div>
                <div
                  className={`assessment-result ${a!.kind === "Buy candidate" ? "positive" : "caution"}`}
                >
                  <div className="result-label">
                    {a!.kind === "Buy candidate" ? (
                      <CircleCheck size={18} />
                    ) : (
                      <CircleAlert size={18} />
                    )}{" "}
                    {final ? "Assessment at decision" : "Live assessment"}
                  </div>
                  <h2>{a!.kind}</h2>
                  <p>
                    {a!.blockers.length
                      ? "Resolve the evidence below before buying."
                      : a!.kind === "Buy candidate"
                        ? "Evidence is recorded and the asking price fits the ceiling. A human decision is still required."
                        : "The asking price does not fit the buying boundary. Negotiate within the ceiling or decline."}
                  </p>
                </div>
                <div className="rail-price">
                  <span>Maximum purchase price</span>
                  <strong>{inr(a!.ceiling)}</strong>
                  <div className="price-state">
                    <SlidersHorizontal size={14} />
                    <span>Price assessment: {workflowSummary(r).price}</span>
                  </div>
                  <small>Asking price {inr(paise(r.money.asking))}</small>
                </div>
                {a!.blockers.length > 0 && (
                  <div className="rail-blockers">
                    <h3>
                      Needs attention <span>{a!.blockers.length}</span>
                    </h3>
                    <ul>
                      {a!.blockers.slice(0, 4).map((b, i) => {
                        const guidance = explainHold(b);
                        return (
                          <li key={i}>
                            <strong>{guidance.issue}</strong>
                            <p>{guidance.action}</p>
                            {!final && (
                              <button
                                className="text-button"
                                onClick={() => go(guidance.step)}
                              >
                                Go to {steps[guidance.step].toLowerCase()}
                                <ChevronRight size={13} />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {a!.blockers.length > 4 && (
                      <details>
                        <summary>
                          Show {a!.blockers.length - 4} more items
                        </summary>
                        <ul>
                          {a!.blockers.slice(4).map((b) => {
                            const guidance = explainHold(b);
                            return (
                              <li key={b}>
                                <strong>{guidance.issue}</strong>
                                <p>{guidance.action}</p>
                                {!final && (
                                  <button
                                    className="text-button"
                                    onClick={() => go(guidance.step)}
                                  >
                                    Go to {steps[guidance.step].toLowerCase()}
                                    <ChevronRight size={13} />
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                <div className="rail-caveats">
                  <h3>Keep in mind</h3>
                  {a!.warnings.map((w) => (
                    <p key={w}>{w}</p>
                  ))}
                </div>
                <div className="rail-footer">
                  <ShieldCheck size={16} />
                  <span>
                    Demo policy · manual observations
                    <br />
                    No automatic verification
                  </span>
                </div>
              </aside>
            </div>
          </>
        )}
        <footer className="app-footer">
          <span>SwaVid / Scenario C</span>
          <span>Evidence first. Decision second.</span>
        </footer>
      </main>
      <dialog
        ref={dialog}
        onCancel={() => setResetOpen(false)}
        onClose={() => setResetOpen(false)}
      >
        <div className="dialog-content">
          <h2>Reset demo data?</h2>
          <p>
            This replaces every local inspection with six fictional examples.
            Your current records will be removed.
          </p>
          <div className="dialog-actions">
            <button onClick={() => setResetOpen(false)}>Keep records</button>
            <button
              className="primary"
              onClick={() => {
                const next = fixtures();
                try {
                  save(localStorage, next);
                  writeBlocked.current = false;
                  setRecords(next);
                  setSelected(null);
                  setStorageError("");
                  setSaved(true);
                  setResetOpen(false);
                } catch {
                  setStorageError(
                    "Reset failed. Existing records have not been replaced.",
                  );
                  setResetOpen(false);
                }
              }}
            >
              Reset demo data
            </button>
          </div>
        </div>
      </dialog>
    </FieldErrors.Provider>
  );
}
