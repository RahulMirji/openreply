/**
 * Achievements & Milestones Engine for OpenReply
 *
 * Tracks creator achievements, unlocks historical dates from FollowerSnapshot,
 * and computes real-time progress towards upcoming milestones.
 */

export type AchievementTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND" | "LEGEND";
export type AchievementCategory = "FOLLOWERS" | "REACH" | "ENGAGEMENT" | "CONTENT";
export type AchievementStatus = "UNLOCKED" | "IN_PROGRESS" | "LOCKED";

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: string;
  target: number;
  current: number;
  status: AchievementStatus;
  progressPercentage: number;
  remaining: number;
  achievedDate: string | null;
  unit: string;
}

export interface AchievementSummary {
  totalCount: number;
  unlockedCount: number;
  inProgressCount: number;
  lockedCount: number;
  completionPercentage: number;
  currentFollowers: number;
  nextFollowerMilestone: AchievementItem | null;
}

interface RawHistorySnapshot {
  date: Date | string;
  followersCount: number;
}

interface MetricTotals {
  posts: number;
  views: number | null;
  reach: number | null;
  likes: number;
  comments: number;
  saved: number | null;
  shares: number | null;
}

/**
 * Follower milestone definitions
 */
const FOLLOWER_TARGETS: Array<{
  target: number;
  title: string;
  desc: string;
  tier: AchievementTier;
  icon: string;
}> = [
  { target: 100, title: "100 Followers", desc: "First 100 audience members", tier: "BRONZE", icon: "" },
  { target: 500, title: "500 Followers", desc: "500 audience members", tier: "BRONZE", icon: "" },
  { target: 1_000, title: "1,000 Followers", desc: "Crossed 1,000 followers milestone", tier: "SILVER", icon: "" },
  { target: 2_500, title: "2,500 Followers", desc: "2,500 followers milestone", tier: "SILVER", icon: "" },
  { target: 5_000, title: "5,000 Followers", desc: "5,000 followers milestone", tier: "SILVER", icon: "" },
  { target: 10_000, title: "10,000 Followers", desc: "Five-figure 10,000 followers milestone", tier: "GOLD", icon: "" },
  { target: 25_000, title: "25,000 Followers", desc: "25,000 followers milestone", tier: "GOLD", icon: "" },
  { target: 50_000, title: "50,000 Followers", desc: "50,000 followers milestone", tier: "PLATINUM", icon: "" },
  { target: 100_000, title: "100,000 Followers", desc: "Six-figure 100,000 followers milestone", tier: "PLATINUM", icon: "" },
  { target: 250_000, title: "250,000 Followers", desc: "250,000 followers milestone", tier: "DIAMOND", icon: "" },
  { target: 500_000, title: "500,000 Followers", desc: "500,000 followers milestone", tier: "DIAMOND", icon: "" },
  { target: 1_000_000, title: "1,000,000 Followers", desc: "One million followers milestone", tier: "LEGEND", icon: "" },
];

/**
 * Reach milestone definitions
 */
const REACH_TARGETS: Array<{
  target: number;
  title: string;
  desc: string;
  tier: AchievementTier;
  icon: string;
}> = [
  { target: 10_000, title: "10,000 Reach", desc: "Content reached 10,000 unique accounts", tier: "BRONZE", icon: "" },
  { target: 50_000, title: "50,000 Reach", desc: "Content reached 50,000 unique accounts", tier: "BRONZE", icon: "" },
  { target: 100_000, title: "100,000 Reach", desc: "Content reached 100,000 unique accounts", tier: "SILVER", icon: "" },
  { target: 500_000, title: "500,000 Reach", desc: "Over 500,000 unique accounts reached", tier: "GOLD", icon: "" },
  { target: 1_000_000, title: "1,000,000 Reach", desc: "One million unique accounts reached", tier: "PLATINUM", icon: "" },
  { target: 5_000_000, title: "5,000,000 Reach", desc: "Five million unique accounts reached", tier: "DIAMOND", icon: "" },
];

/**
 * Engagement milestone definitions
 */
