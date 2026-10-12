/**
 * Gemini 3.8 Flash Curator for AI Radar Posts
 *
 * Turns creator posts, frontier lab updates, and tool announcements into
 * 3 viral, high-signal X draft variations:
 * 1. Breaking TL;DR (high-urgency news hook)
 * 2. Developer/Workflow Take (practical engineering impact + bullets)
 * 3. Conversational Insight (engaging thought-starter)
 */

export interface CuratedVariation {
  id: "breaking" | "dev_take" | "conversational";
  title: string;
  hookType: string;
  text: string;
  charCount: number;
}

export interface CurateRadarParams {
  authorName: string;
  authorHandle: string;
  sourceUrl?: string;
  originalText: string;
  category?: string;
  isTechLeader?: boolean;
  isFreeDeal?: boolean;
  dealLink?: string;
  apiKey?: string;
  projectId?: string;
}

export interface CurateRadarResult {
  variations: CuratedVariation[];
  model: string;
  fallbackUsed: boolean;
}

/**
 * Resolves the genuine scheme, tool, portal, or documentation URL.
 * NEVER returns an x.com or twitter.com profile link!
 */
export function resolveSchemeOrToolUrl(params: {
  authorHandle: string;
  authorName?: string;
  content: string;
  dealLink?: string;
  sourceUrl?: string;
}): string {
  const { authorHandle, content, dealLink, sourceUrl } = params;

  // 1. If dealLink is provided and is NOT an x.com/twitter.com link, use it
  if (dealLink && !/x\.com|twitter\.com/i.test(dealLink)) {
    return dealLink.trim();
  }

  // 2. Look for any explicit HTTP URL inside the content that is not x.com/twitter.com
  const urlMatches = content.match(/https?:\/\/[^\s)"]+/gi) || [];
  for (const u of urlMatches) {
    if (!/x\.com|twitter\.com/i.test(u)) {
      return u.replace(/[.,;]$/, "");
    }
  }

  // Check for scheme domains without protocol (e.g. cloudflare.com/startups, zcode.z.ai)
  const domainMatch = content.match(/\b([a-zA-Z0-9-]+\.(?:com|org|ai|dev|io|net|tech)(?:\/[^\s)"]*)?)/i);
  if (domainMatch && !/x\.com|twitter\.com/i.test(domainMatch[1])) {
    return `https://${domainMatch[1].replace(/[.,;]$/, "")}`;
  }

  const textLower = content.toLowerCase();
  const handleLower = authorHandle.toLowerCase().replace(/^@/, "");

  // 3. Keyword / Product / Feature exact tool links
  if (textLower.includes("bedrock") || (handleLower.includes("aws") && textLower.includes("agent"))) {
    return "https://aws.amazon.com/bedrock";
  }
  if (textLower.includes("workers ai") || (handleLower.includes("cloudflare") && textLower.includes("ai"))) {
    return "https://developers.cloudflare.com/workers-ai";
  }
  if (textLower.includes("cloudflare") && (textLower.includes("credit") || textLower.includes("startup"))) {
    return "http://cloudflare.com/startups";
  }
  if (textLower.includes("claude code") || textLower.includes("claude")) {
    return "https://claude.ai";
  }
  if (textLower.includes("operator") || textLower.includes("chatgpt") || handleLower === "openai") {
    return "https://openai.com";
  }
  if (textLower.includes("ai studio") || textLower.includes("gemini")) {
    return "https://aistudio.google.com";
  }
  if (textLower.includes("deepseek")) {
    return "https://github.com/deepseek-ai";
  }
  if (textLower.includes("cursor") || handleLower === "cursor_ai") {
    return "https://cursor.com";
  }
  if (textLower.includes("kiro") || handleLower === "kirodotdev") {
    return "https://kiro.dev";
  }
  if (textLower.includes("windsurf") || handleLower === "codeiumdev") {
    return "https://codeium.com/windsurf";
  }
  if (textLower.includes("openrouter") || handleLower.includes("openrouter")) {
    return "https://openrouter.ai";
  }
  if (textLower.includes("supabase")) {
    return "https://supabase.com";
  }
  if (textLower.includes("vercel") || textLower.includes("next.js")) {
    return "https://vercel.com";
  }
  if (textLower.includes("langgraph") || textLower.includes("langchain")) {
    return "https://langchain.com";
  }
  if (textLower.includes("vllm")) {
    return "https://github.com/vllm-project/vllm";
  }
  if (textLower.includes("groq")) {
    return "https://groq.com";
  }
  if (textLower.includes("ollama")) {
    return "https://ollama.com";
  }
  if (textLower.includes("unsloth")) {
    return "https://unsloth.ai";
  }
  if (textLower.includes("ghostty")) {
    return "https://ghostty.org";
  }
  if (textLower.includes("tinygrad")) {
    return "https://github.com/tinygrad/tinygrad";
  }
  if (textLower.includes("replit")) {
    return "https://replit.com";
  }
  if (textLower.includes("lovable")) {
    return "https://lovable.dev";
  }
  if (textLower.includes("v0")) {
    return "https://v0.dev";
  }
  if (textLower.includes("hugging face") || handleLower === "huggingface") {
    return "https://huggingface.co";
  }
  if (textLower.includes("github")) {
    return "https://github.com";
  }

  // 4. Default official domain by handle
  const handleMap: Record<string, string> = {
    awscloud: "https://aws.amazon.com",
    awsdevelopers: "https://aws.amazon.com/developer",
    cloudflare: "https://cloudflare.com",
    openai: "https://openai.com",
    openaidevs: "https://platform.openai.com",
    anthropicai: "https://anthropic.com",
    claudeai: "https://claude.ai",
    googleai: "https://ai.google",
    geminiapp: "https://gemini.google.com",
    googleaidevs: "https://aistudio.google.com",
    deepseek_ai: "https://deepseek.com",
    cursor_ai: "https://cursor.com",
    kirodotdev: "https://kiro.dev",
    openrouterai: "https://openrouter.ai",
    openrouter: "https://openrouter.ai",
    vercel: "https://vercel.com",
    supabase: "https://supabase.com",
    langchainai: "https://langchain.com",
    togethercompute: "https://together.ai",
    replicate: "https://replicate.com",
    modal: "https://modal.com",
    runpod_io: "https://runpod.io",
    groqinc: "https://groq.com",
    ollama: "https://ollama.com",
    unslothai: "https://unsloth.ai",
    k2sbhai: "http://cloudflare.com/startups",
  };

  if (handleMap[handleLower]) {
    return handleMap[handleLower];
  }

  // If sourceUrl is not an X profile, use it
  if (sourceUrl && !/x\.com|twitter\.com/i.test(sourceUrl)) {
    return sourceUrl;
  }

  return "https://developers.google.com";
}

const RADAR_CURATOR_SYSTEM_PROMPT = `You are an elite X (Twitter) tech curator and viral developer copywriter.
Your mission is to transform raw social posts, AI tool announcements, and developer tweets into viral X posts following the EXACT 6-block structure of top tech creators.

Generate EXACTLY 3 variations formatted as a JSON array of objects:
[
  {
    "id": "breaking",
    "title": "Perk & Token Alert",
    "hookType": "Direct Deal / News",
    "text": "..."
  },
  {
    "id": "dev_take",
    "title": "Developer Take",
    "hookType": "Practical Engineering Steps",
    "text": "..."
  },
  {
    "id": "conversational",
    "title": "Tech Leader Breakdown",
    "hookType": "Authoritative Hook",
    "text": "..."
  }
]

EXACT 6-BLOCK POST STRUCTURE TEMPLATE TO FOLLOW:
Block 1: [PUNCHY CLAIM / HOOK] (e.g., "$10,000 in FREE Cloudflare credits 😳" or "Multi-agent AI in 5 lines of CDK 😳")
\\n\\n
Block 2: [1-LINE CONTEXT] (1 short sentence explaining what is happening or what the tool does)
\\n\\n
Block 3: [TRANSITION] ("here's how to get them:" or "here's what you need to know:" or "how to ship it:")
\\n\\n
Block 4: [TIGHT BULLETS] (3 short hyphen bullets, each under 30 chars):
- step 1 / rule 1
- step 2 / rule 2
- step 3 / rule 3
\\n\\n
Block 5: [DEADLINE / CONDITION] ("only 2 days left." or "zero custom glue code.")
\\n\\n
Block 6: [SIGN-OFF & LINK] ("don't sleep on this. apply here: <target-link>" or "try it here: <target-link>")

CRITICAL RULES FOR SIGN-OFF LINKS:
1. The sign-off link in Block 6 MUST BE the direct link to the scheme, tool, credits portal, GitHub repository, documentation, or blog announcement (e.g. https://aws.amazon.com/bedrock, http://cloudflare.com/startups).
2. NEVER OUTPUT AN X/TWITTER PROFILE LINK (such as https://x.com/... or https://twitter.com/...) AS THE SIGN-OFF LINK. Users want the link to the actual product or scheme, NOT the X profile.
3. You MUST use the "Target Tool / Scheme Portal Link" provided in the prompt.

COMPULSORY CONSTRAINTS:
1. STRICT HARD LIMIT: Total character count MUST BE <= 275 CHARACTERS. Keep each line concise so the entire post fits in a single tweet.
2. BREATHING ROOM: Double line breaks (\\n\\n) between every block. Never clump lines into a paragraph.
3. BULLETS: Hyphens only: "- item".
4. NO EM-DASHES (—), NO EN-DASHES (–). Use standard commas or hyphens.
5. NO HASHTAGS: Zero hashtags.
6. EMOJIS: Max 1 or 2 subtle emojis (e.g. 😳).

Output valid JSON ONLY. No markdown wrapper if possible, or simple \`\`\`json.`;

export async function curateRadarPostWithGemini(
  params: CurateRadarParams
): Promise<CurateRadarResult> {
  const {
    authorName,
    authorHandle,
    sourceUrl,
    originalText,
    dealLink,
    apiKey = process.env.GEMINI_API_KEY,
    projectId = process.env.GEMINI_PROJECT_ID || "patil-hospital-pos",
  } = params;

  const targetToolUrl = resolveSchemeOrToolUrl({
    authorHandle,
    authorName,
    content: originalText,
    dealLink,
    sourceUrl,
  });

  const userPrompt = [
    `Author: ${authorName} (@${authorHandle.replace(/^@/, "")})`,
    `Target Tool / Scheme Portal Link (USE THIS EXACT LINK IN BLOCK 6): ${targetToolUrl}`,
    `Original Post Content:`,
    originalText.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!apiKey) {
    return {
      variations: createDeterministicVariations(params),
      model: "deterministic-curator",
      fallbackUsed: true,
    };
  }

  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/locations/global/publishers/google/models/gemini-3.8-flash:generateContent`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: RADAR_CURATOR_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0.5,
        },
      }),
    });

    if (!response.ok) {
      console.warn(`[Radar-Curator] Vertex AI error (${response.status})`);
      return {
        variations: createDeterministicVariations(params),
        model: "fallback-adapter",
        fallbackUsed: true,
      };
    }

    const json = await response.json();
    const rawContent =
      json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    let parsed: any[] = [];
    try {
      const cleanJson = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      parsed = JSON.parse(cleanJson);
    } catch {
      console.warn("[Radar-Curator] Failed to parse JSON, using fallback");
    }

    if (Array.isArray(parsed) && parsed.length >= 2) {
      const sanitized = parsed.map((v, i) => {
        let t = (v.text || "").replace(/[—–]/g, "-").trim();
        // If Gemini accidentally outputted an x.com profile link in Block 6, replace it with targetToolUrl!
        t = t.replace(/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[a-zA-Z0-9_]+/gi, targetToolUrl);
        if (t.length > 280) {
          t = t.slice(0, 277) + "...";
        }
        return {
          id: v.id || (i === 0 ? "breaking" : i === 1 ? "dev_take" : "conversational"),
          title: v.title || `Option ${i + 1}`,
          hookType: v.hookType || "Curated Take",
          text: t,
          charCount: t.length,
        };
      });

      return {
        variations: sanitized,
        model: "gemini-3.8-flash",
        fallbackUsed: false,
      };
    }

    return {
      variations: createDeterministicVariations(params),
      model: "fallback-adapter",
      fallbackUsed: true,
    };
  } catch (err) {
    console.error("[Radar-Curator] Fetch error:", err);
    return {
      variations: createDeterministicVariations(params),
      model: "fallback-adapter",
      fallbackUsed: true,
    };
  }
}

/**
 * Deterministic fallback variations if Gemini API is unreachable or unconfigured
 */
function createDeterministicVariations(params: CurateRadarParams): CuratedVariation[] {
  const { authorName, authorHandle, originalText, isTechLeader, isFreeDeal, dealLink } = params;
  const handleTag = `@${authorHandle.replace(/^@/, "")}`;
  const cleanSnippet = originalText.replace(/[—–]/g, "-").replace(/#\w+/g, "").trim();

  // Extract real tool / scheme link (NEVER x.com profile!)
  const link = resolveSchemeOrToolUrl({
    authorHandle,
    authorName,
    content: originalText,
    dealLink,
    sourceUrl: params.sourceUrl,
  });

  // 1. Exact 6-block Perk / Deal Template
  const block1Hook = isFreeDeal
    ? `$10,000 in FREE credits 😳`
    : isTechLeader
    ? `See what ${handleTag} just dropped:`
    : `Major developer update`;

  const block2Context = cleanSnippet.slice(0, 50).trim() || "Free access tier now open.";

  const var1 = `${block1Hook}\n\n${block2Context}\n\nhere's how to get them:\n\n- open official portal\n- verify your account\n- claim token pack\n\nlimited time only.\n\napply here: ${link}`;

  // 2. Dev Take Template (Engineering lens)
  const var2 = `${handleTag} workflow note:\n\n${cleanSnippet.slice(0, 55).trim()}\n\nkey specs:\n\n- zero VC required\n- active repo needed\n- valid for 12 months\n\ndon't sleep on this: ${link}`;

  // 3. Tech Titan / Conversational Template
  const var3 = isTechLeader
    ? `When ${authorName} (${handleTag}) speaks, pay attention:\n\n"${cleanSnippet.slice(0, 75).trim()}"\n\nkey takeaways:\n\n- compute scaling continues\n- solo builders benefit most\n\ntry it here: ${link}`
    : `New update from ${handleTag} 😳\n\n${cleanSnippet.slice(0, 60).trim()}\n\nhere's what matters:\n\n- instant deployment\n- free starter tier\n\ntry it here: ${link}`;

  const sanitize = (str: string) => {
    let s = str.replace(/[—–]/g, "-").trim();
    if (s.length > 275) s = s.slice(0, 272) + "...";
    return s;
  };

  const final1 = sanitize(var1);
  const final2 = sanitize(var2);
  const final3 = sanitize(var3);

  return [
    {
      id: "breaking",
      title: "Perk & Token Alert",
      hookType: "6-Block Template",
      text: final1,
      charCount: final1.length,
    },
    {
      id: "dev_take",
      title: "Developer Take",
      hookType: "Engineering Specs",
      text: final2,
      charCount: final2.length,
    },
    {
      id: "conversational",
      title: isTechLeader ? "Tech Titan Perspective" : "Conversational Insight",
      hookType: isTechLeader ? "Big Tech Leader" : "Discussion Hook",
      text: final3,
      charCount: final3.length,
    },
  ];
}
