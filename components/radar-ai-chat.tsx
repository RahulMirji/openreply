"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Code2,
  Gift,
  Crown,
  Share2,
  Copy,
  Check,
  Edit3,
  ExternalLink,
  RefreshCw,
  User,
  ArrowRight,
  Heart,
  MessageCircle,
  Repeat2,
  Bookmark,
  BarChart2,
} from "lucide-react";
import type { ChatCurateMode } from "@/app/api/x/radar/chat/route";
import { PromptInput } from "@/components/ui/ai-chat-input";

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  curatedPost?: string;
  charCount?: number;
  mode?: ChatCurateMode;
  hookType?: string;
  targetLink?: string;
  likes?: number;
  isLiked?: boolean;
}

const STARTER_PROMPTS = [
  {
    label: "vLLM vs Ollama in Prod",
    mode: "DEV_MODE" as ChatCurateMode,
    text: "Ollama is great for local dev, but production is a different game. When real users hit your AI app you need vLLM for efficient request batching, GPU memory management, and higher throughput on 1 GPU. Same model, different infra.",
  },
  {
    label: "Indie Launch Teaser",
    mode: "MY_TAKE" as ChatCurateMode,
    text: "Building an AI-first developer tool in public. Solves the messy manual workflow builders face daily. Launching private beta next week. What's the #1 feature you look for in early developer tools?",
  },
  {
    label: "Vibe Coders Connect Hook",
    mode: "DEV_MODE" as ChatCurateMode,
    text: "Vibe coders, let's connect! I'm sharing workflows on shipping faster with AI and crafting high-end interfaces.",
  },
  {
    label: "AWS Bedrock CDK Agents",
    mode: "DEV_MODE" as ChatCurateMode,
    text: "AWS Bedrock now natively supports multi-agent orchestration via CDK. Developers can attach tools and IAM boundaries without custom glue code.",
  },
  {
    label: "Cloudflare $10k Credits",
    mode: "MY_TAKE" as ChatCurateMode,
    text: "Found this deal: Cloudflare gives $10,000 in free startup credits for 12 months. Bootstrapped founders can apply without VC funding at cloudflare.com/startups.",
  },
  {
    label: "Compute Scaling Titan Take",
    mode: "TECH_LEADER" as ChatCurateMode,
    text: "Sam Altman says compute scaling over the next 18 months will make current LLMs look primitive and cheap intelligence empowers solo builders most.",
  },
];

const CHAT_MODES: { id: ChatCurateMode; label: string; description: string }[] = [
  { id: "DEV_MODE", label: "Dev Mode", description: "Infra & vibe coding breakdowns" },
  { id: "MY_TAKE", label: "My Take", description: "Authentic founder & builder voice" },
  { id: "TECH_LEADER", label: "Tech Leader", description: "Market trends & visionary takes" },
];

/**
 * Rich Block-level Tweet Content Renderer
 * Formats hooks, readable linebreaks, custom bullet points, and CTA questions
 */
function TweetContentRenderer({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);

  return (
    <div className="space-y-3.5 text-[14px] leading-relaxed text-zinc-100 font-sans tracking-normal select-text">
      {blocks.map((block, bIdx) => {
        const lines = block.split("\n");
        const isBulletBlock = lines.some(
          (l) => l.trim().startsWith("- ") || l.trim().startsWith("• ")
        );

        if (isBulletBlock) {
          return (
            <ul key={bIdx} className="space-y-1.5 my-2.5 pl-0.5">
              {lines.map((line, lIdx) => {
                const trimmed = line.trim();
                if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
                  const bulletText = trimmed.replace(/^[-•]\s*/, "");
                  return (
                    <li
                      key={lIdx}
                      className="flex items-start gap-2.5 text-zinc-200 transition-colors hover:text-white"
                    >
                      <span className="inline-block mt-2 h-1.5 w-1.5 rounded-full bg-sky-400 shrink-0 shadow-xs shadow-sky-400/80" />
                      <span className="font-normal leading-snug">{bulletText}</span>
                    </li>
                  );
                }
                return (
                  <p key={lIdx} className="text-zinc-200 font-normal">
                    {line}
                  </p>
                );
              })}
            </ul>
          );
        }

        const isQuestion = block.trim().endsWith("?");

        return (
          <p
            key={bIdx}
            className={
              isQuestion
                ? "text-sky-300 font-medium pt-2 border-t border-zinc-800/80"
                : bIdx === 0
                ? "font-semibold text-white text-[15px] tracking-tight"
                : "text-zinc-200"
            }
          >
            {block}
          </p>
        );
      })}
    </div>
  );
}

