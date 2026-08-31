/**
 * Build a reproducible levequest verification snapshot.
 *
 * Garland exposes item -> leve ids and the individual leve records, including
 * level, job category, required item and base XP.  Huiji links are retained
 * for every record, but its public API may be protected by Cloudflare; the
 * audit therefore records that source as pending rather than fabricating a
 * Wiki verification result.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const garlandBase = 'https://www.garlandtools.org/db/doc';
const jobWikiPages = {
  '刻木匠': '刻木匠', '锻铁匠': '锻铁匠', '铸甲匠': '铸甲匠', '雕金匠': '雕金匠',
  '制革匠': '制革匠', '裁衣匠': '裁衣匠', '炼金术士': '炼金术士', '烹饪师': '烹调师'
};
const garlandJobCategories = {
  '刻木匠': 9, '锻铁匠': 10, '铸甲匠': 11, '雕金匠': 12,
  '制革匠': 13, '裁衣匠': 14, '炼金术士': 15, '烹饪师': 16
};
// 灰机理符列表人工核对值：单位为每次交付的基础经验。用于补足
// 国服名称/等级与 Garland 英文旧记录无法唯一对应的路线。
const manualWikiExperience = new Map([
  ['面向义勇兵的幻具', 12000],
  ['全国顶尖的发光双剑', 3559400],
  ['面向义勇兵的链甲', 28320],
  ['流行的棉绒裤子', 24980],
  ['热卖商品猛毒药', 43560],
  ['面向富裕阶层的耐力之秘药', 57210],
  ['招待吉吉卢恩用的菜肴', 75760]
]);
// 国服理符列表偶有与通用物品索引不同的本地化名称。仅为已由
// Garland 理符记录确认的一对一别名补入口，不在客户端按名称猜测物品。
const leveItemAliases = new Map([
  ['钴钨屠刀', [42153]]
]);
const cacheDir = resolve(root, 'tools', '.cache', 'levequest-verification');

const evaluateDataset = async file => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(resolve(root, file), 'utf8'), context, { filename: file });
  return context.window;
};
const normalize = value => String(value || '').replace(/[（）()【】\[\]\s·・，,。.!！?？：:]/g, '').replace(/制作委托|筹集委托|批发委托/g, '');
const routeKey = route => [route.job, route.level, normalize(route.quest), normalize(route.item)].join('|');
const wikiUrl = route => `https://ff14.huijiwiki.com/wiki/${encodeURIComponent(jobWikiPages[route.job] || route.job)}`;
const garlandUrl = id => `${garlandBase}/leve/en/3/${id}.json`;

await mkdir(cacheDir, { recursive: true });
const fetchJson = async (url, key) => {
  const path = resolve(cacheDir, `${key}.json`);
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'LogFate levequest verifier/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    await writeFile(path, text, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    try { return JSON.parse(await readFile(path, 'utf8')); }
    catch { throw new Error(`${url}: ${error.message}`); }
  }
};
const pool = async (values, limit, fn) => {
  const result = []; let index = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (index < values.length) {
      const current = values[index++];
      result.push(await fn(current));
    }
  }));
  return result;
};

const itemIndex = (await evaluateDataset('item-index.js')).FF14_ITEM_INDEX || [];
const itemIdsByName = new Map();
itemIndex.forEach(([id, name]) => {
  const key = normalize(name);
  if (!itemIdsByName.has(key)) itemIdsByName.set(key, []);
  itemIdsByName.get(key).push(Number(id));
});
const leveDataset = (await evaluateDataset('levequests.js')).FF14_LEVEQUESTS || { routes: [] };
const routes = leveDataset.routes || [];
const idsForRoute = route => leveItemAliases.get(normalize(route.item)) || itemIdsByName.get(normalize(route.item)) || [];
const idsNeeded = [...new Set(routes.flatMap(idsForRoute))];
const itemDocs = new Map();
await pool(idsNeeded, 6, async id => itemDocs.set(id, await fetchJson(`${garlandBase}/item/en/3/${id}.json`, `item-${id}`)));
// Garland's root item lists leves where that item is the requested delivery;
// nested ingredient leves describe unrelated source materials and must not be
// used for this verification.
const leveIds = [...new Set([...itemDocs.values()].flatMap(doc => doc.item?.requiredByLeves || []))];
const leveDocs = new Map();
await pool(leveIds, 8, async id => leveDocs.set(Number(id), await fetchJson(garlandUrl(id), `leve-${id}`)));

const entries = routes.map(route => {
  const itemIds = idsForRoute(route);
  const candidates = itemIds.flatMap(itemId => (itemDocs.get(itemId)?.item?.requiredByLeves || []).map(leveId => ({ itemId, leveId: Number(leveId), doc: leveDocs.get(Number(leveId))?.leve })))
    .filter(candidate => candidate.doc?.lvl === Number(route.level)
      && candidate.doc?.jobCategory === garlandJobCategories[route.job]
      && candidate.doc.requires?.some(requirement => Number(requirement.item) === candidate.itemId));
  const unique = [...new Map(candidates.map(candidate => [candidate.leveId, candidate])).values()];
  const expectedSubmissions = Number(route.submissionsPerAllowance || 0);
  // Garland suffixes repeatable bulk leves with "(L)".  The workbook's
  // quantities/allowance distinguish that from the ordinary delivery.
  const repetitionMatches = unique.filter(candidate => expectedSubmissions > 1
    ? /\(L\)$/.test(candidate.doc?.name || '')
    : !/\(L\)$/.test(candidate.doc?.name || ''));
  const selected = repetitionMatches.length === 1 ? repetitionMatches[0] : (unique.length === 1 ? unique[0] : null);
  const manualExperience = manualWikiExperience.get(normalize(route.quest));
  const status = selected ? 'garland-verified' : manualExperience ? 'wiki-manual-verified' : unique.length ? 'ambiguous' : itemIds.length ? 'unmatched' : 'item-unmatched';
  return {
    key: routeKey(route), job: route.job, level: route.level, quest: route.quest, item: route.item,
    // 交付物 ID 同样属于核验结果：页面图标、配方成本和材料指导价均只能使用此 ID，
    // 不能在客户端根据中文名猜测。
    itemIds, itemId: selected?.itemId || (itemIds.length === 1 ? itemIds[0] : null), itemIcon: Number(itemDocs.get(selected?.itemId || (itemIds.length === 1 ? itemIds[0] : 0))?.item?.icon || 0) || null, leveId: selected?.leveId || null, experiencePerSubmission: selected?.doc?.xp || manualExperience || null,
    garlandUrl: selected ? garlandUrl(selected.leveId) : '', wikiUrl: wikiUrl(route),
    expectedSubmissions, verifiedSubmissions: expectedSubmissions,
    status, wikiStatus: 'pending-manual-check',
    note: selected
      ? 'Garland 已核验交付物、等级与基础经验；灰机 Wiki API 当前不可自动读取，保留来源链接待人工复核。'
      : manualExperience
        ? '已按灰机 Wiki 理符列表人工核对每次交付基础经验；Garland 无法唯一匹配该国服路线。'
      : (unique.length ? `Garland 存在 ${unique.length} 个同等级候选任务，需人工匹配。` : '未能从 Garland 交付物索引唯一匹配任务。')
  };
});
const grouped = entries.reduce((result, entry) => {
  (result[entry.status] ||= []).push(entry);
  return result;
}, {});
const audit = {
  schema: 1, generatedAt: new Date().toISOString(), sources: {
    garland: garlandBase, wiki: 'https://ff14.huijiwiki.com/wiki/理符任务',
    wikiFetch: 'blocked-by-cloudflare'
  },
  total: entries.length,
  counts: Object.fromEntries(Object.entries(grouped).map(([status, rows]) => [status, rows.length])),
  entries
};
await writeFile(resolve(root, 'levequest-verification.js'), `// 自动生成：tools/sync-levequest-verification.mjs。\nwindow.FF14_LEVEQUEST_VERIFICATION=${JSON.stringify(audit)};\n`, 'utf8');
// 工作簿可能不在当前工作区。同步后直接回写已核验字段，确保图标、
// 配方和成本资料在无需重新导入工作簿时也能立即使用。
const entriesByKey = new Map(entries.map(entry => [entry.key, entry]));
const refreshedRoutes = routes.map(route => {
  const entry = entriesByKey.get(routeKey(route));
  return entry ? {
    ...route,
    itemId: entry.itemId,
    itemIcon: entry.itemIcon,
    leveId: entry.leveId,
    experiencePerSubmission: entry.experiencePerSubmission,
    verified: entry.status === 'garland-verified' || entry.status === 'wiki-manual-verified',
    verificationStatus: entry.status,
    wikiStatus: entry.wikiStatus,
    garlandUrl: entry.garlandUrl,
    wikiUrl: entry.wikiUrl,
    verificationNote: entry.note
  } : route;
});
const refreshedLeveDataset = {
  ...leveDataset,
  audit: {
    ...leveDataset.audit,
    generatedAt: audit.generatedAt,
    counts: audit.counts,
    pending: entries.filter(entry => !['garland-verified', 'wiki-manual-verified'].includes(entry.status))
  },
  routes: refreshedRoutes
};
await writeFile(resolve(root, 'levequests.js'), `// 自动生成：tools/sync-levequest-verification.mjs。\nwindow.FF14_LEVEQUESTS=${JSON.stringify(refreshedLeveDataset)};\n`, 'utf8');
const verifiedCount = (audit.counts['garland-verified'] || 0) + (audit.counts['wiki-manual-verified'] || 0);
console.log(`已核验 ${verifiedCount}/${audit.total} 条理符路线（Garland ${audit.counts['garland-verified'] || 0}，Wiki 人工 ${audit.counts['wiki-manual-verified'] || 0}）。`);
