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

ChatGPT 网页导出脚本。支持本地 ZIP、Google Drive、个人空间、团队 Workspace、归档聊天、Projects 和自动增量同步。

## 功能

| 功能 | 说明 |
| --- | --- |
| 本地 ZIP | 对话保存为 JSON，并打包下载。 |
| Drive 同步 | 逐条上传 JSON，按对话 ID 更新。 |
| Auto Sync | 页面打开时定时增量同步到 Drive。 |
| 空间 | 支持个人、Team / Business Workspace。 |
| 范围 | Root Active、Root Archived、Projects。 |
| 选择 | 支持全量导出、搜索、勾选、全选可见项。 |
| 语言 | 跟随浏览器中英文。 |

## 安装

1. 安装 Tampermonkey 或 Violentmonkey。
2. 打开 `ChatGPT Universal Exporter Plus.user.js`。
3. 点击 `Raw` 安装。
4. 刷新 `chatgpt.com` 或 `chat.openai.com`，右下角出现 `📥`。

## 使用

1. 点击右下角 `📥`。
2. 选择本地文件或 Google Drive。
3. 选择个人空间或团队 Workspace。
4. 选择“导出全部”或“选择聊天记录”。
5. 等待完成提示。

| 模式 | 适合 |
| --- | --- |
| 导出全部 | 完整备份当前空间。 |
| 选择聊天记录 | 只备份部分对话。 |
| Auto Sync | 页面常开时定期备份到 Drive。 |

## 导出结果

| 目标 | 输出 |
| --- | --- |
| 本地 ZIP | Root 对话在根目录；Project 对话在项目文件夹。 |
| 单条文件 | `标题｜YYYY-MM-DD HH-MM-SS.json` |
| Drive 手动导出 | `ChatGPT Universal Exporter Plus/Personal` 或 `ChatGPT Universal Exporter Plus/<workspaceId>` |
| Drive 自动同步 | `ChatGPT Universal Exporter Plus/Account_<email>/Personal` 或 `.../Team_<workspaceId>` |

## Google Drive

需要在备份设置中填写：

| 字段 | 说明 |
| --- | --- |
| Client ID | Google OAuth Client ID。 |
| Client Secret | Google OAuth Client Secret。 |
| Refresh Token | 用于刷新 Drive 访问令牌。 |

同步规则：

- 上传 JSON，不上传 ZIP。
- 用对话 ID 去重；已存在则更新。
- 发现重复文件时保留较新文件，并尝试清理重复项。
- 只有成功同步的对话会写入增量记录。

## Auto Sync

| 配置 | 默认 / 限制 |
| --- | --- |
| 同步范围 | 个人或团队 Workspace。 |
| 间隔 | 默认 15 分钟，最短 5 分钟。 |
| 根目录 | 可选 Active / Archived。 |
| 操作 | 暂停、继续、立即执行、编辑、删除。 |

Auto Sync 不是后台服务。页面关闭、电脑休眠、浏览器禁用脚本或 Drive 凭据失效时不会继续运行。

## 团队 Workspace

脚本会自动识别 Workspace ID；识别失败时手动输入 `ws-...` 或 UUID。返回上一步时会尝试切回打开弹窗前的 Workspace。

## 注意

- 必须保持 ChatGPT 登录。
- 脚本依赖 ChatGPT 网页内部接口；页面或接口变更可能导致失效。
- 导出量大时请保持页面打开。
- Drive 凭据、导出选项、任务和增量记录保存在用户脚本存储中。
- 本脚本不是 OpenAI 官方工具。

## 常见问题

| 问题 | 处理 |
| --- | --- |
| 看不到 `📥` | 确认脚本管理器已启用，并刷新 ChatGPT 页面。 |
| 无法获取 Access Token | 确认已登录，打开任意对话后重试。 |
| 无法获取 `oai-device-id` | 重新登录或检查 Cookie 是否被拦截。 |
| 找不到团队 Workspace | 先打开团队对话，或手动输入 Workspace ID。 |
| Drive 同步失败 | 检查 Client ID、Client Secret、Refresh Token。 |

## 开发

```bash
npm install
npm run build
npm run check
```

| 路径 | 说明 |
| --- | --- |
| `src/app.js` | 主逻辑。 |
| `src/config/` | 用户脚本头、常量、图标。 |
| `src/core/` | 存储、DOM ready、JSZip 适配。 |
| `src/export/` | ZIP 生成。 |
| `src/ui/` | 样式。 |
| `scripts/` | 构建与检查。 |

## 致谢

基于 `ChatGPT Universal Exporter`（Me Alexrcer）二次开发。

## License

MIT
