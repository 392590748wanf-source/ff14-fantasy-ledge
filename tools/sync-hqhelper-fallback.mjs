#!/usr/bin/env node
/**
 * 从 HqHelper Dawntrail 的固定提交生成本项目使用的精简配方回退快照。
 * 运行方式：node tools/sync-hqhelper-fallback.mjs
 *
 * 仅保留当前 770 / 750 与潜水艇配方树可达的物品、配方和兑换记录，
 * 并额外生成 Garland Tools 的物品 ID → 图标 ID 索引，供页面展示与“其他材料”搜索时按需加载。
 * 页面运行时不会访问 GitHub。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';

const repo = 'InfSein/hqhelper-dawntrail';
const commit = process.env.HQHELPER_COMMIT || 'ade07045d2de8545c6ac46d647076cff0bc3fc50';
const baseUrl = `https://raw.githubusercontent.com/${repo}/${commit}/src/assets/data/unpacks`;
const cacheDir = process.env.HQHELPER_DATA_DIR;
const garlandBaseUrl = 'https://www.garlandtools.org/db/doc/item/en/3';

const loadWindowData = async (filename, key) => {
  const source = await readFile(new URL(`../${filename}`, import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename });
  return context.window[key];
};

const fetchJson = async filename => {
  if (cacheDir) return JSON.parse(await readFile(join(cacheDir, filename), 'utf8'));
  try {
    const response = await fetch(`${baseUrl}/${filename}`);
    if (response.ok) return response.json();
    throw new Error(`HTTP ${response.status}`);
  } catch (rawError) {
    const apiUrl = `https://api.github.com/repos/${repo}/contents/src/assets/data/unpacks/${filename}?ref=${commit}`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`下载 ${filename} 失败：raw (${rawError.message})；API HTTP ${response.status}`);
    const payload = await response.json();
    return JSON.parse(Buffer.from(payload.content, 'base64').toString('utf8'));
  }
};

const fetchGarlandIcon = async id => {
  try {
    const response = await fetch(`${garlandBaseUrl}/${encodeURIComponent(id)}.json`);
    if (!response.ok) return 0;
    const payload = await response.json();
    return Number(payload?.item?.icon || 0);
  } catch {
    return 0;
  }
};

const fetchGarlandIcons = async ids => {
  const queue = [...new Set(ids.map(String).filter(id => /^\d+$/.test(id)))];
  const index = {};
  const missing = [];
  let cursor = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const id = queue[cursor++];
      const icon = await fetchGarlandIcon(id);
      if (icon > 0) index[id] = icon;
      else missing.push(Number(id));
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, queue.length) }, worker));
  return { index, missing };
};

const pairs = values => {
  const output = [];
  for (let index = 0; index < (values || []).length; index += 2) {
    const id = Number(values[index]), quantity = Number(values[index + 1] || 0);
    if (id > 0 && quantity > 0) output.push([id, quantity]);
  }
  return output;
};

const baseMaterials = await loadWindowData('base-materials.js', 'FF14_BASE_MATERIALS');
const submarineData = await loadWindowData('submarine-data.js', 'FF14_SUBMARINE_DATA');
const materialSources = await loadWindowData('material-sources.js', 'FF14_MATERIAL_SOURCES');
const [items, recipes, trades] = await Promise.all([
  fetchJson('items.json'), fetchJson('recipes.json'), fetchJson('trade-map.json')
]);

const byTarget = {};
Object.values(recipes).forEach(recipe => {
  const target = String(recipe.target);
  (byTarget[target] ||= []).push({
    id: recipe.id,
    j: recipe.job,
    y: recipe.yields,
    a: [...pairs(recipe.materials).flat(), ...pairs(recipe.crystals).flat()]
  });
});

const roots = new Set([
  // 水晶价格页固定展示六属性的碎晶、水晶与晶簇，需要同步其游戏图标 ID。
  ...Array.from({ length: 18 }, (_, index) => String(index + 2)),
  ...Object.keys(baseMaterials.b || {}),
  ...Object.keys(baseMaterials.d || {}),
  // 材料指导价中存在 NPC、兑换等来源定义、但未必可由当前配方树反向抵达的项目，
  // 同样写入常用回退快照，让材料页无需加载完整搜索图标索引。
  ...Object.keys(materialSources || {}),
  ...(submarineData.parts || []).map(part => String(part.id)),
  // HqHelper 不包含部队合建部件本身；以现有潜水艇配方图中的所有节点为种子，
  // 才能收集可制作半成品及其下级配方，作为工房数据缺失时的回退。
  ...Object.keys(submarineData.g || {})
]);
const pending = [...roots];
const visited = new Set();
while (pending.length) {
  const id = String(pending.pop());
  if (visited.has(id)) continue;
  visited.add(id);
  (byTarget[id] || []).forEach(recipe => {
    pairs(recipe.a).forEach(([child]) => pending.push(String(child)));
  });
}

const selectedItems = {};
const selectedRecipes = {};
const selectedTrades = {};
[...visited].sort((a, b) => Number(a) - Number(b)).forEach(id => {
  const item = items[id];
  if (item) selectedItems[id] = {
    n: item.name?.[2] || item.name?.[1] || item.name?.[0] || `未知材料 ${id}`,
    i: Number(item.icon || 0),
    il: Number(item.ilv || 0),
    t: Boolean(item.tradable),
    r: Array.isArray(item.rids) ? item.rids.map(Number) : []
  };
  if (byTarget[id]?.length) selectedRecipes[id] = byTarget[id];
  if (trades[id]) selectedTrades[id] = trades[id];
});

const primaryRecipes = { ...(baseMaterials.g || {}), ...(submarineData.g || {}) };
const normalizeRecipe = recipe => JSON.stringify({
  j: Number(recipe.j || 0),
  y: Number(recipe.y || 1),
  a: pairs(recipe.a || []).sort((left, right) => left[0] - right[0])
});
const conflicts = [];
Object.keys(primaryRecipes).forEach(id => {
  if (!selectedRecipes[id]) return;
  const primary = new Set(primaryRecipes[id].map(normalizeRecipe));
  const fallback = new Set(selectedRecipes[id].map(normalizeRecipe));
  const same = primary.size === fallback.size && [...primary].every(recipe => fallback.has(recipe));
  if (!same) conflicts.push(Number(id));
});
const baseDirectConflicts = [];
Object.entries(baseMaterials.d || {}).forEach(([id, rawDirect]) => {
  const expected = pairs(rawDirect).sort((left, right) => left[0] - right[0]);
  const expectedJob = Number(baseMaterials.j?.[id]);
  const fallback = (selectedRecipes[id] || []).find(recipe => Number(recipe.j) === expectedJob) || selectedRecipes[id]?.[0];
  if (!fallback) return;
  const actual = pairs(fallback.a).sort((left, right) => left[0] - right[0]);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) baseDirectConflicts.push(Number(id));
});
const audit = {
  primaryRecipeGroups: Object.keys(primaryRecipes).length,
  fallbackRecipeGroups: Object.keys(selectedRecipes).length,
  fallbackOnlyRecipeGroups: Object.keys(selectedRecipes).filter(id => !primaryRecipes[id]).map(Number),
  primaryOnlyRecipeGroups: Object.keys(primaryRecipes).filter(id => !selectedRecipes[id]).map(Number),
  conflicts,
  baseDirectConflicts
};

const payload = {
  meta: {
    source: 'HqHelper Dawntrail',
    repository: `https://github.com/${repo}`,
    commit,
    gameVersion: '7.55',
    syncedAt: new Date().toISOString(),
    license: 'MIT License, Copyright (c) 2024 InfSein',
    scope: '770 / 750 装备与潜水艇当前配方树可达节点'
  },
  items: selectedItems,
  recipes: selectedRecipes,
  trades: selectedTrades,
  audit
};

// Garland 的 item.id 与 icon.id 并不相同，因此不能以物品 ID 拼接图标地址。
// 常用配方树在同步时一次性取得图标编号；页面打开时无需逐项查询外站。
const commonIconIds = [...new Set([...roots, ...visited, ...Object.keys(selectedItems)])];
const garlandIcons = await fetchGarlandIcons(commonIconIds);
payload.icons = garlandIcons.index;
payload.meta.iconSource = 'Garland Tools';
payload.meta.iconSourceUrl = 'https://www.garlandtools.org/';
payload.audit.garlandIconCount = Object.keys(garlandIcons.index).length;
payload.audit.garlandIconMissing = garlandIcons.missing;

const output = `// 由 tools/sync-hqhelper-fallback.mjs 生成；请勿手工编辑。\nwindow.FF14_HQHELPER_FALLBACK=${JSON.stringify(payload)};\n`;
await writeFile(new URL('../hqhelper-fallback.js', import.meta.url), output, 'utf8');
const iconOutput = `// 由 tools/sync-hqhelper-fallback.mjs 生成；Garland Tools 图标 ID，供其他材料搜索按需加载。\nwindow.FF14_ITEM_ICON_INDEX=${JSON.stringify(garlandIcons.index)};\n`;
await writeFile(new URL('../item-icon-index.js', import.meta.url), iconOutput, 'utf8');
console.log(`已生成 hqhelper-fallback.js（${Object.keys(selectedItems).length} 个物品）与 item-icon-index.js（${Object.keys(garlandIcons.index).length} 个 Garland 图标），${Object.keys(selectedRecipes).length} 组配方，提交 ${commit.slice(0, 12)}；工房冲突 ${conflicts.length} 组、装备直接配方冲突 ${baseDirectConflicts.length} 组。`);
