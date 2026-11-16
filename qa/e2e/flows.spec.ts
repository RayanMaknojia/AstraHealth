/**
 * User flows: click and type like a crew member and check the result.
 * Runs at a phone, a tablet and a laptop size (see FLOW_PROJECTS).
 */
import { expect, test, type Page } from "@playwright/test";
import { dismissAlerts, goTo, login, offlineAi, recordSpeech, watchHealth } from "./helpers";

test.beforeEach(async ({ page }) => {
  await offlineAi(page);
});

const FLOW_PROJECTS = ["phone-390", "tablet-768", "laptop-1440"];
// eslint-disable-next-line no-empty-pattern -- Playwright needs a destructured first argument
test.beforeEach(({}, testInfo) => {
  test.skip(!FLOW_PROJECTS.includes(testInfo.project.name), "flows run at phone, tablet and laptop sizes");
});

const title = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });
/** Real dialogs (the app's toast notifications also use role="dialog"). */
const dialog = (page: Page) => page.locator("[role=dialog]:not([data-slot=toast])");
const noJsErrors = (issues: ReturnType<typeof watchHealth>) =>
  expect(issues.filter((i) => i.type === "js-exception"), issues.map((i) => i.detail).join("\n")).toHaveLength(0);

// 1x1 transparent PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

test("F01 login: wrong PIN shows an error, right PIN opens the app, reload keeps you logged in", async ({ page }) => {
  const issues = watchHealth(page);
  await page.goto("/");
  await page.getByPlaceholder("e.g. mars_crew").fill("mars_crew");
  await page.getByPlaceholder("Enter your PIN").fill("0000");
  await page.getByRole("button", { name: /Log in/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await login(page);
  await expect(title(page, "Mission overview")).toBeVisible();
  await page.reload();
  await dismissAlerts(page);
  await expect(title(page, "Mission overview")).toBeVisible();
  noJsErrors(issues);
});

test("F02 navigation: every page opens with its title", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page);
  for (const [nav, h] of [
    ["Check-in", "Check-in & journal"],
    ["Body Map", "Body Map & Countermeasures"],
    ["Trends", "Health trends"],
    ["More", "Cabin, guidance & references"],
    ["Home", "Mission overview"],
  ]) {
    await goTo(page, nav);
    await expect(title(page, h)).toBeVisible();
  }
  noJsErrors(issues);
});

test("F03 check-in: empty save lists the required fields; a complete save updates Home", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page);
  await goTo(page, "Check-in");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByText(/Still needed \(\d+\)/)).toBeVisible();
  await expect(page.getByText(/Still needed/)).toContainText("Body temperature");

  await page.getByRole("spinbutton", { name: /Body temperature/ }).fill("36.8");
  for (const r of ["Mood", "Sleep quality", "Energy / fatigue", "Stress"])
    await page.getByRole("slider", { name: new RegExp(r) }).first().fill("4");
  await page.getByRole("spinbutton", { name: /Resting heart rate/ }).fill("63");
  await page.getByRole("button", { name: "Save check-in" }).click();
  await page.waitForTimeout(1500);
  await dismissAlerts(page);
  await expect(page.getByText(/Still needed/)).toHaveCount(0);
  await goTo(page, "Home");
  await expect(page.getByRole("region", { name: "Primary vitals" })).toContainText("63");
  noJsErrors(issues);
});

test("F04 Home: vital tile opens Trends on that indicator; full briefing opens and closes", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page);
  await page.getByRole("region", { name: "Primary vitals" }).getByRole("button", { name: /Blood Pressure/ }).click();
  await expect(title(page, "Health trends")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Indicator" })).toHaveValue("blood_pressure");
  await goTo(page, "Home");
  await page.getByRole("button", { name: /Full briefing/ }).first().click();
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  noJsErrors(issues);
});

test("F05 Home body scan: runs to completion and a region opens Body Map", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page);
  await page.getByRole("button", { name: /Start scan|Scan again/ }).click();
  await expect(page.getByText(/Scan complete/)).toBeVisible({ timeout: 25_000 });
  await dismissAlerts(page);
  await page.locator("[data-region=chest] path").click();
  await expect(title(page, "Body Map & Countermeasures")).toBeVisible();
  noJsErrors(issues);
});

