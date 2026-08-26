import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().email().max(254) });

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${new URL(request.url).origin}/auth/callback?next=/` },
    });
    return Response.json({ success: true, message: "如果账号已注册，验证邮件已经重新发送。" });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "请输入有效邮箱" }, { status: 400 });
    return Response.json({ error: "暂时无法重新发送验证邮件" }, { status: 500 });
  }
}
