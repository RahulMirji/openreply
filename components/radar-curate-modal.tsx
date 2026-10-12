"use client";

import { useState } from "react";
import {
  Sparkles,
  Copy,
  ExternalLink,
  Check,
  Send,
  AlertCircle,
  RefreshCw,
  Eye,
  Edit3,
  BadgeCheck,
  Flame,
  Code2,
  Gift,
} from "lucide-react";
import type { RadarPost } from "@/lib/radar/directory";
import type { CuratedVariation } from "@/lib/radar/curate";

export default function RadarCurateModal({
  post,
  isOpen,
  onClose,
  onSuccessNotice,
}: {
  post: RadarPost | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccessNotice?: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [variations, setVariations] = useState<CuratedVariation[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [editedText, setEditedText] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"PREVIEW" | "EDIT">("PREVIEW");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCurated, setHasCurated] = useState(false);

  if (!isOpen || !post) return null;

  async function handleCurate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/x/radar/curate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post!.id,
          authorName: post!.authorName,
          authorHandle: post!.authorHandle,
          content: post!.content,
          sourceUrl: post!.sourceUrl,
          isTechLeader: post!.isTechLeader,
          isFreeDeal: post!.isFreeDeal,
          dealLink: post!.dealLink,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.variations?.length > 0) {
        setVariations(json.data.variations);
        setSelectedIdx(0);
        setEditedText(json.data.variations[0].text);
        setHasCurated(true);
      } else {
        setError(json.error || "Failed to generate AI variations");
      }
    } catch {
      setError("Network error contacting AI curator");
    } finally {
      setLoading(false);
    }
  }

  // Trigger curate on initial open
  if (!hasCurated && !loading && variations.length === 0) {
    handleCurate();
  }

  function handleSelectVariation(idx: number) {
    setSelectedIdx(idx);
    setEditedText(variations[idx].text);
  }

  function handleCopy() {
    navigator.clipboard.writeText(editedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleFreeWebPost() {
    navigator.clipboard.writeText(editedText);

    const intentUrl = new URL("https://x.com/intent/tweet");
    intentUrl.searchParams.set("text", editedText);
    window.open(intentUrl.toString(), "_blank", "noopener,noreferrer");

    onSuccessNotice?.("Copied 6-block template draft and opened X composer!");
    onClose();
  }

  const charCount = editedText.length;
  const maxLimit = 275;
  const isOverLimit = charCount > maxLimit;
  const isCloseToLimit = charCount > 250 && charCount <= maxLimit;

  // Render text highlighting URLs and mentions in Twitter blue
  function renderFormattedTweet(text: string) {
    return text.split("\n\n").map((paragraph, pIdx) => (
      <p key={pIdx} className="mb-3 whitespace-pre-wrap leading-relaxed text-[13.5px]">
        {paragraph.split(" ").map((word, wIdx) => {
          if (
            word.startsWith("http://") ||
            word.startsWith("https://") ||
            word.includes("zcode.z.ai") ||
            word.includes("cloudflare.com")
          ) {
            return (
              <span key={wIdx} className="text-sky-600 underline font-medium">
                {word}{" "}
              </span>
            );
          }
          if (word.startsWith("@")) {
            return (
              <span key={wIdx} className="text-sky-600 font-medium">
                {word}{" "}
              </span>
            );
          }
          return word + " ";
        })}
      </p>
    ));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div
        className="panel relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-7 text-foreground"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-accent shadow-xs">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold text-foreground">
                  AI Tech Curator (Gemini 3.8 Flash)
                </h3>
                <span className="rounded-md bg-orange-100 px-1.5 py-0.2 text-[10px] font-bold text-accent">
                  6-Block Viral Template
                </span>
              </div>
              <p className="text-xs text-muted flex items-center gap-1">
                Curating update from{" "}
                <span className="font-semibold text-foreground">
                  {post.authorName}
                </span>
                <span className="text-muted">(@{post.authorHandle})</span>
                <BadgeCheck className="h-3.5 w-3.5 text-sky-500 inline" />
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-hover hover:text-foreground transition"
          >
            ✕
          </button>
        </div>

        {/* Original Update Box (100% Solid Opaque Background) */}
        <div className="mt-4 rounded-xl border border-border bg-surface p-3.5 text-xs text-muted">
          <div className="mb-1 flex items-center justify-between font-semibold text-foreground">
            <span>Original Source Update:</span>
            <a
              href={post.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
            >
              Source Link <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <p className="line-clamp-2 italic text-foreground">
            &ldquo;{post.content}&rdquo;
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="my-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm font-semibold text-foreground">
              Gemini 3.8 Flash is drafting 6-block viral templates...
            </p>
            <p className="text-xs text-muted">
              Formatting hook line, context, transition, hyphen bullets, and direct access links
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Variations & Live Simulator */}
        {!loading && variations.length > 0 && (
          <div className="mt-5 space-y-4">
            {/* Style Selector Tabs */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Choose Curation Format
              </label>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {variations.map((v, idx) => (
                  <button
                    key={v.id || idx}
                    type="button"
                    onClick={() => handleSelectVariation(idx)}
                    className={`rounded-xl border p-3 text-left transition ${
                      selectedIdx === idx
                        ? "border-accent bg-orange-50/70 shadow-xs ring-1 ring-accent"
                        : "border-border bg-white hover:bg-surface-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1">
                        {idx === 0 && <Gift className="h-3 w-3 text-green-600" />}
                        {idx === 1 && <Code2 className="h-3 w-3 text-sky-600" />}
                        {idx === 2 && <Flame className="h-3 w-3 text-orange-600" />}
                        {v.title}
                      </span>
                      {selectedIdx === idx && (
                        <Check className="h-3.5 w-3.5 text-accent" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted">{v.hookType}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Switcher: Live Simulator vs Edit Text */}
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("PREVIEW")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    activeTab === "PREVIEW"
                      ? "bg-foreground text-white"
                      : "text-muted hover:bg-surface-hover"
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  X Live Simulator
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("EDIT")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    activeTab === "EDIT"
                      ? "bg-foreground text-white"
                      : "text-muted hover:bg-surface-hover"
                  }`}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Draft
                </button>
              </div>

              {/* Character Gauge */}
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span
                  className={`font-bold ${
                    isOverLimit
                      ? "text-error"
                      : isCloseToLimit
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {charCount}/{maxLimit}
                </span>
                <span className="text-[10px] text-muted">chars</span>
              </div>
            </div>

            {/* Live X Tweet Simulator Card (100% Solid Opaque) */}
            {activeTab === "PREVIEW" ? (
              <div className="rounded-xl border border-border bg-surface p-4">
                {/* Simulated Tweet Box in Solid White */}
                <div className="rounded-xl border border-border bg-white p-4 shadow-xs">
                  {/* Author Row */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-100 font-bold text-xs text-accent">
                      {post.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-foreground">
                          {post.authorName}
                        </span>
                        <BadgeCheck className="h-3.5 w-3.5 text-sky-500" />
                        <span className="text-xs text-muted">@{post.authorHandle}</span>
                      </div>
                    </div>
                  </div>

                  {/* Formatted Content */}
                  <div className="text-foreground">
                    {renderFormattedTweet(editedText)}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-muted">
                  <span>Simulated X Post Preview</span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("EDIT")}
                    className="text-accent hover:underline font-medium"
                  >
                    Click to Edit Draft ✎
                  </button>
                </div>
              </div>
            ) : (
              /* Editable Textarea in Solid White */
              <div>
                <textarea
                  rows={8}
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className={`w-full rounded-xl border p-4 font-sans text-xs focus:outline-hidden leading-relaxed ${
                    isOverLimit
                      ? "border-error focus:ring-1 focus:ring-error"
                      : "border-border bg-white focus:border-accent text-foreground"
                  }`}
                  placeholder="Edit your curated X draft here..."
                />
              </div>
            )}

            {isOverLimit && (
              <p className="text-xs text-error font-medium">
                ⚠️ Post exceeds Twitter character limit by {charCount - maxLimit} characters. Trim lines to fit!
              </p>
            )}

            {/* Regenerate Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCurate}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate Variations
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2.5 text-xs font-medium text-muted hover:bg-surface-hover hover:text-foreground transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-hover transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy Text
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleFreeWebPost}
              disabled={isOverLimit || !editedText.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white transition hover:bg-accent-hover disabled:opacity-50 shadow-xs"
            >
              <Send className="h-3.5 w-3.5" />
              1-Click Free Web Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
