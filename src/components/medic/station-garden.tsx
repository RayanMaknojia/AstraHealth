import { useCallback, useEffect, useMemo, useState } from "react";
import { Sprout, Users, Wifi, WifiOff, Sparkles, Lock } from "lucide-react";
import { GARDEN, PLANTS } from "@/data/gardenData";
import {
  GardenError,
  gardeners,
  gardenView,
  growthStage,
  nextUnlock,
  plantSeed,
  seedEarnings,
  startGardening,
  syncGarden,
  unlockedKinds,
  weeklyProgress,
} from "@/services/gardenService";
import type { GardenPlant, PlantKind } from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import { notify, type MissionModel } from "./use-mission";

// ── Layout: rows recede toward the back of the dome ─────────────────────────
const W = 1200,
  H = 480;
const rowY = (row: number) => 292 + row * 38;
const rowSpacing = (row: number) => 68 + row * 7;
const rowScale = (row: number) => 0.62 + row * 0.1;
const plotX = (col: number, row: number) =>
  W / 2 + (col - (GARDEN.cols - 1) / 2) * rowSpacing(row);

const STAGE_SCALE = [0.5, 0.68, 0.86, 1];
const STAGE_NAMES = ["Sprout", "Young", "Grown", "Blooming"];
const hue = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
const PETALS = ["#f472b6", "#facc15", "#a78bfa", "#fb7185", "#f9a8d4"];

function Sprouting() {
  return (
    <g>
      <path
        d="M0 0 C0 -10 0 -16 0 -22"
        stroke="#4ade80"
        strokeWidth="3"
        fill="none"
      />
      <path
        d="M0 -14 C-10 -22 -18 -18 -20 -12 C-12 -10 -6 -12 0 -14Z"
        fill="#4ade80"
      />
      <path
        d="M0 -18 C10 -28 18 -24 20 -18 C12 -16 6 -16 0 -18Z"
        fill="#22c55e"
      />
    </g>
  );
}

