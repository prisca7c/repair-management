"use client";

import { useEffect, useState, use as usePromise } from "react";

interface ApprovalView {
  repairNumber: string;
  instrument: string;
  workDescription: string;
  total: number;
  response: "pending" | "approved" | "declined";
  customerMessage: string | null;
  expired: boolean;
  expiresAt: string;
}

export default function ApprovePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = usePromise(params);
  const [view, setView] = useState<ApprovalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState<"approved" | "declined" | null>(null);

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

  async function respond(response: "approved" | "declined") {
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
                  <div>
                    <dt className="text-xs text-slate-500">Work</dt>
                    <dd>{view.workDescription}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Total</dt>
                    <dd className="text-base font-semibold">£{view.total.toFixed(2)}</dd>
                  </div>
                </dl>

                {view.response !== "pending" ? (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                    You have already <strong>{view.response}</strong> this quote.
                    {view.customerMessage && <p className="mt-1 italic">&ldquo;{view.customerMessage}&rdquo;</p>}
                  </div>
                ) : view.expired ? (
                  <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    This link has expired. Please contact the shop for a new one.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                      rows={2}
                      placeholder="Optional message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => respond("approved")}
                        disabled={!!submitting}
                        className="inline-flex flex-1 items-center justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {submitting === "approved" ? "Approving…" : "Approve"}
                      </button>
                      <button
                        onClick={() => respond("declined")}
                        disabled={!!submitting}
                        className="inline-flex flex-1 items-center justify-center rounded-md border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {submitting === "declined" ? "Declining…" : "Decline"}
                      </button>
                    </div>
                  </div>
                )}
                {error && <p className="text-sm text-rose-600">{error}</p>}
              </div>
            )}
          </div>
    </div>
  );
}
