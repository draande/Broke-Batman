import { test, expect } from "@playwright/test";
test("manual case, edit, contacts, notes, follow-up completion, duplicates, archive, delete and Kanban rollback", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Case Tester");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`cases-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Strong-test-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good evening, Case." }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Cases/ }).first().click();
  await expect(page.getByRole("heading", { name: /^Cases/ })).toBeVisible();
  await page
    .getByRole("button", { name: "Open a case", exact: false })
    .first()
    .click();
  await page.getByLabel("Company", { exact: true }).fill("Manual Company");
  await page.getByLabel("Position", { exact: true }).fill("Manual Engineer");
  await page.getByRole("button", { name: "Save case", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Manual Company", exact: true }).click();
  await page.waitForURL(/\/app\/cases\/[^/]+$/);
  const id = page.url().split("/").pop()!;
  await page.getByRole("button", { name: "Edit case", exact: true }).click();
  await page
    .getByLabel("Position", { exact: true })
    .fill("Senior Manual Engineer");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Senior Manual Engineer", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "Add note", exact: false }).click();
  await page
    .getByLabel("Personal note")
    .fill("Unique preparation keyword: magnetosphere");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Unique preparation keyword: magnetosphere"),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Contacts", exact: true }).click();
  await page.getByRole("button", { name: "Add contact", exact: false }).click();
  await page.getByLabel("Name", { exact: true }).fill("Taylor Recruiter");
  await page.getByLabel("Email", { exact: true }).fill("taylor@example.test");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "taylor@example.test" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add follow-up", exact: true })
    .click();
  await page.getByLabel("What needs doing?").fill("Check referral");
  await page
    .getByLabel("Due date and time (your browser's local time)")
    .fill("2026-01-01T09:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Complete Check referral", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen Check referral", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Cases/ }).first().click();
  await page.getByLabel("Search cases").fill("magnetosphere");
  await expect(
    page.getByRole("link", { name: "Manual Company", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search cases").fill("");
  await page.getByRole("button", { name: "Kanban view" }).click();
  await page
    .getByLabel("Move Manual Company to status")
    .selectOption("applied");
  await expect(page.getByLabel("Move Manual Company to status")).toHaveValue(
    "applied",
  );
  await page.route(`**/api/applications/${id}`, async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated network failure" }),
      });
    else await route.continue();
  });
  await page.getByLabel("Move Manual Company to status").selectOption("offer");
  await expect(
    page.getByRole("alert").filter({ hasText: "Simulated network failure" }),
  ).toContainText("Simulated network failure");
  await expect(page.getByLabel("Move Manual Company to status")).toHaveValue(
    "applied",
  );
  await page.unroute(`**/api/applications/${id}`);
  await page
    .getByRole("button", { name: "Open a case", exact: false })
    .first()
    .click();
  await page.getByLabel("Company", { exact: true }).fill("Manual Company");
  await page
    .getByLabel("Position", { exact: true })
    .fill("Senior Manual Engineer");
  await page.getByRole("button", { name: "Save case", exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("This case may already be in the Batcomputer.", {
        exact: true,
      }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save anyway" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`/app/cases/${id}`);
  await page.getByRole("button", { name: "Archive case" }).click();
  await expect(
    page.getByRole("button", { name: "Restore case" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore case" }).click();
  await expect(
    page.getByRole("button", { name: "Archive case" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByText("Case archived", { exact: true })).toBeVisible();
  await expect(page.getByText("Case restored", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete case", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete case", exact: true })
    .click();
  await expect(page).toHaveURL("/app/cases");
  expect((await page.request.get(`/api/applications/${id}`)).status()).toBe(
    404,
  );
});
