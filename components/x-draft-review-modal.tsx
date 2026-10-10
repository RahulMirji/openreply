"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { XCrossPostDraft } from "@/app/generated/prisma/client";
import { formatCleanXCaption } from "@/lib/x/media-adapter";
import XWebPublishModal from "./x-web-publish-modal";

interface XDraftReviewModalProps {
  draft: XCrossPostDraft;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedDraft: XCrossPostDraft) => void;
}

export default function XDraftReviewModal({
  draft,
  isOpen,
  onClose,
  onUpdate,
}: XDraftReviewModalProps) {
  const [tweetText, setTweetText] = useState(draft.tweetText);
  const [selectedMedia, setSelectedMedia] = useState<string[]>(draft.selectedMediaUrls);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishSuccessUrl, setPublishSuccessUrl] = useState<string | null>(
    draft.xTweetUrl ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showWebPublishModal, setShowWebPublishModal] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  function handleDownloadSlide(index: number) {
    const isVideo = draft.mediaType === "VIDEO";
    const a = document.createElement("a");
    a.href = `/api/x/drafts/${draft.id}/media-download?index=${index}`;
    a.download = `openreply-${isVideo ? "video" : "image"}-${index + 1}.${isVideo ? "mp4" : "jpg"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleDownloadAllSlides() {
    setDownloadingAll(true);
    try {
      for (let i = 0; i < selectedMedia.length; i++) {
        handleDownloadSlide(i);
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally {
      setTimeout(() => setDownloadingAll(false), 800);
    }
  }

  if (!isOpen) return null;

  const charCount = tweetText.length;
  const isOverLimit = charCount > 280;
  const isNearLimit = charCount >= 260 && charCount <= 280;

  async function handlePublishDirectly() {
    if (isOverLimit) {
      setError("Caption must be 280 characters or less.");
      return;
    }
    setPublishing(true);
    setError(null);

    try {
      // First ensure latest edits are saved
      await fetch(`/api/x/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetText,
          selectedMediaUrls: selectedMedia,
          status: "APPROVED",
        }),
      });

      // Now trigger publish
      const res = await fetch(`/api/x/drafts/${draft.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to publish to X");
      } else {
        setPublishSuccessUrl(data.data.tweetUrl);
        onUpdate(data.data.draft);
      }
    } catch {
      setError("Network error while publishing to X");
    } finally {
      setPublishing(false);
    }
  }

  async function handleSave(newStatus?: "DRAFT" | "APPROVED" | "REJECTED") {
    if (charCount > 280) {
      setError("Caption must be 280 characters or less for X.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/x/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tweetText,
          selectedMediaUrls: selectedMedia,
          status: newStatus ?? draft.status,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Failed to save draft");
      } else {
        onUpdate(data.data);
        if (newStatus === "APPROVED" || newStatus === "REJECTED") {
          onClose();
        }
      }
    } catch {
      setError("Network error while updating draft");
    } finally {
      setSaving(false);
    }
  }

  function handleToggleMedia(url: string) {
    if (selectedMedia.includes(url)) {
      // Detach this media
      setSelectedMedia(selectedMedia.filter((u) => u !== url));
      setError(null);
    } else {
      // Attach this media
      if (draft.mediaType === "VIDEO") {
        setSelectedMedia([url]);
        setError(null);
        return;
      }
      if (selectedMedia.length >= 4) {
        setError("X allows up to 4 images per tweet.");
        return;
      }
      setSelectedMedia([...selectedMedia, url]);
      setError(null);
    }
  }

  function handleCopyAndOpenX() {
    navigator.clipboard.writeText(tweetText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);

    // Auto-trigger download of attached media (image or video)
    if (selectedMedia.length > 0) {
      const isVideo = draft.mediaType === "VIDEO";
      const a = document.createElement("a");
      a.href = `/api/x/drafts/${draft.id}/media-download?index=0`;
      a.download = `openreply-${isVideo ? "video" : "image"}-1.${isVideo ? "mp4" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    const intentUrl = new URL("https://x.com/intent/tweet");
    intentUrl.searchParams.set("text", tweetText);
    window.open(intentUrl.toString(), "_blank", "noopener,noreferrer");

    setShowWebPublishModal(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="panel max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-6 shadow-2xl sm:p-8"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                Cross-Post Review
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  draft.status === "APPROVED"
                    ? "bg-green-100 text-green-800"
                    : draft.status === "REJECTED"
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {draft.status}
              </span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-foreground">
              Review & Adapt for X (Twitter)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-surface-hover hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {error && (
          error.toLowerCase().includes("credits depleted") ? (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-900 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <span>⚠️ X Developer API Credits Depleted</span>
              </div>
              <p className="mt-1 leading-relaxed text-amber-800">
                X (Twitter) switched developer accounts to a pay-per-use credit model ($0.015/post) and newly created projects start with 0 credits.
                You can post <strong>100% Free</strong> right now using the Web Composer button below (no credits needed, zero cost)!
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAndOpenX}
                  className="rounded-lg bg-black px-3 py-1.5 font-semibold text-white hover:bg-zinc-800 transition cursor-pointer shadow-xs"
                >
                  {copied ? "Copied! Opening X..." : "Post 100% Free via X Web Composer ↗"}
                </button>
                <a
                  href="https://developer.x.com/en/portal/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-100 transition"
                >
                  Check X Developer Portal Credits ↗
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-error">
              {error}
            </div>
          )
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left Column: Original Instagram Post */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">
                Instagram Original
              </span>
              {draft.instagramPermalink && (
                <a
                  href={draft.instagramPermalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline"
                >
                  View on Instagram ↗
                </a>
              )}
            </div>

            {draft.thumbnailUrl && (
              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-zinc-900">
                <img
                  src={draft.thumbnailUrl}
                  alt="Post preview"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                  {draft.mediaType}
                </span>
              </div>
            )}

            <div className="max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-white/50 p-3 text-xs leading-relaxed text-muted">
              {draft.originalCaption || <em>No caption</em>}
            </div>
          </div>

          {/* Right Column: X (Twitter) Post Editor & Preview */}
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="tweet-composer"
                    className="text-xs font-bold uppercase tracking-wide text-foreground"
                  >
                    X Tweet Composer
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const formatted = formatCleanXCaption(tweetText || draft.originalCaption || "");
                      setTweetText(formatted);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent hover:bg-accent/20 transition cursor-pointer"
                    title="Restructure with clean line gaps, '- ' lists, and no em dashes"
                  >
                    🪄 Format Clean (X Style)
                  </button>
                </div>
                <span
                  className={`text-xs font-mono font-medium ${
                    isOverLimit
                      ? "text-error font-bold"
                      : isNearLimit
                      ? "text-amber-600"
                      : "text-muted"
                  }`}
                >
                  {charCount} / 280
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                Clean gaps, hyphen lists (<code className="rounded bg-muted/20 px-1 font-mono text-[11px]">- item</code>), no em dashes, strictly capped at 280 chars.
              </p>

              <textarea
                id="tweet-composer"
                rows={7}
                maxLength={280}
                value={tweetText}
                onChange={(e) => setTweetText(e.target.value)}
                placeholder="What's happening?"
                className="mt-2 w-full rounded-xl border border-border bg-white p-3 font-sans text-sm leading-relaxed text-foreground outline-none transition focus:border-accent"
              />
            </div>

            {/* Media Selector for X */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-foreground">
                  Attached Media ({selectedMedia.length} / {draft.mediaType === "VIDEO" ? 1 : 4} max)
                </span>
                <span className="text-xs text-muted">Tap image to attach/detach</span>
              </div>

              {selectedMedia.length === 0 && (
                <div className="mt-2 rounded-lg border border-dashed border-border bg-surface p-2.5 text-center text-xs text-muted">
                  No media attached. This will post as a text-only tweet. Tap an image to re-attach.
                </div>
              )}

              <div className="mt-2 grid grid-cols-4 gap-2">
                {draft.originalMediaUrls.map((url, idx) => {
                  const isSelected = selectedMedia.includes(url);
                  return (
                    <div
                      key={idx}
                      onClick={() => handleToggleMedia(url)}
                      className={`relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition ${
                        isSelected
                          ? "border-accent ring-2 ring-accent/30"
                          : "border-border opacity-40 hover:opacity-75 grayscale"
                      }`}
                    >
                      <img
                        src={url}
                        alt={`Slide ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                      {isSelected ? (
                        <span className="absolute top-1 right-1 rounded-full bg-accent p-0.5 text-white shadow">
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                      ) : (
                        <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-medium text-white">
                          Detached
                        </span>
                      )}

                      {/* 1-Click direct slide download button on thumbnail */}
                      <button
                        type="button"
                        title={`Download Slide ${idx + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadSlide(idx);
                        }}
                        className="absolute bottom-1 right-1 rounded bg-black/80 p-1 text-white hover:bg-black transition cursor-pointer z-10 shadow-xs"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 100% Free 1-Click Publishing Helper */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 text-xs text-blue-900">
              <div className="font-semibold text-blue-950">100% Free Instant Publishing:</div>
              <p className="mt-0.5 text-blue-800">
                Clicking below copies your caption and opens the official X Web Composer with your tweet prefilled—ready to post in 1 second for ₹0.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAndOpenX}
                  className="rounded-lg bg-black px-3 py-1.5 font-medium text-white hover:bg-zinc-800 transition cursor-pointer"
                >
                  {copied ? "Copied! Opening X..." : "Open in X Web Composer ↗"}
                </button>
                {selectedMedia.length > 1 ? (
                  <button
                    type="button"
                    disabled={downloadingAll}
                    onClick={handleDownloadAllSlides}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer shadow-xs inline-flex items-center gap-1.5 text-xs"
                  >
                    {downloadingAll ? "Downloading All..." : `⬇️ Download All (${selectedMedia.length} Images)`}
                  </button>
                ) : selectedMedia.length === 1 ? (
                  <button
                    type="button"
                    onClick={() => handleDownloadSlide(0)}
                    className="rounded-lg border border-border bg-white px-2.5 py-1.5 font-medium text-foreground hover:bg-surface-hover inline-flex items-center gap-1 cursor-pointer text-xs"
                  >
                    ⬇️ Download {draft.mediaType === "VIDEO" ? "Video" : "Image"}
                  </button>
                ) : null}
              </div>

              {/* Individual Carousel Slide Download Options */}
              {selectedMedia.length > 1 && (
                <div className="mt-2.5 pt-2 border-t border-blue-200/70">
                  <span className="block text-[11px] font-semibold text-blue-950 mb-1">
                    Download Each Image Separately:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMedia.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDownloadSlide(idx)}
                        className="rounded-md bg-white border border-blue-300 px-2 py-0.5 text-[11px] font-medium text-blue-950 hover:bg-blue-100 transition cursor-pointer shadow-2xs inline-flex items-center gap-1"
                      >
                        ⬇️ Image {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving || publishing}
              onClick={() => handleSave("REJECTED")}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>
            {publishSuccessUrl && (
              <a
                href={publishSuccessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs font-semibold text-green-800 hover:underline"
              >
                ✓ View Tweet on X ↗
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={saving || publishing}
              onClick={() => handleSave("DRAFT")}
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              disabled={saving || publishing || isOverLimit}
              onClick={() => handleSave("APPROVED")}
              className="rounded-xl border border-accent text-accent px-4 py-2 text-sm font-semibold hover:bg-accent/5 disabled:opacity-50 transition"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={saving || publishing || isOverLimit}
              onClick={handlePublishDirectly}
              className="rounded-xl bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              {publishing ? "Publishing to X..." : "Publish to X 𝕏"}
            </button>
          </div>
        </div>
      </div>

      {showWebPublishModal && (
        <XWebPublishModal
          draft={draft}
          customText={tweetText}
          customMedia={selectedMedia}
          isOpen={showWebPublishModal}
          onClose={() => setShowWebPublishModal(false)}
          onMarkPublished={(updated) => {
            onUpdate(updated);
            onClose();
          }}
        />
      )}
    </div>
  );
}
