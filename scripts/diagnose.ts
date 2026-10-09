import "dotenv/config";
import { decryptToken } from "@/lib/meta/oauth";
import { prisma } from "@/lib/db/client";

async function main() {
  const acct = await prisma.instagramAccount.findFirst();
  if (!acct) { console.log("NO ACCOUNT"); process.exit(1); }
  const token = decryptToken(acct.accessToken);

  // 1. Check comments on the campaign post
  const postId = "17864650923647410";
  console.log(`\n=== Fetching comments for post ${postId} ===`);
  const url = `https://graph.instagram.com/v25.0/${postId}/comments?fields=id,text,timestamp,from,replies{from}&order=reverse_chronological&limit=10&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  // 2. Check the account's subscribed_apps status
  console.log(`\n=== Checking webhook subscription for ${acct.instagramId} ===`);
  const subUrl = `https://graph.instagram.com/v25.0/${acct.instagramId}/subscribed_apps?access_token=${token}`;
  const subRes = await fetch(subUrl);
  const subData = await subRes.json();
  console.log(JSON.stringify(subData, null, 2));

  // 3. Try fetching recent media to see if the postId even exists
  console.log(`\n=== Recent media for account ===`);
  const mediaUrl = `https://graph.instagram.com/v25.0/me/media?fields=id,caption,timestamp,permalink&limit=5&access_token=${token}`;
  const mediaRes = await fetch(mediaUrl);
  const mediaData = await mediaRes.json();
  console.log(JSON.stringify(mediaData, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
