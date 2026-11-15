import { useEffect, useMemo, useState } from "react";
import { Download, FileText, ImageIcon, ShieldAlert } from "lucide-react";
import {
  databaseStats,
  getReadings,
  listPhotoRecords,
  listScans,
  listSos,
  listUploads,
} from "@/services/healthDb";
import type { StoredPhoto, UploadRow } from "@/services/healthDb";
import { listSosIssues } from "@/services/emergencyService";
import type { SosIssue } from "@/services/emergencyService";
import { SKIN_LABEL_TEXT } from "@/services/photoCheckService";
import type { SosEvent } from "@/types/astronaut";
import { Button } from "@/components/ui/button";
import { Panel, Status } from "./primitives";
import type { MissionModel } from "./use-mission";

interface Records {
  photos: StoredPhoto[];
  uploads: UploadRow[];
  sos: SosEvent[];
  issues: SosIssue[];
  stats: Record<string, number>;
}

/** Object URLs for stored images/files, revoked when the list changes or unmounts. */
function useBlobUrls(blobs: (Blob | undefined)[]) {
  const urls = useMemo(
    () => blobs.map((b) => (b ? URL.createObjectURL(b) : "")),
    [blobs],
  );
  useEffect(
    () => () => urls.forEach((u) => u && URL.revokeObjectURL(u)),
    [urls],
  );
  return urls;
}

const when = (iso?: string) =>
  iso
    ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"
    : "";

