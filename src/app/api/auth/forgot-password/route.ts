import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ email: z.string().email().max(254) });

export async function POST(request: Request) {
  try {
    const { email } = schema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${new URL(request.url).origin}/auth/callback?next=/reset-password`,
    });
    return Response.json({ success: true, message: "如果账号存在，重置邮件已经发送。" });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "请输入有效邮箱" }, { status: 400 });
    return Response.json({ error: "暂时无法发送重置邮件" }, { status: 500 });
  }
}
