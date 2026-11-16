import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HelpCircle, Lightbulb, Search, Trash2, Trophy } from "lucide-react";
import { LAB_ELEMENTS, LAB_RULES } from "@/data/orbitLabData";
import {
  getLabProgress,
  labElement,
  stepsTo,
  takeHint,
  todaysElements,
  tryCombine,
} from "@/services/orbitLabService";
import type { LabElement, LabProgress } from "@/types/astronaut";
import { Button } from "@/components/ui/button";

interface Chip {
  uid: number;
  id: string;
  /** Centre, in board pixels. */
  x: number;
  y: number;
  shake?: boolean;
  fresh?: boolean;
}

interface Drag {
  uid: number;
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  moved: boolean;
  /** Dragged out of the element list (a tap there just adds a copy). */
  fromLib?: boolean;
}

type Note =
  | { kind: "made"; a: LabElement; b: LabElement; out: LabElement; fresh: boolean }
  | { kind: "nothing"; a: LabElement; b: LabElement }
  | { kind: "hint"; a: LabElement; b: LabElement }
  | { kind: "info"; text: string };

const NEAR_X = 64;
const NEAR_Y = 30;
let nextUid = 1;

/** A random spot on the board away from other chips (below the target pill). */
function findFreeSpot(chips: Chip[], w: number, h: number) {
  for (let i = 0; i < 40; i++) {
    const x = 80 + Math.random() * Math.max(40, w - 160);
    const y = 110 + Math.random() * Math.max(40, h - 170);
    if (!chips.some((c) => Math.abs(c.x - x) < NEAR_X * 1.6 && Math.abs(c.y - y) < NEAR_Y * 1.8))
      return { x, y };
  }
  return { x: w / 2, y: h / 2 + 40 };
}

function ElementPill({
  el,
  className = "",
  ...rest
}: { el: LabElement } & React.HTMLAttributes<HTMLButtonElement> & {
    className?: string;
  }) {
  return (
    <button type="button" className={`lab-pill ${className}`} {...rest}>
      <span aria-hidden="true">{el.icon}</span>
      {el.name}
    </button>
  );
}

