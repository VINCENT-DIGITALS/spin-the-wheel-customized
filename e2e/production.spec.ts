import { test, expect } from "@playwright/test";
test("production assets use the GitHub Pages base and work offline after installation", async ({
  page,
  context,
}) => {
  const failed: string[] = [];
  page.on("requestfailed", (r) => failed.push(r.url()));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "Wheel of Heavenly Fate" }),
  ).toBeVisible();
  await expect(page.locator(".time-stat")).toContainText("04:31:20");
  const paths = await page
    .locator("script[src],link[rel=stylesheet]")
    .evaluateAll((elements) =>
      elements.map((el) => el.getAttribute("src") ?? el.getAttribute("href")),
    );
  expect(
    paths.every((p) => p?.startsWith("/spin-the-wheel-customized/assets/")),
  ).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Begin the event" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Participants", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "10 participants" }),
  ).toBeVisible();
  expect(failed).toEqual([]);
});
