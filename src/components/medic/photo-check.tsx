import { useEffect, useState } from "react";
import {
  analyzeSkinPhoto,
  computeImageStats,
  skinResultCard,
} from "@/services/photoCheckService";
import type { PhotoRecord } from "@/types/astronaut";
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
}: {
  open: boolean;
  onClose: () => void;
  model: MissionModel;
  bodyLocation: string;
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
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 160;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, 160, 160);
      bitmap.close();
      const imageStats = computeImageStats(ctx.getImageData(0, 0, 160, 160));
      const r = await analyzeSkinPhoto({
        astronautId: model.profile.id,
        day: model.profile.missionDay,
        file,
        fileName: file.name,
        mimeType: file.type,
        bodyLocation: location,
        notes,
        imageStats,
      });
      setResult(r);
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
          Preview only; image not retained after refresh. Saving records the
          assessment and queues a review summary, not the image.
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
                ? "Offline demo: uses filename/context and quality checks, not diagnostic image recognition."
                : "AI-assisted first look."}
            </p>
            <ol>
              {(result.firstAid ?? []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p>{card.groundReview}</p>
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
