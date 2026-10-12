import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { findRadarPostById } from "@/lib/radar/service";
import { curateRadarPostWithGemini } from "@/lib/radar/curate";

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
    const { postId, authorName, authorHandle, content, sourceUrl } = body;

    let targetAuthorName = authorName;
    let targetAuthorHandle = authorHandle;
    let targetContent = content;
    let targetSourceUrl = sourceUrl;
    let isTechLeader = Boolean(body.isTechLeader);
    let isFreeDeal = Boolean(body.isFreeDeal);
    let dealLink = body.dealLink;

    if (postId) {
      const found = findRadarPostById(postId);
      if (found) {
        targetAuthorName = found.authorName;
        targetAuthorHandle = found.authorHandle;
        targetContent = found.content;
        targetSourceUrl = found.sourceUrl;
        isTechLeader = Boolean(found.isTechLeader);
        isFreeDeal = Boolean(found.isFreeDeal);
        dealLink = found.dealLink;
      }
    }

    if (!targetContent || !targetContent.trim()) {
      return NextResponse.json(
        { success: false, error: "Content is required for AI curation" },
        { status: 400 }
      );
    }

    const curation = await curateRadarPostWithGemini({
      authorName: targetAuthorName || "Tech Creator",
      authorHandle: targetAuthorHandle || "tech",
      sourceUrl: targetSourceUrl,
      originalText: targetContent,
      isTechLeader,
      isFreeDeal,
      dealLink,
    });

    return NextResponse.json({
      success: true,
      data: {
        variations: curation.variations,
        model: curation.model,
        fallbackUsed: curation.fallbackUsed,
      },
    });
  } catch (err) {
    console.error("[Radar Curate API] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to curate post with AI" },
      { status: 500 }
    );
  }
}
