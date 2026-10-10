import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export async function GET(
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
  const draft = await prisma.xCrossPostDraft.findFirst({
    where: { id, workspaceId },
  });

  if (!draft) {
    return NextResponse.json(
      { success: false, error: "Draft not found" },
      { status: 404 }
    );
  }

  const indexStr = request.nextUrl.searchParams.get("index");
  const index = indexStr ? parseInt(indexStr, 10) : 0;
  const urls =
    draft.selectedMediaUrls && draft.selectedMediaUrls.length > 0
      ? draft.selectedMediaUrls
      : draft.originalMediaUrls;
  const mediaUrl = urls[index] || urls[0];

  if (!mediaUrl) {
    return NextResponse.json(
      { success: false, error: "No media attached to draft" },
      { status: 404 }
    );
  }

  try {
    const res = await fetch(mediaUrl);
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to download media from CDN (status ${res.status})` },
        { status: 502 }
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    let contentType = res.headers.get("content-type") || "image/jpeg";
    const isVideo =
      draft.mediaType === "VIDEO" ||
      mediaUrl.includes(".mp4") ||
      contentType.includes("video");

    if (isVideo) {
      contentType = "video/mp4";
    }

    const ext = isVideo ? "mp4" : contentType.includes("png") ? "png" : "jpg";
    const filename = `openreply-${draft.mediaType.toLowerCase()}-${index + 1}.${ext}`;

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[Media Download] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to download media file" },
      { status: 500 }
    );
  }
}
