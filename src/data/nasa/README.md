# Real NASA open data (offline snapshots)

Loaded by `src/data/nasaOpenData.ts` and replayed by `src/services/environmentFeed.ts`.
Retrieved 2026-11-15.

## `radlab-iss-dostel2-2019-12.csv` — ISS radiation (NASA OSDR RadLab)

- **What:** absorbed dose rate measured by the **DOSTEL2** detector on the International
  Space Station (DORELI project, Italian Space Agency), 2019-12-01 to 2019-12-14.
- **Query used (RadLab Data API, CSV):**
  `https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS&instrument=DosTel2&timestamp>=2019-12-01&timestamp<2019-12-15&absorbed_dose_rate&format=csv`
- **Processing:** 12,738 raw readings (about one every 100 s) averaged into 1,342
  fifteen-minute steps. Columns: `timestamp_utc, absorbed_dose_rate_ugy_per_h, samples`.
- **Units:** µGy/h. Integrating a day gives ~270–300 µGy/day, matching published
  DOSTEL ISS values. Readings of several hundred µGy/h are South Atlantic Anomaly passes.
- **In the app:** radiation for crews in Earth orbit (ISS) — More → Cabin readings,
  the radiation indicator and Home exposure. Converted to dose equivalent with a
  quality factor of 2 (an approximation; measured ISS values are ~2–2.5).
- **Credit:** "Data and visualizations are courtesy of the RadLab Portal
  (https://visualization.osdr.nasa.gov/radlab/gui/overview/)." General OSDR credit:
  "Data are courtesy of the NASA Open Science Data Repository" (Gebre et al., 2024,
  *Nucleic Acids Research* 53(D1): D1697–D1710).

## `donki-sep-2024.json` — solar energetic particle events (NASA DONKI)

- **What:** all 76 SEP events DONKI recorded in 2024 (event time, detecting instrument,
  linked flares/CMEs, DONKI page link).
- **Endpoint (no API key, max 60 days per request):**
  `https://ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- **In the app:** the Mission Control "Trigger solar storm" demo uses these real events
  in turn; the alert names the real event and instrument. The extra dose per location
  is still modelled (DONKI reports events, not crew dose).
- **Terms:** DONKI content is "experimental research information", provided as is.
  NOAA SWPC is the official U.S. space-weather forecast source. Credit: NASA Community
  Coordinated Modeling Center (CCMC), https://ccmc.gsfc.nasa.gov/tools/DONKI.

## Not real data

Astronaut vitals (heart rate, blood pressure, sleep, mood, …) and cabin air
(CO₂, temperature, humidity) remain simulated. Daily crew medical data is not public;
real ISS cabin telemetry is available per Rodent Research mission from the OSDR
Environmental Data App (https://visualization.osdr.nasa.gov/eda/) as a manual CSV export.
