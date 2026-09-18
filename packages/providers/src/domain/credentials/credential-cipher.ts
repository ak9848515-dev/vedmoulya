// ──────────────────────────────────────────────────────────────────
// VedMoulya — Provider Credential Cipher
// PROVIDER-01 — Decision 3 (encrypted at rest)
//
// AES-256-GCM authenticated encryption for provider credentials. GCM is
// chosen deliberately: a tampered ciphertext fails to open rather than
// decrypting to garbage, so a corrupted/rotated record can never be mistaken
// for a working credential.
//
// The deployment supplies a high-entropy secret (env var, never committed);
// the 32-byte cipher key is derived from it with scrypt + a fixed, versioned
// salt. Rotating the deployment secret therefore invalidates every previously
// sealed credential — which the resolver treats as "no user credential" and
// falls back to the platform credential, never as a silent success.
// ──────────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import type { SealedProviderCredential } from '../../types/credential-types.js';

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SALT = 'vedmoulya.provider-credential.v1';

/** Current cipher version — sealed records carry it for rotation. */
export const PROVIDER_CREDENTIAL_CIPHER_VERSION = 1;

/** Minimum deployment-secret length; a short secret is a misconfiguration. */
export const MIN_CREDENTIAL_KEY_LENGTH = 16;

export interface ProviderCredentialCipher {
  /** Encrypt a plaintext secret into its at-rest form. */
  seal(secret: string): SealedProviderCredential;
  /** Decrypt a sealed record. Throws when the key or payload is invalid. */
  open(sealed: SealedProviderCredential): string;
}

/**
 * Build a cipher from deployment key material. Throws on key material that is
 * too short — a weak key must fail loudly at startup, never silently protect
 * a real credential.
 */
export function createProviderCredentialCipher(keyMaterial: string): ProviderCredentialCipher {
  const material = keyMaterial.trim();
  if (material.length < MIN_CREDENTIAL_KEY_LENGTH) {
    throw new Error(
      `Provider credential encryption key must be at least ${MIN_CREDENTIAL_KEY_LENGTH} characters`,
    );
  }
  const key = scryptSync(material, SALT, KEY_BYTES);

  return {
    seal(secret: string): SealedProviderCredential {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
      return {
        algorithm: ALGORITHM,
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        ciphertext: ciphertext.toString('base64'),
        keyVersion: PROVIDER_CREDENTIAL_CIPHER_VERSION,
      };
    },
    open(sealed: SealedProviderCredential): string {
      // `algorithm` is a literal type, so a record carrying another cipher can
      // never reach here — GCM's auth tag is what makes a bad payload fail.
      const decipher = createDecipheriv(sealed.algorithm, key, Buffer.from(sealed.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(sealed.authTag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}
