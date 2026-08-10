"use client";

import { useState, useId, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Small circle-i info icon with a keyboard-accessible tooltip/popover.
 * Use sparingly — only next to fields that genuinely need explaining
 * (see spec: customer quote, approval, location, technician pay, waiting
 * status, quote changed, sender sync). Not for obvious fields like name.
 *
 * The tooltip renders through a portal into document.body instead of as a
 * normal absolutely-positioned child. Several places this icon is used sit
 * inside `overflow-x-auto` table wrappers or cards — CSS forces overflow-y
 * to also clip in that case, which was hiding/cutting off the tooltip. A
 * portal + position:fixed + very high z-index guarantees it always renders
 * above everything else, regardless of where the icon itself lives.
 */
export default function InfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
    }
  }, [open]);

  return (
    <span className="relative inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        aria-describedby={id}
        aria-label="More information"
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] leading-none text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
      >
        i
      </button>
      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform: "translate(-50%, calc(-100% - 8px))",
            }}
            className="z-[9999] w-max max-w-[240px] whitespace-normal break-words rounded-md border border-slate-200 bg-white p-2 text-left text-xs font-normal normal-case text-slate-600 shadow-lg"
          >
            {text}
          </span>,
          document.body
        )}
    </span>
  );
}
