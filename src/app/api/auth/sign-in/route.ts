import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(body);
    if (error) return Response.json({ error: "邮箱或密码错误，或邮箱尚未验证" }, { status: 401 });
    const current = await getCurrentUser();
    return Response.json({ user: current ? { id: current.user.id, email: current.user.email, nickname: current.user.nickname } : null });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "请输入有效邮箱和密码" }, { status: 400 });
    return Response.json({ error: "登录失败，请稍后重试" }, { status: 500 });
  }
}
