import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: "http://localhost:3000",
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir("docs/screenshots", { recursive: true });
await page.goto("/");
await page.screenshot({ path: "docs/screenshots/landing.png", fullPage: true });
await page.goto("/login");
await page
  .getByRole("button", { name: "Open a private demo workspace" })
  .click();
await page
  .getByRole("heading", { name: "Good evening, Bruce." })
  .waitFor({ timeout: 60000 });
await page.locator(".recharts-surface").first().waitFor();
await page.screenshot({
  path: "docs/screenshots/dashboard.png",
  fullPage: true,
});
await page.getByRole("link", { name: /Cases/ }).first().click();
await page.getByRole("table").waitFor();
await page.screenshot({ path: "docs/screenshots/cases.png", fullPage: true });
await page.getByRole("button", { name: "Kanban view" }).click();
await page.locator(".kanban-card").first().waitFor();
await page.screenshot({ path: "docs/screenshots/kanban.png", fullPage: true });
await page.getByRole("link", { name: "Intelligence", exact: true }).click();
await page.getByRole("heading", { name: "Hiring funnel" }).waitFor();
await page.locator(".recharts-surface").first().waitFor();
await page.screenshot({
  path: "docs/screenshots/analytics.png",
  fullPage: true,
});
await page.getByRole("link", { name: "Mission control", exact: true }).click();
await page.getByRole("heading", { name: "Good evening, Bruce." }).waitFor();
await page.getByRole("button", { name: "Daylight Mode", exact: true }).click();
await page.waitForFunction(
  () => document.documentElement.dataset.theme === "light",
);
await page.screenshot({
  path: "docs/screenshots/daylight.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Batcave Mode", exact: true }).click();
await page.waitForFunction(
  () => document.documentElement.dataset.theme === "dark",
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "docs/screenshots/mobile.png", fullPage: true });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
console.log(
  JSON.stringify({
    screenshots: 7,
    pageErrors: errors,
    mobileOverflow: overflow,
  }),
);
await browser.close();
if (errors.length || overflow) process.exitCode = 1;
