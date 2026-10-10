/**
 * Media & Caption Adapter for X (Twitter) Cross-Posting
 *
 * Adapts Instagram captions and media assets to comply with X's constraints:
 * - Caption: Strictly under 284 characters (default: max 280 chars)
 * - Media: Up to 4 images, OR exactly 1 video
 */

import type { InstagramMedia } from "@/lib/meta/client";

export const X_MAX_CAPTION_LENGTH = 280;
export const X_MAX_IMAGES = 4;

/**
 * Structures text into high-impact, clean X (Twitter) format:
 * - Generous, breathable spacing with double line breaks (\n\n) between blocks
 * - Bullet lists formatted consistently with "- " syntax
 * - Eliminates em dashes (—) and en dashes (–) completely
 * - Strips Instagram junk (trailing hashtag walls, dot spacers, "link in bio")
 * - Strictly respects the 280-character maximum limit
 */
export function formatCleanXCaption(
  rawText?: string | null,
  options: {
    permalink?: string | null;
    includeLink?: boolean;
    maxLength?: number;
  } = {}
): string {
  const { permalink, includeLink = false, maxLength = X_MAX_CAPTION_LENGTH } = options;

  if (!rawText || !rawText.trim()) {
    if (includeLink && permalink) {
      return `try it here: ${permalink}`.slice(0, maxLength);
    }
    return "";
  }

  // 1. Normalize line endings and strip em dashes (— / \u2014) and en dashes (– / \u2013)
  let text = rawText
    .replace(/\r\n/g, "\n")
    .replace(/[\u2014\u2013\u2015]/g, "-")
    .replace(/--+/g, "-");

  // 2. Strip trailing hashtag blocks often found on Instagram (#fyp #explore #viral)
  text = text.replace(/(\n\s*(?:#[\p{L}\p{N}_]+\s*)+)$/gu, "").trim();

  // 3. Strip Instagram "link in bio" filler phrases
  text = text
    .replace(
      /^[ \t]*(?:👉|👇|🔗)?\s*(?:check\s+(?:out\s+)?(?:the\s+)?link\s+in\s+(?:bio|comments)|link\s+in\s+bio|tap\s+(?:the\s+)?link\s+in\s+bio)[^\n]*$/gim,
      ""
    )
    .trim();

  // 4. Split into lines and filter out empty / dot-spacer lines
  // Instagram users often use lines like "." or "•" or "_" for fake linebreaks
  const rawLines = text.split("\n");
  const cleanedLines: string[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (/^[.•▪_~\s]+$/.test(trimmed)) {
      continue;
    }
    cleanedLines.push(trimmed);
  }

  // 5. Categorize and format lines into blocks
  const bulletRegex = /^(?:[•*+▪▫◦✦✧⁃✓✔☑👉⚡🔹🔸]|(?:\d+[.)]))\s*(.+)$/u;
  const dashBulletRegex = /^-\s*(.+)$/;

  interface FormattedBlock {
    type: "bullet-list" | "paragraph";
    lines: string[];
  }

  const blocks: FormattedBlock[] = [];
  let currentList: string[] = [];

  for (const line of cleanedLines) {
    if (!line) {
      if (currentList.length > 0) {
        blocks.push({ type: "bullet-list", lines: currentList });
        currentList = [];
      }
      continue;
    }

    const bulletMatch = line.match(bulletRegex);
    const dashMatch = line.match(dashBulletRegex);

    if (bulletMatch || dashMatch) {
      const itemText = (bulletMatch ? bulletMatch[1] : dashMatch![1]).trim();
      if (itemText) {
        const cleanItem = itemText.replace(/^[\u2014\u2013-]+\s*/, "").trim();
        currentList.push(`- ${cleanItem}`);
      }
    } else {
      if (currentList.length > 0) {
        blocks.push({ type: "bullet-list", lines: currentList });
        currentList = [];
      }
      blocks.push({ type: "paragraph", lines: [line] });
    }
  }

  if (currentList.length > 0) {
    blocks.push({ type: "bullet-list", lines: currentList });
  }

  // Helper to assemble text with clean gaps between sections
  function assemble(blockList: FormattedBlock[], cta: string): string {
    const blockStrings = blockList.map((b) => b.lines.join("\n"));
    if (cta) {
      blockStrings.push(cta);
    }
    return blockStrings.filter(Boolean).join("\n\n").trim();
  }

  const ctaString = includeLink && permalink ? `try it here: ${permalink}` : "";

  // 6. Assemble and enforce maxLength (280)
  let result = assemble(blocks, ctaString);

  if (result.length <= maxLength) {
    return result;
  }

  // If too long, prune trailing bullet points if there's a list with > 3 items
  const reducedBlocks: FormattedBlock[] = JSON.parse(JSON.stringify(blocks));
  const listBlock = reducedBlocks.find((b) => b.type === "bullet-list");

  if (listBlock && listBlock.lines.length > 3) {
    while (listBlock.lines.length > 2) {
      listBlock.lines.pop();
      result = assemble(reducedBlocks, ctaString);
      if (result.length <= maxLength) {
        return result;
      }
    }
  }

  // If still over length, truncate cleanly on word boundary before maxLength
  const suffix = ctaString ? `\n\n${ctaString}` : "";
  const availableLength = maxLength - suffix.length;

  if (availableLength <= 0) {
    return result.slice(0, maxLength);
  }

  const rawForCut = assemble(reducedBlocks, "");
  if (rawForCut.length + suffix.length <= maxLength) {
    return (rawForCut + suffix).trim();
  }

  const truncated = rawForCut.slice(0, availableLength - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  const cleanCut =
    lastSpace > Math.floor(availableLength * 0.6)
      ? truncated.slice(0, lastSpace)
      : truncated;

  return `${cleanCut.trim()}…${suffix}`.trim();
}

/**
 * Strips Instagram-specific clutter and cleanly formats into clean X structure.
 */
export function cleanAndAdaptCaption(
  originalCaption?: string | null,
  options: {
    permalink?: string | null;
    includeLink?: boolean;
    maxLength?: number;
  } = {}
): string {
  return formatCleanXCaption(originalCaption, options);
}

export interface AdaptedMediaResult {
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  allMediaUrls: string[];
  selectedMediaUrls: string[];
  thumbnailUrl?: string;
  adaptationNotice?: string;
}

/**
 * Validates and selects media assets according to X restrictions.
 */
export function adaptInstagramMedia(
  media: InstagramMedia,
  children: Array<{ id: string; media_type: string; media_url?: string; thumbnail_url?: string }> = []
): AdaptedMediaResult {
  const isVideo = media.media_type === "VIDEO" || media.media_product_type === "REELS";

  if (media.media_type === "CAROUSEL_ALBUM" && children.length > 0) {
    const images = children
      .filter((c) => c.media_type === "IMAGE" && c.media_url)
      .map((c) => c.media_url as string);

    const videos = children
      .filter((c) => c.media_type === "VIDEO" && c.media_url)
      .map((c) => c.media_url as string);

    const allUrls = children
      .map((c) => c.media_url)
      .filter((u): u is string => Boolean(u));

    // X allows max 4 images OR 1 video.
    // If carousel contains images, select up to the first 4 images.
    if (images.length > 0) {
      const selected = images.slice(0, X_MAX_IMAGES);
      let notice: string | undefined;
      if (images.length > X_MAX_IMAGES || videos.length > 0) {
        notice = `Instagram carousel contained ${children.length} items. Selected first ${selected.length} images (X allows up to 4 images per post).`;
      }
      return {
        mediaType: "CAROUSEL_ALBUM",
        allMediaUrls: allUrls,
        selectedMediaUrls: selected,
        thumbnailUrl: media.thumbnail_url || media.media_url,
        adaptationNotice: notice,
      };
    }

    // Carousel of only videos: take the first video
    if (videos.length > 0) {
      return {
        mediaType: "CAROUSEL_ALBUM",
        allMediaUrls: allUrls,
        selectedMediaUrls: [videos[0]],
        thumbnailUrl: children[0].thumbnail_url || media.thumbnail_url,
        adaptationNotice: `Instagram carousel contained multiple videos. Selected first video (X allows 1 video per post).`,
      };
    }
  }

  // Single Video / Reel
  if (isVideo) {
    const videoUrl = media.media_url || "";
    return {
      mediaType: "VIDEO",
      allMediaUrls: videoUrl ? [videoUrl] : [],
      selectedMediaUrls: videoUrl ? [videoUrl] : [],
      thumbnailUrl: media.thumbnail_url || media.media_url,
    };
  }

  // Single Image
  const imageUrl = media.media_url || "";
  return {
    mediaType: "IMAGE",
    allMediaUrls: imageUrl ? [imageUrl] : [],
    selectedMediaUrls: imageUrl ? [imageUrl] : [],
    thumbnailUrl: imageUrl,
  };
}
