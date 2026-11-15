# Astronaut Health Monitor: Project Reference

NASA Space Apps Challenge 2026
Challenge: **Create Health Monitoring Software for Astronauts on Space Missions**
Level: Intermediate. Subjects: Human Exploration, Software, Space Exploration.

---

## 1. The Challenge

**Problem:** Long missions expose astronauts to radiation, isolation, altered gravity and a closed cabin. These can cause immune changes, bone loss, heart problems and mental health issues. There is no doctor on board, and Earth can be many minutes away, so astronauts must spot problems in themselves.

**What to build:** A visual tool that:

1. Collects health indicators (keyboard, clicks, camera images, any health measure)
2. Helps astronauts assess their own health
3. Gives guidance on treatment and improvement
4. Flags when something needs the crew or the flight surgeon on Earth

**Indicators NASA names:** blood pressure, heart rate, blood sugar (mg/dL), body temperature, daily sleep hours, mood.

**Questions judges want answered:**

* Which measurements can be taken in space?
* Why is each exam needed?
* How does each hazard affect each indicator?
* When does a result need the crew or the ground?
* What can prevent a critical condition?

**Suggested features (optional):**

* Clickable human body showing each part's function and status
* Charts of each indicator over time
* Color coding for status at a glance
* Reminders to take measurements on a schedule
* Gamification to keep the crew engaged
* Simple instructions, since astronauts are not medical experts
* Support for spacecraft, station, rover, Moon base or Mars base

---

## 2. Official Challenge Resources

These are reading material only. **None contain datasets.**

