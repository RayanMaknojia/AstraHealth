# Astronaut Health Monitor: Pages and KPIs

NASA Space Apps Challenge 2026
Companion to `astronaut_health_monitor_plan.md`

---

## Quick Decision: Where Does Photo Upload Go?

**Its own page, called Photo Check, with shortcuts to it from three places:**

1. A **"📷 Photo Check"** button on Home
2. A **"Add photo"** button on any body part in the Body Map
3. A **"Add photo"** option when the astronaut reports a skin symptom in the Check-in

**Why not just put it on Home?** Photo Check needs room: camera, body location picker, result card, first aid steps and sync status. Putting all of that on Home would crowd out the vitals. A shortcut button keeps Home clean and still makes the feature one tap away.

---

## Page List

| # | Page | Who sees it | Build priority |
|---|---|---|---|
| 1 | Login | Everyone | **MVP** |
| 2 | Home | Astronaut | **MVP** |
| 3 | Daily Check-in | Astronaut | **MVP** |
| 4 | Photo Check | Astronaut | **MVP** |
| 5 | Body Map | Astronaut | **MVP** |
| 6 | Trends | Astronaut | **MVP** |
| 7 | Crew Streaks | Astronaut | **MVP** |
| 8 | Habitat | Astronaut | Nice to have |
| 9 | Exercise and Bone | Astronaut | Nice to have |
| 10 | Sleep, Mood and Journal | Astronaut | Nice to have |
| 11 | Guidance and Triage | Astronaut | Nice to have |
| 12 | Mission Control Sync | Astronaut | Nice to have |
| 13 | Mission Timeline | Astronaut | Nice to have |
| 14 | Admin | Admin only | **MVP** |
| O1 | Critical Health Alert | Override | **MVP** |
| O2 | Cabin Emergency | Override | Nice to have |
| O3 | Radiation Storm | Override | Nice to have |
| O4 | Medical Emergency (SOS) | Override | Nice to have |

For a 48 hour build, finish the MVP pages first. Show the rest as "coming soon" screens in the demo.

---

## Elements on Every Page

These stay visible no matter which page is open.

**Top bar**

* Compact trip bar: `Day 45 · Flying to Mars · 138 days to arrival`
* Earth delay: `Earth delay: 6 min 12 s`
* Sync status: `Last sync 2 h ago` (green), `Waiting for link` (yellow), `Blackout` (red)
* Overall status dot: green, yellow or red
* **SOS button** (always visible, opens Medical Emergency)

**Side or bottom navigation**

Home, Check-in, Photo Check, Body Map, Trends, Streaks, More (Habitat, Exercise, Sleep, Guidance, Sync, Timeline)

**Override layer**

Any override (O1 to O4) covers the current page until someone confirms it.

---

## Status Colors and Starting Thresholds

These are starting values for the demo. Each reading is checked two ways:

1. Against the range below
2. Against the astronaut's own baseline (Earth mode readings or first 7 days)

If either check fails, the stricter color wins. A missing reading shows **grey**, never green.

| KPI | Unit | 🟢 Green | 🟡 Yellow | 🔴 Red | Space adjustment |
|---|---|---|---|---|---|
| Resting heart rate | bpm | 50 to 100 | 40 to 49 or 101 to 120 | < 40 or > 120 | Also yellow if 15% off baseline |
| Blood pressure (systolic / diastolic) | mmHg | 90 to 129 / 60 to 84 | 130 to 159 / 85 to 99, or systolic 80 to 89 | ≥ 160 / ≥ 100, or systolic < 80 | Expect 8 to 10 mmHg lower in 0 g |
| Body temperature | °C | 36.1 to 37.5 | 37.6 to 38.4 | ≥ 38.5 or < 35.0 | After day 60 in 0 g, green goes up to 37.9 |
| SpO2 | % | ≥ 95 | 90 to 94 | < 90 | Tighter watch in 8.2 psi Moon / Mars habitat |
| Sleep | hours | ≥ 7 | 6 to 6.9 | < 6 for 3 nights in a row | Target 8.5 h (NASA schedule) |
| Mood | 1 to 5 | 4 to 5 | 3 | 1 to 2 for 3 days in a row | None |
| Blood glucose (fasting) | mg/dL | 70 to 99 | 54 to 69 or 100 to 180 | < 54 or > 180 | None |
| Body mass | % change from preflight | within 3% | 3 to 5% loss | > 5% loss | Weekly reading |
| Radiation, mission total | % of 600 mSv career limit | < 50% | 50 to 80% | > 80% | Rate depends on phase |
| Radiation, solar storm | event | none | watch issued | event active | From DONKI SEP feed |
| Exercise | min per day | ≥ 120 | 60 to 119 | < 60 for 3 days | Target based on ISS crews |
| Estimated bone loss | % | < 5% | 5 to 10% | > 10% | Scaled by gravity, label as estimate |
| Cabin CO2 (1 hour average) | mmHg | < 2.5 | 2.5 to 3.0 | > 3.0 | NASA STD 3001 limit is 3 mmHg |

