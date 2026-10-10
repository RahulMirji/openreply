import { describe, it, expect } from "vitest";
import {
  cleanAndAdaptCaption,
  adaptInstagramMedia,
  X_MAX_CAPTION_LENGTH,
} from "@/lib/x/media-adapter";
import type { InstagramMedia } from "@/lib/meta/client";

describe("X Media & Caption Adapter", () => {
  it("enforces captions strictly under 284 chars (capped at 280)", () => {
    const longCaption = "A".repeat(400);
    const adapted = cleanAndAdaptCaption(longCaption, { maxLength: X_MAX_CAPTION_LENGTH });
    expect(adapted.length).toBeLessThanOrEqual(280);
    expect(adapted.length).toBeLessThan(284);
    expect(adapted.endsWith("…")).toBe(true);
  });

  it("strips trailing hashtag clutter from Instagram captions", () => {
    const captionWithHashtags =
      "Check out our new launch and product update!\n\n#fyp #viral #explore #startup #saas";
    const adapted = cleanAndAdaptCaption(captionWithHashtags);
    expect(adapted).toBe("Check out our new launch and product update!");
    expect(adapted).not.toContain("#fyp");
  });

  it("limits carousel images to a maximum of 4 for X", () => {
    const media: InstagramMedia = {
      id: "media_123",
      caption: "Carousel test",
      media_type: "CAROUSEL_ALBUM",
      timestamp: new Date().toISOString(),
    };

    const children = [
      { id: "1", media_type: "IMAGE", media_url: "https://cdn.example.com/1.jpg" },
      { id: "2", media_type: "IMAGE", media_url: "https://cdn.example.com/2.jpg" },
      { id: "3", media_type: "IMAGE", media_url: "https://cdn.example.com/3.jpg" },
      { id: "4", media_type: "IMAGE", media_url: "https://cdn.example.com/4.jpg" },
      { id: "5", media_type: "IMAGE", media_url: "https://cdn.example.com/5.jpg" },
      { id: "6", media_type: "IMAGE", media_url: "https://cdn.example.com/6.jpg" },
    ];

    const result = adaptInstagramMedia(media, children);
    expect(result.mediaType).toBe("CAROUSEL_ALBUM");
    expect(result.selectedMediaUrls.length).toBe(4);
    expect(result.allMediaUrls.length).toBe(6);
    expect(result.adaptationNotice).toBeDefined();
  });

  it("selects exactly 1 video for reels or videos", () => {
    const media: InstagramMedia = {
      id: "media_reel",
      caption: "Reel test",
      media_type: "VIDEO",
      media_product_type: "REELS",
      media_url: "https://cdn.example.com/reel.mp4",
      thumbnail_url: "https://cdn.example.com/thumb.jpg",
      timestamp: new Date().toISOString(),
    };

    const result = adaptInstagramMedia(media);
    expect(result.mediaType).toBe("VIDEO");
    expect(result.selectedMediaUrls).toEqual(["https://cdn.example.com/reel.mp4"]);
    expect(result.thumbnailUrl).toBe("https://cdn.example.com/thumb.jpg");
  });

  it("removes em dashes (—) and en dashes (–) completely", () => {
    const input = "Step 5 Preview is live — and it is crazy fast – with zero config";
    const adapted = cleanAndAdaptCaption(input);
    expect(adapted).not.toContain("—");
    expect(adapted).not.toContain("–");
    expect(adapted).toContain("-");
  });

  it("formats lists cleanly with '- ' and breathable line gaps", () => {
    const input = `Step 5 Preview is FREE on OpenCode 😳

another new model just dropped for free
.
• 1M context
• text + image + video
• built for agentic work
• up to 131K output
.
try it here: opencode.ai/download

free access is live 👀`;

    const adapted = cleanAndAdaptCaption(input);

    expect(adapted).toContain("- 1M context\n- text + image + video\n- built for agentic work\n- up to 131K output");
    expect(adapted).toContain("Step 5 Preview is FREE on OpenCode 😳\n\nanother new model just dropped for free");
    expect(adapted).toContain("try it here: opencode.ai/download\n\nfree access is live 👀");
    expect(adapted).not.toContain("•");
    expect(adapted).not.toContain("\n.\n");
    expect(adapted.length).toBeLessThanOrEqual(280);
  });
});
