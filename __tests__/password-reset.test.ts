import "dotenv/config";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
  consumePasswordResetToken,
} from "@/lib/auth/password-reset";
import { prisma } from "@/lib/db/client";

describe("Password Reset Token utilities", () => {
  const testEmail = "reset-test@example.com";

  beforeEach(async () => {
    // Clean up test tokens
    await prisma.passwordResetToken.deleteMany({
      where: { email: testEmail },
    });
  });

  it("creates a secure random token and stores its hash in database", async () => {
    const rawToken = await createPasswordResetToken(testEmail);
    expect(rawToken).toBeDefined();
    expect(rawToken.length).toBe(64); // 32 bytes in hex

    // Verify rawToken is not stored in DB directly (only hash)
    const exactRaw = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: rawToken },
    });
    expect(exactRaw).toBeNull();

    // Verify record exists with hashed value
    const count = await prisma.passwordResetToken.count({
      where: { email: testEmail },
    });
    expect(count).toBe(1);
  });

  it("verifies a valid token without consuming it", async () => {
    const rawToken = await createPasswordResetToken(testEmail);
    const verified = await verifyPasswordResetToken(rawToken);

    expect(verified).not.toBeNull();
    expect(verified?.email).toBe(testEmail);

    // Token should still exist
    const count = await prisma.passwordResetToken.count({
      where: { email: testEmail },
    });
    expect(count).toBe(1);
  });

  it("consumes a token once and deletes it", async () => {
    const rawToken = await createPasswordResetToken(testEmail);

    // First consumption succeeds
    const consumed = await consumePasswordResetToken(rawToken);
    expect(consumed).not.toBeNull();
    expect(consumed?.email).toBe(testEmail);

    // Second consumption must fail (single-use guarantee)
    const secondTry = await consumePasswordResetToken(rawToken);
    expect(secondTry).toBeNull();

    // Token is deleted from database
    const count = await prisma.passwordResetToken.count({
      where: { email: testEmail },
    });
    expect(count).toBe(0);
  });

  it("rejects an invalid or non-existent token", async () => {
    const result = await verifyPasswordResetToken("non-existent-token-123");
    expect(result).toBeNull();

    const consumed = await consumePasswordResetToken("non-existent-token-123");
    expect(consumed).toBeNull();
  });

  it("rejects an expired token and cleans it up", async () => {
    const rawToken = await createPasswordResetToken(testEmail);

    // Force expiration in the past
    await prisma.passwordResetToken.updateMany({
      where: { email: testEmail },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const result = await verifyPasswordResetToken(rawToken);
    expect(result).toBeNull();
  });
});
