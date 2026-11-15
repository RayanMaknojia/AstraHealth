import { useState } from "react";
import { Camera, FileUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "./primitives";

/**
 * "Something wrong?" - describe a problem in words, add a skin/injury photo, or attach a
 * medical file. Text and files go through the ingestion gatekeeper + emergency check;
 * photos open Photo Check (AI first look with the astronaut's own data as context).
 */
export function ReportProblem({
  busy,
  onReport,
  onPhoto,
  onRecords,
}: {
  busy: boolean;
  onReport: (text: string, file?: File | null) => Promise<void>;
  onPhoto: () => void;
  /** Open More → My records. */
  onRecords?: () => void;
}) {
  const [text, setText] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [fileKey, setFileKey] = useState(0),
    [sent, setSent] = useState("");
  const send = async () => {
    const t = text.trim(),
      f = file;
    if (!t && !f) return;
    // Clear right away so anything typed while it is being checked is kept.
    setText("");
    setFile(null);
    setFileKey((k) => k + 1);
    setSent("");
    await onReport(t, f);
    setSent(
      f
        ? `Sent: "${f.name}"${t ? " with your description" : ""}.`
        : "Sent your description.",
    );
  };
  return (
    <Panel title="Something wrong? Tell Space Medic" className="report-problem">
      <p>
        Describe a symptom or injury (scab, bite, rash, cut, infection...), add
        a photo, or attach a lab report. It is checked against your recent
        readings. If it looks serious you get first-aid steps straight away and
        an SOS is prepared.
      </p>
      <label>
        What is happening?
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="e.g. Red, swollen bite on my left forearm since yesterday, feels hot"
          data-testid="report-text"
        />
      </label>
      <div className="report-problem-actions">
        <Button type="button" variant="outline" onClick={onPhoto}>
          <Camera data-icon="inline-start" />
          Add photo of skin / injury
        </Button>
        <label className="report-file">
          <FileUp size={15} aria-hidden="true" />
          <span>
            {file ? file.name : "Attach file (PDF, CSV, text, image)"}
          </span>
          <input
            key={fileKey}
            type="file"
            accept="image/*,application/pdf,text/csv,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            data-testid="report-file"
          />
        </label>
        <Button
          type="button"
          onClick={() => void send()}
          disabled={busy || (!text.trim() && !file)}
        >
          <Send data-icon="inline-start" />
          {busy ? "Checking…" : "Send to Space Medic"}
        </Button>
      </div>
      {sent && (
        <p className="fine-print" role="status">
          {sent} See the result in the toast and the Medical briefing on Home.
        </p>
      )}
      {onRecords && (
        <Button type="button" variant="ghost" onClick={onRecords}>
          View all my photos and reports
        </Button>
      )}
    </Panel>
  );
}
