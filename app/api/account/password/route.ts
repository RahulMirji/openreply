import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { validatePassword } from "@/lib/auth/password-policy";

/**
 * Set or change the signed-in user's password.
 *
 * Two cases:
 *  - No password yet (magic-link only account): the active session is the proof
 *    of identity, so `currentPassword` is not required.
 *  - Password already set: `currentPassword` must be supplied and verified, so a
 *    hijacked session cannot silently lock the owner out by changing it.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Not signed in" },
      { status: 401 }
    );
  }

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";

  const strengthError = validatePassword(newPassword);
  if (strengthError) {
    return NextResponse.json(
      { success: false, error: strengthError },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Account not found" },
      { status: 404 }
    );
  }

  if (user.passwordHash) {
    if (!currentPassword) {
      return NextResponse.json(
        { success: false, error: "Enter your current password to change it." },
        { status: 400 }
      );
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect." },
        { status: 400 }
      );
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({
    success: true,
    data: { hasPassword: true },
  });
}

/** Whether the signed-in account already has a password, for the settings UI. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: "Not signed in" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  return NextResponse.json({
    success: true,
    data: { hasPassword: Boolean(user?.passwordHash) },
  });
}
