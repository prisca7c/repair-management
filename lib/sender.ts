import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Sender.net email abstraction.
//
// IMPORTANT: double-check field names/endpoints against Sender.net's current
// REST API docs (https://api.sender.net) before going live — this uses the
// commonly documented shape for their transactional/campaign + subscriber
// endpoints as of this build, but their API has changed shape before.
//
// Design goal: a failure here must NEVER throw and block the repair-save
// operation that triggered it. Every send function:
//   1. Writes a `communications` row up front (status "pending" then
//      updated to "sent"/"failed"), so there is always a record even if the
//      network call itself throws.
//   2. Wraps the actual HTTP call in try/catch.
//   3. Returns a SoftResult the caller/UI can show as a small non-blocking
//      warning with a retry action — never throws.
// ============================================================================

const SENDER_API_BASE = "https://api.sender.net/v2";

export interface SoftResult {
  ok: boolean;
  warning?: string;
}

function getConfig() {
  const token = process.env.SENDER_API_TOKEN;
  const fromEmail = process.env.REPAIR_FROM_EMAIL;
  const fromName = process.env.REPAIR_FROM_NAME || "Repair Shop";
  const groupId = process.env.SENDER_CUSTOMER_GROUP_ID;
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  return { token, fromEmail, fromName, groupId, appBaseUrl };
}

async function senderFetch(path: string, init: RequestInit) {
  const { token } = getConfig();
  if (!token) {
    throw new Error("SENDER_API_TOKEN is not configured");
  }
  const res = await fetch(`${SENDER_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sender.net API error ${res.status}: ${body}`);
  }
  return res.json().catch(() => ({}));
}

