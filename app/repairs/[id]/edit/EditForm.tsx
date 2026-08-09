"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Warning from "@/components/Warning";
import type { Repair, RepairItem, Service } from "@/lib/database.types";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

export default function EditForm({
  repair,
  repairItems,
  services,
  isApproved,
}: {
  repair: Repair;
  repairItems: RepairItem[];
  services: Service[];
  isApproved: boolean;
}) {
  const router = useRouter();
  const [instrumentDescription, setInstrumentDescription] = useState(repair.instrument_description ?? "");
  const [brand, setBrand] = useState(repair.brand ?? "");
  const [model, setModel] = useState(repair.model ?? "");
  const [serialNumber, setSerialNumber] = useState(repair.serial_number ?? "");
  const [workDescription, setWorkDescription] = useState(repair.work_description ?? "");
  const [quoteTotal, setQuoteTotal] = useState(String(repair.quote_total ?? 0));
  const [lineItems, setLineItems] = useState<LineItem[]>(
    repairItems.map((it) => ({ description: it.description, quantity: it.quantity, unit_price: it.unit_price }))
  );
  const [technicianRequired, setTechnicianRequired] = useState(repair.technician_required);
  const [technicianPay, setTechnicianPay] = useState(String(repair.technician_pay ?? ""));

  const [warning, setWarning] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const breakdownTotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0),
    [lineItems]
  );

  const quoteChanged =
    workDescription !== (repair.work_description ?? "") || Number(quoteTotal) !== repair.quote_total;

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setLineItems((items) => items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  // Same companion-line logic as the New repair form — "Basic setup" and
  // "Re-string with chosen strings" aren't flat-rate, so add a £0 line the
  // staff fills in for the extra/string cost rather than hand-adding maths.
  function companionItem(service: Service): LineItem | null {
    const name = service.name.toLowerCase();
    if (name.includes("basic setup")) {
      return { description: "Extra (describe what)", quantity: 1, unit_price: 0 };
    }
    if (name.includes("chosen strings")) {
      return { description: "String cost", quantity: 1, unit_price: 0 };
    }
    return null;
  }

  async function handleSave() {
    setBusy(true);
    setWarning(null);
    try {
      // Non-quote fields (instrument details, technician) via PATCH.
      const patchRes = await fetch(`/api/repairs/${repair.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instrument_description: instrumentDescription,
          brand,
          model,
          serial_number: serialNumber,
          technician_required: technicianRequired,
          technician_id: null,
          technician_pay: technicianRequired ? Number(technicianPay || 0) : null,
        }),
      });
      if (!patchRes.ok) {
        const json = await patchRes.json();
        setWarning(json.error || "Could not save instrument/technician details.");
      }

      // Quote fields — only create a new quote version if they changed.
      if (quoteChanged) {
        const total = lineItems.length > 0 ? breakdownTotal : Number(quoteTotal || 0);
        const quoteRes = await fetch(`/api/repairs/${repair.id}/quote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            work_description: workDescription,
            total,
            line_items: lineItems.length > 0 ? lineItems : undefined,
          }),
        });
        if (!quoteRes.ok) {
          const json = await quoteRes.json();
          setWarning(json.error || "Could not save the new quote.");
          setBusy(false);
          return;
        }
      }

      router.push(`/repairs/${repair.id}`);
      router.refresh();
    } catch {
      setWarning("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Warning text={warning} />

      {isApproved && quoteChanged && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This changes a previously approved quote — saving will create a new quote version and reset approval
          to awaiting. You&apos;ll be able to send a revised approval from the repair page.
        </div>
      )}

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Instrument</h2>
        <input className="input" placeholder="Description" value={instrumentDescription} onChange={(e) => setInstrumentDescription(e.target.value)} />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input className="input" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <input className="input" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
          <input className="input" placeholder="Serial number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Work & quote</h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input max-w-full sm:max-w-[340px]"
            defaultValue=""
            onChange={(e) => {
              const svc = services.find((s) => s.id === e.target.value);
              if (svc) {
                const base = { description: svc.name, quantity: 1, unit_price: svc.price };
                const companion = companionItem(svc);
                setLineItems((items) => (companion ? [...items, base, companion] : [...items, base]));
              }
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              Add from service catalogue…
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — £{s.price.toFixed(2)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setLineItems((items) => [...items, { description: "", quantity: 1, unit_price: 0 }])}
          >
            + Custom item
          </button>
        </div>

        {lineItems.length > 0 && (
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            {lineItems.map((li, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className="input flex-1"
                  value={li.description}
                  onChange={(e) => updateLineItem(i, { description: e.target.value })}
                />
                <input
                  type="number"
                  className="input w-16"
                  value={li.quantity}
                  onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) })}
                />
                <input
                  type="number"
                  step="0.01"
                  className="input w-24"
                  value={li.unit_price}
                  onChange={(e) => updateLineItem(i, { unit_price: Number(e.target.value) })}
                />
                <span className="w-16 text-right text-sm text-slate-600">£{(li.quantity * li.unit_price).toFixed(2)}</span>
                <button
                  type="button"
                  className="text-xs text-rose-500"
                  onClick={() => setLineItems((items) => items.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea className="input" rows={2} value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} />

        <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
          <label className="label mb-0">Quote total (£)</label>
          <input
            type="number"
            step="0.01"
            className="input max-w-[140px]"
            value={lineItems.length > 0 ? breakdownTotal.toFixed(2) : quoteTotal}
            disabled={lineItems.length > 0}
            onChange={(e) => setQuoteTotal(e.target.value)}
          />
          {lineItems.length > 0 && (
            <span className="text-xs text-slate-400">auto-totalled from items above</span>
          )}
        </div>
      </section>

      <section className="card space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={technicianRequired} onChange={(e) => setTechnicianRequired(e.target.checked)} />
          Needs an external technician
        </label>
        {technicianRequired && (
          <input
            type="number"
            step="0.01"
            className="input max-w-[200px]"
            placeholder="Technician pay (£)"
            value={technicianPay}
            onChange={(e) => setTechnicianPay(e.target.value)}
          />
        )}
      </section>

      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={handleSave}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        <a href={`/repairs/${repair.id}`} className="btn-secondary">
          Cancel
        </a>
      </div>
    </div>
  );
}
