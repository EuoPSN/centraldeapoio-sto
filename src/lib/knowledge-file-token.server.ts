// Server-only helper to mint and verify short-lived HMAC tokens used to proxy
// downloads of files from the knowledge-files bucket through the app origin
// (avoiding direct calls to the Supabase domain, which some networks block).
import { createHmac, timingSafeEqual } from "crypto";

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signKnowledgeFileToken(path: string, ttlSeconds = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = b64url(Buffer.from(JSON.stringify({ p: path, e: exp })));
  const sig = b64url(createHmac("sha256", secret()).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyKnowledgeFileToken(token: string): { path: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = b64url(createHmac("sha256", secret()).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { p, e } = JSON.parse(fromB64url(payload).toString("utf-8")) as { p: string; e: number };
    if (Math.floor(Date.now() / 1000) > e) return null;
    return { path: p };
  } catch {
    return null;
  }
}
