import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { updateCrossPostDraft, DraftPreparationError } from "@/lib/x/draft";

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

    return NextResponse.json({ success: true, data: draft });
  } catch (err) {
    console.error("[X Draft Detail] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to load draft" },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const body = await request.json();
    const updated = await updateCrossPostDraft({
      draftId: id,
      workspaceId,
      tweetText: body.tweetText,
      selectedMediaUrls: body.selectedMediaUrls,
      status: body.status,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    if (err instanceof DraftPreparationError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.code }
      );
    }
    console.error("[X Draft Update] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update draft" },
      { status: 500 }
    );
  }
}
