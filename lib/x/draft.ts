import { prisma } from "@/lib/db/client";
import { getSingleMedia, getCarouselChildren } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/oauth";
import { adaptInstagramMedia, cleanAndAdaptCaption, X_MAX_CAPTION_LENGTH } from "./media-adapter";
import type { CrossPostStatus, XCrossPostDraft } from "@/app/generated/prisma/client";

export class DraftPreparationError extends Error {
  constructor(message: string, public code = 400) {
    super(message);
    this.name = "DraftPreparationError";
  }
}

/**
 * Prepares an X Cross-Post draft from an existing Instagram post.
 * Enforces duplicate prevention: if a draft already exists for this post in the workspace,
 * it returns the existing draft instead of creating a duplicate.
 */
export async function prepareCrossPostDraft(params: {
  workspaceId: string;
  instagramAccountId: string;
  instagramPostId: string;
  includeLink?: boolean;
}): Promise<{ draft: XCrossPostDraft; isExisting: boolean; notice?: string }> {
  const { workspaceId, instagramAccountId, instagramPostId, includeLink } = params;

  // 1. Duplicate check (Requirement 2)
  const existing = await prisma.xCrossPostDraft.findUnique({
    where: {
      workspaceId_instagramPostId: {
        workspaceId,
        instagramPostId,
      },
    },
  });

  if (existing) {
    return { draft: existing, isExisting: true };
  }

  // 2. Fetch Instagram Account and decrypt token
  const account = await prisma.instagramAccount.findFirst({
    where: {
      id: instagramAccountId,
      workspaceId,
    },
  });

  if (!account || !account.accessToken) {
    throw new DraftPreparationError("Connected Instagram account not found.", 404);
  }

  const token = decryptToken(account.accessToken);

  // 3. Fetch media from Meta
  const media = await getSingleMedia(token, instagramPostId);
  if (!media) {
    throw new DraftPreparationError("Instagram post not found on Meta.", 404);
  }

  // 4. Fetch children if carousel
  let children: Array<{ id: string; media_type: string; media_url?: string; thumbnail_url?: string }> = [];
  if (media.media_type === "CAROUSEL_ALBUM") {
    try {
      children = await getCarouselChildren(token, instagramPostId);
    } catch (err) {
      console.warn("[Cross-Post] Could not fetch carousel children:", err);
    }
  }

  // 5. Adapt media & caption (< 284 chars constraint, default 280)
  const adaptedMedia = adaptInstagramMedia(media, children);
  const adaptedCaption = cleanAndAdaptCaption(media.caption, {
    permalink: media.permalink,
    includeLink,
    maxLength: X_MAX_CAPTION_LENGTH,
  });

  // 6. Save new draft
  const draft = await prisma.xCrossPostDraft.create({
    data: {
      workspaceId,
      instagramAccountId,
      instagramPostId,
      instagramPermalink: media.permalink,
      mediaType: adaptedMedia.mediaType,
      originalMediaUrls: adaptedMedia.allMediaUrls,
      selectedMediaUrls: adaptedMedia.selectedMediaUrls,
      thumbnailUrl: adaptedMedia.thumbnailUrl,
      originalCaption: media.caption ?? null,
      tweetText: adaptedCaption,
      status: "DRAFT",
    },
  });

  return {
    draft,
    isExisting: false,
    notice: adaptedMedia.adaptationNotice,
  };
}

/**
 * Updates a draft (edit text, select/deselect media, approve/reject).
 */
export async function updateCrossPostDraft(params: {
  draftId: string;
  workspaceId: string;
  tweetText?: string;
  selectedMediaUrls?: string[];
  status?: CrossPostStatus;
}): Promise<XCrossPostDraft> {
  const { draftId, workspaceId, tweetText, selectedMediaUrls, status } = params;

  // Validation: caption must be strictly <= 280 chars
  if (tweetText !== undefined && tweetText.length > X_MAX_CAPTION_LENGTH) {
    throw new DraftPreparationError(
      `Tweet text exceeds maximum length of ${X_MAX_CAPTION_LENGTH} characters (current: ${tweetText.length}).`,
      400
    );
  }

  const existing = await prisma.xCrossPostDraft.findFirst({
    where: { id: draftId, workspaceId },
  });

  if (!existing) {
    throw new DraftPreparationError("Draft not found.", 404);
  }

  const data: Partial<XCrossPostDraft> = {};
  if (tweetText !== undefined) data.tweetText = tweetText;
  if (selectedMediaUrls !== undefined) data.selectedMediaUrls = selectedMediaUrls;
  if (status !== undefined) {
    data.status = status;
    if (status === "APPROVED") {
      data.approvedAt = new Date();
    }
  }

  return prisma.xCrossPostDraft.update({
    where: { id: draftId },
    data,
  });
}
