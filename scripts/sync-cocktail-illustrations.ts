import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import {
  classicExploreCocktails, convenienceExploreCocktails, convenienceMixerOptions,
  generatedClassicCocktails, classicTemplateStyles, simpleSlug,
} from "../src/lib/data/explore-catalog";

const root = "public/images/cocktails/illustrated";
const generatedIds = new Set(generatedClassicCocktails.map(item => item.id));
const special: Record<string, string> = {
  "coconut-rum": "mix-coconut-milk-drink",
  "lime-soju-soda": "lime-soju-soda",
  "grapefruit-beer": "grapefruit-beer",
  "beer-tomato": "beer-tomato",
};
const manifest: Record<string, { asset: string; mode: "dedicated" | "shared" }> = {};
const missing: Array<{ id: string; name: string; asset: string }> = [];
const rows = [...classicExploreCocktails, ...convenienceExploreCocktails];
for (const drink of rows) {
  let asset = drink.id;
  let mode: "dedicated" | "shared" = "dedicated";
  if (generatedIds.has(drink.id)) {
    const style = [...classicTemplateStyles].sort((a, b) => b.en.length - a.en.length)
      .find(style => drink.id.endsWith(`-${simpleSlug(style.en)}`));
    if (!style) throw new Error(`Unknown template: ${drink.id}`);
    asset = `template-${simpleSlug(style.en)}`;
    mode = "shared";
    // Brown spirits have a visibly different colour in otherwise clear drinks.
    if (/^classic-(whiskey|brandy)-/.test(drink.id)) {
      if (style.en === "Highball") asset = "whisky-highball";
      if (style.en === "Old Fashioned") asset = "old-fashioned";
    }
  } else if (drink.href.includes("convenience-mix")) {
    const mixer = convenienceMixerOptions.find(m => drink.ingredients.includes(m.zh));
    asset = special[drink.id] ?? (mixer ? `mix-${mixer.slug}` : "");
    mode = asset === drink.id ? "dedicated" : "shared";
  }
  if (asset && existsSync(`${root}/${asset}.png`)) manifest[drink.id] = { asset, mode };
  else missing.push({ id: drink.id, name: drink.nameZh, asset });
}

// The classic selector exposes Daiquiri even though it is not in the browse catalog.
if (existsSync(`${root}/daiquiri.png`)) manifest.daiquiri = { asset: "daiquiri", mode: "dedicated" };
mkdirSync("artifacts/cocktail-illustrations", { recursive: true });
writeFileSync("src/lib/data/cocktail-illustrations.json", JSON.stringify(manifest, null, 2) + "\n");
const coverage = {
  total: rows.length, covered: rows.filter(row => manifest[row.id]).length,
  uniqueAssets: new Set(Object.values(manifest).map(v => v.asset)).size,
  dedicated: rows.filter(row => manifest[row.id]?.mode === "dedicated").length,
  shared: rows.filter(row => manifest[row.id]?.mode === "shared").length,
  selectorExtras: manifest.daiquiri ? 1 : 0,
  missing,
};
writeFileSync("artifacts/cocktail-illustrations/coverage.json", JSON.stringify(coverage, null, 2) + "\n");

const escape = (text: string) => text.replace(/[&<>\"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const assets = readdirSync(root).filter(file => file.endsWith(".png")).sort();
const title = (asset: string) => rows.find(row => row.id === asset)?.nameZh
  ?? (asset === "daiquiri" ? "戴克里" : undefined)
  ?? convenienceMixerOptions.find(mixer => `mix-${mixer.slug}` === asset)?.zh
  ?? classicTemplateStyles.find(style => `template-${simpleSlug(style.en)}` === asset)?.zh
  ?? asset;
const cards = assets.map(file => `<figure><img loading="lazy" src="../../public/images/cocktails/illustrated/${file}" alt="${escape(title(file.slice(0, -4)))}"><figcaption>${escape(title(file.slice(0, -4)))}<small>${file}</small></figcaption></figure>`).join("\n");
writeFileSync("artifacts/cocktail-illustrations/review.html", `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AlcheMix 酒单插画</title><style>body{margin:32px;background:#f6f5f1;color:#242424;font-family:system-ui}h1{font-weight:500}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px}figure{margin:0;background:white;border:1px solid #e5e3dc;border-radius:16px;padding:16px}img{width:100%;aspect-ratio:1;object-fit:contain}figcaption{font-size:14px}small{display:block;color:#888;font-size:11px;margin-top:5px}</style><h1>AlcheMix 酒单插画</h1><p>${coverage.covered} / ${coverage.total} 款已配图 · ${assets.length} 张插画</p><main>${cards}</main></html>`);
console.log(JSON.stringify({ ...coverage, missing: missing.length }, null, 2));
if (process.argv.includes("--check") && missing.length) process.exitCode = 1;
