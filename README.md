# ChatGPT Universal Exporter Plus

<img src="https://github.com/0-V-linuxdo/ChatGPT-Universal-Exporter-Plus/raw/refs/heads/release/userscript/icon.svg" alt="ChatGPT Universal Exporter Plus 图标" width="500">

一个用于 ChatGPT Web 的用户脚本，支持将对话导出为本地 ZIP，或同步到 Google Drive（逐条 JSON）。覆盖个人空间与团队空间，并支持按需筛选与选择导出。

## 功能概览
- 一键导出：支持“导出全部”或“自选对话”两种模式。
- 空间支持：个人空间 / 团队空间（自动识别 Workspace ID，必要时可手动输入）。
- 对话来源完整：Root（Active/Archived）+ Projects（项目）会一起纳入索引/导出。
- 选择与搜索：按标题/位置搜索，支持全选、可见项选择、清空。
- 本地 ZIP：对话保存为 JSON 并打包成 ZIP，方便备份与迁移。
- Google Drive 备份：按对话 JSON 同步到 Drive，避免重复上传。
- 轻量 UI：右下角悬浮导出按钮，导出过程有状态提示。
- 中英文自动切换：界面语言跟随浏览器语言。

## 安装
1. 安装用户脚本管理器：Tampermonkey / Violentmonkey 等。
2. 打开 `userscript/ChatGPT Universal Exporter Plus.user.js`，点击 Raw 后安装。
3. 访问 `https://chatgpt.com/` 或 `https://chat.openai.com/`，刷新页面即可看到导出按钮。

## 开发
`release` 分支只保留用户安装所需文件。ESM 开发源码、构建脚本和历史文件请查看 `dev` 分支。

## 使用方式
1. 打开 ChatGPT 页面，右下角会出现 `📥` 按钮。
2. 点击后选择备份目标（本地 `💾` 或 Drive `☁️`）。
3. 选择空间：
   - 个人空间：直接进入下一步。
   - 团队空间：自动列出检测到的 Workspace ID；若未检测到，可手动输入 `ws-...`。
4. 选择导出模式：
   - 导出全部：可勾选是否包含 Root Active / Root Archived。
   - 自选对话：支持搜索、全选、可见项选择、清空。

## 导出结果
### 本地 ZIP
- 默认文件名（无 File System Access API 时）：`[Personal]「2026-01-24」「13：17：16」.zip`
- ZIP 内容：
  - Root 对话：直接放在根目录。
  - Project 对话：按项目名称分文件夹。
  - 单条对话文件名示例：`标题｜YYYY-MM-DD HH-MM-SS.json`（会自动清理非法文件名字符）。

### Google Drive 备份
- 需要在“备份设置”中填写：
  - OAuth Client ID
  - Client Secret
  - Refresh Token
- 上传位置：
  - `ChatGPT Universal Exporter Plus/Personal` 或 `ChatGPT Universal Exporter Plus/<workspaceId>`
- 上传策略：
  - 逐条上传 JSON（非 ZIP）。
  - 以 `conversation_id` 去重；若发现同一对话存在不同更新时间，会弹窗确认是否覆盖。

## 注意事项
- 必须保持登录状态；脚本使用当前会话的访问令牌与 `oai-device-id`。
- ChatGPT 页面结构或接口变更可能导致脚本失效。
- 对话量大时导出耗时较长，请保持页面打开。
- Drive 功能仅在填写凭据后可用；凭据仅保存在浏览器本地存储。

## 目录说明
- `userscript/ChatGPT Universal Exporter Plus.user.js`：构建后的可安装用户脚本。
- `userscript/icon.svg`：用户脚本图标。

## 致谢
本脚本基于 `ChatGPT Universal Exporter`（作者：Me Alexrcer）二次开发。

## License
MIT
