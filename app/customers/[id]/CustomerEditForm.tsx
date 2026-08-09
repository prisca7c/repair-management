"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@/lib/database.types";

export default function CustomerEditForm({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(customer.first_name);
  const [lastName, setLastName] = useState(customer.last_name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [marketingConsent, setMarketingConsent] = useState(customer.marketing_consent);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setWarning(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email || null,
          phone: phone || null,
          notes: notes || null,
          marketing_consent: marketingConsent,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setWarning(json.error || "Could not save changes.");
        return;
      }
      if (json.syncWarning) setWarning(json.syncWarning);
      setEditing(false);
      router.refresh();
    } catch {
      setWarning("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {customer.first_name} {customer.last_name}
            </h1>
            <p className="text-sm text-slate-500">
              {customer.email || "No email"} · {customer.phone || "No phone"}
              {customer.marketing_consent ? " · On mailing list" : ""}
            </p>
          </div>
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>
        {customer.notes && (
          <div className="card mt-3">
            <h2 className="mb-1 text-sm font-semibold text-slate-800">Notes</h2>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{customer.notes}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      {warning && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {warning}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className="input" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input className="input" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        <input className="input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="input" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <textarea
        className="input"
        rows={2}
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => setMarketingConsent(e.target.checked)}
        />
        OK to add to mailing list
      </label>
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn-secondary" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