Have a clinician review these before any real use.

---

## 1. Login

**Purpose:** Get in fast. Nothing else.

**Fields**

* Name (or crew ID)
* PIN (4 to 6 digits)
* "Log in" button

**Behavior**

* Astronaut accounts go straight to Home
* Admin accounts go straight to Admin
* No sign up and no mission questions. The admin sets up every account.
* Works offline. Login is checked on the device, not on Earth.

**Demo helper**

A small note under the form listing the demo accounts: `admin`, `mars_crew`, `iss_crew`

---

## 2. Home

**Purpose:** Answer "Am I OK today?" in 5 seconds.

### Layout, top to bottom

**A. Trip bar (full width)**

```
EARTH ●━━━━━━━━○──────────────── MARS
Day 45 · Flying to Mars · 138 days to arrival
```

* Tap to open Mission Timeline
* In demo mode it becomes a slider

**B. Overall status card**

* Big circle: 🟢 "All normal", 🟡 "2 items to watch" or 🔴 "Action needed"
* One line summary, e.g. "Sleep below target 3 nights"

**C. Today's tasks**

* Morning check-in: Due / Done ✓
* Evening check-in: Due / Done ✓ / Optional
* Exercise: 45 of 120 min
* Weekly or monthly task, if due today (e.g. "Body mass due")
* **📷 Photo Check** shortcut button

**D. Vital tiles (6 tiles in a grid)**

Each tile shows today's value, status color, a small trend arrow (↑ ↓ →) and the time of the last reading.

| Tile | Example |
|---|---|
| Heart rate | 68 bpm 🟢 → |
| Blood pressure | 112 / 72 🟢 ↓ |
| Body temperature | 37.4 °C 🟢 ↑ |
| SpO2 | 97% 🟢 → |
| Sleep | 6.2 h 🟡 ↓ |
| Mood | 3 / 5 🟡 ↓ |

Tapping a tile opens Trends for that KPI.

**E. Mission exposure tiles (3 tiles)**

| Tile | Shows |
|---|---|
| Radiation | Today: 1.84 mSv. Mission total: 83 mSv (14% of limit). Progress bar |
| Bone and exercise | Estimated bone loss: 1.9%. Exercise streak: 12 days |
| Gravity | Current: 0 g. Next change: Mars 0.38 g in 138 days |

**F. Cabin strip (one row)**

CO2 2.1 mmHg 🟢 · O2 21% 🟢 · Pressure 14.7 psi 🟢 · Temp 23 °C 🟢

Tap to open Habitat.

**G. Active alerts list**

* Newest first, each with color, short message and "View" link
* Empty state: "No active alerts"

**H. Streak badge (small)**

"🔥 14 day check-in streak". Tap to open Crew Streaks.

---

## 3. Daily Check-in

**Purpose:** Collect readings quickly, on a schedule based on real ISS practice.

### Check-in schedule

| When | Required? | What | Time to complete |
|---|---|---|---|
| **Morning** (daily) | Required | Sleep hours, sleep quality (1 to 5), mood (1 to 5), resting HR, BP, temperature, SpO2, symptoms checklist | ~2 min |
| **Evening** (daily) | Optional | Fatigue (1 to 5), nausea or appetite (1 to 5), exercise minutes and type, headache (yes / no), notes | ~1 min |
| **Weekly** | Required | Body mass, food log (simple questionnaire), fasting blood glucose, 60 second reaction test | ~5 min |
| **Monthly** | Required | Guided full health exam done with a crewmate, sleep and team questionnaire | ~15 min |
| **Day 30, day 90, then every 90 days** | Required | Vision test (on screen chart and Amsler grid), guided eye ultrasound | ~10 min |

### Form design

