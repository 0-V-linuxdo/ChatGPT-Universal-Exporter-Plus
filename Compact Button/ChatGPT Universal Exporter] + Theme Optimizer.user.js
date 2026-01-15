// ==UserScript==
// @name         [ChatGPT Universal Exporter] + Theme Optimizer [20260115] v1.1.0
// @namespace    https://github.com/0-V-linuxdo/ChatGPT-Universal-Exporter-Plus
// @version      [20260115] v1.1.0
// @update-log   [20260115] v1.1.0 暗色弹窗改为中性灰系并淡化遮罩/底色，去蓝化统一卡片/输入/按钮的边框与文字色。
// @description  将浮动导出按钮压缩为仅图标、跟随主题且半透明的样式，不改动导出逻辑。
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// @run-at       document-idle
// @orginal      https://greasyfork.org/zh-CN/scripts/538495-chatgpt-universal-exporter
// @license      MIT
// ==/UserScript==

/* ============================================================
   Theme Optimizer 说明
   ------------------------------------------------------------
   • 浮窗按钮：仅保留 📥 图标的小尺寸块，保留阴影与圆角。
   • 主题联动：随系统亮/暗切换，按钮与弹窗同步调色，确保清晰对比。
   • 弹窗风格：浅色通透、深色中性灰；输入、卡片、按钮统一边框与文案色。
   • 行为保持：不改导出流程，仅做 UI 微调和文案优化。
   • 持续修复：监听 DOM 变化，按钮或弹窗被重建时自动补回样式。
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
    const darkMatcher = window.matchMedia?.('(prefers-color-scheme: dark)');
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
        if (!btn || btn.disabled) return;
        if (btn.textContent.trim() !== ICON_LABEL) {
            btn.textContent = ICON_LABEL;
        }
        btn.title = 'Export Conversations';
        btn.setAttribute('aria-label', 'Export Conversations');
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
