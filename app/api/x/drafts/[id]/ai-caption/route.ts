import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { generateXCaptionWithGemini } from "@/lib/x/ai-caption";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const draft = await prisma.xCrossPostDraft.findFirst({
      where: { id, workspaceId },
    });

    if (!draft) {
      return NextResponse.json(
        { success: false, error: "Draft not found" },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const customPromptCaption = body.caption || draft.originalCaption || "";

    const result = await generateXCaptionWithGemini({
      originalCaption: customPromptCaption,
      permalink: draft.instagramPermalink,
      mediaType: draft.mediaType as "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM",
    });

    // Optionally update draft in database immediately if requested
    if (body.saveToDraft) {
      await prisma.xCrossPostDraft.update({
        where: { id: draft.id },
        data: { tweetText: result.caption },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        tweetText: result.caption,
        charCount: result.charCount,
        model: result.model,
        fallbackUsed: result.fallbackUsed,
      },
    });
  } catch (err) {
    console.error("[AI Caption Route] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to generate AI caption" },
      { status: 500 }
    );
  }
}
