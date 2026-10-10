import { describe, it, expect } from "vitest";
import { calculateAchievements } from "@/lib/achievements/engine";

describe("Achievements & Milestones Engine", () => {
  it("correctly unlocks 1K, 5K, 10K badges for a 10,326 follower account", () => {
    const snapshots = [
      { date: "2026-09-12", followersCount: 4900 },
      { date: "2026-09-15", followersCount: 5200 },
      { date: "2026-10-06", followersCount: 9800 },
      { date: "2026-10-08", followersCount: 10100 },
      { date: "2026-10-10", followersCount: 10326 },
    ];

    const totals = {
      posts: 50,
      views: 2500,
      reach: 501700,
      likes: 11600,
      comments: 32400,
      saved: 11900,
      shares: 13100,
    };

    const { achievements, summary } = calculateAchievements({
      currentFollowers: 10326,
      followerSnapshots: snapshots,
      totals,
    });

    const f1k = achievements.find((a) => a.id === "follower-1000");
    const f5k = achievements.find((a) => a.id === "follower-5000");
    const f10k = achievements.find((a) => a.id === "follower-10000");
    const f25k = achievements.find((a) => a.id === "follower-25000");
    const f50k = achievements.find((a) => a.id === "follower-50000");

    expect(f1k?.status).toBe("UNLOCKED");
    expect(f1k?.title).toBe("1,000 Followers");
    expect(f5k?.status).toBe("UNLOCKED");
    expect(f5k?.title).toBe("5,000 Followers");
    expect(f5k?.achievedDate).toBeDefined();

    expect(f10k?.status).toBe("UNLOCKED");
    expect(f10k?.title).toBe("10,000 Followers");
    expect(f10k?.achievedDate).toContain("2026");

    // 25K is the next milestone in progress
    expect(f25k?.status).toBe("IN_PROGRESS");
    expect(f25k?.progressPercentage).toBe(41.3);
    expect(f25k?.remaining).toBe(14674);

    // 50K is locked/subsequent milestone with filling up progress
    expect(f50k?.progressPercentage).toBe(20.7);
    expect(f50k?.remaining).toBe(39674);

    // Reach milestones: 500K reached!
    const r500k = achievements.find((a) => a.id === "reach-500000");
    expect(r500k?.status).toBe("UNLOCKED");
    expect(r500k?.title).toBe("500,000 Reach");

    // Summary calculations
    expect(summary.currentFollowers).toBe(10326);
    expect(summary.nextFollowerMilestone?.id).toBe("follower-25000");
    expect(summary.unlockedCount).toBeGreaterThan(10);
  });
});