* One question per row with sliders and big buttons, so it's easy to use while floating
* Values can be typed in or filled from the simulated wearable
* Each field shows the unit and the normal range next to it
* Symptoms checklist: headache, nausea, dizziness, congestion, back pain, eye or vision change, skin problem, other
* Picking **skin problem** shows an **"Add photo"** button that opens Photo Check
* Submit shows a summary with colors and anything that needs attention

### Rules

* Reporting a symptom **counts as a completed check-in**. It never breaks a streak.
* Readings get a status right after submit
* A red value triggers the Critical Health Alert override

---

## 4. Photo Check

**Purpose:** Get a quick first look at a skin injury, and save scans for the flight surgeon.

### Two modes (tabs)

**Tab 1: Skin Photo (AI first look)**

1. **Take or upload a photo**: camera button, upload button
2. **Pick the body location** on a small body outline (e.g. left forearm)
3. **Optional notes**: "Cut on ARED cable", pain level 1 to 5
4. **Analyze** button

**Result card**

| Field | Example |
|---|---|
| Likely type | Laceration (cut) |
| Confidence | 82% |
| Other possibilities | Abrasion 11%, Bruise 4% |
| Status | 🟡 Monitor |
| First aid steps | Clean with saline, apply pressure, close with strips, cover |
| When to escalate | Bleeding over 10 min, signs of infection, deep wound |
| Ground review | "Added to sync queue. Flight surgeon review pending." |

**Model classes:** cut / laceration, burn, bruise, abrasion, normal skin, plus **unsure**

**If confidence is below 70%:** show "Unsure. Sent to the flight surgeon for review." Don't guess.

**Tab 2: Ultrasound Scan (guided capture, no AI diagnosis)**

1. Pick the scan type: eye, neck vein, heart, bladder, other
2. Follow step by step instructions with a picture for each step (probe position, angle, what a good image looks like)
3. Capture or upload the image
4. A simple quality check: "Image saved" or "Too dark / blurry, try again"
5. Tag it automatically with body part, mission day and phase
6. Add it to the sync queue for flight surgeon review

### History panel (bottom of page)

* Thumbnail list of past photos and scans
* Each shows date, body location, result and review status (Pending / Reviewed)
* Tap to compare two photos of the same spot, to see if a wound is healing

### How the AI works

| Layer | Where it runs | When |
|---|---|---|
| Onboard model (MobileNet or EfficientNet, exported to TensorFlow.js or ONNX) | On the device, offline | Instant |
| Second opinion (Claude API plus flight surgeon) | On Earth | When a connection is available |

**Always show:** "First look only. Not a diagnosis."

---

## 5. Body Map

**Purpose:** Explain health by body system in plain English, with status colors.

### Layout

* Interactive human figure in the center (front and back toggle)
* Each zone is colored by its worst current status
* Legend: green, yellow, red, grey (no data)

### Clickable zones

| Zone | Linked hazard | KPIs shown | Plain-English explanation |
|---|---|---|---|
| **Brain and mood** | Isolation, radiation | Mood, reaction test, sleep, headache | Being far from home and in a small space can affect mood and focus. Radiation can affect thinking over time. |
| **Eyes** | Gravity (fluid shift), radiation | Vision test, eye ultrasound status, headache | Without gravity, fluid moves to your head and can press on your eyes. Radiation raises cataract risk. |
| **Heart and blood** | Gravity, radiation | HR, BP, standing BP after landing | Your heart works differently in 0 g. BP is usually a bit lower. After landing you may feel dizzy when you stand. |
| **Lungs and air** | Closed environment | SpO2, cabin CO2, cough or congestion | High cabin CO2 can cause headaches and tiredness. Moon dust can irritate your lungs. |
| **Bones and muscles** | Gravity | Estimated bone loss, exercise, body mass | Without gravity your bones lose density each month. Exercise slows it down. |
| **Immune system and skin** | Closed environment, stress | Temperature, skin photos, symptoms | Stress and close quarters make infections and rashes easier to catch. |
| **Kidneys** | Gravity | Hydration, urine notes | Calcium released from bone raises kidney stone risk. Drink water. |

### Zone detail panel (opens on tap)

* Status color and the reason ("Sleep below 6 h for 3 nights")
* Latest readings for that zone
* Mini trend chart (last 14 days)
* "What you can do" list
* "When to call the ground" rule
* **Add photo** button (opens Photo Check with the location already filled in)

---

## 6. Trends

**Purpose:** Show how each KPI changes over the mission.

### Controls

