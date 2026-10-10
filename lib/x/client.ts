import { createHmac, randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";
import { encryptToken, decryptToken } from "@/lib/meta/oauth";

export interface XApiCredentials {
  apiKey: string;
  apiKeySecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

/**
 * Creates an OAuth 1.0a Authorization header for X API requests.
 */
function rfc3986(str: string): string {
  return encodeURIComponent(str).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Creates an OAuth 1.0a Authorization header for X API requests per RFC 5849 / RFC 3986.
 */
function createOAuth1Header(
  method: string,
  url: string,
  credentials: XApiCredentials,
  extraParams: Record<string, string> = {}
): string {
  // Strip any query params from base URL for signature
  const [baseUrl, queryString] = url.split("?");

  const allParams: Record<string, string> = {
    oauth_consumer_key: credentials.apiKey.trim(),
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: credentials.accessToken.trim(),
    oauth_version: "1.0",
    ...extraParams,
  };

  // If URL has query parameters, include them in signature
  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    searchParams.forEach((val, key) => {
      allParams[key] = val;
    });
  }

  // 1. Sort all parameters by encoded key, then encoded value
  const sortedKeys = Object.keys(allParams).sort();
  const paramString = sortedKeys
    .map((k) => `${rfc3986(k)}=${rfc3986(allParams[k])}`)
    .join("&");

  // 2. Build base signature string
  const baseString = [
    method.toUpperCase(),
    rfc3986(baseUrl),
    rfc3986(paramString),
  ].join("&");

  // 3. Create signing key: consumer_secret&token_secret
  const signingKey = `${rfc3986(credentials.apiKeySecret.trim())}&${rfc3986(
    credentials.accessTokenSecret.trim()
  )}`;

  // 4. Compute HMAC-SHA1
  const signature = createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  allParams.oauth_signature = signature;

  // 5. Build Authorization header (only oauth_* parameters)
  const oauthHeaderKeys = Object.keys(allParams)
    .filter((k) => k.startsWith("oauth_"))
    .sort();

  const headerParts = oauthHeaderKeys.map(
    (k) => `${rfc3986(k)}="${rfc3986(allParams[k])}"`
  );

  return `OAuth ${headerParts.join(", ")}`;
}

/**
 * Verifies credentials by calling X API v1.1 verify_credentials or v2 /2/users/me.
 */
export async function verifyXCredentials(
  credentials: XApiCredentials
): Promise<{ id: string; name: string; username: string }> {
  // 1. Try v1.1 verify_credentials first
  try {
    const v1Url = "https://api.twitter.com/1.1/account/verify_credentials.json";
    const v1Auth = createOAuth1Header("GET", v1Url, credentials);
    const v1Res = await fetch(v1Url, {
      method: "GET",
      headers: { Authorization: v1Auth },
    });
    const v1Text = await v1Res.text();
    if (v1Res.ok) {
      const v1Data = JSON.parse(v1Text);
      if (v1Data.id_str && v1Data.screen_name) {
        return {
          id: v1Data.id_str,
          name: v1Data.name || v1Data.screen_name,
          username: v1Data.screen_name,
        };
      }
    } else {
      console.warn("[X Auth] v1.1 verify failed:", v1Res.status, v1Text);
    }
  } catch (err) {
    console.warn("[X Auth] v1.1 error:", err);
  }

  // 2. Try v2 /2/users/me
  const url = "https://api.twitter.com/2/users/me";
  const authHeader = createOAuth1Header("GET", url, credentials);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: authHeader,
    },
  });

  const resText = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(resText);
  } catch {
    // not JSON
  }

  if (!res.ok || data.errors || !data.data) {
    console.error("[X Auth] v2 verify failed:", res.status, resText);
    const errorMsg =
      data.errors?.[0]?.message ||
      data.detail ||
      resText ||
      res.statusText ||
      "Invalid X API credentials";
    throw new Error(errorMsg);
  }

  return data.data;
}

/**
 * Uploads an image or video buffer to X (upload.twitter.com/1.1/media/upload.json).
 */
