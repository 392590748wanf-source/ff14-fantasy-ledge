#!/usr/bin/env node
/**
 * 770 / 750 装备基础素材索引同步器。
 *
 * 用法：
 *   node tools/sync-base-materials.mjs --static-dir .tmp-nbb-expanded
 *
 * 数据优先级：tools/huiji-recipes.json（由灰机 API / 页面整理的结构化缓存）
 *   > nbb 7.x HQ Helper 的静态 recipe_ja 回退数据。
 * 灰机缓存的格式为 { "recipes": { "物品ID": { "it": 物品ID,
 * "job": 制作职业ID, "bp": [物品ID, 产出数量], "m": [材料ID, 数量, ...], "s": [...] } } }。
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const cwd = process.cwd();
const argument = name => {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
};
const staticDir = path.resolve(cwd, argument('--static-dir') || '.tmp-nbb-expanded');
const presetPath = path.resolve(cwd, argument('--preset') || 'nbb-preset.js');
const outputPath = path.resolve(cwd, argument('--output') || 'base-materials.js');
const huijiPath = path.resolve(cwd, argument('--huiji-cache') || 'tools/huiji-recipes.json');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const pairArray = list => Array.from({ length: Math.floor((list || []).length / 2) }, (_, index) => [Number(list[index * 2]), Number(list[index * 2 + 1])]).filter(([id, qty]) => id > 0 && qty > 0);

// nbb-preset.js 包含 atob 包装的数据；不执行页面逻辑，只读取 nbbData。
const source = fs.readFileSync(presetPath, 'utf8');
const context = {
  atob: value => Buffer.from(value, 'base64').toString('binary'),
  TextDecoder,
  localStorage: { getItem: () => null, setItem: () => {} },
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: presetPath });
const roots = context.nbbData.r.filter(row => row.t === '770' || row.t === '750');

const nbbRecipes = Object.values(readJson(path.join(staticDir, 'recipe_ja')));
const items = readJson(path.join(staticDir, 'item'));
const recipesByOutput = new Map();
for (const recipe of nbbRecipes) {
  const key = String(recipe.it);
  recipesByOutput.set(key, [...(recipesByOutput.get(key) || []), { ...recipe, source: 'nbb' }]);
}
for (const list of recipesByOutput.values()) list.sort((left, right) => Number(left.id) - Number(right.id));

let huiji = { recipes: {} };
let huijiStatus = '灰机结构化缓存未提供，全部使用 nbb 回退';
if (fs.existsSync(huijiPath)) {
  try {
    huiji = readJson(huijiPath);
    huijiStatus = '已读取灰机结构化缓存';
  } catch (error) {
    huijiStatus = `灰机缓存无效：${error.message}`;
  }
}
const huijiRecipes = huiji.recipes || {};
const huijiCandidates = id => {
  const value = huijiRecipes[String(id)];
  return (Array.isArray(value) ? value : value ? [value] : []).map(recipe => ({ ...recipe, source: 'huiji' }));
};
const recipeCandidates = id => [...huijiCandidates(id), ...(recipesByOutput.get(String(id)) || [])];
// 半成品若有锻铁/铸甲等多条路线，优先沿用父配方职业；否则灰机首列优先，再取 nbb 首列。
const sourceFor = (id, parentJob = null) => {
  const candidates = recipeCandidates(id);
  if (!candidates.length) return null;
  const sameJob = parentJob == null ? null : candidates.find(recipe => Number(recipe.job) === Number(parentJob));
  return sameJob || candidates[0];
};

const cycles = new Set();
const leaves = (itemId, amount = 1, parentJob = null, visiting = new Set()) => {
  const key = String(itemId);
  const recipe = sourceFor(key, parentJob);
  if (!recipe) return new Map([[key, amount]]);
  if (visiting.has(key)) {
    cycles.add(key);
    return new Map([[key, amount]]);
  }
  const produced = Math.max(1, Number(recipe.bp?.[1] || recipe.yield || 1));
  const multiplier = Math.ceil(amount / produced);
  const nextVisiting = new Set(visiting).add(key);
  const output = new Map();
  for (const [ingredient, quantity] of [...pairArray(recipe.m), ...pairArray(recipe.s)]) {
    for (const [leaf, total] of leaves(ingredient, quantity * multiplier, recipe.job, nextVisiting)) {
      output.set(leaf, (output.get(leaf) || 0) + total);
    }
  }
  return output.size ? output : new Map([[key, amount]]);
};

const nameFor = id => items[String(id)]?.lang?.[2] || `未知物品 ${id}`;
const crystal = name => /之(?:碎晶|水晶|晶簇)$/.test(name);
// 分类来自采集来源，而非名称关键词。限时只收录传说采集点素材；普通采集、
// 怪物掉落和雇员筹集物均归常规。未登记的未来素材默认归常规，避免误标限时。
const CATEGORY_IDS = {
  '灵砂': [46246],
  '限时采集品': [46243, 45968, 45969, 45970, 45971, 46244, 49207, 49208, 49209, 49210, 49211],
  '神典石材料': [44848, 45972, 45984, 45985, 45986, 46252, 49212, 49223, 49224, 49225, 49227],
};
const categoryLookup = Object.fromEntries(Object.entries(CATEGORY_IDS).flatMap(([category, ids]) => ids.map(id => [String(id), category])));
const categoryFor = id => categoryLookup[String(id)] || '常规采集品';

const base = {}, direct = {}, jobs = {}, names = {}, categories = {}, graph = {}, sourceCounts = { huiji: 0, nbb: 0 };
const missing = [];
// 保存所有可达半成品的候选配方、职业与产出数量。前端据此按父职业选择路线，
// 并在整套范围内合并需求后计算每批产出。
const collectGraph = (itemId, visiting = new Set()) => {
  const key = String(itemId);
  if (visiting.has(key) || graph[key]) return;
  const candidates = recipeCandidates(key);
  if (!candidates.length) return;
  graph[key] = candidates.map(recipe => ({
    id: Number(recipe.id) || 0,
    j: Number(recipe.job) || 0,
    y: Math.max(1, Number(recipe.bp?.[1] || recipe.yield || 1)),
    a: [...pairArray(recipe.m), ...pairArray(recipe.s)].flat(),
  }));
  const next = new Set(visiting).add(key);
  for (const recipe of candidates) {
    for (const [ingredient] of [...pairArray(recipe.m), ...pairArray(recipe.s)]) {
      const name = nameFor(ingredient);
      names[ingredient] = name;
      if (!crystal(name)) categories[ingredient] = categoryFor(ingredient);
      collectGraph(ingredient, next);
    }
  }
};
for (const root of roots) {
  const itemId = String(root.itemId);
  const recipe = sourceFor(itemId);
  if (!recipe) {
    missing.push(itemId);
    continue;
  }
  sourceCounts[recipe.source] += 1;
  collectGraph(itemId);
  direct[itemId] = [...pairArray(recipe.m), ...pairArray(recipe.s)].flat();
  jobs[itemId] = Number(recipe.job) || 0;
  const expanded = leaves(itemId, 1, recipe.job);
  base[itemId] = [...expanded.entries()]
    .map(([id, qty]) => [Number(id), qty])
    .sort(([left], [right]) => left - right)
    .flat();
  for (const id of expanded.keys()) {
    const name = nameFor(id);
    names[id] = name;
    if (!crystal(name)) categories[id] = categoryFor(id);
  }
}

const coverage = roots.reduce((result, item) => {
  result[item.t] = (result[item.t] || 0) + (base[String(item.itemId)] ? 1 : 0);
  return result;
}, { '770': 0, '750': 0 });
const leafIds = Object.keys(names);
const meta = {
  version: 3,
  generatedAt: new Date().toISOString(),
  coverage,
  sources: sourceCounts,
  leafCount: leafIds.length,
  nonCrystalLeafCount: leafIds.filter(id => !crystal(names[id])).length,
  missing,
  cycles: [...cycles],
  huijiStatus,
};
// 骑士剑是多职业半成品路线的回归校验：锻铁卡扎纳尔锭必须消耗火之水晶。
const swordDirect = direct['49249'] || [];
const swordBase = base['49249'] || [];
const quantityFor = (list, itemId) => pairArray(list).filter(([id]) => id === itemId).reduce((sum, [, qty]) => sum + qty, 0);
if (quantityFor(swordDirect, 14) !== 3 || quantityFor(swordDirect, 17) !== 3 || quantityFor(swordDirect, 44001) !== 1 || quantityFor(swordBase, 8) < 8) {
  throw new Error('骑士剑配方校验失败：请检查直接素材或锻铁路线。');
}
fs.writeFileSync(outputPath, `window.FF14_BASE_MATERIALS=${JSON.stringify({ b: base, d: direct, g: graph, j: jobs, n: names, k: categories, meta })};\n`, 'utf8');
console.log(JSON.stringify(meta, null, 2));
