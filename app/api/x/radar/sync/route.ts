import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { syncLiveWatchlist } from "@/lib/radar/service";

export async function POST(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const result = await syncLiveWatchlist(true);
    return NextResponse.json({
      success: true,
      data: {
        syncedCount: result.syncedCount,
        newPostsCount: result.newPostsCount,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[Radar Sync API] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to sync live feeds" },
      { status: 500 }
    );
  }
}
