// ==UserScript==
// @name         [ChatGPT Universal Exporter] + UI Optimizer [20260116] v1.0.0
// @namespace    https://github.com/0-V-linuxdo/ChatGPT-Universal-Exporter-Plus
// @version      [20260116] v1.0.0
// @update-log   [20260116] v1.0.0 导出 UI 语言随浏览器主语言自动切换中英文；弹窗与按钮文案统一本地化，主题样式保持轻量一致。
// @description  优化导出按钮与弹窗 UI：紧凑按钮、主题联动、自动中英文界面；不改动导出逻辑。
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// @run-at       document-idle
// @orginal      https://greasyfork.org/zh-CN/scripts/538495-chatgpt-universal-exporter
// @license      MIT
// ==/UserScript==

/* ============================================================
   UI Optimizer 说明
   ------------------------------------------------------------
   • 语言自适应：以浏览器主语言为准，中文显示中文，否则自动切换英文。
   • 浮窗按钮：保留 📥 图标的小尺寸块，延续阴影与圆角手感。
   • 主题联动：随系统亮/暗切换，按钮与弹窗同步调色，确保对比清晰。
   • 弹窗细节：卡片/输入/按钮统一边框与文案色，提示块色彩更克制。
   • 行为保持：不改导出流程，仅做 UI 微调与文案本地化。
   • 自动修复：监听 DOM 变化，按钮或弹窗重建时补回样式与文案。
   ============================================================ */

   (function () {
    'use strict';

    // Prevent double-apply if the helper is injected twice
    if (window.__cgueCompactHelperApplied) return;
    window.__cgueCompactHelperApplied = true;

    const TARGET_ID = 'gpt-rescue-btn';
    const DIALOG_OVERLAY_ID = 'export-dialog-overlay';
    const DIALOG_ID = 'export-dialog';
    const ICON_LABEL = '📥';
    const UI_TEXT = {
        en: { exportLabel: 'Export Conversations' },
        zh: { exportLabel: '导出对话' }
    };
    const darkMatcher = window.matchMedia?.('(prefers-color-scheme: dark)');
    const getPrimaryLanguage = () => {
        if (typeof navigator !== 'undefined') {
            if (Array.isArray(navigator.languages)) {
                const primary = navigator.languages.find((lang) => typeof lang === 'string' && lang.trim());
                if (primary) return primary;
            }
            if (typeof navigator.language === 'string' && navigator.language.trim()) return navigator.language;
            if (typeof navigator.userLanguage === 'string' && navigator.userLanguage.trim()) return navigator.userLanguage;
        }
        const docLang = document.documentElement?.lang;
        if (typeof docLang === 'string' && docLang.trim()) return docLang;
        return '';
    };
    const isChineseLocale = () => {
        const primary = getPrimaryLanguage();
        return typeof primary === 'string' && primary.toLowerCase().startsWith('zh');
    };
    const activeLocale = isChineseLocale() ? 'zh' : 'en';
    const uiText = UI_TEXT[activeLocale];
    const LOCALE_RULES = {
        en: {
            exact: {
                '导出对话': 'Export Conversations',
                '选择要导出的空间': 'Choose what to export',
                '个人空间': 'Personal space',
                '导出您个人账户下的所有对话。': 'Export all conversations under your personal account.',
                '团队空间': 'Team space',
                '导出团队空间下的对话，将自动检测ID。': 'Export conversations in a team workspace; ID will be detected automatically.',
                '取消': 'Cancel',
                '导出团队空间': 'Export Team Workspace',
                '🔎 检测到多个 Workspace，请选择一个:': '🔎 Multiple workspaces detected. Please choose one:',
                '✅ 已自动检测到 Workspace ID:': '✅ Workspace ID detected automatically:',
                '⚠️ 未能自动检测到 Workspace ID。': '⚠️ Unable to detect a Workspace ID.',
                '请尝试刷新页面或打开一个团队对话，或在下方手动输入。': 'Try refreshing the page or opening a team conversation, or enter it manually below.',
                '手动输入 Team Workspace ID:': 'Enter Team Workspace ID manually:',
                '粘贴您的 Workspace ID (ws-...)': 'Paste your Workspace ID (ws-...)',
                '返回': 'Back',
                '开始导出 (ZIP)': 'Start Export (ZIP)',
                '📂 获取项目外对话…': '📂 Fetching conversations outside projects…',
                '🔍 获取项目列表…': '🔍 Fetching project list…',
                '📦 生成 ZIP 文件…': '📦 Creating ZIP file…',
                '✅ 完成': '✅ Done',
                '✅ 导出完成！': '✅ Export complete!',
                '无法获取 Access Token。请刷新页面或打开任意一个对话后再试。': 'Unable to get Access Token. Please refresh the page or open any conversation and try again.',
                '请选择或输入一个有效的 Team Workspace ID！': 'Please choose or enter a valid Team Workspace ID!',
                '⚠️ 错误': '⚠️ Error'
            },
            patterns: [
                { re: /^📥 根目录 \((\d+)\/(\d+)\)$/, replace: '📥 Root ($1/$2)' },
                { re: /^📂 项目: (.+)$/, replace: '📂 Project: $1' },
                { re: /^导出失败:\s*(.+)。详情请查看控制台（F12 -> Console）。$/, replace: 'Export failed: $1. Please check the console (F12 -> Console) for details.' }
            ]
        },
        zh: {
            exact: {
                'Export Conversations': '导出对话',
                'Choose what to export': '选择要导出的空间',
                'Personal space': '个人空间',
                'Export all conversations under your personal account.': '导出您个人账户下的所有对话。',
                'Team space': '团队空间',
                'Export conversations in a team workspace; ID will be detected automatically.': '导出团队空间下的对话，将自动检测ID。',
                'Cancel': '取消',
                'Export Team Workspace': '导出团队空间',
                '🔎 Multiple workspaces detected. Please choose one:': '🔎 检测到多个 Workspace，请选择一个:',
                '✅ Workspace ID detected automatically:': '✅ 已自动检测到 Workspace ID:',
                '⚠️ Unable to detect a Workspace ID.': '⚠️ 未能自动检测到 Workspace ID。',
                'Try refreshing the page or opening a team conversation, or enter it manually below.': '请尝试刷新页面或打开一个团队对话，或在下方手动输入。',
                'Enter Team Workspace ID manually:': '手动输入 Team Workspace ID:',
                'Paste your Workspace ID (ws-...)': '粘贴您的 Workspace ID (ws-...)',
                'Back': '返回',
                'Start Export (ZIP)': '开始导出 (ZIP)',
                '📂 Fetching conversations outside projects…': '📂 获取项目外对话…',
                '🔍 Fetching project list…': '🔍 获取项目列表…',
                '📦 Creating ZIP file…': '📦 生成 ZIP 文件…',
                '✅ Done': '✅ 完成',
                '✅ Export complete!': '✅ 导出完成！',
                'Unable to get Access Token. Please refresh the page or open any conversation and try again.': '无法获取 Access Token。请刷新页面或打开任意一个对话后再试。',
                'Please choose or enter a valid Team Workspace ID!': '请选择或输入一个有效的 Team Workspace ID！',
                '⚠️ Error': '⚠️ 错误'
            },
            patterns: [
                { re: /^📥 Root \((\d+)\/(\d+)\)$/, replace: '📥 根目录 ($1/$2)' },
                { re: /^📂 Project: (.+)$/, replace: '📂 项目: $1' },
                { re: /^Export failed:\s*(.+)\. Please check the console \(F12 -> Console\) for details\.$/, replace: '导出失败: $1。详情请查看控制台（F12 -> Console）。' }
            ]
        }
    };
    const translateText = (value) => {
        if (typeof value !== 'string') return value;
        const rules = LOCALE_RULES[activeLocale];
        if (!rules) return value;
        const trimmed = value.trim();
        if (!trimmed) return value;
        const exact = rules.exact[trimmed];
        if (exact) return value.replace(trimmed, exact);
        for (const { re, replace } of rules.patterns) {
            if (re.test(trimmed)) {
                const updated = trimmed.replace(re, replace);
                return value.replace(trimmed, updated);
            }
        }
        return value;
    };
    const localizeDialogText = (dialog) => {
        if (!dialog || !window.NodeFilter) return;
        const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
            const updated = translateText(node.nodeValue);
            if (updated !== node.nodeValue) node.nodeValue = updated;
        });
        const manualInput = dialog.querySelector('#team-id-input');
        if (manualInput?.placeholder) {
            const placeholder = translateText(manualInput.placeholder);
            if (placeholder !== manualInput.placeholder) manualInput.placeholder = placeholder;
        }
    };
    const localizeButtonText = (btn) => {
        if (!btn) return;
        const updated = translateText(btn.textContent || '');
        if (updated !== btn.textContent) btn.textContent = updated;
    };
    const setupAlertLocalization = () => {
        if (window.__cgueAlertLocalized) return;
        window.__cgueAlertLocalized = true;
        const originalAlert = window.alert;
        window.alert = function (message, ...rest) {
            const localized = translateText(message);
            return originalAlert.call(this, localized, ...rest);
        };
    };
    setupAlertLocalization();
    const dialogThemes = {
        light: {
            name: 'light',
            overlay: 'rgba(0, 0, 0, 0.45)',
            surface: '#ffffff',
            text: '#0f172a',
            muted: '#475569',
            border: '#d7dbdf',
            card: '#f8fafc',
            cardBorder: '#e2e8f0',
            primary: '#10a37f',
            onPrimary: '#ffffff',
            primaryShadow: '0 6px 18px rgba(16, 163, 127, 0.28)',
            ghost: '#ffffff',
            codeBg: '#e0e7ff',
            codeText: '#4338ca',
            inputBg: '#ffffff',
            inputBorder: '#cbd5e1',
            callout: '#f8fafc',
            callouts: {
                info: { bg: '#eef2ff', border: '#818cf8', text: '#4338ca' },
                success: { bg: '#f0fdf4', border: '#4ade80', text: '#166534' },
                warning: { bg: '#fffbeb', border: '#facc15', text: '#92400e' }
            }
        },
        dark: {
            name: 'dark',
            overlay: 'rgba(0, 0, 0, 0.45)',
            surface: '#161616',
            text: '#e6e6e8',
            muted: '#cfcfd4',
            border: '#252528',
            card: '#1b1b1f',
            cardBorder: '#252528',
            primary: '#10b981',
            onPrimary: '#ecfdf3',
            primaryShadow: '0 6px 18px rgba(16, 185, 129, 0.32)',
            ghost: '#161616',
            codeBg: '#1d1d22',
            codeText: '#e6e6e8',
            inputBg: '#1a1a1e',
            inputBorder: '#2c2c31',
            callout: '#1e1e23',
            callouts: {
                info: { bg: '#1f2024', border: '#2c2d33', text: '#e6e6eb' },
                success: { bg: '#1f2021', border: '#2c2f2d', text: '#e6e8e3' },
                warning: { bg: '#23211b', border: '#3a3325', text: '#f0e2c3' }
            }
        }
    };

    // Apply a smaller footprint to the exporter button only
    function applyCompactStyle(btn) {
        if (!btn || btn.dataset.cgueCompactApplied === '1') return;
        btn.dataset.cgueCompactApplied = '1';
        Object.assign(btn.style, {
            padding: '6px 10px',
            fontSize: '12px',
            borderRadius: '6px',
            bottom: '16px',
            right: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,.12)'
        });
        applyTheme(btn);
        setIconIfIdle(btn);
        attachButtonObserver(btn);
    }

    function applyTheme(btn) {
        if (!btn) return;
        const isDark = !!darkMatcher?.matches;
        btn.style.background = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.65)';
        btn.style.color = isDark ? '#f8fafc' : '#0f172a';
    }

    function currentDialogPalette() {
        return darkMatcher?.matches ? dialogThemes.dark : dialogThemes.light;
    }

    function applyDialogTheme() {
        const overlay = document.getElementById(DIALOG_OVERLAY_ID);
        const dialog = document.getElementById(DIALOG_ID);
        if (!overlay || !dialog) return;

        const palette = currentDialogPalette();
        overlay.style.backgroundColor = palette.overlay;
        Object.assign(dialog.style, {
            background: palette.surface,
            color: palette.text,
            boxShadow: palette.name === 'dark'
                ? '0 12px 36px rgba(0,0,0,.55)'
                : '0 8px 26px rgba(15,23,42,.16)',
            border: `1px solid ${palette.border}`
        });
        dialog.dataset.cgueDialogTheme = palette.name;

        dialog.querySelectorAll('h2, strong').forEach((el) => { el.style.color = palette.text; });
        dialog.querySelectorAll('p').forEach((el) => { el.style.color = palette.muted; });

        styleDialogButtons(dialog, palette);
        styleDialogForm(dialog, palette);
        styleDialogCallouts(dialog, palette);
        localizeDialogText(dialog);
    }

    function styleDialogButtons(dialog, palette) {
        dialog.querySelectorAll('button').forEach((btn) => {
            btn.style.background = palette.ghost;
            btn.style.color = palette.text;
            btn.style.border = `1px solid ${palette.border}`;
            btn.style.boxShadow = 'none';
        });

        dialog.querySelectorAll('#select-personal-btn, #select-team-btn').forEach((btn) => {
            btn.style.background = palette.card;
            btn.style.border = `1px solid ${palette.cardBorder}`;
            btn.style.color = palette.text;
            btn.style.boxShadow = palette.name === 'dark'
                ? '0 6px 18px rgba(0,0,0,.25)'
                : '0 4px 14px rgba(15,23,42,.08)';
        });

        const primary = dialog.querySelector('#start-team-export-btn');
        if (primary) {
            Object.assign(primary.style, {
                background: palette.primary,
                color: palette.onPrimary,
                border: `1px solid ${palette.primary}`,
                boxShadow: palette.primaryShadow
            });
        }
    }

    function styleDialogForm(dialog, palette) {
        dialog.querySelectorAll('input[type="text"]').forEach((input) => {
            Object.assign(input.style, {
                background: palette.inputBg,
                color: palette.text,
                border: `1px solid ${palette.inputBorder}`,
                boxShadow: 'none'
            });
        });

        dialog.querySelectorAll('#workspace-id-list label').forEach((label) => {
            Object.assign(label.style, {
                background: palette.card,
                color: palette.text,
                border: `1px solid ${palette.cardBorder}`
            });
        });

        const manualLabel = dialog.querySelector('label[for="team-id-input"]');
        if (manualLabel) {
            manualLabel.style.color = palette.text;
        }
    }

    function styleDialogCallouts(dialog, palette) {
        dialog.querySelectorAll('code').forEach((code) => {
            Object.assign(code.style, {
                background: palette.codeBg,
                color: palette.codeText,
                borderRadius: '6px',
                padding: '4px 8px',
                border: `1px solid ${palette.cardBorder}`
            });
        });

        dialog.querySelectorAll('div').forEach((div) => {
            const bg = (div.style.background || '').toLowerCase();
            const bgColor = (div.style.backgroundColor || '').toLowerCase();
            const bgValue = `${bg} ${bgColor}`;
            let variant = div.dataset.cgueDialogCallout || '';
            if (!variant) {
                if (bgValue.includes('#eef2ff') || bgValue.includes('238, 242, 255')) variant = 'info';
                else if (bgValue.includes('#f0fdf4') || bgValue.includes('240, 253, 244')) variant = 'success';
                else if (bgValue.includes('#fffbeb') || bgValue.includes('255, 251, 235')) variant = 'warning';
            }
            if (!variant && (div.textContent || '').includes('⚠️')) {
                variant = 'warning';
            }

            if (variant) {
                const colors = palette.callouts?.[variant] || { bg: palette.callout, border: palette.cardBorder, text: palette.muted };
                div.dataset.cgueDialogCallout = variant;
                Object.assign(div.style, {
                    background: colors.bg,
                    color: colors.text,
                    border: `1px solid ${colors.border}`
                });
                div.querySelectorAll('p').forEach((p) => { p.style.color = colors.text; });
            }
        });
    }

    function attachDialogObserver(overlay) {
        if (!overlay || overlay.dataset.cgueDialogObserver === '1') return;
        overlay.dataset.cgueDialogObserver = '1';
        const dialogObserver = new MutationObserver(applyDialogTheme);
        dialogObserver.observe(overlay, { childList: true, subtree: true });
    }

    function syncDialogTheme() {
        applyDialogTheme();
        const overlay = document.getElementById(DIALOG_OVERLAY_ID);
        if (overlay) attachDialogObserver(overlay);
    }

    function handleThemeChange() {
        applyTheme(document.getElementById(TARGET_ID));
        applyDialogTheme();
    }

    if (darkMatcher) {
        darkMatcher.addEventListener('change', handleThemeChange);
    }

    function setIconIfIdle(btn) {
        if (!btn) return;
        btn.title = uiText.exportLabel;
        btn.setAttribute('aria-label', uiText.exportLabel);
        localizeButtonText(btn);
        if (btn.disabled) return;
        if (btn.textContent.trim() !== ICON_LABEL) {
            btn.textContent = ICON_LABEL;
        }
    }

    function attachButtonObserver(btn) {
        if (btn.dataset.cgueCompactObserver === '1') return;
        btn.dataset.cgueCompactObserver = '1';
        const btnObserver = new MutationObserver(() => setIconIfIdle(btn));
        btnObserver.observe(btn, {
            attributes: true,
            attributeFilter: ['disabled'],
            childList: true,
            characterData: true,
            subtree: true
        });
    }

    function compactIfFound() {
        const btn = document.getElementById(TARGET_ID);
        if (btn) applyCompactStyle(btn);
    }

    const observer = new MutationObserver((mutations) => {
        let buttonSeen = false;
        let dialogSeen = false;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (!buttonSeen && (node.id === TARGET_ID || node.querySelector?.(`#${TARGET_ID}`))) {
                    buttonSeen = true;
                }
                if (!dialogSeen && (node.id === DIALOG_OVERLAY_ID || node.querySelector?.(`#${DIALOG_OVERLAY_ID}`))) {
                    dialogSeen = true;
                }
            }
        }

        if (buttonSeen) compactIfFound();
        if (dialogSeen) syncDialogTheme();
    });

    function start() {
        compactIfFound();
        syncDialogTheme();
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        }
    }

    start();
})();
