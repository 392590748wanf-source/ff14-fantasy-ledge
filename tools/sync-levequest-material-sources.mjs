/** Build a Garland-first acquisition audit for all crafting-leve materials. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { wikiNpcLocalizations } from './wiki-npc-localizations.mjs';

const root = resolve(import.meta.dirname, '..');
const cacheDir = resolve(root, 'tools', '.cache', 'levequest-recipes');
const garlandBase = 'https://www.garlandtools.org/db/doc/item/en/3';
const chineseNpcDataUrl = 'https://raw.githubusercontent.com/thewakingsands/ffxiv-datamining-cn/master/ENpcResident.csv';
const evaluate = async file => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(resolve(root, file), 'utf8'), context, { filename: file });
  return context.window;
};
const [leveData, catalogData, recipeData, sourceData] = await Promise.all([
  evaluate('levequests.js'), evaluate('levequest-catalog.js'), evaluate('levequest-recipes.js'), evaluate('material-sources.js')
]);
const recipes = recipeData.FF14_LEVEQUEST_RECIPES || {};
const itemNames = recipes.items || {};
const materialSourceOverrides = sourceData.FF14_MATERIAL_SOURCES || {};
const exchanges = sourceData.FF14_EXCHANGE_SOURCES?.routes || [];
const routes = (catalogData.FF14_LEVEQUEST_CATALOG?.routes || leveData.FF14_LEVEQUESTS?.routes || [])
  .filter(route => route.verified && /^\d+$/.test(String(route.itemId || '')));
const roots = [...new Set(routes.map(route => String(route.itemId)))];
const reachable = new Set();
const visit = uid => {
  uid = String(uid || '');
  if (!/^\d+$/.test(uid) || reachable.has(uid)) return;
  reachable.add(uid);
  for (const recipe of recipes.recipes?.[uid] || []) {
    for (let index = 0; index < recipe.a.length; index += 2) visit(recipe.a[index]);
  }
};
roots.forEach(visit);
await mkdir(cacheDir, { recursive: true });
const parseCsvRows = text => {
  const rows = [], row = [];
  let field = '', quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field); field = ''; }
    else if (character === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row.splice(0)); field = ''; }
    else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
};
const readChineseNpcNames = async () => {
  const file = resolve(cacheDir, 'enpcresident-chs.csv');
  let text;
  try {
    const response = await fetch(chineseNpcDataUrl, { headers: { 'user-agent': 'LogFate material source auditor/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    text = await response.text();
    await writeFile(file, text, 'utf8');
  } catch (error) {
    try { text = await readFile(file, 'utf8'); }
    catch { throw new Error(`无法读取简中 NPC 资料：${error.message}`); }
  }
  const names = new Map();
  for (const row of parseCsvRows(text).slice(3)) {
    const id = String(row[0] || '').trim(), name = String(row[1] || '').trim();
    if (/^\d+$/.test(id) && name) names.set(id, name);
  }
  return names;
};
const chineseNpcNames = await readChineseNpcNames();
const readGarlandItem = async uid => {
  const file = resolve(cacheDir, `item-${uid}.json`);
  try {
    const response = await fetch(`${garlandBase}/${uid}.json`, { headers: { 'user-agent': 'LogFate levequest source auditor/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    await writeFile(file, text, 'utf8');
    return JSON.parse(text) || null;
  } catch (error) {
    try { return JSON.parse(await readFile(file, 'utf8')); }
    catch { throw error; }
  }
};
const exchangeKindsFor = uid => [...new Set(exchanges
  .filter(route => Object.hasOwn(route.outputs || {}, String(uid)))
  .map(route => route.kind)
)].sort();
const sourceKinds = (item, uid) => {
  const kinds = [];
  if (Number(item?.price || 0) > 0 && item?.vendors?.length) kinds.push('NPC 购买材料');
  kinds.push(...exchangeKindsFor(uid));
  if (item?.nodes?.length) kinds.push('常规采集品');
  if (item?.drops?.length) kinds.push('怪物掉落');
  if (Number(item?.tradeable || 0) && item?.craft?.length) kinds.push('市场采购半成品');
  return [...new Set(kinds)];
};
const vendorTypeLabels = {
  'Merchant & Mender': '杂货商', 'Guild Supplier': '行会供应商', 'Battlecraft Supplier': '战斗用品商人',
  'Tradecraft Supplier': '生产商人', 'Material Supplier': '素材商人', 'Sundries Vendor': '杂货商',
  'Tradecraft Merchant': '生产商人', 'Independent Tailor': '裁衣商', 'Battlecraft Armorer': '防具商',
  Armorer: '防具商', 'Independent Jeweler': '珠宝商', 'Independent Arms Merchant': '武器商',
  'Fieldcraft Supplier': '采集用品商人', Weaponsmith: '武器商', 'Tool Supplier': '工具商',
  'Fieldcraft Merchant': '采集用品商人', Jeweler: '珠宝商', 'Arms Merchant': '武器商',
  Herbalist: '药材商', 'Independent Apothecary': '药剂商', Apothecary: '药剂商', Culinarian: '烹饪师',
  Clothier: '裁衣商', Florist: '花商', Merchant: '商人', 'Arms Dealer': '武器商'
};
const vendorNameLabel = name => {
  if (/Sahagin Vendor/i.test(name)) return '鱼人族杂用商人';
  if (/Amalj'aa Vendor/i.test(name)) return '蜥蜴人族杂用商人';
  if (/Sylphic Vendor/i.test(name)) return '妖精族杂用商人';
  if (/Kobold Vendor/i.test(name)) return '地灵族杂用商人';
  if (/Ixali Vendor/i.test(name)) return '鸟人族杂用商人';
  if (/Material Supplier/i.test(name)) return '素材商人';
  if (/Merchant & Mender/i.test(name)) return '杂货商';
  if (/Armorer/i.test(name)) return '防具商';
  if (/Clothier|Tailor/i.test(name)) return '裁衣商';
  if (/Jeweler/i.test(name)) return '珠宝商';
  if (/Apothecary|Herbalist/i.test(name)) return '药剂商';
  if (/Weaponsmith|Arms/i.test(name)) return '武器商';
  if (/Junkmonger|Peddler|Vendor|Merchant/i.test(name)) return '杂货商';
  return '商店商人';
};
const vendorSummary = (document, item) => {
  const vendorIds = new Set((item?.vendors || []).map(String));
  const vendors = (document?.partials || [])
    .filter(entry => entry?.type === 'npc' && vendorIds.has(String(entry.id || entry.obj?.i)))
    .map(entry => {
      const id = Number(entry.id || entry.obj?.i);
      const localized = wikiNpcLocalizations[String(id)];
      const localizedName = localized?.name || chineseNpcNames.get(String(id)) || '';
      return { id, name: entry.obj?.n || `NPC ${entry.id}`, type: entry.obj?.t || '', localizedName, localizationSource: localized?.source || (localizedName ? '简中游戏数据' : '') };
    })
    .filter(entry => entry.name)
    .filter((entry, index, list) => list.findIndex(candidate => candidate.id === entry.id) === index);
  const channels = [...new Set(vendors.map(entry => entry.localizedName || vendorTypeLabels[entry.type] || vendorNameLabel(entry.name)))];
  const summary = channels.length
    ? `${channels.slice(0, 3).join('、')}${channels.length > 3 ? '等' : ''}`
    : '商店商人';
  return { vendors, summary };
};
const records = {}, missing = [];
const unmatchedVendors = new Map();
const ids = [...reachable].sort((left, right) => Number(left) - Number(right));
for (let start = 0; start < ids.length; start += 12) {
  const batch = ids.slice(start, start + 12);
  const imported = await Promise.all(batch.map(async uid => {
    try { return [uid, await readGarlandItem(uid)]; }
    catch (error) { return [uid, null, error]; }
  }));
  for (const [uid, document, error] of imported) {
    const item = document?.item;
    if (!item) { missing.push({ id: Number(uid), reason: error?.message || 'Garland 未返回物品资料' }); continue; }
    const vendorCount = Number(item.vendors?.length || 0), price = Number(item.price || 0), kinds = sourceKinds(item, uid);
    const vendor = vendorSummary(document, item);
    for (const entry of vendor.vendors) {
      if (!entry.localizedName) unmatchedVendors.set(String(entry.id), { id: entry.id, garlandName: entry.name, fallback: vendorTypeLabels[entry.type] || vendorNameLabel(entry.name) });
    }
    const overrideNpc = materialSourceOverrides[uid]?.npc;
    records[uid] = {
      n: itemNames[uid]?.n || item.name || `物品 ${uid}`,
      kinds,
      npc: price > 0 && vendorCount > 0 ? { price, source: overrideNpc?.source || vendor.summary, vendorCount, vendors: vendor.vendors } : null,
      sourceUrl: `${garlandBase}/${uid}.json`,
      status: kinds.length ? '已核验' : '待核验',
      evidence: { vendors: vendorCount, nodes: Number(item.nodes?.length || 0), drops: Number(item.drops?.length || 0), craft: Number(item.craft?.length || 0), exchangeKinds: exchangeKindsFor(uid) }
    };
  }
}
const statusCounts = Object.values(records).reduce((counts, record) => {
  counts[record.status] = (counts[record.status] || 0) + 1;
  return counts;
}, {});
const payload = {
  schema: 1,
  version: '0.0.1',
  publishedAt: new Date().toISOString(),
  sources: { garland: garlandBase, chineseNpcData: chineseNpcDataUrl, huiji: '用于商人名称与商店列表人工复核' },
  items: records,
  audit: {
    routeCount: routes.length, uniqueRootItems: roots.length, recursiveMaterials: ids.length, imported: Object.keys(records).length,
    statusCounts, missing, discrepancies: [],
    unmatchedVendors: [...unmatchedVendors.values()].sort((left, right) => left.id - right.id)
  }
};
await writeFile(resolve(root, 'levequest-material-sources.js'), `// 自动生成：tools/sync-levequest-material-sources.mjs。来源：Garland Tools。\nwindow.FF14_LEVEQUEST_MATERIAL_SOURCES=${JSON.stringify(payload)};\n`, 'utf8');
console.log(`Garland 理符来源审计完成：${Object.keys(records).length}/${ids.length} 项；NPC 可购 ${Object.values(records).filter(record => record.npc).length} 项。`);
