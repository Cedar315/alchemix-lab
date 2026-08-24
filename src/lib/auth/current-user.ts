import "server-only";
import prisma from "@/lib/db/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  const authUser = data.user;
  const email = authUser.email!;
  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: {
      email,
      nickname: typeof authUser.user_metadata?.nickname === "string" ? authUser.user_metadata.nickname : undefined,
    },
    create: {
      id: authUser.id,
      email,
      nickname: typeof authUser.user_metadata?.nickname === "string" ? authUser.user_metadata.nickname : email.split("@")[0],
    },
  });

  return { authUser, user };
}

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) throw new AuthenticationError("Authentication required");
  return current;
}

export async function requireAdmin() {
  const current = await requireUser();
  const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const isAdmin = current.authUser.app_metadata?.role === "admin" || configuredEmails.includes(current.user.email.toLowerCase());
  if (!isAdmin) throw new AuthorizationError("Administrator access required");
  return current;
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthenticationError) return Response.json({ error: error.message }, { status: 401 });
  if (error instanceof AuthorizationError) return Response.json({ error: error.message }, { status: 403 });
  return null;
}
