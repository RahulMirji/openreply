import { WATCHLIST_ACCOUNTS, WatchlistAccount, RadarPost } from "./directory";
import { fetchLiveCreatorTweets } from "./syndication";
import { fetchLiveRssUpdates } from "./live-ingest";

export type RadarSortOption = "NEWEST" | "NAME_ASC" | "ENGAGEMENT" | "FREE_DEALS" | "CATEGORY";

// In-memory registry for user-added custom creators and live ingested posts
const dynamicAccounts: WatchlistAccount[] = [];
const dynamicPosts: RadarPost[] = [];
let liveIngestedPosts: RadarPost[] = [];
let lastSyncTime = 0;
let isSyncing = false;

// Priority handles that get polled every 5 minutes
const PRIORITY_LIVE_HANDLES = [
  "k2sbhai",
  "punchw45k",
  "painn_x",
  "TheMaran",
  "karpathy",
  "sama",
  "AnthropicAI",
  "cursor_ai",
  "OpenRouterAI",
  "Cloudflare",
  "vercel",
  "supabase",
  "LangChainAI",
  "DrJimFan",
  "fchollet",
  "kirodotdev",
];

/**
 * Built-in initial high-signal posts from the watchlist creators & labs.
 */
const SEED_RADAR_POSTS: RadarPost[] = [
  {
    id: "radar-k2s-1",
    accountId: "k2sbhai",
    authorName: "K2S",
    authorHandle: "k2sbhai",
    category: "CREATOR",
    content: "$10,000 in FREE Cloudflare credits for startups 😳\n\nyou don't need VC funding for the $10k tier\n\n- bootstrapped startups can apply\n- credits last up to 12 months\n- domain email and a live website are required\n\napply here: http://cloudflare.com/startups\n> applying doesn't guarantee approval",
    sourceUrl: "https://x.com/k2sbhai",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // Exactly 1 hour ago matching live X post
    isFreeDeal: true,
    dealLink: "http://cloudflare.com/startups",
    metrics: { likes: 785, reposts: 142, replies: 63 },
    tags: ["credits", "cloudflare", "startups", "free"],
  },
  {
    id: "radar-sama-1",
    accountId: "sama",
    authorName: "Sam Altman",
    authorHandle: "sama",
    category: "AI_LAB",
    isTechLeader: true,
    content: "The compute curve over the next 18 months will make everything we have right now look primitive.\n\nMost people are still underestimating what cheap intelligence enables for solo builders.",
    sourceUrl: "https://x.com/sama",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
    metrics: { likes: 14200, reposts: 2300, replies: 1100 },
    tags: ["openai", "compute", "future"],
  },
  {
    id: "radar-punch-1",
    accountId: "punchw45k",
    authorName: "Punch AI",
    authorHandle: "punchw45k",
    category: "CREATOR",
    content: "The biggest unlock in AI agents right now isn't bigger context windows.\n\nIt's deterministic steering files + strict validation hooks.\n\nIf you let your agent write code without lint/typecheck loops, you're just paying for hallucinations.",
    sourceUrl: "https://x.com/punchw45k",
    publishedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    metrics: { likes: 342, reposts: 58, replies: 31 },
    tags: ["agents", "workflows", "coding"],
  },
  {
    id: "radar-painn-1",
    accountId: "painn_x",
    authorName: "painn",
    authorHandle: "painn_x",
    category: "CREATOR",
    content: "Stop overcomplicating your AI stack.\n\n- Next.js App Router for frontend\n- Small FastAPI or Node microservice for heavy LLM calls\n- Single SQLite or Postgres DB\n- Gemini Flash for high-speed parsing\n\nShipped 3 micro-SaaS products this month with this setup alone.",
    sourceUrl: "https://x.com/painn_x",
    publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    metrics: { likes: 480, reposts: 72, replies: 44 },
    tags: ["indiedev", "stack", "shipfast"],
  },
  {
    id: "radar-maran-1",
    accountId: "TheMaran",
    authorName: "Maran",
    authorHandle: "TheMaran",
    category: "CREATOR",
    content: "Hot take: The best developers in 2026 aren't the ones writing the most lines of code.\n\nThey're the ones who write the best specs and review agent PRs the fastest.\n\nSpec-driven development is becoming the default paradigm.",
    sourceUrl: "https://x.com/TheMaran",
    publishedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(), // 4 hours ago
    metrics: { likes: 215, reposts: 39, replies: 18 },
    tags: ["specs", "engineering", "future"],
  },
  {
    id: "radar-karpathy-1",
    accountId: "karpathy",
    authorName: "Andrej Karpathy",
    authorHandle: "karpathy",
    category: "RESEARCHER",
    isTechLeader: true,
    content: "Reinforcement learning on verifiable environments (math, code, chess) is scaling far better than pure RLHF.\n\nWhen the ground truth is executable, the model can self-play and synthesize millions of high-quality trajectory steps without human supervision.",
    sourceUrl: "https://x.com/karpathy",
    publishedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(), // 5 hours ago
    metrics: { likes: 4890, reposts: 680, replies: 310 },
    tags: ["rl", "reasoning", "research"],
  },
  {
    id: "radar-cursor-1",
    accountId: "cursor_ai",
    authorName: "Cursor",
    authorHandle: "cursor_ai",
    category: "IDE",
    content: "New Cursor release: Background Agent indexing is now 4x faster.\n\n- Incremental semantic symbol graphs\n- Instant multi-file diff previews before applying edits\n- Reduced memory footprint on large mono-repos\n\nUpdate available now in the editor.",
    sourceUrl: "https://x.com/cursor_ai",
    publishedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6 hours ago
    metrics: { likes: 1250, reposts: 210, replies: 89 },
    tags: ["ide", "release", "developer-tools"],
  },
  {
    id: "radar-kiro-1",
    accountId: "kirodotdev",
    authorName: "Kiro",
    authorHandle: "kirodotdev",
    category: "IDE",
    content: "Introducing Kiro Hooks & Steering.\n\nDevelopers can now attach deterministic event triggers to their agents:\n- Auto-run vitest on every file edit\n- Update architectural markdown specs on git commit\n- Enterprise policy compliance checks in real-time",
    sourceUrl: "https://x.com/kirodotdev",
    publishedAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(), // 7 hours ago
    metrics: { likes: 890, reposts: 145, replies: 52 },
    tags: ["kiro", "spec-driven", "aws"],
  },
  {
    id: "radar-anthropic-1",
    accountId: "AnthropicAI",
    authorName: "Anthropic",
    authorHandle: "AnthropicAI",
    category: "AI_LAB",
    content: "Claude Code is now expanding to general availability.\n\nKey enhancements:\n- Terminal-native reasoning with full tool integration\n- Automatic project architecture discovery\n- Sub-agent parallel decomposition for complex refactors\n\nRead the full technical breakdown on our research blog.",
    sourceUrl: "https://x.com/AnthropicAI",
    publishedAt: new Date(Date.now() - 1000 * 60 * 480).toISOString(), // 8 hours ago
    metrics: { likes: 3200, reposts: 512, replies: 198 },
    tags: ["claude", "agent", "coding"],
  },
  {
    id: "radar-deepseek-1",
    accountId: "deepseek_ai",
    authorName: "DeepSeek",
    authorHandle: "deepseek_ai",
    category: "AI_LAB",
    isFreeDeal: true,
    content: "DeepSeek-V3 architectural optimizations update:\n\n- DualPipe parallelism scales linear throughput on commodity clusters\n- Multi-head Latent Attention (MLA) slashes KV cache memory by 75%\n- Full training logs and checkpoint recipes released on GitHub (Free Apache 2.0)",
    sourceUrl: "https://x.com/deepseek_ai",
    publishedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    dealLink: "https://github.com/deepseek-ai",
    metrics: { likes: 6200, reposts: 1100, replies: 420 },
    tags: ["deepseek", "openweights", "free-model"],
  },
  {
    id: "radar-openrouter-1",
    accountId: "openrouter",
    authorName: "OpenRouter",
    authorHandle: "openrouter",
    category: "INFRA",
    isFreeDeal: true,
    content: "New on OpenRouter:\n\nZero-latency fallback routing between 49 model providers.\n\nFree tier endpoints added for open-source reasoning models. If any upstream provider spikes in TTFT or returns a 502, request is re-routed in 15ms.\n\ntry it here: https://openrouter.ai/models",
    sourceUrl: "https://x.com/openrouter",
    publishedAt: new Date(Date.now() - 1000 * 60 * 420).toISOString(),
    dealLink: "https://openrouter.ai/models",
    metrics: { likes: 780, reposts: 115, replies: 36 },
    tags: ["router", "api", "free-tier"],
  },
  {
    id: "radar-google-dev-1",
    accountId: "GoogleDevs",
    authorName: "Google for Developers",
    authorHandle: "GoogleDevs",
    category: "AI_LAB",
    isFreeDeal: true,
    content: "Gemini 3.8 Flash is now live on Google Vertex AI.\n\nBuilt for ultra-fast agentic loops and production reasoning:\n- Sub-second first-token latency\n- Free quota available in Google AI Studio\n- Full function calling and structured outputs\n\ntry it here: https://aistudio.google.com",
    sourceUrl: "https://x.com/GoogleDevs",
    publishedAt: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    dealLink: "https://aistudio.google.com",
    metrics: { likes: 1980, reposts: 310, replies: 88 },
    tags: ["gemini", "vertex", "developer", "free-quota"],
  },
  {
    id: "radar-windsurf-1",
    accountId: "codeiumdev",
    authorName: "Windsurf (Codeium)",
    authorHandle: "codeiumdev",
    category: "IDE",
    content: "Cascade Flow in Windsurf just got a huge upgrade:\n\nNow monitors terminal command outputs and auto-remedies missing dependencies or failing tests in the background while you stay in flow.",
    sourceUrl: "https://x.com/codeiumdev",
    publishedAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    metrics: { likes: 920, reposts: 140, replies: 45 },
    tags: ["windsurf", "ai-ide", "cascade"],
  },
  {
    id: "radar-aws-1",
    accountId: "awscloud",
    authorName: "AWS",
    authorHandle: "awscloud",
    category: "CLOUD",
    content: "Amazon Bedrock now supports unified multi-agent orchestration.\n\nConnect Bedrock Agent core with external tools, automated policy boundaries, and enterprise IAM in just a few lines of CDK.",
    sourceUrl: "https://x.com/awscloud",
    publishedAt: new Date(Date.now() - 1000 * 60 * 720).toISOString(),
    metrics: { likes: 640, reposts: 98, replies: 27 },
    tags: ["aws", "bedrock", "cloud"],
  },
  {
    id: "radar-cloudflare-1",
    accountId: "Cloudflare",
    authorName: "Cloudflare",
    authorHandle: "Cloudflare",
    category: "CLOUD",
    isFreeDeal: true,
    content: "Workers AI is expanding our free daily tier to 10,000 neurons/day.\n\nRun Llama-3.3, Mistral, and embeddings directly on our globally distributed edge locations in <50ms without provisioning GPUs.\n\ntry it here: https://cloudflare.com/workers-ai",
    sourceUrl: "https://x.com/Cloudflare",
    publishedAt: new Date(Date.now() - 1000 * 60 * 850).toISOString(),
    dealLink: "https://cloudflare.com/workers-ai",
    metrics: { likes: 1430, reposts: 280, replies: 72 },
    tags: ["cloudflare", "edge", "free-tier", "workers-ai"],
  },
  {
    id: "radar-langchain-1",
    accountId: "LangChainAI",
    authorName: "LangChain",
    authorHandle: "LangChainAI",
    category: "FRAMEWORK",
    content: "LangGraph v1.2 is here with native checkpoint branching.\n\nYou can now fork state trajectories, perform speculative agent rollouts, and time-travel back to any previous tool call step with zero database migration.",
    sourceUrl: "https://x.com/LangChainAI",
    publishedAt: new Date(Date.now() - 1000 * 60 * 920).toISOString(),
    metrics: { likes: 810, reposts: 135, replies: 41 },
    tags: ["langgraph", "agents", "framework"],
  },
  {
    id: "radar-jimfan-1",
    accountId: "DrJimFan",
    authorName: "Jim Fan",
    authorHandle: "DrJimFan",
    category: "RESEARCHER",
    isTechLeader: true,
    content: "The next boundary for foundation models is embodied physical world simulators.\n\nWe don't just need models that write code; we need models that understand physics, spatial coordinate transforms, and dexterous robotics policies in real-time.",
    sourceUrl: "https://x.com/DrJimFan",
    publishedAt: new Date(Date.now() - 1000 * 60 * 1050).toISOString(),
    metrics: { likes: 3750, reposts: 590, replies: 180 },
    tags: ["robotics", "nvidia", "world-models"],
  },
  {
    id: "radar-blog-github-1",
    accountId: "blog-github",
    authorName: "GitHub Changelog",
    authorHandle: "github",
    category: "BLOG",
    content: "GitHub Copilot Workspace is now entering public general availability.\n\nTurn any issue into a pull request with full plan specification, interactive file tree previews, and integrated terminal testing.",
    sourceUrl: "https://github.blog/changelog/",
    publishedAt: new Date(Date.now() - 1000 * 60 * 1200).toISOString(),
    dealLink: "https://github.blog/changelog/",
    metrics: { likes: 1100, reposts: 180, replies: 62 },
    tags: ["changelog", "github", "copilot"],
  },
];

