import test from "node:test";
import assert from "node:assert/strict";
import { classify, emptyAnswers, matchDrinks, replaceDrink, repairSlots, mixerOptions, GuideDrink } from "./beginner";
const drink = (id: string, extra: Partial<GuideDrink> = {}): GuideDrink => ({ id, href: `/recipe/${id}`, nameZh: id, nameEn: id, imageUrl: "", ingredients: ["金酒", "苏打水"], tags: [], description: "", baseSpirit: "金酒", kind: "easy", tastes: ["fresh"], strength: "light", avoid: [], shaker: false, ...extra });
test("all explicit constraints apply together, with no backfilling", () => {
  const good = drink("good");
  const catalog = [good, drink("wrong-spirit", {baseSpirit:"朗姆"}), drink("bitter", {avoid:["bitter"]}), drink("strong", {strength:"strong"}), drink("shake", {shaker:true}), drink("classic", {kind:"classic"}), drink("fruit", {tastes:["fruit"]})];
  const answers = {...emptyAnswers, kind:"easy", spirit:"金酒", strength:"light", tastes:["fresh"], avoid:["bitter"]};
  assert.deepEqual(matchDrinks(catalog, answers).map(d=>d.id), ["good"]);
  assert.equal(matchDrinks(catalog, {...answers, spirit:"清酒"}).length, 0);
});
test("taste preferences use OR, exclusions use any prohibited taste", () => {
  const catalog = [drink("fruit", {tastes:["fruit"]}), drink("tea", {tastes:["tea"]}), drink("sweet", {tastes:["tea"], avoid:["sweet"]})];
  assert.deepEqual(matchDrinks(catalog, {...emptyAnswers,tastes:["fruit","tea"],avoid:["sweet"]}).map(d=>d.id), ["fruit","tea"]);
});
test("replacement never duplicates visible or previously seen drinks and reports exhaustion", () => {
  const pool = ["a","b","c","d","e"].map(id=>drink(id));
  const slots = pool.slice(0,3).map(d=>d.href);
  assert.equal(replaceDrink(pool,slots,[...slots,"/recipe/d"],1),"/recipe/e");
  assert.equal(replaceDrink(pool,slots,pool.map(d=>d.href),0),undefined);
  assert.deepEqual(slots,["/recipe/a","/recipe/b","/recipe/c"]);
});
test("unsupported classic recipes are excluded; known bitter and tool profiles apply", () => {
  assert.equal(classify(drink("unknown"),"classic"),null);
  assert.ok(classify(drink("gin-tonic"),"classic")?.avoid.includes("bitter"));
  assert.equal(classify(drink("margarita"),"classic")?.shaker,true);
});

test("unavailable ingredients exclude all affected recipes without relaxing preferences", () => {
  const catalog = [drink("orange", {ingredients:["金酒","橙汁"]}), drink("soda"), drink("rum", {baseSpirit:"朗姆",ingredients:["朗姆酒","苏打水"]})];
  assert.deepEqual(matchDrinks(catalog,{...emptyAnswers,spirit:"金酒"},["橙汁"]).map(d=>d.id),["soda"]);
  assert.ok(!matchDrinks(catalog,emptyAnswers,["朗姆"]).some(d=>d.id === "rum"));
});
test("repair preserves unaffected cards, replaces affected positions and handles exhaustion", () => {
  const pool = [drink("a"),drink("c"),drink("d")];
  assert.deepEqual(repairSlots(pool,["/recipe/a","/recipe/b","/recipe/c"],[]),["/recipe/a","/recipe/d","/recipe/c"]);
  assert.deepEqual(repairSlots(pool.slice(0,2),["/recipe/a","/recipe/b","/recipe/c"],[]),["/recipe/a","/recipe/c"]);
  assert.deepEqual(repairSlots([], ["/recipe/a"], []), []);
});

test("mixer options come only from currently matching recipes", () => {
  const catalog = [drink("orange", {ingredients:["金酒","橙汁"]}), drink("cola", {baseSpirit:"朗姆",ingredients:["朗姆","可乐"]})];
  assert.deepEqual(mixerOptions(catalog,{...emptyAnswers,spirit:"金酒"}),["橙汁"]);
  assert.deepEqual(mixerOptions(catalog,emptyAnswers,["橙汁"]),["可乐"]);
});
test("every required mixer must be selected and no-mixer drinks cannot bypass selection", () => {
  const catalog = [drink("orange", {ingredients:["金酒","橙汁"]}),drink("two", {ingredients:["金酒","橙汁","苏打水"]}),drink("dry", {ingredients:["金酒","苦精"]})];
  assert.deepEqual(matchDrinks(catalog,{...emptyAnswers,mixers:["橙汁"]}).map(d=>d.id),["orange"]);
  assert.deepEqual(matchDrinks(catalog,{...emptyAnswers,mixers:["橙汁","苏打水"]}).map(d=>d.id),["orange","two"]);
  assert.equal(matchDrinks(catalog,emptyAnswers).length,3);
});
