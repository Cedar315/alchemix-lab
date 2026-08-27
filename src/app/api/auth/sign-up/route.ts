import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  nickname: z.string().trim().min(1).max(50),
  acceptedPolicies: z.literal(true),
});

const registeredMessage = "该邮箱已经注册过，请直接登录；如果忘记密码，可以发送重置邮件。";

async function emailAlreadyRegistered(email: string) {
  const appUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });
  if (appUser) return true;

  const admin = createSupabaseAdminClient();
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    if (data.users.some((user) => user.email?.toLowerCase() === email)) return true;
    if (data.users.length < perPage) return false;
  }
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    if (await emailAlreadyRegistered(email)) {
      return Response.json({ error: registeredMessage, code: "EMAIL_ALREADY_REGISTERED" }, { status: 409 });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: body.password,
      options: {
        data: {
          nickname: body.nickname,
          acceptedPoliciesAt: new Date().toISOString(),
          policiesVersion: "2026-08-26",
        },
        emailRedirectTo: `${new URL(request.url).origin}/auth/callback?next=/`,
      },
    });
    if (error) return Response.json({ error: "暂时无法完成注册，请检查填写内容或稍后重试" }, { status: 400 });
    // Supabase may deliberately return an obfuscated user for an existing email.
    // Treat an empty identities collection as already registered, without sending user data.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return Response.json({ error: registeredMessage, code: "EMAIL_ALREADY_REGISTERED" }, { status: 409 });
    }
    return Response.json({ user: data.user ? { id: data.user.id, email: data.user.email, nickname: body.nickname } : null, requiresEmailConfirmation: !data.session });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "请填写有效邮箱、昵称和至少 8 位密码，并同意相关协议" }, { status: 400 });
    return Response.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
