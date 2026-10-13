import type { PrismaClient, Prisma } from '@prisma/client';
import { canonicalRecipeId } from './canonical';
import { favoriteIdentity } from './identity';

export async function persistFavorite(prisma:PrismaClient, userId:string, cocktail:Record<string,any>) {
    let recipeKey=favoriteIdentity(cocktail);
    if (recipeKey.startsWith('recipe:')) {
      const id=canonicalRecipeId(recipeKey.slice(7));
      const recipe=await prisma.recipe.findFirst({where:{OR:[{slug:id},...(/^\d+$/.test(id)?[{id:BigInt(id)}]:[])]},select:{slug:true,canonicalRecipe:{select:{slug:true}}}});
      recipeKey='recipe:'+(recipe?.canonicalRecipe?.slug||recipe?.slug||id);
    }
    const output = await prisma.$transaction(async (tx) => {
      // Lock the user/key pair so simultaneous double taps cannot create duplicate outputs.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${userId+':'+recipeKey},0))::text`;
      const existing=await tx.userSavedRecipe.findUnique({where:{userId_recipeKey:{userId:userId,recipeKey}},include:{recipeOutput:true}});
      if(existing)return existing.recipeOutput;
      const created = await tx.recipeOutput.create({ data: { inputParams: { source: "saved-cocktail" }, recipeJson: {...cocktail,...(recipeKey.startsWith('recipe:')?{recipeId:recipeKey.slice(7)}:{})} as Prisma.InputJsonValue } });
      await tx.userSavedRecipe.create({ data: { userId: userId, recipeOutputId: created.id,recipeKey } });
      return created;
    });
    return { ...(output.recipeJson as Record<string,unknown>), id: output.id, ...(recipeKey.startsWith('recipe:')?{recipeId:recipeKey.slice(7)}:{}) };
}
