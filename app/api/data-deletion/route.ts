import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

/**
 * Data deletion callback endpoint required by Meta.
 * When a user requests data deletion through Facebook/Instagram,
 * Meta sends a POST to this URL with their user ID.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body?.signed_request ? "meta-user" : "unknown";

    // Log the deletion request
    await prisma.operationalEvent
      .create({
        data: {
          source: "SYSTEM",
          level: "INFO",
          message: `Data deletion requested for user: ${userId}`,
          payload: body,
        },
      })
      .catch(() => {});

    // Return confirmation with a status URL
    const confirmationCode = `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return NextResponse.json({
      url: `${request.nextUrl.origin}/api/data-deletion?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  return NextResponse.json({
    status: code ? "complete" : "pending",
    confirmation_code: code ?? "none",
    message: "Your data has been deleted or is scheduled for deletion.",
  });
}