* KPI picker (one or several)
* Time range: 7 days, 30 days, whole mission
* Toggle overlays: radiation dose, mission phases, exercise

### Charts

| Chart | What it shows |
|---|---|
| **Vital trend** | Selected KPI over time, with the green / yellow / red zones shaded behind the line, and a baseline line |
| **Radiation vs heart** | Daily dose (bars) with resting HR and BP (lines) on the same timeline |
| **Mission phase markers** | Vertical lines at launch, transit start, landing and so on |
| **Cumulative radiation** | Line rising toward the 600 mSv limit, with the 50% and 80% marks |
| **Bone loss estimate** | Line with exercise days marked |
| **Sleep and mood** | Two lines together, to spot patterns |

### Summary box

* "Heart rate steady this week"
* "Temperature up 0.8 °C since day 1 (expected in 0 g)"
* "Sleep below target 4 of the last 7 nights"

---

## 7. Crew Streaks (Leaderboard)

**Purpose:** Keep the crew doing their check-ins, without turning health into a competition.

### Rules

* Ranks **consistency only**, never health values
* Never shows anyone's BP, weight, mood or photos
* Reporting a symptom counts as a completed check-in
* Any missed check-in because of a medical issue or emergency can be excused by the admin

### Layout

**A. Team goal (top, full width)**

```
Crew check-ins this week: 94% ████████████████████░
Goal: 90% ✓   Team badge unlocked: "Steady Orbit"
```

**B. Crew table**

| Rank | Astronaut | Current streak | This week | Exercise days | Badges |
|---|---|---|---|---|---|
| 1 | Commander | 🔥 32 days | 100% | 6 / 6 | 🏅🏅🏅 |
| 2 | Pilot | 🔥 21 days | 93% | 5 / 6 | 🏅🏅 |
| 3 | Specialist | 🔥 9 days | 86% | 6 / 6 | 🏅 |

**C. Badges**

* 7 day streak, 30 day streak, 100 day streak
* All weekly tasks done
* Monthly exam done
* Exercise goal met 6 days in a week
* Team badges for crew goals

**D. My progress**

* Personal streak calendar (each day green if done, grey if missed)
* Next badge and how close you are

---

## 8. Habitat

**Purpose:** Show cabin conditions next to the astronaut's vitals, so they can tell if a symptom comes from the air or from illness.

### Cabin KPIs

| KPI | Unit | Target |
|---|---|---|
| CO2 (1 hour average) | mmHg | < 3.0, ideally < 2.5 |
| O2 | % and inspired mmHg | Inspired O2 ≥ 127 mmHg |
| Cabin pressure | psia | ISS 14.7, Moon / Mars habitat 8.2 |
| Temperature | °C | 18 to 27 |
| Humidity | % | 25 to 75 (depends on temperature) |
| Noise | dB | Shown, with a hearing protection reminder if high |
| Light phase | Day / evening / night | Matches the sleep schedule |
| Radiation dose rate | mSv / day | Depends on phase |

### "Is it me or the air?" panel

Example: "You logged a headache today. Cabin CO2 averaged 3.4 mmHg over the last 6 hours. CO2 above 2.8 mmHg is linked to headaches. Move to a better ventilated module and check again in 1 hour."

### Charts

* CO2 over 24 hours with the 3.0 mmHg line
* Temperature and humidity over 24 hours

---

## 9. Exercise and Bone

**Purpose:** Track the main defense against bone and muscle loss.

### KPIs

| KPI | Example |
|---|---|
| Today's exercise | 45 of 120 min |
| Weekly exercise days | 4 of 6 |
| Workout types | Treadmill, bike, resistance |
| Estimated bone loss | 1.9% (estimate) |
| Body mass change | -2.1% from preflight |
| Current gravity | 0 g |

### Features

* Log a workout: type, minutes, effort (1 to 5)
* Bone loss projection chart: estimated loss over the mission, a "no exercise" line vs your actual line
* Exercise streak
* After landing on the Moon or Mars: balance check and standing BP check reminders for 1 to 2 weeks

---

## 10. Sleep, Mood and Journal

**Purpose:** Support mental health and sleep, especially on long missions.

### KPIs

| KPI | Example |
|---|---|
| Sleep last night | 6.2 h (target 8.5) |
| Sleep average, 7 days | 6.4 h |
| Mood average, 7 days | 3.6 / 5 |
| Circadian alignment | On schedule / shifted |
| Reaction test | 312 ms (baseline 290 ms) |

