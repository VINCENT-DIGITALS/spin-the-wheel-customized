import { test, expect } from "@playwright/test";
const key = "heavenly-fate-v1-demo";
test.beforeEach(async ({ page }) => {
  await page.goto("?demo=1#/dashboard");
});
test("dashboard, participant management, duplicates, prize editing and themes", async ({
  page,
}) => {
  await expect(
    page.getByRole("heading", { name: "Wheel of Heavenly Fate" }),
  ).toBeVisible();
  await expect(page.locator(".time-stat")).toBeVisible();
  await page.getByRole("link", { name: "Participants", exact: true }).click();
  await page
    .getByPlaceholder("@discord_username")
    .fill("@newperson\n@NEWPERSON\n@someoneelse");
  await page
    .getByRole("button", { name: "Add participants", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "2 added · 1 duplicates skipped",
  );
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Remove @newperson", exact: true })
    .click();
  await expect(
    page.getByLabel("Name for @newperson", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Restore last removed" }).click();
  await expect(
    page.getByLabel("Name for @newperson", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Prize pool", exact: true }).click();
  await page.getByRole("button", { name: "Add reward", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Reward name" }).last(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Appearance", exact: true }).click();
  await page.getByLabel("Theme", { exact: true }).selectOption("Minimal Light");
  await expect(page.locator(".app")).toHaveClass(/theme-minimal-light/);
});
test("spin survives pause, refresh, expiry; audience sync; no double processing", async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2030-01-01T00:00:01Z"));
  await page.getByRole("button", { name: "Begin the event" }).click();
  const original = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).event.spin.selectedId,
    key,
  );
  await page.clock.runFor(1000);
  await page.getByRole("button", { name: "Pause spin" }).click();
  await expect(page.getByRole("button", { name: "Resume spin" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Resume spin" })).toBeVisible();
  const audience = await context.newPage();
  await audience.goto("?demo=1#/audience");
  await expect(
    audience.getByRole("button", { name: "Resume spin" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Resume spin" }).click();
  await page.clock.runFor(5000);
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).event.results.length,
        key,
      ),
    )
    .toBeGreaterThanOrEqual(1);
  expect(
    await page.evaluate(
      (k) =>
        JSON.parse(localStorage.getItem(k)!).event.results[0].participantId,
      key,
    ),
  ).toBe(original);
  await expect(audience.getByText("9 remain", { exact: true })).toBeVisible();
  await page.reload();
  expect(
    await page.evaluate(
      (k) =>
        JSON.parse(localStorage.getItem(k)!).event.results.filter(
          (r: { participantId: string }) =>
            r.participantId ===
            JSON.parse(localStorage.getItem(k)!).event.results[0].participantId,
        ).length,
      key,
    ),
  ).toBe(1);
});
test("complete demo, champion exports, backup, mobile overflow and official separation", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2030-01-01T00:00:01Z"));
  await page.getByRole("button", { name: "Begin the event" }).click();
  await expect(page.getByRole("button", { name: "Pause spin" })).toBeVisible();
  for (let i = 0; i < 150; i++) {
    await page.clock.runFor(1000);
    const status = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).event.status,
      key,
    );
    if (status === "Completed") break;
  }
  await expect(
    page.getByText("HEAVENLY FATE CHAMPION", { exact: false }).last(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).event.results.length,
      key,
    ),
  ).toBe(9);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Winner image" }).click();
  expect((await download).suggestedFilename()).toBe(
    "heavenly-fate-champion.png",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Winner image" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Import & export" }).click();
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download full backup" }).click();
  expect((await backup).suggestedFilename()).toBe("heavenly-fate-backup.json");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("./#/dashboard");
  await expect(page.locator(".time-stat")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Begin the event" }),
  ).toBeVisible();
});
test("all sections render without browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of [
    "live",
    "participants",
    "prizes",
    "configuration",
    "history",
    "appearance",
    "audio",
    "data",
    "settings",
    "help",
    "audience",
  ]) {
    await page.goto(`?demo=1#/${path}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByText("The heavens need a moment")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
test("two hosts reconcile an expired spin once and keep selection on refresh", async ({
  page,
  context,
}) => {
  await page.getByRole("button", { name: "Begin the event" }).click();
  await expect(page.getByRole("button", { name: "Pause spin" })).toBeVisible();
  const id = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).event.spin.selectedId,
    key,
  );
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k)!);
    s.event.spin.startedAt = Date.now() - 6000;
    s.event.config.auto = false;
    localStorage.setItem(k, JSON.stringify(s));
  }, key);
  const second = await context.newPage();
  await Promise.all([page.reload(), second.goto("?demo=1#/dashboard")]);
  await expect(
    page.getByRole("button", { name: "Start next round" }),
  ).toBeVisible();
  await expect(
    second.getByRole("button", { name: "Start next round" }),
  ).toBeVisible();
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(saved.event.results).toHaveLength(1);
  expect(saved.event.results[0].participantId).toBe(id);
  const color = await page.locator("canvas").evaluate((canvas) => {
    const c = canvas as HTMLCanvasElement;
    const ctx = c.getContext("2d")!;
    return [
      ...ctx.getImageData(
        Math.floor(c.width * 0.53),
        Math.floor(c.height * 0.12),
        1,
        1,
      ).data,
    ].slice(0, 3);
  });
  const hex = saved.event.spin.pool.find(
    (p: { id: string }) => p.id === id,
  ).color;
  expect(color).toEqual(
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
  );

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start next round" }),
  ).toBeVisible();
});
test("backup restore validates corruption and round-trips data", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Event configuration" }).click();
  await page.getByLabel("Event title", { exact: true }).fill("Backup test");
  await page.getByRole("link", { name: "Import & export" }).click();
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  await page.getByLabel("Restore a full backup").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).event.config.title,
      key,
    ),
  ).toBe("Backup test");
  page.on("dialog", (d) => d.accept());
  await page.getByLabel("Restore a full backup").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ state: saved, assets: [] })),
  });
  await expect
    .poll(() =>
      page.evaluate((k) => JSON.parse(localStorage.getItem(k)!).revision, key),
    )
    .toBeGreaterThan(saved.revision);
});
test("winner and survival modes operate through configuration UI", async ({
  page,
}) => {
  await page.getByRole("link", { name: "Event configuration" }).click();
  await page.getByLabel("Game mode").selectOption("winner");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Begin the event" }).click();
  await expect(page.getByRole("button", { name: "Winner image" })).toBeVisible({
    timeout: 12000,
  });
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).event.winners.length,
      key,
    ),
  ).toBe(1);
  await page.getByRole("link", { name: "General settings" }).click();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "New event with defaults" }).click();
  await page.getByRole("link", { name: "Event configuration" }).click();
  await page.getByLabel("Game mode").selectOption("survival");
  await page.getByLabel("Starting lives").fill("2");
  await page.getByLabel("Automatically start the next round").click();
  await expect(
    page.getByLabel("Automatically start the next round"),
  ).not.toBeChecked();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Begin the event" }).click();
  await expect(
    page.getByRole("button", { name: "Start next round" }),
  ).toBeVisible({ timeout: 12000 });
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).event.results[0].livesLeft,
      key,
    ),
  ).toBe(1);
});
test("desktop and mobile visual layouts, audio preferences and multi-hour configuration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Event configuration" }).click();
  await page.getByRole("button", { name: "24h", exact: true }).click();
  await expect(page.getByLabel("Spin duration Hours")).toHaveValue("24");
  await page.getByRole("link", { name: "Audio settings" }).click();
  await page.getByLabel("Mute all audio").click();
  await expect(page.getByLabel("Mute all audio")).not.toBeChecked();
  await page
    .getByRole("button", { name: "Preview victory", exact: true })
    .click();
  await expect(page.getByLabel("Mute all audio")).not.toBeChecked();
  await page.reload();
  await expect(page.getByLabel("Mute all audio")).not.toBeChecked();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("?demo=1#/dashboard");
  await expect(
    page.getByRole("button", { name: "Toggle navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Participants", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
});
