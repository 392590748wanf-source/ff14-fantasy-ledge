import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'craft-scrips.js'), 'utf8');
const rootIds = [...source.matchAll(/\['(\d+)'\s*,\s*'收藏用/g)].map(match => match[1]);
if (rootIds.length !== 56) throw new Error(`收藏品目录应为 56 项，实际读取 ${rootIds.length} 项。`);
const endpoint = id => `https://www.garlandtools.cn/db/doc/item/chs/3/${id}.json`;
const cache = new Map();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const getItem = async id => {
  id = String(id);
  if (cache.has(id)) return cache.get(id);
  const response = await fetch(endpoint(id), { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Garland ${id}: HTTP ${response.status}`);
  const json = await response.json();
  if (!json?.item?.id) throw new Error(`Garland ${id}: 无物品资料`);
  cache.set(id, json.item);
  return json.item;
};

const queue = [...rootIds];
const visited = new Set();
while (queue.length) {
  const id = queue.shift();
  if (visited.has(id)) continue;
  visited.add(id);
  const item = await getItem(id);
  const recipe = item.craft?.[0];
  for (const ingredient of recipe?.ingredients || []) {
    const child = String(ingredient.id);
    if (!visited.has(child)) queue.push(child);
  }
  if (visited.size % 20 === 0) await wait(80);
}

const items = {}, recipes = {}, audit = {};
for (const [id, item] of cache) {
  items[id] = { n: item.name, i: item.icon || 0, il: item.ilvl || item.il || 0, t: Boolean(item.tradeable) };
  const recipe = item.craft?.[0];
  if (recipe?.ingredients?.length) {
    recipes[id] = [{ id: recipe.id, j: recipe.job, y: recipe.yield || 1, a: recipe.ingredients.flatMap(ingredient => [Number(ingredient.id), Number(ingredient.amount)]) }];
  }
  if (rootIds.includes(id)) {
    const ratings = item.masterpiece?.rating || [];
    const payouts = item.masterpiece?.rewardAmount || [];
    audit[id] = { verified: Boolean(recipe && ratings.length === 3 && payouts.length === 3),
      recipeId: recipe?.id || null, job: recipe?.job || null, yield: recipe?.yield || 1,
      ratings, payouts, source: endpoint(id) };
  }
}
const output = `// 自动生成：tools/sync-craft-scrips.mjs。来源：Garland Tools 国服。\nwindow.FF14_CRAFT_SCRIP_DATA = ${JSON.stringify({ schema: 1, generatedAt: new Date().toISOString(), source: 'https://www.garlandtools.cn/db/', items, recipes, audit }, null, 2)};\n`;
await writeFile(resolve(root, 'craft-scrip-data.js'), output, 'utf8');
console.log(`已同步 ${rootIds.length} 项收藏品；索引 ${Object.keys(items).length} 个物品，${Object.keys(recipes).length} 个配方。`);