test("F06 Trends: every indicator and timeframe renders a chart", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page);
  await goTo(page, "Trends");
  const select = page.getByRole("combobox", { name: "Indicator" });
  const values = await select.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(values.length).toBeGreaterThanOrEqual(9);
  for (const v of values) {
    await select.selectOption(v);
    for (const tf of ["1D", "7D", "30D", "Mission"]) {
      const b = page.getByRole("group", { name: "History timeframe" }).getByRole("button", { name: tf });
      if (!(await b.count())) continue;
      await b.click();
      await expect(b).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.locator(".recharts-wrapper, .chart-empty").first()).toBeVisible();
  }
  await page.getByRole("button", { name: /Measurement guide/ }).click();
  await expect(dialog(page)).toBeVisible();
  noJsErrors(issues);
});

test("F07 Body Map: each organ card selects its system; checklist toggles; trends link works", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page);
  await goTo(page, "Body Map");
  const cards = page.getByRole("region", { name: "Body systems" }).getByRole("button");
  for (const [card, heading] of [
    ["Brain and wellbeing", "Brain & wellbeing"],
    ["Heart and circulation", "Heart & circulation"],
    ["Metabolism", "Metabolism"],
    ["Immune and radiation", "Immune & radiation"],
    ["Bones and muscle", "Bones & muscles"],
  ]) {
    await cards.filter({ hasText: card }).first().click();
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect(cards.filter({ hasText: card }).first()).toHaveAttribute("aria-pressed", "true");
  }
  const box = page.locator(".system-countermeasure-tasks input[type=checkbox]").first();
  const before = await box.isChecked();
  await box.click();
  await expect(box).toBeChecked({ checked: !before });
  await page.getByRole("button", { name: /View trends for this system/ }).click();
  await expect(title(page, "Health trends")).toBeVisible();
  noJsErrors(issues);
});

test("F08 More: every tab shows its panel; reference links are valid web links", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page);
  await goTo(page, "More");
  for (const t of ["Cabin readings", "My records", "Past journal entries", "Guidance & triage", "References"]) {
    await page.getByRole("tablist", { name: "More sections" }).getByRole("tab", { name: t }).click();
    await expect(page.getByRole("tabpanel").first()).toBeVisible();
  }
  const hrefs = await page.locator(".reference-links a").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.length).toBeGreaterThan(20);
  for (const h of hrefs) expect(h).toMatch(/^https:\/\//);
  noJsErrors(issues);
});

test("F09 critical alert: lists the alert and Confirm returns to the dashboard", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page, "mars_crew", "1111", { keepAlerts: true });
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText(/Do this now/);
  await dialog(page).getByRole("button", { name: /Notify crew/ }).click();
  await expect(dialog(page)).toBeVisible();
  await dismissAlerts(page);
  await expect(dialog(page)).toHaveCount(0);
  await expect(title(page, "Mission overview")).toBeVisible();
  noJsErrors(issues);
});

test("F10 solar storm: shelter alert names a real NASA DONKI event", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page, "iss_crew", "2222");
  await page.getByText("Mission Control").first().click();
  await page.getByRole("button", { name: /Trigger Solar Storm/ }).click();
  const storm = page.getByRole("dialog", { name: /Radiation Storm/ });
  await expect(storm).toBeVisible({ timeout: 20_000 });
  await expect(storm).toContainText(/shelter/i);
  await expect(storm).toContainText(/DONKI/);
  await dismissAlerts(page);
  await expect(dialog(page)).toHaveCount(0);
  noJsErrors(issues);
});

test("F11 SOS button: sends immediately and lists who receives it", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page, "iss_crew", "2222");
  await page.getByRole("button", { name: /^\s*SOS\s*$/ }).click();
  const sos = page.getByRole("dialog", { name: /Medical Emergency \(SOS\)/ });
  await expect(sos).toBeVisible();
  await expect(sos).toContainText(/SOS sent to/);
  await dismissAlerts(page);
  await expect(dialog(page)).toHaveCount(0);
  noJsErrors(issues);
});

