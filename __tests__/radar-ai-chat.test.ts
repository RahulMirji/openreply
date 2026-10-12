import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/x/radar/chat/route";
import { NextRequest } from "next/server";

// Mock auth so request is authorized
vi.mock("@/lib/auth", () => ({
  getCurrentWorkspaceId: vi.fn().mockResolvedValue("test-workspace-id"),
}));

describe("AI Curator Chat Route (/api/x/radar/chat)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles Dev Mode chat and curates practical engineering post under 275 chars", async () => {
    const req = new NextRequest("http://localhost:3000/api/x/radar/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "AWS Bedrock now natively supports multi-agent orchestration via CDK without glue code.",
          },
        ],
        mode: "DEV_MODE",
        authorHandle: "awscloud",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.mode).toBe("DEV_MODE");
    expect(json.data.curatedPost.length).toBeLessThanOrEqual(275);
    expect(json.data.curatedPost).toContain("- ");
    // Must never output x.com profile as the tool link
    expect(json.data.curatedPost).not.toContain("https://x.com/awscloud");
    // Must link to genuine tool URL
    expect(json.data.targetLink).toContain("aws.amazon.com/bedrock");
  });

  it("handles My Take mode for free startup credits and perks", async () => {
    const req = new NextRequest("http://localhost:3000/api/x/radar/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Cloudflare is offering $10,000 in free startup credits for bootstrapped founders without VC funding at cloudflare.com/startups",
          },
        ],
        mode: "MY_TAKE",
        authorHandle: "k2sbhai",
        explicitUrl: "http://cloudflare.com/startups",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.mode).toBe("MY_TAKE");
    expect(json.data.curatedPost.length).toBeLessThanOrEqual(275);
    expect(json.data.curatedPost).toContain("cloudflare.com/startups");
  });

  it("handles Big Tech Leader mode with visionary hook", async () => {
    const req = new NextRequest("http://localhost:3000/api/x/radar/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: "Sam Altman announced compute scaling will 10x in the next 18 months, enabling solo founders to ship unicorn products.",
          },
        ],
        mode: "TECH_LEADER",
        authorHandle: "sama",
      }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.mode).toBe("TECH_LEADER");
    expect(json.data.curatedPost.length).toBeLessThanOrEqual(275);
    expect(json.data.reply).toBeDefined();
  });

  it("returns 400 if messages array is empty", async () => {
    const req = new NextRequest("http://localhost:3000/api/x/radar/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [],
        mode: "DEV_MODE",
      }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });
});
