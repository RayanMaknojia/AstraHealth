import { useEffect, useState } from "react";
import {
  analyzeSkinPhoto,
  computeImageStats,
  listPhotos,
  skinResultCard,
  SKIN_LABEL_TEXT,
} from "@/services/photoCheckService";
import { listCheckins } from "@/services/checkinService";
import type { PhotoContext, PhotoRecord } from "@/types/astronaut";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Status } from "./primitives";
import type { MissionModel } from "./use-mission";
export function PhotoCheck({
  open,
  onClose,
  model,
  bodyLocation,
  onResult,
}: {
  open: boolean;
  onClose: () => void;
  model: MissionModel;
  bodyLocation: string;
  /** Called with the saved assessment (database, emergency check, briefing). */
  onResult?: (record: PhotoRecord, image?: Blob | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [url, setUrl] = useState(""),
    [location, setLocation] = useState(bodyLocation),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<PhotoRecord | null>(null),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const analyze = async () => {
    if (!file || !location.trim()) return;
    setBusy(true);
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      // Keep a copy of the photo for your records (JPEG, longest side ≤ 1280 px).
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const full = document.createElement("canvas");
      full.width = Math.max(1, Math.round(bitmap.width * scale));
      full.height = Math.max(1, Math.round(bitmap.height * scale));
      full.getContext("2d")!.drawImage(bitmap, 0, 0, full.width, full.height);
      const image = await new Promise<Blob | null>((res) =>
        full.toBlob(res, "image/jpeg", 0.85),
      );
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, 160, 160);
      bitmap.close();
      const imageStats = computeImageStats(ctx.getImageData(0, 0, 160, 160));
      const value = (id: string) =>
        model.profile.indicators.find((i) => i.id === id)?.value ?? undefined;
      const num = (id: string) => {
        const v = Number(value(id));
        return Number.isFinite(v) ? v : undefined;
      };
      const context: PhotoContext = {
        missionDay: model.profile.missionDay,
        location: model.missionState.phase.name,
        escalationMode: model.report.escalationMode,
        tempC: num("body_temp"),
        heartRate: num("heart_rate"),
        spo2: num("spo2"),
        bloodPressure:
          value("blood_pressure") !== undefined
            ? String(value("blood_pressure"))
            : undefined,
        symptoms: listCheckins(model.profile.id, model.profile.missionDay, 3)
          .flatMap((c) => c.symptoms)
          .filter((x, n, a) => a.indexOf(x) === n),
        medicalNotes: model.profile.notes,
        priorPhotos: listPhotos(model.profile.id, "skin")
          .slice(0, 5)
          .map(
            (p) =>
              `Day ${p.missionDay} ${p.bodyLocation}: ${SKIN_LABEL_TEXT[p.aiLabel ?? "unsure"]}, ${p.status === "critical" ? "Alert" : p.status === "caution" ? "Watch" : "Normal"}`,
          ),
      };
      const thumb = document.createElement("canvas");
      thumb.width = 96;
      thumb.height = 96;
      thumb.getContext("2d")!.drawImage(canvas, 0, 0, 96, 96);
      const r = await analyzeSkinPhoto({
        astronautId: model.profile.id,
        day: model.profile.missionDay,
        file,
        fileName: file.name,
        mimeType: file.type,
        bodyLocation: location,
        notes,
        imageStats,
        context,
        thumbnailDataUrl: thumb.toDataURL("image/jpeg", 0.7),
      });
      setResult(r);
      onResult?.(r, image);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to read this photo. Try another image.",
      );
    } finally {
      setBusy(false);
    }
  };
  const close = () => {
    setFile(null);
    setUrl("");
    setResult(null);
    setNotes("");
    setError("");
    onClose();
  };
  const card = result ? skinResultCard(result) : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="photo-check-dialog">
        <DialogTitle>Photo Check</DialogTitle>
        <DialogDescription>
          First look only. Not a diagnosis. Use onboard guidance for concerning
          symptoms.
        </DialogDescription>
        <label>
          Skin photo / camera
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f?.type.startsWith("image/")) {
                setFile(f);
                setUrl(URL.createObjectURL(f));
                setResult(null);
              } else setError("Choose an image file.");
            }}
          />
        </label>
        <p className="fine-print">
          Saving keeps the photo and its assessment in your health record (More
          → My records) and queues a review summary for the flight surgeon.
        </p>
        {url && (
          <img
            className="photo-check-preview"
            src={url}
            alt="Temporary skin photo preview"
          />
        )}
        <label>
          Body location
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. forearm"
          />
        </label>
        <label>
          Symptoms / context
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>
        <Button
          onClick={analyze}
          disabled={!file || !location.trim() || busy || Boolean(result)}
        >
          {busy
            ? "Reviewing…"
            : result
              ? "Assessment saved"
              : "Save first-look assessment"}
        </Button>
        {error && <p role="alert">{error}</p>}
        {result && card && (
          <section>
            <Status status={result.status ?? "no_data"} />
            <h3>{card.likelyType}</h3>
            <p>{card.confidenceText}</p>
            <p>
              {result.engine === "offline_mock"
                ? "Offline first look (AI unavailable): uses your notes, pixel colours, quality checks and your vitals, not image recognition."
                : "AI first look, checked against your vitals and history."}
            </p>
            {result.aiSummary && <p>{result.aiSummary}</p>}
            {(result.findings ?? []).length > 0 && (
              <>
                <h4>What the image shows</h4>
                <ul>
                  {result.findings!.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            {(result.severityReasons ?? []).length > 0 && (
              <>
                <h4>Why this colour</h4>
                <ul>
                  {result.severityReasons!.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            {result.sosRecommended && (
              <p role="alert" className="photo-sos">
                This looks serious: an SOS is being prepared. Follow the steps
                below now.
              </p>
            )}
            <h4>Do this now</h4>
            <ol>
              {(result.interimSteps ?? result.firstAid ?? []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            {(result.escalateWhen ?? []).length > 0 && (
              <>
                <h4>Get help if</h4>
                <ul>
                  {result.escalateWhen!.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            )}
            <p>{card.groundReview}</p>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
