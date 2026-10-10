import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAuth } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  mockAuth: {
    getCurrentUserId: vi.fn(),
    getCurrentWorkspaceId: vi.fn(),
  },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUserId: mockAuth.getCurrentUserId,
  getCurrentWorkspaceId: mockAuth.getCurrentWorkspaceId,
}));

vi.mock("@/lib/instagram-accounts", () => ({
  getWorkspaceInstagramAccount: vi.fn().mockResolvedValue(null),
}));

import { GET, PATCH } from "../app/api/user/profile/route";

describe("User Profile API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/user/profile", () => {
    it("returns 401 if user is not authenticated", async () => {
      mockAuth.getCurrentUserId.mockResolvedValueOnce(null);

      const res = await GET();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("returns user profile data when authenticated", async () => {
      mockAuth.getCurrentUserId.mockResolvedValueOnce("usr_123");
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: "usr_123",
        name: "Rahul Mirji",
        email: "rahul@example.com",
        image: "https://example.com/avatar.jpg",
      });

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Rahul Mirji");
      expect(json.data.email).toBe("rahul@example.com");
      expect(json.data.image).toBe("https://example.com/avatar.jpg");
    });
  });

  describe("PATCH /api/user/profile", () => {
    it("returns 401 if user is not authenticated", async () => {
      mockAuth.getCurrentUserId.mockResolvedValueOnce(null);

      const req = new Request("http://localhost/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: "Rahul Mirji" }),
      });

      const res = await PATCH(req as any);
      expect(res.status).toBe(401);
    });

    it("updates user name successfully", async () => {
      mockAuth.getCurrentUserId.mockResolvedValueOnce("usr_123");
      mockPrisma.user.update.mockResolvedValueOnce({
        id: "usr_123",
        name: "Rahul Mirji",
        email: "rahul@example.com",
        image: "https://example.com/avatar.jpg",
      });

      const req = new Request("http://localhost/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: "  Rahul Mirji  " }),
      });

      const res = await PATCH(req as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("Rahul Mirji");
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "usr_123" },
        data: { name: "Rahul Mirji" },
        select: { id: true, name: true, email: true, image: true },
      });
    });

    it("rejects names exceeding 100 characters", async () => {
      mockAuth.getCurrentUserId.mockResolvedValueOnce("usr_123");

      const req = new Request("http://localhost/api/user/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: "a".repeat(101) }),
      });

      const res = await PATCH(req as any);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain("100 characters");
    });
  });
});
