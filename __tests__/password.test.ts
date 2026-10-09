import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  MIN_PASSWORD_LENGTH,
  validatePassword,
} from "@/lib/auth/password-policy";

describe("hashPassword / verifyPassword", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("Correct horse battery", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same-password-here");
    const b = await hashPassword("same-password-here");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password-here", a)).toBe(true);
    expect(await verifyPassword("same-password-here", b)).toBe(true);
  });

  it("encodes its parameters in the stored format", async () => {
    const hash = await hashPassword("another-password");
    const parts = hash.split("$");
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe("scrypt");
    expect(Number(parts[1])).toBeGreaterThan(1);
  });

  it("returns false instead of throwing on missing or malformed hashes", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", undefined)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$2$3")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$16384$8$1$AAAA$BBBB")).toBe(false);
    expect(await verifyPassword("x", "scrypt$a$b$c$AAAA$BBBB")).toBe(false);
  });

  it("treats unicode-equivalent passwords as equal", async () => {
    // "é" composed vs decomposed — same password to a human typing it.
    const hash = await hashPassword("caf\u00e9-password");
    expect(await verifyPassword("cafe\u0301-password", hash)).toBe(true);
  });
});

describe("validatePassword", () => {
  it("accepts a reasonable password", () => {
    expect(validatePassword("a-decent-passphrase")).toBeNull();
  });

  it("rejects passwords under the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(
      /at least/
    );
  });

  it("rejects absurdly long passwords", () => {
    expect(validatePassword("a".repeat(500))).toMatch(/at most/);
  });

  it("rejects leading or trailing whitespace", () => {
    expect(validatePassword(" leading-space-pw")).toMatch(/space/);
    expect(validatePassword("trailing-space-pw ")).toMatch(/space/);
  });

  it("rejects common passwords", () => {
    expect(validatePassword("password123")).toMatch(/easy to guess/);
    expect(validatePassword("myopenreply")).toMatch(/easy to guess/);
  });
});
