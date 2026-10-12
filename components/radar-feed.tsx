"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  Flame,
  Code2,
  Cpu,
  Cloud,
  User,
  PlusCircle,
  RefreshCw,
  Heart,
  Repeat2,
  CheckCircle2,
  ArrowUpDown,
  Gift,
  Crown,
  UserPlus,
  Terminal,
  BookOpen,
  Server,
  MessageSquare,
} from "lucide-react";
import type { RadarPost, WatchlistAccount, WatchlistCategory } from "@/lib/radar/directory";
import { formatRelativeTime } from "@/lib/radar/service";
import RadarCurateModal from "./radar-curate-modal";

export default function RadarFeed({ onOpenChat }: { onOpenChat?: () => void } = {}) {
  const [posts, setPosts] = useState<RadarPost[]>([]);
  const [accounts, setAccounts] = useState<WatchlistAccount[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [sort, setSort] = useState<"NEWEST" | "NAME_ASC" | "ENGAGEMENT" | "FREE_DEALS" | "CATEGORY">("NEWEST");
  const [selectedPost, setSelectedPost] = useState<RadarPost | null>(null);
  const [isCurateOpen, setIsCurateOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncText, setLastSyncText] = useState<string>("just now");

  // Automated 5-minute background polling interval
  useEffect(() => {
    const syncInterval = setInterval(() => {
      triggerLiveSync(false);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(syncInterval);
  }, []);

  // Time ticker to update relative times every 15 seconds
  const [, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTicker((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  // Quick Curate custom input state
  const [customText, setCustomText] = useState("");
  const [customHandle, setCustomHandle] = useState("");
  const [showCustomBox, setShowCustomBox] = useState(false);

  // Add Creator state
  const [showAddCreator, setShowAddCreator] = useState(false);
  const [newCreatorName, setNewCreatorName] = useState("");
  const [newCreatorHandle, setNewCreatorHandle] = useState("");
  const [newCreatorCategory, setNewCreatorCategory] = useState<WatchlistCategory>("CREATOR");

  useEffect(() => {
    fetchFeed();
  }, [category, sort]);

  async function triggerLiveSync(isManual = true) {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/x/radar/sync", { method: "POST" });
      const json = await res.json();
      if (json.success && isManual) {
        const count = json.data?.newPostsCount || 0;
        setNotice(
          count > 0
            ? `Live synced! Fetched ${count} new real updates from AWS, Hugging Face, GitHub, and active watchlists.`
            : `Live sync complete! Watchlist feeds are up to date.`
        );
      }
      setLastSyncText("just now");
      await fetchFeed();
    } catch {
      console.error("Live sync error");
    } finally {
      setIsSyncing(false);
    }
  }

  async function fetchFeed() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (category !== "ALL") q.set("category", category);
      if (search.trim()) q.set("search", search.trim());
      q.set("sort", sort);

      const res = await fetch(`/api/x/radar?${q.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setPosts(json.data.posts || []);
        setAccounts(json.data.accounts || []);
        setCounts(json.data.counts || {});
      }
    } catch {
      console.error("Failed to load radar feed");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchFeed();
  }

  function handleOpenCurate(post: RadarPost) {
    setSelectedPost(post);
    setIsCurateOpen(true);
  }

  function handleCurateCustom() {
    if (!customText.trim()) return;
    const virtualPost: RadarPost = {
      id: "custom-" + Date.now(),
      accountId: "custom",
      authorName: customHandle ? customHandle.replace(/^@/, "") : "Tech Creator",
      authorHandle: customHandle ? customHandle.replace(/^@/, "") : "creator",
      category: "CREATOR",
      content: customText.trim(),
      sourceUrl: "https://x.com",
      publishedAt: new Date().toISOString(),
      isFreeDeal: /free|\$|credit|grant|tier/i.test(customText),
      isTechLeader: /sama|karpathy|amodei|altman/i.test(customHandle),
    };
    setSelectedPost(virtualPost);
    setIsCurateOpen(true);
  }

  async function handleAddCreatorSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newCreatorHandle.trim()) return;

    try {
      const res = await fetch("/api/x/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_ACCOUNT",
          name: newCreatorName || newCreatorHandle.replace(/^@/, ""),
          handle: newCreatorHandle.replace(/^@/, "").trim(),
          category: newCreatorCategory,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setNotice(`Added @${newCreatorHandle.replace(/^@/, "")} to active Watchlist!`);
        setShowAddCreator(false);
        setNewCreatorName("");
        setNewCreatorHandle("");
        fetchFeed();
      }
    } catch {
      console.error("Failed to add creator");
    }
  }

  const categoryTabs = [
    { key: "ALL", label: `All Updates (${counts.ALL ?? 0})`, icon: Flame },
    { key: "CREATOR", label: `Selected Creators (${counts.CREATOR ?? 0})`, icon: User },
    { key: "AI_LAB", label: `AI Labs & Models (${counts.AI_LAB ?? 0})`, icon: Cpu },
    { key: "IDE", label: `Coding & IDEs (${counts.IDE ?? 0})`, icon: Code2 },
    { key: "INFRA", label: `Routers & Infra (${counts.INFRA ?? 0})`, icon: Server },
    { key: "CLOUD", label: `Cloud & Platforms (${counts.CLOUD ?? 0})`, icon: Cloud },
    { key: "RESEARCHER", label: `Researchers (${counts.RESEARCHER ?? 0})`, icon: Sparkles },
    { key: "FRAMEWORK", label: `Frameworks & OSS (${counts.FRAMEWORK ?? 0})`, icon: Terminal },
    { key: "BLOG", label: `Changelogs & Blogs (${counts.BLOG ?? 0})`, icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Notice Toast */}
      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-3.5 text-xs font-medium text-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-green-700 hover:text-green-900">✕</button>
        </div>
      )}

      {/* Top Banner / Watchlist Summary */}
      <div className="panel rounded-2xl border border-border bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              <h2 className="text-base font-bold text-foreground">
                AI Tech & Creator Radar
              </h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                Gemini 3.8 Powered
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Live radar tracking 80+ AI model labs, developer tools & IDEs, infra routers, cloud platforms, and researchers with 5-minute real data synchronization.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenChat ? (
              <button
                type="button"
                onClick={onOpenChat}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition shadow-xs"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat with AI</span>
              </button>
            ) : (
              <Link
                href="/chat"
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition shadow-xs"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat with AI</span>
              </Link>
            )}

            <button
              onClick={() => setShowAddCreator(!showAddCreator)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-hover transition"
            >
              <UserPlus className="h-3.5 w-3.5 text-primary" />
              Add Creator
            </button>

            <button
              onClick={() => setShowCustomBox(!showCustomBox)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-hover transition"
            >
              <PlusCircle className="h-3.5 w-3.5 text-primary" />
              {showCustomBox ? "Close Custom" : "Curate Any Post"}
            </button>

            <button
              onClick={() => triggerLiveSync(true)}
              disabled={isSyncing || loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium text-foreground hover:bg-surface-hover transition shadow-xs"
              title="Automatically syncs every 5 minutes"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-primary ${isSyncing ? "animate-spin" : ""}`}
              />
              <span>{isSyncing ? "Syncing X..." : "Live Sync (5m)"}</span>
            </button>
          </div>
        </div>

        {/* Add Creator Inline Form */}
        {showAddCreator && (
          <form onSubmit={handleAddCreatorSubmit} className="mt-4 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-foreground mb-2">
              Add New Creator or Company Account to Watchlist:
            </h4>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Name (e.g. K2S, Shadcn)"
                value={newCreatorName}
                onChange={(e) => setNewCreatorName(e.target.value)}
                className="w-48 rounded-xl border border-border bg-surface/50 px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-primary"
              />
              <input
                type="text"
                placeholder="X Handle (e.g. @k2sbhai)"
                value={newCreatorHandle}
                onChange={(e) => setNewCreatorHandle(e.target.value)}
                required
                className="w-48 rounded-xl border border-border bg-surface/50 px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-primary"
              />
              <select
                value={newCreatorCategory}
                onChange={(e) => setNewCreatorCategory(e.target.value as WatchlistCategory)}
                className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-foreground focus:outline-hidden"
              >
                <option value="CREATOR">Selected Creators</option>
                <option value="AI_LAB">AI Companies & Labs</option>
                <option value="IDE">Coding Tools & IDEs</option>
                <option value="INFRA">Routers & Infra</option>
                <option value="CLOUD">Cloud & Dev Platforms</option>
                <option value="RESEARCHER">AI Researchers & Creators</option>
                <option value="FRAMEWORK">AI Frameworks & OSS</option>
                <option value="BLOG">Official Blogs & Changelogs</option>
              </select>
              <button
                type="submit"
                className="rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 transition"
              >
                Save to Watchlist
              </button>
            </div>
          </form>
        )}

        {/* Quick Custom Input Drawer */}
        {showCustomBox && (
          <div className="mt-4 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-foreground mb-2">
              Curate Any Tweet or Announcement with Gemini 3.8 Flash:
            </h4>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="@handle (e.g. @k2sbhai)"
                  value={customHandle}
                  onChange={(e) => setCustomHandle(e.target.value)}
                  className="w-1/3 rounded-xl border border-border bg-surface/50 px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-primary"
                />
                <input
                  type="text"
                  placeholder="Paste the tweet, article insight, free credit perk, or announcement..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-surface/50 px-3 py-2 text-xs text-foreground focus:outline-hidden focus:border-primary"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCurateCustom}
                  disabled={!customText.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50 transition"
                >
                  <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
                  Generate 3 X Variations (&lt;275 chars)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Watchlist Quick Handles Horizontal Ribbon */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
          <span className="text-[11px] font-medium text-muted mr-1">
            Active Watchlist:
          </span>
          {accounts.slice(0, 16).map((acc) => (
            <a
              key={acc.id}
              href={acc.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-surface/40 px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface hover:text-primary transition"
            >
              {acc.isTechLeader && <Crown className="h-2.5 w-2.5 text-yellow-500" />}
              <span>@{acc.handle}</span>
            </a>
          ))}
          {accounts.length > 16 && (
            <span className="text-[11px] text-muted">
              +{accounts.length - 16} more
            </span>
          )}
        </div>
      </div>

      {/* Filter Tabs, Sort Selector & Search Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {categoryTabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                category === key
                  ? "bg-foreground text-background font-semibold"
                  : "border border-border bg-white text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sorting Selector */}
          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-2.5 py-1 text-xs text-foreground">
            <ArrowUpDown className="h-3 w-3 text-muted" />
            <span className="text-muted text-[11px]">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="bg-transparent font-medium text-foreground focus:outline-hidden text-xs cursor-pointer"
            >
              <option value="NEWEST">⏱️ Most Recent</option>
              <option value="NAME_ASC">🔤 Creator Name (A-Z)</option>
              <option value="ENGAGEMENT">🔥 Most Viral</option>
              <option value="FREE_DEALS">🎁 Free Deals & Credits</option>
              <option value="CATEGORY">🏷️ Category</option>
            </select>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
            <input
              type="text"
              placeholder="Search posts, deals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-white pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-hidden focus:border-primary"
            />
          </form>
        </div>
      </div>

      {/* Feed Stream */}
      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-white p-8">
          <RefreshCw className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted">
            Streaming latest AI updates from verified watchlist...
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white p-8 text-center">
          <Filter className="h-8 w-8 text-muted/60" />
          <p className="mt-2 text-sm font-semibold text-foreground">
            No updates match your filters
          </p>
          <p className="mt-1 text-xs text-muted">
            Try switching sorting, categories, or clearing search query.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {posts.map((post) => {
            const relTime = formatRelativeTime(post.publishedAt);
            const isFresh = relTime.includes("s ago") || (relTime.includes("m ago") && parseInt(relTime) <= 5);

            return (
              <div
                key={post.id}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition hover:border-border/90 ${
                  post.isFreeDeal
                    ? "border-green-500/40 bg-green-500/[0.02]"
                    : post.isTechLeader
                    ? "border-yellow-500/40 bg-yellow-500/[0.02]"
                    : "border-border"
                }`}
              >
                <div>
                  {/* Post Author Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/5 font-bold text-xs text-foreground border border-border">
                        {post.authorName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {post.authorName}
                          </span>
                          <a
                            href={post.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-muted hover:text-primary transition inline-flex items-center gap-0.5"
                          >
                            @{post.authorHandle}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>

                          {post.isTechLeader && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-500/10 px-2 py-0.2 text-[10px] font-bold text-yellow-600 dark:text-yellow-400">
                              <Crown className="h-2.5 w-2.5" />
                              Tech Leader
                            </span>
                          )}

                          {post.isFreeDeal && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-green-500/10 px-2 py-0.2 text-[10px] font-bold text-green-600 dark:text-green-400">
                              <Gift className="h-2.5 w-2.5" />
                              Free Credits / Deal
                            </span>
                          )}
                        </div>

                        {/* Relative Timestamp Display */}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            title={new Date(post.publishedAt).toLocaleString()}
                            className={`text-[11px] font-semibold ${
                              isFresh ? "text-green-600 dark:text-green-400 font-bold" : "text-muted"
                            }`}
                          >
                            ⏱️ {relTime}
                          </span>
                          <span className="text-[10px] text-muted">• {post.category.replace("_", " ")}</span>
                        </div>
                      </div>
                    </div>

                    <span className="rounded-lg bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
                      {post.tags?.[0] ? `#${post.tags[0]}` : "Update"}
                    </span>
                  </div>

                  {/* Content Snippet */}
                  <p className="mt-3.5 text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                    {post.content}
                  </p>

                  {/* Direct Deal Link if present */}
                  {post.dealLink && (
                    <div className="mt-2.5">
                      <a
                        href={post.dealLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-surface/80 px-2.5 py-1 text-[11px] font-medium text-primary hover:underline"
                      >
                        Apply / Access Here: {post.dealLink} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="mt-4 border-t border-border pt-3.5 flex items-center justify-between">
                  {/* Engagement Metrics */}
                  <div className="flex items-center gap-3 text-[11px] text-muted">
                    {post.metrics?.likes && (
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {post.metrics.likes.toLocaleString()}
                      </span>
                    )}
                    {post.metrics?.reposts && (
                      <span className="flex items-center gap-1">
                        <Repeat2 className="h-3 w-3" />
                        {post.metrics.reposts.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Curate Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenCurate(post)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Curate with Gemini
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Curate Modal */}
      <RadarCurateModal
        post={selectedPost}
        isOpen={isCurateOpen}
        onClose={() => setIsCurateOpen(false)}
        onSuccessNotice={(msg) => setNotice(msg)}
      />
    </div>
  );
}
