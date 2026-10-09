/**
 * Password rules with no Node built-in imports, so this module is safe to pull
 * into client components. The hashing itself lives in `./password.ts`, which is
 * server-only because it uses node:crypto.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

const COMMON_PASSWORDS = [
  "password",
  "12345678",
  "qwerty",
  "letmein",
  "welcome",
  "iloveyou",
  "admin123",
  "openreply",
];

/**
 * Reject passwords that are too short, too long, or obviously weak. Returns an
 * error message, or null when the password is acceptable.
 */
export function validatePassword(plaintext: string): string | null {
  if (plaintext.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (plaintext.length > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`;
  }
  if (/^\s|\s$/.test(plaintext)) {
    return "Password cannot start or end with a space.";
  }
  const lowered = plaintext.toLowerCase();
  if (COMMON_PASSWORDS.some((c) => lowered === c || lowered.includes(c))) {
    return "That password is too easy to guess. Choose something less common.";
  }
  return null;
}
