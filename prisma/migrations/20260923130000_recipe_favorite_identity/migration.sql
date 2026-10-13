BEGIN;
-- Keep original outputs and logs. Identity lives on the user-to-output relationship.
ALTER TABLE user_saved_recipes ADD COLUMN recipe_key text DEFAULT ('legacy:' || gen_random_uuid()::text);
UPDATE user_saved_recipes s SET recipe_key='recipe:' || CASE WHEN coalesce(o.recipe_json->>'recipeId',o.recipe_json->>'id',o.id::text)='cv-vodka-orange-juice' THEN 'vodka-orange' ELSE regexp_replace(coalesce(o.recipe_json->>'recipeId',o.recipe_json->>'id',o.id::text),'^assistant-recipe-(.+)-[0-9]+$','\1') END FROM recipe_outputs o WHERE o.id=s.recipe_output_id;

-- Catalog aliases preserve old convenience links without using display names.
UPDATE user_saved_recipes s SET recipe_key='recipe:'||a.canonical
FROM (VALUES
('cv-gin-grapefruit-soda','gin-grapefruit-soda'),
('cv-gin-lemon-tea','gin-lemon-tea'),
('cv-vodka-orange-juice','vodka-orange'),
('cv-vodka-cranberry-juice','vodka-cranberry'),
('cv-whisky-oolong-tea','whisky-oolong'),
('cv-whisky-cola','whisky-cola'),
('cv-rum-cola','rum-cola'),
('cv-rum-pineapple-juice','rum-pineapple'),
('cv-tequila-grapefruit-soda','tequila-grapefruit'),
('cv-tequila-orange-juice','tequila-orange'),
('cv-beer-grapefruit-soda','grapefruit-beer'),
('cv-soju-yakult','soju-yakult'),
('cv-umeshu-soda-water','umeshu-soda')) AS a(old_id,canonical)
WHERE s.recipe_key='recipe:'||a.old_id;
DELETE FROM user_saved_recipes a USING user_saved_recipes b WHERE a.user_id=b.user_id AND a.recipe_key=b.recipe_key AND a.id>b.id;
ALTER TABLE user_saved_recipes ALTER COLUMN recipe_key SET NOT NULL;
CREATE UNIQUE INDEX user_saved_recipes_user_id_recipe_key_key ON user_saved_recipes(user_id,recipe_key);
-- Soft merge exact duplicate database recipes; retain IDs and old snapshots for history.
ALTER TABLE recipes ADD COLUMN canonical_key text;
ALTER TABLE recipes ADD COLUMN canonical_recipe_id bigint REFERENCES recipes(id);
CREATE TABLE recipe_aliases(old_slug text PRIMARY KEY, canonical_recipe_id bigint NOT NULL REFERENCES recipes(id));
ALTER TABLE recipe_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON recipe_aliases FROM anon,authenticated;
-- Only identical type, preparation and measured formula are merged. Names never identify recipes.
WITH materials AS (
 SELECT i.recipe_id,
 CASE lower(regexp_replace(i.ingredient_name_cn,'[\s_-]+','','g'))
 WHEN '伏特加' THEN 'vodka' WHEN '伏特加酒' THEN 'vodka'
 WHEN '橙汁' THEN 'orange_juice' WHEN 'orangejuice' THEN 'orange_juice'
 WHEN '金酒' THEN 'gin' WHEN '烧酒' THEN 'soju'
 WHEN '威士忌' THEN 'whisky' WHEN 'whiskey' THEN 'whisky'
 WHEN '苏打水' THEN 'soda_water' WHEN 'sodawater' THEN 'soda_water'
 WHEN '青柠汁' THEN 'lime_juice' WHEN 'limejuice' THEN 'lime_juice'
 WHEN '柠檬汁' THEN 'lemon_juice' WHEN 'lemonjuice' THEN 'lemon_juice'
 ELSE lower(regexp_replace(i.ingredient_name_cn,'[\s_-]+','','g')) END || ':' || CASE WHEN trim(i.amount) ~ '^\d+(\.\d+)?$' THEN i.amount::double precision::text ELSE trim(i.amount) END || ':' || i.unit AS item
 FROM recipe_ingredients i WHERE NOT i.is_optional AND i.role NOT IN ('garnish','optional') AND lower(trim(i.ingredient_name_cn)) NOT IN ('冰','冰块','ice','ice cubes')
), signatures AS (
 SELECT r.id,r.type||':'||r.method||':'||string_agg(m.item,'|' ORDER BY m.item COLLATE "C") signature
 FROM recipes r JOIN materials m ON m.recipe_id=r.id GROUP BY r.id
) UPDATE recipes r SET canonical_key=s.signature FROM signatures s WHERE s.id=r.id;
WITH groups AS(SELECT canonical_key,min(id) id FROM recipes WHERE canonical_key IS NOT NULL GROUP BY canonical_key)
UPDATE recipes r SET canonical_recipe_id=g.id,is_published=CASE WHEN r.id=g.id THEN r.is_published ELSE false END FROM groups g WHERE r.canonical_key=g.canonical_key;
INSERT INTO recipe_aliases SELECT slug,canonical_recipe_id FROM recipes WHERE canonical_recipe_id<>id;
UPDATE drink_logs l SET recipe_id=c.slug FROM recipes old JOIN recipes c ON c.id=old.canonical_recipe_id WHERE old.id<>c.id AND (l.recipe_id=old.slug OR l.recipe_id=old.id::text);
UPDATE recipes SET canonical_key=NULL WHERE canonical_recipe_id<>id;
CREATE UNIQUE INDEX recipes_canonical_key_key ON recipes(canonical_key);

DROP INDEX user_saved_recipes_user_id_recipe_key_key;
-- Update stable favorite references while leaving historical recipe snapshots intact.
UPDATE user_saved_recipes s SET recipe_key='recipe:'||c.slug
FROM recipes old JOIN recipes c ON c.id=old.canonical_recipe_id
WHERE s.recipe_key IN ('recipe:'||old.slug,'recipe:'||old.id::text) AND old.id<>c.id;
DELETE FROM user_saved_recipes a USING user_saved_recipes b WHERE a.user_id=b.user_id AND a.recipe_key=b.recipe_key AND a.id>b.id;
CREATE UNIQUE INDEX user_saved_recipes_user_id_recipe_key_key ON user_saved_recipes(user_id,recipe_key);

COMMIT;
