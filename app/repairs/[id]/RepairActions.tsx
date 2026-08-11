"use client";

import { useState } from "react";
import UndoToast from "@/components/UndoToast";
import Warning from "@/components/Warning";
import type { Repair, QuoteApproval } from "@/lib/database.types";

interface Props {
  repair: Repair;
  customer: { id: string; email: string | null } | null;
  latestApproval: QuoteApproval | null;
}

export default function RepairActions({ repair, latestApproval }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; undoUrl: string } | null>(null);
  const [reason, setReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");
  const [showUpdateForm, setShowUpdateForm] = useState(false);

  async function call(url: string, body?: unknown, successMessage?: string) {
    setBusy(url);
    setWarning(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        setWarning(json.error || "Something went wrong.");
        setBusy(null);
        return;
      }
      if (json.warning) setWarning(json.warning);
      // A real reload (not router.refresh()) — the Router Cache was still
      // serving stale audit history/communications/checklist data on this
      // page after actions even with staleTimes set to 0. If there's an
      // undo toast to show (it auto-dismisses after 8s, see UndoToast),
      // wait for that same window so it's actually clickable before the
      // reload happens out from under it — clicking Undo itself reloads
      // immediately anyway.
      if (successMessage && json.undoUrl) {
        setToast({ message: successMessage, undoUrl: json.undoUrl });
        setTimeout(() => window.location.reload(), 8000);
      } else {
        window.location.reload();
      }
    } catch {
      setWarning("Network error — please try again.");
      setBusy(null);
    }
  }

  const canCancelApproval = latestApproval?.response === "approved" && !latestApproval.cancelled_by_staff;

  return (
    <div className="card space-y-2">
      <Warning text={warning} />
      <div className="flex flex-wrap gap-2">
        <a href={`/repairs/${repair.id}/edit`} className="btn-secondary">
          Edit
        </a>
        <button className="btn-secondary" disabled={!!busy} onClick={() => call(`/api/repairs/${repair.id}/send-approval`)}>
          {latestApproval ? "Resend approval" : "Send approval"}
        </button>
        <button className="btn-secondary" disabled={!!busy} onClick={() => call(`/api/repairs/${repair.id}/send-confirmation`)}>
          Send confirmation
        </button>
        <button className="btn-secondary" disabled={!!busy} onClick={() => setShowUpdateForm((v) => !v)}>
          Send update
        </button>
        {repair.status !== "ready" && repair.status !== "collected" && (
          <button className="btn-secondary" disabled={!!busy} onClick={() => call(`/api/repairs/${repair.id}/send-ready`)}>
            Ready for collection
          </button>
        )}
        {repair.status !== "collected" && (
          <button
            className="btn-secondary"
            disabled={!!busy}
            onClick={() =>
              call(`/api/repairs/${repair.id}/collect`, { method: "card", paid: true }, "Marked paid & collected.")
            }
          >
            Paid &amp; Collected
          </button>
        )}
        {repair.status !== "collected" && (
          <button
            className="btn-secondary"
            disabled={!!busy}
            onClick={() =>
              call(`/api/repairs/${repair.id}/collect`, { paid: false }, "Marked collected — payment still owed.")
            }
          >
            Collected — not paid yet
          </button>
        )}
        {canCancelApproval && (
          <button className="btn-danger" disabled={!!busy} onClick={() => setShowCancelForm((v) => !v)}>
            Cancel approval
          </button>
        )}
        <button
          className="btn-secondary"
          disabled={!!busy}
          onClick={() => call(`/api/repairs/${repair.id}/undo`, undefined, "Undid last change.")}
        >
          Undo last change
        </button>
        {!repair.archived_at && (
          <button
            className="btn-secondary"
            disabled={!!busy}
            onClick={() => call(`/api/repairs/${repair.id}/archive`, undefined, "Repair archived.")}
          >
            Archive
          </button>
        )}
      </div>

      {showUpdateForm && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
          <input
            className="input max-w-md"
            placeholder="Message to send to the customer"
            value={updateMessage}
            onChange={(e) => setUpdateMessage(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={!!busy || !updateMessage}
            onClick={async () => {
              await call(`/api/repairs/${repair.id}/send-update`, { message: updateMessage });
              setShowUpdateForm(false);
              setUpdateMessage("");
            }}
          >
            Send
          </button>
        </div>
      )}

      {showCancelForm && (
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
          <input
            className="input max-w-md"
            placeholder="Reason for cancelling (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            className="btn-danger"
            disabled={!!busy}
            onClick={async () => {
              await call(`/api/repairs/${repair.id}/cancel-approval`, { reason }, "Approval cancelled.");
              setShowCancelForm(false);
              setReason("");
            }}
          >
            Confirm cancel
          </button>
        </div>
      )}

      {toast && (
        <UndoToast message={toast.message} undoUrl={toast.undoUrl} onDone={() => setToast(null)} />
      )}
    </div>
  );
}
