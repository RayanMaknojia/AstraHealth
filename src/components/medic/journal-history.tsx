import { useState } from "react";
import { Trash2 } from "lucide-react";
import { listJournal, deleteJournalEntry } from "@/services/wellbeingService";
import { Button } from "@/components/ui/button";
import { Panel } from "./primitives";
export function JournalHistory({ astronautId }: { astronautId: string }) {
  const [entries, setEntries] = useState(() => listJournal(astronautId));
  return (
    <Panel title="Past journal entries">
      <p>
        Stored on this device only. Never synced, shared with crew, or sent to
        AI.
      </p>
      {!entries.length && (
        <p>No journal entries yet. Write your first entry in Check-in.</p>
      )}
      {entries.map((entry) => (
        <article className="journal-entry" key={entry.id}>
          <strong>Day {entry.missionDay}</strong>
          <p>{entry.text}</p>
          <Button
            variant="ghost"
            onClick={() => {
              deleteJournalEntry(entry.id);
              setEntries(listJournal(astronautId));
            }}
          >
            <Trash2 data-icon="inline-start" />
            Delete entry
          </Button>
        </article>
      ))}
    </Panel>
  );
}
