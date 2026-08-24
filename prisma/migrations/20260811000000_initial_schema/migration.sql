-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nickname" TEXT,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID,
    "sweetness_preference" INTEGER NOT NULL DEFAULT 3,
    "bitterness_tolerance" INTEGER NOT NULL DEFAULT 3,
    "alcohol_tolerance" INTEGER NOT NULL DEFAULT 3,
    "acidity_preference" INTEGER NOT NULL DEFAULT 3,
    "favorite_tags" JSONB NOT NULL DEFAULT '[]',
    "disliked_ingredients" JSONB NOT NULL DEFAULT '[]',
    "favorite_ingredients" JSONB NOT NULL DEFAULT '[]',
    "preferred_alcohol_level" INTEGER NOT NULL DEFAULT 2,
    "disliked_categories" JSONB NOT NULL DEFAULT '[]',
    "preferred_flavor_tags" JSONB NOT NULL DEFAULT '[]',
    "custom_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_sources" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "reliability_score" DOUBLE PRECISION NOT NULL DEFAULT 1.00,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredients" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_zh" TEXT NOT NULL DEFAULT '',
    "name_en" TEXT NOT NULL DEFAULT '',
    "brand" TEXT,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "type" TEXT NOT NULL DEFAULT 'other',
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "abv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "abv_range" TEXT,
    "sweetness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acidity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bitterness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "carbonation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "viscosity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alcohol_intensity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sugar_g_per_100ml" DOUBLE PRECISION,
    "caffeine" BOOLEAN,
    "ph_range" TEXT,
    "ingredients" JSONB NOT NULL DEFAULT '[]',
    "flavor_tags" JSONB NOT NULL DEFAULT '[]',
    "suitable_with" JSONB NOT NULL DEFAULT '[]',
    "avoid_with" JSONB NOT NULL DEFAULT '[]',
    "recommended_volume_ml" JSONB NOT NULL DEFAULT '[]',
    "convenience_store_availability" INTEGER NOT NULL DEFAULT 3,
    "source_type" TEXT NOT NULL DEFAULT 'local_database',
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "is_temporary" BOOLEAN NOT NULL DEFAULT false,
    "source_note" TEXT,
    "is_alcoholic" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cocktails" (
    "id" BIGSERIAL NOT NULL,
    "name_zh" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "original_flavor_description" TEXT NOT NULL,
    "beginner_warning" TEXT,
    "bitterness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sweetness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acidity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alcohol_intensity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "is_classic" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cocktails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cocktail_ingredients" (
    "id" BIGSERIAL NOT NULL,
    "cocktail_id" BIGINT NOT NULL,
    "ingredient_id" BIGINT NOT NULL,
    "amount_ml" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'ml',
    "role" TEXT NOT NULL DEFAULT 'other',
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cocktail_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customized_recipes" (
    "id" BIGSERIAL NOT NULL,
    "base_cocktail_id" BIGINT,
    "user_id" UUID,
    "name_zh" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "selected_goals" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT NOT NULL,
    "ai_explanation" TEXT,
    "bitterness_before" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bitterness_after" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sweetness_before" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sweetness_after" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acidity_before" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acidity_after" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alcohol_before" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alcohol_after" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshness_before" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "freshness_after" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source_type" TEXT NOT NULL DEFAULT 'ai_generated',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customized_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customized_recipe_items" (
    "id" BIGSERIAL NOT NULL,
    "recipe_id" BIGINT NOT NULL,
    "ingredient_id" BIGINT,
    "name_snapshot" TEXT NOT NULL,
    "amount_ml" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT 'ml',
    "note" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "customized_recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingredient_lookup_logs" (
    "id" BIGSERIAL NOT NULL,
    "query" TEXT NOT NULL,
    "local_matched" BOOLEAN NOT NULL DEFAULT false,
    "matched_ingredient_id" BIGINT,
    "ai_used" BOOLEAN NOT NULL DEFAULT false,
    "ai_result_json" JSONB,
    "saved_to_ingredient" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_lookup_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_rules" (
    "id" BIGSERIAL NOT NULL,
    "rule_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "condition_json" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flavor_profiles" (
    "id" BIGSERIAL NOT NULL,
    "ingredient_id" BIGINT,
    "product_id" BIGINT,
    "sweetness" INTEGER NOT NULL DEFAULT 0,
    "sourness" INTEGER NOT NULL DEFAULT 0,
    "bitterness" INTEGER NOT NULL DEFAULT 0,
    "alcohol_strength" INTEGER NOT NULL DEFAULT 0,
    "freshness" INTEGER NOT NULL DEFAULT 0,
    "fruitiness" INTEGER NOT NULL DEFAULT 0,
    "tea_level" INTEGER NOT NULL DEFAULT 0,
    "dairy_level" INTEGER NOT NULL DEFAULT 0,
    "herbal_level" INTEGER NOT NULL DEFAULT 0,
    "spice_level" INTEGER NOT NULL DEFAULT 0,
    "body" INTEGER NOT NULL DEFAULT 1,
    "aroma_tags" JSONB NOT NULL DEFAULT '[]',
    "flavor_tags" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flavor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" BIGSERIAL NOT NULL,
    "barcode" TEXT,
    "brand" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sub_category" TEXT,
    "abv" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "image_url" TEXT,
    "price_range" INTEGER NOT NULL DEFAULT 1,
    "common_store_type" JSONB NOT NULL DEFAULT '[]',
    "ingredient_list_text" TEXT,
    "allergens" JSONB NOT NULL DEFAULT '[]',
    "sugar_content_per_100ml" DOUBLE PRECISION,
    "caffeine_content_per_100ml" DOUBLE PRECISION,
    "carbonation_level" INTEGER NOT NULL DEFAULT 0,
    "source_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_ingredients" (
    "product_id" BIGINT NOT NULL,
    "ingredient_id" BIGINT NOT NULL,

    CONSTRAINT "product_ingredients_pkey" PRIMARY KEY ("product_id","ingredient_id")
);

-- CreateTable
CREATE TABLE "lab_pairing_rules" (
    "id" BIGSERIAL NOT NULL,
    "target_slug_a" TEXT NOT NULL,
    "target_slug_b" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommended_ratio" TEXT,
    "mixing_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_pairing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cocktail_templates" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "original_recipe" JSONB NOT NULL,
    "remix_logic_hints" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cocktail_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_outputs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_template_id" BIGINT,
    "input_params" JSONB NOT NULL,
    "recipe_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_saved_recipes" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "recipe_output_id" UUID NOT NULL,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_saved_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drink_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "recipe_output_id" UUID,
    "recipe_id" TEXT,
    "recipe_name" TEXT NOT NULL,
    "recipe_snapshot" JSONB NOT NULL DEFAULT '{}',
    "drink_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drink_time" TEXT,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taste_scores" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "comment" TEXT,
    "is_finished" BOOLEAN NOT NULL DEFAULT true,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "mood_tags" JSONB NOT NULL DEFAULT '[]',
    "image_url" TEXT,
    "photo_url" TEXT,
    "source_page" TEXT,
    "scene" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drink_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_feedback_flavor_adjustments" (
    "id" BIGSERIAL NOT NULL,
    "drink_log_id" BIGINT NOT NULL,
    "product_id" BIGINT,
    "feedback_type" TEXT NOT NULL,
    "user_adjustment_weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_feedback_flavor_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classic_cocktails" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "base_spirit" TEXT,
    "original_recipe" JSONB NOT NULL,
    "flavor_profile" JSONB NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classic_cocktails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remix_tags" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remix_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classic_cocktail_variants" (
    "id" BIGSERIAL NOT NULL,
    "cocktail_id" BIGINT NOT NULL,
    "title_cn" TEXT NOT NULL,
    "title_en" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "formula_note" TEXT,
    "method" TEXT NOT NULL,
    "glassware" TEXT,
    "ice" TEXT,
    "abv_level" INTEGER NOT NULL DEFAULT 2,
    "sweetness_level" INTEGER NOT NULL DEFAULT 3,
    "acidity_level" INTEGER NOT NULL DEFAULT 3,
    "bitterness_level" INTEGER NOT NULL DEFAULT 2,
    "alcohol_intensity" INTEGER NOT NULL DEFAULT 2,
    "convenience_score" INTEGER NOT NULL DEFAULT 3,
    "beginner_score" INTEGER NOT NULL DEFAULT 3,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classic_cocktail_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classic_cocktail_variant_tags" (
    "id" BIGSERIAL NOT NULL,
    "variant_id" BIGINT NOT NULL,
    "tag_id" BIGINT NOT NULL,

    CONSTRAINT "classic_cocktail_variant_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_ingredients" (
    "id" BIGSERIAL NOT NULL,
    "variant_id" BIGINT NOT NULL,
    "ingredient_name_cn" TEXT NOT NULL,
    "ingredient_name_en" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ml',
    "role" TEXT NOT NULL DEFAULT 'mixer',
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "substitute_note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "variant_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipes" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "base_spirit" TEXT,
    "description" TEXT NOT NULL,
    "story" TEXT,
    "method" TEXT NOT NULL,
    "glassware" TEXT,
    "ice" TEXT,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "abv_level" INTEGER NOT NULL DEFAULT 1,
    "sweetness_level" INTEGER NOT NULL DEFAULT 3,
    "acidity_level" INTEGER NOT NULL DEFAULT 3,
    "bitterness_level" INTEGER NOT NULL DEFAULT 1,
    "alcohol_intensity" INTEGER NOT NULL DEFAULT 1,
    "freshness_level" INTEGER NOT NULL DEFAULT 3,
    "fruitiness_level" INTEGER NOT NULL DEFAULT 3,
    "convenience_score" INTEGER NOT NULL DEFAULT 3,
    "beginner_score" INTEGER NOT NULL DEFAULT 3,
    "estimated_cost_level" INTEGER NOT NULL DEFAULT 2,
    "prep_time_minutes" INTEGER NOT NULL DEFAULT 3,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "id" BIGSERIAL NOT NULL,
    "recipe_id" BIGINT NOT NULL,
    "ingredient_name_cn" TEXT NOT NULL,
    "ingredient_name_en" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ml',
    "role" TEXT NOT NULL DEFAULT 'mixer',
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "substitute_note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" BIGSERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name_cn" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_tags" (
    "id" BIGSERIAL NOT NULL,
    "recipe_id" BIGINT NOT NULL,
    "tag_id" BIGINT NOT NULL,

    CONSTRAINT "recipe_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classic_recipe_variants" (
    "id" BIGSERIAL NOT NULL,
    "original_recipe_id" BIGINT NOT NULL,
    "variant_recipe_id" BIGINT NOT NULL,
    "remix_direction" TEXT NOT NULL,
    "change_summary" TEXT NOT NULL,

    CONSTRAINT "classic_recipe_variants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_name_key" ON "data_sources"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_slug_key" ON "ingredients"("slug");

-- CreateIndex
CREATE INDEX "ingredients_name_zh_idx" ON "ingredients"("name_zh");

-- CreateIndex
CREATE INDEX "ingredients_name_en_idx" ON "ingredients"("name_en");

-- CreateIndex
CREATE INDEX "ingredients_brand_idx" ON "ingredients"("brand");

-- CreateIndex
CREATE INDEX "ingredients_category_idx" ON "ingredients"("category");

-- CreateIndex
CREATE INDEX "ingredients_sub_category_idx" ON "ingredients"("sub_category");

-- CreateIndex
CREATE UNIQUE INDEX "cocktails_slug_key" ON "cocktails"("slug");

-- CreateIndex
CREATE INDEX "cocktail_ingredients_cocktail_id_idx" ON "cocktail_ingredients"("cocktail_id");

-- CreateIndex
CREATE INDEX "cocktail_ingredients_ingredient_id_idx" ON "cocktail_ingredients"("ingredient_id");

-- CreateIndex
CREATE INDEX "customized_recipes_base_cocktail_id_idx" ON "customized_recipes"("base_cocktail_id");

-- CreateIndex
CREATE INDEX "customized_recipes_user_id_idx" ON "customized_recipes"("user_id");

-- CreateIndex
CREATE INDEX "customized_recipe_items_recipe_id_idx" ON "customized_recipe_items"("recipe_id");

-- CreateIndex
CREATE INDEX "customized_recipe_items_ingredient_id_idx" ON "customized_recipe_items"("ingredient_id");

-- CreateIndex
CREATE INDEX "ingredient_lookup_logs_query_idx" ON "ingredient_lookup_logs"("query");

-- CreateIndex
CREATE INDEX "ingredient_lookup_logs_matched_ingredient_id_idx" ON "ingredient_lookup_logs"("matched_ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "safety_rules_rule_key_key" ON "safety_rules"("rule_key");

-- CreateIndex
CREATE UNIQUE INDEX "flavor_profiles_ingredient_id_key" ON "flavor_profiles"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "flavor_profiles_product_id_key" ON "flavor_profiles"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "cocktail_templates_name_key" ON "cocktail_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_saved_recipes_user_id_recipe_output_id_key" ON "user_saved_recipes"("user_id", "recipe_output_id");

-- CreateIndex
CREATE INDEX "drink_logs_user_id_idx" ON "drink_logs"("user_id");

-- CreateIndex
CREATE INDEX "drink_logs_recipe_id_idx" ON "drink_logs"("recipe_id");

-- CreateIndex
CREATE INDEX "drink_logs_drink_date_idx" ON "drink_logs"("drink_date");

-- CreateIndex
CREATE UNIQUE INDEX "classic_cocktails_slug_key" ON "classic_cocktails"("slug");

-- CreateIndex
CREATE INDEX "classic_cocktails_slug_idx" ON "classic_cocktails"("slug");

-- CreateIndex
CREATE INDEX "classic_cocktails_name_cn_idx" ON "classic_cocktails"("name_cn");

-- CreateIndex
CREATE INDEX "classic_cocktails_name_en_idx" ON "classic_cocktails"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "remix_tags_slug_key" ON "remix_tags"("slug");

-- CreateIndex
CREATE INDEX "remix_tags_slug_idx" ON "remix_tags"("slug");

-- CreateIndex
CREATE INDEX "remix_tags_name_cn_idx" ON "remix_tags"("name_cn");

-- CreateIndex
CREATE INDEX "classic_cocktail_variants_cocktail_id_idx" ON "classic_cocktail_variants"("cocktail_id");

-- CreateIndex
CREATE INDEX "classic_cocktail_variants_is_published_idx" ON "classic_cocktail_variants"("is_published");

-- CreateIndex
CREATE INDEX "classic_cocktail_variants_convenience_score_idx" ON "classic_cocktail_variants"("convenience_score");

-- CreateIndex
CREATE INDEX "classic_cocktail_variants_beginner_score_idx" ON "classic_cocktail_variants"("beginner_score");

-- CreateIndex
CREATE INDEX "classic_cocktail_variant_tags_tag_id_idx" ON "classic_cocktail_variant_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "classic_cocktail_variant_tags_variant_id_tag_id_key" ON "classic_cocktail_variant_tags"("variant_id", "tag_id");

-- CreateIndex
CREATE INDEX "variant_ingredients_variant_id_idx" ON "variant_ingredients"("variant_id");

-- CreateIndex
CREATE INDEX "variant_ingredients_ingredient_name_cn_idx" ON "variant_ingredients"("ingredient_name_cn");

-- CreateIndex
CREATE INDEX "variant_ingredients_ingredient_name_en_idx" ON "variant_ingredients"("ingredient_name_en");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_slug_key" ON "recipes"("slug");

-- CreateIndex
CREATE INDEX "recipes_type_idx" ON "recipes"("type");

-- CreateIndex
CREATE INDEX "recipes_base_spirit_idx" ON "recipes"("base_spirit");

-- CreateIndex
CREATE INDEX "recipes_name_cn_idx" ON "recipes"("name_cn");

-- CreateIndex
CREATE INDEX "recipes_name_en_idx" ON "recipes"("name_en");

-- CreateIndex
CREATE INDEX "recipes_is_published_idx" ON "recipes"("is_published");

-- CreateIndex
CREATE INDEX "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients"("recipe_id");

-- CreateIndex
CREATE INDEX "recipe_ingredients_ingredient_name_cn_idx" ON "recipe_ingredients"("ingredient_name_cn");

-- CreateIndex
CREATE INDEX "recipe_ingredients_ingredient_name_en_idx" ON "recipe_ingredients"("ingredient_name_en");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_category_idx" ON "tags"("category");

-- CreateIndex
CREATE INDEX "tags_name_cn_idx" ON "tags"("name_cn");

-- CreateIndex
CREATE INDEX "recipe_tags_tag_id_idx" ON "recipe_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_tags_recipe_id_tag_id_key" ON "recipe_tags"("recipe_id", "tag_id");

-- CreateIndex
CREATE INDEX "classic_recipe_variants_variant_recipe_id_idx" ON "classic_recipe_variants"("variant_recipe_id");

-- CreateIndex
CREATE UNIQUE INDEX "classic_recipe_variants_original_recipe_id_variant_recipe_i_key" ON "classic_recipe_variants"("original_recipe_id", "variant_recipe_id");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cocktail_ingredients" ADD CONSTRAINT "cocktail_ingredients_cocktail_id_fkey" FOREIGN KEY ("cocktail_id") REFERENCES "cocktails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cocktail_ingredients" ADD CONSTRAINT "cocktail_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customized_recipes" ADD CONSTRAINT "customized_recipes_base_cocktail_id_fkey" FOREIGN KEY ("base_cocktail_id") REFERENCES "cocktails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customized_recipes" ADD CONSTRAINT "customized_recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customized_recipe_items" ADD CONSTRAINT "customized_recipe_items_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "customized_recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customized_recipe_items" ADD CONSTRAINT "customized_recipe_items_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_lookup_logs" ADD CONSTRAINT "ingredient_lookup_logs_matched_ingredient_id_fkey" FOREIGN KEY ("matched_ingredient_id") REFERENCES "ingredients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flavor_profiles" ADD CONSTRAINT "flavor_profiles_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flavor_profiles" ADD CONSTRAINT "flavor_profiles_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_ingredients" ADD CONSTRAINT "product_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_outputs" ADD CONSTRAINT "recipe_outputs_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "cocktail_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saved_recipes" ADD CONSTRAINT "user_saved_recipes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saved_recipes" ADD CONSTRAINT "user_saved_recipes_recipe_output_id_fkey" FOREIGN KEY ("recipe_output_id") REFERENCES "recipe_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drink_logs" ADD CONSTRAINT "drink_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drink_logs" ADD CONSTRAINT "drink_logs_recipe_output_id_fkey" FOREIGN KEY ("recipe_output_id") REFERENCES "recipe_outputs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedback_flavor_adjustments" ADD CONSTRAINT "user_feedback_flavor_adjustments_drink_log_id_fkey" FOREIGN KEY ("drink_log_id") REFERENCES "drink_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_feedback_flavor_adjustments" ADD CONSTRAINT "user_feedback_flavor_adjustments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classic_cocktail_variants" ADD CONSTRAINT "classic_cocktail_variants_cocktail_id_fkey" FOREIGN KEY ("cocktail_id") REFERENCES "classic_cocktails"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classic_cocktail_variant_tags" ADD CONSTRAINT "classic_cocktail_variant_tags_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "classic_cocktail_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classic_cocktail_variant_tags" ADD CONSTRAINT "classic_cocktail_variant_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "remix_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_ingredients" ADD CONSTRAINT "variant_ingredients_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "classic_cocktail_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_recipe_id_fkey" FOREIGN KEY ("recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_tags" ADD CONSTRAINT "recipe_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classic_recipe_variants" ADD CONSTRAINT "classic_recipe_variants_original_recipe_id_fkey" FOREIGN KEY ("original_recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classic_recipe_variants" ADD CONSTRAINT "classic_recipe_variants_variant_recipe_id_fkey" FOREIGN KEY ("variant_recipe_id") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


