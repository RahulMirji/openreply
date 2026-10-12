"use client";

/**
 * Sidebar Navigation
 *
 * Text-only nav with active state and workspace section.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/lib/actions/auth";
import OpenReplyLogo from "@/components/openreply-logo";
import {
  LayoutDashboard,
  BarChart3,
  Trophy,
  Inbox,
  Megaphone,
  Share2,
  ScrollText,
  Settings,
  Activity,
  LogOut,
  Sparkles,
} from "lucide-react";

/**
 * Split out so it can read useFormStatus, which only reports the status of a
 * parent <form>.
 */
function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-sm font-medium text-muted hover:text-foreground hover:bg-surface-hover disabled:opacity-60 transition-colors"
    >
      <LogOut className="h-4 w-4 shrink-0 text-muted" />
      <span>{pending ? "Logging out..." : "Logout"}</span>
    </button>
  );
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Overview", href: "/overview", icon: BarChart3 },
  { label: "AI Chat", href: "/chat", icon: Sparkles, badge: "AI" },
  { label: "Cross Posting", href: "/crosspost", icon: Share2 },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Inbox", href: "/inbox", icon: Inbox },
  { label: "Achievements", href: "/achievements", icon: Trophy },
  { label: "DM Logs", href: "/logs", icon: ScrollText },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Diagnostics", href: "/diagnostics", icon: Activity },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
}

export default function Sidebar({
  isOpen,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-dvh w-64 max-w-[85vw] shrink-0 bg-surface border-r border-border flex flex-col
          transition-transform duration-200 ease-out
          lg:h-full lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="px-6 py-5 border-b border-border">
          <Link href="/dashboard" className="text-base font-semibold flex items-center gap-2.5">
            <OpenReplyLogo className="h-6 w-6 shrink-0" />
            <span>OpenReply</span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors
                  ${
                    isActive
                      ? "bg-surface-hover text-foreground font-medium"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }
                `}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${
                    isActive ? "text-accent" : "text-muted"
                  }`}
                />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && (
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-border">
          <form action={signOutAction}>
            <SignOutButton />
          </form>
        </div>
      </aside>
    </>
  );
}
