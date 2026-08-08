"use client";

import { useState, useId } from "react";

/**
 * Small circle-i info icon with a keyboard-accessible tooltip/popover.
 * Use sparingly — only next to fields that genuinely need explaining
 * (see spec: customer quote, approval, location, technician pay, waiting
 * status, quote changed, sender sync). Not for obvious fields like name.
 */
export default function InfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex items-center">
      <button
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
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-5 z-20 w-56 -translate-x-1/2 rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-600 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
