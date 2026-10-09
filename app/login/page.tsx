import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth";
import { getCampaignTemplate } from "@/lib/templates/campaign-templates";

export const metadata = {
  title: "Login - OpenReply",
  description: "Sign in to manage Instagram comment-to-DM campaigns.",
};

const ERROR_MESSAGES: Record<string, string> = {
  credentials:
    "That email and password combination did not work. If you have never set a password, use the magic link below instead.",
  auth: "Something went wrong signing you in. Please try again.",
};

const inputClass =
  "w-full px-4 py-3 rounded bg-surface border border-border text-sm text-foreground placeholder:text-zinc-500 focus:border-accent/40 focus:outline-none transition-colors";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkEmail?: string;
    callbackUrl?: string;
    template?: string;
    error?: string;
    mode?: string;
  }>;
}) {
  const params = await searchParams;
  const checkEmail = params.checkEmail === "1";
  const selectedTemplate = getCampaignTemplate(params.template);
  const templateCallbackUrl = selectedTemplate
    ? `/campaigns/new?template=${selectedTemplate.slug}`
    : null;
  const callbackUrl = params.callbackUrl ?? templateCallbackUrl ?? "/dashboard";
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] ?? ERROR_MESSAGES.auth : null;
  // `mode=magic` renders the email-only form. Default is email + password.
  const magicMode = params.mode === "magic";

  function buildLoginUrl(nextMode: "magic" | "password"): string {
    const qs = new URLSearchParams();
    if (params.callbackUrl) qs.set("callbackUrl", params.callbackUrl);
    if (params.template) qs.set("template", params.template);
    if (nextMode === "magic") qs.set("mode", "magic");
    const query = qs.toString();
    return query ? `/login?${query}` : "/login";
  }

  async function handleLogin(formData: FormData) {
    "use server";
    const actionType = String(formData.get("actionType") ?? "credentials");
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    // `redirect` throws NEXT_REDIRECT, so per the Next.js docs it must be called
    // outside the try block. Only AuthError is handled here; anything else
    // (including the redirect thrown by a successful signIn) is rethrown.
    let errorCode: string | null = null;
    try {
      if (actionType === "magic") {
        await signIn("resend", { email, redirectTo: callbackUrl });
      } else {
        await signIn("credentials", { email, password, redirectTo: callbackUrl });
      }
    } catch (error) {
      if (error instanceof AuthError) {
        errorCode = error.type === "CredentialsSignin" ? "credentials" : "auth";
      } else {
        throw error;
      }
    }

    if (errorCode) {
      const qs = new URLSearchParams({ error: errorCode });
      if (params.callbackUrl) qs.set("callbackUrl", params.callbackUrl);
      if (params.template) qs.set("template", params.template);
      redirect(`/login?${qs.toString()}`);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground">OpenReply</h1>
          <p className="text-muted text-sm leading-relaxed mt-2">
            {selectedTemplate
              ? `Sign in to use the ${selectedTemplate.title} template.`
              : "Sign in, then connect your Instagram professional account."}
          </p>
        </div>

        <div className="panel rounded p-8 shadow-black/40">
          {selectedTemplate && !checkEmail && (
            <div className="mb-5 border border-accent/20 bg-accent/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                Template selected
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {selectedTemplate.title}
              </p>
            </div>
          )}

          {checkEmail ? (
            <div className="text-center py-4">
              <h2 className="text-lg font-semibold mb-2">Check your email</h2>
              <p className="text-sm text-muted">
                We sent you a secure sign-in link. Open it on this device to
                continue.
              </p>
            </div>
          ) : (
            <>
              {errorMessage && (
                <p
                  role="alert"
                  className="mb-5 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
                >
                  {errorMessage}
                </p>
              )}

              <form action={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground"
                  >
                    Work email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className={inputClass}
                  />
                </div>

                {!magicMode && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="password"
                        className="block text-sm font-medium text-foreground"
                      >
                        Password
                      </label>
                      <Link
                        href="/forgot-password"
                        className="text-xs text-muted hover:text-foreground hover:underline transition-colors"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  name="actionType"
                  value={magicMode ? "magic" : "credentials"}
                  className="w-full inline-flex items-center justify-center gap-2 rounded bg-accent px-6 py-3.5 text-sm font-semibold text-white transition-all"
                >
                  {magicMode ? "Email me a magic link" : "Sign in"}
                </button>
              </form>

              <div className="mt-5 border-t border-border pt-4 text-center">
                <a
                  href={buildLoginUrl(magicMode ? "password" : "magic")}
                  className="text-xs text-muted underline hover:text-foreground"
                >
                  {magicMode
                    ? "Sign in with a password instead"
                    : "Email me a magic link instead"}
                </a>
                {!magicMode && (
                  <p className="mt-3 text-xs text-muted">
                    No password yet? Sign in with a magic link, then set one
                    under Settings.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
