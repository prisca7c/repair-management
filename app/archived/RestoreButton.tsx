"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RestoreButton({ repairId }: { repairId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    await fetch(`/api/repairs/${repairId}/restore`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button className="btn-secondary" disabled={busy} onClick={handleClick}>
      {busy ? "Restoring…" : "Restore"}
    </button>
  );
}
