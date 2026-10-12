import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateXCaptionWithGemini, X_CAPTION_SYSTEM_PROMPT } from "@/lib/x/ai-caption";

describe("AI Caption Generator (Gemini Vertex AI)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("includes all key prompt rules and creator context in system prompt", () => {
    expect(X_CAPTION_SYSTEM_PROMPT).toContain("HOOK");
    expect(X_CAPTION_SYSTEM_PROMPT).toContain("BREATHABLE SPACING");
    expect(X_CAPTION_SYSTEM_PROMPT).toContain("BULLETS");
    expect(X_CAPTION_SYSTEM_PROMPT).toContain("COMMENT/LINK CONVERSION");
    expect(X_CAPTION_SYSTEM_PROMPT).toContain("NO EM-DASHES");
    expect(X_CAPTION_SYSTEM_PROMPT).toContain("280 characters");
    expect(X_CAPTION_SYSTEM_PROMPT).toContain("vibe coding");
    expect(X_CAPTION_SYSTEM_PROMPT).toContain("Google Stitch");
    expect(X_CAPTION_SYSTEM_PROMPT).toContain("premium UI design");
  });

  it("returns clean caption when Vertex AI generates text", async () => {
    const mockOutput = "DeepSeek V4.1 Flash UNCENSORED 😳\n\nA new build just dropped:\n\n- MIT base\n- 1.3B tokens\n\n> link in comments";

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: `"${mockOutput}"` }],
            },
          },
        ],
      }),
    } as any);

    const result = await generateXCaptionWithGemini({
      originalCaption: "Some original post here",
      apiKey: "test-key",
      projectId: "test-project",
    });

    expect(result.caption).toBe(mockOutput);
    expect(result.charCount).toBe(mockOutput.length);
    expect(result.charCount).toBeLessThanOrEqual(280);
    expect(result.model).toBe("gemini-3.8-flash");
    expect(result.fallbackUsed).toBe(false);
  });

  it("sanitizes any em-dashes from AI output", async () => {
    const outputWithEmDash = "THIS IS INSANE\n\nOpen-source Claude Code — free forever:\n\n- 49 providers\n\n> link in comments";

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: outputWithEmDash }],
            },
          },
        ],
      }),
    } as any);

    const result = await generateXCaptionWithGemini({
      originalCaption: "Some original post",
      apiKey: "test-key",
    });

    expect(result.caption).not.toContain("—");
    expect(result.caption).toContain("- free forever");
  });

  it("falls back cleanly to deterministic adapter when fetch fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network timeout"));

    const result = await generateXCaptionWithGemini({
      originalCaption: "Check out this feature!\n• Point 1\n• Point 2\n#viral",
      apiKey: "test-key",
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.caption).toContain("- Point 1");
    expect(result.caption).toContain("- Point 2");
    expect(result.caption).not.toContain("#viral");
  });

  it("falls back cleanly when no apiKey is provided", async () => {
    const result = await generateXCaptionWithGemini({
      originalCaption: "Check out this feature!\n• Point 1\n#viral",
      apiKey: "",
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.caption).toContain("- Point 1");
    expect(result.caption).not.toContain("#viral");
  });
});