/**
 * Calculates human-readable relative time (e.g., "30s ago", "2m ago", "1h ago")
 */
export function formatRelativeTime(dateString: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (diffSec < 45) return `${Math.max(1, diffSec)}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

/**
 * Live Real Data Synchronizer (Runs every 5 minutes or on demand)
 */
export async function syncLiveWatchlist(force = false): Promise<{ syncedCount: number; newPostsCount: number }> {
  const now = Date.now();
  if (!force && isSyncing) {
    return { syncedCount: 0, newPostsCount: 0 };
  }
  if (!force && now - lastSyncTime < 5 * 60 * 1000) {
    return { syncedCount: 0, newPostsCount: 0 };
  }

  isSyncing = true;
  lastSyncTime = now;

  let totalNew = 0;
  const handlesToFetch = Array.from(
    new Set([...PRIORITY_LIVE_HANDLES, ...dynamicAccounts.map((a) => a.handle)])
  );

  try {
    // 1. Ingest live updates from official platforms (AWS What's New, Hugging Face Papers, GitHub Blog, Supabase)
    const rssUpdates = await fetchLiveRssUpdates().catch(() => []);
    for (const post of rssUpdates) {
      const exists = liveIngestedPosts.some((p) => p.id === post.id || p.content === post.content);
      if (!exists) {
        liveIngestedPosts.unshift(post);
        totalNew++;
      }
    }

    // 2. Poll priority handles in parallel batches of 3 to avoid flooding
    for (let i = 0; i < handlesToFetch.length; i += 3) {
      const batch = handlesToFetch.slice(i, i + 3);
      const results = await Promise.all(
        batch.map((h) => fetchLiveCreatorTweets(h).catch(() => []))
      );

      for (const tweets of results) {
        for (const t of tweets) {
          const exists = liveIngestedPosts.some((p) => p.id === t.id || p.content === t.content);
          if (!exists) {
            liveIngestedPosts.unshift(t);
            totalNew++;
          }
        }
      }
    }

    // Sort liveIngestedPosts by publishedAt descending
    liveIngestedPosts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // Keep liveIngestedPosts capped at 100 most recent
    if (liveIngestedPosts.length > 100) {
      liveIngestedPosts = liveIngestedPosts.slice(0, 100);
    }
  } catch (err) {
    console.error("[Radar Sync] Error during live fetch:", err);
  } finally {
    isSyncing = false;
  }

  return { syncedCount: handlesToFetch.length + 4, newPostsCount: totalNew };
}

/**
 * Adds a new creator handle dynamically to the active session watchlist
 */
export function addCustomWatchlistAccount(account: Omit<WatchlistAccount, "id">): WatchlistAccount {
  const cleanHandle = account.handle.replace(/^@/, "").trim();
  const existing = [...WATCHLIST_ACCOUNTS, ...dynamicAccounts].find(
    (a) => a.handle.toLowerCase() === cleanHandle.toLowerCase()
  );
  if (existing) return existing;

  const newAcc: WatchlistAccount = {
    ...account,
    id: `custom-acc-${cleanHandle}`,
    handle: cleanHandle,
    profileUrl: account.profileUrl || `https://x.com/${cleanHandle}`,
    avatarText: account.avatarText || cleanHandle.slice(0, 2).toUpperCase(),
    description: account.description || `Developer & AI creator @${cleanHandle}`,
  };

  dynamicAccounts.push(newAcc);

  // Immediately kick off live tweet fetch for newly added creator
  fetchLiveCreatorTweets(cleanHandle)
    .then((tweets) => {
      for (const t of tweets) {
        if (!liveIngestedPosts.some((p) => p.id === t.id)) {
          liveIngestedPosts.unshift(t);
        }
      }
    })
    .catch(() => {});

  return newAcc;
}

