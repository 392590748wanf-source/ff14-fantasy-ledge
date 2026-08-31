/**
 * Exports the original NBB item icons used by verified levequest deliveries.
 * The game-art highlight belongs to the PNG itself; this script deliberately
 * does not add an image overlay.
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const outputDir = resolve(root, 'assets', 'levequest-icons');
const context = { window: {} };
vm.runInNewContext(await readFile(resolve(root, 'levequests.js'), 'utf8'), context, { filename: 'levequests.js' });

const routesByItemId = new Map();
(context.window.FF14_LEVEQUESTS?.routes || [])
  .filter(route => route.verified && Number(route.itemId) > 0)
  .forEach(route => routesByItemId.set(Number(route.itemId), route));
const ids = [...routesByItemId.keys()];
// NBB's file hierarchy keys on the game's icon number, not the item ID.
// E.g. 黑铁长枪 item 1825 uses icon 31807 → 031000/031807.png.
const nbbIconUrl = icon => {
  const padded = String(icon).padStart(6, '0');
  return `https://icon.nbbjack.com/${padded.slice(0, 3)}000/${padded}.png`;
};

await mkdir(outputDir, { recursive: true });
let completed = 0;
let nbbCompleted = 0;
let garlandCompleted = 0;
let existing = 0;
const failures = [];
const shouldRefresh = process.argv.includes('--refresh');
const exportIcon = async id => {
  const output = resolve(outputDir, `${id}.png`);
  const route = routesByItemId.get(id);
  if (!shouldRefresh) {
    try {
      await access(output);
      existing += 1;
      return;
    } catch {}
  }
  try {
    const nbbIcon = Number(route?.itemIcon || 0);
    if (!nbbIcon) throw new Error('缺少已核验的图标编号');
    const response = await fetch(nbbIconUrl(nbbIcon), { headers: { 'user-agent': 'LogFate levequest icon exporter/1.0' } });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('image/png')) throw new Error(`HTTP ${response.status} ${contentType}`);
    await writeFile(output, new Uint8Array(await response.arrayBuffer()));
    completed += 1;
    nbbCompleted += 1;
  } catch (error) {
    // NBB has no stored image for part of its historical-item catalogue.  Keep
    // those verified deliveries visible with the unmodified Garland original;
    // this is a source fallback, never a synthetic HQ overlay.
    const garlandIcon = Number(route?.itemIcon || 0);
    try {
      if (!garlandIcon) throw error;
      const fallback = await fetch(`https://www.garlandtools.org/files/icons/item/${garlandIcon}.png`, { headers: { 'user-agent': 'LogFate levequest icon exporter/1.0' } });
      const contentType = fallback.headers.get('content-type') || '';
      if (!fallback.ok || !contentType.includes('image/png')) throw new Error(`NBB ${error.message}; Garland HTTP ${fallback.status} ${contentType}`);
      await writeFile(output, new Uint8Array(await fallback.arrayBuffer()));
      completed += 1;
      garlandCompleted += 1;
    } catch (fallbackError) {
      failures.push(`${id}: ${fallbackError.message}`);
    }
  }
};
let cursor = 0;
await Promise.all(Array.from({ length: Math.min(8, ids.length) }, async () => {
  while (cursor < ids.length) await exportIcon(ids[cursor++]);
}));

if (failures.length) {
  console.error(`NBB 图标导出失败 ${failures.length}/${ids.length}:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`理符交付物图标已齐全（新增 NBB ${nbbCompleted}，Garland 原图回退 ${garlandCompleted}，已存在 ${existing}）。`);
}