const ENGAGEMENT_TARGETS: Array<{
  target: number;
  title: string;
  desc: string;
  tier: AchievementTier;
  icon: string;
  metric: "likes" | "comments" | "saved" | "shares";
  unit: string;
}> = [
  { target: 1_000, title: "1,000 Likes", desc: "Collected 1,000 total likes", tier: "BRONZE", icon: "", metric: "likes", unit: "likes" },
  { target: 10_000, title: "10,000 Likes", desc: "Collected 10,000 total likes", tier: "SILVER", icon: "", metric: "likes", unit: "likes" },
  { target: 50_000, title: "50,000 Likes", desc: "Collected 50,000 total likes", tier: "GOLD", icon: "", metric: "likes", unit: "likes" },
  { target: 1_000, title: "1,000 Comments", desc: "Received 1,000 total comments", tier: "BRONZE", icon: "", metric: "comments", unit: "comments" },
  { target: 10_000, title: "10,000 Comments", desc: "Received 10,000 total comments", tier: "SILVER", icon: "", metric: "comments", unit: "comments" },
  { target: 25_000, title: "25,000 Comments", desc: "Received 25,000 total comments", tier: "GOLD", icon: "", metric: "comments", unit: "comments" },
  { target: 1_000, title: "1,000 Saves", desc: "Content saved 1,000 times", tier: "BRONZE", icon: "", metric: "saved", unit: "saves" },
  { target: 10_000, title: "10,000 Saves", desc: "Content saved 10,000 times", tier: "SILVER", icon: "", metric: "saved", unit: "saves" },
  { target: 1_000, title: "1,000 Shares", desc: "Content shared 1,000 times", tier: "BRONZE", icon: "", metric: "shares", unit: "shares" },
  { target: 10_000, title: "10,000 Shares", desc: "Content shared 10,000 times", tier: "SILVER", icon: "", metric: "shares", unit: "shares" },
];

/**
 * Content volume milestones
 */
const CONTENT_TARGETS: Array<{
  target: number;
  title: string;
  desc: string;
  tier: AchievementTier;
  icon: string;
}> = [
  { target: 10, title: "10 Posts", desc: "Published 10 posts", tier: "BRONZE", icon: "" },
  { target: 25, title: "25 Posts", desc: "Published 25 posts", tier: "BRONZE", icon: "" },
  { target: 50, title: "50 Posts", desc: "Published 50 posts", tier: "SILVER", icon: "" },
  { target: 100, title: "100 Posts", desc: "Published 100 posts", tier: "GOLD", icon: "" },
  { target: 250, title: "250 Posts", desc: "Published 250 posts", tier: "PLATINUM", icon: "" },
];

