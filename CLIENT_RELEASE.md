# 金蝶幻想 Windows 客户端发布

## 本地运行与构建

安装依赖后可运行：

```powershell
pnpm install
pnpm start
pnpm run dist:win
```

安装包会生成在 `release/` 目录。首版只构建 Windows x64 的 NSIS 安装程序。

## 发布新版本

1. 修改 `package.json` 的 `version`，例如 `1.0.1`。
2. 本地执行 `pnpm run check` 和 `pnpm run dist:win`。
3. 提交并推送代码。
4. 创建并推送同名标签：`v1.0.1`。
5. GitHub Actions 会构建安装包并发布到仓库的 Releases 页面。

客户端启动后会在后台检查公开 GitHub Release；发现更新会下载并提示重启安装。

## 数据迁移与备份

网页与客户端的本地存储彼此独立。先在网页的“数据备份”中导出 JSON，再在客户端的“数据备份”中导入。客户端升级会保留用户目录中的账本数据；跨设备仍应通过 JSON 导出、导入迁移。

不要把导出的账本 JSON、GitHub Token 或任何密钥提交到公开仓库。
