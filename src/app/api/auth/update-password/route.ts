import { z } from "zod";
import { requireUser, authErrorResponse } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ password: z.string().min(8).max(128) });

export async function PATCH(request: Request) {
  try {
    await requireUser();
    const { password } = schema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return Response.json({ error: "密码更新失败" }, { status: 400 });
    return Response.json({ success: true });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return Response.json({ error: error instanceof z.ZodError ? "密码至少需要 8 位" : "密码更新失败" }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
