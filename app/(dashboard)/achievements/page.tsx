"use client";

import { useEffect, useState } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import type {
  AchievementItem,
  AchievementSummary,
} from "@/lib/achievements/engine";
import {
  Trophy,
  Users,
  Target,
  Award,
  TrendingUp,
  Flame,
  Heart,
  Layers,
  CheckCircle2,
  Clock,
  Lock,
} from "lucide-react";

interface AchievementsResponse {
  account: { id: string; username: string };
  accounts: AccountOption[];
  currentFollowers: number;
  summary: AchievementSummary;
  achievements: AchievementItem[];
}

function getCategoryIcon(category: string, className = "h-4 w-4") {
  switch (category) {
    case "FOLLOWERS":
      return <Users className={className} />;
    case "REACH":
      return <Flame className={className} />;
    case "ENGAGEMENT":
      return <Heart className={className} />;
    case "CONTENT":
      return <Layers className={className} />;
    default:
      return <Trophy className={className} />;
  }
}

export default function AchievementsPage() {
  const [data, setData] = useState<AchievementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [activeFilter, setActiveFilter] = useState<
    "ALL" | "UNLOCKED" | "IN_PROGRESS" | "FOLLOWERS" | "REACH" | "ENGAGEMENT" | "CONTENT"
  >("ALL");

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedAccountId !== "all") {
      params.set("instagramAccountId", selectedAccountId);
    }

    setLoading(true);
    fetch(`/api/instagram/achievements${params.size ? `?${params}` : ""}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
          setError(null);
        } else {
          setError(res.error || "Failed to load achievements");
        }
      })
      .catch(() => setError("Failed to load achievements"))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="panel rounded p-4 h-24">
              <div className="h-4 w-16 bg-zinc-200 rounded" />
              <div className="mt-3 h-6 w-20 bg-zinc-200/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="panel rounded p-8 text-center border border-border">
        <p className="text-sm text-error">{error || "Failed to load achievements"}</p>
        <button
          onClick={() => setSelectedAccountId("all")}
          className="mt-4 inline-block text-xs text-accent hover:underline"
        >
          Try Reloading
        </button>
      </div>
    );
  }

  const { summary, achievements, account, accounts } = data;

  const filteredAchievements = achievements.filter((item) => {
    if (activeFilter === "UNLOCKED") return item.status === "UNLOCKED";
    if (activeFilter === "IN_PROGRESS") return item.status === "IN_PROGRESS";
    if (activeFilter === "FOLLOWERS") return item.category === "FOLLOWERS";
    if (activeFilter === "REACH") return item.category === "REACH";
    if (activeFilter === "ENGAGEMENT") return item.category === "ENGAGEMENT";
    if (activeFilter === "CONTENT") return item.category === "CONTENT";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-accent shrink-0" />
            <h1 className="text-lg font-semibold text-foreground">Achievements</h1>
          </div>
          <p className="text-sm text-muted mt-1">
            Audience milestones and performance records for @{account.username}
          </p>
        </div>

        {accounts && accounts.length > 1 && (
          <AccountSelect
            accounts={accounts}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
            includeAll={false}
          />
        )}
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="panel rounded p-4 border border-border bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Current Followers</span>
            <Users className="h-4 w-4 text-muted shrink-0" />
          </div>
          <p
            className="mt-2 text-2xl font-bold text-foreground"
            style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
          >
            {data.currentFollowers.toLocaleString()}
          </p>
        </div>

        <div className="panel rounded p-4 border border-border bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Milestones Reached</span>
            <Award className="h-4 w-4 text-success shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {summary.unlockedCount}{" "}
            <span className="text-sm font-normal text-muted">/ {summary.totalCount}</span>
          </p>
        </div>

        <div className="panel rounded p-4 border border-border bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Next Milestone</span>
            <Target className="h-4 w-4 text-accent shrink-0" />
          </div>
          <p
            className="mt-2 text-2xl font-bold text-accent"
            style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
          >
            {summary.nextFollowerMilestone?.target.toLocaleString() ?? "—"}
          </p>
        </div>

        <div className="panel rounded p-4 border border-border bg-white">
          <div className="flex items-center justify-between text-muted">
            <span className="text-xs font-semibold uppercase tracking-wider">Followers Remaining</span>
            <TrendingUp className="h-4 w-4 text-muted shrink-0" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {summary.nextFollowerMilestone?.remaining.toLocaleString() ?? "—"}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {(
          [
            { key: "ALL", label: `All (${achievements.length})` },
            { key: "UNLOCKED", label: `Achieved (${summary.unlockedCount})` },
            { key: "IN_PROGRESS", label: `In Progress (${summary.inProgressCount})` },
            { key: "FOLLOWERS", label: "Followers" },
            { key: "REACH", label: "Reach" },
            { key: "ENGAGEMENT", label: "Engagement" },
            { key: "CONTENT", label: "Posts" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`rounded px-3 py-1.5 text-xs font-medium transition ${
              activeFilter === key
                ? "bg-foreground text-background font-semibold"
                : "text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Milestones Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {filteredAchievements.map((item) => {
          const isUnlocked = item.status === "UNLOCKED";
          const isInProgress = item.status === "IN_PROGRESS";

          return (
            <div
              key={item.id}
              className="panel rounded p-4 sm:p-5 border border-border bg-white flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border ${
                        isUnlocked
                          ? "bg-success/5 border-success/20 text-success"
                          : isInProgress
                          ? "bg-accent/5 border-accent/20 text-accent"
                          : "bg-surface border-border text-muted"
                      }`}
                    >
                      {getCategoryIcon(item.category, "h-4 w-4")}
                    </div>
                    <div className="min-w-0 flex flex-col justify-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted leading-tight">
                        {item.category}
                      </span>
                      <h3 className="text-sm font-semibold text-foreground truncate leading-tight">
                        {item.title}
                      </h3>
                    </div>
                  </div>

                  {isUnlocked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success whitespace-nowrap shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Achieved
                    </span>
                  ) : isInProgress ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent whitespace-nowrap shrink-0">
                      <Clock className="h-3.5 w-3.5" />
                      In progress
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted whitespace-nowrap shrink-0">
                      <Lock className="h-3.5 w-3.5" />
                      Upcoming
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Progress or Completion status */}
              <div className="mt-4 pt-3 border-t border-border">
                {isUnlocked ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Award className="h-3.5 w-3.5 text-success shrink-0" />
                    <span>
                      {item.achievedDate ? `Verified on ${item.achievedDate}` : "Verified milestone"}
                    </span>
                  </div>
                ) : isInProgress ? (
                  <div className="space-y-1.5">
                    <div className="h-1.5 w-full bg-border rounded-xs overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all duration-500"
                        style={{ width: `${item.progressPercentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted">
                      <span>{item.current.toLocaleString()} / {item.target.toLocaleString()}</span>
                      <span className="font-medium text-foreground">{item.remaining.toLocaleString()} left</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Target: {item.target.toLocaleString()} {item.unit}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
