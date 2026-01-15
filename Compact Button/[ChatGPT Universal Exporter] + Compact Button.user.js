// ==UserScript==
// @name         [ChatGPT Universal Exporter] + Compact Button
// @namespace    https://github.com/0-V-linuxdo/Fix-ChatGPT-Universal-Exporter-
// @version      [20260115] v1.0.0
// @description  Shrink the floating "Export Conversations" button without touching the original exporter logic.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // Prevent double-apply if the helper is injected twice
    if (window.__cgueCompactHelperApplied) return;
    window.__cgueCompactHelperApplied = true;

    const TARGET_ID = 'gpt-rescue-btn';
    const ICON_LABEL = '📥';
    const darkMatcher = window.matchMedia?.('(prefers-color-scheme: dark)');

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
        if (darkMatcher) {
            darkMatcher.addEventListener('change', () => applyTheme(btn));
        }
    }

    function compactIfFound() {
        const btn = document.getElementById(TARGET_ID);
        if (btn) applyCompactStyle(btn);
    }

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                if (node.id === TARGET_ID || node.querySelector?.(`#${TARGET_ID}`)) {
                    compactIfFound();
                    return;
                }
            }
        }
    });

    function start() {
        compactIfFound();
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', start, { once: true });
        }
    }

    start();
})();
