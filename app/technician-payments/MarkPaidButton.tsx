"use client";

import { useState } from "react";
import UndoToast from "@/components/UndoToast";

export default function MarkPaidButton({ repairId }: { repairId: string }) {
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; undoUrl: string } | null>(null);

  async function handleClick() {
    setBusy(true);
    const res = await fetch(`/api/technicians/${repairId}/paid`, { method: "POST" });
    const json = await res.json();
    if (res.ok && json.undoUrl) {
      setToast({ message: "Marked as paid.", undoUrl: json.undoUrl });
      setTimeout(() => window.location.reload(), 8000);
    } else {
      window.location.reload();
    }
  }

  return (
    <>
      <button className="btn-secondary" disabled={busy} onClick={handleClick}>
        {busy ? "Saving…" : "Mark paid"}
      </button>
      {toast && <UndoToast message={toast.message} undoUrl={toast.undoUrl} onDone={() => setToast(null)} />}
    </>
  );
}
