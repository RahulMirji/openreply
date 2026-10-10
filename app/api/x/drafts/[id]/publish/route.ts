import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getWorkspaceXCredentials, uploadMediaToX, createTweet } from "@/lib/x/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const draft = await prisma.xCrossPostDraft.findFirst({
      where: { id, workspaceId },
    });

    if (!draft) {
      return NextResponse.json({ success: false, error: "Draft not found" }, { status: 404 });
    }

    // Check credentials
    const credentials = await getWorkspaceXCredentials(workspaceId);
    if (!credentials) {
      return NextResponse.json(
        {
          success: false,
          error:
            "X account not connected. Please connect your X Developer API keys in Cross Posting settings.",
        },
        { status: 400 }
      );
    }

    // Download and upload media to X
    const mediaIds: string[] = [];
    for (const url of draft.selectedMediaUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Failed to download media from Meta CDN (status ${res.status})`);
        }
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        let contentType = res.headers.get("content-type") || "image/jpeg";

        // Explicitly flag videos/reels
        if (draft.mediaType === "VIDEO" || url.includes(".mp4")) {
          contentType = "video/mp4";
        }

        const mediaId = await uploadMediaToX(credentials, buffer, contentType);
        mediaIds.push(mediaId);
      } catch (err) {
        console.error(`[X Publish] Failed to upload media item: ${url}`, err);
        throw err;
      }
    }

    // Publish tweet
    const tweet = await createTweet(credentials, draft.tweetText, mediaIds);
    const tweetUrl = `https://x.com/i/status/${tweet.id}`;

    // Update draft status
    const updated = await prisma.xCrossPostDraft.update({
      where: { id: draft.id },
      data: {
        status: "PUBLISHED",
        xTweetId: tweet.id,
        xTweetUrl: tweetUrl,
        publishedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        draft: updated,
        tweetId: tweet.id,
        tweetUrl,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to publish tweet to X";
    console.error("[X Publish] Error:", err);

    await prisma.xCrossPostDraft.update({
      where: { id },
      data: {
        status: "FAILED",
        errorMessage: msg,
      },
    }).catch(() => null);

    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