async function recordCommunication(
  db: SupabaseClient,
  params: {
    repairId: string;
    type: string;
    subject: string;
    body: string;
    sentTo: string;
  }
) {
  const { data, error } = await db
    .from("communications")
    .insert({
      repair_id: params.repairId,
      type: params.type,
      subject: params.subject,
      body: params.body,
      sent_to: params.sentTo,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[sender] failed to write communications row:", error.message);
    return null;
  }
  return data.id as string;
}

async function markCommunication(
  db: SupabaseClient,
  commId: string | null,
  status: "sent" | "failed",
  error?: string
) {
  if (!commId) return;
  await db
    .from("communications")
    .update({
      status,
      sent_at: status === "sent" ? new Date().toISOString() : null,
      error: error ?? null,
    })
    .eq("id", commId);
}

async function sendEmail(
  db: SupabaseClient,
  params: {
    repairId: string;
    type: string;
    to: string;
    subject: string;
    html: string;
  }
): Promise<SoftResult> {
  const { fromEmail, fromName } = getConfig();
  const commId = await recordCommunication(db, {
    repairId: params.repairId,
    type: params.type,
    subject: params.subject,
    body: params.html,
    sentTo: params.to,
  });

  try {
    if (!fromEmail) throw new Error("REPAIR_FROM_EMAIL is not configured");

    await senderFetch("/message/send", {
      method: "POST",
      body: JSON.stringify({
        from: { email: fromEmail, name: fromName },
        to: { email: params.to },
        subject: params.subject,
        html: params.html,
      }),
    });

    await markCommunication(db, commId, "sent");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error";
    await markCommunication(db, commId, "failed", message);
    console.error(`[sender] ${params.type} email failed:`, message);
    return {
      ok: false,
      warning: `Email (${params.type}) could not be sent — the repair was still saved. You can retry sending from the repair page.`,
    };
  }
}

// ----------------------------------------------------------------------------
// Public API used by route handlers
// ----------------------------------------------------------------------------

export async function sendApprovalEmail(
  db: SupabaseClient,
  params: {
    repairId: string;
    repairNumber: string;
    customerEmail: string;
    customerName: string;
    workDescription: string;
    total: number;
    token: string;
  }
): Promise<SoftResult> {
  const { appBaseUrl } = getConfig();
  const link = `${appBaseUrl}/approve/${params.token}`;
  const html = `
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>Your repair <strong>${escapeHtml(params.repairNumber)}</strong> has a quote ready for approval:</p>
    <p><strong>Work:</strong> ${escapeHtml(params.workDescription || "-")}<br/>
       <strong>Total:</strong> £${params.total.toFixed(2)}</p>
    <p><a href="${link}">Review and respond to this quote</a></p>
    <p>This link will expire in 14 days.</p>
  `;
  return sendEmail(db, {
    repairId: params.repairId,
    type: "approval",
    to: params.customerEmail,
    subject: `Quote for repair ${params.repairNumber} — approval needed`,
    html,
  });
}

export async function sendConfirmationEmail(
  db: SupabaseClient,
  params: {
    repairId: string;
    repairNumber: string;
    customerEmail: string;
    customerName: string;
    workDescription: string;
  }
): Promise<SoftResult> {
  const html = `
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>We've received your instrument for repair <strong>${escapeHtml(params.repairNumber)}</strong>.</p>
    <p><strong>Work agreed:</strong> ${escapeHtml(params.workDescription || "-")}</p>
    <p>We'll be in touch with updates. Thanks for choosing us!</p>
  `;
  return sendEmail(db, {
    repairId: params.repairId,
    type: "confirmation",
    to: params.customerEmail,
    subject: `We've received your repair ${params.repairNumber}`,
    html,
  });
}

export async function sendReadyEmail(
  db: SupabaseClient,
  params: {
    repairId: string;
    repairNumber: string;
    customerEmail: string;
    customerName: string;
  }
): Promise<SoftResult> {
  const html = `
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>Good news — your repair <strong>${escapeHtml(params.repairNumber)}</strong> is ready for collection!</p>
  `;
  return sendEmail(db, {
    repairId: params.repairId,
    type: "ready",
    to: params.customerEmail,
    subject: `Ready for collection — ${params.repairNumber}`,
    html,
  });
}

export async function sendUpdateEmail(
  db: SupabaseClient,
  params: {
    repairId: string;
    repairNumber: string;
    customerEmail: string;
    customerName: string;
    message: string;
  }
): Promise<SoftResult> {
  const html = `
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>An update on your repair <strong>${escapeHtml(params.repairNumber)}</strong>:</p>
    <p>${escapeHtml(params.message)}</p>
  `;
  return sendEmail(db, {
    repairId: params.repairId,
    type: "update",
    to: params.customerEmail,
    subject: `Update on your repair ${params.repairNumber}`,
    html,
  });
}

export async function sendCancellationEmail(
  db: SupabaseClient,
  params: {
    repairId: string;
    repairNumber: string;
    customerEmail: string;
    customerName: string;
    reason?: string;
  }
): Promise<SoftResult> {
  const html = `
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>Your previous approval for repair <strong>${escapeHtml(params.repairNumber)}</strong> has been cancelled by our team${
      params.reason ? `: ${escapeHtml(params.reason)}` : "."
    }</p>
    <p>We'll send a revised quote shortly if needed. Sorry for any inconvenience.</p>
  `;
  return sendEmail(db, {
    repairId: params.repairId,
    type: "cancellation",
    to: params.customerEmail,
    subject: `Approval cancelled — ${params.repairNumber}`,
    html,
  });
}

/** Generic wrapper used by the repair email sent when a job is repair-generic. */
export async function sendRepairEmail(
  db: SupabaseClient,
  params: {
    repairId: string;
    repairNumber: string;
    customerEmail: string;
    customerName: string;
    subject: string;
    message: string;
    type?: string;
  }
): Promise<SoftResult> {
  const html = `
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>${escapeHtml(params.message)}</p>
    <p>Reference: ${escapeHtml(params.repairNumber)}</p>
  `;
  return sendEmail(db, {
    repairId: params.repairId,
    type: params.type || "internal_notice",
    to: params.customerEmail,
    subject: params.subject,
    html,
  });
}

/**
 * Best-effort sync of a customer as a Sender.net subscriber (only if they
 * opted into marketing). Failures are logged to sender_sync_status and
 * never thrown — customer/repair data is always saved first regardless of
 * sync outcome.
 */
export async function syncCustomerSubscriber(
  db: SupabaseClient,
  customer: {
    id: string;
    email: string | null;
    first_name: string;
    last_name: string;
    marketing_consent: boolean;
  }
): Promise<SoftResult> {
  if (!customer.marketing_consent || !customer.email) {
    return { ok: true };
  }

  const { groupId } = getConfig();

  try {
    await senderFetch("/subscribers", {
      method: "POST",
      body: JSON.stringify({
        email: customer.email,
        firstname: customer.first_name,
        lastname: customer.last_name,
        groups: groupId ? [groupId] : undefined,
      }),
    });

    await db.from("sender_sync_status").upsert(
      {
        customer_id: customer.id,
        status: "synced",
        last_synced_at: new Date().toISOString(),
        error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" }
    );

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    await db.from("sender_sync_status").upsert(
      {
        customer_id: customer.id,
        status: "failed",
        error: message,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" }
    );
    console.error("[sender] subscriber sync failed:", message);
    return {
      ok: false,
      warning:
        "Could not sync this customer to the mailing list — they were still saved. You can retry from Settings.",
    };
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
