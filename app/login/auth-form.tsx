"use client";

import { useState } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/password-input";
import { signInAction, registerAction } from "@/lib/actions/auth";

interface AuthFormProps {
  callbackUrl: string;
  initialMode?: "signin" | "signup";
  initialError?: string | null;
}

const inputClass =
  "w-full px-4 py-3 rounded bg-surface border border-border text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none transition-colors";

export function AuthForm({
  callbackUrl,
  initialMode = "signin",
  initialError = null,
}: AuthFormProps) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  function switchMode(newMode: "signin" | "signup") {
    setMode(newMode);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      if (mode === "signin") {
        const result = await signInAction(formData, callbackUrl);
        if (result?.error) {
          setError(result.error);
          setLoading(false);
        }
      } else {
        const password = String(formData.get("password") ?? "");
        const confirmPassword = String(formData.get("confirmPassword") ?? "");

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setLoading(false);
          return;
        }

        const result = await registerAction(formData, callbackUrl);
        if (result?.error) {
          setError(result.error);
          setLoading(false);
        }
      }
    } catch (err) {
      // Re-throw redirect errors (NEXT_REDIRECT) so Next.js router handles page transition
      if (err instanceof Error && err.message === "NEXT_REDIRECT") {
        throw err;
      }
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Tabs for Sign In vs Create Account */}
      <div className="flex border-b border-border mb-6">
        <button
          type="button"
          onClick={() => switchMode("signin")}
          className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
            mode === "signin"
              ? "border-accent text-foreground font-semibold"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => switchMode("signup")}
          className={`flex-1 pb-3 text-sm font-medium border-b-2 transition-colors ${
            mode === "signup"
              ? "border-accent text-foreground font-semibold"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Create Account
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground"
          >
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            className={inputClass}
          />
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              Password
            </label>
            {mode === "signin" && (
              <Link
                href="/forgot-password"
                className="text-xs text-muted hover:text-foreground hover:underline transition-colors"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            name="password"
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="••••••••"
          />
          {mode === "signup" && (
            <p className="text-xs text-muted">
              Must be at least 8 characters long.
            </p>
          )}
        </div>

        {/* Confirm Password Field (Registration only) */}
        {mode === "signup" && (
          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-foreground"
            >
              Confirm password
            </label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              autoComplete="new-password"
              placeholder="••••••••"
            />
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3.5 text-sm font-semibold text-white hover:bg-accent/90 transition-all disabled:opacity-60"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {mode === "signin" ? "Signing in..." : "Creating account..."}
            </span>
          ) : mode === "signin" ? (
            "Sign In"
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      {/* Footer Switcher */}
      <div className="mt-5 border-t border-border pt-4 text-center">
        {mode === "signin" ? (
          <div>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="text-xs text-muted hover:text-foreground underline transition-colors"
            >
              Register if you haven&apos;t already
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-xs text-muted hover:text-foreground underline transition-colors"
            >
              Already have an account? Sign in instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
