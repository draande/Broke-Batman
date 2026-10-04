import { test, expect } from "@playwright/test";
test("fictional Gmail sync, review, interview, skills, notifications, analytics and disconnect", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Signal Test");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`signals-${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("A-strong-test-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: /Good/ })).toBeVisible();
  for (const company of [
    "Google",
    "Stripe",
    "NVIDIA",
    "Wayne Enterprises",
    "Cyberdyne",
  ]) {
    const r = await page.request.post("/api/applications", {
      headers: { Origin: "http://localhost:3000" },
      data: {
        company,
        position: "Software Engineer",
        statusId: "applied",
        requiredSkills: ["JS", "Postgres"],
      },
    });
    expect(r.ok(), await r.text()).toBeTruthy();
  }
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Try fictional inbox demo" }).click();
  await expect(
    page.getByText("Demo inbox · fictional messages", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("Sync: idle", { exact: false })).toBeVisible({
    timeout: 30000,
  });
  await page.goto("/app/inbox");
  await expect(
    page.getByRole("heading", { name: "Bat-Inbox", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mail-card")).toHaveCount(5);
  const google = page.locator(".mail-card").filter({
    has: page.getByRole("heading", {
      name: "Google Software Engineer interview confirmation",
    }),
  });
  await expect(
    google.getByRole("button", { name: "Approve status" }),
  ).toBeEnabled();
  await google.getByRole("button", { name: "Approve status" }).click();
  await expect(google.getByText("approved ·", { exact: false })).toBeVisible();
  await google
    .getByRole("button", { name: "Add interview", exact: true })
    .click();
  await expect(
    page.getByLabel("Date and time (your device timezone)"),
  ).not.toHaveValue("");
  await page
    .getByRole("button", { name: "Confirm and create interview" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const stripe = page.locator(".mail-card").filter({
    has: page.getByRole("heading", {
      name: "Stripe Software Engineer application update",
    }),
  });
  await stripe.getByRole("button", { name: "Dismiss", exact: true }).click();
  await expect(stripe).toHaveCount(0);
  await page.goto("/app/missions");
  await expect(
    page.getByText("Technical interview · Google", { exact: true }),
  ).toBeVisible();
  await page.goto("/app/skills");
  await page.getByRole("button", { name: "Add skill", exact: true }).click();
  await page.getByLabel("Skill 1", { exact: true }).fill("JS");
  await page.getByLabel("Proficiency 1").selectOption("Strong");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByLabel("Skill 1", { exact: true })).toHaveValue(
    "JavaScript",
  );
  await page.goto("/app/analytics");
  await expect(
    page.getByRole("heading", { name: "Patrol activity", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Source conversion" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Notifications,/ }).click();
  await expect(
    page.getByRole("heading", { name: "Notification center", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark all read" }).click();
  await page.keyboard.press("Escape");
  await page.goto("/app/companies");
  await expect(
    page.getByRole("heading", { name: "Company intelligence" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app/inbox");
  await expect(
    page.getByRole("heading", { name: "Bat-Inbox", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mail-card")).toHaveCount(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/bat-inbox-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "docs/screenshots/bat-inbox.png",
    fullPage: true,
  });
  await page.goto("/app/skills");
  await expect(
    page.getByRole("heading", { name: "Skills profile", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/skills-profile.png",
    fullPage: true,
  });
  await page.goto("/app/analytics");
  await expect(
    page.getByRole("heading", { name: "Patrol activity", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/intelligence-expanded.png",
    fullPage: true,
  });
  await page.goto("/app/settings");
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/app/inbox");
  await expect(page.locator(".mail-card")).toHaveCount(4);
  await page.screenshot({
    path: "docs/screenshots/bat-inbox-daylight.png",
    fullPage: true,
  });
  await page.goto("/app/settings");
  await page
    .getByRole("button", { name: "Disconnect Gmail", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Try fictional inbox demo" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
