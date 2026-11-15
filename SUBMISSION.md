# AstraHealth: NASA Space Apps Challenge 2026 submission texts

Challenge: **Create Health Monitoring Software for Astronauts on Space Missions**

---

## a) Project summary (about 180 words)

AstraHealth is an offline-first health monitoring and self-assessment app for astronauts on ISS, Moon and Mars missions. It combines simulated wearable and body-scan readings, short daily, weekly and monthly check-ins, skin and injury photos, and uploaded lab files into one health record. It colours every measurement Normal, Watch or Alert using rules drawn from NASA and Canadian Space Agency sources and adjusted for spaceflight: in-flight blood pressure, temperature after 60 days in microgravity, low-pressure habitats. An AI medical briefing explains the last check-in, the last 24 hours and the 7-day trends in plain language, with precise care steps. If a situation looks too serious, AstraHealth gives interim first aid and starts a cancellable SOS to the ground medical lab and the ISS. It also shows how long the signal will take to arrive.

This matters because the further crews travel, the less they can rely on a doctor on Earth. On Mars a message can take 20 minutes each way, so astronauts must spot problems early and act on their own. AstraHealth keeps working with no Earth link and no AI, using deterministic, reviewable rules.

---

## b) Project details

**What it does / how it works**
- **Home:** six key vitals with status colours, a body scan that takes new readings, and an AI medical briefing (full version: last check-in, last 24 h, 7-day trends, concerns, next checks).
- **Check-in:** daily, weekly and monthly forms based on NASA's schedule of weekly conferences, monthly health exams and eye checks, plus a "Something wrong?" box for symptoms, photos (cuts, burns, bites, rashes, infections) and lab files.
- **Body Map:** rotating 3D organs linked to each body system, with countermeasures. **Trends:** history and drift warnings ("reaches Watch in about N days").
- **Safety:** Normal / Watch / Alert rules adjusted for location and mission day; full-screen alerts for critical readings, cabin CO2 and solar storms; an automatic SOS for life-threatening signs (sent once per issue, with a 30-second cancel window). Escalation depends on the Earth delay: contact the flight surgeon from the ISS or Moon, act first and then report on Mars.
- **Records:** a local health database with 21 days of simulated history, every new reading appended, and photos and reports the astronaut can review and export.

**Benefits and intended impact:** earlier detection of problems such as poor sleep patterns, fever with infection, or bone and radiation exposure trends. The app gives clear self-care steps when Earth is far away, cuts noise (one alert per issue, quiet re-checks), and keeps privacy (the journal never leaves the device).

**Tools and languages:** TypeScript, React, Vite, Tailwind CSS, shadcn/ui, Recharts and Three.js (frontend). IndexedDB (on-device database). Python standard library (local server for the scan generator and AI proxy). Google Gemini API (optional AI layer). Python with NumPy/SciPy (3D model generator). Playwright (testing). No special hardware: it runs in any modern browser on a laptop or tablet.

**Creativity:**
- The mission timeline changes the rules as the crew moves (transit, orbit, surface).
- The "Is it me or the air?" check links symptoms to cabin CO2.
- 3D organs are generated from reference images.
- The AI can raise a concern but never hide one.
- Everything works offline.

**Factors considered:**
- Crew safety first: the rules decide the colours, and the AI only explains them.
- False alarms and alert fatigue.
- Communication delay and blackouts.
- Privacy of medical and personal data.
- Usability while floating: large touch targets and 1-5 scales.
- Accessibility and clear plain language.
- A clear disclaimer: decision support, not diagnosis.

---

## c) Use of Super Intelligence (SI)

SI tools were used to build AstraHealth, and every use is identified in the project:

- **Code:** written with SI coding assistants, directed, reviewed and tested by the team. Claude Code (Anthropic) wrote the backend, data, health rules engine, database, server, AI and SOS logic, and the 3D generator. OpenAI Codex/ChatGPT wrote the frontend UI. This is acknowledged in `SI_DISCLOSURE.md`, the machine-readable `si-metadata.json`, `package.json`, the `index.html` meta tags, the README and the app's login page and footer.
- **Images:** the human body figure, the journey artwork and the five organ reference images are SI-generated. They show a visible "SI-generated" watermark wherever they appear in the app and carry SI metadata in the files. The 3D organ models were built from these images by SI-written code; they are watermarked "SI-generated 3D" and their GLB metadata says so.
- **Data:** all health data is simulated by SI-written code; no real astronaut data is used.
- **Runtime AI:** the medical briefing, photo first look and file extraction are produced live by Google Gemini and labelled "AI briefing (SI-generated)" and "AI first look (SI-generated text)". Offline rules take over when it is unavailable.
- **Audio:** none.
- **NASA branding:** no NASA logos, flags, patches or mission identifiers are used or modified in any generated content.
