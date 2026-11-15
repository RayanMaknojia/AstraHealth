# Frontend QA report

Branch `planb` · run 2026-11-15 · Chrome (installed on this PC) via Playwright 1.65 · all 12 issues below were then fixed and the suite re-run (see **Fixes**).

## Summary

- **No crashes:** zero JavaScript errors in any run. Every screen loads at every size.
- **All 18 user flows pass** at phone (390), tablet (768) and laptop (1440): 54 of 54.
- **Layout audit** of 17 screens/states × 13 screen sizes (221 combinations): no sideways scrolling except one 2 px case, no controls stuck off-screen, no broken images, every control reachable.
- **12 issues found**: 0 high, 5 medium, 7 low. Details and reproduction steps below.

## What was tested

**Screen sizes (13):** phones 320×568, 375×667, 390×844, 430×932 · tablets 768×1024, 834×1194, 1024×768 · laptops 1280×720, 1366×768, 1440×900, 1536×730 (short window) · desktops 1920×1080, 2560×1440. Phone and tablet sizes emulate a touch device.

**Screens and states audited at every size (17):** login · login with wrong PIN · critical health alert on login · Home · full briefing drawer · demo controls open · Check-in daily / weekly / monthly · Body Map · Trends · More → Cabin readings, My records, Past journal entries, Guidance & triage, References · Admin.

**Checks on every screen:** sideways scrolling · controls off-screen or unreachable (e.g. inside a fixed panel below the window) · controls clipped or covered by other elements · broken images · cut-off text · controls with no readable name · touch-target size on touch devices · JavaScript errors and failed requests · full-page screenshot. At 390 and 1440 also: axe-core accessibility scan (WCAG 2.2 AA) and a text-contrast check.

**User flows (18, each at 390 / 768 / 1440 — all pass):**

| ID | Flow |
|---|---|
| F01 | Wrong PIN shows an error; right PIN opens the app; reload keeps you logged in |
| F02 | Every page opens from the navigation with the right title |
| F03 | Check-in: empty save lists the missing required fields; a complete save updates the Home vital tiles |
| F04 | Home: a vital tile opens Trends on that indicator; Full briefing drawer opens and closes (Esc) |
| F05 | Home body scan runs to "Scan complete"; tapping a body region opens Body Map |
| F06 | Trends: all 9 indicators × 1D/7D/30D/Mission draw a chart; Measurement guide opens |
| F07 | Body Map: each of the 5 organ cards selects its system; a countermeasure checkbox toggles; "View trends" opens Trends |
| F08 | More: every tab shows its panel; all reference links are valid https links |
| F09 | Critical alert: shows "Do this now"; Notify crew keeps it open; Confirm returns to the dashboard |
| F10 | Solar storm (ISS crew): Radiation Storm shelter alert appears and names the real NASA DONKI event |
| F11 | SOS button: sends immediately and lists who receives it (by design, per health_rules.md) |
| F11b | Automatic SOS: a 40.2 °C check-in opens the 30 s countdown; "I'm OK, cancel" closes it |
| F12 | Ticking "Skin problem" → Add photo → choosing an image shows the preview |
| F13 | Journal entry saves and appears in More → Past journal entries |
| F14 | Admin creates an astronaut, then logs out |
| F15 | Log out from the app returns to the login screen |
| F16 | Keyboard: navigation button shows a focus ring and Enter opens the page |
| F17 | Reduced motion: Body Map organs stop animating |

## Issues found (all fixed — see Fixes)

