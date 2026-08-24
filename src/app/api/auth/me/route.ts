import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  const current = await getCurrentUser();
  return Response.json({
    user: current ? { id: current.user.id, email: current.user.email, nickname: current.user.nickname, avatarUrl: current.user.avatarUrl } : null,
  });
}
