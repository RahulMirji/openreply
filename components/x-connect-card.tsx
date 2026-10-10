"use client";

import { useEffect, useState } from "react";

interface XAccountStatus {
  isConnected: boolean;
  username?: string;
  name?: string;
  source?: string;
}

interface XConnectCardProps {
  onAccountChange?: (connected: boolean) => void;
}

export default function XConnectCard({ onAccountChange }: XConnectCardProps) {
  const [account, setAccount] = useState<XAccountStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [apiKey, setApiKey] = useState("");
  const [apiKeySecret, setApiKeySecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [accessTokenSecret, setAccessTokenSecret] = useState("");

  useEffect(() => {
    fetch("/api/x/account")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setAccount(res.data);
          onAccountChange?.(res.data.isConnected);
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [onAccountChange]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/x/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          apiKeySecret: apiKeySecret.trim(),
          accessToken: accessToken.trim(),
          accessTokenSecret: accessTokenSecret.trim(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to verify X API keys.");
      } else {
        setAccount(data.data);
        setSuccess(`Successfully connected as @${data.data.username}!`);
        setIsOpen(false);
        onAccountChange?.(true);
        // Clear sensitive inputs
        setApiKey("");
        setApiKeySecret("");
        setAccessToken("");
        setAccessTokenSecret("");
      }
    } catch {
      setError("Network error while connecting X account.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect this X account?")) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/x/account", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setAccount({ isConnected: false });
        onAccountChange?.(false);
      } else {
        setError(data.error || "Failed to disconnect");
      }
    } catch {
      setError("Failed to disconnect");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="h-16 panel rounded" />;
  }

  if (account?.isConnected) {
    return (
      <div className="panel rounded p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-background text-foreground font-bold text-xs">
            𝕏
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                @{account.username}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-success inline-block" />
                Connected
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Direct publishing active via X Free API tier
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={handleDisconnect}
          className="rounded border border-error/20 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/10 disabled:opacity-50 transition-colors shrink-0"
        >
          {busy ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div className="panel rounded p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-background text-foreground font-bold text-xs">
            𝕏
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Connect X Account
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              Connect your free API keys from developer.x.com to publish directly with 1 click.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded border border-border px-3.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover transition-colors shrink-0"
        >
          {isOpen ? "Close Setup" : "Add Free X API Keys"}
        </button>
      </div>

      {success && (
        <div className="mt-3 rounded border border-border bg-surface p-3 text-xs text-success">
          {success}
        </div>
      )}

      {error && (
        <div className="mt-3 rounded border border-error/20 bg-surface p-3 text-xs text-error">
          {error}
        </div>
      )}

      {isOpen && (
        <div className="mt-4 border-t border-border pt-4 space-y-4">
          <div className="rounded border border-border bg-background p-3.5 text-xs text-muted leading-relaxed">
            <p className="font-semibold text-foreground mb-1.5">
              How to retrieve your 4 API keys from developer.x.com:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted">
              <li>Open your project app in the X Developer Portal.</li>
              <li>Navigate to the <strong>Keys and Tokens</strong> tab.</li>
              <li>Under <strong>OAuth 1.0a User Context</strong>, generate your Consumer Keys and Access Tokens.</li>
              <li>Ensure your User authentication settings have <strong>Read and Write</strong> permissions enabled.</li>
            </ol>
          </div>

          <form onSubmit={handleConnect} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                API Key (Consumer Key)
              </label>
              <input
                type="password"
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste API Key..."
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                API Key Secret (Consumer Secret)
              </label>
              <input
                type="password"
                required
                value={apiKeySecret}
                onChange={(e) => setApiKeySecret(e.target.value)}
                placeholder="Paste API Key Secret..."
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Access Token
              </label>
              <input
                type="password"
                required
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Paste Access Token..."
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Access Token Secret
              </label>
              <input
                type="password"
                required
                value={accessTokenSecret}
                onChange={(e) => setAccessTokenSecret(e.target.value)}
                placeholder="Paste Access Token Secret..."
                className="w-full rounded border border-border bg-background px-3 py-1.5 text-xs text-foreground outline-none focus:border-accent font-mono"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-accent px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                {busy ? "Verifying..." : "Save & Verify Connection"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
