import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = join(root, 'data');
const bundlePath = join(outputDirectory, 'data-bundle.json');
const manifestPath = join(outputDirectory, 'manifest.json');
const versionPath = join(outputDirectory, 'version.json');
const checkOnly = process.argv.includes('--check');

const readSource = file => readFile(join(root, file), 'utf8');
const createSandbox = () => {
  const window = {};
  const sandbox = {
    window,
    JSON,
    Uint8Array,
    TextDecoder,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    localStorage: { getItem: () => null, setItem: () => {} }
  };
  vm.createContext(sandbox);
  return sandbox;
};

const execute = async (sandbox, file) => vm.runInContext(await readSource(file), sandbox, { filename: file });
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = value => createHash('sha256').update(value).digest('hex');

const version = JSON.parse(await readFile(versionPath, 'utf8'));
if (!version.version || !version.publishedAt) throw new Error('data/version.json 必须包含 version 与 publishedAt。');

const presetSandbox = createSandbox();
await execute(presetSandbox, 'nbb-preset.js');
if (!presetSandbox.nbbData) throw new Error('无法读取 nbb-preset.js 中的内置装备数据。');

const sandbox = createSandbox();
for (const file of ['base-materials.js', 'submarine-data.js', 'hqhelper-fallback.js', 'retainer-data.js', 'material-sources.js']) {
  await execute(sandbox, file);
}

const bundle = {
  schema: 1,
  version: version.version,
  publishedAt: version.publishedAt,
  datasets: {
    nbbPreset: presetSandbox.nbbData,
    baseMaterials: sandbox.window.FF14_BASE_MATERIALS,
    submarineData: sandbox.window.FF14_SUBMARINE_DATA,
    hqHelperFallback: sandbox.window.FF14_HQHELPER_FALLBACK,
    retainerData: sandbox.window.FF14_RETAINER_DATA,
    materialSources: sandbox.window.FF14_MATERIAL_SOURCES,
    exchangeSources: sandbox.window.FF14_EXCHANGE_SOURCES
  }
};
const bundleText = json(bundle);
const manifest = {
  schema: 1,
  version: version.version,
  publishedAt: version.publishedAt,
  bundle: {
    path: 'data/data-bundle.json',
    sha256: sha256(bundleText),
    bytes: Buffer.byteLength(bundleText)
  }
};
const manifestText = json(manifest);

if (checkOnly) {
  const [existingBundle, existingManifest] = await Promise.all([readFile(bundlePath, 'utf8'), readFile(manifestPath, 'utf8')]);
  if (existingBundle !== bundleText || existingManifest !== manifestText) throw new Error('数据包已过期，请运行 pnpm data:build 后提交 data 目录。');
  console.log(`数据包校验通过：${version.version}`);
} else {
  await mkdir(dirname(bundlePath), { recursive: true });
  await Promise.all([writeFile(bundlePath, bundleText, 'utf8'), writeFile(manifestPath, manifestText, 'utf8')]);
  console.log(`已生成数据包：${version.version}`);
}