export function OrbitLab({
  astronautId,
  missionDay,
}: {
  astronautId: string;
  missionDay: number;
}) {
  const [progress, setProgress] = useState<LabProgress>(() =>
    getLabProgress(astronautId, missionDay),
  );
  const [chips, setChips] = useState<Chip[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [fact, setFact] = useState<LabElement | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"found" | "name">("found");
  const [help, setHelp] = useState(false);
  const [overTarget, setOverTarget] = useState(false);
  const [overTrash, setOverTrash] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  const chipsRef = useRef<Chip[]>([]);
  useEffect(() => {
    chipsRef.current = chips;
  }, [chips]);

  const today = progress.today;
  const target = labElement(today.target)!;
  const have = useMemo(() => todaysElements(today), [today]);
  const library = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = have
      .map((id) => labElement(id)!)
      .filter((e) => !q || e.name.toLowerCase().includes(q));
    return sort === "name"
      ? [...list].sort((a, b) => a.name.localeCompare(b.name))
      : list;
  }, [have, query, sort]);
  const hintsLeft = LAB_RULES.hintsPerDay - today.hintsUsed;

  const refresh = useCallback(
    () => setProgress(getLabProgress(astronautId, missionDay)),
    [astronautId, missionDay],
  );

  // ── Board helpers ─────────────────────────────────────────────────────────
  const boardPoint = (clientX: number, clientY: number) => {
    const r = boardRef.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top, w: r.width, h: r.height };
  };
  const inside = (el: HTMLElement | null, x: number, y: number) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };
  const freeSpot = () => {
    const r = boardRef.current?.getBoundingClientRect();
    return findFreeSpot(chipsRef.current, r?.width ?? 800, r?.height ?? 420);
  };
  const addChip = (id: string, at?: { x: number; y: number }) => {
    const p = at ?? freeSpot();
    const chip: Chip = { uid: nextUid++, id, x: p.x, y: p.y };
    setChips((cs) => [...cs, chip]);
    return chip;
  };

  const doCombine = (moving: Chip, other: Chip) => {
    const a = labElement(moving.id)!;
    const b = labElement(other.id)!;
    const res = tryCombine(astronautId, missionDay, moving.id, other.id);
    if (res.out) {
      const out = res.out;
      setChips((cs) => [
        ...cs.filter((c) => c.uid !== moving.uid && c.uid !== other.uid),
        { uid: nextUid++, id: out.id, x: other.x, y: other.y, fresh: true },
      ]);
      setNote({ kind: "made", a, b, out, fresh: res.newToday });
      if (res.newEver && out.fact) setFact(out);
    } else {
      setChips((cs) =>
        cs.map((c) =>
          c.uid === other.uid
            ? { ...c, shake: true }
            : c.uid === moving.uid
              ? { ...c, x: c.x + 40, y: c.y + 28 }
              : c,
        ),
      );
      setTimeout(
        () =>
          setChips((cs) =>
            cs.map((c) => (c.uid === other.uid ? { ...c, shake: false } : c)),
          ),
        420,
      );
      setNote({ kind: "nothing", a, b });
    }
    setProgress(getLabProgress(astronautId, missionDay));
  };

  /** Keyboard / click: put a copy on the board (or combine with the selected chip). */
  const libraryClick = (el: LabElement) => {
    if (drag.current) return;
    if (selected !== null) {
      const other = chipsRef.current.find((c) => c.uid === selected);
      setSelected(null);
      if (other) {
        const chip = { uid: nextUid++, id: el.id, x: other.x, y: other.y };
        doCombine(chip, other);
        return;
      }
    }
    addChip(el.id);
  };

  // ── Dragging (mouse, pen and touch) ──────────────────────────────────────
  const startDrag = (
    e: React.PointerEvent,
    chip: Chip,
    offset?: { dx: number; dy: number },
  ) => {
    e.preventDefault();
    const p = boardPoint(e.clientX, e.clientY);
    drag.current = {
      uid: chip.uid,
      dx: offset?.dx ?? chip.x - p.x,
      dy: offset?.dy ?? chip.y - p.y,
      startX: e.clientX,
      startY: e.clientY,
      moved: !!offset,
    };
    setChips((cs) => [...cs.filter((c) => c.uid !== chip.uid), chip]); // on top
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d || !boardRef.current) return;
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) d.moved = true;
      const p = boardPoint(e.clientX, e.clientY);
      setChips((cs) =>
        cs.map((c) => (c.uid === d.uid ? { ...c, x: p.x + d.dx, y: p.y + d.dy } : c)),
      );
      setOverTarget(inside(targetRef.current, e.clientX, e.clientY));
      setOverTrash(inside(trashRef.current, e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      drag.current = null;
      setOverTarget(false);
      setOverTrash(false);
      const chip = chipsRef.current.find((c) => c.uid === d.uid);
      if (!chip || !boardRef.current) return;

      if (!d.moved && d.fromLib) {
        setChips((cs) => cs.filter((c) => c.uid !== chip.uid));
        chipsRef.current = chipsRef.current.filter((c) => c.uid !== chip.uid);
        libraryClick(labElement(chip.id)!);
        return;
      }
      if (!d.moved) {
        // A tap: select, or combine with the selected chip.
        if (selected !== null && selected !== chip.uid) {
          const other = chipsRef.current.find((c) => c.uid === selected);
          setSelected(null);
          if (other) doCombine(chip, other);
        } else setSelected(selected === chip.uid ? null : chip.uid);
        return;
      }
      setSelected(null);
      if (inside(trashRef.current, e.clientX, e.clientY)) {
        setChips((cs) => cs.filter((c) => c.uid !== chip.uid));
        return;
      }
      if (inside(targetRef.current, e.clientX, e.clientY)) {
        setChips((cs) => cs.filter((c) => c.uid !== chip.uid));
        setNote({
          kind: "info",
          text:
            chip.id === today.target
              ? `That’s it: ${target.name}! Today’s target is done.`
              : `Not yet: today’s target is ${target.name}, not ${labElement(chip.id)!.name}.`,
        });
        return;
      }
      const r = boardRef.current.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      ) {
        setChips((cs) => cs.filter((c) => c.uid !== chip.uid)); // dropped off the board
        return;
      }
      const other = [...chipsRef.current]
        .reverse()
        .find(
          (c) =>
            c.uid !== chip.uid &&
            Math.abs(c.x - chip.x) < NEAR_X &&
            Math.abs(c.y - chip.y) < NEAR_Y,
        );
      if (other) doCombine(chip, other);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  });

  /** Drag a new copy out of the element list. */
  const fromLibrary = (e: React.PointerEvent, el: LabElement) => {
    if (!boardRef.current || e.button > 0) return;
    const p = boardPoint(e.clientX, e.clientY);
    const chip: Chip = { uid: nextUid++, id: el.id, x: p.x, y: p.y };
    setChips((cs) => [...cs, chip]);
    chipsRef.current = [...chipsRef.current, chip];
    startDrag(e, chip, { dx: 0, dy: 0 });
    drag.current!.moved = false;
    drag.current!.fromLib = true;
  };
  const hint = () => {
    const res = takeHint(astronautId, missionDay);
    if (res.recipe) {
      const a = labElement(res.recipe.a)!;
      const b = labElement(res.recipe.b)!;
      setNote({ kind: "hint", a, b });
      const onBoard = new Set(chipsRef.current.map((c) => c.id));
      if (!onBoard.has(a.id)) addChip(a.id);
      if (!onBoard.has(b.id) && b.id !== a.id) addChip(b.id);
    } else
      setNote({
        kind: "info",
        text: today.solved ? "Already solved today." : "No hints left today.",
      });
    refresh();
  };

  // Start each visit with the five starting elements on the board.
  useEffect(() => {
    const t = setTimeout(() => {
      if (chipsRef.current.length) return;
      const r = boardRef.current?.getBoundingClientRect();
      const w = r?.width ?? 800;
      const bases = LAB_ELEMENTS.filter((e) => e.base);
      setChips(
        bases.map((e, i) => ({
          uid: nextUid++,
          id: e.id,
          x: (w / (bases.length + 1)) * (i + 1),
          y: 150 + (i % 2) * 90,
        })),
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="orbit-lab" aria-label="Orbit Lab">
      <div className="lab-intro">
        <div>
          <h3>Orbit Lab</h3>
          <p>
            Combine elements to make new ones and reach today’s target. Drag one
            element onto another (or tap one, then another). Making the target
            earns a seed for the Station Garden.
          </p>
        </div>
        <div className="lab-stats" aria-label="Your Orbit Lab stats">
          <span>
            <strong>{today.combos}</strong> tries
          </span>
          <span>
            <strong>{today.found.length}</strong> made today
          </span>
          <span>
            <strong>{progress.discovered.length}</strong>/
            {LAB_ELEMENTS.length - 5} collected
          </span>
          <span>
            <strong>{progress.streak}</strong> day streak
          </span>
        </div>
      </div>

      <div className="lab-board" ref={boardRef}>
        <div className="lab-stars" aria-hidden="true" />
        <div
          ref={targetRef}
          className={`lab-target${overTarget ? " over" : ""}${today.solved ? " done" : ""}`}
        >
          <small>Today’s target</small>
          <strong>
            <span aria-hidden="true">{target.icon}</span> {target.name}
          </strong>
          <small>
            {today.solved
              ? "Made! Keep exploring"
              : `About ${stepsTo(target.id)} steps · drop it here`}
          </small>
          <button
            type="button"
            className="lab-help"
            aria-label="How to play"
            aria-expanded={help}
            onClick={() => setHelp((h) => !h)}
          >
            <HelpCircle aria-hidden="true" />
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="lab-hint"
          onClick={hint}
          disabled={today.solved || hintsLeft <= 0}
        >
          <Lightbulb aria-hidden="true" /> Hint · {hintsLeft} left
        </Button>

        {help && (
          <div className="lab-helpbox" role="note">
            <p>
              Start with Water, Air, Earth, Fire and Light. Drop one element on
              another to combine them: Fire + Water makes Steam. New elements go
              in your list below; drag them out to use them again.
            </p>
            <p>
              Every day starts fresh with a new target for the whole crew. A hint
              shows one combination on the way. Drop elements on the bin to clear
              them. Health elements come with a short fact about life in space.
            </p>
          </div>
        )}

        {chips.map((c) => {
          const el = labElement(c.id)!;
          return (
            <ElementPill
              key={c.uid}
              el={el}
              className={[
                "lab-chip",
                c.shake ? "shake" : "",
                c.fresh ? "fresh" : "",
                selected === c.uid ? "selected" : "",
                c.id === today.target ? "is-target" : "",
              ].join(" ")}
              style={{ left: c.x, top: c.y }}
              aria-pressed={selected === c.uid}
              onPointerDown={(e) => startDrag(e, c)}
              onKeyDown={(e) => {
                if (e.key === "Delete" || e.key === "Backspace")
                  setChips((cs) => cs.filter((x) => x.uid !== c.uid));
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (selected !== null && selected !== c.uid) {
                    const other = chipsRef.current.find((x) => x.uid === selected);
                    setSelected(null);
                    if (other) doCombine(c, other);
                  } else setSelected(selected === c.uid ? null : c.uid);
                }
              }}
            />
          );
        })}

        {note && (
          <div className="lab-note" aria-live="polite">
            {note.kind === "made" && (
              <>
                {note.a.icon} {note.a.name} + {note.b.icon} {note.b.name} ={" "}
                <strong>
                  {note.out.icon} {note.out.name}
                </strong>
                {note.fresh && <em> new!</em>}
              </>
            )}
            {note.kind === "nothing" && (
              <>
                {note.a.name} + {note.b.name}: nothing happened.
              </>
            )}
            {note.kind === "hint" && (
              <>
                Hint: try {note.a.icon} {note.a.name} + {note.b.icon} {note.b.name}
              </>
            )}
            {note.kind === "info" && note.text}
          </div>
        )}

        <button
          type="button"
          ref={trashRef}
          className={`lab-trash${overTrash ? " over" : ""}`}
          aria-label="Clear the board"
          title="Drop here to remove, or click to clear the board"
          onClick={() => {
            setChips([]);
            setSelected(null);
          }}
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      {today.solved && (
        <div className="lab-win" role="status">
          <Trophy aria-hidden="true" />
          <div>
            <strong>
              You made {target.icon} {target.name} in {today.combos}{" "}
              {today.combos === 1 ? "try" : "tries"}
              {today.hintsUsed ? ` with ${today.hintsUsed} hint${today.hintsUsed === 1 ? "" : "s"}` : " with no hints"}.
            </strong>
            <span>
              +1 seed for the Station Garden. A new target arrives tomorrow.
            </span>
          </div>
        </div>
      )}

      {fact && (
        <div className="lab-fact" role="note">
          <span aria-hidden="true">{fact.icon}</span>
          <div>
            <strong>First time: {fact.name}</strong>
            <p>{fact.fact}</p>
          </div>
          <button type="button" onClick={() => setFact(null)}>
            Got it
          </button>
        </div>
      )}

      <div className="lab-library">
        <div className="lab-tools">
          <div className="lab-sort" role="group" aria-label="Sort elements">
            <button
              type="button"
              aria-pressed={sort === "found"}
              onClick={() => setSort("found")}
            >
              Order made
            </button>
            <button
              type="button"
              aria-pressed={sort === "name"}
              onClick={() => setSort("name")}
            >
              Name
            </button>
          </div>
          <label className="lab-search">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search your elements"
            />
          </label>
          <span className="lab-count">
            {have.length} element{have.length === 1 ? "" : "s"} today
          </span>
        </div>
        <div className="lab-items" aria-label="Your elements">
          {library.map((el) => (
            <ElementPill
              key={el.id}
              el={el}
              className={el.id === today.target ? "is-target" : ""}
              onPointerDown={(e) => fromLibrary(e, el)}
              onClick={(e) => {
                if (e.detail === 0) libraryClick(el); // keyboard
              }}
            />
          ))}
          {!library.length && <p className="lab-empty">No match.</p>}
        </div>
      </div>
    </section>
  );
}
