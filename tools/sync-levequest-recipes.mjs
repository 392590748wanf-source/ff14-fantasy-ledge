/** Export Garland Tools craft trees for verified levequest delivery items. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const cacheDir = resolve(root, 'tools', '.cache', 'levequest-recipes');
const garlandBase = 'https://www.garlandtools.org/db/doc/item/en/3';
const evaluate = async file => { const context = { window: {} }; vm.runInNewContext(await readFile(resolve(root, file), 'utf8'), context, { filename: file }); return context.window; };
const [leveData, catalogData, itemData] = await Promise.all([evaluate('levequests.js'), evaluate('levequest-catalog.js'), evaluate('item-index.js')]);
const names = new Map((itemData.FF14_ITEM_INDEX || []).map(([id, name]) => [String(id), name]));
const verifiedRoutes = (catalogData.FF14_LEVEQUEST_CATALOG?.routes || leveData.FF14_LEVEQUESTS?.routes || [])
  .filter(route => route.verified && Number(route.itemId) > 0);
const roots = [...new Set(verifiedRoutes.map(route => String(route.itemId)))];
// 理符路线名称优先于通用物品索引，避免已核验的国服本地化名称在
// 制作流程窗口中被英文数据源的另一中文译名覆盖。
const deliveryNames = new Map(verifiedRoutes.map(route => [String(route.itemId), route.item]));
await mkdir(cacheDir, { recursive: true });
const fetchItem = async id => {
  const file = resolve(cacheDir, `item-${id}.json`);
  try {
    const response = await fetch(`${garlandBase}/${id}.json`, { headers: { 'user-agent': 'LogFate levequest recipe importer/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text(); await writeFile(file, body, 'utf8'); return JSON.parse(body)?.item || null;
  } catch (error) {
    try { return JSON.parse(await readFile(file, 'utf8'))?.item || null; }
    catch { throw error; }
  }
};
const items = {}, recipes = {}, missing = [], queued = new Set(roots), queue = [...roots];
const importItem = async id => {
  try {
    const item = await fetchItem(id);
    if (!item) throw new Error('缺少物品资料');
    items[id] = { n: deliveryNames.get(id) || names.get(id) || item.name || `物品 ${id}`, icon: Number(item.icon || 0) || null };
    const craft = (item.craft || []).map(recipe => ({ id: `garland-${recipe.id}`, j: Number(recipe.job || 0), l: Number(recipe.lvl || 0), rlvl: Number(recipe.rlvl || 0), y: Math.max(1, Number(recipe.yield || 1)), a: (recipe.ingredients || []).flatMap(ingredient => [Number(ingredient.id), Number(ingredient.amount || 0)]), sourceUrl: `${garlandBase}/${id}.json` })).filter(recipe => recipe.a.length);
    if (craft.length) recipes[id] = craft;
    craft.forEach(recipe => { for (let index = 0; index < recipe.a.length; index += 2) { const child = String(recipe.a[index]); if (!queued.has(child)) { queued.add(child); queue.push(child); } } });
  } catch (error) { missing.push({ id: Number(id), reason: error.message }); }
};
let cursor = 0;
while (cursor < queue.length) {
  const batch = queue.slice(cursor, cursor + 12);
  cursor += batch.length;
  await Promise.all(batch.map(importItem));
}
const rootsWithoutRecipe = roots.filter(id => !recipes[id]).map(id => ({ id: Number(id), name: items[id]?.n || names.get(id) || id }));
const payload = { schema: 1, version: '0.0.1', publishedAt: new Date().toISOString(), sources: { garland: garlandBase }, items, recipes, audit: { roots: roots.length, importedItems: Object.keys(items).length, recipeItems: Object.keys(recipes).length, rootsWithoutRecipe, missing } };
await writeFile(resolve(root, 'levequest-recipes.js'), `// 自动生成：tools/sync-levequest-recipes.mjs。来源：Garland Tools。\nwindow.FF14_LEVEQUEST_RECIPES=${JSON.stringify(payload)};\n`, 'utf8');
console.log(`已导入 ${Object.keys(recipes).length} 个可制作物品；理符根物品 ${roots.length - rootsWithoutRecipe.length}/${roots.length} 有配方。`);
