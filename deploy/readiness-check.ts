/**
 * End-to-end readiness probe for the comment -> auto-reply -> DM pipeline.
 * Read-only: performs GETs against the Graph API and the local database only.
 */
import { createDecipheriv } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const V = process.env.META_GRAPH_API_VERSION ?? "v25.0";
const BASE = `https://graph.instagram.com/${V}`;

function decryptToken(encryptedBase64: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const c = Buffer.from(encryptedBase64, "base64");
  const d = createDecipheriv("aes-256-gcm", key, c.subarray(0, 16));
  d.setAuthTag(c.subarray(16, 32));
  return Buffer.concat([d.update(c.subarray(32)), d.final()]).toString("utf8");
}

async function api(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body } as { status: number; body: any };
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg(process.env.DATABASE_URL!),
  });

  const account = await prisma.instagramAccount.findFirst();
  if (!account) {
    console.log("FAIL: no Instagram account connected");
    return;
  }

  const token = decryptToken(account.accessToken);
  console.log("=== ACCOUNT ===");
  console.log("  username        :", account.username);
  console.log("  token expires   :", account.tokenExpiresAt?.toISOString());
  console.log("  webhookSubscribed(db):", account.webhookSubscribed);

  const me = await api("me", token, { fields: "id,user_id,username,account_type" });
  console.log("  /me             :", me.status, JSON.stringify(me.body).slice(0, 160));

  console.log("\n=== WEBHOOK SUBSCRIPTION (live from Meta) ===");
  const subs = await api(`${account.instagramId}/subscribed_apps`, token);
  console.log("  fields          :", JSON.stringify(subs.body?.data ?? subs.body));

  console.log("\n=== CAMPAIGNS ===");
  const autos = await prisma.automation.findMany({
    select: {
      id: true, name: true, isActive: true, postId: true, matchAnyWord: true,
      keywords: true, requireFollow: true, publicReplyEnabled: true,
      publicReplyMessage: true, dmMessage: true,
    },
  });
  for (const a of autos) {
    console.log(`  "${a.name}" active=${a.isActive} post=${a.postId} anyWord=${a.matchAnyWord} keywords=[${a.keywords}]`);
    console.log(`     requireFollow=${a.requireFollow} publicReply=${a.publicReplyEnabled} dm="${a.dmMessage?.slice(0, 40)}"`);

    if (a.postId) {
      const c = await api(`${a.postId}/comments`, token, { fields: "id,text,timestamp,username", limit: "25" });
      const media = await api(a.postId, token, { fields: "comments_count,permalink" });
      const returned = Array.isArray(c.body?.data) ? c.body.data.length : `ERR ${JSON.stringify(c.body).slice(0, 120)}`;
      console.log(`     COMMENTS READ: api_returned=${returned} instagram_count=${media.body?.comments_count}`);
      if (Array.isArray(c.body?.data) && c.body.data.length > 0) {
        for (const cm of c.body.data.slice(0, 5)) {
          console.log(`        - @${cm.username ?? "?"}: ${String(cm.text).slice(0, 40)} (${cm.timestamp})`);
        }
      }
    }
  }

  console.log("\n=== PIPELINE ACTIVITY ===");
  console.log("  ProcessedComment rows:", await prisma.processedComment.count());
  console.log("  DmLog rows           :", await prisma.dmLog.count());
  const wh = await prisma.webhookEvent.count({
    where: { createdAt: { gt: new Date(Date.now() - 6 * 3600 * 1000) } },
  });
  console.log("  WebhookEvents (6h)   :", wh);

  const events = await prisma.operationalEvent.findMany({
    where: { createdAt: { gt: new Date(Date.now() - 6 * 3600 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { createdAt: true, level: true, message: true },
  });
  console.log("  Recent events        :", events.length);
  for (const e of events) {
    console.log(`     [${e.level}] ${e.message.slice(0, 100)}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("PROBE ERROR:", String(e).slice(0, 400));
  process.exit(1);
});
