import { NextRequest, NextResponse } from "next/server";
import { getCurrentWorkspaceId } from "@/lib/auth";
import { resolveSchemeOrToolUrl } from "@/lib/radar/curate";

export type ChatCurateMode = "DEV_MODE" | "MY_TAKE" | "TECH_LEADER";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MODE_INSTRUCTIONS: Record<ChatCurateMode, string> = {
  DEV_MODE: `MODE: Dev Mode (Practical Engineering & Architecture).
Lens: Focus on developer workflows, system specs, code architectures, libraries, and real implementations.
Tone: Pragmatic, senior engineer style.
Block 1 Hook: Punchy engineering claim (e.g., "Multi-agent AI in 5 lines of CDK 😳" or "Full-stack Next.js app in 1 prompt 😳").
Block 3 Transition: "how to ship it:" or "here's the architecture:" or "key specs:".
Block 4 Bullets: 3 implementation steps (each <30 chars).
Block 5 Condition: "zero custom glue code." or "runs 100% locally."
Block 6 Sign-off: "try it here: <target-link>"`,

  MY_TAKE: `MODE: My Take (Builder Alert & Perks / Deals).
Lens: Personal indie hacker perspective, creator perks, startup credits, free tokens, or actionable builder news.
Tone: Authentic, urgent, builder-to-builder.
Block 1 Hook: Eye-catching perk or milestone (e.g., "$10,000 in FREE Cloudflare credits 😳" or "300M free tokens up for grabs").
Block 3 Transition: "here's how to get them:" or "here's what you need to know:".
Block 4 Bullets: 3 rules/steps (each <30 chars).
Block 5 Condition: "no VC funding required." or "only a few days left."
Block 6 Sign-off: "don't sleep on this. apply here: <target-link>"`,

  TECH_LEADER: `MODE: Big Tech Leader (Authoritative & Titan Perspective).
Lens: High-status macro insight, compute scaling, frontier AI models, industry shifts as seen by visionary leaders (Sama, Karpathy, Amodei, etc.).
Tone: Authoritative, visionary, high-signal.
Block 1 Hook: Authoritative attention hook (e.g., "When top tech leaders talk compute, pay attention 😳").
Block 3 Transition: "here's why it matters:" or "what they're forecasting:".
Block 4 Bullets: 3 big-picture takeaways (each <30 chars).
Block 5 Condition: "solo builders benefit most." or "the frontier moves fast."
Block 6 Sign-off: "read the full paper: <target-link>" or "explore it here: <target-link>"`,
};

function buildSystemPrompt(mode: ChatCurateMode, targetLink: string): string {
  return `You are an elite X (Twitter) tech curator and viral developer ghostwriter.
Your goal is to converse with the user, brainstorm, remember everything in this conversation, and transform WHATEVER ideas, updates, questions, or raw thoughts they provide in their input box into high-signal X posts.

CRITICAL INSTRUCTIONS:
1. CURATE DIRECTLY FROM USER INPUT:
   - Base the curated tweet entirely on what the user sends in their input box.
   - NEVER inject unmentioned third-party products, companies, or competitor pitches unless the user explicitly asks about them.
   - Accurately capture the user's specific subject, tech stack, argument, or question.

2. CONVERSATIONAL MEMORY & MULTI-TURN REFINEMENT:
   - Remember the full conversation history and context of previous messages in this chat.
   - If the user asks for revisions, shorter bullets, different hooks, stronger tone, or follow-up tweaks, remember what was already drafted and refine accordingly.

${MODE_INSTRUCTIONS[mode]}

EXACT 6-BLOCK POST STRUCTURE TEMPLATE TO FOLLOW:
Block 1: [PUNCHY CLAIM / HOOK BASED ON USER'S TOPIC]
\\n\\n
Block 2: [1-LINE CONTEXT EXPANDING ON USER'S THOUGHT]
\\n\\n
Block 3: [TRANSITION]
\\n\\n
Block 4: [TIGHT BULLETS] (3 short hyphen bullets, each under 30 chars, summarizing key takeaways):
- point 1
- point 2
- point 3
\\n\\n
Block 5: [DEADLINE / SPEC / CONDITION]
\\n\\n
Block 6: [SIGN-OFF & LINK] (MUST use: ${targetLink})

COMPULSORY CONSTRAINTS:
1. STRICT HARD LIMIT: Total character count of the curated post MUST BE <= 275 CHARACTERS.
2. BREATHING ROOM: Double line breaks (\\n\\n) between every block.
3. BULLETS: Hyphens only: "- item".
4. NO HASHTAGS: Zero hashtags.
5. NO X/TWITTER PROFILE LINKS: Never link to an X profile (x.com/...); always use the target tool/scheme link provided.
6. FAITHFUL RELEVANCE: Ensure the curated post is 100% focused on what the user provided.

Return valid JSON with this exact structure:
{
  "reply": "Conversational reply explaining your curation choices, referencing the context and previous messages if relevant.",
  "curatedPost": "The full 6-block tweet text under 275 chars directly derived from the user's input.",
  "hookType": "Short label for the hook (e.g. Dev Breakdown, Founder Take, Macro Insight)",
  "targetLink": "${targetLink}"
}`;
}

