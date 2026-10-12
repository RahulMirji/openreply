import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import {
  getRadarFeed,
  addCustomWatchlistAccount,
  addCustomRadarPost,
  RadarSortOption,
} from "@/lib/radar/service";

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category") || "ALL";
  const search = searchParams.get("search") || "";
  const sort = (searchParams.get("sort") || "NEWEST") as RadarSortOption;

  try {
    const feed = await getRadarFeed({ category, search, sort });
    return NextResponse.json({
      success: true,
      data: feed,
    });
  } catch (err) {
    console.error("[Radar API] Error fetching feed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch radar feed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { action } = body;

    // Action 1: Add new creator to watchlist
    if (action === "ADD_ACCOUNT") {
      const { name, handle, category, description } = body;
      if (!handle || !handle.trim()) {
        return NextResponse.json(
          { success: false, error: "Handle is required" },
          { status: 400 }
        );
      }
      const account = addCustomWatchlistAccount({
        name: name || handle.replace(/^@/, ""),
        handle: handle.replace(/^@/, "").trim(),
        category: category || "CREATOR",
        profileUrl: `https://x.com/${handle.replace(/^@/, "").trim()}`,
        avatarText: (name || handle).slice(0, 2).toUpperCase(),
        description: description || `Developer & AI creator @${handle}`,
        badge: "Custom Watchlist",
      });
      return NextResponse.json({ success: true, data: account });
    }

    // Action 2: Add live post to stream
    if (action === "ADD_POST") {
      const { authorName, authorHandle, content, sourceUrl, category, isFreeDeal, dealLink } = body;
      if (!content || !content.trim()) {
        return NextResponse.json(
          { success: false, error: "Content is required" },
          { status: 400 }
        );
      }
      const post = addCustomRadarPost({
        accountId: authorHandle ? authorHandle.replace(/^@/, "") : "custom",
        authorName: authorName || "Creator",
        authorHandle: authorHandle ? authorHandle.replace(/^@/, "") : "creator",
        category: category || "CREATOR",
        content: content.trim(),
        sourceUrl: sourceUrl || "https://x.com",
        isFreeDeal: Boolean(isFreeDeal),
        dealLink: dealLink || undefined,
        metrics: { likes: 1, reposts: 0, replies: 0 },
      });
      return NextResponse.json({ success: true, data: post });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 }
    );
  } catch (err) {
    console.error("[Radar API POST] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}
