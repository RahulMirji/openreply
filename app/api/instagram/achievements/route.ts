import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";
import { decryptToken } from "@/lib/meta/oauth";
import { ensureFollowerHistory } from "@/lib/reports/follower-history";
import { calculateAchievements } from "@/lib/achievements/engine";
import {
  getAllUserMedia,
  getMediaInsights,
  type InstagramMedia,
} from "@/lib/meta/client";

export const maxDuration = 60;

function isVideoLike(m: InstagramMedia): boolean {
  return m.media_type === "VIDEO" || m.media_product_type === "REELS";
}

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const requestedAccountId = request.nextUrl.searchParams.get("instagramAccountId");

  try {
    const account = await getWorkspaceInstagramAccount(
      workspaceId,
      requestedAccountId
    );

    const accounts = await prisma.instagramAccount.findMany({
      where: { workspaceId },
      orderBy: { connectedAt: "desc" },
      select: { id: true, username: true },
    });

    if (!account || !account.accessToken) {
      return NextResponse.json(
        { success: false, error: "No connected Instagram account found." },
        { status: 404 }
      );
    }

    const accessToken = decryptToken(account.accessToken);

    // 1. Get follower snapshots and current followers
    let currentFollowers = 0;
    try {
      const liveFollowers = await ensureFollowerHistory(
        { id: account.id, instagramId: account.instagramId },
        accessToken
      );
      if (typeof liveFollowers === "number") {
        currentFollowers = liveFollowers;
      }
    } catch (err) {
      console.warn("[Achievements] Live follower fetch error:", err);
    }

    const snapshots = await prisma.followerSnapshot.findMany({
      where: { instagramAccountId: account.id },
      orderBy: { date: "asc" },
      select: { date: true, followersCount: true },
    });

    if (currentFollowers === 0 && snapshots.length > 0) {
      currentFollowers = snapshots[snapshots.length - 1].followersCount;
    }

    // 2. Fetch media totals (up to recent 50 posts for performance)
    let rawMedia: InstagramMedia[] = [];
    try {
      rawMedia = await getAllUserMedia(accessToken, 50);
    } catch (err) {
      console.warn("[Achievements] Could not fetch media:", err);
    }

    // Aggregate baseline post counts, likes, and comments
    const postsCount = rawMedia.length;
    let totalLikes = 0;
    let totalComments = 0;
    for (const m of rawMedia) {
      totalLikes += m.like_count ?? 0;
      totalComments += m.comments_count ?? 0;
    }

    // Attempt insights for reach and impressions
    let totalReach = 0;
    let totalViews = 0;
    let totalSaved = 0;
    let totalShares = 0;

    const insightPromises = rawMedia.slice(0, 30).map(async (m) => {
      const metrics = isVideoLike(m)
        ? ["views", "reach", "saved", "shares", "total_interactions"]
        : ["reach", "saved", "shares", "total_interactions"];
      try {
        const insights = await getMediaInsights(accessToken, m.id, metrics);
        return insights;
      } catch {
        return null;
      }
    });

    const insightsResults = await Promise.all(insightPromises);
    for (const ins of insightsResults) {
      if (ins) {
        totalReach += ins.reach ?? 0;
        totalViews += ins.views ?? 0;
        totalSaved += ins.saved ?? 0;
        totalShares += ins.shares ?? 0;
      }
    }

    const totals = {
      posts: postsCount,
      views: totalViews > 0 ? totalViews : null,
      reach: totalReach > 0 ? totalReach : null,
      likes: totalLikes,
      comments: totalComments,
      saved: totalSaved > 0 ? totalSaved : null,
      shares: totalShares > 0 ? totalShares : null,
    };

    // 3. Compute achievements
    const { achievements, summary } = calculateAchievements({
      currentFollowers,
      followerSnapshots: snapshots,
      totals,
    });

    return NextResponse.json({
      success: true,
      data: {
        account: { id: account.id, username: account.username },
        accounts,
        currentFollowers,
        totals,
        summary,
        achievements,
      },
    });
  } catch (err) {
    console.error("[Achievements] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load achievements" },
      { status: 500 }
    );
  }
}
