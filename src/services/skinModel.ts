/**
 * Onboard skin photo model (replaces the Gemini image call in Photo Check).
 *
 * - MobileNetV3 fine-tuned on public wound photos (ml/skin_classifier, see MODEL_CARD.md).
 * - Runs in the browser with onnxruntime-web (WebAssembly). No server, no internet, no API key.
 * - Classes the model knows: abrasion, bruise, burn, laceration, normal.
 * - Normalisation, temperature calibration and softmax are baked into the ONNX file,
 *   so the input is just RGB in 0..1 at 224 x 224 and the output is calibrated probabilities.
 * - Never throws: resolves null if the model can't load or the image can't be read,
 *   and the caller falls back to the offline rules.
 */

import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import type { InferenceSession } from 'onnxruntime-web'
import type { SkinLabel } from '@/types/astronaut'

/** Model output order (must match ml/skin_classifier/scripts/train.py CLASSES). */
export const MODEL_CLASSES: SkinLabel[] = ['abrasion', 'bruise', 'burn', 'laceration', 'normal']
export const MODEL_VERSION = 'skin-v1.0'
const SIZE = 224

const base = () => (import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/')
const MODEL_URL = () => `${base()}models/skin_classifier.onnx`

type Ort = typeof import('onnxruntime-web/wasm')
let loading: Promise<{ ort: Ort; session: InferenceSession } | null> | null = null

/** Load the model once (lazy). Safe to call early, e.g. when Photo Check opens. */
export function loadSkinModel(): Promise<{ ort: Ort; session: InferenceSession } | null> {
  if (!loading) {
    loading = (async () => {
      try {
        const ort = await import('onnxruntime-web/wasm')
        ort.env.wasm.wasmPaths = { wasm: wasmUrl }
        ort.env.wasm.numThreads = 1 // threads need cross-origin isolation; one thread is fast enough
        const session = await ort.InferenceSession.create(MODEL_URL(), { executionProviders: ['wasm'] })
        return { ort, session }
      } catch (e) {
        console.warn('[astrahealth] Onboard skin model could not load, using offline rules.', e)
        loading = null // allow a retry later
        return null
      }
    })()
  }
  return loading
}

/** Turn RGBA pixels (already 224 x 224) into a [1,3,224,224] float tensor in 0..1. */
export function pixelsToTensorData(rgba: Uint8ClampedArray | number[], size = SIZE): Float32Array {
  const plane = size * size
  const out = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    out[i] = rgba[i * 4] / 255
    out[plane + i] = rgba[i * 4 + 1] / 255
    out[2 * plane + i] = rgba[i * 4 + 2] / 255
  }
  return out
}

/** Stretch the image to 224 x 224 (same as training) and read its pixels. */
async function readPixels(file: Blob): Promise<Uint8ClampedArray | null> {
  try {
    const bmp = await createImageBitmap(file)
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(SIZE, SIZE) : Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE })
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
    if (!ctx) return null
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, SIZE, SIZE)
    bmp.close?.()
    return ctx.getImageData(0, 0, SIZE, SIZE).data
  } catch {
    return null
  }
}

export interface SkinModelResult {
  /** Classes sorted by probability, highest first. */
  ranked: { label: SkinLabel; confidence: number }[]
  inferenceMs: number
  modelVersion: string
}

/** Classify a skin photo with the onboard model. Resolves null on any failure. */
export async function classifySkinPhoto(file: Blob): Promise<SkinModelResult | null> {
  const loaded = await loadSkinModel()
  if (!loaded) return null
  const pixels = await readPixels(file)
  if (!pixels) return null
  try {
    const t0 = performance.now()
    const input = new loaded.ort.Tensor('float32', pixelsToTensorData(pixels), [1, 3, SIZE, SIZE])
    const out = await loaded.session.run({ image: input })
    const probs = Array.from(out.probs.data as Float32Array)
    const ranked = probs
      .map((p, i) => ({ label: MODEL_CLASSES[i], confidence: Math.round(p * 1000) / 1000 }))
      .sort((a, b) => b.confidence - a.confidence)
    return { ranked, inferenceMs: Math.round(performance.now() - t0), modelVersion: MODEL_VERSION }
  } catch (e) {
    console.warn('[astrahealth] Onboard skin model failed on this image.', e)
    return null
  }
}
