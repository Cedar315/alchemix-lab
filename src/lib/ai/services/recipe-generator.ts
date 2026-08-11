import prisma from '@/lib/db/prisma';
import { GenerateRecipeRequestType } from '../schemas/ai-request.schema';
import { AICocktailRecipe } from '../schemas/recipe.schema';

type LabIngredient = Awaited<ReturnType<typeof getLabIngredients>>[number];

const clampLevel = (value: number, min = 1, max = 5) => Math.min(max, Math.max(min, Math.round(value)));

const isNumericId = (value: string | number) => {
  if (typeof value === 'number') return Number.isInteger(value);
  return /^\d+$/.test(value);
};

const isString = (value: string | null): value is string => typeof value === 'string';

const getLabIngredients = async (ingredientIds: Array<string | number>) => {
  const ids = ingredientIds.filter(isNumericId).map((id) => BigInt(id));
  const slugs = ingredientIds
    .filter((id) => !isNumericId(id))
    .map((id) => String(id).trim().toLowerCase())
    .filter(Boolean);

  return prisma.ingredient.findMany({
    where: {
      OR: [
        ids.length ? { id: { in: ids } } : undefined,
        slugs.length ? { slug: { in: slugs } } : undefined,
      ].filter(Boolean) as any,
    },
    include: {
      flavorProfile: true,
    },
    orderBy: { id: 'asc' },
  });
};

const getRelevantPairingRules = async (slugs: string[]) => {
  if (slugs.length < 2) return [];

  return prisma.labPairingRule.findMany({
    where: {
      OR: [
        { targetSlugA: { in: slugs }, targetSlugB: { in: slugs } },
        { targetSlugA: { in: slugs }, targetSlugB: { in: ['lemon', 'lime', 'ice'] } },
        { targetSlugA: { in: ['lemon', 'lime', 'ice'] }, targetSlugB: { in: slugs } },
      ],
    },
    orderBy: { id: 'asc' },
  });
};

const averageProfile = (ingredients: LabIngredient[]) => {
  const profiles = ingredients.map((ingredient) => ingredient.flavorProfile).filter(Boolean);
  const count = Math.max(profiles.length, 1);

  return {
    sweetness: profiles.reduce((sum, profile) => sum + (profile?.sweetness ?? 0), 0) / count,
    sourness: profiles.reduce((sum, profile) => sum + (profile?.sourness ?? 0), 0) / count,
    bitterness: profiles.reduce((sum, profile) => sum + (profile?.bitterness ?? 0), 0) / count,
    freshness: profiles.reduce((sum, profile) => sum + (profile?.freshness ?? 0), 0) / count,
    alcoholStrength: profiles.reduce((sum, profile) => sum + (profile?.alcoholStrength ?? 0), 0) / count,
  };
};

const pickPrimary = (ingredients: LabIngredient[]) => {
  const spirit = ingredients.find((ingredient) => ingredient.isAlcoholic);
  const mixer = ingredients.find((ingredient) => !ingredient.isAlcoholic && ingredient.category !== 'addition' && ingredient.category !== 'fruit');
  const citrus = ingredients.find((ingredient) => ['lemon', 'lime'].includes(ingredient.slug));
  const ice = ingredients.find((ingredient) => ingredient.slug === 'ice');

  return {
    spirit,
    mixer,
    citrus,
    ice,
    fallback: ingredients[0],
  };
};

const amountForIngredient = (ingredient: LabIngredient, input: GenerateRecipeRequestType) => {
  if (ingredient.slug === 'ice') return 'Full glass';
  if (['lemon', 'lime'].includes(ingredient.slug)) return '1 wedge';
  if (ingredient.category === 'addition') return 'Small amount';
  if (ingredient.isAlcoholic) return input.preferences.strength <= 2 ? '20ml' : '30ml';
  return input.preferences.sweetness >= 4 ? '120ml' : '150ml';
};

const buildCautionNotes = (ingredients: LabIngredient[], rules: Awaited<ReturnType<typeof getRelevantPairingRules>>) => {
  const notes = new Set<string>(['Drink responsibly and keep servings moderate.']);
  const hasAlcohol = ingredients.some((ingredient) => ingredient.isAlcoholic);
  const hasCaffeine = ingredients.some((ingredient) => ['red-bull', 'coffee-drink'].includes(ingredient.slug));

  if (hasAlcohol && hasCaffeine) {
    notes.add('Contains alcohol plus caffeine; caffeine may mask intoxication.');
  }

  for (const rule of rules) {
    if (rule.ruleType === 'warning' || rule.ruleType === 'conflict') {
      notes.add(rule.description);
    }
  }

  return [...notes];
};

