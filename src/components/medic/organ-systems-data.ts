import type { PointerEvent } from "react";
import type { BodySystem, DisplayStatus } from "@/types/astronaut";

// Pre-rendered organ illustrations served from public/organs/.
const organ = (file: string) => `${import.meta.env.BASE_URL}organs/${file}`;

export const ORGAN_SYSTEMS: {
  id: BodySystem;
  label: string;
  image: string;
}[] = [
  { id: "behavioral", label: "Brain and wellbeing", image: organ("brain.jpg") },
  {
    id: "cardiovascular",
    label: "Heart and circulation",
    image: organ("heart.jpg"),
  },
  { id: "metabolic", label: "Metabolism", image: organ("liver.jpg") },
  {
    id: "radiation_immune",
    label: "Immune and radiation",
    image: organ("dna.jpg"),
  },
  {
    id: "musculoskeletal",
    label: "Bones and muscle",
    image: organ("bones-muscles.jpg"),
  },
];

/** Glow colour per live system status (emerald / amber / red; slate = unknown). */
export const STATUS_GLOW: Record<DisplayStatus, string> = {
  nominal: "#10b981",
  caution: "#f59e0b",
  critical: "#ef4444",
  no_data: "#64748b",
};

const MAX_TILT = 12; // degrees

const finePointer = () =>
  typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;

/**
 * Pointer-tracking tilt. Put these handlers on any element that contains
 * an OrganView (the whole card, or the hero frame); the CSS variables they
 * set are inherited by the organ inside.
 */
export const tiltHandlers = {
  onPointerMove(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse" || !finePointer()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5; // -0.5 … 0.5
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(x * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * 2 * MAX_TILT).toFixed(2)}deg`);
  },
  onPointerLeave(e: PointerEvent<HTMLElement>) {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  },
};
