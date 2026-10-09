"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { PasswordInput } from "@/components/password-input";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-400">
          Invalid or missing reset token. Please request a new password reset link.
        </div>
        <div className="pt-2">
          <Link
            href="/forgot-password"
            className="inline-block w-full py-3 rounded bg-accent text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Failed to reset password. The link may have expired.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Password Reset Complete
        </h2>
        <p className="text-sm text-muted leading-relaxed">
          Your password has been updated. You can now sign in to your OpenReply account.
        </p>
        <div className="pt-4">
          <Link
            href="/login"
            className="inline-block w-full py-3 rounded bg-accent text-sm font-semibold text-white hover:bg-accent-hover transition-colors text-center"
          >
            Sign in with New Password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">
          New Password
        </label>
        <PasswordInput
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-2">
          Confirm Password
        </label>
        <PasswordInput
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your new password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded bg-accent text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {loading ? "Updating password…" : "Reset Password"}
      </button>

      <div className="text-center pt-2">
        <Link
          href="/login"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          ← Cancel and back to sign in
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/login" className="inline-block">
            <h1 className="text-2xl font-semibold text-foreground">OpenReply</h1>
          </Link>
          <p className="text-muted text-sm leading-relaxed mt-2">
            Create a new password for your account
          </p>
        </div>

        <div className="panel rounded p-8 shadow-black/40">
          <Suspense
            fallback={
              <div className="py-8 text-center text-sm text-muted">
                Loading…
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
