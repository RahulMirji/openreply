import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { getUserInfo } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { getWorkspaceInstagramAccount } from "@/lib/instagram-accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 }
    );
  }

  let image = user.image;

  // If user image is not yet cached, attempt to resolve from connected Instagram account
  if (!image) {
    const workspaceId = await getCurrentWorkspaceId();
    if (workspaceId) {
      const account = await getWorkspaceInstagramAccount(workspaceId);
      if (account) {
        try {
          const token = decryptToken(account.accessToken);
          const info = await getUserInfo(token);
          if (info.profile_picture_url) {
            image = info.profile_picture_url;
            await prisma.user.update({
              where: { id: userId },
              data: { image },
            });
          }
        } catch {
          // Non-blocking: continue without image if token/graph call fails
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      name: user.name ?? null,
      email: user.email ?? null,
      image,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : null;

    if (name !== null && name.length > 100) {
      return NextResponse.json(
        { success: false, error: "Name must be 100 characters or fewer" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name: name || null },
      select: { id: true, name: true, email: true, image: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        name: updatedUser.name,
        email: updatedUser.email,
        image: updatedUser.image,
      },
    });
  } catch (err) {
    console.error("[User Profile] Update error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
