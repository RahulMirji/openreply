"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AccountOption } from "@/components/account-select";
import { InstagramConnectNotice } from "@/components/instagram-connect-notice";
import { PasswordSettings } from "@/components/password-settings";
import {
  User,
  Share2,
  Users,
  KeyRound,
  BarChart3,
} from "lucide-react";

interface SettingsData {
  workspace: {
    name: string;
    dmsSentThisPeriod: number;
  };
  instagramAccount: {
    id: string;
    username: string;
    instagramId: string;
    tokenExpiresAt: string | null;
    webhookSubscribed: boolean;
  } | null;
  instagramAccounts: Array<
    AccountOption & {
      tokenExpiresAt: string | null;
      webhookSubscribed: boolean;
    }
  >;
}

interface WorkspaceMembersData {
  currentUserRole: "OWNER" | "ADMIN" | "MEMBER";
  members: Array<{
    id: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    createdAt: string;
    user: {
      id: string;
      email: string | null;
      name: string | null;
      image: string | null;
    };
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    inviteUrl: string;
    expiresAt: string;
  }>;
}

interface UserProfileData {
  name: string | null;
  email: string | null;
  image: string | null;
}

type SettingsTab = "profile" | "instagram" | "team" | "security" | "usage";

const TABS: Array<{
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "instagram", label: "Instagram Accounts", icon: Share2 },
  { id: "team", label: "Team & Members", icon: Users },
  { id: "security", label: "Password & Security", icon: KeyRound },
  { id: "usage", label: "Usage & Limits", icon: BarChart3 },
];

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const requestedTab = searchParams.get("tab") as SettingsTab | null;
  const initialTab: SettingsTab = searchParams.get("instagram")
    ? "instagram"
    : requestedTab && TABS.some((t) => t.id === requestedTab)
    ? requestedTab
    : "profile";

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [data, setData] = useState<SettingsData | null>(null);
  const [membersData, setMembersData] = useState<WorkspaceMembersData | null>(
    null
  );
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [memberError, setMemberError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((res) => res.json()),
      fetch("/api/workspace/members").then((res) => res.json()),
      fetch("/api/user/profile").then((res) => res.json()),
    ])
      .then(([statsPayload, membersPayload, profilePayload]) => {
        if (statsPayload.success) setData(statsPayload.data);
        if (membersPayload.success) setMembersData(membersPayload.data);
        if (profilePayload.success && profilePayload.data) {
          setUserProfile(profilePayload.data);
          setNameInput(profilePayload.data.name ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function handleTabChange(tabId: SettingsTab) {
    setActiveTab(tabId);
    router.replace(`/settings?tab=${tabId}`);
  }

  async function handleSaveName(event: React.FormEvent) {
    event.preventDefault();
    setSavingName(true);
    setNameSuccess(false);
    setNameError(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput }),
      });
      const payload = await res.json();
      if (payload.success) {
        setUserProfile((prev) => ({
          ...prev,
          name: payload.data.name,
          email: payload.data.email ?? prev?.email ?? null,
          image: payload.data.image ?? prev?.image ?? null,
        }));
        setNameSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        setNameError(payload.error ?? "Failed to update name");
      }
    } catch {
      setNameError("Failed to update name");
    } finally {
      setSavingName(false);
    }
  }

  async function refreshMembers() {
    const res = await fetch("/api/workspace/members");
    const payload = await res.json();
    if (payload.success) setMembersData(payload.data);
  }

  async function disconnectInstagram(instagramAccountId: string) {
    if (
      !confirm("Disconnect Instagram? Campaigns for this account will stop sending DMs.")
    ) {
      return;
    }

    setBusy(`disconnect:${instagramAccountId}`);
    await fetch("/api/instagram/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramAccountId }),
    });
    window.location.reload();
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    setMemberError(null);
    setBusy("invite");
    const res = await fetch("/api/workspace/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    const payload = await res.json();
    if (payload.success) {
      setMembersData(payload.data);
      setInviteEmail("");
    } else {
      setMemberError(payload.error ?? "Could not invite member");
    }
    setBusy(null);
  }

  async function removeInvitation(invitationId: string) {
    setBusy(`invite:${invitationId}`);
    await fetch("/api/workspace/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationId }),
    });
    await refreshMembers();
    setBusy(null);
  }

  if (loading) {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="h-8 w-40 bg-zinc-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] gap-6">
          <div className="panel rounded p-4 h-48 animate-pulse" />
          <div className="panel rounded p-8 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  const accounts = data?.instagramAccounts ?? [];
  const canManageMembers =
    membersData?.currentUserRole === "OWNER" ||
    membersData?.currentUserRole === "ADMIN";

  return (
    <div className="max-w-3xl space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage your account profile, team access, connected platforms, and security.
        </p>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-[190px_1fr] gap-6 lg:gap-8 items-start">
        {/* Left Sub-Navigation */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none shrink-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors whitespace-nowrap text-left ${
                  isActive
                    ? "bg-surface-hover text-foreground font-semibold"
                    : "text-muted hover:text-foreground hover:bg-surface-hover/60"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? "text-accent" : "text-muted"
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Content Panel */}
        <div className="min-w-0 max-w-xl w-full space-y-6">
          {/* OAuth Redirect Notice */}
          <Suspense fallback={null}>
            <InstagramConnectNotice />
          </Suspense>

          {/* Tab 1: Profile */}
          {activeTab === "profile" && (
            <section className="panel rounded p-5 sm:p-6 border border-border bg-white">
              <div className="mb-6">
                <h2 className="text-base font-semibold text-foreground">User Profile</h2>
                <p className="text-xs text-muted mt-1">
                  Update your display name and view your connected profile photo.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-border">
                {userProfile?.image ? (
                  <img
                    src={userProfile.image}
                    alt={userProfile.name || "Profile"}
                    className="h-16 w-16 rounded-full border border-border object-cover shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface-hover border border-border text-lg font-bold text-foreground">
                    {(nameInput || userProfile?.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {accounts.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                        <span className="h-2 w-2 rounded-full bg-success inline-block" />
                        Profile photo synced with @{accounts[0].username}
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Profile photo</span>
                    )}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Your photo and display name appear in the top navigation and sidebar.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveName} className="mt-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">
                    Your Name
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Enter your name (e.g. Rahul Mirji)"
                      className="flex-1 rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
                      maxLength={100}
                    />
                    <button
                      type="submit"
                      disabled={savingName}
                      className="rounded bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 shrink-0"
                    >
                      {savingName ? "Saving..." : "Save Name"}
                    </button>
                  </div>
                  {nameSuccess && (
                    <p className="text-xs text-success mt-2">
                      Name updated successfully!
                    </p>
                  )}
                  {nameError && (
                    <p className="text-xs text-error mt-2">{nameError}</p>
                  )}
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                    Account Email
                  </label>
                  <p className="text-sm text-muted">{userProfile?.email ?? "—"}</p>
                </div>
              </form>
            </section>
          )}

          {/* Tab 2: Instagram Accounts */}
          {activeTab === "instagram" && (
            <section className="panel rounded p-5 sm:p-6 border border-border bg-white">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Instagram Connection
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    Comment webhooks and private replies depend on this connection.
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                    accounts.length > 0
                      ? "bg-success/10 text-success"
                      : "bg-warning/10 text-warning"
                  }`}
                >
                  {accounts.length > 0 ? "Connected" : "Not connected"}
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  {accounts.length === 0 && (
                    <p className="text-sm text-muted">
                      Connect an Instagram professional account to launch campaigns.
                    </p>
                  )}
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex flex-col gap-3 rounded border border-border bg-surface/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {userProfile?.image ? (
                          <img
                            src={userProfile.image}
                            alt={account.username}
                            className="h-10 w-10 rounded-full border border-border object-cover shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-hover border border-border text-xs font-semibold text-foreground">
                            {account.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            @{account.username}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            Token expires{" "}
                            {account.tokenExpiresAt
                              ? new Date(account.tokenExpiresAt).toLocaleDateString()
                              : "not available"}{" "}
                            ·{" "}
                            {account.webhookSubscribed
                              ? "Webhook ready"
                              : "Webhook pending"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => disconnectInstagram(account.id)}
                        disabled={busy === `disconnect:${account.id}`}
                        className="inline-flex items-center justify-center rounded border border-error/20 px-3.5 py-1.5 text-xs font-medium text-error transition-all hover:border-error/40 hover:bg-error/10 disabled:opacity-50 shrink-0"
                      >
                        {busy === `disconnect:${account.id}`
                          ? "Disconnecting..."
                          : "Disconnect"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex gap-3">
                <a
                  href="/api/instagram/connect"
                  className="px-4 py-2 rounded text-sm font-medium transition-colors bg-accent text-white hover:bg-accent-hover"
                >
                  {accounts.length > 0
                    ? "Connect another account"
                    : "Connect Instagram"}
                </a>
              </div>
            </section>
          )}

          {/* Tab 3: Team */}
          {activeTab === "team" && (
            <section className="panel rounded p-5 sm:p-6 border border-border bg-white">
              <div className="mb-6">
                <h2 className="text-base font-semibold text-foreground">
                  Team Members
                </h2>
                <p className="text-xs text-muted mt-1">
                  Manage agency workspace teammates and permissions.
                </p>
              </div>

              <div className="space-y-3">
                {membersData?.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {member.user.image ? (
                        <img
                          src={member.user.image}
                          alt={member.user.name || member.user.email || "Member"}
                          className="h-8 w-8 rounded-full border border-border object-cover shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover border border-border text-xs font-semibold text-foreground">
                          {(member.user.name || member.user.email || "M").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {member.user.name ?? member.user.email ?? "Unknown member"}
                        </p>
                        <p className="text-xs text-muted truncate">{member.user.email}</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted shrink-0">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>

              {membersData?.invitations.length ? (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Pending invites
                  </p>
                  <div className="space-y-3">
                    {membersData.invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex flex-col gap-3 rounded border border-border bg-surface/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {invitation.email}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {invitation.role} · {invitation.inviteUrl}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void navigator.clipboard?.writeText(invitation.inviteUrl)
                            }
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-border-hover hover:text-foreground"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => removeInvitation(invitation.id)}
                            disabled={busy === `invite:${invitation.id}`}
                            className="rounded-lg border border-error/20 px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {canManageMembers && (
                <form
                  onSubmit={inviteMember}
                  className="mt-6 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1fr_140px_auto]"
                >
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="teammate@agency.com"
                    className="rounded border border-border bg-surface px-4 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
                    required
                  />
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(event.target.value as "ADMIN" | "MEMBER")
                    }
                    className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent/40"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <button
                    type="submit"
                    disabled={busy === "invite"}
                    className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {busy === "invite" ? "Inviting..." : "Invite"}
                  </button>
                  {memberError && (
                    <p className="sm:col-span-3 text-sm text-error">{memberError}</p>
                  )}
                </form>
              )}
            </section>
          )}

          {/* Tab 4: Security */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <PasswordSettings />
            </div>
          )}

          {/* Tab 5: Usage */}
          {activeTab === "usage" && (
            <section className="panel rounded p-5 sm:p-6 border border-border bg-white">
              <div className="mb-6">
                <h2 className="text-base font-semibold text-foreground">
                  Usage & Limits
                </h2>
                <p className="text-xs text-muted mt-1">
                  Monitor your monthly automation activity and capacity.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 py-3 border-b border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    DMs sent this month
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Self-hosted instance — no hard tier limits.
                  </p>
                </div>
                <span className="text-xl font-bold text-foreground">
                  {data?.workspace.dmsSentThisPeriod ?? 0}
                </span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="panel rounded p-8 h-64" />}>
      <SettingsContent />
    </Suspense>
  );
}