export async function generateRecipeFromLabDatabase(input: GenerateRecipeRequestType): Promise<AICocktailRecipe[]> {
  const requestedIngredients = await getLabIngredients(input.ingredient_ids);

  if (!requestedIngredients.length) {
    throw new Error('No matching Lab Database ingredients found for ingredient_ids.');
  }

  const filteredIngredients = requestedIngredients.filter(
    (ingredient) => !input.disliked_categories?.includes(ingredient.category),
  );

  const usableIngredients = input.preferences.strength === 1
    ? filteredIngredients.filter((ingredient) => !ingredient.isAlcoholic)
    : filteredIngredients;

  if (!usableIngredients.length) {
    throw new Error('No usable ingredients remain after preferences and safety filters.');
  }

  const slugs = usableIngredients.map((ingredient) => ingredient.slug);
  const rules = await getRelevantPairingRules(slugs);
  const profile = averageProfile(usableIngredients);
  const primary = pickPrimary(usableIngredients);
  const orderedIngredients = [
    primary.spirit,
    primary.mixer,
    primary.citrus,
    primary.ice,
    ...usableIngredients.filter((ingredient) => (
      ingredient.id !== primary.spirit?.id
      && ingredient.id !== primary.mixer?.id
      && ingredient.id !== primary.citrus?.id
      && ingredient.id !== primary.ice?.id
    )),
  ].filter(Boolean) as LabIngredient[];

  const hasAlcohol = orderedIngredients.some((ingredient) => ingredient.isAlcoholic);
  const mixerName = primary.mixer?.name ?? primary.fallback.name;
  const baseName = primary.spirit?.name ?? mixerName;
  const citrusName = primary.citrus?.name ?? 'fresh citrus';
  const recipeName = hasAlcohol ? `${citrusName} ${mixerName} ${baseName}` : `${citrusName} ${mixerName} Cooler`;

  const ingredients = orderedIngredients.map((ingredient) => ({
    name: ingredient.name,
    amount: amountForIngredient(ingredient, input),
    is_required: ingredient.id === primary.spirit?.id || ingredient.id === primary.mixer?.id,
  }));

  const ruleHints = rules
    .map((rule) => rule.mixingNotes)
    .filter(isString)
    .slice(0, 2);

  const recipe: AICocktailRecipe = {
    name: recipeName,
    description: `A Lab Database recipe built from ${orderedIngredients.map((ingredient) => ingredient.name).join(', ')}.`,
    ingredients,
    steps: [
      'Fill a tall glass with ice.',
      hasAlcohol ? 'Add the spirit first so it chills quickly.' : 'Add the main mixer first.',
      'Add the remaining ingredients in order from strongest flavor to lightest mixer.',
      input.preferences.freshness >= 4 ? 'Stir gently to preserve freshness and carbonation.' : 'Stir until evenly chilled.',
      ...ruleHints,
    ],
    ratio: hasAlcohol ? '1 : 4-5 (Spirit : Mixer)' : 'Build to taste over ice',
    flavor_profile: {
      sweetness_level: clampLevel((profile.sweetness + input.preferences.sweetness) / 2),
      sourness_level: clampLevel((profile.sourness + input.preferences.sourness) / 2),
      bitterness_level: clampLevel(profile.bitterness || 1),
      freshness_level: clampLevel((profile.freshness + input.preferences.freshness) / 2),
      alcohol_strength_level: hasAlcohol ? clampLevel((profile.alcoholStrength + input.preferences.strength) / 2, 0, 5) : 0,
    },
    estimated_abv: hasAlcohol ? (input.preferences.strength <= 2 ? '4-6%' : '6-9%') : '0%',
    alcohol_level: hasAlcohol ? clampLevel(input.preferences.strength) : 1,
    beginner_friendly_score: hasAlcohol && input.preferences.strength >= 4 ? 3 : 5,
    caution_notes: buildCautionNotes(usableIngredients, rules),
    substitute_options: usableIngredients
      .filter((ingredient) => ingredient.id !== primary.spirit?.id && ingredient.id !== primary.mixer?.id)
      .map((ingredient) => ingredient.name)
      .slice(0, 3),
    ai_reasoning_summary: 'Generated locally from Supabase Lab Database flavor profiles and pairing rules; no external AI API was called.',
  };

  return [recipe];
}

export default { generateRecipeFromLabDatabase };
