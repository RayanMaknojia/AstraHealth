import { useLayoutEffect, useRef, useState } from "react";

/** Below this width (phones, small tablets) the dialog scrolls instead. */
const DESKTOP_MIN_WIDTH = 900;
/** Narrowest readable column for alert text, in px. */
const COLUMN_MIN_WIDTH = 400;
const MAX_COLUMNS = 3;
/** Space kept free above and below the dialog, in px. */
const VERTICAL_MARGIN = 32;

/**
 * Picks how many text columns an overlay dialog needs so it fits the
 * viewport height without scrolling on laptops and desktops. Starts at one
 * column and adds columns (widening the dialog) only while the content is
 * still taller than the screen. Re-measures when `contentKey` changes or the
 * window resizes. Returns a ref for any element inside the dialog and the
 * column count to apply.
 */
export function useFitColumns(open: boolean, contentKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);

  useLayoutEffect(() => {
    if (!open) return;
    let timer = 0;
    let current = 1;
    // Measure after React has committed the previous column change.
    const later = (fn: () => void, ms = 60) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fn, ms);
    };
    const dialog = () =>
      ref.current?.closest<HTMLElement>('[data-slot="dialog-content"]') ?? null;

    const fit = () => {
      const el = dialog();
      if (!el) {
        // The dialog portal mounts a moment later; try again.
        later(fit);
        return;
      }
      const maxCols = Math.min(
        MAX_COLUMNS,
        Math.max(1, Math.floor((window.innerWidth - 48) / COLUMN_MIN_WIDTH)),
      );
      if (window.innerWidth < DESKTOP_MIN_WIDTH || maxCols === 1) {
        current = 1;
        setCols(1);
        return;
      }
      const tooTall =
        el.scrollHeight > window.innerHeight - VERTICAL_MARGIN * 2;
      if (tooTall && current < maxCols) {
        current += 1;
        setCols(current);
        // Measure again once the wider layout is applied.
        later(fit);
      }
    };

    const restart = () => {
      current = 1;
      setCols(1);
      later(fit);
    };

    restart();
    window.addEventListener("resize", restart);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", restart);
    };
  }, [open, contentKey]);

  return { ref, cols };
}
