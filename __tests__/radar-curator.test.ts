import { describe, it, expect, vi, beforeEach } from "vitest";
import { curateRadarPostWithGemini } from "@/lib/radar/curate";
import { getRadarFeed, findRadarPostById, formatRelativeTime } from "@/lib/radar/service";
import { WATCHLIST_ACCOUNTS } from "@/lib/radar/directory";

describe("AI Tech Radar & Watchlist", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("contains K2S and all key creators in the watchlist directory", () => {
    const handles = WATCHLIST_ACCOUNTS.map((a) => a.handle);
    expect(handles).toContain("k2sbhai");
    expect(handles).toContain("punchw45k");
    expect(handles).toContain("painn_x");
    expect(handles).toContain("TheMaran");
    expect(handles).toContain("karpathy");
    expect(handles).toContain("sama");
    expect(handles).toContain("DarioAmodei");
    expect(handles).toContain("cursor_ai");
    expect(handles).toContain("kirodotdev");
    expect(handles).toContain("openrouter");
    expect(handles).toContain("OpenAI");
    expect(handles).toContain("AnthropicAI");
    expect(handles).toContain("deepseek_ai");
  });

  it("correctly formats relative time down to seconds and minutes", () => {
    const thirtySecAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();

    expect(formatRelativeTime(thirtySecAgo)).toMatch(/s ago/);
    expect(formatRelativeTime(twoMinAgo)).toBe("2m ago");
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it("sorts radar posts by multi-sort options", async () => {
    const newest = await getRadarFeed({ sort: "NEWEST" });
    expect(newest.posts[0].authorHandle).toBe("k2sbhai"); // posted 30s ago

    const nameAsc = await getRadarFeed({ sort: "NAME_ASC" });
    expect(nameAsc.posts[0].authorName.localeCompare(nameAsc.posts[1].authorName)).toBeLessThanOrEqual(0);

    const freeDeals = await getRadarFeed({ sort: "FREE_DEALS" });
    expect(freeDeals.posts.every((p) => p.isFreeDeal || /free|\$|credit/i.test(p.content))).toBe(true);

    const viral = await getRadarFeed({ sort: "ENGAGEMENT" });
    const eng0 = (viral.posts[0].metrics?.likes || 0) + (viral.posts[0].metrics?.reposts || 0);
    const eng1 = (viral.posts[1].metrics?.likes || 0) + (viral.posts[1].metrics?.reposts || 0);
    expect(eng0).toBeGreaterThanOrEqual(eng1);
  });

  it("finds a radar post by ID (including K2S Cloudflare post)", () => {
    const post = findRadarPostById("radar-k2s-1");
    expect(post).toBeDefined();
    expect(post?.authorHandle).toBe("k2sbhai");
    expect(post?.content).toContain("$10,000 in FREE Cloudflare credits");
    expect(post?.dealLink).toBe("http://cloudflare.com/startups");
  });

  it("curates free deal posts with bullet points, link CTA and strict character limits", async () => {
    const result = await curateRadarPostWithGemini({
      authorName: "K2S",
      authorHandle: "k2sbhai",
      originalText: "$10,000 in FREE Cloudflare credits for startups. apply here: http://cloudflare.com/startups",
      isFreeDeal: true,
      dealLink: "http://cloudflare.com/startups",
      apiKey: "", // test fallback logic
    });

    expect(result.variations.length).toBe(3);
    expect(result.variations.every((v) => v.charCount <= 275)).toBe(true);
    expect(result.variations.some((v) => v.text.includes("apply here:"))).toBe(true);
    expect(result.variations.some((v) => v.text.includes("- "))).toBe(true);
  });

  it("curates tech leaders with big tech leader hooks", async () => {
    const result = await curateRadarPostWithGemini({
      authorName: "Sam Altman",
      authorHandle: "sama",
      originalText: "The compute curve over the next 18 months will make everything look primitive.",
      isTechLeader: true,
      apiKey: "",
    });

    expect(result.variations.length).toBe(3);
    expect(result.variations.some((v) => v.text.includes("tech leader") || v.text.includes("@sama"))).toBe(true);
    expect(result.variations.every((v) => v.charCount <= 275)).toBe(true);
  });

  it("verifies all 8 watchlist categories are populated in the master directory", () => {
    const categories = new Set(WATCHLIST_ACCOUNTS.map((a) => a.category));
    expect(categories.has("CREATOR")).toBe(true);
    expect(categories.has("AI_LAB")).toBe(true);
    expect(categories.has("IDE")).toBe(true);
    expect(categories.has("INFRA")).toBe(true);
    expect(categories.has("CLOUD")).toBe(true);
    expect(categories.has("RESEARCHER")).toBe(true);
    expect(categories.has("FRAMEWORK")).toBe(true);
    expect(categories.has("BLOG")).toBe(true);
    expect(WATCHLIST_ACCOUNTS.length).toBeGreaterThanOrEqual(80);
  });

  it("filters feed by individual categories accurately", async () => {
    const aiLabs = await getRadarFeed({ category: "AI_LAB" });
    expect(aiLabs.posts.every((p) => p.category === "AI_LAB")).toBe(true);

    const frameworks = await getRadarFeed({ category: "FRAMEWORK" });
    expect(frameworks.posts.every((p) => p.category === "FRAMEWORK")).toBe(true);
  });

  it("resolves scheme/tool URLs instead of X profile links for tools like AWS Bedrock", async () => {
    const result = await curateRadarPostWithGemini({
      authorName: "AWS",
      authorHandle: "awscloud",
      originalText: "Amazon Bedrock now supports unified multi-agent orchestration. Connect Bedrock Agent core with external tools, automated policy boundaries, and enterprise IAM in just a few lines of CDK.",
      sourceUrl: "https://x.com/awscloud",
      apiKey: "", // test fallback & resolver
    });

    expect(result.variations.length).toBe(3);
    // Crucial: none of the sign-off variations should output the X profile link
    expect(result.variations.every((v) => !v.text.includes("https://x.com/awscloud"))).toBe(true);
    // Crucial: sign-off variation must direct users to the actual tool / scheme
    expect(result.variations.some((v) => v.text.includes("https://aws.amazon.com/bedrock"))).toBe(true);
  });

  it("verifies K2S post timestamp reflects authentic 1h ago time", () => {
    const post = findRadarPostById("radar-k2s-1");
    expect(post).toBeDefined();
    const relTime = formatRelativeTime(post!.publishedAt);
    expect(relTime).toBe("1h ago");
  });
});
