import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser } from "@/lib/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const workspace = await ensureWorkspaceForUser(
    session.user.id,
    session.user.email
  );
  const [user, accounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, image: true },
    }),
    prisma.instagramAccount.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { connectedAt: "desc" },
      select: { username: true, accessToken: true },
    }),
  ]);

  let userImage = user?.image ?? null;

  // Opportunistically cache profile photo from connected Instagram account if not already cached
  if (!userImage && accounts.length > 0 && accounts[0].accessToken) {
    try {
      const { decryptToken } = await import("@/lib/meta/oauth");
      const { getUserInfo } = await import("@/lib/meta/client");
      const token = decryptToken(accounts[0].accessToken);
      const info = await getUserInfo(token);
      if (info.profile_picture_url) {
        userImage = info.profile_picture_url;
        await prisma.user
          .update({
            where: { id: session.user.id },
            data: { image: userImage },
          })
          .catch(() => {});
      }
    } catch {
      // Non-blocking fallback
    }
  }

  return (
    <DashboardShell
      workspaceName={workspace.name}
      userName={user?.name ?? null}
      userEmail={user?.email ?? session.user.email ?? null}
      userImage={userImage}
      instagramUsername={accounts[0]?.username ?? null}
      instagramAccountCount={accounts.length}
    >
      {children}
    </DashboardShell>
  );
}
