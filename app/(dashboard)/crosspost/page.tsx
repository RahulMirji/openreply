"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import AccountSelect, { type AccountOption } from "@/components/account-select";
import XDraftReviewModal from "@/components/x-draft-review-modal";
import XWebPublishModal from "@/components/x-web-publish-modal";
import XConnectCard from "@/components/x-connect-card";
import RadarFeed from "@/components/radar-feed";
import RadarAiChat from "@/components/radar-ai-chat";
import { Sparkles, Camera, Share2, MessageSquare } from "lucide-react";
import type { XCrossPostDraft } from "@/app/generated/prisma/client";

interface InstagramPost {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp: string;
}

export default function CrossPostPage() {
  const [activeSourceTab, setActiveSourceTab] = useState<"INSTAGRAM" | "RADAR" | "AI_CHAT">("RADAR");
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [drafts, setDrafts] = useState<Record<string, XCrossPostDraft>>({});
  const [loading, setLoading] = useState(true);
  const [preparingId, setPreparingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<XCrossPostDraft | null>(null);
  const [webPublishDraft, setWebPublishDraft] = useState<XCrossPostDraft | null>(null);
  const [filter, setFilter] = useState<
    "ALL" | "NEEDS_DRAFT" | "DRAFT" | "APPROVED" | "PUBLISHED"
  >("ALL");
  const [error, setError] = useState<string | null>(null);

  // 1-Click 100% Free Web Post with automatic media download
  function handlePostFreeWeb(draft: XCrossPostDraft) {
    // 1. Copy clean caption
    navigator.clipboard.writeText(draft.tweetText);

    // 2. Download media if present
    const urls =
      draft.selectedMediaUrls?.length > 0
        ? draft.selectedMediaUrls
        : draft.originalMediaUrls;
    if (urls && urls.length > 0) {
      const isVideo = draft.mediaType === "VIDEO";
      const a = document.createElement("a");
      a.href = `/api/x/drafts/${draft.id}/media-download?index=0`;
      a.download = `openreply-${isVideo ? "video" : "image"}-1.${isVideo ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // 3. Open X intent
    const intentUrl = new URL("https://x.com/intent/tweet");
    intentUrl.searchParams.set("text", draft.tweetText);
    window.open(intentUrl.toString(), "_blank", "noopener,noreferrer");

    // 4. Show guidance modal
    setWebPublishDraft(draft);
  }

  // Direct publish from approved card
  async function handlePublishFromCard(draft: XCrossPostDraft) {
    setPublishingId(draft.id);
    setError(null);
    try {
      const res = await fetch(`/api/x/drafts/${draft.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to publish to X");
      } else {
        setDrafts((prev) => ({
          ...prev,
          [draft.instagramPostId]: data.data.draft,
        }));
      }
    } catch {
      setError("Network error while publishing to X");
    } finally {
      setPublishingId(null);
    }
  }

  // 1. Load accounts
  useEffect(() => {
    fetch("/api/instagram/accounts")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data?.instagramAccounts?.length > 0) {
          setAccounts(res.data.instagramAccounts);
          setSelectedAccountId(res.data.selectedInstagramAccountId || res.data.instagramAccounts[0].id);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, []);

  // 2. Load posts and drafts when account changes
  useEffect(() => {
    if (!selectedAccountId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/instagram/posts?instagramAccountId=${selectedAccountId}&all=true`).then((r) => r.json()),
      fetch("/api/x/drafts").then((r) => r.json()),
    ])
      .then(([postsRes, draftsRes]) => {
        if (postsRes.success) {
          setPosts(postsRes.data || []);
        } else {
          setError(postsRes.error || "Failed to load posts");
        }

        if (draftsRes.success) {
          const draftMap: Record<string, XCrossPostDraft> = {};
          for (const d of draftsRes.data as XCrossPostDraft[]) {
            draftMap[d.instagramPostId] = d;
          }
          setDrafts(draftMap);
        }
      })
      .catch(() => setError("Failed to load cross-posting data"))
      .finally(() => setLoading(false));
  }, [selectedAccountId]);

  // Handle Prepare Draft
  async function handlePrepareDraft(post: InstagramPost) {
    setPreparingId(post.id);
    setError(null);

    try {
      const res = await fetch("/api/x/drafts/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instagramPostId: post.id,
          instagramAccountId: selectedAccountId,
          includeLink: false,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.draft) {
        const draft: XCrossPostDraft = json.data.draft;
        setDrafts((prev) => ({ ...prev, [post.id]: draft }));
        setActiveDraft(draft);
      } else {
        setError(json.error || "Failed to prepare draft");
      }
    } catch {
      setError("Network error while preparing draft");
    } finally {
      setPreparingId(null);
    }
  }

  // Filter posts
  const filteredPosts = posts.filter((post) => {
    const draft = drafts[post.id];
    if (filter === "NEEDS_DRAFT") return !draft;
    if (filter === "DRAFT") return draft && draft.status === "DRAFT";
    if (filter === "APPROVED") return draft && draft.status === "APPROVED";
    if (filter === "PUBLISHED") return draft && draft.status === "PUBLISHED";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            X (Twitter) Cross-Posting & AI Radar
          </h1>
          <p className="mt-1 text-sm text-muted">
            Curate viral developer insights with Gemini 3.8 Flash, or cross-post your Instagram media to X.
          </p>
        </div>

        {activeSourceTab === "INSTAGRAM" && accounts.length > 0 && (
          <div className="w-full sm:w-auto">
            <AccountSelect
              accounts={accounts}
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              includeAll={false}
              label="Select Account"
            />
          </div>
        )}
      </div>

      {/* Primary Mode Switcher */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveSourceTab("RADAR")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeSourceTab === "RADAR"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border bg-white text-muted hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          AI Tech Radar (Watchlist)
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
            Live
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSourceTab("AI_CHAT")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeSourceTab === "AI_CHAT"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border bg-white text-muted hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          AI Curator Chat (Idea to Post)
          <span className="rounded-full bg-accent/15 text-accent px-2 py-0.5 text-[10px] font-bold">
            3 Modes
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSourceTab("INSTAGRAM")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
            activeSourceTab === "INSTAGRAM"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border bg-white text-muted hover:bg-surface-hover hover:text-foreground"
          }`}
        >
          <Camera className="h-4 w-4" />
          Instagram Cross-Post
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted">
            {posts.length} posts
          </span>
        </button>
      </div>

      {/* X Account Connection Card */}
      <XConnectCard />

      {/* View: AI Tech Radar */}
      {activeSourceTab === "RADAR" ? (
        <RadarFeed onOpenChat={() => setActiveSourceTab("AI_CHAT")} />
      ) : activeSourceTab === "AI_CHAT" ? (
        <RadarAiChat />
      ) : (
        /* View: Instagram Cross-Posting */
        <div className="space-y-6">
          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {(
          [
            { key: "ALL", label: `All Posts (${posts.length})` },
            {
              key: "NEEDS_DRAFT",
              label: `Needs Draft (${posts.filter((p) => !drafts[p.id]).length})`,
            },
            {
              key: "DRAFT",
              label: `In Review (${posts.filter((p) => drafts[p.id]?.status === "DRAFT").length})`,
            },
            {
              key: "APPROVED",
              label: `Approved (${posts.filter((p) => drafts[p.id]?.status === "APPROVED").length})`,
            },
            {
              key: "PUBLISHED",
              label: `Published (${posts.filter((p) => drafts[p.id]?.status === "PUBLISHED").length})`,
            },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              filter === key
                ? "bg-foreground text-background font-semibold"
                : "text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="panel h-72 animate-pulse rounded-xl p-4">
              <div className="aspect-square w-full rounded-lg bg-zinc-200" />
              <div className="mt-3 h-4 w-3/4 rounded bg-zinc-200" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="panel rounded-xl p-12 text-center text-sm text-muted">
          No posts match the selected filter.
        </div>
      ) : (
        /* Post Grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredPosts.map((post) => {
            const draft = drafts[post.id];
            const isPreparing = preparingId === post.id;
            const thumb = post.thumbnail_url || post.media_url;

            return (
              <div
                key={post.id}
                className="panel flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface transition hover:border-zinc-400/60"
              >
                <div>
                  {/* Thumbnail */}
                  <div className="relative aspect-square w-full overflow-hidden bg-zinc-950">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt="Instagram thumbnail"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">
                        No Preview
                      </div>
                    )}

                    <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {post.media_type}
                    </span>

                    {/* Status Badge */}
                    {draft && (
                      <span
                        className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                          draft.status === "PUBLISHED"
                            ? "bg-black text-white"
                            : draft.status === "APPROVED"
                            ? "bg-green-600 text-white"
                            : draft.status === "REJECTED"
                            ? "bg-red-600 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {draft.status === "DRAFT" ? "DRAFT READY" : draft.status}
                      </span>
                    )}
                  </div>

                  {/* Caption snippet */}
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted">
                      {draft?.tweetText || post.caption || "No caption"}
                    </p>
                    <p className="mt-2 text-[10px] text-zinc-400">
                      {new Date(post.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Card Action */}
                <div className="border-t border-border p-3">
                  {draft ? (
                    draft.status === "APPROVED" ? (
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          disabled={publishingId === draft.id}
                          onClick={() => handlePublishFromCard(draft)}
                          className="w-full rounded-lg bg-black py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition shadow-xs cursor-pointer"
                        >
                          {publishingId === draft.id ? "Publishing to X..." : "Publish to X 𝕏"}
                        </button>
                        <div className="flex items-center justify-between px-0.5">
                          <button
                            type="button"
                            onClick={() => handlePostFreeWeb(draft)}
                            className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
                            title="Auto-downloads media, copies caption, and opens X Web Composer (100% Free)"
                          >
                            Post Free (Web ↗)
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveDraft(draft)}
                            className="text-[11px] text-muted hover:text-foreground transition cursor-pointer"
                          >
                            Edit draft
                          </button>
                        </div>
                      </div>
                    ) : draft.status === "PUBLISHED" ? (
                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs font-semibold text-green-700">✓ Published</span>
                        {draft.xTweetUrl && (
                          <a
                            href={draft.xTweetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-accent hover:underline font-medium"
                          >
                            View on X ↗
                          </a>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setActiveDraft(draft)}
                        className="w-full rounded-lg border border-border bg-white py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition"
                      >
                        Review & Edit
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled={isPreparing}
                      onClick={() => handlePrepareDraft(post)}
                      className="w-full rounded-lg bg-accent py-1.5 text-xs font-semibold text-white hover:bg-accent-hover disabled:opacity-50 transition"
                    >
                      {isPreparing ? "Preparing Draft..." : "Prepare X Draft"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
      )}

      {/* Review & Approval Modal */}
      {activeDraft && (
        <XDraftReviewModal
          draft={activeDraft}
          isOpen={Boolean(activeDraft)}
          onClose={() => setActiveDraft(null)}
          onUpdate={(updated) => {
            setDrafts((prev) => ({ ...prev, [updated.instagramPostId]: updated }));
            setActiveDraft(updated);
          }}
        />
      )}

      {/* 100% Free Web Post Helper Modal */}
      {webPublishDraft && (
        <XWebPublishModal
          draft={webPublishDraft}
          isOpen={Boolean(webPublishDraft)}
          onClose={() => setWebPublishDraft(null)}
          onMarkPublished={(updated) => {
            setDrafts((prev) => ({ ...prev, [updated.instagramPostId]: updated }));
          }}
        />
      )}
    </div>
  );
}
