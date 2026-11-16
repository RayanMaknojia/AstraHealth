import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Bell, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  clearNotifications,
  deleteNotification,
  listNotifications,
  markAllRead,
  subscribeNotifications,
  type CrewNotification,
} from "@/services/notificationService";
import { notify } from "./use-mission";

const KIND_LABEL: Record<CrewNotification["kind"], string> = {
  alert: "Alert",
  crew_alert: "Crew alert",
  sos: "SOS",
  system: "Sent",
};

function useNotifications(astronautId: string): CrewNotification[] {
  // Snapshot is a JSON string so React can compare it cheaply between renders.
  const raw = useSyncExternalStore(
    subscribeNotifications,
    () => JSON.stringify(listNotifications(astronautId)),
    () => "[]",
  );
  return JSON.parse(raw) as CrewNotification[];
}

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)} UTC`;
};

/** Bell button with unread count, and the saved notification box. */
export function NotificationCenter({ astronautId }: { astronautId: string }) {
  const items = useNotifications(astronautId);
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read).length;

  // Pop a toast when a crewmate's alert arrives while this person is logged in.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(items.map((n) => n.id));
      return;
    }
    for (const n of items)
      if (!seen.current.has(n.id)) {
        seen.current.add(n.id);
        if (n.fromId && n.fromId !== astronautId && !n.read)
          notify(n.title, n.body);
      }
  }, [items, astronautId]);

  return (
    <>
      <Button
        variant="outline"
        className="notification-bell"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        onClick={() => setOpen(true)}
      >
        <Bell data-icon="inline-start" />
        {unread > 0 && <span className="notification-count">{unread}</span>}
      </Button>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) markAllRead(astronautId);
        }}
      >
        <SheetContent className="notification-sheet">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Alerts, SOS events and messages from your crew. Saved on this
            device.
          </SheetDescription>
          <div className="notification-actions">
            <Button
              variant="outline"
              size="sm"
              disabled={!unread}
              onClick={() => markAllRead(astronautId)}
            >
              Mark all read
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!items.length}
              onClick={() => clearNotifications(astronautId)}
            >
              <Trash2 data-icon="inline-start" />
              Delete all
            </Button>
          </div>
          {items.length === 0 ? (
            <p className="notification-empty">No notifications.</p>
          ) : (
            <ul className="notification-list" data-testid="notification-list">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`notification-item kind-${n.kind}${n.read ? "" : " unread"}`}
                >
                  <div>
                    <small>
                      {KIND_LABEL[n.kind]}
                      {n.missionDay !== undefined
                        ? ` · Day ${Math.floor(n.missionDay)}`
                        : ""}{" "}
                      · {when(n.createdAt)}
                    </small>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete notification: ${n.title}`}
                    onClick={() => deleteNotification(astronautId, n.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