test("F11b automatic SOS: a 40.2 °C check-in opens a countdown that can be cancelled", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page, "iss_crew", "2222");
  await goTo(page, "Check-in");
  await page.getByRole("spinbutton", { name: /Body temperature/ }).fill("40.2");
  // Tap each rating slider in the middle (= 3/5), like a real user.
  for (const r of ["Mood", "Sleep quality", "Energy / fatigue", "Stress"])
    await page.getByRole("slider", { name: new RegExp(r) }).first().click();
  await page.getByRole("button", { name: "Save check-in" }).click();
  const countdown = page.getByRole("dialog", { name: /sending SOS in/ });
  await expect(countdown).toBeVisible({ timeout: 20_000 });
  await countdown.getByRole("button", { name: /I.m OK, cancel/ }).click();
  await expect(countdown).toHaveCount(0);
  noJsErrors(issues);
});

test("F12 photo check: picking an image shows a preview", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page);
  await goTo(page, "Check-in");
  await page.getByLabel("Skin problem").check();
  await page.getByRole("button", { name: "Add photo", exact: true }).click();
  const input = dialog(page).locator("input[type=file]").first();
  await input.setInputFiles({ name: "skin-test.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator(".photo-check-preview").first()).toBeVisible();
  noJsErrors(issues);
});

test("F13 journal: entry saves on the device and appears in More → Past journal entries", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page);
  await goTo(page, "Check-in");
  const text = `QA journal ${Date.now()}`;
  await page.getByPlaceholder(/Write freely about how you're feeling/).fill(text);
  await page.getByRole("button", { name: /Save journal entry/ }).click();
  await goTo(page, "More");
  await page.getByRole("tablist", { name: "More sections" }).getByRole("tab", { name: "Past journal entries" }).click();
  await expect(page.getByText(text)).toBeVisible();
  noJsErrors(issues);
});

test("F14 admin: create an astronaut, then log out", async ({ page }) => {
  const issues = watchHealth(page);
  await login(page, "admin", "0000");
  await page.locator("#new-name").fill("QA Test Astronaut");
  await page.locator("#new-login").fill(`qa_${Date.now() % 100000}`);
  await page.locator("#new-pin").fill("4321");
  await page.locator("#new-date").fill("2027-03-01");
  await page.getByRole("button", { name: /Create account/ }).click();
  await expect(page.getByText("QA Test Astronaut").first()).toBeVisible();
  await page.getByRole("button", { name: /Log out|Return to login/ }).first().click();
  await expect(page.getByPlaceholder("e.g. mars_crew")).toBeVisible();
  noJsErrors(issues);
});

test("F15 logout from the app returns to the login screen", async ({ page }) => {
  await login(page);
  const visibleLogout = page.getByRole("button", { name: /Log out/ }).filter({ visible: true });
  if (!(await visibleLogout.count())) await goTo(page, "More");
  await page.getByRole("button", { name: /Log out/ }).filter({ visible: true }).first().click();
  await expect(page.getByPlaceholder("e.g. mars_crew")).toBeVisible();
});

test("F16 keyboard: navigation works with Tab/Enter and focus is visible", async ({ page }) => {
  await login(page);
  const navBtn = page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: /Trends/ });
  await navBtn.focus();
  const outline = await navBtn.evaluate((el) => {
    const s = getComputedStyle(el);
    return `${s.outlineStyle} ${s.outlineWidth} ${s.boxShadow}`;
  });
  expect(outline, "focused nav button should show a focus ring").not.toMatch(/^none 0px none$/);
  await page.keyboard.press("Enter");
  await expect(title(page, "Health trends")).toBeVisible();
});