### Features

* Sleep target that adjusts for the location: 24 h on Earth and the ISS, 24 h 39 min sol on Mars
* Mood calendar (one color per day)
* **Private journal**: stored on the device only. Never shared, never synced, never shown on Streaks.
* 60 second reaction and focus test
* Tips when sleep or mood stays low (light timing, wind down routine, talk to a crewmate)
* "Request private talk with ground" button (queues a private conference request)

---

## 11. Guidance and Triage

**Purpose:** Offline help when Earth is too far away to answer quickly.

### Sections

**A. Symptom checker (decision trees)**

* Pick a symptom: headache, chest pain, dizziness, nausea, burn, cut, eye change, fever
* Answer yes / no questions
* Get plain-English steps and a color: self care, tell a crewmate, contact the ground

**B. Guided procedures**

* Step by step with pictures: taking BP, eye ultrasound, wound care, standing BP test

**C. Medication list**

* Name, use, amount left, expiry date
* Yellow when near expiry, red when expired
* Note: in space, some drugs may work differently (e.g. absorption can change)

**D. Escalation rule (auto set by Earth delay)**

* Short delay (ISS, Moon): "Contact the flight surgeon"
* Long delay (Mars, transit): "Follow these steps now, then report"

---

## 12. Mission Control Sync

**Purpose:** Show what is waiting to be sent to Earth, and what has come back.

### KPIs

| KPI | Example |
|---|---|
| Earth delay (one way) | 6 min 12 s |
| Link status | Connected / Waiting / Blackout |
| Last sync | 2 h ago |
| Items in outbox | 7 |
| Next planned sync window | In 3 h |

### Outbox list

* Each item: type (check-in, photo, scan, alert, private request), time created, size, status (Queued / Sent / Received)
* High priority items (alerts, SOS) go first

### Inbox

* Flight surgeon replies and photo reviews
* Admin changes (e.g. new landing date)

---

## 13. Mission Timeline

**Purpose:** Show the whole trip and what each phase means for the body.

### Layout

* Full trip bar with all phases
* "You are here" marker
* Each phase card shows gravity, radiation rate, Earth delay, main health risks and what changes in the app

| Phase | Days | Gravity | Radiation | Key risks |
|---|---|---|---|---|
| Leaving Earth | 0 to 3 | 0 g | Low | Motion sickness, fluid shift |
| Flying to Mars | 3 to 183 | 0 g | High (~1.84 mSv/day) | Bone and muscle loss, radiation, isolation |
| Mars orbit and landing | 183 to 186 | 0 g → 0.38 g | High | Dizziness, balance, fall risk |
| Living on Mars | 186 to 686 | 0.38 g | Medium (~0.64 mSv/day) | Dust, sol sleep shift, slower bone loss |
| Flying home | 686 to 866 | 0 g | High | Same as outbound |

### Demo mode

* Slider to scrub the mission day
* Every page updates live (thresholds, gravity, radiation, escalation)
* Hidden in normal mode

---

## 14. Admin

**Purpose:** Mission control sets up and manages crew and missions.

### Tabs

**A. Crew accounts**

* Add, edit or deactivate astronauts
* Fields: name, role (commander, pilot, specialist), PIN, mission, personal notes (e.g. allergy, naturally low BP)

**B. Missions**

* Create a mission: destination (Earth training, ISS, Moon, Mars)
* Set launch date and phase schedule (start and end day for each phase)
* Edit dates when there are delays. The trip bar updates on the next sync.

**C. Crew overview**

| Astronaut | Status | Last check-in | Streak | Open alerts |
|---|---|---|---|---|
| Commander | 🟢 | 2 h ago | 32 | 0 |
| Pilot | 🟡 | 5 h ago | 21 | 1 |

**D. Streak exceptions**

* Excuse a missed check-in (medical issue, emergency, EVA)

**E. Thresholds (optional)**

* View and adjust the starting thresholds per astronaut, with a note on who changed them and why

---

## Override Pages

All overrides:

* Cover the whole screen on any page
* Use a strong color and a short headline
* Stay until someone taps **"Confirm"**
* Log the time and who confirmed
* Put a high priority item in the sync outbox

### O1. Critical Health Alert

**Triggered by:** any red vital (e.g. SpO2 < 90%, systolic BP ≥ 160 or < 80, temperature ≥ 38.5 °C, HR < 40 or > 120)

**Shows**

