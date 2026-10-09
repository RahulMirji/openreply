/**
 * Password hashing for email + password sign in.
 *
 * Uses scrypt from node:crypto rather than bcrypt/argon2 so there is no native
 * dependency to compile on the VPS. scrypt is memory-hard and is an accepted
 * password KDF (RFC 7914).
 *
 * Stored format is self-describing so cost parameters can be raised later
 * without invalidating existing hashes:
 *
 *   scrypt$<N>$<r>$<p>$<salt-base64>$<key-base64>
 */

import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "crypto";

/**
 * Hand-rolled instead of util.promisify: promisify resolves to scrypt's 3-arg
 * overload and drops the options parameter, so the cost parameters below would
 * be silently ignored (and TypeScript rejects the call).
 */
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

// ~16 MiB of memory per hash (128 * N * r bytes). Comfortable on the VPS while
// still being expensive to brute force.
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  validatePassword,
} from "./password-policy";

/**
 * scrypt's maxmem defaults to 32 MiB, which is below what N=16384, r=8 needs
 * once Node adds its own overhead. Raise it explicitly.
 */
const SCRYPT_OPTIONS = { N, r: R, p: P, maxmem: 64 * 1024 * 1024 } as const;

export async function hashPassword(plaintext: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await scryptAsync(
    plaintext.normalize("NFKC"),
    salt,
    KEY_LENGTH,
    SCRYPT_OPTIONS
  );

  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/**
 * Verify a password against a stored hash. Returns false rather than throwing
 * on malformed input, so a corrupt row cannot 500 the sign-in route.
 */
export async function verifyPassword(
  plaintext: string,
  stored: string | null | undefined
): Promise<boolean> {
  if (!stored) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await scryptAsync(plaintext.normalize("NFKC"), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    });
  } catch {
    return false;
  }

  // Lengths are equal by construction above, but timingSafeEqual throws if they
  // are not, so guard anyway.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}


