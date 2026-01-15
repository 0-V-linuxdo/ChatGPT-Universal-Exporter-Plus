// ==UserScript==
// @name         [ChatGPT Universal Exporter] + (Arc) Download Fixer [20260115] v1.0.0
// @namespace    https://github.com/0-V-linuxdo/ChatGPT-Universal-Exporter-Plus
// @version      [20260115] v1.0.0
// @update-log   [20260115] v1.0.0 默认保存名改为 [Team]「YYYY-MM-DD」「HH：mm：ss」并在 Arc 预先提示保存；
// @description  Arc 浏览器下载修复：预先提示保存位置并用文件系统 API 直接写入 ZIP，避免导出卡住后才弹框。
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        none
// @license      MIT
// @orginal      https://greasyfork.org/zh-CN/scripts/538495-chatgpt-universal-exporter
// ==/UserScript==

/* ============================================================
   Arc 下载修复说明
   ------------------------------------------------------------
   • 兼容 Arc 浏览器：提前弹出保存对话框并用文件系统 API 直接写 ZIP，避免下载卡住。
   • 默认命名格式：[Team]「YYYY-MM-DD」「HH：mm：ss」.zip，Team 会根据个人/团队上下文自动推断。
   • 不改动主导出逻辑：仅拦截下载与 alert 顺序，确保“先选目录写入完成，再提示成功”。
   • 写入失败会提示原因，避免误以为已导出。
   ============================================================ */

(function () {
    'use strict';

    if (window.__cgueArcFixApplied) return;
    window.__cgueArcFixApplied = true;

    const originalClick = HTMLAnchorElement.prototype.click;
    const originalAlert = window.alert;
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    const blobStore = new Map();
    let pendingDownload = null;
    let pendingDownloadError = null;
    let chosenHandle = null;
    const pad2 = (num) => String(num).padStart(2, '0');
    const sanitizeLabel = (label) => {
        const cleaned = (label || '').replace(/[\\/:*?"<>|]/g, '-').trim();
        return cleaned || 'Team';
    };
    const buildDefaultZipName = (label) => {
        const now = new Date();
        const datePart = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
        const timePart = `${pad2(now.getHours())}：${pad2(now.getMinutes())}：${pad2(now.getSeconds())}`;
        return `[${sanitizeLabel(label)}]「${datePart}」「${timePart}」.zip`;
    };
    const inferLabelFromName = (rawName) => {
        if (!rawName) return null;
        if (/personal/i.test(rawName)) return 'Personal';
        const teamMatch = rawName.match(/chatgpt_team_backup_([^_]+)_/i);
        if (teamMatch?.[1]) return teamMatch[1];
        const wsMatch = rawName.match(/ws-[0-9a-z-]+/i);
        if (wsMatch?.[0]) return wsMatch[0];
        return null;
    };
    const deriveTeamLabelFromDialog = () => {
        const radioChecked = document.querySelector('input[name="workspace_id"]:checked');
        const codeEl = document.getElementById('workspace-id-code');
        const inputEl = document.getElementById('team-id-input');
        const raw = radioChecked?.value || codeEl?.textContent || (inputEl?.value || '').trim();
        return sanitizeLabel(raw || 'Team');
    };

    URL.createObjectURL = function (blob) {
        const url = originalCreateObjectURL.call(URL, blob);
        blobStore.set(url, blob);
        return url;
    };

    URL.revokeObjectURL = function (url) {
        if (blobStore.has(url)) {
            if (!pendingDownload) {
                blobStore.delete(url);
                return originalRevokeObjectURL.call(URL, url);
            }
            pendingDownload.finally(() => {
                blobStore.delete(url);
                originalRevokeObjectURL.call(URL, url);
            });
            return;
        }
        return originalRevokeObjectURL.call(URL, url);
    };

    function shouldHandle(anchor) {
        if (!anchor) return false;
        const href = anchor.getAttribute('href') || '';
        const name = (anchor.getAttribute('download') || '').toLowerCase();
        return href.startsWith('blob:') && name.endsWith('.zip');
    }

    async function promptFileHandle(defaultName, teamLabel) {
        if (!window.showSaveFilePicker) return null;
        const suggestedName = defaultName || buildDefaultZipName(teamLabel);
        return window.showSaveFilePicker({
            suggestedName,
            types: [
                {
                    description: 'ZIP archive',
                    accept: {
                        'application/zip': ['.zip'],
                        'application/octet-stream': ['.zip']
                    }
                }
            ]
        });
    }

    async function saveBlob(blob, filename, teamLabel) {
        if (!blob) throw new Error('Missing blob for export file');
        let handle = chosenHandle;
        if (!handle && window.showSaveFilePicker) {
            handle = await promptFileHandle(filename, teamLabel);
        }
        if (!handle || !handle.createWritable) {
            throw new Error('未选择保存位置，无法写入文件');
        }
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        chosenHandle = null; // next export will ask again
    }

    HTMLAnchorElement.prototype.click = function (...args) {
        if (!shouldHandle(this)) {
            return originalClick.apply(this, args);
        }

        const href = this.href;
        const label = inferLabelFromName(this.download) || 'Team';
        const filename = buildDefaultZipName(label);
        const blob = blobStore.get(href);
        pendingDownloadError = null;

        const writeTask = (async () => {
            try {
                const data = blob || await fetch(href).then(r => r.blob());
                await saveBlob(data, filename, label);
            } catch (err) {
                pendingDownloadError = err;
                throw err;
            }
        })();

        pendingDownload = writeTask.finally(() => {
            pendingDownload = null;
            blobStore.delete(href);
        });

        return; // suppress native download
    };

    window.alert = async function (message, ...rest) {
        if (pendingDownload) {
            try {
                await pendingDownload;
            } catch (_) {}
        }
        if (pendingDownloadError && /导出完成|export/i.test(String(message))) {
            const errMsg = pendingDownloadError && pendingDownloadError.message ? pendingDownloadError.message : '未知错误';
            pendingDownloadError = null;
            return originalAlert.call(window, '文件未成功保存：' + errMsg);
        }
        return originalAlert.call(window, message, ...rest);
    };

    // Intercept export start buttons to request the save location while a user gesture still exists.
    document.addEventListener('click', (event) => {
        const btn = event.target.closest('#select-personal-btn, #start-team-export-btn');
        if (!btn) return;
        if (btn.dataset.cgueArcPrompted === '1') return;
        if (!window.showSaveFilePicker) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        (async () => {
            try {
                const label = btn.id === 'start-team-export-btn' ? deriveTeamLabelFromDialog() : 'Personal';
                const suggestedName = buildDefaultZipName(label);
                const handle = await promptFileHandle(suggestedName, label);
                if (!handle) return;
                chosenHandle = handle;
                btn.dataset.cgueArcPrompted = '1';
                if (typeof btn.onclick === 'function') {
                    btn.onclick.call(btn, event);
                }
            } catch (err) {
                chosenHandle = null;
                console.warn('[CGUE Arc Fix] 保存位置选择被取消或失败:', err);
                originalAlert.call(window, '已取消保存位置选择，未开始导出。');
            } finally {
                delete btn.dataset.cgueArcPrompted;
            }
        })();
    }, true);

})();
