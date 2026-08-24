import { z } from "zod";
import prisma from "@/lib/db/prisma";
import { authErrorResponse, requireUser } from "@/lib/auth/current-user";
import { Prisma } from "@prisma/client";

const cocktailSchema = z.object({
  chineseName: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  spirit: z.string().max(200).optional(),
  mixer: z.string().max(200).optional(),
  size: z.string().max(50).optional(),
  rating: z.object({ sweet: z.number().min(0).max(5), acid: z.number().min(0).max(5), strength: z.number().min(0).max(5) }).optional(),
  comments: z.string().max(5000).optional(),
  tags: z.array(z.string().max(50)).max(30).optional(),
  savedAt: z.string().max(30).optional(),
  ratingValue: z.number().min(0).max(5).optional(),
}).passthrough();

export async function GET() {
  try {
    const { user } = await requireUser();
    const saved = await prisma.userSavedRecipe.findMany({ where: { userId: user.id }, include: { recipeOutput: true }, orderBy: { savedAt: "desc" }, take: 500 });
    return Response.json({ cocktails: saved.map((item) => ({ ...(item.recipeOutput.recipeJson as Record<string, unknown>), id: item.recipeOutputId })) });
  } catch (error) {
    return authErrorResponse(error) ?? Response.json({ error: "Failed to read saved cocktails" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const cocktail = cocktailSchema.parse(await request.json());
    const output = await prisma.$transaction(async (tx) => {
      const created = await tx.recipeOutput.create({ data: { inputParams: { source: "saved-cocktail" }, recipeJson: cocktail as Prisma.InputJsonValue } });
      await tx.userSavedRecipe.create({ data: { userId: user.id, recipeOutputId: created.id } });
      return created;
    });
    return Response.json({ cocktail: { ...cocktail, id: output.id } });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    return Response.json({ error: error instanceof z.ZodError ? "Invalid cocktail" : "Failed to save cocktail" }, { status: error instanceof z.ZodError ? 400 : 500 });
  }
}
