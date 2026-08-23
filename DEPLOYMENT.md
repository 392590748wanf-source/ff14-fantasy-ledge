# LogFate 正式站与测试站部署

## 分支和站点

| 用途 | Git 分支 | Cloudflare Pages 地址 |
| --- | --- | --- |
| 测试 | `develop` | `https://ff14-fantasy-ledge.pages.dev/` |
| 正式 | `main` | `https://logfate.com/` |

测试站与正式站使用不同 Pages 项目。`develop` 的变更不会自动进入正式站；确认测试后，将变更合并到 `main` 才会发布正式版本。

## 一次性外部配置

1. 在阿里云注册 `logfate.com`，并将域名 DNS 服务器改为 Cloudflare 提供的两条名称服务器。
2. 在 Cloudflare 添加 `logfate.com` 站点，等待名称服务器生效。
3. GitHub 将仓库改名为 `logfate`。GitHub 会为旧仓库链接提供重定向，但请同步检查 Cloudflare 与 Actions 权限。
4. 在 Cloudflare Pages 中：
   - 将现有 `ff14-fantasy-ledge` 项目的生产分支改为 `develop`，作为测试站；
   - 创建新的 Pages 项目，连接 `392590748wanf-source/logfate`，生产分支选择 `main`；
   - 为新项目添加自定义域 `logfate.com`，并将 `www.logfate.com` 重定向到根域名。
5. 在 GitHub 仓库 Settings → Actions → General 中确认 Workflow permissions 为 **Read and write permissions**，以便工作流创建 Release。

## 发布规则

- **仅资料更新**：修改资料后生成 `data` 文件，提交并推送 `main`；Cloudflare 自动部署，客户端在“数据与更新”中检测与应用资料。
- **网页功能更新**：提交并推送 `develop` 测试；确认后合并并推送 `main`。
- **客户端更新**：修改 `package.json` 版本号，提交并推送 `main`，再创建同版本标签（如 `v1.1.0`）。GitHub Actions 生成 Windows 安装包和 Release。

## 兼容性

- `appId` 保持 `com.ff14.fantasy.ledger`，不可随品牌改动，避免已安装客户端变成全新应用或丢失数据目录。
- 本地存储键与备份格式继续兼容旧版；仅导出文件名和界面名称改为 LogFate。
- 首个正式品牌发布为 `v1.1.0`。旧版无法通过 GitHub 重定向自动发现更新时，可下载新的安装包覆盖安装，账本数据仍会保留。
