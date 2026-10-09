import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import {
  canManageWorkspace,
  getCurrentWorkspaceContext,
} from "@/lib/workspace-access";

/**
 * Disconnect an Instagram account.
 *
 * This used to `deleteMany` the InstagramAccount row. Because Automation,
 * DmLog, LinkClick and FollowerSnapshot all declare
 * `onDelete: Cascade` on that relation, disconnecting silently destroyed every
 * campaign and all history for the account — and since the Settings flow has
 * users disconnect before reconnecting, a routine reconnect wiped their work.
 *
 * Default behaviour is now a soft disconnect: clear the credentials but keep the
 * row, so campaigns survive and reconnecting (which upserts on `instagramId`)
 * lands back on the same row with everything intact.
 *
 * An empty `accessToken` is already the codebase's "no usable token" sentinel —
 * both cron routes filter on `accessToken: { not: "" }` and the DM worker checks
 * `!instagramAccount.accessToken` — so downstream behaviour is unchanged.
 *
 * Pass `purge: true` to get the old destructive behaviour and delete the row
 * along with its campaigns and history.
 */
export async function POST(request: NextRequest) {
  const context = await getCurrentWorkspaceContext();
  if (!context) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  if (!canManageWorkspace(context.role)) {
    return NextResponse.json(
      { success: false, error: "Only owners and admins can disconnect accounts" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const instagramAccountId =
    typeof body.instagramAccountId === "string" ? body.instagramAccountId : null;
  const purge = body.purge === true;

  const where = {
    workspaceId: context.workspaceId,
    ...(instagramAccountId ? { id: instagramAccountId } : {}),
  };

  if (purge) {
    const affected = await prisma.automation.count({
      where: { instagramAccount: where },
    });
    const removed = await prisma.instagramAccount.deleteMany({ where });

    await prisma.operationalEvent
      .create({
        data: {
          source: "SYSTEM",
          level: "WARNING",
          workspaceId: context.workspaceId,
          message: `Instagram account purged: ${removed.count} account(s) and ${affected} campaign(s) deleted`,
          payload: { instagramAccountId, purge: true },
        },
      })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      data: { purged: true, accounts: removed.count, campaignsDeleted: affected },
    });
  }

  const updated = await prisma.instagramAccount.updateMany({
    where,
    data: {
      accessToken: "",
      tokenExpiresAt: null,
      webhookSubscribed: false,
    },
  });

  await prisma.operationalEvent
    .create({
      data: {
        source: "SYSTEM",
        level: "INFO",
        workspaceId: context.workspaceId,
        message: `Instagram disconnected (credentials cleared, campaigns kept) for ${updated.count} account(s)`,
        payload: { instagramAccountId, purge: false },
      },
    })
    .catch(() => {});

  return NextResponse.json({
    success: true,
    data: { purged: false, accounts: updated.count },
  });
}
