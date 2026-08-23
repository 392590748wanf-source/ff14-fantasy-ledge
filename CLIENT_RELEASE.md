# 金蝶幻想 Windows 客户端发布

## 本地运行与构建

安装依赖后可运行：

```powershell
pnpm install
pnpm start
pnpm run dist:win
```

安装包会生成在 `release/` 目录，例如 `ff14-fantasy-ledge-setup-1.0.2.exe`。首版只构建 Windows x64 的 NSIS 安装程序；安装向导和桌面快捷方式仍显示“金蝶幻想”。

## 发布新版本

1. 修改 `package.json` 的 `version`，例如 `1.0.2`。
2. 本地执行 `pnpm run check` 和 `pnpm run dist:win`。
3. 提交并推送代码。
4. 创建并推送同名标签：`v1.0.2`。
5. GitHub Actions 会构建安装包并发布到仓库的 Releases 页面。

客户端启动后会在后台检查公开 GitHub Release；发现更新会下载并提示重启安装。

## 单独发布配方与材料资料

客户端程序和资料包使用不同版本。资料更新不需要修改 `package.json`、创建 `v1.0.x` 标签或重新安装客户端：

1. 修改配方、潜水艇、材料来源或雇员资料后，更新 `data/version.json` 的资料版本和发布时间。
2. 执行 `pnpm data:build` 生成 `data/data-bundle.json` 与 `data/manifest.json`。
3. 执行 `pnpm data:check`，提交资料文件并推送 `main`。
4. Cloudflare Pages 完成部署后，客户端用户在“数据与更新 → 资料版本 → 重新检测”中确认下载并重载。

资料包发布至 `https://ff14-fantasy-ledge.pages.dev/data/manifest.json`。资料更新只影响后续配方展示与成本预估，不会回写历史采购、制作或销售成本。

## 数据迁移与备份

网页与客户端的本地存储彼此独立。先在网页的“数据与更新”中导出 JSON，再在客户端的“数据与更新”中导入。客户端升级会保留用户目录中的账本数据；跨设备仍应通过 JSON 导出、导入迁移。

不要把导出的账本 JSON、GitHub Token 或任何密钥提交到公开仓库。
