import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { encryptToken } from "@/lib/meta/oauth";
import { verifyXCredentials, getWorkspaceXCredentials } from "@/lib/x/client";

export async function GET() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const xAccount = await prisma.xAccount.findUnique({
      where: { workspaceId },
      select: { username: true, name: true, connectedAt: true },
    });

    if (xAccount) {
      return NextResponse.json({
        success: true,
        data: {
          isConnected: true,
          username: xAccount.username,
          name: xAccount.name,
          connectedAt: xAccount.connectedAt,
          source: "database",
        },
      });
    }

    // Check if configured via .env
    const envCreds = await getWorkspaceXCredentials(workspaceId);
    if (envCreds) {
      return NextResponse.json({
        success: true,
        data: {
          isConnected: true,
          username: "Configured via .env",
          source: "env",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: { isConnected: false },
    });
  } catch (err) {
    console.error("[X Account GET] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to check X status" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { apiKey, apiKeySecret, accessToken, accessTokenSecret } = body;

    if (!apiKey || !apiKeySecret || !accessToken || !accessTokenSecret) {
      return NextResponse.json(
        { success: false, error: "All 4 X API keys are required." },
        { status: 400 }
      );
    }

    const credentials = { apiKey, apiKeySecret, accessToken, accessTokenSecret };

    // Verify credentials by pinging X API
    const xUser = await verifyXCredentials(credentials);

    // Encrypt and store in database
    const encrypted = encryptToken(JSON.stringify(credentials));

    const account = await prisma.xAccount.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        xUserId: xUser.id,
        username: xUser.username,
        name: xUser.name,
        accessToken: encrypted,
      },
      update: {
        xUserId: xUser.id,
        username: xUser.username,
        name: xUser.name,
        accessToken: encrypted,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        isConnected: true,
        username: account.username,
        name: account.name,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to connect X account";
    console.error("[X Account POST] Error:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}

export async function DELETE() {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.xAccount.deleteMany({
      where: { workspaceId },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[X Account DELETE] Error:", err);
    return NextResponse.json({ success: false, error: "Failed to disconnect X account" }, { status: 500 });
  }
}
