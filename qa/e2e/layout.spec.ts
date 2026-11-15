/**
 * Layout & health audit: every screen and state at every screen size.
 * Findings are written per state; the report is built from them.
 * The test only fails on JavaScript exceptions; layout findings are reported, not asserted.
 */
import { expect, test } from "@playwright/test";
import { audit, dismissAlerts, goTo, login, watchHealth } from "./helpers";

const AXE_PROJECTS = ["phone-390", "laptop-1440"];

test("audit every screen", async ({ page }, testInfo) => {
  const health = watchHealth(page);
  const axe = AXE_PROJECTS.includes(testInfo.project.name);
  const a = (state: string) => audit(page, testInfo, state, health, { axe });

  // Login screen.
  await page.goto("/");
  await expect(page.getByPlaceholder("e.g. mars_crew")).toBeVisible();
  await a("01-login");

  // Wrong PIN error state.
  await page.getByPlaceholder("e.g. mars_crew").fill("mars_crew");
  await page.getByPlaceholder("Enter your PIN").fill("9999");
  await page.getByRole("button", { name: /Log in/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await a("02-login-wrong-pin");

  // Log in; the Mars demo opens a critical alert straight away.
  await login(page, "mars_crew", "1111", { keepAlerts: true });
  if (await page.getByRole("dialog").count()) await a("03-critical-alert");

  // SOS raised on top of the open alert → tall two-alert dialog.
  const sosBtn = page.getByRole("button", { name: /^\s*SOS\s*$/ });
  if (await sosBtn.isVisible().catch(() => false)) {
    await sosBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    if (await page.getByRole("dialog").count()) await a("04-alert-plus-sos");
  }
  await dismissAlerts(page);

  await a("10-home");
  // Full briefing drawer.
  const full = page.getByRole("button", { name: /Full briefing/ });
  if (await full.count()) {
    await full.first().click();
    await page.waitForTimeout(600);
    await a("11-home-full-briefing");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  // Demo controls opened.
  const demo = page.getByText("Mission Control", { exact: false }).first();
  if (await demo.isVisible().catch(() => false)) {
    await demo.click();
    await page.waitForTimeout(400);
    await a("12-home-demo-controls");
    await demo.click();
  }

  await goTo(page, "Check-in");
  await a("20-checkin-daily");
  for (const [tab, state] of [
    [/^Weekly/, "21-checkin-weekly"],
    [/^Monthly/, "22-checkin-monthly"],
  ] as const) {
    const t = page.getByRole("tablist", { name: "Check-in cadence" }).getByRole("tab", { name: tab });
    if (await t.count()) {
      await t.click();
      await page.waitForTimeout(600);
      await a(state);
    }
  }

  await goTo(page, "Body Map");
  await a("30-body-map");

  await goTo(page, "Trends");
  await a("40-trends");

  await goTo(page, "More");
  const tabs = ["Cabin readings", "My records", "Past journal entries", "Guidance & triage", "References"];
  for (let i = 0; i < tabs.length; i++) {
    await page.getByRole("tablist", { name: "More sections" }).getByRole("tab", { name: tabs[i] }).click();
    await page.waitForTimeout(600);
    await a(`5${i}-more-${tabs[i].toLowerCase().replace(/[^a-z]+/g, "-")}`);
  }

  // Admin screen.
  await page.context().clearCookies();
  // Logins last for the browser tab (sessionStorage), so clear both and reload.
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/");
  await login(page, "admin", "0000");
  await a("60-admin");
});
