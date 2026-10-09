import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/db/client";

const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a single-use password reset token for the given email.
 * Stores only the SHA-256 hash in the database, returning the raw token to send via email.
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  // Invalidate any existing reset tokens for this email
  await prisma.passwordResetToken.deleteMany({
    where: { email: normalizedEmail },
  });

  await prisma.passwordResetToken.create({
    data: {
      email: normalizedEmail,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

/**
 * Verifies if a reset token is valid and not expired without consuming it.
 */
export async function verifyPasswordResetToken(
  token: string
): Promise<{ email: string } | null> {
  if (!token || typeof token !== "string") return null;

  const tokenHash = hashToken(token.trim());
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record) return null;
  if (record.expiresAt < new Date()) {
    // Clean up expired token
    await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    return null;
  }

  return { email: record.email };
}

/**
 * Validates and consumes the token in one operation.
 * Returns the associated email if valid, or null if invalid/expired.
 */
export async function consumePasswordResetToken(
  token: string
): Promise<{ email: string } | null> {
  if (!token || typeof token !== "string") return null;

  const tokenHash = hashToken(token.trim());
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.expiresAt < new Date()) {
    if (record) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    }
    return null;
  }

  // Delete the token so it cannot be reused
  await prisma.passwordResetToken.delete({
    where: { id: record.id },
  });

  return { email: record.email };
}

/**
 * Sends a password reset email using Resend.
 * In development or if Resend fails, logs the reset URL to the server console.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "OpenReply <login@example.com>";

  console.log(`[Password Reset] Link for ${email}: ${resetUrl}`);

  if (!apiKey || apiKey === "missing-resend-api-key") {
    console.warn(
      "[Password Reset] RESEND_API_KEY not configured. Reset link printed to console above."
    );
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0d0e; color: #f4f4f5; padding: 40px 20px; }
          .container { max-width: 520px; margin: 0 auto; background: #18191b; border: 1px solid #27272a; border-radius: 8px; padding: 32px; }
          .logo { font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 24px; }
          h1 { font-size: 20px; font-weight: 600; color: #ffffff; margin: 0 0 16px; }
          p { font-size: 14px; line-height: 22px; color: #a1a1aa; margin: 0 0 24px; }
          .btn { display: inline-block; background-color: #f97316; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; padding: 12px 24px; border-radius: 6px; }
          .footer { font-size: 12px; color: #71717a; margin-top: 32px; border-top: 1px solid #27272a; pt: 16px; word-break: break-all; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">OpenReply</div>
          <h1>Reset your password</h1>
          <p>We received a request to reset the password for your OpenReply account. Click the button below to choose a new password:</p>
          <p><a href="${resetUrl}" class="btn">Reset Password</a></p>
          <p>This link is valid for 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
          <div class="footer">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${resetUrl}" style="color: #f97316;">${resetUrl}</a>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Reset your OpenReply password",
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Password Reset] Resend API error:", err);
    }
  } catch (error) {
    console.error("[Password Reset] Failed to send email via Resend:", error);
  }
}
