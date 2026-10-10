import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import type { CrossPostStatus } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status") as CrossPostStatus | null;

  try {
    const drafts = await prisma.xCrossPostDraft.findMany({
      where: {
        workspaceId,
        ...(statusParam ? { status: statusParam } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: drafts,
    });
  } catch (err) {
    console.error("[X Drafts List] Error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}
