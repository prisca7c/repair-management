"use client";

import { useEffect, useState } from "react";

interface LineItemView {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface ApprovalView {
  repairNumber: string;
  instrument: string;
  workDescription: string;
  total: number;
  lineItems: LineItemView[];
  response: "pending" | "approved" | "declined";
  customerMessage: string | null;
  expired: boolean;
  expiresAt: string;
}

export default function ApprovePage({
  params,
}: {
  // Plain object on Next 14 (not a Promise) — do not wrap this in React's
  // use() hook, that's a Next 15+ pattern and throws a client-side
  // exception here since params isn't actually a Promise on this version.
  params: { token: string };
}) {
  const { token } = params;
  const [view, setView] = useState<ApprovalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState<"approved" | "declined" | "undo" | null>(null);

  useEffect(() => {
    fetch(`/api/approve/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "This approval link is invalid.");
          return;
        }
        setView(json.view);
      })
      .catch(() => setError("Something went wrong loading this page."))
      .finally(() => setLoading(false));
  }, [token]);

  async function respond(response: "approved" | "declined" | "undo") {
    setSubmitting(response);
    try {
      const res = await fetch(`/api/approve/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response, message: message || undefined }),
      });
      const json = await res.json();
      if (json.view) setView(json.view);
      if (!res.ok && json.error) setError(json.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mx-auto -mx-4 max-w-md px-4 py-6 sm:mx-auto sm:px-4 sm:py-12">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-lg font-semibold">Repair quote</h1>
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {error && !view && <p className="text-sm text-rose-600">{error}</p>}
        {view && (
          <div className="space-y-4">
            <div className="text-sm text-slate-500">Reference {view.repairNumber}</div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Instrument</dt>
                <dd>{view.instrument}</dd>
              </div>
              {view.lineItems.length > 0 ? (
                <div>
                  <dt className="text-xs text-slate-500">Work</dt>
                  <dd>
                    <ul className="mt-1 divide-y divide-slate-100">
                      {view.lineItems.map((li, i) => (
                        <li key={i} className="flex justify-between py-1">
                          <span>
                            {li.description}
                            {li.quantity > 1 ? ` × ${li.quantity}` : ""}
                          </span>
                          <span>£{li.line_total.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              ) : (
                <div>
                  <dt className="text-xs text-slate-500">Work</dt>
                  <dd>{view.workDescription || "-"}</dd>
                </div>
              )}
              {view.lineItems.length > 0 && view.workDescription && (
                <div>
                  <dt className="text-xs text-slate-500">Additional notes</dt>
                  <dd>{view.workDescription}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-500">Total</dt>
                <dd className="text-base font-semibold">£{view.total.toFixed(2)}</dd>
              </div>
            </dl>

            {view.response !== "pending" ? (
              <div className="space-y-3">
                <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                  You have already <strong>{view.response}</strong> this quote.
                  {view.response === "approved" && (
                    <p className="mt-1 text-slate-600">
                      Thanks — the shop has been notified and will get started. Payment can be made by
                      cash or card, either now or when you collect your instrument.
                    </p>
                  )}
                  {view.response === "declined" && (
                    <p className="mt-1 text-slate-600">The shop has been notified.</p>
                  )}
                  {view.customerMessage && <p className="mt-1 italic">&ldquo;{view.customerMessage}&rdquo;</p>}
                </div>
                <button
                  onClick={() => respond("undo")}
                  disabled={!!submitting}
                  className="text-sm text-slate-500 underline hover:text-slate-700 disabled:opacity-50"
                >
                  {submitting === "undo" ? "Undoing…" : "Made a mistake? Undo this response"}
                </button>
                <p className="text-xs text-slate-400">You can close this tab now — there&apos;s nothing else to do here.</p>
              </div>
            ) : view.expired ? (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This link has expired. Please contact the shop for a new one.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">
                  By approving, you agree to the work and total shown above, and that the shop is
                  not responsible for any pre-existing damage or issues not related to this repair.
                  Payment is due by cash or card, either now or when you collect your instrument.
                </p>
                <label className="flex items-start gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                  />
                  I have read and agree to the above.
                </label>
                <textarea
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                  rows={2}
                  placeholder="Optional message to the shop"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => respond("approved")}
                    disabled={!!submitting || !agree}
                    className="inline-flex flex-1 items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {submitting === "approved" ? "Approving…" : `Yes, approve £${view.total.toFixed(2)}`}
                  </button>
                  <button
                    onClick={() => respond("declined")}
                    disabled={!!submitting}
                    className="inline-flex flex-1 items-center justify-center rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                  >
                    {submitting === "declined" ? "Declining…" : "No, do not proceed"}
                  </button>
                </div>
                {!agree && (
                  <p className="text-xs text-slate-400">Check the box above to enable approval.</p>
                )}
              </div>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
