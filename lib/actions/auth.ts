"use server";

/**
 * Server actions for auth, callable from client components.
 *
 * The sidebar is a client component, so it cannot call Auth.js `signOut`
 * directly — that runs on the server. Exporting it as a server action lets the
 * sidebar submit a plain <form>, which also means sign out still works with
 * JavaScript disabled.
 */

import { signOut } from "@/lib/auth";

export async function signOutAction(): Promise<void> {
  // Throws NEXT_REDIRECT to send the user to /login, which is the intended
  // control flow for a server action and must not be caught here.
  await signOut({ redirectTo: "/login" });
}
