import type { Metadata } from "next";
import RadarAiChat from "@/components/radar-ai-chat";
import { Sparkles, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "AI Chat & Curator | OpenReply",
  description:
    "Brainstorm, refine, and curate viral X posts for vibe coders and tech builders using Gemini 3.8 Flash.",
};

export default function ChatPage() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center space-y-2">
        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            AI Chat & Ghostwriter
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            <Sparkles className="h-3 w-3" />
            Gemini 3.8 Flash
          </span>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>Vibe Coder Active</span>
          </div>
        </div>
        <p className="text-sm text-muted max-w-lg mx-auto">
          Brainstorm ideas, transform developer updates, and curate high-signal posts tailored for vibe coders and indie builders.
        </p>
      </div>

      {/* Main AI Chat Workspace */}
      <RadarAiChat />
    </div>
  );
}
