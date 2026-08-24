-- The browser receives the Supabase anon key for Auth. Deny direct Data API
-- access to application tables; all data access goes through authenticated
-- Next.js route handlers and the server-side Prisma role.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "data_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cocktails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cocktail_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customized_recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customized_recipe_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingredient_lookup_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "safety_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "flavor_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lab_pairing_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cocktail_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipe_outputs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_saved_recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "drink_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_feedback_flavor_adjustments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classic_cocktails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "remix_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classic_cocktail_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classic_cocktail_variant_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "variant_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipe_ingredients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recipe_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "classic_recipe_variants" ENABLE ROW LEVEL SECURITY;
