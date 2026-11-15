/**
 * Real NASA open data bundled with the app (offline snapshots).
 *
 * 1. ISS radiation - NASA OSDR RadLab, DOSTEL2 detector on the ISS
 *    (DORELI project, Italian Space Agency), 2019-12-01 to 2019-12-14.
 *    Raw readings (~every 100 s, absorbed dose rate in µGy/h) averaged into
 *    15-minute steps to match the app's 15-minute feed ticks.
 *    Query: https://visualization.osdr.nasa.gov/radlab/api/?spacecraft=ISS
 *           &instrument=DosTel2&timestamp>=2019-12-01&timestamp<2019-12-15
 *           &absorbed_dose_rate&format=csv
 *    Daily totals come to ~270-300 µGy/day, matching published ISS DOSTEL
 *    values; spikes of several hundred µGy/h are South Atlantic Anomaly passes.
 *
 * 2. Solar energetic particle (SEP) events - NASA DONKI (Community
 *    Coordinated Modeling Center), all events in 2024.
 *    Endpoint: https://ccmc.gsfc.nasa.gov/DONKI/WS/get/SEP (no API key).
 *
 * See src/data/nasa/README.md for provenance and citation wording.
 */
import radlabCsv from "./nasa/radlab-iss-dostel2-2019-12.csv?raw";
import donkiJson from "./nasa/donki-sep-2024.json?raw";

export interface RadlabSample {
  /** UTC start of the 15-minute step, e.g. "2019-12-05T14:15Z". */
  timestampUtc: string;
  /** Mean absorbed dose rate in the step, µGy/h (as measured). */
  absorbedUGyPerH: number;
}

export interface DonkiSepEvent {
  sepID: string;
  eventTime: string;
  instrument: string | null;
  linkedEvents: string[];
  link: string;
}

export const RADLAB_ISS_INSTRUMENT = "DOSTEL2";
export const RADLAB_STEP_MINUTES = 15;

/**
 * Absorbed dose (Gy) → dose equivalent (Sv) for the ISS radiation mix.
 * Measured ISS quality factors are roughly 2-2.5; 2 keeps the result
 * (~0.55 mSv/day) inside NASA's typical ISS range of 0.3-0.8 mSv/day.
 * This is an approximation, not an organ-weighted effective dose.
 */
export const ISS_QUALITY_FACTOR = 2;

/** Above this the ISS is crossing the South Atlantic Anomaly (proton belt dip). */
export const SAA_THRESHOLD_UGY_PER_H = 50;

export const RADLAB_ISS: RadlabSample[] = radlabCsv
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [timestampUtc, rate] = line.split(",");
    return { timestampUtc, absorbedUGyPerH: Number(rate) };
  })
  .filter((s) => Number.isFinite(s.absorbedUGyPerH));

export const DONKI_SEP_2024: DonkiSepEvent[] = (
  JSON.parse(donkiJson) as { events: DonkiSepEvent[] }
).events;

/** Real ISS reading for a 15-minute feed step (the snapshot loops). */
export function radlabSampleAt(step: number): RadlabSample {
  const n = RADLAB_ISS.length;
  return RADLAB_ISS[((step % n) + n) % n];
}

/** µGy/h absorbed → mSv/day dose equivalent (ISS quality factor). */
export function ugyPerHourToMSvPerDay(ugyPerH: number): number {
  return (ugyPerH * 24 * ISS_QUALITY_FACTOR) / 1000;
}

export const NASA_DATA_CREDITS = [
  {
    label:
      "ISS radiation: data courtesy of the RadLab Portal (NASA Open Science Data Repository) - DOSTEL2, DORELI project (Italian Space Agency), Dec 2019",
    url: "https://visualization.osdr.nasa.gov/radlab/gui/overview/",
  },
  {
    label:
      "Solar particle events: NASA DONKI, Community Coordinated Modeling Center - SEP events 2024 (experimental research information)",
    url: "https://ccmc.gsfc.nasa.gov/tools/DONKI",
  },
] as const;
