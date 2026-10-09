import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getBaseUrl } from "@/lib/env";
import {
  createPasswordResetToken,
  sendPasswordResetEmail,
} from "@/lib/auth/password-reset";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
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

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Please provide a valid email address." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase().trim();

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  // Always return success even if user not found to prevent email enumeration
  if (user && user.email) {
    try {
      const rawToken = await createPasswordResetToken(user.email);
      const resetUrl = `${getBaseUrl()}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (error) {
      console.error("[Forgot Password] Error generating reset token:", error);
    }
  }

  return NextResponse.json({
    success: true,
    message: "If an account exists with this email, a password reset link has been sent.",
  });
}
