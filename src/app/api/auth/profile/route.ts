import { z } from "zod";
import { authErrorResponse, requireUser } from "@/lib/auth/current-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import prisma from "@/lib/db/prisma";

const schema = z.object({ nickname: z.string().trim().min(1).max(50) });

export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser();
    const { nickname } = schema.parse(await request.json());
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ data: { nickname } });
    if (error) return Response.json({ error: "更新档案失败" }, { status: 400 });
    await prisma.user.update({ where: { id: user.id }, data: { nickname } });
    return Response.json({ user: { id: user.id, email: user.email, nickname } });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return Response.json({ error: error instanceof z.ZodError ? "昵称长度应为 1–50 个字符" : "更新档案失败" }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