| # | Severity | Where | What | How to reproduce | Likely fix |
|---|---|---|---|---|---|
| 1 | Medium | All sizes · Home → Medical briefing, Full briefing | Developer message shown to the crew: "Offline rules · 19:04 UTC **(Python server not running)**" | Run the app without the AI server (`server/app.py`) and log in | Show crew-friendly text, e.g. "Offline rules (AI briefing unavailable)"; text comes from `src/services/aiBriefing.ts` line ~305 |
| 2 | Medium | Phones 320–430 (and tablets) · after confirming an alert | The "Alert confirmed" toast sits on top of the bottom navigation bar and Home content for ~5 s, so Home / Check-in / Body Map / Trends / More can't be tapped until it goes | Phone size, log in as mars_crew, Confirm the alert, try to tap the bottom bar | On phones place toasts at the top, or above the bottom bar, or shorten them |
| 3 | Medium | Phone 320 · Home → Blood Pressure tile | "122/78 **mmHg**" is wider than the tile; "mmHg" runs past the tile's right edge | 320 px wide, Home, look at the second vital tile | Let the unit wrap under the value or shrink the value font on very narrow screens |
| 4 | Medium | Phone 320 · Trends | The Indicator dropdown is squeezed to "Res…", so the selected indicator can't be read | 320 px wide, open Trends | Put the dropdown on its own row above the 1D/7D/30D/Mission buttons on narrow screens |
| 5 | Medium | Laptop 1440 & phone 390 (colours, so all sizes) · red "ALERT" text and red values | Red #dc2626 on the dark background is 3.9:1 contrast; WCAG AA needs 4.5:1 for normal text | Any Alert reading, e.g. Sleep 5.9 hrs on mars_crew | Use a lighter red for text (e.g. #f87171) — `STATUS_COLORS.critical` in `src/services/healthEvaluator.ts`, or override in the theme |
| 6 | Low | All sizes · small grey text | Below 4.5:1 contrast: footer "Onboard support · Offline first", "Simulated mission data…", "SPACE MEDIC / 2026" (4.06:1, 11 px); sidebar "ONBOARD HEALTH" (4.38:1, 10 px); "Onboard health support." (4.49:1); login footer "SPACE MEDIC", "NASA SPACE APPS 2026" (3.85:1, 9 px); grey "No data" label (3.53:1) | Visible on every page | Lighten these greys slightly (e.g. to #8ea3c4) |
| 7 | Low | Phone 320 · Admin (Mission control) | Page is 322 px wide in a 320 px window — 2 px sideways scroll | 320 px wide, log in as admin | Find the 2 px-wide element in the admin form row (likely an input/select min-width) |
| 8 | Low | Keyboard users · Check-in rating sliders (Mood, Sleep quality, Energy, Stress) | Sliders start at 3 but show "Choose a rating". Mouse/touch users can tap to confirm 3, but with the keyboard there is no way to choose 3 without moving to 2 or 4 and back | Tab to a rating slider; Enter / Space do nothing; Save says "Still needed: … rating" | Also confirm the value on Enter / Space / focus-then-arrow, or start the slider empty |
| 9 | Low | Touch devices · Home body scan, demo controls | Small touch targets: the neck region of the body scan is 30×17 px; the Mission day slider is 16 px tall (WCAG 2.2 minimum 24 px) | Phone size, Home → Body scan; Demo controls | Enlarge the neck hit-area; give the slider a taller track/thumb |
| 10 | Low | Screen readers · all toasts | Toast notifications use `role="dialog"`, so screen readers announce them as dialogs (and they compete with real dialogs) | Any action that shows a toast | Use `role="status"` (or `alert` for urgent ones) on toasts |
| 11 | Low | Desktop 2560 | The app stays ~1690 px wide with 13–15 px text, leaving large empty margins; looks small on big monitors | 2560×1440 window | Optional: scale type and max-width up on very wide screens |
| 12 | Info | All sizes · when the AI server is off | Every login logs "Failed to load resource: 502 (Bad Gateway)" for `/api/ai/json` in the console. The app correctly falls back to offline rules | Run without `server/app.py` | Optional: skip the call when offline, or don't log it as an error |

## Fixes (re-run after fixing: 67/67 runs pass, 144/144 rules checks pass, type-check, lint and build clean)

| # | Fix | Where |
|---|---|---|
| 1 | Crew sees "Offline rules · … (AI briefing unavailable)". Briefings saved by older builds are re-worded when shown. The body-scan line now says "Onboard scanner" instead of "Browser scanner (Python server offline)" | `src/services/aiBriefing.ts`, `src/components/medic/home.tsx`, `home-scan.tsx` |
| 2 | On phones (≤650 px) toasts sit 12 px above the bottom bar, so navigation stays tappable | `src/index.css` (QA fixes block) |
| 3 | ≤360 px: vital value may wrap, so "mmHg" drops under "122/78" instead of overflowing | `src/index.css` |
| 4 | ≤480 px: Indicator dropdown takes its own full-width row | `src/index.css` |
| 5 | Alert red is now #f87171 (about 6:1 on the dark panels) | `STATUS_COLORS.critical` in `src/services/healthEvaluator.ts` |
| 6 | Small grey text lightened to #8ea3c4 (footer, sidebar labels, login footer); "No data" grey #94a3b8 | `src/index.css`, `STATUS_COLORS.no_data` |
| 7 | Admin header wraps at ≤400 px, so "Log out" no longer pushes the page 2 px wide | `src/index.css` |
| 8 | Enter / Space on a rating slider confirms the shown value (e.g. 3); screen readers hear the hint | `Rating` in `src/components/medic/checkin.tsx` |
| 9 | Neck region has an invisible 48×30 touch area; Mission day slider is 28 px tall | `home-scan.tsx`, `src/index.css` |
| 10 | Toasts use `role="status"`. Also fixed: base-ui marked the toast's Close button `aria-hidden` while still focusable (axe, found on the re-run) | `src/components/ui/toast.tsx` |
| 11 | ≥2200 px wide: the whole app is scaled 1.25× (sidebar still fits the window exactly at 2560×1440) | `src/index.css` |
| 12 | When the AI server is off, the dev/preview proxy answers `{ok:false}` instead of a 502, so the console stays clean; the app falls back exactly as before | `vite.config.ts` |

Also: `npm run qa` now excludes `qa/e2e` (Vitest was trying to load the Playwright specs), and a lint error in `flows.spec.ts` was fixed.

**Still reported on the re-run, checked and expected:** the "Alert confirmed" toast briefly covers content above the bottom bar for ~5 s (no longer the navigation); the bottom bar covers content only mid-scroll; the "Close toast" button measured below a 720/768 px window while the toast was sliding in.

## Checked and cleared (not bugs)

- **Missing organ images in some full-page screenshots** (Body Map DNA / bones cards, hero heart) — a Chrome full-page-capture artefact with the lighten blend; a normal screenshot and the image checks confirm all 6 images load and show (900×900).
- **"Close toast" button below the window** — measured while the toast was sliding in; a re-check shows the toast fully on screen.
- **Content "covered" by the phone bottom bar** — only while mid-scroll; scrolled to the end, every page's last item sits above the bar.
- **Controls "covered" behind an open alert** — expected behind a modal.
- **No countdown on the SOS button** — by design: the button sends at once; the countdown is for automatic SOS (F11b covers it).

## Limits

- Chrome only (installed Chrome). Safari/WebKit and Firefox were not tested; real phones were emulated, not used.
- Camera capture can't be tested; image upload was.
- The AI server (`/api`, port 8787) was not running, so the AI briefing and photo first look were tested in their offline fallback.
- axe-core could not judge contrast for 103 elements on translucent/gradient backgrounds; the custom contrast check covers solid-colour text only (text on gradients, e.g. the cyan buttons, wasn't measured).
- Skin-photo AI results, exercise streaks and medication expiry depend on stored history and weren't varied.

## How to re-run

```bash
npm run qa:ui
```

Screenshots: `qa/e2e/screens/<size>/<screen>.png` (not committed; ~120 MB). Raw findings: `qa/e2e/.results/findings/`. Tests: `qa/e2e/layout.spec.ts`, `qa/e2e/flows.spec.ts`, helpers in `qa/e2e/helpers.ts`, sizes in `playwright.config.ts`.
