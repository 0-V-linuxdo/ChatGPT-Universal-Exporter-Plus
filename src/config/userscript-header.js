export const USERSCRIPT_HEADER = `// ==UserScript==
// @name         ChatGPT Universal Exporter Plus [20260511] v1.0.0
// @namespace    https://github.com/0-V-linuxdo/ChatGPT-Universal-Exporter-Plus
// @version      [20260511] v1.0.0
// @update-log   [20260511] v1.0.0 迁移开发源码为 ESM，新增 esbuild 构建与检查流程，生成产物继续兼容用户脚本管理器。
// @description  导出 ChatGPT 对话到本地 ZIP 或 Google Drive，支持个人/团队空间、自选会话、根目录筛选和 Drive 自动增量同步。
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @connect      oauth2.googleapis.com
// @connect      www.googleapis.com
// @run-at       document-idle
// @license      MIT
// @icon         https://github.com/0-V-linuxdo/ChatGPT-Universal-Exporter-Plus/raw/refs/heads/main/icon/icon.svg
// ==/UserScript==`;

export const FORK_NOTICE = `// ================================================
// Fork Notice:
// Name:     ChatGPT Universal Exporter
// Authors:  Me Alexrcer
// Link:     https://greasyfork.org/scripts/538495
// Version:  8.2.0
// ================================================`;

export const USERSCRIPT_BANNER = `${USERSCRIPT_HEADER}

${FORK_NOTICE}`;
