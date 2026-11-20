import { test, expect, type Locator } from "@playwright/test";

test("queue separates statuses, offers a clear start and uses employee next actions", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New inspection", exact: true }),
  ).toBeVisible();
  const repairRow = page
    .getByRole("row")
    .filter({ has: page.getByText("DEMO-0103", { exact: true }) });
  await expect(repairRow).toContainText("Get a technician estimate");
  await expect(repairRow).toContainText("Checks recorded");
  await expect(repairRow).toContainText("Price: Estimates needed");
  await expect(repairRow).not.toContainText("1–365");
  await page.getByRole("button", { name: "Show Held inspections" }).click();
  await expect(
    page.getByRole("button", { name: "Open DEMO-0102", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open DEMO-0103", exact: true }),
  ).toHaveCount(0);
});

test("seller claims remain distinct from conflicting employee evidence and holds lead to action", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open DEMO-0103", exact: true })
    .click();
  await page
    .getByLabel("Seller-reported history (optional)")
    .fill("Seller claims original screen and no repairs.");
  await page.screenshot({ path: "tmp/redesign-details.png", fullPage: true });
  await page.getByRole("button", { name: "2 Inspection" }).click();
  await expect(page.locator(".employee-evidence")).toContainText(
    "Seller claims original screen and no repairs.",
  );
  await expect(
    page.getByRole("textbox", { name: "Employee observation", exact: true }),
  ).toHaveValue("A dead touch strip on the right edge.");
  await expect(page.locator(".rail-blockers")).toContainText(
    "Get a technician estimate",
  );
  await page.screenshot({
    path: "tmp/redesign-inspection.png",
    fullPage: true,
  });
  await page
    .locator(".rail-blockers")
    .getByRole("button", { name: "Go to purchase assessment" })
    .first()
    .click();
  await expect(
    page.getByLabel("Repair cost (₹)", { exact: true }),
  ).toBeVisible();
});

test("blocked purchase leads to the first incomplete field", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New inspection" }).click();
  await page.getByRole("button", { name: "4 Decision record" }).click();
  await page
    .getByRole("button", { name: "Buy Within the buying boundary" })
    .click();
  await page
    .getByLabel("Decision reason")
    .fill("Attempting with missing evidence");
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await expect(page.getByLabel("Model", { exact: true })).toBeFocused();
  await expect(
    page.getByText("Enter the smartphone model.", { exact: true }),
  ).toBeVisible();
});

test("15-minute target preserves unanswered checks and offers a hold", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("swavid.inspections.v1")!);
    saved.records[5].activeSeconds = 901;
    localStorage.setItem("swavid.inspections.v1", JSON.stringify(saved));
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Open DEMO-0106", exact: true })
    .click();
  await expect(
    page.getByText("15-minute target reached.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save on hold", exact: true }).click();
  await page.getByLabel("Decision reason").fill("Inspection needs more time.");
  await page
    .getByRole("button", { name: "Save on hold", exact: true })
    .last()
    .click();
  const status = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("swavid.inspections.v1")!);
    return saved.records[5];
  });
  expect(status.status).toBe("Held");
  expect(status.observations.battery.result).toBe("");
});

