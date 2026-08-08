import crypto from "crypto";

const TOKEN_BYTES = 32;
const EXPIRY_DAYS = 14;

/**
 * Generates a fresh, cryptographically random approval token. Returns both
 * the raw token (put in the email link, never persisted) and its sha256
 * hash (the only thing stored in quote_approvals.token_hash).
 */
export function generateApprovalToken(): {
  token: string;
  tokenHash: string;
  expiresAt: string;
} {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  return { token, tokenHash, expiresAt };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