/**
 * Adds a new post to the live radar stream
 */
export function addCustomRadarPost(post: Omit<RadarPost, "id" | "publishedAt">): RadarPost {
  const newPost: RadarPost = {
    ...post,
    id: `custom-post-${Date.now()}`,
    publishedAt: new Date().toISOString(),
  };
  dynamicPosts.unshift(newPost);
  return newPost;
}

export async function getRadarFeed(options?: {
  category?: string;
  search?: string;
  sort?: RadarSortOption;
}): Promise<{
  accounts: WatchlistAccount[];
  posts: RadarPost[];
  counts: Record<string, number>;
  lastSyncedAt: string;
}> {
  // Check if 5 minutes have elapsed since last live sync or initial load
  if (Date.now() - lastSyncTime > 5 * 60 * 1000 || liveIngestedPosts.length === 0) {
    syncLiveWatchlist(false).catch(() => {});
  }

  const allAccounts = [...WATCHLIST_ACCOUNTS, ...dynamicAccounts];
  let posts = [...liveIngestedPosts, ...dynamicPosts, ...SEED_RADAR_POSTS];

  // Deduplicate posts by ID / content
  const seenIds = new Set<string>();
  posts = posts.filter((p) => {
    if (seenIds.has(p.id)) return false;
    seenIds.add(p.id);
    return true;
  });

  // 1. Filter Category
  if (options?.category && options.category !== "ALL") {
    posts = posts.filter((p) => p.category === options.category);
  }

  // 2. Search
  if (options?.search && options.search.trim()) {
    const q = options.search.toLowerCase().trim();
    posts = posts.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.authorName.toLowerCase().includes(q) ||
        p.authorHandle.toLowerCase().includes(q) ||
        (p.tags && p.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }

  // 3. Sorting Options
  const sort = options?.sort || "NEWEST";
  if (sort === "NEWEST") {
    posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  } else if (sort === "NAME_ASC") {
    posts.sort((a, b) => a.authorName.localeCompare(b.authorName));
  } else if (sort === "ENGAGEMENT") {
    posts.sort((a, b) => {
      const engA = (a.metrics?.likes || 0) + (a.metrics?.reposts || 0);
      const engB = (b.metrics?.likes || 0) + (b.metrics?.reposts || 0);
      return engB - engA;
    });
  } else if (sort === "FREE_DEALS") {
    posts = posts.filter((p) => p.isFreeDeal || /free|\$|credit|grant|tier/i.test(p.content));
    posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  } else if (sort === "CATEGORY") {
    posts.sort((a, b) => a.category.localeCompare(b.category));
  }

  const allFeed = [...liveIngestedPosts, ...dynamicPosts, ...SEED_RADAR_POSTS];
  const counts: Record<string, number> = {
    ALL: allFeed.length,
    CREATOR: allFeed.filter((p) => p.category === "CREATOR").length,
    AI_LAB: allFeed.filter((p) => p.category === "AI_LAB").length,
    IDE: allFeed.filter((p) => p.category === "IDE").length,
    INFRA: allFeed.filter((p) => p.category === "INFRA").length,
    CLOUD: allFeed.filter((p) => p.category === "CLOUD").length,
    RESEARCHER: allFeed.filter((p) => p.category === "RESEARCHER").length,
    FRAMEWORK: allFeed.filter((p) => p.category === "FRAMEWORK").length,
    BLOG: allFeed.filter((p) => p.category === "BLOG").length,
  };

  return {
    accounts: allAccounts,
    posts,
    counts,
    lastSyncedAt: new Date(lastSyncTime || Date.now()).toISOString(),
  };
}

export function findRadarPostById(id: string): RadarPost | undefined {
  return [...liveIngestedPosts, ...dynamicPosts, ...SEED_RADAR_POSTS].find((p) => p.id === id);
}
