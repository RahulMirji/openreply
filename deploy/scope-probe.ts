/**
 * Determines whether the currently stored token actually carries
 * instagram_business_manage_comments, by attempting the two operations that
 * require it and reporting Meta's exact responses.
 */
import { createDecipheriv } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const V = process.env.META_GRAPH_API_VERSION ?? "v25.0";
const BASE = `https://graph.instagram.com/${V}`;

function decryptToken(enc: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const c = Buffer.from(enc, "base64");
  const d = createDecipheriv("aes-256-gcm", key, c.subarray(0, 16));
  d.setAuthTag(c.subarray(16, 32));
  return Buffer.concat([d.update(c.subarray(32)), d.final()]).toString("utf8");
}

async function call(path: string, token: string, init?: RequestInit, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), init);
  const text = await res.text();
  return { status: res.status, body: text.slice(0, 300) };
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  const acct = await prisma.instagramAccount.findFirstOrThrow();
  const token = decryptToken(acct.accessToken);
  const IG = acct.instagramId;

  console.log("1. current subscription:");
  console.log("   ", (await call(`${IG}/subscribed_apps`, token)).body);

  console.log("\n2. POST subscribe comments+messages:");
  console.log("   ", (await call(`${IG}/subscribed_apps`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscribed_fields: ["comments", "messages"] }),
  })).body);

  console.log("\n3. subscription AFTER the POST (did comments stick?):");
  console.log("   ", (await call(`${IG}/subscribed_apps`, token)).body);

  const autos = await prisma.automation.findMany({ select: { name: true, postId: true } });
  for (const a of autos) {
    if (!a.postId) continue;
    console.log(`\n4. comments read on "${a.name}" (${a.postId}):`);
    const r = await call(`${a.postId}/comments`, token, undefined, {
      fields: "id,text,username,timestamp",
      limit: "25",
    });
    console.log("   ", r.status, r.body);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", String(e).slice(0, 300));
  process.exit(1);
});
