/**
 * Synchronise the complete craft-leve catalogue from XIVAPI and Garland.
 *
 * XIVAPI supplies the Chinese task name, job, level and base experience;
 * Garland supplies the requested item and repeat count.  Heavensward's
 * large-scale leves are deliberately excluded at ingestion time so they can
 * never enter plans, recipe imports, or material recommendations.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { systemLevePlans } from './levequest-system-plan.mjs';

const root = resolve(import.meta.dirname, '..');
const cacheDir = resolve(root, 'tools', '.cache', 'levequest-catalog');
const xivApi = 'https://xivapi-v2.xivcdn.com/api';
const garland = 'https://www.garlandtools.org/db/doc/leve/en/3';
const jobs = new Map([
  ['刻木匠', '刻木匠'], ['锻铁匠', '锻铁匠'], ['铸甲匠', '铸甲匠'], ['雕金匠', '雕金匠'],
  ['制革匠', '制革匠'], ['裁衣匠', '裁衣匠'], ['炼金术士', '炼金术士'], ['烹调师', '烹饪师']
]);
// 生产理符的接取地点在资料中与资料片一一对应。不能按任务等级分段：
// 例如 3.0 的首批理符就是 50 级，会被旧的 1–50 分组误归入 2.0。
const expansionByPlace = new Map([
  ['格里达尼亚', ['2.0', '重生之境']], ['烤饼练兵所', ['2.0', '重生之境']], ['弯枝牧场', ['2.0', '重生之境']],
  ['霍桑山寨', ['2.0', '重生之境']], ['石场水车', ['2.0', '重生之境']], ['黑衣森林南部林区——石场水车', ['2.0', '重生之境']],
  ['太阳海岸', ['2.0', '重生之境']], ['阿德内尔占星台', ['2.0', '重生之境']], ['白云崖前哨', ['2.0', '重生之境']],
  ['圣寇伊纳克调查地', ['2.0', '重生之境']], ['利姆萨·罗敏萨', ['2.0', '重生之境']], ['赤血雄鸡农场', ['2.0', '重生之境']],
  ['雨燕塔殖民地', ['2.0', '重生之境']], ['小麦酒港', ['2.0', '重生之境']], ['乌尔达哈', ['2.0', '重生之境']],
  ['毒蝎交易所', ['2.0', '重生之境']], ['地平关', ['2.0', '重生之境']], ['枯骨营地', ['2.0', '重生之境']],
  ['伊修加德基础层', ['3.0', '苍穹之禁城']], ['黄金港', ['4.0', '红莲之狂潮']], ['水晶都', ['5.0', '暗影之逆焰']],
  ['旧萨雷安', ['6.0', '晓月之终途']], ['图莱尤拉', ['7.0', '金曦之遗辉']]
]);
const classifyExpansion = place => {
  const [version, name] = expansionByPlace.get(String(place || '')) || [];
  return version
    ? { expansion: version, expansionName: name, classificationStatus: 'place-verified' }
    : { expansion: 'unverified', expansionName: '待核验', classificationStatus: 'unverified-place' };
};
const readDataset = async file => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(resolve(root, file), 'utf8'), context, { filename: file });
  return context.window.FF14_LEVEQUESTS || { routes: [] };
};
// 分批物品查询会携带较长的 ID 列表，使用摘要避免 Windows 路径过长。
const filename = value => createHash('sha256').update(String(value)).digest('hex');
await mkdir(cacheDir, { recursive: true });
const fetchJson = async (url, key) => {
  const file = resolve(cacheDir, `${filename(key)}.json`);
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'LogFate leve catalogue synchroniser/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    await writeFile(file, body, 'utf8');
    return JSON.parse(body);
  } catch (error) {
    try { return JSON.parse(await readFile(file, 'utf8')); }
    catch { throw new Error(`${url}: ${error.message}`); }
  }
};
const pool = async (items, limit, action) => {
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) await action(items[cursor++]);
  }));
};

const fields = 'Name,ClassJobCategory.Name,ClassJobLevel,ExpReward,PlaceNameIssued.Name';
const leveRows = [];
let after = -1;
while (true) {
  const url = `${xivApi}/sheet/Leve?fields=${encodeURIComponent(fields)}&language=chs&limit=500${after >= 0 ? `&after=${after}` : ''}`;
  const page = await fetchJson(url, `xiv-leves-${after}`);
  const rows = page.rows || [];
  leveRows.push(...rows);
  if (rows.length < 500) break;
  after = Number(rows.at(-1)?.row_id || 0);
}
const eligible = leveRows.filter(row => {
  const name = String(row.fields?.Name || '');
  return jobs.has(String(row.fields?.ClassJobCategory?.fields?.Name || '')) && name && !name.includes('大规模');
});
const garlandRows = new Map();
const failures = [];
await pool(eligible, 12, async row => {
  const id = Number(row.row_id);
  try { garlandRows.set(id, (await fetchJson(`${garland}/${id}.json`, `garland-leve-${id}`)).leve || null); }
  catch (error) { failures.push({ leveId: id, reason: error.message }); }
});
const deliveredItemIds = [...new Set([...garlandRows.values()].flatMap(row => (row?.requires || []).map(requirement => Number(requirement.item))).filter(Boolean))];
const itemRows = new Map();
for (let index = 0; index < deliveredItemIds.length; index += 100) {
  const ids = deliveredItemIds.slice(index, index + 100);
  const url = `${xivApi}/sheet/Item?rows=${ids.join(',')}&fields=Name,Icon&language=chs`;
  const response = await fetchJson(url, `xiv-items-${ids.join('-')}`);
  (response.rows || []).forEach(row => itemRows.set(Number(row.row_id), row.fields || {}));
}
const existing = await readDataset('levequests.js');
const planKey = (job, level, item) => `${job}|${level}|${item}`;
const planAllowances = Object.fromEntries(Object.entries(systemLevePlans).map(([mode, plan]) => [mode,
  new Map(Object.entries(plan).flatMap(([job, entries]) => entries.map(([item, level, allowances]) => [planKey(job, level, item), allowances])))
]));
const routes = eligible.flatMap(row => {
  const leveId = Number(row.row_id), leve = garlandRows.get(leveId), requirement = leve?.requires?.[0];
  const itemId = Number(requirement?.item || 0), item = itemRows.get(itemId);
  if (!leve || !itemId || !item?.Name) {
    failures.push({ leveId, reason: !leve ? 'Garland 理符资料缺失' : '交付物未解析' });
    return [];
  }
  const job = jobs.get(String(row.fields.ClassJobCategory?.fields?.Name || ''));
  const level = Number(row.fields.ClassJobLevel || leve.lvl || 0);
  const systemPlan = Object.fromEntries(Object.entries(planAllowances).flatMap(([mode, entries]) => {
    const allowances = entries.get(planKey(job, level, String(item.Name)));
    return allowances ? [[mode, allowances]] : [];
  }));
  const submissions = Math.max(1, Number(leve.repeats || 0) + 1);
  const routeAllowances = Math.max(1, Number(systemPlan.normal || systemPlan.double || 1));
  const place = String(row.fields.PlaceNameIssued?.fields?.Name || '');
  return [{
    job, level, item: String(item.Name), itemId,
    itemIcon: Number(item.Icon?.id || 0) || null, quest: String(row.fields.Name),
    place, note: '', leveId, ...classifyExpansion(place),
    submissionsPerAllowance: submissions, routeAllowances, routeQuantity: submissions * routeAllowances,
    experiencePerSubmission: Number(row.fields.ExpReward || leve.xp || 0), verified: true,
    verificationStatus: 'xivapi-garland-verified', garlandUrl: `${garland}/${leveId}.json`,
    wikiUrl: `https://ff14.huijiwiki.com/wiki/${encodeURIComponent(`理符任务:${String(row.fields.Name)}`)}`,
    systemPlan, isSystemRecommended: Boolean(systemPlan.normal),
    verificationNote: 'XIVAPI 已核验中文任务、职业、等级、经验、交付物名称与图标；Garland 已核验交付物与重复次数。'
  }];
}).sort((left, right) => jobsOrder(left.job) - jobsOrder(right.job) || left.level - right.level || left.leveId - right.leveId);
// 保留旧资料中 XIVAPI / Garland 无法唯一返回的少数国服路线；它们使用负数内部 ID，
// 只用于本地方案键，不会被作为 Garland 请求 ID。
const catalogKeys = new Set(routes.map(route => planKey(route.job, route.level, route.item)));
let manualId = -1;
for (const [mode, plan] of Object.entries(systemLevePlans)) for (const [job, entries] of Object.entries(plan)) for (const [item, level, allowances] of entries) {
  const key = planKey(job, level, item);
  if (catalogKeys.has(key)) continue;
  const legacy = (existing.routes || []).find(route => planKey(route.job, Number(route.level), route.item) === key);
  if (!legacy) { failures.push({ job, level, item, reason: `系统${mode === 'double' ? '双倍' : '常规'}方案路线未在资料库匹配` }); continue; }
  const paired = routes.find(route => route.job === job && route.item === item);
  const systemPlan = { normal: planAllowances.normal.get(key), double: planAllowances.double.get(key) };
  Object.keys(systemPlan).forEach(name => systemPlan[name] || delete systemPlan[name]);
  const submissions = Number(legacy.submissionsPerAllowance || paired?.submissionsPerAllowance || 1);
  routes.push({ ...legacy, leveId: manualId--, itemId: Number(legacy.itemId || paired?.itemId || 0) || null,
    itemIcon: Number(legacy.itemIcon || paired?.itemIcon || 0) || null, garlandUrl: '', wikiUrl: legacy.wikiUrl || '',
    ...classifyExpansion(legacy.place || paired?.place),
    systemPlan, routeAllowances: Number(systemPlan.normal || systemPlan.double), routeQuantity: submissions * Number(systemPlan.normal || systemPlan.double),
    isSystemRecommended: Boolean(systemPlan.normal), verificationNote: '按用户提供的 7.0 理符方案表补齐的国服路线。' });
  catalogKeys.add(key);
}
routes.sort((left, right) => jobsOrder(left.job) - jobsOrder(right.job) || left.level - right.level || left.leveId - right.leveId);
function jobsOrder(job) { return [...jobs.values()].indexOf(job); }
const payload = {
  schema: 2, version: '0.0.2', publishedAt: new Date().toISOString(),
  sources: { xivApi: 'https://xivapi-v2.xivcdn.com/zh-cn/', garland: `${garland}/` },
  jobs: [...jobs.values()], routes,
  audit: {
    imported: routes.length,
    excludedLargeScale: leveRows.filter(row => jobs.has(String(row.fields?.ClassJobCategory?.fields?.Name || '')) && String(row.fields?.Name || '').includes('大规模')).length,
    systemRecommended: routes.filter(route => route.isSystemRecommended).length,
    systemRecommendedDouble: routes.filter(route => route.systemPlan?.double).length,
    classification: {
      method: 'XIVAPI 接取地点映射；每条记录保留灰机理符任务链接供逐项复核。',
      verified: routes.filter(route => route.classificationStatus === 'place-verified').length,
      unverified: routes.filter(route => route.classificationStatus !== 'place-verified').map(route => ({ leveId: route.leveId, quest: route.quest, place: route.place }))
    },
    failures
  }
};
await writeFile(resolve(root, 'levequest-catalog.js'), `// 自动生成：tools/sync-levequest-catalog.mjs。\nwindow.FF14_LEVEQUEST_CATALOG=${JSON.stringify(payload)};\n`, 'utf8');
console.log(`已导入 ${routes.length} 条生产理符；排除 ${payload.audit.excludedLargeScale} 条大规模理符；系统方案一保留 ${payload.audit.systemRecommended} 条推荐路线。`);
