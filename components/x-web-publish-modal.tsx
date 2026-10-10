"use client";

import { useState } from "react";
import type { XCrossPostDraft } from "@/app/generated/prisma/client";

interface XWebPublishModalProps {
  draft: XCrossPostDraft;
  isOpen: boolean;
  onClose: () => void;
  onMarkPublished?: (draft: XCrossPostDraft) => void;
  customText?: string;
  customMedia?: string[];
}

export default function XWebPublishModal({
  draft,
  isOpen,
  onClose,
  onMarkPublished,
  customText,
  customMedia,
}: XWebPublishModalProps) {
  const [marking, setMarking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);

  if (!isOpen) return null;

  const textToPost = customText || draft.tweetText;
  const mediaToDownload =
    customMedia && customMedia.length > 0
      ? customMedia
      : draft.selectedMediaUrls && draft.selectedMediaUrls.length > 0
      ? draft.selectedMediaUrls
      : draft.originalMediaUrls;

  const hasMedia = mediaToDownload && mediaToDownload.length > 0;
  const isVideo = draft.mediaType === "VIDEO";

  function handleDownloadMedia(index = 0) {
    const a = document.createElement("a");
    a.href = `/api/x/drafts/${draft.id}/media-download?index=${index}`;
    a.download = `openreply-${isVideo ? "video" : "image"}-${index + 1}.${isVideo ? "mp4" : "jpg"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleDownloadAll() {
    setDownloadingAll(true);
    try {
      for (let i = 0; i < mediaToDownload.length; i++) {
        handleDownloadMedia(i);
        await new Promise((r) => setTimeout(r, 400));
      }
    } finally {
      setTimeout(() => setDownloadingAll(false), 800);
    }
  }

  function handleCopyText() {
    navigator.clipboard.writeText(textToPost);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReopenX() {
    const intentUrl = new URL("https://x.com/intent/tweet");
    intentUrl.searchParams.set("text", textToPost);
    window.open(intentUrl.toString(), "_blank", "noopener,noreferrer");
  }

  async function handleConfirmPublished() {
    setMarking(true);
    try {
      const res = await fetch(`/api/x/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "PUBLISHED",
          publishedAt: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success && onMarkPublished) {
        onMarkPublished(data.data);
      }
      onClose();
    } catch {
      onClose();
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="panel w-full max-w-lg rounded-2xl p-6 shadow-2xl sm:p-7 bg-white text-foreground"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white text-xs font-black">
              𝕏
            </span>
            <h3 className="text-base font-bold text-foreground">
              Posting Free via X Web Composer
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-foreground cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Step-by-step guidance */}
        <div className="mt-4 space-y-3.5">
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-xs text-blue-900 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <span>🚀 1. X Composer Opened in New Tab</span>
            </div>
            <p className="mt-1">
              Your adapted caption has been prefilled into X and copied to your clipboard.
            </p>
          </div>

          {hasMedia && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950 leading-relaxed">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-sm text-emerald-950">
                  📸 2. Attached Media ({mediaToDownload.length} {isVideo ? "video" : "images"})
                </span>
                {mediaToDownload.length > 1 ? (
                  <button
                    type="button"
                    disabled={downloadingAll}
                    onClick={handleDownloadAll}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    {downloadingAll ? "Downloading All..." : `⬇️ Download All (${mediaToDownload.length} Images)`}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDownloadMedia(0)}
                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition cursor-pointer shadow-xs inline-flex items-center gap-1"
                  >
                    ⬇️ Download {isVideo ? "Video" : "Image"}
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-emerald-800">
                In the X tab, simply <strong>drag and drop the images into the tweet box</strong> or tap the 🖼️ icon.
              </p>
              {mediaToDownload.length > 1 && (
                <div className="mt-3 pt-2.5 border-t border-emerald-200/80">
                  <span className="block text-[11px] font-semibold text-emerald-900 mb-1.5">
                    Download Images Separately:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {mediaToDownload.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleDownloadMedia(idx)}
                        className="rounded-lg bg-white border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 hover:border-emerald-400 transition cursor-pointer shadow-2xs inline-flex items-center gap-1"
                      >
                        ⬇️ Image {idx + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-xs text-zinc-800 leading-relaxed">
            <div className="font-bold flex items-center gap-1.5 text-zinc-950">
              <span>✨ 3. Click Post on X</span>
            </div>
            <p className="mt-1">
              Check your preview on X and hit <strong>Post</strong>. 100% Free with zero API credits required!
            </p>
          </div>
        </div>

        {/* Quick Helper Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleCopyText}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition cursor-pointer"
          >
            {copied ? "✓ Copied!" : "📋 Copy Caption Again"}
          </button>
          <button
            type="button"
            onClick={handleReopenX}
            className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition cursor-pointer"
          >
            𝕏 Re-open X Composer
          </button>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-muted hover:text-foreground hover:bg-surface-hover transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            disabled={marking}
            onClick={handleConfirmPublished}
            className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 transition cursor-pointer shadow-xs"
          >
            {marking ? "Marking..." : "✓ Mark as Published"}
          </button>
        </div>
      </div>
    </div>
  );
}
