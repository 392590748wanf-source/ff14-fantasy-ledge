#!/usr/bin/env node
// 从 nbb 工坊静态资料生成潜水艇部件与可达制作图。用法：
// node tools/sync-submarine-data.mjs --static-dir <nbb statics 解压目录>
import fs from 'node:fs';
import path from 'node:path';

const value = name => {
  const index = process.argv.indexOf(name);
  return index < 0 ? null : process.argv[index + 1];
};
const sourceDir = path.resolve(process.cwd(), value('--static-dir') || '.tmp-nbb-statics');
const output = path.resolve(process.cwd(), value('--output') || 'submarine-data.js');
const read = name => JSON.parse(fs.readFileSync(path.join(sourceDir, name), 'utf8'));
const items = read('item'), recipes = read('recipe_ja'), workshop = read('workshop'), hashes = read('workshopHash');
const partGroups = hashes.airship || {};
const parts = Object.entries(partGroups)
  .filter(([name]) => name.startsWith('潜水艇·'))
  .flatMap(([part, ids]) => ids.map(id => ({ id: Number(id), part: part.slice(4), n: items[id]?.lang?.[2] || `未知部件 ${id}` })));
const byName = new Map(parts.map(part => [part.n, part.id]));
const recipeByOutput = new Map();
Object.values(recipes).forEach(recipe => {
  const id = String(recipe.it);
  recipeByOutput.set(id, [...(recipeByOutput.get(id) || []), recipe]);
});
const graph = {}, names = {}, visited = new Set();
const addName = id => { if (items[id]?.lang?.[2]) names[id] = items[id].lang[2]; };
const pairs = list => Array.from({ length: Math.floor((list || []).length / 2) }, (_, index) => [Number(list[index * 2]), Number(list[index * 2 + 1])])
  .filter(([id, quantity]) => Number.isInteger(id) && id > 0 && Number.isFinite(quantity) && quantity > 0);
const addNode = (id, inheritedJob = null) => {
  id = Number(id); if (visited.has(id)) return; visited.add(id); addName(id);
  const partName = items[id]?.lang?.[2] || '';
  const skeletonTarget = partName.endsWith('骨架') ? byName.get(partName.slice(0, -2)) : null;
  const candidates = recipeByOutput.get(String(id)) || [];
  const recipe = candidates.find(item => Number(item.job) === Number(inheritedJob)) || candidates[0];
  const direct = workshop[id]?.map(row => [Number(row[0]), Number(row[1])]) || (skeletonTarget ? [[skeletonTarget, 1]] : null);
  if (!recipe && !direct) return;
  const nodes = direct ? [{ id: `workshop-${id}`, j: 0, y: 1, a: direct.flat() }]
    : candidates.map(item => ({ id: item.id, j: item.job, y: Number(item.bp?.[1] || 1), a: [...pairs(item.m), ...pairs(item.s)].flat() }));
  graph[id] = nodes;
  nodes.forEach(node => pairs(node.a).forEach(([child]) => addNode(child, node.j)));
};
parts.forEach(part => addNode(part.id));
const roots = new Set(parts.map(part => part.id));
const leaves = Object.keys(names).map(Number).filter(id => !graph[id] && !roots.has(id));
const payload = { v: 1, parts, g: graph, n: names, leaves };
fs.writeFileSync(output, `window.FF14_SUBMARINE_DATA = ${JSON.stringify(payload)};\n`, 'utf8');
console.log(`generated ${parts.length} parts, ${Object.keys(graph).length} recipe nodes, ${leaves.length} leaves`);