export default function RadarAiChat() {
  const [mode, setMode] = useState<ChatCurateMode>("DEV_MODE");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editedText, setEditedText] = useState<string>("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(
    customText: string,
    meta?: { model?: string; effort?: string; mode?: string; attachments?: File[] }
  ) {
    const textToSend = customText.trim();
    if (!textToSend || loading) return;

    const currentMode = (meta?.mode as ChatCurateMode) || mode;
    if (meta?.mode && meta.mode !== mode) {
      setMode(meta.mode as ChatCurateMode);
    }

    const userMsgId = "user-" + Date.now();
    const newUserMsg: ChatItem = {
      id: userMsgId,
      role: "user",
      content: textToSend,
    };

    const nextMessages = [...messages, newUserMsg];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/x/radar/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content:
              m.role === "assistant" && m.curatedPost
                ? `${m.content}\n\n[Previous Tweet Draft]:\n${m.curatedPost}`
                : m.content,
          })),
          mode: currentMode,
          model: meta?.model,
          effort: meta?.effort,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        const assistantMsg: ChatItem = {
          id: "bot-" + Date.now(),
          role: "assistant",
          content: json.data.reply,
          curatedPost: json.data.curatedPost,
          charCount: json.data.charCount || json.data.curatedPost?.length,
          mode: json.data.mode || currentMode,
          hookType: json.data.hookType || "AI Curated Take",
          targetLink: json.data.targetLink,
          likes: Math.floor(Math.random() * 80) + 40,
          isLiked: false,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        setNotice(json.error || "Failed to generate AI response");
      }
    } catch {
      setNotice("Network error reaching AI curator");
    } finally {
      setLoading(false);
    }
  }

  function handleWebCompose(postText: string) {
    navigator.clipboard.writeText(postText);
    const intentUrl = new URL("https://x.com/intent/tweet");
    intentUrl.searchParams.set("text", postText);
    window.open(intentUrl.toString(), "_blank", "noopener,noreferrer");
    setNotice("Post copied to clipboard & opened in X Web Composer! 🚀");
  }

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  function toggleLike(id: string) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const isLiked = !m.isLiked;
          const likes = (m.likes || 0) + (isLiked ? 1 : -1);
          return { ...m, isLiked, likes };
        }
        return m;
      })
    );
  }

  function startEditing(id: string, text: string) {
    setEditingPostId(id);
    setEditedText(text);
  }

  function saveEditing(id: string) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          return {
            ...m,
            curatedPost: editedText,
            charCount: editedText.length,
          };
        }
        return m;
      })
    );
    setEditingPostId(null);
  }

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center">
      {/* Notice Toast */}
      {notice && (
        <div className="mb-6 w-full max-w-xl flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs font-semibold text-emerald-600 dark:text-emerald-300 backdrop-blur-md animate-tweet-in z-20">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-emerald-500 hover:text-foreground transition px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* When NO messages: Centered Input & Hero state */}
      {messages.length === 0 ? (
        <div className="w-full flex flex-col items-center justify-center py-6 sm:py-12 px-2 text-center">
          {/* Header */}
          <div className="space-y-2 mb-8 max-w-md mx-auto">
            <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-surface border border-border text-foreground mb-1 shadow-2xs">
              <Sparkles className="size-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Curate your next high-signal X post
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed sm:text-sm">
              Transform raw dev updates, infra tests, and vibe coding workflows into viral, clean-spaced posts.
            </p>
          </div>

          {/* Graceful Centered Input Box with Modes inside */}
          <div className="w-full flex justify-center">
            <PromptInput
              onSubmit={(value, meta) => handleSubmit(value, meta)}
              placeholder="Ask anything or paste rough thoughts..."
              modes={CHAT_MODES}
              selectedMode={mode}
              onModeChange={(m) => setMode(m as ChatCurateMode)}
              models={["Gemini 3.5 Flash", "Composer 2.5", "GPT 5.5", "Opus 4.8", "GLM 5.2"]}
              efforts={["Low", "Medium", "Max Effort"]}
              alwaysExpanded={true}
            />
          </div>

          {/* Quick Starter Prompt Chips */}
          <div className="flex items-center justify-center flex-wrap gap-2 mt-6 max-w-xl mx-auto">
            {STARTER_PROMPTS.slice(0, 3).map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setMode(prompt.mode);
                  handleSubmit(prompt.text);
                }}
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-surface-hover px-3.5 py-1.5 text-xs font-medium text-foreground transition-all shadow-2xs hover:border-border-hover"
              >
                <span>{prompt.label}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* When Messages Exist: Active Conversation View */
        <div className="w-full space-y-6">
          {/* Header with New Prompt reset button */}
          <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-foreground">Live Post Studio</span>
              <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                {messages.filter((m) => m.role === "assistant").length} post
                {messages.filter((m) => m.role === "assistant").length === 1 ? "" : "s"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMessages([])}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition shadow-2xs"
              title="Start a fresh prompt"
            >
              <RefreshCw className="h-3 w-3" />
              <span>New prompt</span>
            </button>
          </div>

          {/* Chat Messages Feed Container */}
          <div className="my-2 space-y-6 max-h-[60vh] overflow-y-auto px-1 prompt-scrollbar">
            {messages.map((msg) => {
              if (msg.role === "user") {
                return (
                  <div key={msg.id} className="flex justify-end animate-tweet-in">
                    <div className="max-w-lg rounded-2xl bg-primary text-primary-foreground px-4 py-3 text-xs shadow-md leading-relaxed">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-75 mb-1">
                        <User className="h-3 w-3" />
                        <span>You</span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              }

              // Assistant Message with Simulated Live X Card
              return (
                <div key={msg.id} className="flex justify-center animate-tweet-in">
                  <div className="w-full max-w-xl space-y-3">
                    {msg.curatedPost && (
                      <div className="rounded-2xl border border-zinc-800 bg-[#0c1015] p-5 shadow-xl transition-all hover:border-zinc-700/80">
                        {/* Twitter Card Header */}
                        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
                          <div className="flex items-center gap-3">
                            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-sky-500 via-indigo-500 to-violet-500 p-0.5">
                              <div className="flex h-full w-full items-center justify-center rounded-full bg-neutral-950 text-white font-bold text-xs">
                                VC
                              </div>
                            </div>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold text-white hover:underline cursor-pointer">
                                  Vibe Builder
                                </span>
                                <svg
                                  className="h-4 w-4 text-sky-400 shrink-0"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                </svg>
                                <span className="text-xs text-zinc-400">@vibe_builder</span>
                                <span className="text-xs text-zinc-500">· just now</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] font-medium text-zinc-400">
                                  Mode: {msg.mode?.replace("_", " ")}
                                </span>
                                {msg.hookType && (
                                  <span className="rounded-md bg-white/10 px-1.5 py-0.2 text-[10px] text-zinc-300">
                                    {msg.hookType}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-200">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                          </div>
                        </div>

                        {/* Post Content Preview / Inline Editor */}
                        {editingPostId === msg.id ? (
                          <div className="space-y-3">
                            <textarea
                              value={editedText}
                              onChange={(e) => setEditedText(e.target.value)}
                              rows={7}
                              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100 focus:outline-hidden focus:border-sky-500 leading-relaxed shadow-inner"
                            />
                            <div className="flex justify-between items-center text-xs">
                              <span
                                className={`font-mono font-bold ${
                                  editedText.length <= 275 ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {editedText.length}/275 characters
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingPostId(null)}
                                  className="rounded-xl border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEditing(msg.id)}
                                  className="rounded-xl bg-sky-500 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-sky-400 transition"
                                >
                                  Save Edits
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <TweetContentRenderer text={msg.curatedPost} />
                        )}

                        {/* Action Footer */}
                        <div className="mt-5 pt-3.5 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-4 text-xs text-zinc-400">
                            <button
                              type="button"
                              onClick={() => toggleLike(msg.id)}
                              className={`flex items-center gap-1.5 hover:text-rose-400 transition ${
                                msg.isLiked ? "text-rose-500" : ""
                              }`}
                            >
                              <Heart
                                className={`h-4 w-4 ${
                                  msg.isLiked ? "fill-current text-rose-500" : ""
                                }`}
                              />
                              <span>{msg.likes || 0}</span>
                            </button>
                            <div className="flex items-center gap-1.5 hover:text-sky-400 transition cursor-pointer">
                              <MessageCircle className="h-4 w-4" />
                              <span>24</span>
                            </div>
                            <div className="flex items-center gap-1.5 hover:text-emerald-400 transition cursor-pointer">
                              <Repeat2 className="h-4 w-4" />
                              <span>18</span>
                            </div>
                            <div className="flex items-center gap-1.5 hover:text-amber-400 transition cursor-pointer">
                              <Bookmark className="h-4 w-4" />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Copy Button */}
                            <button
                              type="button"
                              onClick={() => handleCopy(msg.id, msg.curatedPost!)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition active:scale-95"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                  <span className="text-emerald-400 font-bold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3.5 w-3.5 text-zinc-400" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            {/* Edit Button */}
                            <button
                              type="button"
                              onClick={() => startEditing(msg.id, msg.curatedPost!)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white transition active:scale-95"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-zinc-400" />
                              <span>Edit</span>
                            </button>

                            {/* Web Compose on X Button */}
                            <button
                              type="button"
                              onClick={() => handleWebCompose(msg.curatedPost!)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-sky-500/20 hover:bg-sky-400 transition active:scale-95"
                              title="Opens official X composer with this text and copies to clipboard"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              <span>Web Compose on X</span>
                              <ExternalLink className="h-3 w-3 opacity-80" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center justify-center animate-tweet-in">
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-surface text-xs text-foreground shadow-lg">
                  <RefreshCw className="h-4 w-4 animate-spin text-sky-400" />
                  <span>Curating high-signal post with Gemini 3.5 Flash...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Centered Floating Prompt Input at bottom */}
          <div className="pt-4 flex items-center justify-center w-full">
            <PromptInput
              onSubmit={(value, meta) => handleSubmit(value, meta)}
              placeholder="Follow up, ask to tweak, or drop a new topic..."
              modes={CHAT_MODES}
              selectedMode={mode}
              onModeChange={(m) => setMode(m as ChatCurateMode)}
              models={["Gemini 3.5 Flash", "Composer 2.5", "GPT 5.5", "Opus 4.8", "GLM 5.2"]}
              efforts={["Low", "Medium", "Max Effort"]}
              alwaysExpanded={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
