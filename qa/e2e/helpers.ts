/**
 * Shared helpers for the frontend QA: login, navigation, alert handling,
 * and the layout / health audit run on every page at every screen size.
 */
import { expect, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const RESULTS = join(import.meta.dirname, ".results");
export const SCREENS = join(import.meta.dirname, "screens");

export interface Finding {
  type: string;
  severity: "high" | "medium" | "low";
  detail: string;
  element?: string;
}

/** Collect console errors, uncaught errors and failed requests for a page. */
/**
 * Answer AI requests with "offline" so test runs never spend the team's Gemini quota
 * (hundreds of logins per run hit the rate limit). The app's offline path is what we test.
 */
export async function offlineAi(page: Page) {
  await page.route("**/api/ai/**", (route) => route.fulfill({ json: { ok: false, error: "offline_mode" } }));
}

export function watchHealth(page: Page) {
  const issues: Finding[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    const ai = /\/api\//.test(text);
    issues.push({ type: ai ? "ai-server-offline" : "console-error", severity: ai ? "low" : "high", detail: text.slice(0, 300) });
  });
  page.on("pageerror", (e) => issues.push({ type: "js-exception", severity: "high", detail: String(e.message).slice(0, 300) }));
  page.on("response", (r) => {
    if (r.status() < 400) return;
    const url = r.url();
    const ai = url.includes("/api/");
    issues.push({ type: ai ? "ai-server-offline" : "http-error", severity: ai ? "low" : "high", detail: `${r.status()} ${url}` });
  });
  page.on("requestfailed", (r) => {
    const url = r.url();
    if (url.startsWith("data:")) return;
    const ai = url.includes("/api/");
    issues.push({ type: ai ? "ai-server-offline" : "request-failed", severity: ai ? "low" : "medium", detail: `${r.failure()?.errorText} ${url}` });
  });
  return issues;
}

/** Click every Confirm / Confirm all on open alert dialogs (local demo data only). */
export async function dismissAlerts(page: Page, rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    const btn = page.getByRole("dialog").getByRole("button", { name: /^\s*Confirm( all)?\s*$/ });
    if (!(await btn.count())) {
      await page.waitForTimeout(400);
      if (!(await btn.count())) return;
    }
    await btn.first().click();
    await page.waitForTimeout(500);
  }
}

export async function login(page: Page, user = "mars_crew", pin = "1111", opts: { keepAlerts?: boolean } = {}) {
  await page.goto("/");
  await page.getByPlaceholder("e.g. mars_crew").fill(user);
  await page.getByPlaceholder("Enter your PIN").fill(pin);
  await page.getByRole("button", { name: /Log in/ }).click();
  await skipWelcome(page);
  // An alert dialog may open straight away and hide the page from role queries.
  await expect(page.locator(".mission-sidebar, [role=dialog]").or(page.getByText(/Create astronaut/)).first()).toBeVisible();
  await page.waitForTimeout(800);
  if (!opts.keepAlerts) await dismissAlerts(page);
}

/** The login welcome ("Welcome, Doctor Lavoie") covers the screen for ~3 s; Esc skips it. */
export async function skipWelcome(page: Page) {
  const welcome = page.locator(".welcome-screen");
  if (await welcome.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false)) {
    await page.keyboard.press("Escape");
    await welcome.waitFor({ state: "detached", timeout: 5000 });
  }
}

/** Record what the app asks the browser to say (and keep the test run silent). */
export async function recordSpeech(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken: string[] };
    w.__spoken = [];
    if ("speechSynthesis" in window)
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
        w.__spoken.push(u.text);
        setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 10);
      };
  });
}

export async function goTo(page: Page, name: string) {
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: new RegExp(`^\\s*${name}`) }).click();
  await page.waitForTimeout(900);
}

