# Daily Check-in Fields

Astronaut Health Monitor, NASA Space Apps Challenge 2026

**Rule:** Check-in asks only for what the body can't report by itself. Anything a wearable already measures is filled in automatically, not typed.

---

## 1. Wearable Fills These (Not Typed)

NASA's Bio-Monitor shirt records physical activity, heart rate and breathing, takes regular blood pressure readings, and estimates arterial stiffness. Sleep is tracked by a watch worn continuously in flight.

| Field | Unit | Device |
|---|---|---|
| Heart rate | bpm | Shirt or watch |
| Resting heart rate | bpm | Shirt or watch |
| Blood pressure (periodic) | mmHg | Shirt |
| SpO2 | % | Shirt or watch |
| Breathing rate | breaths / min | Shirt |
| Skin temperature | °C | Shirt or watch |
| Activity and steps | steps, active min | Shirt or watch |
| Sleep duration | hours | Watch |

---

## 2. Check-in Fields

### Morning (daily, required, ~2 min)

| Field | Input type | Values | Why it's manual |
|---|---|---|---|
| Sleep quality | Slider | 1 to 5 | The watch knows how long you slept, not how well |
| Mood | Slider | 1 to 5 | Only the person knows |
| Energy / fatigue | Slider | 1 to 5 | Only the person knows |
| Stress | Slider | 1 to 5 | Only the person knows |
| Body temperature | Number | °C, from a thermometer | Wearable gives skin temperature, not core temperature |
| Symptoms | Checklist | Headache, nausea, dizziness, congestion, back pain, vision change, skin problem, other | Only the person knows |
| Pain | Slider + body location | 0 to 10, location on body outline | Only the person knows |
| Medications taken | Checklist from med list | Name, dose, time | Not tracked by any device |
| Notes | Text | Free text, optional | Anything else |

**Skin problem** opens an **"Add photo"** button that goes to Photo Check.

### Weekly (required, ~5 min)

| Field | Input type | Values |
|---|---|---|
| Body mass | Number | kg, from the body mass device |
| Fasting blood glucose | Number | mg/dL, finger stick |
| Food questionnaire | Short form | What and how much was eaten this week |
| Reaction test | 60 second on screen test | Reaction time in ms |

### Monthly (required, ~15 min)

| Field | Input type | Values |
|---|---|---|
| Full health exam | Guided form, done with a crewmate | Step by step exam results |
| Sleep and team questionnaire | Short form | 1 to 5 ratings |

### Day 30, day 90, then every 90 days

| Field | Input type | Values |
|---|---|---|
| Vision test | On screen chart and Amsler grid | Pass / change noticed |
| Eye ultrasound | Guided capture in Photo Check | Saved image, sent to ground |

---

## 3. Wearable Data Shown in Check-in (Read Only)

At the top of the check-in, show the latest wearable values:

```
Latest from your wearable (updated 12 min ago)
HR 64 bpm · BP 112/72 · SpO2 97% · Breathing 14 · Sleep 6.2 h
[ Looks right ✓ ]   [ Something's off ]
```

* **Looks right ✓** confirms the values
* **Something's off** lets the astronaut flag a bad reading (loose sensor, wrong value) and enter it by hand

---

## 4. Backup When the Wearable Is Missing

If there's **no wearable data for about 6 hours** (device off, charging or broken):

* Those fields show in the check-in as **manual entry**
* A note explains why: "No wearable data since 03:10. Please enter these by hand."
* Fields that switch to manual: heart rate, blood pressure, SpO2, breathing rate, sleep duration

Every reading is saved with its source so charts and alerts know where it came from:

| Column | Values |
|---|---|
| `input_method` | `wearable`, `manual`, `manual_override` |

`manual_override` means the astronaut flagged a wearable value as wrong and replaced it.

---

## 5. Streak Rules

* Completing the morning check-in counts for the daily streak
* Reporting a symptom **counts as completed**. It never breaks a streak.
* Weekly and monthly tasks count toward badges, not the daily streak
* The admin can excuse a missed check-in (medical issue, emergency, spacewalk)

---

## Sources

* Bio-Monitor shirt (heart rate, breathing, BP, activity): https://www.nasa.gov/?p=70620
* Continuous sleep watch in flight (Standard Measures): https://ntrs.nasa.gov/api/citations/20180002943/downloads/20180002943.pdf
* Weekly body mass and food questionnaire: https://corpora.tika.apache.org/base/docs/govdocs1/854/854159.html
* Monthly health exams: https://ntrs.nasa.gov/api/citations/20060051792/downloads/20060051792.pdf
* Eye tests at day 30 and day 90: https://ntrs.nasa.gov/api/citations/20180004916/downloads/20180004916.pdf
