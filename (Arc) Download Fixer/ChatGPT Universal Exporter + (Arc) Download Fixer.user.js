// ==UserScript==
// @name         ChatGPT Universal Exporter - (Arc) Download Fixer
// @namespace    https://github.com/0-V-linuxdo/Fix-ChatGPT-Universal-Exporter-
// @version      8.2.0
// @description  Work around Arc download hang by asking for a save location up front and writing the ZIP via the File System Access API before showing the success alert.
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
   • 兼容 Arc 浏览器：阻止 ZIP 下载卡住，提前弹出保存对话框并直接写入文件。
   • 不改动原脚本：仅拦截下载流程与 alert 时机，确保“先选目录，后提示成功”。
   • 失败提示友好：写入失败会提示原因，避免误以为已导出。
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

    async function promptFileHandle(defaultName) {
        if (!window.showSaveFilePicker) return null;
        return window.showSaveFilePicker({
            suggestedName: defaultName || 'chatgpt_export.zip',
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

    async function saveBlob(blob, filename) {
        if (!blob) throw new Error('Missing blob for export file');
        let handle = chosenHandle;
        if (!handle && window.showSaveFilePicker) {
            handle = await promptFileHandle(filename);
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
        const filename = this.download || 'chatgpt_export.zip';
        const blob = blobStore.get(href);
        pendingDownloadError = null;

        const writeTask = (async () => {
            try {
                const data = blob || await fetch(href).then(r => r.blob());
                await saveBlob(data, filename);
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
                const handle = await promptFileHandle();
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
