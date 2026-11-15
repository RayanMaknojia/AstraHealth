import { useState } from "react";
import { Pause, Play } from "lucide-react";
import type { BodySystem } from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import { OrganModel } from "./organ-model";
import { SiBadge } from "./primitives";
// 3D models built from the five reference images (assets/organs/image-to-3d.py).
import brain from "./assets/organs/image-brain.glb?url";
import heart from "./assets/organs/image-heart.glb?url";
import liver from "./assets/organs/image-liver.glb?url";
import dna from "./assets/organs/image-dna.glb?url";
import musculoskeletal from "./assets/organs/image-leg.glb?url";
const systems: { id: BodySystem; label: string; url: string }[] = [
  { id: "behavioral", label: "Brain and wellbeing", url: brain },
  { id: "cardiovascular", label: "Heart and circulation", url: heart },
  { id: "metabolic", label: "Metabolism", url: liver },
  { id: "radiation_immune", label: "Immune and radiation", url: dna },
  { id: "musculoskeletal", label: "Bones and muscle", url: musculoskeletal },
];
export function OrganSystems({
  selected,
  onSelect,
}: {
  selected: BodySystem;
  onSelect: (s: BodySystem) => void;
}) {
  const [paused, setPaused] = useState(false);
  return (
    <section className="organ-systems organ-rows" aria-label="Body systems">
      <Button
        variant="outline"
        aria-pressed={paused}
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? (
          <Play data-icon="inline-start" />
        ) : (
          <Pause data-icon="inline-start" />
        )}
        {paused ? "Resume rotation" : "Pause rotation"}
      </Button>
      <div className="organ-cards">
        {systems.map((system) => (
          <button
            key={system.id}
            className="organ-card"
            title={system.label}
            aria-label={system.label}
            aria-pressed={selected === system.id}
            onClick={() => onSelect(system.id)}
          >
            <OrganModel
              url={system.url}
              label={`${system.label}, 3D anatomical illustration`}
              paused={paused}
            />
            <span className="organ-card-name">{system.label}</span>
            <SiBadge label="SI-generated 3D" />
          </button>
        ))}
      </div>
    </section>
  );
}
