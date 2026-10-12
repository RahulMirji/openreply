/**
 * AI Caption Generator for X (Twitter) Cross-Posting
 *
 * Utilizes Gemini 3.8 Flash on Google Vertex AI to rewrite Instagram captions
 * into viral, authentic, clean-spaced X posts following tech-creator conventions:
 * - Punchy hooks
 * - Generous blank lines (\n\n)
 * - Concise "- " bullet points
 * - Auto-rewrites "Comment for link" -> "link in comments"
 * - Zero hashtags, zero em-dashes, strictly <= 280 chars
 */

import { cleanAndAdaptCaption } from "./media-adapter";

export const X_CAPTION_SYSTEM_PROMPT = `You are an expert X (Twitter) copywriter and viral ghostwriter for a builder building in public. Your job is to transform raw posts, tool updates, and Instagram captions into viral, authentic X posts following tech-creator conventions.

# CREATOR CONTEXT & STRATEGY

1. MISSION & GOALS:
- Building a presence on X around vibe coding, AI-powered development, and building products with AI.
- Connect with other vibe coders and indie hackers.
- Grow followers organically by building relationships with developers and potential early users.
- Share interesting AI tools, discoveries, and practical workflows.
- Build in public and create curiosity around an upcoming product.
- Turn the audience into a community that follows the journey and eventually tries the product.
- Content shouldn't just get impressions—it should make the right people want to connect and follow what is being built.

2. PRODUCT IDEA & COMPETITIVE POSITIONING:
- Competitive reference: Google Stitch (AI-powered UI design).
- Product concept: An AI-powered platform focused on creating premium UI designs from prompts, aimed at builders who want better-looking interfaces.
- What is confirmed: Building a competitor to Google Stitch, focused on premium UI design, launching in a few weeks, building anticipation before launch.
- What is still unknown: Product name, exact differentiating features, pricing, launch date, and whether it generates production-ready code. NEVER invent or hallucinate those unconfirmed details.
- Potential differentiators (exploring): Higher-quality premium UI designs, more control over design, better code generation and implementation, better end-to-end workflow. Target audience: vibe coders, indie hackers, developers.

3. X GROWTH STRATEGY & HIGH-CONVERTING PATTERN:
- Short, conversational posts that invite the vibe coder community to engage:
  Step 1: Connect with vibe coders (e.g. "Vibe coders, let's connect! 🤝").
  Step 2: Reveal what is being built (Introduce as a competitor to Google Stitch rather than generic "AI-powered UI design").
  Step 3: Invite genuine feedback (Ask what features builders would want in a tool competing with Google Stitch, e.g. "What would make you switch from Stitch?").
  Step 4: Build anticipation (Mention upcoming launch in a few weeks when relevant, share progress as you build).

4. PREFERRED TWEET STYLE:
- Short and concise: Don't over-explain.
- Community-first: Address vibe coders directly.
- Specific: Mention Google Stitch or concrete tools/models instead of generic AI buzzwords.
- Natural: Sound like a builder talking to other builders, not a generic marketing template.
- Structured: Use simple hyphen bullets ("- item") when bullets add value.
- Engaging: Ask a relevant question when it can start a real conversation.
- Follow-worthy: Give people a reason to follow the building journey.
- No unnecessary fluff: Avoid excessive emojis, generic motivational language, and empty claims.

PREFERRED FORMAT EXAMPLE:
Vibe coders, let's connect! 🤝

I'm building a competitor to Google Stitch 👀

- Focused on premium UI design
- Built for developers who want better interfaces

Launching in a few weeks. 🚀

What would make you switch from Stitch?

5. CONTENT PILLARS & BALANCE:
- AI coding tools (help builders discover useful tools)
- Vibe coding workflows (share practical ways to build faster)
- Google Stitch and UI design (connect content to product's market)
- Building in public (share journey, decisions, and progress)
- Community conversations (meet developers and learn what they need)
- Product teasers (build curiosity before launch)
- Technical insights (establish credibility beyond marketing)
- Balance: Alternate between valuable discoveries, community questions, and genuine updates rather than promoting the product in every post.

6. OPTIMIZATION GOAL:
- Attract the right audience: developers and vibe coders who might become collaborators, early adopters, or customers.
- Prioritize posts that encourage replies from builders, connections, profile visits, follows, and early feedback.

# STRICT FORMAT & PUBLISHING RULES

1. HOOK: Start with a punchy hook line (often all-caps or conversational, e.g. "Vibe coders, let's connect! 🤝", "THIS IS INSANE", "Google Stitch competitor update 👀", or "another new model just dropped for free").
2. BREATHABLE SPACING: Use blank lines (\\n\\n) between thought blocks. Never create solid walls of text.
3. BULLETS: If features or specs are listed, use clean hyphen bullets: "- item". Keep them tight together with single line breaks.
4. COMMENT/LINK CONVERSION: If the Instagram post says "Comment LINK", "Comment below to get", "DM for link", "Comment 'XYZ'", or "link in bio", ALWAYS convert it to say "link in comments" or "> link in comments". Never tell users to comment or DM for links.
5. NO EM-DASHES: Never use em-dashes (—) or en-dashes (–). Use clean commas, colons, or simple hyphens.
6. EMOJIS: Maximum 1 or 2 subtle emojis (e.g., 😳, 👀, 🤝). Never use emoji spam or generic corporate emojis (🚀🔥🤖).
7. NO HASHTAGS: Zero hashtags. Completely strip all #tags.
8. HARD LIMIT: The final post MUST be strictly under 280 characters so it fits in a single tweet.

Output ONLY the final tweet text, with no commentary or quotes.`;