test("F17 reduced motion: Body Map organs stop animating", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page);
  await goTo(page, "Body Map");
  // The organs are 3D canvases that spin; with reduced motion two frames 1.5 s apart must match.
  const canvas = page.locator(".organ-card canvas").first();
  await canvas.scrollIntoViewIfNeeded(); // off-screen canvases do not render
  await expect(canvas).toBeVisible();
  await expect(page.locator(".model-error")).toHaveCount(0);
  // Share of pixels that differ between two frames 1.5 s apart. CSS animations are frozen (the
  // card glow shows through the transparent canvas); stars twinkling behind it change a few pixels,
  // a spinning organ changes thousands.
  const frameChange = async () => {
    const first = await canvas.screenshot({ animations: "disabled" });
    await page.waitForTimeout(1500);
    const second = await canvas.screenshot({ animations: "disabled" });
    return page.evaluate(
      async ([a, b]) => {
        const load = (src: string) =>
          new Promise<HTMLImageElement>((ok) => {
            const img = new Image();
            img.onload = () => ok(img);
            img.src = `data:image/png;base64,${src}`;
          });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const px = (img: HTMLImageElement) => {
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const g = c.getContext("2d")!;
          g.drawImage(img, 0, 0);
          return g.getImageData(0, 0, c.width, c.height).data;
        };
        const da = px(ia), db = px(ib);
        let n = 0;
        for (let i = 0; i < da.length; i += 4)
          if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 30) n++;
        return n / (da.length / 4);
      },
      [first.toString("base64"), second.toString("base64")],
    );
  };
  // The model may still be downloading and framing itself (slower on the live site), so keep
  // comparing until it holds still. A spinning organ never does, and the test fails after 20 s.
  await expect.poll(frameChange, { timeout: 20_000, intervals: [0] }).toBeLessThan(0.005);
});

test("F18 login welcome: shows and speaks the astronaut's title and surname, then the alert opens", async ({ page }) => {
  const issues = watchHealth(page);
  await recordSpeech(page);
  await page.goto("/");
  await page.getByPlaceholder("e.g. mars_crew").fill("mars_crew");
  await page.getByPlaceholder("Enter your PIN").fill("1111");
  await page.getByRole("button", { name: /Log in/ }).click();
  const welcome = page.locator(".welcome-screen");
  await expect(welcome).toContainText("Welcome,");
  await expect(welcome).toContainText("Doctor Lavoie");
  // The health alert waits until the welcome is gone.
  await expect(page.getByRole("dialog").filter({ hasText: /Do this now/ })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(["Welcome, Doctor Lavoie"]);
  // Fades out on its own after ~3 s, then the Mars crew's alert opens.
  await expect(welcome).toHaveCount(0, { timeout: 6000 });
  await expect(page.getByRole("dialog").filter({ hasText: /Do this now/ })).toBeVisible();
  // A reload keeps the session but does not repeat the welcome.
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(welcome).toHaveCount(0);
  noJsErrors(issues);
});

test("F18b login welcome: the ISS commander is greeted 'Commander Okafor' and Esc skips it", async ({ page }) => {
  await recordSpeech(page);
  await page.goto("/");
  await page.getByPlaceholder("e.g. mars_crew").fill("iss_crew");
  await page.getByPlaceholder("Enter your PIN").fill("2222");
  await page.getByRole("button", { name: /Log in/ }).click();
  const welcome = page.locator(".welcome-screen");
  await expect(welcome).toContainText("Commander Okafor");
  await page.keyboard.press("Escape");
  await expect(welcome).toHaveCount(0, { timeout: 2000 });
  await expect(page.locator(".mission-sidebar")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toEqual(["Welcome, Commander Okafor"]);
});

test("F19 body scan voice: says 'Scanning now', then 'Scan complete, vitals updated' once readings are saved", async ({ page }) => {
  const issues = watchHealth(page);
  await recordSpeech(page);
  await login(page);
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.filter((t) => !t.startsWith("Welcome")));
  await page.getByRole("button", { name: /Start scan/ }).click();
  await expect.poll(spoken).toEqual(["Scanning now"]);
  // The beam runs ~5 s; the completion line comes after it, not before.
  await page.waitForTimeout(2000);
  expect(await spoken()).toEqual(["Scanning now"]);
  await expect(page.getByText(/Scan complete ·/)).toBeVisible({ timeout: 10_000 });
  await expect.poll(spoken).toEqual(["Scanning now", "Scan complete, vitals updated"]);
  noJsErrors(issues);
});
