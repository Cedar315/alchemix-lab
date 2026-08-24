import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  nickname: z.string().trim().min(1).max(50),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: { data: { nickname: body.nickname }, emailRedirectTo: `${new URL(request.url).origin}/auth/callback?next=/` },
    });
    if (error) return Response.json({ error: error.code === "user_already_exists" ? "该邮箱已经注册" : "注册失败，请检查邮箱或稍后重试" }, { status: 400 });
    return Response.json({ user: data.user ? { id: data.user.id, email: data.user.email, nickname: body.nickname } : null, requiresEmailConfirmation: !data.session });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "请填写有效邮箱、昵称和至少 8 位密码" }, { status: 400 });
    return Response.json({ error: "注册失败，请稍后重试" }, { status: 500 });
  }
}
