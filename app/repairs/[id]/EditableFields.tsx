"use client";

import { useState, useEffect } from "react";
import UndoToast from "@/components/UndoToast";
import Warning from "@/components/Warning";
import InfoIcon from "@/components/InfoIcon";
import { formatMoney } from "@/lib/format";
import type { Repair } from "@/lib/database.types";

export default function EditableFields({
  repair,
  customer,
}: {
  repair: Repair;
  customer: { first_name: string; last_name: string; email: string | null; phone: string | null } | null;
}) {
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; undoUrl: string } | null>(null);

  const [locationType, setLocationType] = useState(repair.location_type);
  const [locationText, setLocationText] = useState(repair.location_text ?? "");
  const [paymentRequiredType, setPaymentRequiredType] = useState(repair.payment_required_type);
  const [depositAmount, setDepositAmount] = useState(String(repair.deposit_amount ?? ""));

  // Action buttons elsewhere on the page (Ready for collection, Paid &
  // Collected, etc.) update the repair via a different route, then call
  // router.refresh() to re-fetch this component's `repair` prop from the
  // server. Without this, the fields above stay frozen at whatever they
  // were on first mount — the page LOOKED like it needed a manual reload
  // to catch up, even though the underlying data was already current.
  useEffect(() => {
    setLocationType(repair.location_type);
    setLocationText(repair.location_text ?? "");
    setPaymentRequiredType(repair.payment_required_type);
    setDepositAmount(String(repair.deposit_amount ?? ""));
  }, [repair]);

  async function patch(fields: Record<string, unknown>) {
    setBusy(true);
    setWarning(null);
    try {
      const res = await fetch(`/api/repairs/${repair.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const json = await res.json();
      if (!res.ok) {
        setWarning(json.error || "Could not save change.");
        setBusy(false);
        return;
      }
      // Real reload, not router.refresh() — needed so Audit history and
      // Communications elsewhere on this page (and everything else) always
      // reflect the change immediately, no stale cached copy left behind.
      if (json.undoUrl) {
        setToast({ message: "Saved.", undoUrl: json.undoUrl });
        setTimeout(() => window.location.reload(), 8000);
      } else {
        window.location.reload();
      }
    } catch {
      setWarning("Network error — please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <Warning text={warning} />

      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        <Field label="Customer email">{customer?.email || "-"}</Field>
        <Field label="Customer phone">{customer?.phone || "-"}</Field>
        <Field label="Instrument">
          {repair.instrument_description || "-"}
          {(repair.brand || repair.model) && (
            <span className="text-slate-500">
              {" "}
              ({[repair.brand, repair.model].filter(Boolean).join(" ")}
              {repair.serial_number ? `, SN ${repair.serial_number}` : ""})
            </span>
          )}
        </Field>
        <Field label="Work">{repair.work_description || "-"}</Field>
        <Field
          label={
            <span className="flex items-center">
              Quote total <InfoIcon text="The quoted total the customer will be charged." />
            </span>
          }
        >
          {formatMoney(repair.quote_total)}
        </Field>
      </dl>

      <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
        <div>
          <label className="label flex items-center">
            Location <InfoIcon text="Where the instrument physically is right now." />
          </label>
          <select
            className="input"
            value={locationType}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value as Repair["location_type"];
              setLocationType(v);
              patch({ location_type: v, location_text: locationText });
            }}
          >
            <option value="repair_room">Repair room</option>
            <option value="home_staff">Home (staff)</option>
            <option value="home_technician">Home (technician)</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Location details</label>
          <input
            className="input"
            value={locationText}
            disabled={busy}
            onChange={(e) => setLocationText(e.target.value)}
            onBlur={() => patch({ location_type: locationType, location_text: locationText })}
          />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-3">
        <label className="label flex items-center">
          Payment before work starts{" "}
          <InfoIcon text="If set to deposit or full payment, the approval email includes bank transfer details and the customer must confirm they've paid before they can approve the quote." />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="input max-w-[220px]"
            value={paymentRequiredType}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value as Repair["payment_required_type"];
              setPaymentRequiredType(v);
              patch({
                payment_required_type: v,
                deposit_amount: v === "deposit" ? Number(depositAmount || 0) : null,
              });
            }}
          >
            <option value="none">Not required upfront</option>
            <option value="deposit">Deposit</option>
            <option value="full">Full payment</option>
          </select>
          {paymentRequiredType === "deposit" && (
            <input
              type="number"
              step="0.01"
              className="input max-w-[160px]"
              placeholder="Deposit amount (£)"
              value={depositAmount}
              disabled={busy}
              onChange={(e) => setDepositAmount(e.target.value)}
              onBlur={() => patch({ payment_required_type: "deposit", deposit_amount: Number(depositAmount || 0) })}
            />
          )}
        </div>
      </div>

      {toast && <UndoToast message={toast.message} undoUrl={toast.undoUrl} onDone={() => setToast(null)} />}
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}
