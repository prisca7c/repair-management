"use client";

import { useState, useMemo } from "react";
import type { Service, Customer } from "@/lib/database.types";

interface LineItem {
  service_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

// This shop only tracks the instrument's name/description (e.g. "Fender
// Stratocaster") — no type picker. instrument_type is still sent to satisfy
// the database column, always as "guitar".
const INSTRUMENT_TYPE = "guitar";

export default function NewRepairForm({
  services,
}: {
  services: Service[];
}) {
  // Customer selection
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    marketing_consent: false,
  });

  // Instrument
  const [instrumentDescription, setInstrumentDescription] = useState("");
  const [showMoreInstrument, setShowMoreInstrument] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  // Work / quote
  const [workDescription, setWorkDescription] = useState("");
  const [quoteTotal, setQuoteTotal] = useState<string>("");
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [manualOverride, setManualOverride] = useState(false);

  // Technician (only one, so we just track pay — no name selection)
  const [technicianRequired, setTechnicianRequired] = useState(false);
  const [technicianPay, setTechnicianPay] = useState("");

  // Payment required up front, before work starts — deposit or full amount.
  const [paymentRequiredType, setPaymentRequiredType] = useState<"none" | "deposit" | "full">("none");
  const [depositAmount, setDepositAmount] = useState("");

  const [verballyDiscussed, setVerballyDiscussed] = useState(false);
  const [notes, setNotes] = useState("");
  const [locationType, setLocationType] = useState("repair_room");
  const [locationText, setLocationText] = useState("");

  const [submitting, setSubmitting] = useState<"save" | "save_send" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const breakdownTotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + li.quantity * li.unit_price, 0),
    [lineItems]
  );

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    const res = await fetch(`/api/customers?q=${encodeURIComponent(q)}`);
    const json = await res.json();
    setCustomerResults(json.customers ?? []);
  }

  // A couple of the default services aren't flat-rate — "Basic setup" is a
  // minimum starting from its price (extra on top for bigger jobs), and
  // "Re-string with chosen strings" is the service fee plus whatever the
  // strings themselves cost. For those, add a second £0 line the staff can
  // fill in rather than making them do the maths.
  function companionItem(service: Service): LineItem | null {
    const name = service.name.toLowerCase();
    if (name.includes("basic setup")) {
      return { service_id: null, description: "Extra (describe what)", quantity: 1, unit_price: 0 };
    }
    if (name.includes("chosen strings")) {
      return { service_id: null, description: "String cost", quantity: 1, unit_price: 0 };
    }
    return null;
  }

  function addLineItem(service?: Service) {
    setLineItems((items) => {
      const base = {
        service_id: service?.id ?? null,
        description: service?.name ?? "",
        quantity: 1,
        unit_price: service?.price ?? 0,
      };
      const companion = service ? companionItem(service) : null;
      return companion ? [...items, base, companion] : [...items, base];
    });
    setManualOverride(false);
  }

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setLineItems((items) => items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeLineItem(index: number) {
    setLineItems((items) => items.filter((_, i) => i !== index));
  }

  const effectiveTotal = lineItems.length > 0 && !manualOverride
    ? breakdownTotal
    : Number(quoteTotal || 0);

  async function ensureCustomer(): Promise<string | null> {
    if (selectedCustomer) return selectedCustomer.id;
    if (!showNewCustomer || !newCustomer.first_name || !newCustomer.last_name) {
      setError("Please select an existing customer or fill in the new customer's name.");
      return null;
    }
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCustomer),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not create customer");
      return null;
    }
    return json.customer.id as string;
  }

  async function handleSubmit(mode: "save" | "save_send") {
    setError(null);
    setSubmitting(mode);
    try {
      const customerId = await ensureCustomer();
      if (!customerId) {
        setSubmitting(null);
        return;
      }

      const res = await fetch("/api/repairs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerId,
          instrument_type: INSTRUMENT_TYPE,
          instrument_description: instrumentDescription,
          brand,
          model,
          serial_number: serialNumber,
          work_description: workDescription,
          quote_total: effectiveTotal,
          line_items: lineItems.length > 0 ? lineItems : undefined,
          technician_required: technicianRequired,
          technician_id: null,
          technician_pay: technicianRequired ? Number(technicianPay || 0) : null,
          verbally_discussed: verballyDiscussed,
          notes,
          location_type: locationType,
          location_text: locationText,
          send_approval_email: mode === "save_send",
          payment_required_type: paymentRequiredType,
          deposit_amount: paymentRequiredType === "deposit" ? Number(depositAmount || 0) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not create repair");
        setSubmitting(null);
        return;
      }
      // Full navigation, not router.push()+refresh() — guarantees the new
      // repair page renders with fresh data, no client-cached copy.
      window.location.href = `/repairs/${json.repair.id}`;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Customer */}
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Customer</h2>
        {selectedCustomer ? (
          <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
            <span>
              {selectedCustomer.first_name} {selectedCustomer.last_name}
              {selectedCustomer.email ? ` — ${selectedCustomer.email}` : ""}
              {selectedCustomer.phone ? ` — ${selectedCustomer.phone}` : ""}
            </span>
            <button className="text-xs text-slate-500 hover:underline" onClick={() => setSelectedCustomer(null)}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              className="input"
              placeholder="Search by name, phone, or email…"
              value={customerQuery}
              onChange={(e) => searchCustomers(e.target.value)}
            />
            {customerResults.length > 0 && (
              <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-200 text-sm">
                {customerResults.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerResults([]);
                        setShowNewCustomer(false);
                      }}
                    >
                      {c.first_name} {c.last_name} {c.email ? `— ${c.email}` : ""} {c.phone ? `— ${c.phone}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="text-sm font-medium text-slate-700 hover:underline"
              onClick={() => setShowNewCustomer((v) => !v)}
            >
              {showNewCustomer ? "Cancel new customer" : "+ New customer"}
            </button>
            {showNewCustomer && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  className="input"
                  placeholder="First name"
                  value={newCustomer.first_name}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, first_name: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Last name"
                  value={newCustomer.last_name}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, last_name: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                />
                <label className="col-span-full flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={newCustomer.marketing_consent}
                    onChange={(e) => setNewCustomer((c) => ({ ...c, marketing_consent: e.target.checked }))}
                  />
                  OK to add to mailing list
                </label>
              </div>
            )}
          </>
        )}
      </section>

      {/* Instrument */}
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Instrument</h2>
        <input
          className="input"
          placeholder="Instrument (e.g. 'Fender Stratocaster, red, small dent on body')"
          value={instrumentDescription}
          onChange={(e) => setInstrumentDescription(e.target.value)}
        />
        <button
          type="button"
          className="text-sm text-slate-600 hover:underline"
          onClick={() => setShowMoreInstrument((v) => !v)}
        >
          {showMoreInstrument ? "Hide details" : "+ More instrument details"}
        </button>
        {showMoreInstrument && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input className="input" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
            <input className="input" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
            <input
              className="input"
              placeholder="Serial number"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>
        )}
      </section>

      {/* Work + quote */}
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Work & quote</h2>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input max-w-full sm:max-w-[340px]"
            defaultValue=""
            onChange={(e) => {
              const svc = services.find((s) => s.id === e.target.value);
              if (svc) addLineItem(svc);
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
          <button type="button" className="btn-secondary" onClick={() => addLineItem()}>
            + Custom item
          </button>
        </div>

        {lineItems.length > 0 && (
          <div className="space-y-2 rounded-md border border-slate-200 p-3">
            {lineItems.map((li, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className="input flex-1"
                  placeholder="Description"
                  value={li.description}
                  onChange={(e) => updateLineItem(i, { description: e.target.value })}
                />
                <input
                  type="number"
                  className="input w-16"
                  value={li.quantity}
                  onChange={(e) => {
                    setManualOverride(false);
                    updateLineItem(i, { quantity: Number(e.target.value) });
                  }}
                />
                <input
                  type="number"
                  step="0.01"
                  className="input w-24"
                  value={li.unit_price}
                  onChange={(e) => {
                    setManualOverride(false);
                    updateLineItem(i, { unit_price: Number(e.target.value) });
                  }}
                />
                <span className="w-16 text-right text-sm text-slate-600">
                  £{(li.quantity * li.unit_price).toFixed(2)}
                </span>
                <button type="button" className="text-xs text-rose-500" onClick={() => removeLineItem(i)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          className="input"
          rows={2}
          placeholder="What's being done?"
          value={workDescription}
          onChange={(e) => setWorkDescription(e.target.value)}
        />

        <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
          <label className="label mb-0">Quote total (£)</label>
          <input
            type="number"
            step="0.01"
            className="input max-w-[140px]"
            value={lineItems.length > 0 && !manualOverride ? breakdownTotal.toFixed(2) : quoteTotal}
            onChange={(e) => {
              setManualOverride(true);
              setQuoteTotal(e.target.value);
            }}
          />
          {lineItems.length > 0 && !manualOverride && (
            <span className="text-xs text-slate-400">auto-totalled from items above</span>
          )}
        </div>
      </section>

      {/* Payment required up front */}
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Payment before work starts</h2>
        <p className="text-xs text-slate-500">
          By default customers pay when they collect their instrument. Choose deposit or full payment if
          this customer needs to pay some or all of it up front — the approval email will include bank
          transfer details, and they&apos;ll need to confirm they&apos;ve sent it before they can approve the quote.
        </p>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="payment_required_type"
              checked={paymentRequiredType === "none"}
              onChange={() => setPaymentRequiredType("none")}
            />
            Not required upfront
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="payment_required_type"
              checked={paymentRequiredType === "deposit"}
              onChange={() => setPaymentRequiredType("deposit")}
            />
            Deposit
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="payment_required_type"
              checked={paymentRequiredType === "full"}
              onChange={() => setPaymentRequiredType("full")}
            />
            Full payment
          </label>
        </div>
        {paymentRequiredType === "deposit" && (
          <input
            type="number"
            step="0.01"
            className="input max-w-[200px]"
            placeholder="Deposit amount (£)"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />
        )}
      </section>

      {/* Location */}
      <section className="card space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">Location</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select className="input" value={locationType} onChange={(e) => setLocationType(e.target.value)}>
            <option value="repair_room">Repair room</option>
            <option value="home_staff">Home (staff)</option>
            <option value="home_technician">Home (technician)</option>
            <option value="other">Other</option>
          </select>
          <input
            className="input"
            placeholder="Location details (optional)"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
          />
        </div>
      </section>

      {/* Technician */}
      <section className="card space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={technicianRequired}
            onChange={(e) => setTechnicianRequired(e.target.checked)}
          />
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

      {/* Internal */}
      <section className="card space-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={verballyDiscussed} onChange={(e) => setVerballyDiscussed(e.target.checked)} />
          Discussed/agreed verbally (internal note only — does not approve anything)
        </label>
        <textarea
          className="input"
          rows={2}
          placeholder="Internal notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={submitting !== null}
          onClick={() => handleSubmit("save")}
        >
          {submitting === "save" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={submitting !== null}
          onClick={() => handleSubmit("save_send")}
        >
          {submitting === "save_send" ? "Saving…" : "Save & Send Approval Email"}
        </button>
      </div>
    </div>
  );
}
