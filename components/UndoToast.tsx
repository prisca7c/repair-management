"use client";

import { useEffect, useState, useCallback } from "react";

interface UndoToastProps {
  message: string;
  undoUrl: string;
  onDone?: () => void;
  durationMs?: number;
}

/**
 * Reusable toast shown after a mutating action. Calls POST on `undoUrl`
 * when the user clicks Undo. Auto-dismisses after `durationMs`.
 */
export default function UndoToast({
  message,
  undoUrl,
  onDone,
  durationMs = 8000,
}: UndoToastProps) {
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);

  const handleUndo = useCallback(async () => {
    setBusy(true);
    try {
      await fetch(undoUrl, { method: "POST" });
    } finally {
      setBusy(false);
      setVisible(false);
      onDone?.();
      window.location.reload();
    }
  }, [undoUrl, onDone]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
      <span>{message}</span>
      <button
        onClick={handleUndo}
        disabled={busy}
        className="font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
      >
        {busy ? "Undoing…" : "Undo"}
      </button>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        className="text-slate-400 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