/** Everything the astronaut uploaded or typed, with results: photos, reports, SOS. */
export function MyRecords({ model }: { model: MissionModel }) {
  const id = model.profile.id;
  const [data, setData] = useState<Records | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // Reload when new photos / reports / SOS arrive (they update the briefing or SOS state).
  const refreshKey = `${model.aiBriefing?.id ?? ""}:${model.lastSos?.id ?? ""}:${model.pendingSos?.endsAt ?? ""}`;
  useEffect(() => {
    let live = true;
    void Promise.all([
      listPhotoRecords(id),
      listUploads(id),
      listSos(id),
      databaseStats(id),
    ]).then(([photos, uploads, sos, stats]) => {
      if (live)
        setData({
          photos: [...photos].reverse(),
          uploads: [...uploads].reverse(),
          sos: [...sos].reverse(),
          issues: listSosIssues(id),
          stats,
        });
    });
    return () => {
      live = false;
    };
  }, [id, refreshKey]);
  const photoBlobs = useMemo(
    () => (data?.photos ?? []).map((p) => p.image),
    [data],
  );
  const fileBlobs = useMemo(
    () => (data?.uploads ?? []).map((u) => u.file),
    [data],
  );
  const photoUrls = useBlobUrls(photoBlobs);
  const fileUrls = useBlobUrls(fileBlobs);

  const exportAll = async () => {
    const [readings, scans] = await Promise.all([
      getReadings(id),
      listScans(id),
    ]);
    const strip = <T extends object>(x: T) =>
      Object.fromEntries(
        Object.entries(x).filter(([, v]) => !(v instanceof Blob)),
      );
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            astronaut: { id, name: model.profile.name },
            readings,
            scans,
            photos: data?.photos.map(strip),
            reports: data?.uploads.map(strip),
            sos: data?.sos,
            sosIssues: data?.issues,
            note: "Photos and attached files are listed without their image/file content; download them from My records.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `space-medic-${id}-records.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  if (!data) return <p className="chart-empty">Loading your records…</p>;
  return (
    <div className="my-records">
      <Panel
        title="My health records"
        accessory={
          <Button variant="outline" onClick={() => void exportAll()}>
            <Download data-icon="inline-start" />
            Download my data
          </Button>
        }
      >
        <p>
          Stored on this device: {data.stats.readings ?? 0} readings,{" "}
          {data.stats.scans ?? 0} body scans, {data.photos.length} photos,{" "}
          {data.uploads.length} reports and files, {data.sos.length} SOS events,{" "}
          {data.stats.briefings ?? 0} briefings.
        </p>
      </Panel>

      <Panel title={`Photos (${data.photos.length})`}>
        {!data.photos.length && <p>No photos yet. Add one from Check-in.</p>}
        <ul className="records-list">
          {data.photos.map((p, n) => (
            <li key={p.id} data-testid="record-photo">
              {photoUrls[n] || p.thumbnailDataUrl ? (
                <a
                  href={photoUrls[n] || p.thumbnailDataUrl}
                  target="_blank"
                  rel="noreferrer"
                  download={`${p.bodyLocation || "photo"}-day${p.missionDay}.jpg`}
                >
                  <img
                    src={photoUrls[n] || p.thumbnailDataUrl}
                    alt={`Photo of ${p.bodyLocation}, day ${p.missionDay}`}
                  />
                </a>
              ) : (
                <span className="records-noimg">
                  <ImageIcon size={22} />
                </span>
              )}
              <div>
                <strong>
                  {p.mode === "skin"
                    ? SKIN_LABEL_TEXT[p.aiLabel ?? "unsure"]
                    : `Ultrasound: ${p.scanType ?? ""}`}{" "}
                  · {p.bodyLocation}
                </strong>
                <Status status={p.status ?? "no_data"} />
                <small>
                  Day {p.missionDay} · {when(p.savedAt)}
                  {p.aiConfidence !== undefined &&
                    ` · ${Math.round(p.aiConfidence * 100)}% sure`}
                  {p.sosRecommended && " · SOS recommended"}
                </small>
                {p.notes && <p>“{p.notes}”</p>}
                {p.aiSummary && <p>{p.aiSummary}</p>}
                <Button
                  variant="ghost"
                  onClick={() => setOpen(open === p.id ? null : p.id)}
                >
                  {open === p.id ? "Hide details" : "Show details"}
                </Button>
                {open === p.id && (
                  <div className="records-details">
                    {!!p.findings?.length && (
                      <>
                        <h4>What the image showed</h4>
                        <ul>
                          {p.findings.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {!!p.severityReasons?.length && (
                      <>
                        <h4>Why this colour</h4>
                        <ul>
                          {p.severityReasons.map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    <h4>Care steps given</h4>
                    <ol>
                      {(p.interimSteps ?? p.firstAid ?? []).map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ol>
                    <p className="fine-print">
                      Flight surgeon review:{" "}
                      {p.reviewStatus === "reviewed"
                        ? (p.reviewNotes ?? "reviewed")
                        : "pending"}
                    </p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={`Reports and files (${data.uploads.length})`}>
        {!data.uploads.length && (
          <p>Nothing sent yet from “Something wrong? Tell Space Medic”.</p>
        )}
        <ul className="records-list">
          {data.uploads.map((u, n) => (
            <li key={u.id} data-testid="record-report">
              <span className="records-noimg">
                <FileText size={22} />
              </span>
              <div>
                <strong>
                  {u.text ? "Your report" : "File"}
                  {u.fileName ? ` · ${u.fileName}` : ""}
                </strong>
                <Status
                  status={u.artifact.accepted ? u.artifact.severity : "no_data"}
                />
                <small>
                  Day {Math.floor(u.day)} · {when(u.createdAt)}
                </small>
                {u.text && <p>“{u.text}”</p>}
                <p>
                  {u.artifact.accepted
                    ? u.artifact.extractedSummary
                    : `Not added to your readings: ${u.artifact.rejectionReason ?? "not medical data"}`}
                </p>
                {fileUrls[n] && (
                  <a
                    href={fileUrls[n]}
                    download={u.fileName ?? "attachment"}
                    className="records-link"
                  >
                    <Download size={14} /> Download {u.fileName ?? "file"}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={`SOS history (${data.sos.length})`}>
        {!data.sos.length && <p>No SOS sent.</p>}
        <ul className="records-list">
          {data.sos.map((e) => (
            <li key={e.id}>
              <span className="records-noimg">
                <ShieldAlert size={22} />
              </span>
              <div>
                <strong>
                  {e.trigger === "auto" ? "Automatic SOS" : "SOS button"} · day{" "}
                  {e.missionDay}
                </strong>
                <small>{when(e.createdAt)}</small>
                <p>{e.reasons.join(" ")}</p>
                <small>
                  Sent to: {e.recipients.map((r) => r.name).join(" · ")}
                </small>
              </div>
            </li>
          ))}
        </ul>
        {!!data.issues.length && (
          <>
            <h4>Issues that triggered an automatic SOS</h4>
            <ul className="records-issues">
              {data.issues.map((i) => (
                <li key={i.key}>
                  {i.reasons[0] ?? i.key}: detected {i.count}×,{" "}
                  {i.outcome === "sent"
                    ? "SOS sent once"
                    : i.outcome === "cancelled"
                      ? "cancelled (“I'm OK”)"
                      : "waiting"}
                  . Not sent again automatically.
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
