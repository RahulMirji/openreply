/**
 * Tries several ways to learn what the stored token is actually allowed to do,
 * and distinguishes "permission missing" (OAuthException) from "data filtered"
 * (HTTP 200 with an empty list).
 */
import { createDecipheriv } from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const V = process.env.META_GRAPH_API_VERSION ?? "v25.0";

function decrypt(enc: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const c = Buffer.from(enc, "base64");
  const d = createDecipheriv("aes-256-gcm", key, c.subarray(0, 16));
  d.setAuthTag(c.subarray(16, 32));
  return Buffer.concat([d.update(c.subarray(32)), d.final()]).toString("utf8");
}

async function show(label: string, url: string) {
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`${label}\n   HTTP ${res.status} :: ${text.slice(0, 230)}\n`);
  } catch (e) {
    console.log(`${label}\n   NETWORK ERROR ${String(e).slice(0, 100)}\n`);
  }
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  const acct = await prisma.instagramAccount.findFirstOrThrow();
  const t = decrypt(acct.accessToken);
  const IG = acct.instagramId;
  const post = (await prisma.automation.findFirstOrThrow()).postId!;

  const IGB = `https://graph.instagram.com/${V}`;

  await show("1. /me/permissions (does this edge exist?)",
    `${IGB}/me/permissions?access_token=${t}`);

  await show("2. comments edge, v25.0",
    `${IGB}/${post}/comments?fields=id,text&access_token=${t}`);

  await show("3. comments edge, v26.0 (console shows fields at v26.0)",
    `https://graph.instagram.com/v26.0/${post}/comments?fields=id,text&access_token=${t}`);

  await show("4. comments edge, NO version prefix",
    `https://graph.instagram.com/${post}/comments?fields=id,text&access_token=${t}`);

  await show("5. media with comments subfield",
    `${IGB}/${post}?fields=id,comments_count,comments{id,text}&access_token=${t}`);

  // A field that definitely needs manage_comments: try to read hidden state.
  await show("6. comments with 'hidden' field (needs manage_comments)",
    `${IGB}/${post}/comments?fields=id,text,hidden&access_token=${t}`);

  await show("7. mentioned comments edge",
    `${IGB}/${IG}?fields=id&access_token=${t}`);

  console.log("token prefix:", t.slice(0, 12), "length:", t.length);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERROR:", String(e).slice(0, 300));
  process.exit(1);
});
