"use client";

import { useEffect, useState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";

const inputClass =
  "w-full px-4 py-3 rounded bg-surface border border-border text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none transition-colors";

export function PasswordSettings() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [message, setMessage] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/account/password")
      .then((r) => r.json())
      .then((json) => {
        if (active && json?.success) setHasPassword(Boolean(json.data.hasPassword));
      })
      .catch(() => {
        if (active) setHasPassword(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setMessage({ kind: "error", text: "The two passwords do not match." });
      return;
    }

    setStatus("saving");
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      });
      const json = await response.json();

      if (!response.ok || !json?.success) {
        setMessage({
          kind: "error",
          text: json?.error ?? "Could not update the password.",
        });
        return;
      }

      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage({
        kind: "success",
        text: "Password saved. You can now sign in with your email and password.",
      });
    } catch {
      setMessage({ kind: "error", text: "Network error. Please try again." });
    } finally {
      setStatus("idle");
    }
  }

  return (
    <section className="panel rounded p-4 sm:p-6">
      <h2 className="text-base font-semibold mb-6">Password</h2>

      <p className="text-sm text-muted mb-5">
        {hasPassword
          ? "Change the password you use to sign in. Magic-link sign in keeps working either way."
          : "Set a password so you can sign in without waiting for an email. Magic links keep working too."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {hasPassword && (
          <div className="space-y-2">
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-foreground"
            >
              Current password
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="newPassword"
            className="block text-sm font-medium text-foreground"
          >
            {hasPassword ? "New password" : "Password"}
          </label>
          <input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
          <p className="text-xs text-muted">
            At least {MIN_PASSWORD_LENGTH} characters.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-foreground"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={
              message.kind === "error"
                ? "text-sm text-red-400"
                : "text-sm text-emerald-400"
            }
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3 text-sm font-semibold text-white transition-all disabled:opacity-60"
        >
          {status === "saving"
            ? "Saving..."
            : hasPassword
              ? "Change password"
              : "Set password"}
        </button>
      </form>
    </section>
  );
}
