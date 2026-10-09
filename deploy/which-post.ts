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

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  const acct = await prisma.instagramAccount.findFirstOrThrow();
  const token = decrypt(acct.accessToken);

  for (const a of await prisma.automation.findMany({
    select: { name: true, postId: true, isActive: true },
  })) {
    const url = new URL(`https://graph.instagram.com/${V}/${a.postId}`);
    url.searchParams.set("fields", "permalink,media_type,comments_count,timestamp");
    url.searchParams.set("access_token", token);
    const res = await fetch(url.toString());
    console.log(`campaign "${a.name}" active=${a.isActive}`);
    console.log("  ", JSON.stringify(await res.json()));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(String(e).slice(0, 300));
  process.exit(1);
});
