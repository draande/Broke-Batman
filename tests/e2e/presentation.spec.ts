import { test, expect } from "@playwright/test";
test("branding, keyboard controls, dialog focus and every major mobile screen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await expect(page).toHaveTitle("Broke Batman | Job Application Tracker");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /opengraph-image/,
  );
  const icon = await page.request.get("/brand/mark.svg");
  expect(icon.ok()).toBeTruthy();
  expect(icon.headers()["content-type"]).toContain("svg");
  const preview = await page.request.get("/opengraph-image");
  expect(preview.ok()).toBeTruthy();
  expect(preview.headers()["content-type"]).toContain("image/png");
  await page
    .getByRole("button", { name: "Open a private demo workspace" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Good evening, Bruce." }),
  ).toBeVisible();
  for (const key of [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ])
    await page.keyboard.press(key);
  await expect(page.getByRole("status")).toHaveText(/I'm Batman/);
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["dark", "light"]) {
    if (theme === "light") {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("button", { name: "Daylight Mode", exact: true })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    }
    for (const route of [
      "/app",
      "/app/cases",
      "/app/inbox",
      "/app/missions",
      "/app/analytics",
      "/app/skills",
      "/app/companies",
      "/app/transfers",
      "/app/settings",
    ]) {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator(".skeleton")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        route,
      ).toBe(true);
      if (route === "/app/settings") {
        const contrast = await page
          .getByRole("button", { name: "Save preferences" })
          .evaluate((element) => {
            const style = getComputedStyle(element);
            const luminance = (color: string) => {
              const channels = color
                .match(/[\d.]+/g)!
                .slice(0, 3)
                .map((value) => Number(value) / 255)
                .map((value) =>
                  value <= 0.04045
                    ? value / 12.92
                    : ((value + 0.055) / 1.055) ** 2.4,
                );
              return (
                channels[0] * 0.2126 +
                channels[1] * 0.7152 +
                channels[2] * 0.0722
              );
            };
            const foreground = luminance(style.color),
              background = luminance(style.backgroundColor);
            return (
              (Math.max(foreground, background) + 0.05) /
              (Math.min(foreground, background) + 0.05)
            );
          });
        expect(
          contrast,
          `${theme} primary button contrast`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      await page.screenshot({
        path: `test-results/visual/mobile-${theme}-${route.split("/").pop() || "dashboard"}.png`,
        fullPage: true,
      });
      if (route === "/app/cases") {
        await page.getByRole("button", { name: "Kanban view" }).click();
        await expect(page.locator(".kanban-card").first()).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const href = await page
          .locator(".kanban-card a")
          .first()
          .getAttribute("href");
        expect(href).toBeTruthy();
        await page.goto(href!);
        await expect(page.locator("main h1")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/visual/mobile-${theme}-case-detail.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", { name: "Edit case", exact: true })
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        expect(
          await dialog.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return box.left >= 0 && box.right <= innerWidth;
          }),
        ).toBe(true);
        await page.screenshot({
          path: `test-results/visual/mobile-${theme}-case-form.png`,
        });
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
    }
  }
  await page.goto("/app/cases");
  const search = page.getByRole("textbox", {
    name: "Search cases",
    exact: true,
  });
  await search.focus();
  for (const key of [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "b",
    "a",
  ])
    await page.keyboard.press(key);
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.goto("/this-gotham-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Lost in Gotham?" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