* Which reading, the value and the normal range
* "Do this now" steps (3 to 5 short steps)
* **Notify crew** button
* **Retake reading** button
* Link to the matching Guidance page

### O2. Cabin Emergency

**Triggered by:** CO2 above 3 mmHg for a set time, pressure drop, O2 below limit

**Shows**

* Which parameter and how fast it's changing
* Where to go (e.g. safe module)
* Checklist (mask on, move, report)

### O3. Radiation Storm

**Triggered by:** a solar energetic particle event from the DONKI feed, or a dose rate spike

**Shows**

* "Go to shelter now"
* Countdown or estimated event length
* Mission dose so far and % of the limit
* Checklist for the shelter

### O4. Medical Emergency (SOS)

**Triggered by:** an astronaut pressing SOS, or no response to a Critical Health Alert

**Shows**

* Who needs help and where
* Triage steps for the helper (check breathing, check response, get the medical kit)
* One tap to record vitals for the person in trouble
* Automatically sends a high priority message to the ground

### Banner (not a full override): Comms Blackout

**Triggered by:** no Earth link (e.g. solar conjunction)

**Shows:** a thin top banner, "Earth link down. Expected back in 12 days. Data saved and queued."

---

## Data Behind Each Page

| Page | Tables it reads |
|---|---|
| Home | vitals_reading, cumulative_exposure, cabin_env, mission_phase, alerts |
| Check-in | vitals_reading (write), reference_range |
| Photo Check | photo_record (write), sync_queue (write) |
| Body Map | vitals_reading, reference_range, hazard_risk_map, photo_record |
| Trends | vitals_reading, radiation_dose, mission_phase, cumulative_exposure |
| Crew Streaks | checkin_log, badges |
| Habitat | cabin_env, cabin_limits, vitals_reading |
| Exercise and Bone | exercise_log, cumulative_exposure, environment_profile |
| Sleep, Mood and Journal | vitals_reading, journal (device only) |
| Guidance and Triage | triage_tree, medication |
| Mission Control Sync | sync_queue, inbox |
| Mission Timeline | mission_phase, environment_profile |
| Admin | astronaut, mission_phase, checkin_log, reference_range |

### New tables needed for these pages

| Table | Key columns |
|---|---|
| `photo_record` | photo_id, astronaut_id, ts, mission_day, mode (skin / ultrasound), body_location, image_path, ai_label, ai_confidence, review_status, review_notes |
| `checkin_log` | astronaut_id, date, slot (morning / evening / weekly / monthly), completed, excused |
| `badges` | astronaut_id, badge_id, earned_date |
| `exercise_log` | astronaut_id, ts, type, minutes, effort |
| `alerts` | alert_id, astronaut_id, ts, type, level, message, confirmed_by, confirmed_ts |
| `sync_queue` | item_id, type, priority, created_ts, size_kb, status |
| `inbox` | message_id, from, ts, type, body |
| `triage_tree` | node_id, question, yes_node, no_node, action, level |
| `medication` | med_id, name, use, qty_left, expiry_date |
| `journal` | entry_id, astronaut_id, ts, text (device only, never synced) |

---

## Sources for Schedules and Thresholds

* Weekly private medical conferences (15 min +): https://ntrs.nasa.gov/api/citations/20170001693/downloads/20170001693.pdf
* Monthly Periodic Health Status exams and weekly conferences: https://ntrs.nasa.gov/api/citations/20060051792/downloads/20060051792.pdf
* Weekly body mass, food log and blood checks: https://corpora.tika.apache.org/base/docs/govdocs1/854/854159.html
* Continuous sleep watch and monthly sleep / team questionnaire: https://ntrs.nasa.gov/api/citations/20180002943/downloads/20180002943.pdf
* Eye tests at day 30, day 90 and 30 days before return: https://ntrs.nasa.gov/api/citations/20180004916/downloads/20180004916.pdf
* Two hours of exercise per day: https://www.nasa.gov/missions/station/iss-research/astronaut-exercise
* Private medical communications are private (NASA STD 3001): https://www.nasa.gov/reference/6-0-medical-operations/
* Wound image dataset (AZH): https://github.com/uwm-bigdata/Multi-modal-wound-classification-using-images-and-locations
* Injury image datasets (cut, burn, bruise, abrasion): https://universe.roboflow.com/john-byfby/injury-rghvp
* Cabin limits, radiation limits and environment values: see `astronaut_health_monitor_plan.md`
