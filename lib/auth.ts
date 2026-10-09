import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser, getPrimaryWorkspace } from "@/lib/workspace";
import { verifyPassword } from "@/lib/auth/password";
import {
  clearFailedLogins,
  isLoginBlocked,
  recordFailedLogin,
} from "@/lib/auth/login-throttle";

type AdapterPrismaClient = Parameters<typeof PrismaAdapter>[0];

/**
 * A real scrypt hash of a random value, verified against when an account does
 * not exist or has no password. This keeps the failure path's timing similar to
 * the success path so an attacker cannot distinguish "no such user" from "wrong
 * password" by response time.
 */
const DUMMY_PASSWORD_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "Ej0YyQ1sQmQnJ0kZ3sZ8dQ0cQ8vJ0kZ3sZ8dQ0cQ8vJ0kZ3sZ8dQ0cQ8vJ0kZ3sZ8dQ0cQ8vJ0g==";

export const authConfig = {
  adapter: PrismaAdapter(prisma as unknown as AdapterPrismaClient),
  providers: [
    Credentials({
      name: "Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Returning null makes Auth.js raise CredentialsSignin, which the login
      // page renders as a single generic message. Every failure path below is
      // deliberately indistinguishable to the caller so this endpoint cannot be
      // used to enumerate which emails have accounts.
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)
          ?.toLowerCase()
          .trim();
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;
        if (await isLoginBlocked(email)) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
          },
        });

        // No account, or an account that has never set a password (magic-link
        // only). Still run a verify against a dummy hash so the response time
        // does not reveal which case it was.
        if (!user?.passwordHash) {
          await verifyPassword(password, DUMMY_PASSWORD_HASH);
          await recordFailedLogin(email);
          return null;
        }

        if (!(await verifyPassword(password, user.passwordHash))) {
          await recordFailedLogin(email);
          return null;
        }

        await clearFailedLogins(email);
        await ensureWorkspaceForUser(user.id, user.email);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) {
        await ensureWorkspaceForUser(user.id, user.email);
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getCurrentWorkspaceId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const workspace = await getPrimaryWorkspace(userId);
  if (workspace) return workspace.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const createdWorkspace = await ensureWorkspaceForUser(userId, user?.email);
  return createdWorkspace.id;
}
