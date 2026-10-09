/**
 * Reads comments for the most recent media using the currently stored token.
 * Independent of the Automation table, which reconnecting wipes.
 */
import { createDecipheriv } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const V = process.env.META_GRAPH_API_VERSION ?? "v25.0";
const BASE = `https://graph.instagram.com/${V}`;

function decrypt(enc: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const c = Buffer.from(enc, "base64");
  const d = createDecipheriv("aes-256-gcm", key, c.subarray(0, 16));
  d.setAuthTag(c.subarray(16, 32));
  return Buffer.concat([d.update(c.subarray(32)), d.final()]).toString("utf8");
}

async function get(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  return { status: res.status, body: await res.json().catch(() => ({})) } as any;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  const acct = await prisma.instagramAccount.findFirstOrThrow();
  const token = decrypt(acct.accessToken);

  const media = await get("me/media", token, {
    fields: "id,permalink,comments_count,media_type",
    limit: "5",
  });

  for (const m of media.body?.data ?? []) {
    if (!m.comments_count) continue;
    const c = await get(`${m.id}/comments`, token, {
      fields: "id,text,username,timestamp,from",
      limit: "50",
    });
    const n = Array.isArray(c.body?.data) ? c.body.data.length : "ERR";
    console.log(`${m.id} ${m.media_type} count=${m.comments_count} -> api=${n}`);
    if (n === "ERR") console.log("   ", JSON.stringify(c.body).slice(0, 220));
    for (const cm of (c.body?.data ?? []).slice(0, 6)) {
      console.log(`     @${cm.username ?? cm.from?.username ?? "?"}: ${String(cm.text).slice(0, 45)}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", String(e).slice(0, 300));
  process.exit(1);
});
