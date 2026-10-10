import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prepareCrossPostDraft, DraftPreparationError } from "@/lib/x/draft";

export async function POST(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { instagramPostId, instagramAccountId, includeLink } = body;

    if (!instagramPostId || !instagramAccountId) {
      return NextResponse.json(
        { success: false, error: "Missing instagramPostId or instagramAccountId" },
        { status: 400 }
      );
    }

    const result = await prepareCrossPostDraft({
      workspaceId,
      instagramAccountId,
      instagramPostId,
      includeLink: Boolean(includeLink),
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    if (err instanceof DraftPreparationError) {
      return NextResponse.json(
        { success: false, error: err.message },
        { status: err.code }
      );
    }
    console.error("[X Draft Prepare] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to prepare cross-post draft" },
      { status: 500 }
    );
  }
}
