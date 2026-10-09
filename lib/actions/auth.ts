"use server";

/**
 * Server actions for auth, callable from client components.
 */

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { hashPassword, validatePassword } from "@/lib/auth/password";
import { ensureWorkspaceForUser } from "@/lib/workspace";

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function signInAction(
  formData: FormData,
  callbackUrl = "/dashboard"
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter both your email and password." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: "That email and password combination did not work.",
      };
    }
    // NEXT_REDIRECT is thrown by redirect() inside signIn; must rethrow
    throw error;
  }

  return {};
}

export async function registerAction(
  formData: FormData,
  callbackUrl = "/dashboard"
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email) {
    return { error: "Please enter your email address." };
  }
  if (!password) {
    return { error: "Please enter a password." };
  }
  if (!confirmPassword) {
    return { error: "Please confirm your password." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const validationError = validatePassword(password);
  if (validationError) {
    return { error: validationError };
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (existingUser && existingUser.passwordHash) {
    return {
      error: "An account with this email already exists. Please sign in instead.",
    };
  }

  const passwordHash = await hashPassword(password);

  let userId: string;
  if (existingUser && !existingUser.passwordHash) {
    // Existing user record (e.g. from prior magic-link or invite), set their password
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { passwordHash },
    });
    userId = existingUser.id;
  } else {
    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
      select: { id: true },
    });
    userId = newUser.id;
  }

  // Ensure primary workspace is created
  await ensureWorkspaceForUser(userId, email);

  // Automatically sign in the user
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but automatic sign-in failed. Please sign in." };
    }
    throw error;
  }

  return {};
}
