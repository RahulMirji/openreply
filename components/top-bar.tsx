"use client";

/**
 * Top Bar
 *
 * Page title, mobile hamburger, and connection status.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import OpenReplyLogo from "@/components/openreply-logo";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/campaigns": "Campaigns",
  "/campaigns/new": "New Campaign",
  "/automations": "Campaigns",
  "/automations/new": "New Campaign",
  "/logs": "DM Logs",
  "/settings": "Settings",
  "/diagnostics": "Diagnostics",
  "/overview": "Overview",
  "/achievements": "Achievements",
  "/crosspost": "Cross Posting",
  "/inbox": "Inbox",
};

interface TopBarProps {
  onMenuClick: () => void;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  instagramUsername: string | null;
  instagramAccountCount: number;
}

export default function TopBar({
  onMenuClick,
  userName,
  userEmail,
  userImage,
  instagramUsername,
  instagramAccountCount,
}: TopBarProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "Dashboard";
  const displayName = userName?.trim() || userEmail?.split("@")[0] || "User";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 h-16 px-4 lg:px-8 border-b border-border bg-background">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden shrink-0 px-2.5 py-1.5 rounded border border-border text-sm text-muted hover:text-foreground"
          aria-label="Toggle sidebar"
        >
          Menu
        </button>
        <Link href="/dashboard" className="lg:hidden shrink-0 flex items-center" aria-label="OpenReply Home">
          <OpenReplyLogo className="h-6 w-6" />
        </Link>
        <h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {instagramAccountCount === 0 && (
          <a
            href="/api/instagram/connect"
            className="shrink-0 whitespace-nowrap text-xs sm:text-sm font-medium px-2.5 sm:px-3 py-1.5 rounded bg-accent text-white hover:bg-accent-hover"
          >
            <span className="sm:hidden">Connect</span>
            <span className="hidden sm:inline">Connect Instagram</span>
          </a>
        )}

        <Link
          href="/settings"
          className="flex items-center gap-2.5 rounded px-2 py-1.5 transition-colors hover:bg-surface-hover"
          title="Account Settings"
        >
          {userImage ? (
            <img
              src={userImage}
              alt={displayName}
              className="h-8 w-8 rounded-full border border-border object-cover shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-hover border border-border text-xs font-semibold text-foreground">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate text-sm font-medium text-foreground max-w-[120px] sm:max-w-[180px]">
            {displayName}
          </span>
        </Link>
      </div>
    </header>
  );
}
