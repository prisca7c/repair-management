"use client";

import { useState } from "react";
import type { Technician } from "@/lib/database.types";

export default function TechnicianList({ technicians }: { technicians: Technician[] }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/technicians", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Could not add technician");
      return;
    }
    setName("");
    setEmail("");
    setPhone("");
    setShowForm(false);
    window.location.reload();
  }

  return (
    <div className="card space-y-3">
      <ul className="divide-y divide-slate-100 text-sm">
        {technicians.map((t) => (
          <li key={t.id} className="py-2">
            <div className="font-medium text-slate-900">{t.name}</div>
            <div className="text-xs text-slate-500">
              {t.email || "-"} · {t.phone || "-"}
            </div>
          </li>
        ))}
        {technicians.length === 0 && <li className="py-2 text-slate-400">No technicians yet.</li>}
      </ul>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      {showForm ? (
        <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="flex gap-2 sm:col-span-3">
            <button className="btn-primary" disabled={busy} onClick={handleAdd}>
              {busy ? "Saving…" : "Add technician"}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="text-sm font-medium text-slate-700 hover:underline" onClick={() => setShowForm(true)}>
          + Add technician
        </button>
      )}
    </div>
  );
}