export async function POST(request: NextRequest) {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      messages = [],
      mode = "DEV_MODE",
      authorHandle = "developer",
      explicitUrl,
    }: {
      messages: ChatMessage[];
      mode: ChatCurateMode;
      authorHandle?: string;
      explicitUrl?: string;
    } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "Messages array cannot be empty" },
        { status: 400 }
      );
    }

    const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    if (!latestUserMessage.trim()) {
      return NextResponse.json(
        { success: false, error: "Latest user message cannot be empty" },
        { status: 400 }
      );
    }

    // Resolve the real scheme or tool URL
    const targetLink =
      explicitUrl && !/x\.com|twitter\.com/i.test(explicitUrl)
        ? explicitUrl.trim()
        : resolveSchemeOrToolUrl({
            authorHandle,
            content: latestUserMessage,
            dealLink: explicitUrl,
          });

    const apiKey = process.env.GEMINI_API_KEY;
    const projectId = process.env.GEMINI_PROJECT_ID || "patil-hospital-pos";

    if (!apiKey) {
      // Deterministic Chat Fallback
      const fallback = generateFallbackChatResponse(latestUserMessage, mode, targetLink);
      return NextResponse.json({
        success: true,
        data: fallback,
        model: "deterministic-chat-curator",
      });
    }

    const endpoint = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/locations/global/publishers/google/models/gemini-3.8-flash:generateContent`;

    const systemPrompt = buildSystemPrompt(mode, targetLink);

    // Build contents array for multi-turn chat
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0.6,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[Radar Chat API] Gemini error (${response.status}), falling back`);
      const fallback = generateFallbackChatResponse(latestUserMessage, mode, targetLink);
      return NextResponse.json({
        success: true,
        data: fallback,
        model: "fallback-chat-adapter",
      });
    }

    const json = await response.json();
    const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    let parsed: any = null;
    try {
      const cleanJson = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      console.warn("[Radar Chat API] Failed to parse JSON, using fallback");
    }

    if (parsed && typeof parsed.curatedPost === "string") {
      let postText = parsed.curatedPost.replace(/[—–]/g, "-").trim();
      // Enforce never linking to X profiles in sign-off
      postText = postText.replace(/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[a-zA-Z0-9_]+/gi, targetLink);
      if (postText.length > 280) {
        postText = postText.slice(0, 272) + "...";
      }

      return NextResponse.json({
        success: true,
        data: {
          reply:
            parsed.reply ||
            `Curated a punchy ${mode.replace("_", " ").toLowerCase()} post ready to publish!`,
          curatedPost: postText,
          charCount: postText.length,
          mode,
          hookType: parsed.hookType || "AI Curated Take",
          targetLink,
        },
        model: "gemini-3.8-flash",
      });
    }

    const fallback = generateFallbackChatResponse(latestUserMessage, mode, targetLink);
    return NextResponse.json({
      success: true,
      data: fallback,
      model: "fallback-chat-adapter",
    });
  } catch (err) {
    console.error("[Radar Chat API] Exception:", err);
    return NextResponse.json({ success: false, error: "Failed to process chat" }, { status: 500 });
  }
}

function generateFallbackChatResponse(
  prompt: string,
  mode: ChatCurateMode,
  targetLink: string
): {
  reply: string;
  curatedPost: string;
  charCount: number;
  mode: ChatCurateMode;
  hookType: string;
  targetLink: string;
} {
  const cleanSnippet = prompt.replace(/[—–]/g, "-").replace(/#\w+/g, "").trim().slice(0, 50);

  let hook = "Major AI developer update 😳";
  let transition = "how to ship it:";
  let bullets = "- clone starter repo\n- add API credentials\n- deploy in 1 click";
  let condition = "zero custom glue code.";
  let signoff = `try it here: ${targetLink}`;
  let hookType = "Dev Take";

  if (mode === "MY_TAKE") {
    hook = "$10,000 in FREE credits alert 😳";
    transition = "here's how to claim:";
    bullets = "- open official portal\n- link live project\n- activate token bundle";
    condition = "no VC funding required.";
    signoff = `don't sleep on this: ${targetLink}`;
    hookType = "My Take & Perks";
  } else if (mode === "TECH_LEADER") {
    hook = "When top tech leaders speak, listen 😳";
    transition = "here's why it matters:";
    bullets = "- compute curve scales\n- solo devs ship faster\n- agents replace boilerplate";
    condition = "the frontier moves fast.";
    signoff = `explore it here: ${targetLink}`;
    hookType = "Tech Leader Vision";
  }

  let post = `${hook}\n\n${cleanSnippet || "New breakthrough dropped."}\n\n${transition}\n\n${bullets}\n\n${condition}\n\n${signoff}`;
  if (post.length > 275) {
    post = post.slice(0, 272) + "...";
  }

  return {
    reply: `I crafted a high-signal post in ${mode.replace("_", " ")} under the 275 character limit. You can click Web Compose to launch directly into X!`,
    curatedPost: post,
    charCount: post.length,
    mode,
    hookType,
    targetLink,
  };
}
