#!/usr/bin/env node
/**
 * 为当前账本实际使用的物品生成 Garland Tools 图标索引。
 * 运行方式：node tools/sync-garland-icons.mjs
 *
 * 只在维护资料时访问 Garland；用户打开账本时仅加载 PNG 图标。
 */
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const loadWindowData = async (filename, key) => {
  const source = await readFile(new URL(`../${filename}`, import.meta.url), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename });
  return context.window[key];
};

const [baseMaterials, submarineData, materialSources, hqHelper] = await Promise.all([
  loadWindowData('base-materials.js', 'FF14_BASE_MATERIALS'),
  loadWindowData('submarine-data.js', 'FF14_SUBMARINE_DATA'),
  loadWindowData('material-sources.js', 'FF14_MATERIAL_SOURCES'),
  loadWindowData('hqhelper-fallback.js', 'FF14_HQHELPER_FALLBACK')
]);

const ids = [...new Set([
  ...Object.keys(hqHelper.items || {}),
  ...Object.keys(baseMaterials.n || {}), ...Object.keys(baseMaterials.b || {}),
  ...Object.keys(baseMaterials.d || {}), ...Object.keys(baseMaterials.g || {}),
  ...Object.keys(materialSources || {}), ...Object.keys(submarineData.n || {}),
  ...Object.keys(submarineData.g || {}), ...(submarineData.parts || []).map(part => String(part.id))
].filter(id => /^\d+$/.test(String(id))))].sort((left, right) => Number(left) - Number(right));

const icons = {};
const missing = [];
let cursor = 0;
const worker = async () => {
  while (cursor < ids.length) {
    const id = ids[cursor++];
    try {
      const response = await fetch(`https://www.garlandtools.org/db/doc/item/en/3/${id}.json`);
      const payload = response.ok ? await response.json() : null;
      const icon = Number(payload?.item?.icon || 0);
      if (icon > 0) icons[id] = icon;
      else missing.push(Number(id));
    } catch {
      missing.push(Number(id));
    }
  }
};
await Promise.all(Array.from({ length: Math.min(12, ids.length) }, worker));

const fallbackOutput = await readFile(new URL('../hqhelper-fallback.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(fallbackOutput, context, { filename: 'hqhelper-fallback.js' });
context.window.FF14_HQHELPER_FALLBACK.icons = icons;
context.window.FF14_HQHELPER_FALLBACK.meta ||= {};
context.window.FF14_HQHELPER_FALLBACK.meta.iconSource = 'Garland Tools';
context.window.FF14_HQHELPER_FALLBACK.meta.iconSourceUrl = 'https://www.garlandtools.org/';
context.window.FF14_HQHELPER_FALLBACK.audit ||= {};
context.window.FF14_HQHELPER_FALLBACK.audit.garlandIconCount = Object.keys(icons).length;
context.window.FF14_HQHELPER_FALLBACK.audit.garlandIconMissing = missing;

await writeFile(new URL('../hqhelper-fallback.js', import.meta.url), `// 由 tools/sync-hqhelper-fallback.mjs 与 tools/sync-garland-icons.mjs 生成；请勿手工编辑。\nwindow.FF14_HQHELPER_FALLBACK=${JSON.stringify(context.window.FF14_HQHELPER_FALLBACK)};\n`, 'utf8');
await writeFile(new URL('../item-icon-index.js', import.meta.url), `// 由 tools/sync-garland-icons.mjs 生成；Garland Tools 图标 ID，供其他材料搜索按需加载。\nwindow.FF14_ITEM_ICON_INDEX=${JSON.stringify(icons)};\n`, 'utf8');
console.log(`已生成 ${Object.keys(icons).length}/${ids.length} 个 Garland 图标索引，未找到 ${missing.length} 项。`);