test("purchase, snapshot, read-only record and desktop layouts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page.getByRole("heading", { name: "Inspection queue" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({ path: `tmp/queue-${width}.png`, fullPage: true });
  }
  await page
    .getByRole("button", { name: "Open DEMO-0101", exact: true })
    .click();
  await page.getByRole("button", { name: "3 Purchase assessment" }).click();
  await expect(
    page.getByRole("heading", { name: "Buy candidate", exact: true }),
  ).toBeVisible();
  for (const width of [1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `tmp/assessment-${width}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Continue to decision" }).click();
  await page
    .getByRole("button", { name: "Buy Within the buying boundary" })
    .click();
  await page
    .getByLabel("Decision reason")
    .fill("Observed checks complete and negotiated price below ceiling.");
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Purchase recorded", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open DEMO-0101", exact: true })
    .click();
  await expect(
    page.getByText(
      "Observed checks complete and negotiated price below ceiling.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "1 Device details" }).click();
  await expect(page.getByLabel("Model", { exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("complete a seeded purchase using only keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  async function tabTo(target: Locator) {
    for (let i = 0; i < 35; i++) {
      if (await target.evaluate((el) => el === document.activeElement)) return;
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
  }
  await tabTo(
    page.getByRole("button", { name: "Open DEMO-0101", exact: true }),
  );
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "iPhone 13", exact: true }),
  ).toBeVisible();
  await tabTo(page.getByRole("button", { name: "4 Decision record" }));
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Decision record", exact: true }),
  ).toBeVisible();
  await tabTo(
    page.getByRole("button", { name: "Buy Within the buying boundary" }),
  );
  await page.keyboard.press("Enter");
  await tabTo(page.getByLabel("Agreed purchase price (₹)"));
  await expect(page.getByLabel("Agreed purchase price (₹)")).toBeFocused();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("16000");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Checks reviewed. Price within ceiling.");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Purchase recorded", exact: true }),
  ).toBeVisible();
});

test("hold, refresh, resolve evidence, and decline", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open DEMO-0102", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hold", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "4 Decision record" }).click();
  await page.getByLabel("Decision reason").fill("Waiting for account removal.");
  await page.getByRole("button", { name: "Save on hold", exact: true }).click();
  await expect(
    page.locator(".record-summary").getByText("Waiting for account removal."),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Open DEMO-0102", exact: true })
    .click();
  await page
    .getByRole("group", { name: "Account lock & reset readiness", exact: true })
    .getByRole("button", { name: "Pass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Buy candidate", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Inspection queue", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open DEMO-0103", exact: true })
    .click();
  await page.getByRole("button", { name: "4 Decision record" }).click();
  await page
    .getByRole("button", { name: "Decline Do not proceed with purchase" })
    .click();
  await page
    .getByLabel("Decision reason")
    .fill("Repair uncertainty exceeds our appetite.");
  await page.getByRole("button", { name: "Record decline" }).click();
  await expect(
    page.getByRole("heading", { name: "Purchase declined" }),
  ).toBeVisible();
});

test("new inspection, validation and keyboard navigation", async ({ page }) => {
  const started = Date.now();
  await page.goto("/");
  await page.getByRole("button", { name: "New inspection" }).click();
  await page.getByLabel("Model", { exact: true }).fill("Synthetic test phone");
  await page.getByLabel("Storage", { exact: true }).selectOption("128 GB");
  await page.getByLabel("Inspector", { exact: true }).fill("Test inspector");
  await page.getByLabel("Seller asking price (₹)").fill("10000");
  await page.getByRole("button", { name: "Continue to inspection" }).click();
  for (const c of [
    "Identity & ownership evidence",
    "Account lock & reset readiness",
    "Screen & touch",
    "Body & liquid indicators",
    "Charging & battery",
    "Cameras & audio",
    "Buttons, connectivity & operation",
  ])
    await page
      .getByRole("group", { name: c, exact: true })
      .getByRole("button", { name: "Pass", exact: true })
      .click();
  await page
    .getByLabel("Observable cosmetic condition")
    .selectOption("Light surface scratches");
  await page.getByRole("button", { name: "Continue to assessment" }).click();
  for (const [name, value] of [
    ["Expected resale price", "18000"],
    ["Repair cost", "0"],
    ["Other selling costs", "500"],
    ["Target profit", "2500"],
    ["Risk reserve", "1000"],
  ])
    await page.getByLabel(`${name} (₹)`, { exact: true }).fill(value);
  await page.getByLabel("Resale observation date").fill(
    await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  );
  await page
    .getByLabel("Resale estimate source")
    .fill("Synthetic test comparison");
  await expect(
    page.getByRole("heading", { name: "Buy candidate", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue to decision" }).click();
  await page
    .getByRole("button", { name: "Buy Within the buying boundary" })
    .click();
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click();
  await expect(page.getByLabel("Decision reason")).toBeFocused();
  await page.getByLabel("Decision reason").fill("All evidence recorded.");
  await page.getByLabel("Agreed purchase price (₹)").fill("10000");
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Purchase recorded", exact: true }),
  ).toBeVisible();
  console.log(
    `TASK-FIT normal new intake: ${((Date.now() - started) / 1000).toFixed(2)}s automated UI time; physical checks simulated.`,
  );
});

test("task fit: repair uncertainty and selling-cost estimates change the decision for a reason", async ({
  page,
}) => {
  const started = Date.now();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open DEMO-0103", exact: true })
    .click();
  await expect(
    page.getByText(/Get a technician estimate/, { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "3 Purchase assessment" }).click();
  await page.getByLabel("Repair cost (₹)", { exact: true }).fill("1200");
  await page.getByLabel("Repair turnaround (days)").fill("2");
  await expect(
    page.getByRole("heading", { name: "Buy candidate", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Working estimate, not verified/)).toBeVisible();
  await page.getByLabel("Selling costs are unknown", { exact: true }).check();
  await expect(
    page.getByRole("heading", { name: "Hold", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".rail-price strong")).toHaveText("—");
  await page.getByRole("button", { name: "4 Decision record" }).click();
  await page
    .getByLabel("Decision reason")
    .fill(
      "Technician quoted screen repair. Obtain selling-cost estimate before purchase.",
    );
  await page.getByRole("button", { name: "Save on hold", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Open DEMO-0103", exact: true })
    .click();
  await page.getByRole("button", { name: "3 Purchase assessment" }).click();
  await expect(
    page.getByLabel("Selling costs are unknown", { exact: true }),
  ).toBeChecked();
  await page.getByLabel("Selling costs are unknown", { exact: true }).uncheck();
  await expect(
    page.getByRole("heading", { name: "Buy candidate", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Other selling costs (₹)", { exact: true })
    .fill("2500");
  await expect(
    page.getByRole("heading", {
      name: "Decline at current price",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".rail-price strong")).toContainText("15,300");
  console.log(
    `TASK-FIT risky intake: ${((Date.now() - started) / 1000).toFixed(2)}s automated UI time; technician quote and cost estimates fictional.`,
  );
  await page.screenshot({ path: "tmp/task-fit-risky.png", fullPage: true });
});

test("storage failures remain visible and corrupt data is not overwritten", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Quota exceeded");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("not saved");
  await page.getByRole("button", { name: "New inspection" }).click();
  await page.getByLabel("Model", { exact: true }).fill("Unsaved phone");
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
    "Unsaved phone",
  );
  await expect(page.getByRole("status")).toContainText("Not saved");
});

test("corrupt storage requires explicit recovery and reset confirmation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("swavid.inspections.v1", "{broken");
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("not been replaced");
  expect(
    await page.evaluate(() => localStorage.getItem("swavid.inspections.v1")),
  ).toBe("{broken");
  await page.getByRole("button", { name: "Reset demo data" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep records" }).click();
  expect(
    await page.evaluate(() => localStorage.getItem("swavid.inspections.v1")),
  ).toBe("{broken");
  await page.getByRole("button", { name: "Reset demo data" }).first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo data" })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open DEMO-0101", exact: true }),
  ).toBeVisible();
});
