import type { RadarPost } from "./directory";

/**
 * Fetches real, live tweets for any public X creator handle using
 * Twitter's public Next.js timeline syndication endpoint.
 * Zero API keys or tokens required.
 */
export async function fetchLiveCreatorTweets(handle: string): Promise<RadarPost[]> {
  const cleanHandle = handle.replace(/^@/, "").trim();
  if (!cleanHandle) return [];

  const syndicationUrl = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(
    cleanHandle
  )}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(syndicationUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`[Syndication] Failed to fetch for ${cleanHandle}: status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

    if (!nextDataMatch || !nextDataMatch[1]) {
      return [];
    }

    const nextData = JSON.parse(nextDataMatch[1]);
    const entries = nextData?.props?.pageProps?.timeline?.entries || [];

    const posts: RadarPost[] = [];

    // Import dynamically or look up from directory
    const { WATCHLIST_ACCOUNTS } = await import("./directory");
    const matchedAccount = WATCHLIST_ACCOUNTS.find(
      (a) => a.handle.toLowerCase() === cleanHandle.toLowerCase()
    );

    const accountCategory = matchedAccount?.category || "CREATOR";
    const isLeader =
      matchedAccount?.isTechLeader ??
      /sama|karpathy|amodei|altman|gdb|fan|chollet|hotz|rauch/i.test(cleanHandle);

    for (const entry of entries) {
      const tweet = entry?.content?.tweet;
      if (!tweet || !tweet.full_text) continue;

      const rawText = tweet.full_text || "";
      // Strip trailing media t.co links from text if they exist
      const cleanText = rawText.replace(/https:\/\/t\.co\/\w+$/, "").trim();

      const createdDate = tweet.created_at ? new Date(tweet.created_at) : new Date();
      const isDeal = /free|\$|credit|grant|tier|token|claim/i.test(cleanText);
      const urlMatch = cleanText.match(/https?:\/\/[^\s]+/);

      posts.push({
        id: `x-${tweet.id_str || tweet.conversation_id_str || Date.now()}`,
        accountId: matchedAccount?.id || cleanHandle,
        authorName: tweet.user?.name || matchedAccount?.name || cleanHandle,
        authorHandle: tweet.user?.screen_name || matchedAccount?.handle || cleanHandle,
        category: accountCategory,
        content: cleanText,
        sourceUrl: `https://x.com/${cleanHandle}/status/${tweet.id_str || ""}`,
        publishedAt: createdDate.toISOString(),
        isTechLeader: isLeader,
        isFreeDeal: isDeal,
        dealLink: urlMatch ? urlMatch[0] : undefined,
        metrics: {
          likes: tweet.favorite_count || 0,
          reposts: tweet.retweet_count || 0,
          replies: tweet.reply_count || 0,
        },
        tags: isDeal ? ["free-tier", "credits"] : ["dev", "ai"],
      });
    }

    return posts;
  } catch (err) {
    console.error(`[Syndication Error] Failed fetching @${cleanHandle}:`, err);
    return [];
  }
}
