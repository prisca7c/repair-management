"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Service } from "@/lib/database.types";

export default function ServicesList({ services }: { services: Service[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleActive(s: Service) {
    setBusy(s.id);
    await fetch(`/api/services/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    setBusy(null);
    router.refresh();
  }

  async function handleAdd() {
    if (!name) return;
    setBusy("new");
    await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price: Number(price || 0), description }),
    });
    setBusy(null);
    setName("");
    setPrice("");
    setDescription("");
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="card space-y-3">
      <ul className="divide-y divide-slate-100 text-sm">
        {services.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-2">
            <div>
              <div className={`font-medium ${s.active ? "text-slate-900" : "text-slate-400 line-through"}`}>
                {s.name}
              </div>
              {s.description && <div className="text-xs text-slate-500">{s.description}</div>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-700">£{s.price.toFixed(2)}</span>
              <button
                className="text-xs text-slate-500 hover:underline"
                disabled={busy === s.id}
                onClick={() => toggleActive(s)}
              >
                {s.active ? "Disable" : "Enable"}
              </button>
            </div>
          </li>
        ))}
        {services.length === 0 && <li className="py-2 text-slate-400">No services yet.</li>}
      </ul>

      {showForm ? (
        <div className="grid grid-cols-1 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input"
            placeholder="Price (£)"
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <input
            className="input"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex gap-2 sm:col-span-3">
            <button className="btn-primary" disabled={busy === "new"} onClick={handleAdd}>
              {busy === "new" ? "Saving…" : "Add service"}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="text-sm font-medium text-slate-700 hover:underline" onClick={() => setShowForm(true)}>
          + Add service
        </button>
      )}
    </div>
  );
}
