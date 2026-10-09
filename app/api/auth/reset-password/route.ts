import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { validatePassword } from "@/lib/auth/password-policy";
import { consumePasswordResetToken } from "@/lib/auth/password-reset";
import { clearFailedLogins } from "@/lib/auth/login-throttle";

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Missing required token or password." },
      { status: 400 }
    );
  }

  const { token, newPassword } = parsed.data;

  // Validate password strength according to OpenReply policy
  const policyError = validatePassword(newPassword);
  if (policyError) {
    return NextResponse.json(
      { success: false, error: policyError },
      { status: 400 }
    );
  }

  // Validate and consume the single-use token
  const tokenResult = await consumePasswordResetToken(token);
  if (!tokenResult || !tokenResult.email) {
    return NextResponse.json(
      {
        success: false,
        error: "This password reset link is invalid or has expired. Please request a new one.",
      },
      { status: 400 }
    );
  }

  const email = tokenResult.email;

  // Ensure user exists
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Account not found." },
      { status: 404 }
    );
  }

  // Update passwordHash
  const newPasswordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newPasswordHash },
  });

  // Clear any failed login throttle counts
  await clearFailedLogins(email);

  return NextResponse.json({
    success: true,
    message: "Your password has been reset successfully. You can now sign in.",
  });
}