| # | Resource | Source | Use |
|---|---|---|---|
| 1 | [5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) | NASA HRP | Radiation, isolation and confinement, distance from Earth, gravity fields, hostile closed environment |
| 2 | [Risks of Human Spaceflight](https://www.nasa.gov/hrp/risks/) | NASA HRP | Specific risks under each hazard, with evidence reports |
| 3 | [Ongoing HRP Research in Space](https://www.nasa.gov/hrp/ongoing-hrp-research/) | NASA HRP | What is measured in flight and with which devices |
| 4 | [Monitoring Radiation for Astronaut Health](https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp) | Canadian Space Agency | How radiation exposure is measured |
| 5 | [Why Do We Conduct Science Experiments in Space?](https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp) | Canadian Space Agency | Context on ISS health research (e.g. Bio-Monitor smart shirt) |

---

## 3. Real Data Sources

| Data | Source | Format | Use in app |
|---|---|---|---|
| Crew blood panels (CBC, metabolic, cardiovascular, cytokine) | NASA OSDR, Inspiration4: OSD-569, OSD-570, OSD-571, OSD-575 | Download or GLOpenAPI | Baselines and in flight shifts |
| ISS radiation dose | NASA RadLab: visualization.osdr.nasa.gov/radlab | CSV, TSV, JSON, API | Daily dose feed, radiation alerts |
| ISS cabin CO2, temperature, humidity | OSDR Environmental Data Application: osdr.nasa.gov | Download | Cabin environment feed |
| Solar storm events | NASA DONKI: `https://api.nasa.gov/DONKI/SEP` (free key at api.nasa.gov) | JSON API | "Go to shelter" alerts |
| Mars weather | Curiosity REMS: mars.nasa.gov/msl/weather | Web | Mars surface conditions |
| Modeled Mars conditions | Mars Climate Database (LMD / ESA) | Web tool | Conditions by location and season |
| Planet and Earth distance | NASA JPL Horizons API | API | Live Earth delay calculation |
| Daily vitals (BP, HR, sleep, mood) | **Not public.** NASA LSDA holds it by formal request only | n/a | Simulate a synthetic crew, label as simulated |

---

## 4. Outside Environment by Location

| Factor | ISS (Earth orbit) | Deep space transit | Moon surface | Mars surface |
|---|---|---|---|---|
| Gravity | ~0 g | 0 g | 1.62 m/s² (0.165 g) | 3.73 m/s² (0.38 g) |
| Day cycle | 90 min orbit | No natural day | ~29.5 Earth days (about 2 weeks light, 2 weeks dark) | 24 h 39 min (about 40 min longer than Earth) |
| Outside pressure | Vacuum | Vacuum | ~3 x 10⁻¹⁵ bar | 6.36 mb average (4.0 to 8.7 mb by season) |
| Surface temperature | n/a | n/a | 95 K to 390 K at equator | Average -53 °C, range -128 °C to 27 °C |
| Radiation dose | ~0.2 to 0.5 mSv/day | ~1.84 mSv/day | ~1.37 mSv/day (2.6x ISS) | ~0.64 mSv/day |
| Earth delay (one way) | Near real time | Grows from seconds to minutes | ~1.3 s | 4 to 24 min, plus 2 to 3 week blackout at solar conjunction |
| Dust | None | None | High ("lunar hay fever": sneezing, watery eyes, sore throat) | Fine dust, similar concern |

**How outside conditions reach the cabin:**

* **Gravity** passes straight through. A Mars habitat is at Mars gravity.
* **Air** (pressure, O2, CO2, temperature) is set by life support, not by the planet.
* **Radiation** is partly blocked by walls, so it depends on location and shielding.
* **Day length, dust and Earth delay** depend on location and affect sleep, lungs and escalation.

---

## 5. Cabin and Habitat Limits (NASA STD 3001)

These are the same in every location.

| Parameter | Value |
|---|---|
| ISS atmosphere | 14.7 psia, 21% O2, 78% N2 |
| Moon / Mars habitat atmosphere | 8.2 psia (56.5 kPa), 34% O2, 66% N2 (lunar habitat can also run 10.2 psi, 26.5% O2) |
| Allowed cabin pressure | 5 to 15 psia (34.5 to 103 kPa) |
| CO2 limit | 1 hour average ≤ 3 mmHg |
| CO2 for headache risk under 1% | 7 day average < 2.5 mmHg (ISS actual range: 1 to 9 mmHg) |
| CO2 symptoms | Headaches at 2.8 to 4.5 mmHg. Fatigue, poor sleep, nausea above 4.5 mmHg |
| Minimum inspired oxygen | 127 mmHg |
| Temperature and humidity | 18 °C / 75% humidity to 27 °C / 25% humidity |
| Radiation career limit | 600 mSv |
| Radiation per solar storm | 250 mSv per event |

---

## 6. Health Indicators: Earth Normal vs Space

Earth ranges are standard adult clinical ranges (AHA, ADA, CDC).

| Indicator | Earth normal | Change in space | App rule |
|---|---|---|---|
| Body temperature | 36.1 to 37.2 °C | Rises about 1 °C over ~2.5 months. Rises faster during exercise | After day 60 in 0 g, raise baseline by ~1 °C |
| Blood pressure | < 120 / < 80 mmHg | 24 h BP drops 8 to 10 mmHg | Lower expected BP in flight |
| Heart rate | 60 to 100 bpm resting | Unchanged in long ISS stays | Keep Earth range |
| Sleep | 7 to 9 h | ~6 h average on ISS vs 8.5 h scheduled | Target 8.5 h, alert below 6 h |
| Blood glucose (fasting) | 70 to 99 mg/dL | No clear shift | Earth range, baseline from OSDR |
| SpO2 | 95 to 100% | Watch in 8.2 psi habitat (close to O2 floor) | Tighter alert on Moon / Mars |
| Bone density | n/a | Loses 1 to 1.5% per month in 0 g | Estimate by gravity, track exercise |
| Mood | Self rating 1 to 5 | Isolation and distance from Earth | Daily check in |

**Partial gravity (Moon, Mars):** No direct human data yet. NASA research suggests gravity below 0.4 g is not enough to maintain bones, muscles and heart fitness long term, and that the benefit is roughly proportional to the gravity level. Label any estimate as an estimate.

---

## 7. Mission Timeline Model

### The idea in one line

Don't ask "where are you going?" Ask "what day of the mission is it?"

### Why

A Mars mission passes through several environments. Using Mars rules for the whole trip would be wrong for the 6 months of flying.

### Example Mars mission schedule

| Phase | Days | Environment |
|---|---|---|
| 1. Leaving Earth | 0 to 3 | EARTH_ORBIT |
| 2. Flying to Mars | 3 to 183 | DEEP_SPACE |
| 3. Mars orbit and landing | 183 to 186 | MARS_ORBIT |
| 4. Living on Mars | 186 to 686 | MARS_SURFACE |
| 5. Flying home | 686 to 866 | DEEP_SPACE |

Every day the app checks the schedule, finds the current phase, and uses that phase's rules.

### Environment profiles

| env_id | gravity_g | rad_msv_day | earth_delay |
|---|---|---|---|
| EARTH | 1.0 | ~0.01 | 0 |
| EARTH_ORBIT | 0 | 0.35 | ~0 |
| DEEP_SPACE | 0 | 1.84 | Grows over time |
| MARS_ORBIT | 0 | ~1.8 | 4 to 24 min |
| MARS_SURFACE | 0.38 | 0.64 | 4 to 24 min |
| MOON_SURFACE | 0.165 | 1.37 | 1.3 s |

Some values are midpoints of published ranges. Adjust them for best case or worst case.

### Running total (the "bank account")

The body remembers where it has been. Every day the app adds to:

* Total radiation (mSv)
* Days at 0 g and days at partial gravity
* Estimated bone loss

So on arrival at Mars, the app already knows about the 6 months of bone loss during the flight.

Estimated bone loss per day:

```
bone_loss_per_day = (1.25 / 30) * (1 - gravity_g)
```

This gives full rate at 0 g, about 60% of that on Mars, and about 83% on the Moon.

### Transition alerts

| Moment | What to watch |
|---|---|
| Entering 0 g (days 0 to 3) | Space motion sickness, fluid shift to head, headaches |
| Day 60+ in 0 g | Raise body temperature baseline |
| Landing on Mars after transit | Dizziness on standing, balance, fall risk. Daily balance and standing BP checks for 1 to 2 weeks |
| Solar storm (DONKI SEP event) | "Go to shelter" alert |

### Escalation by Earth delay

| Delay | Rule |
|---|---|
| Short (ISS, Moon) | Contact flight surgeon |
| Long (Mars, transit) | Act now using onboard guidance, then report |

---

## 8. App Design

### Accounts

One **admin** (mission control) creates every astronaut account. Astronauts are never asked setup questions.

Admin sets for each astronaut:

* Name, role (commander, pilot, specialist), PIN
* Mission: Earth (training), ISS, Moon or Mars
* Launch date and mission length (phase schedule)
* Personal notes (e.g. allergy, naturally low BP)

### Astronaut flow

```
Login (name + PIN)  →  Dashboard (trip bar already running)
```

### Earth mode

New astronauts start in Earth mode before launch. The app collects their normal readings, which become their **personal baseline** for the mission.

### Trip bar (like a plane screen)

```
EARTH ●━━━━━━━━○──────────────── MARS
Day 45 · Flying to Mars · 138 days to arrival
```

* Day is calculated from launch date and today's date. No manual updates.
* Tapping the bar shows the full trip: out, stay, home.

### Demo mode

* A switch turns the trip bar into a **slider**.
* Judges drag it from launch to Mars and watch gravity, radiation, health ranges, bone loss and escalation rules update live.
* Hidden in normal mode so astronauts cannot change the mission day.

### Things to plan for

1. **Delays:** Admin can edit launch and landing dates. The trip bar updates.
2. **Offline:** The app must run on the spacecraft without Earth. Admin changes sync when a connection returns.
3. **Missing data:** Show it as grey, never as green.

### Input layers

All inputs write to the same `vitals_reading` table.

| Input | How | Indicators |
|---|---|---|
| Manual check in | Form with fields and sliders | BP, glucose, temperature, sleep, mood, symptoms |
| Simulated wearable | Script streams readings every few seconds | Heart rate, SpO2, skin temperature, steps |
| Environment feed | RadLab and OSDR data replayed by time | Radiation, CO2 |

Pitch line: *"Works today with manual check ins. Built to accept live wearable data, shown here with a simulated feed."*

### Demo accounts

| Login | Shows |
|---|---|
| `admin` | Account and mission setup screen |
| `mars_crew` | Dashboard on day 45 of a Mars trip |
| `iss_crew` | Dashboard on the ISS |

Put these logins on the title slide and in the README.

---

## 9. Data Schema

| Table | Key columns | Source |
|---|---|---|
| `astronaut` | astronaut_id, name, role, pin_hash, mission_id, notes | Admin |
| `mission_phase` | mission_id, phase_order, phase_name, start_day, end_day, env_id | Admin |
| `environment_profile` | env_id, gravity_g, day_length_h, rad_msv_day, earth_delay_s, dust_risk, cabin_psia, cabin_o2_pct | Section 4 and 7 |
| `vitals_reading` | astronaut_id, ts, mission_day, indicator, value, unit, input_method (manual / wearable / env) | Crew input, simulated feed |
| `lab_panel` | astronaut_id, mission_phase, analyte, value, unit | OSDR OSD-569/570/571/575 |
| `radiation_dose` | ts, craft, sensor, dose_rate, event_type | RadLab, DONKI |
| `cabin_env` | ts, module, co2_mmhg, temp_c, humidity | OSDR Environmental Data App |
| `reference_range` | indicator, unit, earth_low, earth_high, watch, alert, space_shift | Section 6 |
| `cabin_limits` | param, nominal, watch, alert | Section 5 |
| `hazard_risk_map` | hazard, risk, indicator, why, action, escalate_to_ground | HRP Hazards and Risks pages |
| `cumulative_exposure` | astronaut_id, mission_day, days_0g, days_partial_g, total_rad_msv, est_bone_loss_pct | Calculated daily |

### Joins

* `vitals_reading` + `radiation_dose` + `cabin_env` on time (rounded to hour or day)
* `vitals_reading` → `reference_range` on indicator → status
* `indicator` → `hazard_risk_map` → explanation and action
* `mission_day` → `mission_phase` → `environment_profile` → today's rules

### Scoring

* Compare each reading to the astronaut's **own baseline** (Earth mode or first 7 days), not just population ranges
* Status: Normal / Watch / Alert
* Escalation flag based on Earth delay
* Optional ML: anomaly detection (Isolation Forest or XGBoost) on simulated data, with SHAP to explain each alert. Present as decision support, not diagnosis.

---

## 10. Sources

**Challenge**

* Challenge page: https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/

**NASA reference**

* Planetary Fact Sheets: https://nssdc.gsfc.nasa.gov/planetary/factsheet/
* Moon Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
* Mars Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
* NASA STD 3001 Vol 2, Section 6: https://www.nasa.gov/reference/6-0-natural-and-induced-environments-vol-2
* OCHMO CO2 Technical Brief: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf
* OCHMO ECLSS Technical Brief: https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-002-eclss.pdf
* OCHMO Radiation Technical Brief: https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf
* NASA Bone Risk page: https://www.nasa.gov/?p=746260
* Exploration Atmosphere (8.2 psia / 34% O2): https://ntrs.nasa.gov/citations/20230015380
* Lunar Surface Habitat layout: https://ntrs.nasa.gov/api/citations/20220013669/downloads/Internal%20Layout%20of%20a%20Lunar%20Surface%20Habitat.pdf
* Partial gravity and health: https://ntrs.nasa.gov/citations/20210019591
* Human Health and Performance (Moon to Mars): https://ntrs.nasa.gov/api/citations/20230015521/downloads/Human%20Health%20and%20Performance.pdf
* Human Research Roadmap: https://humanresearchroadmap.nasa.gov
* JPL Mars at a Glance: https://www.jpl.nasa.gov/news/press_kits/insight/launch/facts/mars-at-a-glance

**Studies**

* Inspiration4 data in OSDR: https://pmc.ncbi.nlm.nih.gov/articles/PMC11094041/
* ISS crew radiation exposure: https://pmc.ncbi.nlm.nih.gov/articles/PMC10919966
* Moon surface radiation (Chang'E 4): https://www.sci.news/space/radiation-dose-rates-lunar-surface-08893.html
* Mars radiation (Curiosity RAD): https://swri.org/node/9140
* Blood pressure in space (Norsk 2015): https://pmc.ncbi.nlm.nih.gov/articles/4324706/
* Space fever (ESA): https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Research/Space_fever
* Astronaut sleep (Barger 2014): https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436
* Lunar dust health: https://news.stonybrookmedicine.edu/news/breathing-lunar-dust-could-pose-health-risk-to-future-astronauts/

**Data and APIs**

* NASA OSDR: https://osdr.nasa.gov
* RadLab: https://visualization.osdr.nasa.gov/radlab/
* RadLab tutorial: https://osdr-tutorials.readthedocs.io/en/latest/pages/guides/radlab_portal.html
* NASA Open APIs (DONKI): https://api.nasa.gov
* DONKI catalog: https://ccmc.gsfc.nasa.gov/tools/DONKI
* NASA Life Sciences Portal (LSDA): https://nlsp.nasa.gov/explore/lsdahome

**GitHub: tools and frameworks**

| Repo | What it is | Link |
|---|---|---|
| nasa/openmct | NASA mission control dashboard framework (web, desktop and mobile). Used for rover health monitoring | https://github.com/nasa/openmct |
| Open MCT docs and live demo | Getting started, telemetry adapter tutorial | https://nasa.github.io/openmct/ |
| nasa/openmct-tutorial | Beginner tutorial for building on Open MCT | https://github.com/nasa/openmct-tutorial |
| c-base/cbeam-telemetry-server | Example of feeding live sensor data (MQTT, InfluxDB) into Open MCT | https://github.com/c-base/cbeam-telemetry-server |
| aschleg/nasapy | Python wrapper for NASA APIs, including DONKI solar events | https://github.com/aschleg/nasapy |
| Liu-Zhichao/nasaR | R wrapper for NASA APIs, including DONKI SEP | https://github.com/Liu-Zhichao/nasaR |
| nasa/spaceapps | Space Apps Connect (ask questions during the hackathon) | https://github.com/nasa/spaceapps |

Open MCT also lists a quickstart example and a YAMCS telemetry plugin in its README.

**GitHub: other 2026 team repos for this challenge**

Use these for ideas only. Their data and claims are not verified.

| Repo | Notable idea | Link |
|---|---|---|
| AdityaK0804/Crew-Health-Monitor | Rules adjusted for space (e.g. higher hematocrit is expected), 3D body view | https://github.com/AdityaK0804/Crew-Health-Monitor |
| fabriciojunio/aurora-astronaut-health | Works without Earth, real NASA and NOAA radiation data, simulated crew | https://github.com/fabriciojunio/aurora-astronaut-health |
| mustafadmrkrn/nasaspaceappshealthmonitoring | Daily check in for 7 indicators, personal baseline from first 7 readings, missing data shown grey, uses OSDR OSD-575 | https://github.com/mustafadmrkrn/nasaspaceappshealthmonitoring |
| Ridwanulkarim/nasa-challenge-Create-Health-Monitoring-Software-for-Astronauts-on-Space-Missions | Onboard decision support, roles for astronaut and mission control, works offline | https://github.com/Ridwanulkarim/nasa-challenge-Create-Health-Monitoring-Software-for-Astronauts-on-Space-Missions |
| obsession126/draft | Real time vitals, composite stress index, anomaly detection | https://github.com/obsession126/draft |
| meherpurtv71-sketch/AL-KASAV-ASTROHEALTH | AI risk detection, uses OSDR and RadLab | https://github.com/meherpurtv71-sketch/AL-KASAV-ASTROHEALTH |
| meahadi-hasan10/AstroByte-Health-Monitor | AI web app (early stage) | https://github.com/meahadi-hasan10/AstroByte-Health-Monitor |
| cha9ticw9lf/astronaut-health-monitor | Simple dashboard with warnings, public or fake data only | https://github.com/cha9ticw9lf/astronaut-health-monitor |
