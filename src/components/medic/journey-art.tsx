import artwork from "./assets/journey/mission-artwork.png";
const positions = {
  earth: 0,
  moon: 25,
  mars: 50,
  iss: 75,
  shuttle: 100,
} as const;
export function JourneyArt({ kind }: { kind: keyof typeof positions }) {
  return (
    <span
      aria-hidden="true"
      className={`journey-art journey-art-${kind}`}
      style={{
        backgroundImage: `url(${artwork})`,
        backgroundPositionX: `${positions[kind]}%`,
      }}
    />
  );
}
