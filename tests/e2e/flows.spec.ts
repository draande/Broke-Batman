import { test, expect } from "@playwright/test";
test("register, extract, persist, interview, analytics, export, import, keyboard, theme and isolation", async ({
  page,
  browser,
}) => {
  const email = `e2e-${Date.now()}@example.test`,
    password = "A-strong-test-password-123";
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Bruce Test");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good evening, Bruce." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open a case", exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Analyze job posting", exact: true })
    .click();
  await page
    .getByLabel("Job description", { exact: true })
    .fill(
      "Company: Test Industries\nTitle: Software Engineer\nLocation: Gotham City\nFull-time, Remote\nSalary: $120k - $170k\nRequired: TypeScript, React, PostgreSQL\n3+ years of experience building reliable systems.\nPreferred: Docker and AWS",
    );
  await page
    .getByRole("button", { name: "Analyze posting", exact: true })
    .click();
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Test Industries",
  );
  await page.getByLabel("Status", { exact: true }).selectOption("applied");
  await page.getByRole("button", { name: "Save case", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: /Cases/ }).first().click();
  await page
    .getByRole("link", { name: "Test Industries", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Software Engineer", exact: true }),
  ).toBeVisible();
  const caseId = page.url().split("/").pop()!;
  await page
    .getByLabel("Application status", { exact: true })
    .selectOption("technical-interview");
  await expect(page.getByLabel("Application status")).toHaveValue(
    "technical-interview",
  );
  await page
    .getByRole("button", { name: "Schedule interview", exact: true })
    .click();
  await page
    .getByLabel("Date and time (your browser's local time)", { exact: true })
    .fill("2026-11-12T10:30");
  await page.getByLabel("Interviewer", { exact: true }).fill("Alex Test");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("With Alex Test")).toBeVisible();
  await page
    .getByRole("button", { name: "Add follow-up", exact: true })
    .click();
  await page.getByLabel("What needs doing?").fill("Send thank-you note");
  await page
    .getByLabel("Due date and time (your browser's local time)")
    .fill("2026-11-13T09:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Send thank-you note", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("With Alex Test")).toBeVisible();
  const isolated = await browser.newContext({
    baseURL: "http://localhost:3000",
  });
  const other = await isolated.newPage();
  await other.goto("/register");
  await other.getByLabel("Name", { exact: true }).fill("Other");
  await other
    .getByLabel("Email", { exact: true })
    .fill(`other-${Date.now()}@example.test`);
  await other.getByLabel("Password", { exact: true }).fill(password);
  await other
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    other.getByRole("heading", { name: "Good evening, Other." }),
  ).toBeVisible();
  const denied = await isolated.request.get(`/api/applications/${caseId}`);
  expect(denied.status()).toBe(404);
  const csrf = await page.request.patch(`/api/applications/${caseId}`, {
    headers: { Origin: "https://evil.example" },
    data: { statusId: "offer" },
  });
  expect(csrf.status()).toBe(403);
  await isolated.close();
  await page.getByRole("link", { name: "Intelligence", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Batcomputer Intelligence" }),
  ).toBeVisible();
  await expect(page.getByText("100%", { exact: true }).first()).toBeVisible();
  const csv = await page.request.get("/api/export?format=csv");
  expect(csv.ok()).toBe(true);
  expect(await csv.text()).toContain("Test Industries");
  const json = await page.request.get("/api/export?format=json");
  expect((await json.json()).applications[0].interviews[0].interviewer).toBe(
    "Alex Test",
  );
  await page.keyboard.press("Control+k");
  await page
    .getByRole("textbox", { name: "Command search" })
    .fill("Test Industries");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: /Test Industries/ })
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Daylight Mode", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page
    .getByRole("link", { name: "Import & export", exact: true })
    .click();
  await page.getByLabel("Choose CSV file").setInputFiles({
    name: "cases.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "company,position,statusId\nImported Corp,Backend Engineer,applied\n",
    ),
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Import 1 rows", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Import report" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Cases/ }).first().click();
  await page.getByRole("button", { name: "Kanban view" }).click();
  await page.getByLabel("Move Imported Corp to status").selectOption("offer");
  await page.reload();
  await page.getByRole("button", { name: "Kanban view" }).click();
  await expect(page.getByLabel("Move Imported Corp to status")).toHaveValue(
    "offer",
  );
  const blocked = await page.request.post("/api/extract", {
    headers: { Origin: "http://localhost:3000" },
    data: { url: "http://127.0.0.1/private" },
  });
  expect(blocked.status()).toBe(422);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Mission control", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good evening, Bruce." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Enter the Batcave", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good evening, Bruce." }),
  ).toBeVisible();
});
