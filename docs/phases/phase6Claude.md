# Phase 6 (Claude Code): Rotating 3D Organs From the Reference Images

**Owner:** Claude Code (the five Body Map models only, as agreed with the user)
**Starting point:** `main` at `cd589f7` (Codex PR #10)

## Request

Use the five supplied images (brain, heart, liver, DNA, knee-to-foot leg) to make 3D versions that rotate like the reference turntable video, and replace the current Body Map models.

## Approach

No image-to-3D AI model was available offline, so each model is built directly from its picture by `src/components/medic/assets/organs/image-to-3d.py` (numpy, scipy, pillow; about 5 s for all five):

1. **Cut-out:** the organ is separated from its dark background using the red channel (the blue-teal glow around the organs has almost no red; tissue does), then cleaned; real gaps such as between the DNA strands are kept.
2. **Inflation:** the outline is turned into a volume by solving `laplace(h) = -2` inside it and using `depth = sqrt(h)`, so thick parts (brain) and thin parts (DNA strands, bones) all get round cross-sections of their own width. Depth per organ: brain 0.95, heart 0.9, liver 0.7, DNA 1.0, leg 0.85.
3. **Surface relief** from the picture's own fine light/dark detail (gyri, vessels, muscle fibres), so the surface catches the light as it turns.
4. **Closed mesh** (front, mirrored back and stitched rim) textured with the original image and a smooth alpha outline, plus a per-row side-projection attribute (`_SIDE`).

In `organ-model.tsx` a small shader colours side-facing surfaces from the same row of the picture, so the sides show tissue instead of stretched edges, and the alpha outline is used only where the surface is seen edge-on. Lighting is gentle and tone mapping is off, because the pictures already contain their studio lighting. Rotation: a full turn every 12 s (30°/s), continuous 360°, with the existing pause button, offscreen pause and reduced-motion support.

## Result

- The front view matches each picture exactly; turning shows a rounded, solid organ all the way round.
- The sides and back are a rounded estimate from a single image, not a scan or exact anatomy.
- Models: brain 2.9 MB, heart 2.5 MB, liver 2.1 MB, DNA 1.3 MB, leg 1.1 MB (loaded only on Body Map).

## Files

| File | Change |
|---|---|
| `assets/organs/image-to-3d.py` | New generator |
| `assets/organs/source/*.jpg` | The five supplied images |
| `assets/organs/image-*.glb` | The five new models |
| `organ-systems.tsx` | Uses the new models |
| `organ-model.tsx` | Side-projection shader, lighting for textured models, 30°/s rotation |
| `assets/organs/LICENSE.txt` | Notes the new assets |

## Checks

| Check | Result |
|---|---|
| TypeScript, ESLint, production build | Pass |
| Turntable screenshots of all five, every 45° | Solid all round; no holes, streaks or background glow |
| Browser errors on Body Map | None |