export async function uploadMediaToX(
  credentials: XApiCredentials,
  mediaBuffer: Buffer,
  mimeType = "image/jpeg"
): Promise<string> {
  const isVideo = mimeType.startsWith("video/");
  const url = "https://upload.twitter.com/1.1/media/upload.json";

  if (!isVideo) {
    // Single image: upload via multipart/form-data
    // In RFC 5849, multipart/form-data bodies are not included in the OAuth base string.
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(mediaBuffer)], { type: mimeType });
    formData.append("media", blob, "image.jpg");

    const authHeader = createOAuth1Header("POST", url, credentials);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
      body: formData,
    });

    const resText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(resText);
    } catch {
      // not JSON
    }

    if (!res.ok || !data.media_id_string) {
      console.error("[X Image Upload Error]", res.status, resText);
      throw new Error(data.errors?.[0]?.message || resText || "Failed to upload image to X");
    }
    return data.media_id_string;
  }

  // Chunked upload for video
  const totalBytes = mediaBuffer.length;

  // 1. INIT
  const initExtra = {
    command: "INIT",
    total_bytes: totalBytes.toString(),
    media_type: mimeType,
    media_category: "tweet_video",
  };
  const initParams = new URLSearchParams(initExtra);

  const initAuth = createOAuth1Header("POST", url, credentials, initExtra);
  const initRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: initAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: initParams.toString(),
  });
  const initData = await initRes.json();
  const mediaId = initData.media_id_string;
  if (!mediaId) throw new Error(initData.errors?.[0]?.message || "Failed to initialize video upload on X");

  // 2. APPEND (send file as multipart)
  const appendForm = new FormData();
  appendForm.append("command", "APPEND");
  appendForm.append("media_id", mediaId);
  appendForm.append("segment_index", "0");
  appendForm.append("media", new Blob([new Uint8Array(mediaBuffer)], { type: mimeType }), "video.mp4");

  const appendAuth = createOAuth1Header("POST", url, credentials);
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: appendAuth,
    },
    body: appendForm,
  });

  // 3. FINALIZE
  const finExtra = {
    command: "FINALIZE",
    media_id: mediaId,
  };
  const finParams = new URLSearchParams(finExtra);

  const finAuth = createOAuth1Header("POST", url, credentials, finExtra);
  const finRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: finAuth,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: finParams.toString(),
  });
  const finData = await finRes.json();
  if (finData.error) throw new Error(finData.error);

  // 4. STATUS Polling (For videos that require server-side encoding on X)
  if (finData.processing_info) {
    let state = finData.processing_info.state;
    let checkAfter = finData.processing_info.check_after_secs || 2;
    let attempts = 0;

    while ((state === "pending" || state === "in_progress") && attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, checkAfter * 1000));
      attempts++;

      const statusUrl = `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`;
      const statusAuth = createOAuth1Header("GET", statusUrl, credentials);
      const statusRes = await fetch(statusUrl, {
        method: "GET",
        headers: { Authorization: statusAuth },
      });
      const statusData = await statusRes.json();
      state = statusData.processing_info?.state;
      checkAfter = statusData.processing_info?.check_after_secs || 2;

      if (state === "failed") {
        throw new Error(
          statusData.processing_info?.error?.message ||
            "Video processing failed on X"
        );
      }
    }
  }

  return mediaId;
}

/**
 * Posts a Tweet using X API v2 (POST /2/tweets).
 */
export async function createTweet(
  credentials: XApiCredentials,
  text: string,
  mediaIds: string[] = []
): Promise<{ id: string; text: string }> {
  const url = "https://api.twitter.com/2/tweets";
  const authHeader = createOAuth1Header("POST", url, credentials);

  const payload: { text: string; media?: { media_ids: string[] } } = {
    text: text.slice(0, 280),
  };

  if (mediaIds.length > 0) {
    payload.media = { media_ids: mediaIds };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const resText = await res.text();
  console.log("[CreateTweet Debug]", res.status, resText);
  let data: any = {};
  try {
    data = JSON.parse(resText);
  } catch {
    // not JSON
  }

  if (!res.ok || data.errors || !data.data) {
    if (res.status === 402 || data.detail === "credits depleted") {
      throw new Error(
        "credits depleted: X has transitioned developer accounts to a pay-per-use credit model ($0.015/post) and your X Developer balance is 0. Add prepaid credits in the X Developer Portal or publish 100% free using the X Web Composer button."
      );
    }
    const msg = data.errors?.[0]?.message || data.detail || resText || "Failed to post tweet to X";
    throw new Error(msg);
  }

  return data.data;
}

/**
 * Gets credentials for workspace. Checks DB XAccount, falls back to .env if configured.
 */
export async function getWorkspaceXCredentials(
  workspaceId: string
): Promise<XApiCredentials | null> {
  const xAccount = await prisma.xAccount.findUnique({
    where: { workspaceId },
  });

  if (xAccount?.accessToken) {
    try {
      const parsed = JSON.parse(decryptToken(xAccount.accessToken));
      return parsed;
    } catch {
      // Fallback if raw token
    }
  }

  // Fallback to environment variables if provided
  const {
    X_API_KEY,
    X_API_KEY_SECRET,
    X_ACCESS_TOKEN,
    X_ACCESS_TOKEN_SECRET,
  } = process.env;

  if (X_API_KEY && X_API_KEY_SECRET && X_ACCESS_TOKEN && X_ACCESS_TOKEN_SECRET) {
    return {
      apiKey: X_API_KEY,
      apiKeySecret: X_API_KEY_SECRET,
      accessToken: X_ACCESS_TOKEN,
      accessTokenSecret: X_ACCESS_TOKEN_SECRET,
    };
  }

  return null;
}
