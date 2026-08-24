import prisma from "@/lib/db/prisma";
import { authErrorResponse, requireUser } from "@/lib/auth/current-user";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const deleted = await prisma.userSavedRecipe.deleteMany({ where: { userId: user.id, recipeOutputId: id } });
    if (!deleted.count) return Response.json({ error: "Saved cocktail not found" }, { status: 404 });
    return Response.json({ success: true });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Failed to remove saved cocktail" }, { status: 500 });
  }
}