/** One plant, drawn at the origin (its base), growing upward. */
function PlantArt({
  kind,
  stage,
  seed,
}: {
  kind: PlantKind;
  stage: number;
  seed: number;
}) {
  if (stage === 0) return <Sprouting />;
  const bloom = stage === 3;
  const petal = PETALS[seed % PETALS.length];
  switch (kind) {
    case "grass":
      return (
        <g>
          {[-14, -7, 0, 7, 14].map((x, i) => (
            <path
              key={i}
              d={`M${x} 0 Q${x + (i % 2 ? 6 : -6)} -24 ${x + (i % 2 ? 10 : -9)} -${38 + (i % 3) * 6}`}
              stroke={i % 2 ? "#4ade80" : "#22c55e"}
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
          ))}
          {bloom && <circle cx="10" cy="-44" r="3.5" fill="#fef08a" />}
        </g>
      );
    case "flower":
      return (
        <g>
          <path
            d="M0 0 C2 -20 -2 -36 0 -50"
            stroke="#16a34a"
            strokeWidth="3.5"
            fill="none"
          />
          <path
            d="M0 -20 C-14 -28 -20 -22 -18 -16 C-10 -14 -4 -16 0 -20Z"
            fill="#22c55e"
          />
          <path
            d="M0 -30 C14 -38 20 -32 18 -26 C10 -24 4 -26 0 -30Z"
            fill="#4ade80"
          />
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx="0"
              cy="-60"
              rx="6"
              ry="11"
              fill={petal}
              transform={`rotate(${a} 0 -50)`}
            />
          ))}
          <circle cx="0" cy="-50" r="6" fill="#fde047" />
          {bloom && (
            <circle cx="0" cy="-50" r="16" fill={petal} opacity="0.18" />
          )}
        </g>
      );
    case "fern":
      return (
        <g>
          {[-50, -25, 0, 25, 50].map((a, i) => (
            <g key={a} transform={`rotate(${a})`}>
              <path
                d="M0 0 C-4 -20 -2 -40 6 -54"
                stroke={i % 2 ? "#15803d" : "#22c55e"}
                strokeWidth="3"
                fill="none"
              />
              {[12, 22, 32, 42].map((y) => (
                <path
                  key={y}
                  d={`M${-1 + y / 20} -${y} l-9 -5 M${-1 + y / 20} -${y} l9 -7`}
                  stroke="#4ade80"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ))}
            </g>
          ))}
        </g>
      );
    case "tree":
      return (
        <g>
          <path d="M-5 0 L-4 -40 L4 -40 L5 0Z" fill="#8b5a2b" />
          <circle cx="-14" cy="-52" r="18" fill="#15803d" />
          <circle cx="14" cy="-54" r="18" fill="#16a34a" />
          <circle cx="0" cy="-70" r="22" fill="#22c55e" />
          {bloom &&
            [-12, 8, 16, -2].map((x, i) => (
              <circle
                key={i}
                cx={x}
                cy={-60 - (i % 2) * 14}
                r="3.5"
                fill="#fca5a5"
              />
            ))}
        </g>
      );
    case "mushroom":
      return (
        <g>
          <path d="M-5 0 L-4 -18 L4 -18 L5 0Z" fill="#fef3c7" />
          <path
            d="M-20 -16 C-20 -38 20 -38 20 -16Z"
            fill={seed % 2 ? "#dc2626" : "#b45309"}
          />
          {[-10, 0, 9].map((x, i) => (
            <circle
              key={i}
              cx={x}
              cy={-24 - (i % 2) * 5}
              r="3"
              fill="#fef3c7"
            />
          ))}
          <path d="M14 0 L15 -10 L19 -10 L20 0Z" fill="#fef3c7" />
          <path d="M8 -9 C8 -20 26 -20 26 -9Z" fill="#b45309" />
        </g>
      );
    case "reed":
      return (
        <g>
          <ellipse cx="0" cy="2" rx="24" ry="6" fill="#0e7490" opacity="0.7" />
          {[-10, -3, 4, 11].map((x, i) => (
            <g key={i}>
              <path
                d={`M${x} 0 L${x + (i % 2 ? 2 : -2)} -${48 + i * 4}`}
                stroke="#65a30d"
                strokeWidth="2.5"
              />
              <rect
                x={x + (i % 2 ? 0 : -4) - 1}
                y={-(48 + i * 4) - 2}
                width="5"
                height="14"
                rx="2.5"
                fill="#78350f"
              />
            </g>
          ))}
        </g>
      );
    case "lily":
      return (
        <g>
          <ellipse cx="0" cy="0" rx="30" ry="9" fill="#0e7490" opacity="0.75" />
          <path d="M-18 -2 A14 6 0 1 0 -2 -6 L-10 -3Z" fill="#16a34a" />
          <path d="M6 1 A12 5 0 1 0 22 -1 L14 0Z" fill="#22c55e" />
          {[-30, 0, 30].map((a) => (
            <ellipse
              key={a}
              cx="0"
              cy="-12"
              rx="5"
              ry="10"
              fill={bloom ? "#f9a8d4" : "#fbcfe8"}
              transform={`rotate(${a} 0 -4)`}
            />
          ))}
          <circle cx="0" cy="-6" r="3" fill="#fde047" />
        </g>
      );
    case "pine":
      return (
        <g>
          <rect x="-4" y="-14" width="8" height="14" fill="#78350f" />
          <path d="M0 -84 L18 -50 L-18 -50Z" fill="#166534" />
          <path d="M0 -66 L24 -30 L-24 -30Z" fill="#15803d" />
          <path d="M0 -46 L28 -12 L-28 -12Z" fill="#14532d" />
          {bloom && <path d="M0 -84 L4 -76 L-4 -76Z" fill="#e0f2fe" />}
        </g>
      );
    case "crystal":
      return (
        <g>
          <circle
            cx="0"
            cy="-24"
            r="26"
            fill="#22d3ee"
            opacity={bloom ? 0.22 : 0.12}
          />
          <path d="M-14 0 L-18 -26 L-10 -40 L-6 -10Z" fill="#67e8f9" />
          <path d="M-4 0 L-2 -52 L8 -60 L6 0Z" fill="#22d3ee" />
          <path d="M8 0 L16 -30 L22 -22 L16 0Z" fill="#a5f3fc" />
        </g>
      );
  }
}

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: (i * 173) % W,
  y: (i * 97) % 230,
  r: i % 9 === 0 ? 1.8 : 1,
}));

/**
 * Station Garden: a garden the whole crew grows together. Healthy habits earn seeds;
 * everyone plants in one shared dome; biomes unlock as the garden grows; a weekly crew
 * goal lights up the aurora. Shared through the server, and works offline.
 */