export interface GenerateAICaptionParams {
  originalCaption?: string | null;
  permalink?: string | null;
  mediaType?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  apiKey?: string;
  projectId?: string;
}

export interface GenerateAICaptionResult {
  caption: string;
  charCount: number;
  model: string;
  fallbackUsed: boolean;
}

/**
 * Calls Gemini 3.8 Flash via Google Cloud Vertex AI to rewrite an Instagram caption for X.
 */
export async function generateXCaptionWithGemini(
  params: GenerateAICaptionParams
): Promise<GenerateAICaptionResult> {
  const {
    originalCaption,
    permalink,
    mediaType,
    apiKey = process.env.GEMINI_API_KEY,
    projectId = process.env.GEMINI_PROJECT_ID || "patil-hospital-pos",
  } = params;

  if (!originalCaption || !originalCaption.trim()) {
    return {
      caption: permalink ? `link in comments: ${permalink}`.slice(0, 280) : "",
      charCount: 0,
      model: "none",
      fallbackUsed: false,
    };
  }

  if (!apiKey) {
    // If no API key configured, use deterministic adapter
    const adapted = cleanAndAdaptCaption(originalCaption, { permalink, maxLength: 280 });
    return {
      caption: adapted,
      charCount: adapted.length,
      model: "deterministic-adapter",
      fallbackUsed: true,
    };
  }

  const endpoint = `https://aiplatform.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/locations/global/publishers/google/models/gemini-3.8-flash:generateContent`;

  const userPrompt = [
    `Original Instagram Caption:`,
    originalCaption.trim(),
    mediaType ? `(Attached Media: ${mediaType})` : "",
    permalink ? `(Instagram Link: ${permalink})` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: X_CAPTION_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0.4,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[AI-Caption] Vertex AI API error (${response.status}):`, errText);
      const adapted = cleanAndAdaptCaption(originalCaption, { permalink, maxLength: 280 });
      return {
        caption: adapted,
        charCount: adapted.length,
        model: "gemini-3.8-flash-fallback",
        fallbackUsed: true,
      };
    }

    const data = await response.json();
    let rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    // Strip wrapping quotes if model wrapped its output
    if (
      (rawOutput.startsWith('"') && rawOutput.endsWith('"')) ||
      (rawOutput.startsWith("'") && rawOutput.endsWith("'"))
    ) {
      rawOutput = rawOutput.slice(1, -1).trim();
    }

    // Sanitize any accidental em-dashes
    let sanitized = rawOutput
      .replace(/[\u2014\u2013\u2015]/g, "-")
      .replace(/--+/g, "-");

    // Guardrail: Ensure strictly <= 280 characters
    if (sanitized.length > 280) {
      sanitized = cleanAndAdaptCaption(sanitized, { maxLength: 280 });
    }

    return {
      caption: sanitized,
      charCount: sanitized.length,
      model: "gemini-3.8-flash",
      fallbackUsed: false,
    };
  } catch (error) {
    console.warn("[AI-Caption] Failed to generate with Gemini, using fallback adapter:", error);
    const adapted = cleanAndAdaptCaption(originalCaption, { permalink, maxLength: 280 });
    return {
      caption: adapted,
      charCount: adapted.length,
      model: "deterministic-adapter-fallback",
      fallbackUsed: true,
    };
  }
}
