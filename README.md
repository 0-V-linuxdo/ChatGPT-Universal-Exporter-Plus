<table>
  <tr>
    <td width="112" align="center">
      <img src="icon/01.svg" width="86" alt="ChatGPT Universal Exporter Plus icon">
    </td>
    <td>
      <h1>ChatGPT Universal Exporter Plus</h1>
    </td>
  </tr>
</table>

ChatGPT Universal Exporter Plus 是一个给 ChatGPT 网页版使用的用户脚本，用来把聊天记录备份到本地 ZIP，或同步到 Google Drive。它支持个人空间、团队 Workspace、归档聊天和 Projects，适合定期备份、迁移前留档，或把重要对话保存成可检索的 JSON 文件。

## 主要功能

| 功能 | 面向用户的效果 |
| --- | --- |
| 本地备份 | 把聊天记录保存为 JSON，并打包成 ZIP 下载到电脑。 |
| Google Drive 同步 | 把每条对话作为独立 JSON 上传到 Drive，并按对话 ID 去重更新。 |
| 自动增量同步 | 页面保持打开时，按任务定时把新增或更新过的对话同步到 Drive。 |
| 个人 / 团队空间 | 支持个人账号和 Team / Business Workspace，能自动识别 Workspace ID，也可以手动填写。 |
| 完整来源 | 支持根目录聊天、已归档聊天，以及 Projects 中的聊天。 |
| 灵活选择 | 可以导出全部，也可以按标题或位置搜索后只导出选中的聊天。 |
| 根目录筛选 | 导出全部或自动同步时，可单独选择 Active / Archived。 |
| 多账号隔离 | 自动同步任务按当前 ChatGPT 登录邮箱隔离保存。 |
| 多标签页保护 | 同一账号同时打开多个 ChatGPT 页面时，会尽量只让一个标签页执行同步任务。 |
| 中英文界面 | 跟随浏览器语言自动切换。 |

## 适用页面

| 页面 | 支持情况 |
| --- | --- |
| `https://chatgpt.com/*` | 支持 |
| `https://chat.openai.com/*` | 支持 |

脚本需要你已登录 ChatGPT。导出过程中请保持页面打开，不要频繁切换账号或 Workspace。它不是 OpenAI 官方工具，依赖 ChatGPT 网页内部接口；如果 ChatGPT 页面或接口调整，脚本可能需要更新后才能继续使用。

## 安装

1. 安装用户脚本管理器，例如 Tampermonkey 或 Violentmonkey。
2. 打开仓库里的 `ChatGPT Universal Exporter Plus.user.js`。
3. 在 GitHub 页面点击 `Raw`，脚本管理器会弹出安装确认。
4. 安装后打开或刷新 ChatGPT 页面，右下角会出现 `📥` 按钮。

## 快速使用

1. 打开 ChatGPT 页面，点击右下角 `📥`。
2. 在弹窗右上角打开备份设置，选择保存到本地文件或 Google Drive。
3. 选择要导出的空间：个人或团队。
4. 选择导出方式：
   - 导出全部：导出根目录、归档和 Projects，可按需关闭 Active 或 Archived。
   - 选择聊天记录：先加载列表，再搜索、全选、选中筛选结果或手动勾选。
5. 等待按钮和提示框显示进度。完成后会提示成功数量、失败数量和保存位置。

| 导出方式 | 适合场景 | 可选项 |
| --- | --- | --- |
| 导出全部 | 完整备份一个空间里的聊天记录。 | 可选择是否包含 Active / Archived 根目录聊天；Projects 会一起导出。 |
| 选择聊天记录 | 只备份部分重要对话。 | 支持搜索、全选、选中筛选结果、清空和手动勾选。 |

## 本地 ZIP

本地模式会生成一个 ZIP 文件。支持 File System Access API 的浏览器会先弹出保存位置选择；不支持时会直接触发浏览器下载。

| 项目 | 规则 |
| --- | --- |
| 根目录聊天 | 放在 ZIP 根目录。 |
| Project 聊天 | 放在对应项目名文件夹下。 |
| 单条聊天格式 | 格式化 JSON。 |
| 单条聊天文件名 | `标题｜YYYY-MM-DD HH-MM-SS.json`。 |
| ZIP 默认文件名 | 类似 `[Personal]「2026-05-10」「13：17：16」.zip` 或 `[ws-...]「日期」「时间」.zip`。 |

## Google Drive

Drive 模式需要先在备份设置中填写：

| 字段 | 用途 |
| --- | --- |
| Client ID | 用于向 Google OAuth 换取 Drive 访问令牌。 |
| Client Secret | 与 Client ID 配套使用。 |
| Refresh Token | 用于自动刷新 Drive 访问令牌。 |

手动导出到 Drive 时，脚本会把聊天逐条上传为 JSON，而不是上传一个 ZIP。

| 导出空间 | Drive 保存位置 |
| --- | --- |
| 个人空间 | `ChatGPT Universal Exporter Plus/Personal` |
| 团队 Workspace | `ChatGPT Universal Exporter Plus/<workspaceId>` |