export function StationGarden({ model }: { model: MissionModel }) {
  const profile = model.profile;
  const [rev, setRev] = useState(0);
  const [kind, setKind] = useState<PlantKind | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  // "Now" for plant ages; refreshed on every sync so growth shows without reloads.
  const [now, setNow] = useState(() => Date.now());

  // Values derived from the garden store; `rev` bumps after every plant or sync.
  const view = useMemo(() => {
    void rev;
    return {
      garden: gardenView(),
      seeds: seedEarnings(profile),
      unlocked: unlockedKinds(),
      next: nextUnlock(),
      week: weeklyProgress(undefined, now),
      people: gardeners(),
    };
  }, [rev, profile, now]);
  const { garden, seeds, unlocked, next, week, people } = view;

  const sync = useCallback(async () => {
    setSyncing(true);
    const r = await syncGarden();
    setSyncing(false);
    setNow(Date.now());
    setRev((x) => x + 1);
    for (const p of r.bumped)
      notify(
        "A crewmate planted there first",
        `Your ${p.kind} seed is back in your pocket. Pick another plot.`,
      );
  }, []);

  // Fetch crewmates' plants on open and every 15 s while the garden is visible.
  useEffect(() => {
    startGardening(profile);
    const first = window.setTimeout(() => {
      setRev((x) => x + 1);
      void sync();
    }, 0);
    const t = window.setInterval(() => {
      if (!document.hidden) void sync();
    }, GARDEN.pollMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [sync, profile]);

  const occupied = new Map(garden.plants.map((p) => [`${p.col}:${p.row}`, p]));
  const plant = (col: number, row: number) => {
    if (!kind) return;
    try {
      plantSeed({ profile, kind, col, row });
      setRev((x) => x + 1);
      void sync();
    } catch (e) {
      notify(
        "Can’t plant here",
        e instanceof GardenError ? e.message : "Please try again.",
      );
    }
  };
  const describe = (p: GardenPlant) => {
    const days = Math.floor((now - Date.parse(p.plantedAt)) / 86_400_000);
    const label = PLANTS.find((x) => x.kind === p.kind)?.label ?? p.kind;
    return `${label} · ${STAGE_NAMES[growthStage(p, now)]} · planted by ${p.name}${p.starter ? " (simulated)" : ""} · ${days === 0 ? "today" : `${days} day${days > 1 ? "s" : ""} ago`}`;
  };
  const plots = [];
  for (let row = 0; row < GARDEN.rows; row++)
    for (let col = 0; col < GARDEN.cols; col++) plots.push({ col, row });

  return (
    <section className="station-garden" aria-label="Station Garden">
      <div className="garden-head">
        <div>
          <h3>Station Garden</h3>
          <p>
            A garden the whole crew grows together. Each day, a check-in, a
            workout that meets the goal, a good night’s sleep, a journal entry
            a Ghost Run and the Orbit Lab target each earn a seed; plant it anywhere in the dome and
            watch it grow over the coming days.
          </p>
        </div>
        <div className="garden-seeds" aria-live="polite">
          <Sprout aria-hidden="true" />
          <strong>{seeds.available}</strong>
          <span>seed{seeds.available === 1 ? "" : "s"} to plant</span>
        </div>
      </div>

      <div
        className="garden-picker"
        role="radiogroup"
        aria-label="Choose a plant"
      >
        {PLANTS.map((p) => {
          const open = unlocked.has(p.kind);
          return (
            <button
              key={p.kind}
              type="button"
              role="radio"
              aria-checked={kind === p.kind}
              disabled={!open}
              className={`garden-chip ${kind === p.kind ? "on" : ""}`}
              onClick={() => setKind(kind === p.kind ? null : p.kind)}
              title={
                open
                  ? `${p.label} (${p.biome})`
                  : `Unlocks when the garden has ${p.unlockAt} plants`
              }
            >
              <svg
                viewBox="-34 -92 68 100"
                width="34"
                height="50"
                aria-hidden="true"
              >
                <PlantArt kind={p.kind} stage={3} seed={2} />
              </svg>
              <span>{p.label}</span>
              {!open && (
                <small>
                  <Lock size={11} aria-hidden="true" /> {p.unlockAt}
                </small>
              )}
            </button>
          );
        })}
      </div>
      <p className="garden-hint" role="status">
        {seeds.available < 1
          ? "No seeds right now: check in, sleep 7 h+, exercise, journal, race a Ghost Run or solve the Orbit Lab to earn more."
          : kind
            ? `Now tap an empty plot to plant your ${PLANTS.find((p) => p.kind === kind)?.label.toLowerCase()}.`
            : "Pick a plant above, then tap an empty plot."}
      </p>

      <div className="garden-dome">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label="The crew’s garden dome"
        >
          <defs>
            <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#050b16" />
              <stop offset="1" stopColor="#12304a" />
            </linearGradient>
            <linearGradient id="g-soil" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3f6b2f" />
              <stop offset="0.12" stopColor="#2f4f24" />
              <stop offset="1" stopColor="#1a2b14" />
            </linearGradient>
            <linearGradient id="g-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#bae6fd" stopOpacity="0.14" />
              <stop offset="0.5" stopColor="#bae6fd" stopOpacity="0.02" />
              <stop offset="1" stopColor="#bae6fd" stopOpacity="0.08" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill="url(#g-sky)" />
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#e2e8f0"
              opacity={0.35 + (i % 4) * 0.15}
            />
          ))}
          {week.reached && (
            <g
              className="garden-aurora"
              aria-label="Aurora: weekly crew goal reached"
            >
              <path
                d="M0 120 C200 40 380 160 600 80 C820 10 1000 140 1200 60 L1200 150 C1000 220 820 100 600 170 C380 240 200 120 0 200Z"
                fill="#34d399"
                opacity="0.22"
              />
              <path
                d="M0 90 C240 30 420 120 640 60 C860 0 1020 100 1200 40 L1200 90 C1020 150 860 60 640 120 C420 180 240 90 0 150Z"
                fill="#a78bfa"
                opacity="0.18"
              />
            </g>
          )}
          <path
            d="M40 470 C40 120 360 28 600 28 C840 28 1160 120 1160 470Z"
            fill="url(#g-glass)"
            stroke="#bae6fd"
            strokeOpacity="0.22"
            strokeWidth="2"
          />
          <path
            d="M70 262 C250 236 950 236 1130 262 L1160 470 L40 470Z"
            fill="url(#g-soil)"
          />
          {plots.map(({ col, row }) => {
            const key = `${col}:${row}`;
            const here = occupied.get(key);
            const x = plotX(col, row);
            const y = rowY(row);
            const s = rowScale(row);
            const canPlant = !here && kind !== null && seeds.available > 0;
            return (
              <g key={key}>
                <ellipse
                  cx={x}
                  cy={y + 2}
                  rx={22 * s}
                  ry={6 * s}
                  className={`garden-plot ${canPlant ? "open" : ""} ${hover === key && canPlant ? "hover" : ""}`}
                  role={canPlant ? "button" : undefined}
                  tabIndex={canPlant ? 0 : undefined}
                  aria-label={
                    canPlant
                      ? `Plant here: row ${row + 1}, plot ${col + 1}`
                      : undefined
                  }
                  onClick={() => canPlant && plant(col, row)}
                  onKeyDown={(e) => {
                    if (canPlant && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      plant(col, row);
                    }
                  }}
                  onMouseEnter={() => setHover(key)}
                  onMouseLeave={() => setHover(null)}
                />
                {here && (
                  <g
                    transform={`translate(${x} ${y}) scale(${s * STAGE_SCALE[growthStage(here, now)]})`}
                  >
                    <g
                      className={`garden-plant ${here.starter ? "starter" : ""}`}
                      style={{ animationDelay: `${-(hue(here.id) % 6000)}ms` }}
                    >
                      <title>{describe(here)}</title>
                      <PlantArt
                        kind={here.kind}
                        stage={growthStage(here, now)}
                        seed={hue(here.id)}
                      />
                    </g>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="garden-stats">
        <div>
          <Users size={16} aria-hidden="true" />
          <span>
            <b>{garden.plants.filter((p) => !p.starter).length}</b> plants by{" "}
            <b>{people.length}</b> crewmate{people.length === 1 ? "" : "s"}
            {next
              ? ` · ${next.needed} more to unlock the ${next.biome}`
              : " · every biome unlocked"}
          </span>
        </div>
        <div className="garden-week">
          <span>
            <Sparkles size={16} aria-hidden="true" /> Crew goal this week:{" "}
            <b>
              {week.planted} / {week.goal}
            </b>{" "}
            plants{" "}
            {week.reached
              ? "· the aurora is out tonight!"
              : "to light up the aurora"}
          </span>
          <span className="garden-bar">
            <span
              style={{
                width: `${Math.min(100, (week.planted / week.goal) * 100)}%`,
              }}
            />
          </span>
        </div>
        <div className="garden-earned">
          Your seeds: {seeds.checkins} check-ins · {seeds.goodSleep} good nights
          · {seeds.workouts} workout days · {seeds.journalDays} journal days ·{" "}
          {seeds.ghostRuns} Ghost Run days · {seeds.labDays} Orbit Lab days ={" "}
          {seeds.total} earned, {seeds.spent}{" "}
          planted. The journal’s text is never read; only the number of days
          counts.
        </div>
        <div className="garden-sync">
          {garden.online ? (
            <Wifi size={15} aria-hidden="true" />
          ) : (
            <WifiOff size={15} aria-hidden="true" />
          )}
          <span>
            {garden.online
              ? `Shared with the crew${garden.pending ? `; ${garden.pending} planting${garden.pending > 1 ? "s" : ""} sending…` : ""}.`
              : `No link to the station server: ${garden.pending ? `${garden.pending} planting${garden.pending > 1 ? "s" : ""} saved here, sent when the link is back.` : "showing the garden saved on this device."}`}{" "}
            Plants marked simulated are a starter garden.
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void sync()}
            disabled={syncing}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      </div>
    </section>
  );
}
