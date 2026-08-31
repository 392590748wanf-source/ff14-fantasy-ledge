import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { systemLevePlans } from './levequest-system-plan.mjs';

const root = resolve(import.meta.dirname, '..');
const load = async file => { const context = { window: {} }; vm.runInNewContext(await readFile(resolve(root, file), 'utf8'), context); return Object.values(context.window)[0]; };
const catalog = await load('levequest-catalog.js');
const legacy = await load('levequests.js');
const key = (job, level, item) => `${job}|${level}|${item}`;
const allowances = Object.fromEntries(Object.entries(systemLevePlans).map(([mode, plan]) => [mode, new Map(Object.entries(plan).flatMap(([job, rows]) => rows.map(([item, level, amount]) => [key(job, level, item), amount])))]));
const routeByKey = new Map(catalog.routes.map(route => [key(route.job, route.level, route.item), route]));
for (const route of catalog.routes) {
  const routeKey = key(route.job, route.level, route.item);
  route.systemPlan = Object.fromEntries(Object.entries(allowances).flatMap(([mode, map]) => map.has(routeKey) ? [[mode, map.get(routeKey)]] : []));
  route.isSystemRecommended = Boolean(route.systemPlan.normal);
  if (route.systemPlan.normal || route.systemPlan.double) {
    route.routeAllowances = route.systemPlan.normal || route.systemPlan.double;
    route.routeQuantity = route.routeAllowances * Math.max(1, Number(route.submissionsPerAllowance || 1));
  }
}
let syntheticId = -1;
for (const [mode, plan] of Object.entries(systemLevePlans)) for (const [job, rows] of Object.entries(plan)) for (const [item, level] of rows) {
  const routeKey = key(job, level, item);
  if (routeByKey.has(routeKey)) continue;
  const legacyRoute = legacy.routes.find(route => key(route.job, route.level, route.item) === routeKey);
  if (!legacyRoute) throw new Error(`未在本地资料库匹配系统${mode}方案：${routeKey}`);
  const paired = catalog.routes.find(route => route.job === job && route.item === item);
  const route = { ...legacyRoute, leveId: syntheticId--, itemId: legacyRoute.itemId || paired?.itemId || null, itemIcon: legacyRoute.itemIcon || paired?.itemIcon || null, garlandUrl: '', systemPlan: {}, isSystemRecommended: false };
  for (const [variant, map] of Object.entries(allowances)) if (map.has(routeKey)) route.systemPlan[variant] = map.get(routeKey);
  route.isSystemRecommended = Boolean(route.systemPlan.normal); route.routeAllowances = route.systemPlan.normal || route.systemPlan.double; route.routeQuantity = route.routeAllowances * Math.max(1, Number(route.submissionsPerAllowance || 1));
  catalog.routes.push(route); routeByKey.set(routeKey, route);
}
catalog.routes.sort((a, b) => catalog.jobs.indexOf(a.job) - catalog.jobs.indexOf(b.job) || a.level - b.level || a.leveId - b.leveId);
catalog.audit = { ...catalog.audit, imported: catalog.routes.length, systemRecommended: catalog.routes.filter(route => route.systemPlan?.normal).length, systemRecommendedDouble: catalog.routes.filter(route => route.systemPlan?.double).length, failures: [] };
await writeFile(resolve(root, 'levequest-catalog.js'), `// 自动生成：tools/apply-levequest-system-plan.mjs。\nwindow.FF14_LEVEQUEST_CATALOG=${JSON.stringify(catalog)};\n`, 'utf8');
console.log(`系统方案已应用：常规 ${catalog.audit.systemRecommended} 条，双倍 ${catalog.audit.systemRecommendedDouble} 条。`);