| 同步策略 | 说明 |
| --- | --- |
| 对话 ID 去重 | 使用对话 ID 写入 Drive `appProperties`，再次同步同一对话时会更新原 JSON。 |
| 重复文件处理 | 如果 Drive 里同一对话有重复文件，会保留较新的主文件，并尝试清理重复项。 |
| 增量基线 | 只有成功上传或更新的对话会写入本地增量基线。 |

## Auto Sync

`Auto sync` 用于在 ChatGPT 页面打开时定时同步到 Google Drive。它适合长期开着一个 ChatGPT 标签页，让脚本自动备份最近变化的聊天。

| 任务配置 | 支持情况 |
| --- | --- |
| 同步范围 | 个人空间或团队 Workspace。 |
| 任务名称 | 可自定义；不填写时使用默认名称。 |
| 同步间隔 | 最短 5 分钟，默认 15 分钟。 |
| 根目录范围 | 可选择是否包含 Active / Archived。 |
| 任务操作 | 支持暂停、继续、立即执行、编辑和删除。 |

| 自动同步任务 | Drive 保存位置 |
| --- | --- |
| 个人空间任务 | `ChatGPT Universal Exporter Plus/Account_<email>/Personal` |
| 团队 Workspace 任务 | `ChatGPT Universal Exporter Plus/Account_<email>/Team_<workspaceId>` |

注意：自动同步不是云端后台服务。ChatGPT 页面关闭、电脑休眠、浏览器禁止脚本运行或 Drive 凭据失效时，任务不会继续执行。

## 团队 Workspace

团队空间导出前，脚本会尝试从 ChatGPT 会话、账号接口、页面数据、请求头和本地存储中识别可用 Workspace ID。

| Workspace 输入方式 | 说明 |
| --- | --- |
| 自动识别 | 从 ChatGPT 会话、账号接口、页面数据、请求头和本地存储中尝试识别。 |
| 手动输入 `ws-...` | 推荐在无法自动识别时使用。 |
| 手动输入 UUID | 脚本会尝试规范化为可用的 Workspace ID。 |

从团队导出流程返回时，脚本会尝试自动切回打开弹窗前的原始 Workspace，减少导出后页面空间错位。

## 数据与隐私

| 数据 | 用途 / 保存位置 |
| --- | --- |
| 聊天内容 | 来自当前登录态下 ChatGPT 网页接口，用于生成本地 ZIP 或 Drive JSON。 |
| Access Token 与 `oai-device-id` | 用于请求 ChatGPT 后端接口。 |
| Drive 凭据 | 保存在用户脚本存储中，用于访问你的 Google Drive。 |
| 导出选项、自动同步任务、增量记录 | 保存在用户脚本存储中，不上传到作者服务器。 |
| Drive 文件 | 上传到你填写凭据对应的 Google Drive。 |

## 常见问题

| 问题 | 处理方式 |
| --- | --- |
| 看不到 `📥` 按钮 | 刷新 ChatGPT 页面，确认用户脚本管理器已启用，并且当前网址是 `chatgpt.com` 或 `chat.openai.com`。 |
| 提示无法获取 Access Token | 先确认已登录 ChatGPT。可以打开任意一个聊天或刷新页面后重试。 |
| 提示无法获取 `oai-device-id` | 通常是登录态或 Cookie 异常。刷新页面、重新登录，或确认浏览器没有拦截 ChatGPT Cookie。 |
| 团队导出找不到 Workspace | 先打开一个团队空间里的聊天，再重新点击导出。如果仍然无法识别，在团队步骤里手动输入 Workspace ID。 |
| Drive 无法同步 | 检查 Client ID、Client Secret、Refresh Token 是否完整且有效。若提示 `invalid_grant`、`invalid_client` 或授权相关错误，自动同步任务会暂停，需要更新凭据后再继续。 |
| 导出很慢 | 脚本会分页读取列表，并在请求之间加入短暂等待，降低触发限流的概率。聊天数量很多、Projects 很多或网络不稳定时，请耐心等待并保持页面打开。 |

## 开发者说明

源码已拆分为 ESM，构建产物是可直接安装的用户脚本：

```bash
npm install
npm run build
npm run check
```

| 路径 | 说明 |
| --- | --- |
| `src/main.js` | 入口。 |
| `src/app.js` | 导出、Drive、自动同步和 UI 主逻辑。 |
| `src/config/` | 用户脚本头、常量和内置图标。 |
| `src/core/` | 存储、DOM ready、JSZip 适配。 |
| `src/export/` | ZIP 生成兼容处理。 |
| `src/ui/` | 样式。 |
| `scripts/build.mjs` | 使用 esbuild 生成 `ChatGPT Universal Exporter Plus.user.js`。 |
| `scripts/check.mjs` | 构建并检查源码和产物语法。 |

## 致谢

本脚本基于 `ChatGPT Universal Exporter`（作者：Me Alexrcer）二次开发。

## License

MIT
