"use client";

import { useState } from "react";

export default function RestoreButton({ repairId }: { repairId: string }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await fetch(`/api/repairs/${repairId}/restore`, { method: "POST" });
    window.location.reload();
  }

  return (
    <button className="btn-secondary" disabled={busy} onClick={handleClick}>
      {busy ? "Restoring…" : "Restore"}
    </button>
  );
}