function formatAchievedDate(d: Date | string): string {
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return "Achieved";
  return dateObj.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Computes all creator achievements systematically.
 */
export function calculateAchievements(params: {
  currentFollowers: number;
  followerSnapshots?: RawHistorySnapshot[];
  totals: MetricTotals;
}): {
  achievements: AchievementItem[];
  summary: AchievementSummary;
} {
  const { currentFollowers, followerSnapshots = [], totals } = params;

  // Sort snapshots chronologically
  const sortedSnapshots = [...followerSnapshots].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return da - db;
  });

  const achievements: AchievementItem[] = [];

  // 1. Process Follower Milestones
  let foundFirstInProgressFollower = false;

  for (const def of FOLLOWER_TARGETS) {
    const isUnlocked = currentFollowers >= def.target;
    let achievedDate: string | null = null;
    let status: AchievementStatus = "LOCKED";

    if (isUnlocked) {
      status = "UNLOCKED";
      // Find the earliest snapshot where followerCount >= target
      const hitSnapshot = sortedSnapshots.find((s) => s.followersCount >= def.target);
      if (hitSnapshot) {
        achievedDate = formatAchievedDate(hitSnapshot.date);
      } else if (sortedSnapshots.length > 0) {
        achievedDate = `Prior to ${formatAchievedDate(sortedSnapshots[0].date)}`;
      } else {
        achievedDate = "Verified Milestone";
      }
    } else if (!foundFirstInProgressFollower) {
      status = "IN_PROGRESS";
      foundFirstInProgressFollower = true;
    } else {
      status = "LOCKED";
    }

    const progressPercentage = Math.min(
      100,
      parseFloat(((currentFollowers / def.target) * 100).toFixed(1))
    );
    const remaining = Math.max(0, def.target - currentFollowers);

    achievements.push({
      id: `follower-${def.target}`,
      title: def.title,
      description: def.desc,
      category: "FOLLOWERS",
      tier: def.tier,
      icon: def.icon,
      target: def.target,
      current: currentFollowers,
      status,
      progressPercentage,
      remaining,
      achievedDate,
      unit: "followers",
    });
  }

  // 2. Process Reach Milestones
  const currentReach = totals.reach ?? 0;
  let foundFirstInProgressReach = false;

  for (const def of REACH_TARGETS) {
    const isUnlocked = currentReach >= def.target;
    let status: AchievementStatus = "LOCKED";

    if (isUnlocked) {
      status = "UNLOCKED";
    } else if (!foundFirstInProgressReach) {
      status = "IN_PROGRESS";
      foundFirstInProgressReach = true;
    }

    const progressPercentage = Math.min(
      100,
      parseFloat(((currentReach / def.target) * 100).toFixed(1))
    );
    const remaining = Math.max(0, def.target - currentReach);

    achievements.push({
      id: `reach-${def.target}`,
      title: def.title,
      description: def.desc,
      category: "REACH",
      tier: def.tier,
      icon: def.icon,
      target: def.target,
      current: currentReach,
      status,
      progressPercentage,
      remaining,
      achievedDate: isUnlocked ? "Verified in Insights" : null,
      unit: "reach",
    });
  }

  // 3. Process Engagement Milestones
  for (const def of ENGAGEMENT_TARGETS) {
    const val = totals[def.metric] ?? 0;
    const isUnlocked = val >= def.target;
    const status: AchievementStatus = isUnlocked ? "UNLOCKED" : val > 0 ? "IN_PROGRESS" : "LOCKED";
    const progressPercentage = Math.min(
      100,
      parseFloat(((val / def.target) * 100).toFixed(1))
    );
    const remaining = Math.max(0, def.target - val);

    achievements.push({
      id: `eng-${def.metric}-${def.target}`,
      title: def.title,
      description: def.desc,
      category: "ENGAGEMENT",
      tier: def.tier,
      icon: def.icon,
      target: def.target,
      current: val,
      status,
      progressPercentage,
      remaining,
      achievedDate: isUnlocked ? "Verified in Posts" : null,
      unit: def.unit,
    });
  }

  // 4. Process Content Milestones
  const currentPosts = totals.posts ?? 0;
  let foundFirstInProgressContent = false;

  for (const def of CONTENT_TARGETS) {
    const isUnlocked = currentPosts >= def.target;
    let status: AchievementStatus = "LOCKED";

    if (isUnlocked) {
      status = "UNLOCKED";
    } else if (!foundFirstInProgressContent) {
      status = "IN_PROGRESS";
      foundFirstInProgressContent = true;
    }

    const progressPercentage = Math.min(
      100,
      parseFloat(((currentPosts / def.target) * 100).toFixed(1))
    );
    const remaining = Math.max(0, def.target - currentPosts);

    achievements.push({
      id: `content-${def.target}`,
      title: def.title,
      description: def.desc,
      category: "CONTENT",
      tier: def.tier,
      icon: def.icon,
      target: def.target,
      current: currentPosts,
      status,
      progressPercentage,
      remaining,
      achievedDate: isUnlocked ? "Verified on Feed" : null,
      unit: "posts",
    });
  }

  // 5. Summary calculations
  const totalCount = achievements.length;
  const unlockedCount = achievements.filter((a) => a.status === "UNLOCKED").length;
  const inProgressCount = achievements.filter((a) => a.status === "IN_PROGRESS").length;
  const lockedCount = achievements.filter((a) => a.status === "LOCKED").length;
  const completionPercentage = parseFloat(((unlockedCount / totalCount) * 100).toFixed(1));

  // Find next follower milestone
  const nextFollowerMilestone =
    achievements.find((a) => a.category === "FOLLOWERS" && a.status === "IN_PROGRESS") ||
    achievements.find((a) => a.category === "FOLLOWERS" && a.status === "LOCKED") ||
    null;

  return {
    achievements,
    summary: {
      totalCount,
      unlockedCount,
      inProgressCount,
      lockedCount,
      completionPercentage,
      currentFollowers,
      nextFollowerMilestone,
    },
  };
}
