"use client";

import Link from "next/link";

interface FollowerHeroCardProps {
  followers: number | null;
  username?: string;
  netChange?: number | null;
  daysCount?: number;
}

function getNextMilestone(current: number) {
  const milestones = [
    { target: 100, label: "100" },
    { target: 500, label: "500" },
    { target: 1_000, label: "1,000" },
    { target: 2_500, label: "2,500" },
    { target: 5_000, label: "5,000" },
    { target: 10_000, label: "10,000" },
    { target: 25_000, label: "25,000" },
    { target: 50_000, label: "50,000" },
    { target: 100_000, label: "100,000" },
    { target: 250_000, label: "250,000" },
    { target: 500_000, label: "500,000" },
    { target: 1_000_000, label: "1,000,000" },
  ];

  const next = milestones.find((m) => m.target > current) || milestones[milestones.length - 1];
  const percentage = Math.min(100, parseFloat(((current / next.target) * 100).toFixed(1)));
  const remaining = Math.max(0, next.target - current);

  return {
    nextTarget: next.target,
    nextLabel: next.label,
    percentage,
    remaining,
  };
}

export default function FollowerHeroCard({
  followers,
  username,
  netChange,
  daysCount = 30,
}: FollowerHeroCardProps) {
  if (followers === null || followers === undefined) {
    return null;
  }

  const milestone = getNextMilestone(followers);

  return (
    <div className="border border-border bg-white rounded p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:divide-x md:divide-border">
        {/* Left Column: Followers Count */}
        <div className="flex flex-col justify-between space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
            <span>FOLLOWERS</span>
            {username && (
              <>
                <span className="text-zinc-300 font-normal">|</span>
                <span className="lowercase font-normal tracking-normal text-muted">
                  @{username}
                </span>
              </>
            )}
          </div>

          <div
            className="text-4xl sm:text-5xl font-black tracking-tight text-foreground"
            style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
          >
            {followers.toLocaleString()}
          </div>

          {netChange !== null && netChange !== undefined ? (
            <div className="flex items-center gap-1.5 text-xs text-muted pt-1">
              <span className="text-success font-semibold flex items-center gap-1">
                <svg
                  className="h-3.5 w-3.5 stroke-[2.5]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25"
                  />
                </svg>
                {netChange >= 0 ? `+${netChange.toLocaleString()}` : netChange.toLocaleString()}
              </span>
              <span>in the last {daysCount} days</span>
            </div>
          ) : (
            <div className="h-4" />
          )}
        </div>

        {/* Right Column: Next Milestone Progress */}
        <div className="flex flex-col justify-between space-y-2.5 md:pl-8">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-surface text-muted border border-border w-fit">
            <svg
              className="h-3.5 w-3.5 text-accent shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
            <span>Next milestone</span>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              {milestone.nextLabel} followers
            </span>
            <span className="text-xl sm:text-2xl font-bold text-accent font-sans">
              {milestone.percentage}%
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full bg-border rounded overflow-hidden">
            <div
              className="h-full bg-accent rounded transition-all duration-300"
              style={{ width: `${milestone.percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-muted">
              {milestone.remaining.toLocaleString()} followers to go
            </span>
            <Link
              href="/achievements"
              className="text-accent font-medium hover:underline flex items-center gap-0.5"
            >
              View milestones →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
