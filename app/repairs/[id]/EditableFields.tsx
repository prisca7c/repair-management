"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; undoUrl: string } | null>(null);

  const [status, setStatus] = useState(repair.status);
  const [locationType, setLocationType] = useState(repair.location_type);
  const [locationText, setLocationText] = useState(repair.location_text ?? "");
  const [jobDone, setJobDone] = useState(repair.job_done);
  const [customerPaid, setCustomerPaid] = useState(repair.customer_paid);

  // Action buttons elsewhere on the page (Ready for collection, Paid &
  // Collected, etc.) update the repair via a different route, then call
  // router.refresh() to re-fetch this component's `repair` prop from the
  // server. Without this, the fields above stay frozen at whatever they
  // were on first mount — the page LOOKED like it needed a manual reload
  // to catch up, even though the underlying data was already current.
  useEffect(() => {
    setStatus(repair.status);
    setLocationType(repair.location_type);
    setLocationText(repair.location_text ?? "");
    setJobDone(repair.job_done);
    setCustomerPaid(repair.customer_paid);
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
        return;
      }
      if (json.undoUrl) {
        setToast({ message: "Saved.", undoUrl: json.undoUrl });
      }
      router.refresh();
    } catch {
      setWarning("Network error — please try again.");
    } finally {
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
          <label className="label">Status</label>
          <select
            className="input"
            value={status}
            disabled={busy}
            onChange={(e) => {
              const v = e.target.value as Repair["status"];
              setStatus(v);
              patch({ status: v });
            }}
          >
            <option value="received">Received</option>
            <option value="working">Working</option>
            <option value="ready">Ready</option>
            <option value="collected">Collected</option>
          </select>
        </div>
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

      <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={jobDone}
            disabled={busy}
            onChange={(e) => {
              setJobDone(e.target.checked);
              patch({ job_done: e.target.checked });
            }}
          />
          Job done
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={customerPaid}
            disabled={busy}
            onChange={(e) => {
              setCustomerPaid(e.target.checked);
              patch({ customer_paid: e.target.checked });
            }}
          />
          Customer paid
        </label>
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
