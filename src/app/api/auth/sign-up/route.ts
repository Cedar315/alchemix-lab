import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  nickname: z.string().trim().min(1).max(50),
  acceptedPolicies: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
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
    return Response.json({ user: data.user ? { id: data.user.id, email: data.user.email, nickname: body.nickname } : null, requiresEmailConfirmation: !data.session });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "请填写有效邮箱、昵称和至少 8 位密码，并同意相关协议" }, { status: 400 });
    return Response.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
