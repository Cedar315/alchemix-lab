import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

type RateEntry = { count: number; resetAt: number };
const rateStore = new Map<string, RateEntry>();

function rateLimit(request: NextRequest, userId?: string) {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") return null;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 256_000) return NextResponse.json({ error: "Request body too large" }, { status: 413 });

  const path = request.nextUrl.pathname;
  const isExpensive = path === "/api/ask" || path === "/api/agent" || path === "/api/admin/rag" || path.startsWith("/api/ai/") || path === "/api/ingredients/ai-lookup" || path === "/api/cocktails/customize";
  const isAiLookup = path === "/api/ingredients/ai-lookup";
  const isAuthEmail = path === "/api/auth/sign-up" || path === "/api/auth/forgot-password" || path === "/api/auth/resend-confirmation";
  const isSignIn = path === "/api/auth/sign-in";
  const isAnalytics = path === "/api/analytics/events";
  const limit = isAiLookup || isAuthEmail ? 5 : isSignIn ? 10 : isExpensive ? 20 : isAnalytics ? 60 : 40;
  const windowMs = 60_000;
  const ip = request.headers.get("x-vercel-forwarded-for")?.split(",")[0] ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const key = `${userId ?? ip}:${isAiLookup ? "ai-lookup" : isAuthEmail ? "auth-email" : isSignIn ? "sign-in" : isExpensive ? "expensive" : isAnalytics ? "analytics" : "write"}`;
  const now = Date.now();
  if (rateStore.size > 10_000) {
    for (const [storedKey, stored] of rateStore) if (stored.resetAt <= now) rateStore.delete(storedKey);
  }
  const current = rateStore.get(key);
  const entry = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  entry.count += 1;
  rateStore.set(key, entry);
  if (entry.count > limit) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) } });
  return null;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const limited = rateLimit(request, user?.id);
  if (limited) return limited;
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const configuredEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase());
    const isAdmin = user && (user.app_metadata?.role === "admin" || configuredEmails.includes(user.email?.toLowerCase() ?? ""));
    if (!isAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
      redirectUrl.searchParams.set("auth", user ? "forbidden" : "required");
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
