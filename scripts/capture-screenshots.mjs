import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { URL } from "node:url";
const browser = await chromium.launch();
const baseURL = process.env.APP_URL || "http://localhost:3000";
const context = await browser.newContext({
  baseURL,
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const origin = new URL(baseURL).origin;
await mkdir("docs/screenshots", { recursive: true });
async function capture(name) {
  await page.locator("main h1").waitFor();
  await expect(page.locator(".skeleton")).toHaveCount(0, { timeout: 60000 });
  await page.screenshot({
    path: `docs/screenshots/${name}.png`,
    fullPage: ["cases", "case-detail", "bat-inbox-mobile"].includes(name),
  });
}
try {
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Open a private demo workspace" })
    .click();
  await page
    .getByRole("heading", { name: "Good evening, Bruce." })
    .waitFor({ timeout: 60000 });
  await page.locator(".recharts-surface").first().waitFor();
  await capture("dashboard");
  await page.goto("/app/cases");
  await page.getByRole("table").waitFor();
  await capture("cases");
  const dossier = await page
    .locator('tbody a[href^="/app/cases/"]')
    .first()
    .getAttribute("href");
  if (!dossier) throw new Error("No demo case available for detail capture.");
  await page.goto(dossier);
  await capture("case-detail");
  await page.goto("/app/cases");
  await page.getByRole("button", { name: "Kanban view" }).click();
  await page.locator(".kanban-card").first().waitFor();
  await capture("kanban");
  // Matching examples are fictional, even where the employer name is real.
  for (const company of ["Google", "Stripe", "NVIDIA", "Cyberdyne"]) {
    const response = await page.request.post("/api/applications", {
      headers: { Origin: origin },
      data: { company, position: "Software Engineer", statusId: "applied" },
    });
    if (!response.ok())
      throw new Error(`Demo case creation failed (${response.status()}).`);
  }
  await page.goto("/app/settings");
  await page.getByRole("button", { name: "Try fictional inbox demo" }).click();
  await expect(page.getByText("Sync: idle", { exact: false })).toBeVisible({
    timeout: 60000,
  });
  await page.goto("/app/inbox");
  await expect(page.locator(".mail-card")).toHaveCount(5);
  await capture("bat-inbox");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("bat-inbox-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Daylight Mode", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await capture("bat-inbox-daylight");
  await page.getByRole("button", { name: "Batcave Mode", exact: true }).click();
  await page.goto("/app/skills");
  await page.getByRole("heading", { name: "Skills profile" }).waitFor();
  await capture("skills-profile");
  await page.goto("/app/analytics");
  await page
    .getByRole("heading", { name: "Historical funnel", exact: true })
    .waitFor();
  await page.locator(".recharts-surface").first().waitFor();
  await capture("intelligence-expanded");
  if (errors.length)
    throw new Error(`${errors.length} browser exceptions during capture.`);
  console.log("Captured nine intentional portfolio screenshots.");
} finally {
  await browser.close();
}
