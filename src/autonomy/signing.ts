// src/autonomy/signing.ts
//
// Closes the real, confirmed gap: SHA-256 hashes exist elsewhere in this
// codebase (uploads, sandbox artifacts, router requests), but a hash
// alone proves "this matches a value I saw before," not "this was
// produced by an authorized signer." This adds real HMAC-SHA256
// signatures with key rotation, verifiable independent of this
// process's memory.
//
// Honest scope: this is the application-level signing layer. It does
// NOT stand up a live HashiCorp Vault server (this sandbox can't run
// one -- same class of limit as not having a real Chromium binary
// here). What IS real: the key-rotation model, the signature format,
// and verification. The seam marked below (resolveSigningKeys) is
// exactly where a real Vault client would plug in -- fetching the
// active key by version from Vault's Transit engine instead of
// MICROFIXD_SIGNING_KEYS -- without changing anything else in this file.

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SignedEnvelope {
  payload: unknown;
  signature: string;
  keyVersion: string;
  signedAt: string;
}

interface KeyEntry { version: string; secret: string }

/**
 * Real seam for a future Vault/HSM integration. Today: reads
 * MICROFIXD_SIGNING_KEYS, a JSON array of {version, secret}. The FIRST
 * entry is the active signer; older entries stay listed only so
 * previously-signed records can still be verified after rotation --
 * that's what makes this real rotation, not a single static key
 * relabeled.
 */
function resolveSigningKeys(): KeyEntry[] {
  const raw = process.env.MICROFIXD_SIGNING_KEYS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is KeyEntry => typeof k?.version === 'string' && typeof k?.secret === 'string');
  } catch {
    return []; // malformed config -> no keys, never a silently-accepted fake key
  }
}

function canonicalize(payload: unknown): string {
  return JSON.stringify(payload, Object.keys(payload as object).sort());
}

/** Throws if no signing key is configured -- never signs with a fake or empty key. */
export function sign(payload: unknown): SignedEnvelope {
  const keys = resolveSigningKeys();
  const active = keys[0];
  if (!active) throw new Error('Signing requires MICROFIXD_SIGNING_KEYS to be configured with at least one active key.');
  const signedAt = new Date().toISOString();
  const material = `${active.version}:${signedAt}:${canonicalize(payload)}`;
  const signature = createHmac('sha256', active.secret).update(material).digest('hex');
  return { payload, signature, keyVersion: active.version, signedAt };
}

export interface VerifyResult { valid: boolean; reason?: string }

/** Checks against the configured key matching the envelope's recorded version, so records signed before a rotation still verify. */
export function verify(envelope: SignedEnvelope): VerifyResult {
  const keys = resolveSigningKeys();
  const match = keys.find((k) => k.version === envelope.keyVersion);
  if (!match) return { valid: false, reason: `No configured key for version "${envelope.keyVersion}" (rotated out or never configured).` };
  const material = `${match.version}:${envelope.signedAt}:${canonicalize(envelope.payload)}`;
  const expected = createHmac('sha256', match.secret).update(material).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(envelope.signature);
  const valid = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
  return valid ? { valid: true } : { valid: false, reason: 'Signature does not match payload under the recorded key version.' };
}
