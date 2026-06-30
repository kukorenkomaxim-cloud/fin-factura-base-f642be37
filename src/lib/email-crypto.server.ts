// AES-GCM encryption for OAuth tokens. Server-only.
import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "crypto";

function getKey(): Buffer {
  const raw = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("EMAIL_TOKEN_ENCRYPTION_KEY is not set");
  // Accept base64 or raw text; normalize to 32 bytes via SHA-256-like derivation.
  // Use HMAC with a constant salt to derive a 32-byte key from any input length.
  return createHmac("sha256", "fincraft-email-token-v1").update(raw).digest();
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(payload: string): string {
  if (!payload) return "";
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

// HMAC-signed state for OAuth: payload.signature
export function signState(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getKey()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyState<T = unknown>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = createHmac("sha256", getKey()).update(data).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