/** Layout checks that run inside the page. */
async function layoutFindings(page: Page, mobile: boolean): Promise<Finding[]> {
  return page.evaluate((mobile) => {
    const out: { type: string; severity: "high" | "medium" | "low"; detail: string; element?: string }[] = [];
    const vw = window.innerWidth, vh = window.innerHeight;
    const doc = document.documentElement;
    const desc = (el: Element) => {
      const name = (el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("placeholder") || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 60);
      const cls = (el.getAttribute("class") || "").split(" ").filter(Boolean).slice(0, 2).join(".");
      return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}> "${name}"`;
    };
    const visible = (el: Element) => {
      // Content of a closed <details> keeps its box but is not shown.
      const closed = el.closest("details:not([open])");
      if (closed && !el.closest("summary") && el !== closed) return false;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const scrollsX = (a: Element) => /(auto|scroll)/.test(getComputedStyle(a).overflowX) && a.scrollWidth > a.clientWidth + 1;
    const scrollsY = (a: Element) => /(auto|scroll)/.test(getComputedStyle(a).overflowY) && a.scrollHeight > a.clientHeight + 1;

    if (doc.scrollWidth > vw + 1) {
      const wide = [...document.body.querySelectorAll("*")]
        .filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1 && !(el.parentElement && el.parentElement.getBoundingClientRect().right > vw + 1))
        .slice(0, 4)
        .map(desc)
        .join("; ");
      out.push({ type: "horizontal-scroll", severity: "high", detail: `Page is ${doc.scrollWidth}px wide in a ${vw}px window. Widest: ${wide}` });
    }

    const interactive = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=slider]')].filter(visible);
    for (const el of interactive) {
      const r = el.getBoundingClientRect();
      // Horizontally off-screen (and not inside a horizontal scroller).
      if (r.right > vw + 1 || r.left < -1) {
        let a: Element | null = el.parentElement, inScroller = false;
        while (a) { if (scrollsX(a)) { inScroller = true; break; } a = a.parentElement; }
        if (!inScroller) out.push({ type: "offscreen-x", severity: "high", detail: `Control sticks out of the window (left ${Math.round(r.left)}, right ${Math.round(r.right)}, window ${vw})`, element: desc(el) });
      }
      // Inside a fixed/sticky panel and below the window with no way to scroll to it.
      let a: Element | null = el.parentElement, fixed: Element | null = null, scroller = false;
      while (a) {
        const pos = getComputedStyle(a).position;
        if (scrollsY(a)) scroller = true;
        if (pos === "fixed") { fixed = a; break; }
        a = a.parentElement;
      }
      if (fixed && !scroller && (r.bottom > vh + 1 || r.top < -1))
        out.push({ type: "unreachable", severity: "high", detail: `Control is in a fixed panel but outside the window (top ${Math.round(r.top)}, bottom ${Math.round(r.bottom)}, window height ${vh}) and the panel cannot scroll`, element: desc(el) });
      // Clipped by an overflow:hidden ancestor.
      a = el.parentElement;
      while (a && a !== document.body) {
        const s = getComputedStyle(a);
        if (/(hidden|clip)/.test(s.overflowX + s.overflowY) && !scrollsY(a) && !scrollsX(a)) {
          const ar = a.getBoundingClientRect();
          if (ar.width > 2 && ar.height > 2 && (r.right > ar.right + 2 || r.left < ar.left - 2 || r.bottom > ar.bottom + 2 || r.top < ar.top - 2)) {
            out.push({ type: "clipped", severity: "medium", detail: `Control is partly hidden by its container ${desc(a)}`, element: desc(el) });
            break;
          }
        }
        a = a.parentElement;
      }
      // Accessible name.
      const labelled = el.id && document.querySelector(`label[for="${el.id}"]`);
      const name = (el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") && document.getElementById(el.getAttribute("aria-labelledby")!)?.textContent) || (el as HTMLElement).innerText || el.getAttribute("title") || el.querySelector("img[alt]")?.getAttribute("alt") || el.getAttribute("placeholder") || (labelled && labelled.textContent) || (el.closest("label")?.textContent ?? "") || "").trim();
      if (!name) out.push({ type: "no-label", severity: "medium", detail: `Control has no readable name (screen readers announce nothing): ${el.outerHTML.replace(/\s+/g, " ").slice(0, 160)}`, element: desc(el) });
      // Covered by another element (only when on screen; behind an open modal is expected).
      const modal = document.querySelector('[role=dialog][aria-modal=true], [role=dialog][data-open], [role=alertdialog], .welcome-screen');
      if ((!modal || modal.contains(el)) && el.tagName.toLowerCase() !== "g" && r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw && r.width >= 4 && r.height >= 4) {
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el) && !(el.tagName === "INPUT" && hit.closest("label")?.contains(el)))
          out.push({ type: "covered", severity: "medium", detail: `Centre of the control is covered by ${desc(hit)}`, element: desc(el) });
      }
      // Touch target size on touch devices (WCAG 2.2 minimum 24 px).
      if (mobile && (r.width < 24 || r.height < 24) && !(el.tagName === "INPUT" && /checkbox|radio/.test((el as HTMLInputElement).type)))
        out.push({ type: "small-target", severity: "low", detail: `Touch target ${Math.round(r.width)}×${Math.round(r.height)} px (minimum 24×24)`, element: desc(el) });
    }

    // Broken images.
    for (const img of [...document.images].filter(visible))
      if (img.complete && img.naturalWidth === 0) out.push({ type: "broken-image", severity: "high", detail: `Image failed to load: ${img.currentSrc || img.src}`, element: desc(img) });

    // Text cut off inside fixed-width boxes.
    for (const el of [...document.querySelectorAll("h1,h2,h3,h4,p,label,strong,small,td,dd,dt,li,button,a,span")].filter((e) => visible(e) && !e.classList.contains("sr-only"))) {
      const s = getComputedStyle(el);
      if (/(hidden|clip)/.test(s.overflowX) && s.textOverflow !== "ellipsis" && el.scrollWidth > (el as HTMLElement).clientWidth + 2 && (el as HTMLElement).clientWidth > 0)
        out.push({ type: "text-cut", severity: "medium", detail: `Text is cut off (${el.scrollWidth}px of text in ${(el as HTMLElement).clientWidth}px)`, element: desc(el) });
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && el.children.length === 0 && (el.textContent || "").trim()) {
        let a: Element | null = el.parentElement, inScroller = false;
        while (a) { if (scrollsX(a)) { inScroller = true; break; } a = a.parentElement; }
        if (!inScroller) out.push({ type: "text-offscreen", severity: "medium", detail: `Text runs past the right edge of the window`, element: desc(el) });
      }
    }
    // De-duplicate identical findings.
    const seen = new Set<string>();
    return out.filter((f) => { const k = f.type + f.detail + (f.element ?? ""); if (seen.has(k)) return false; seen.add(k); return true; });
  }, mobile);
}

/**
 * Audit the current state: layout checks, optional accessibility scan,
 * full-page screenshot. Writes findings to .results/findings/<project>__<state>.json.
 */
export async function audit(page: Page, testInfo: TestInfo, state: string, health: Finding[], opts: { axe?: boolean } = {}) {
  await page.waitForTimeout(600);
  const project = testInfo.project.name;
  const mobile = Boolean(testInfo.project.use.isMobile);
  const findings: Finding[] = await layoutFindings(page, mobile);
  if (opts.axe) {
    try {
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      for (const v of axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical"))
        findings.push({
          type: `a11y:${v.id}`,
          severity: v.impact === "critical" ? "high" : "medium",
          detail: `${v.help} (${v.nodes.length} element${v.nodes.length === 1 ? "" : "s"})`,
          element: v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | "),
        });
    } catch (e) {
      findings.push({ type: "axe-failed", severity: "low", detail: String(e).slice(0, 200) });
    }
  }
  if (opts.axe) findings.push(...(await contrastFindings(page)));
  findings.push(...health.splice(0));
  const dir = join(SCREENS, project);
  mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: join(dir, `${state}.png`), fullPage: true });
  mkdirSync(join(RESULTS, "findings"), { recursive: true });
  writeFileSync(join(RESULTS, "findings", `${project}__${state}.json`), JSON.stringify({ project, state, url: page.url(), findings }, null, 1));
  return findings;
}

/**
 * WCAG contrast for visible text. axe-core cannot judge text on translucent or
 * gradient backgrounds, so composite each ancestor's background colour over
 * the app's space background (#04060e) and compute the ratio.
 */
async function contrastFindings(page: Page): Promise<Finding[]> {
  return page.evaluate(() => {
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = "1"] = m[1].split(/[ ,/]+/).filter(Boolean);
      return [Number(r), Number(g), Number(b), Number(a)];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const over = (top: number[], bottom: number[]) => {
      const a = top[3];
      return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
    };
    const out: { type: string; severity: "high" | "medium" | "low"; detail: string; element?: string }[] = [];
    const seen = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const text = (n.textContent || "").trim();
      if (text.length < 2) continue;
      const el = n.parentElement!;
      if (el.closest("details:not([open])") && !el.closest("summary")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || el.closest(".sr-only,[aria-hidden=true]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      let opacity = 1;
      const chain: Element[] = [];
      for (let a: Element | null = el; a; a = a.parentElement) { chain.push(a); opacity *= Number(getComputedStyle(a).opacity); }
      let bg = [4, 6, 14, 1];
      let gradient = false;
      for (const a of chain.reverse()) {
        const st = getComputedStyle(a);
        const c = parse(st.backgroundColor);
        if (c && c[3] >= 0.99) gradient = false;
        if (c && c[3] > 0) bg = over(c, bg);
        // Body/app-level backdrops are dark; a gradient on a component (e.g. a button) can't be measured.
        if (st.backgroundImage !== "none" && a !== document.body && !a.classList.contains("medic-app")) gradient = true;
      }
      if (gradient) continue;
      const fgRaw = parse(cs.color);
      if (!fgRaw) continue;
      const fg = over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * opacity], bg);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const need = large ? 3 : 4.5;
      if (ratio < need) {
        const key = `${cs.color}|${Math.round(size)}|${text.slice(0, 20)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          type: "low-contrast",
          severity: ratio < need - 1.5 ? "medium" : "low",
          detail: `Contrast ${ratio.toFixed(2)}:1 (needs ${need}:1) at ${Math.round(size)}px, colour ${cs.color}`,
          element: `"${text.slice(0, 50)}"`,
        });
      }
    }
    return out;
  });
}
