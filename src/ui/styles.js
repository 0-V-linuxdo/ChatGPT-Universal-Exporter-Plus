import {
    BACKUP_DIALOG_ID,
    BACKUP_OVERLAY_ID,
    BACKUP_STEP_CLASS,
    DIALOG_ID,
    EXPORT_BUTTON_ID,
    OVERLAY_ID,
    STYLE_ID,
    TOAST_BASE_GAP,
    TOAST_HOST_ID,
    TOAST_Z_INDEX
} from '../config/constants.js';

export function addStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${EXPORT_BUTTON_ID} {
                position: fixed;
                bottom: 16px;
                right: 16px;
                z-index: 99997;
                padding: 6px 10px;
                border-radius: 6px;
                border: none;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                user-select: none;
                background: rgba(255, 255, 255, 0.65);
                color: #0f172a;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
                backdrop-filter: blur(6px);
            }
            #${EXPORT_BUTTON_ID}:disabled {
                cursor: default;
                opacity: 0.85;
            }
            @media (prefers-color-scheme: dark) {
                #${EXPORT_BUTTON_ID} {
                    background: rgba(0, 0, 0, 0.55);
                    color: #f8fafc;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                }
            }
            #${TOAST_HOST_ID} {
                position: fixed;
                right: 18px;
                bottom: ${TOAST_BASE_GAP}px;
                z-index: ${TOAST_Z_INDEX};
                width: min(250px, calc(100vw - 20px));
                display: flex;
                flex-direction: column;
                gap: 12px;
                pointer-events: none;
            }
            #${TOAST_HOST_ID} .cgue-toast {
                pointer-events: auto;
                position: relative;
                overflow: hidden;
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: flex-start;
                gap: 14px;
                border-radius: 16px;
                border: 2px solid var(--cgue-toast-border, rgba(148, 163, 184, 0.42));
                background:
                    linear-gradient(132deg, rgba(255, 255, 255, 0.94), rgba(246, 250, 255, 0.9));
                color: var(--cgue-text);
                box-shadow:
                    0 16px 34px rgba(15, 23, 42, 0.16),
                    0 1px 0 rgba(255, 255, 255, 0.66) inset;
                backdrop-filter: blur(14px) saturate(145%);
                padding: 14px;
                animation: cgue-toast-enter 0.32s cubic-bezier(0.22, 1, 0.36, 1);
            }
            #${TOAST_HOST_ID} .cgue-toast-main {
                min-width: 0;
                display: flex;
                align-items: flex-start;
                gap: 0;
            }
            #${TOAST_HOST_ID} .cgue-toast-content {
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            #${TOAST_HOST_ID} .cgue-toast-headline {
                min-width: 0;
                display: flex;
                align-items: baseline;
                gap: 8px;
                flex-wrap: wrap;
                font-size: 16px;
                line-height: 1.34;
                font-weight: 700;
                letter-spacing: -0.01em;
                color: var(--cgue-text);
            }
            #${TOAST_HOST_ID} .cgue-toast-prefix {
                text-transform: uppercase;
                flex-shrink: 0;
                color: var(--cgue-toast-accent, currentColor);
            }
            #${TOAST_HOST_ID} .cgue-toast-message {
                flex: 1 1 auto;
                min-width: 0;
                word-break: break-word;
                white-space: pre-wrap;
            }
            #${TOAST_HOST_ID} .cgue-toast-detail {
                min-width: 0;
                margin-top: -1px;
                font-size: 13px;
                line-height: 1.45;
                font-weight: 500;
                color: var(--cgue-muted);
                word-break: break-word;
                white-space: pre-wrap;
            }
            #${TOAST_HOST_ID} .cgue-toast-extra {
                margin-top: 0;
            }
            #${TOAST_HOST_ID} .cgue-toast-extra-summary {
                font-size: 12px;
                line-height: 1.3;
                font-weight: 600;
                color: var(--cgue-muted);
                cursor: pointer;
                user-select: none;
            }
            #${TOAST_HOST_ID} .cgue-toast-extra-body {
                margin-top: 6px;
                display: flex;
                flex-direction: column;
                gap: 2px;
                font-size: 12px;
                line-height: 1.35;
                color: var(--cgue-muted);
                word-break: break-word;
                white-space: pre-wrap;
            }
            #${TOAST_HOST_ID} .cgue-toast-extra-line {
                word-break: break-word;
                white-space: pre-wrap;
            }
            #${TOAST_HOST_ID} .cgue-toast-extra-inline-divider {
                margin: 4px 0 2px;
                border-top: 1px dashed rgba(148, 163, 184, 0.55);
            }
            #${TOAST_HOST_ID} .cgue-toast-close {
                width: 30px;
                height: 30px;
                border-radius: 10px;
                border: 1px solid rgba(148, 163, 184, 0.36);
                background: rgba(255, 255, 255, 0.55);
                color: var(--cgue-muted);
                cursor: pointer;
                font-size: 12px;
                font-weight: 800;
                line-height: 1;
                flex-shrink: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-top: 2px;
                transition: transform 0.18s ease, background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
            }
            #${TOAST_HOST_ID} .cgue-toast-close:hover {
                color: #0f172a;
                background: rgba(255, 255, 255, 0.88);
                border-color: rgba(148, 163, 184, 0.6);
                transform: translateY(-1px);
            }
            #${TOAST_HOST_ID} .cgue-toast-close:focus-visible {
                outline: 2px solid var(--cgue-primary);
                outline-offset: 1px;
            }
            #${TOAST_HOST_ID} .cgue-toast--success {
                --cgue-toast-border: rgba(22, 163, 74, 0.72);
                --cgue-toast-border-dark: rgba(74, 222, 128, 0.8);
                --cgue-toast-accent: #16a34a;
                --cgue-toast-accent-dark: #4ade80;
            }
            #${TOAST_HOST_ID} .cgue-toast--warning {
                --cgue-toast-border: rgba(245, 158, 11, 0.65);
                --cgue-toast-border-dark: rgba(251, 191, 36, 0.76);
                --cgue-toast-accent: #d97706;
                --cgue-toast-accent-dark: #fbbf24;
            }
            #${TOAST_HOST_ID} .cgue-toast--error {
                --cgue-toast-border: rgba(239, 68, 68, 0.75);
                --cgue-toast-border-dark: rgba(248, 113, 113, 0.82);
                --cgue-toast-accent: #dc2626;
                --cgue-toast-accent-dark: #f87171;
            }
            #${TOAST_HOST_ID} .cgue-toast--info {
                --cgue-toast-border: rgba(59, 130, 246, 0.64);
                --cgue-toast-border-dark: rgba(96, 165, 250, 0.76);
                --cgue-toast-accent: #2563eb;
                --cgue-toast-accent-dark: #60a5fa;
            }
            #${TOAST_HOST_ID} .cgue-toast-pulse {
                animation: cgue-toast-pulse 240ms ease-out;
            }
            @media (prefers-color-scheme: dark) {
                #${TOAST_HOST_ID} .cgue-toast {
                    border: 2px solid var(--cgue-toast-border-dark, var(--cgue-toast-border, rgba(71, 85, 105, 0.7)));
                    background:
                        linear-gradient(130deg, rgba(22, 24, 28, 0.92), rgba(16, 18, 21, 0.88));
                    box-shadow:
                        0 18px 40px rgba(0, 0, 0, 0.5),
                        0 1px 0 rgba(255, 255, 255, 0.08) inset;
                }
                #${TOAST_HOST_ID} .cgue-toast-prefix {
                    color: var(--cgue-toast-accent-dark, var(--cgue-toast-accent, currentColor));
                }
                #${TOAST_HOST_ID} .cgue-toast-detail {
                    color: #cbd5e1;
                }
                #${TOAST_HOST_ID} .cgue-toast-extra-inline-divider {
                    border-top-color: rgba(100, 116, 139, 0.62);
                }
                #${TOAST_HOST_ID} .cgue-toast-extra-summary,
                #${TOAST_HOST_ID} .cgue-toast-extra-body {
                    color: #cbd5e1;
                }
                #${TOAST_HOST_ID} .cgue-toast-close {
                    border-color: rgba(100, 116, 139, 0.62);
                    background: rgba(30, 41, 59, 0.44);
                    color: #cbd5e1;
                }
                #${TOAST_HOST_ID} .cgue-toast-close:hover {
                    color: #f1f5f9;
                    background: rgba(30, 41, 59, 0.75);
                    border-color: rgba(148, 163, 184, 0.85);
                }
            }
            @media (max-width: 640px) {
                #${TOAST_HOST_ID} {
                    right: 10px;
                    left: 10px;
                    width: auto;
                    gap: 10px;
                }
                #${TOAST_HOST_ID} .cgue-toast {
                    gap: 10px;
                    padding: 12px;
                    border-radius: 14px;
                }
                #${TOAST_HOST_ID} .cgue-toast-headline {
                    font-size: 15px;
                }
                #${TOAST_HOST_ID} .cgue-toast-detail {
                    font-size: 12px;
                    line-height: 1.4;
                }
                #${TOAST_HOST_ID} .cgue-toast-extra-summary,
                #${TOAST_HOST_ID} .cgue-toast-extra-body {
                    font-size: 11px;
                }
                #${TOAST_HOST_ID} .cgue-toast-close {
                    width: 28px;
                    height: 28px;
                }
            }
            @keyframes cgue-toast-enter {
                0% {
                    opacity: 0;
                    transform: translateY(10px) scale(0.985);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            @keyframes cgue-toast-pulse {
                0% {
                    transform: scale(0.988);
                    box-shadow:
                        0 16px 34px rgba(15, 23, 42, 0.16),
                        0 0 0 0 rgba(148, 163, 184, 0.24);
                }
                100% {
                    transform: scale(1);
                    box-shadow:
                        0 16px 34px rgba(15, 23, 42, 0.16),
                        0 0 0 8px rgba(0, 0, 0, 0);
                }
            }
            .cgue-theme {
                --cgue-overlay: rgba(0, 0, 0, 0.45);
                --cgue-surface: #ffffff;
                --cgue-text: #0f172a;
                --cgue-muted: #475569;
                --cgue-border: #d7dbdf;
                --cgue-card: #f8fafc;
                --cgue-card-border: #e2e8f0;
                --cgue-primary: #10a37f;
                --cgue-on-primary: #ffffff;
                --cgue-primary-shadow: 0 6px 18px rgba(16, 163, 127, 0.28);
                --cgue-input-bg: #ffffff;
                --cgue-input-border: #cbd5e1;
                --cgue-code-bg: #e0e7ff;
                --cgue-code-text: #4338ca;
                --cgue-callout-info-bg: #eef2ff;
                --cgue-callout-info-border: #818cf8;
                --cgue-callout-info-text: #4338ca;
                --cgue-callout-success-bg: #f0fdf4;
                --cgue-callout-success-border: #4ade80;
                --cgue-callout-success-text: #166534;
                --cgue-callout-warning-bg: #fffbeb;
                --cgue-callout-warning-border: #facc15;
                --cgue-callout-warning-text: #92400e;
                --cgue-hover: rgba(148, 163, 184, 0.15);
                --cgue-shadow: 0 8px 26px rgba(15, 23, 42, 0.16);
            }
            @media (prefers-color-scheme: dark) {
                .cgue-theme {
                    --cgue-overlay: rgba(0, 0, 0, 0.45);
                    --cgue-surface: #161616;
                    --cgue-text: #e6e6e8;
                    --cgue-muted: #cfcfd4;
                    --cgue-border: #252528;
                    --cgue-card: #1b1b1f;
                    --cgue-card-border: #252528;
                    --cgue-primary: #10b981;
                    --cgue-on-primary: #ecfdf3;
                    --cgue-primary-shadow: 0 6px 18px rgba(16, 185, 129, 0.32);
                    --cgue-pill-active-bg: rgba(16, 185, 129, 0.18);
                    --cgue-pill-active-border: rgba(52, 211, 153, 0.42);
                    --cgue-pill-active-text: #d1fae5;
                    --cgue-pill-active-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.08), 0 6px 16px rgba(5, 150, 105, 0.14);
                    --cgue-input-bg: #1a1a1e;
                    --cgue-input-border: #2c2c31;
                    --cgue-code-bg: #1d1d22;
                    --cgue-code-text: #e6e6e8;
                    --cgue-callout-info-bg: #1f2024;
                    --cgue-callout-info-border: #2c2d33;
                    --cgue-callout-info-text: #e6e6eb;
                    --cgue-callout-success-bg: #1f2021;
                    --cgue-callout-success-border: #2c2f2d;
                    --cgue-callout-success-text: #e6e8e3;
                    --cgue-callout-warning-bg: #23211b;
                    --cgue-callout-warning-border: #3a3325;
                    --cgue-callout-warning-text: #f0e2c3;
                    --cgue-hover: rgba(148, 163, 184, 0.12);
                    --cgue-shadow: 0 12px 36px rgba(0, 0, 0, 0.55);
                }
            }
            #${OVERLAY_ID} {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--cgue-overlay);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99998;
            }
            #${DIALOG_ID} {
                background: var(--cgue-surface);
                color: var(--cgue-text);
                border: 1px solid var(--cgue-border);
                box-shadow: var(--cgue-shadow);
                border-radius: 14px;
                width: 520px;
                max-width: calc(100% - 32px);
                max-height: calc(100% - 32px);
                overflow: hidden;
                padding: 24px;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            #${DIALOG_ID}.${BACKUP_STEP_CLASS} {
                overflow-x: hidden;
                overflow-y: auto;
            }
            #${DIALOG_ID} > h2 {
                margin: 0 0 14px;
                font-size: 18px;
            }
            #${DIALOG_ID} p {
                margin: 6px 0 0;
                color: var(--cgue-muted);
            }
            .cgue-dialog-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 12px;
            }
            .cgue-dialog-title {
                display: inline-flex;
                align-items: center;
                gap: 12px;
                min-width: 0;
            }
            .cgue-dialog-title-icon {
                width: 20px;
                height: 20px;
                color: var(--cgue-text);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .cgue-dialog-title-icon svg {
                width: 20px;
                height: 20px;
                display: block;
            }
            .cgue-step-hero {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 0;
            }
            .cgue-step-hero-icon {
                width: 32px;
                height: 32px;
                color: var(--cgue-text);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .cgue-step-hero-icon svg {
                width: 100%;
                height: 100%;
                display: block;
            }
            .cgue-step-hero-copy {
                min-width: 0;
                flex: 1;
            }
            .cgue-step-hero-copy h2 {
                margin: 0;
                font-size: 18px;
                line-height: 1.2;
                letter-spacing: -0.01em;
            }
            .cgue-step-hero-subline {
                margin-top: 6px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
                flex-wrap: wrap;
                line-height: 1.35;
                color: var(--cgue-muted);
            }
            .cgue-step-hero-copy p {
                margin: 6px 0 0;
                line-height: 1.35;
            }
            .cgue-step-hero-subline-text {
                min-width: 0;
            }
            .cgue-auto-sync-tip {
                position: relative;
                display: inline-flex;
                align-items: center;
                flex-shrink: 0;
            }
            .cgue-auto-sync-tip-trigger {
                width: 18px;
                height: 18px;
                padding: 0;
                border-radius: 999px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-card);
                color: var(--cgue-muted);
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                user-select: none;
                font-family: inherit;
                appearance: none;
            }
            .cgue-auto-sync-tip:hover .cgue-auto-sync-tip-trigger,
            .cgue-auto-sync-tip:focus-within .cgue-auto-sync-tip-trigger,
            .cgue-auto-sync-tip-trigger:hover,
            .cgue-auto-sync-tip-trigger:focus-visible {
                color: var(--cgue-text);
                background: var(--cgue-hover);
            }
            .cgue-auto-sync-tip-trigger:focus-visible {
                outline: 2px solid var(--cgue-primary);
                outline-offset: 2px;
            }
            .cgue-auto-sync-tip-body {
                position: absolute;
                top: calc(100% + 8px);
                right: 0;
                width: min(320px, calc(100vw - 88px));
                padding: 10px 12px;
                box-sizing: border-box;
                border-radius: 10px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-card);
                color: var(--cgue-muted);
                box-shadow: var(--cgue-shadow);
                font-size: 12px;
                line-height: 1.55;
                z-index: 2;
                opacity: 0;
                visibility: hidden;
                transform: translateY(-4px);
                pointer-events: none;
                transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
            }
            .cgue-auto-sync-tip:hover .cgue-auto-sync-tip-body,
            .cgue-auto-sync-tip:focus-within .cgue-auto-sync-tip-body {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
                pointer-events: auto;
            }
            .cgue-dialog-header h2 {
                margin: 0;
                font-size: 18px;
            }
            .cgue-dialog-header h3 {
                margin: 0;
            }
            .cgue-header-actions {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .cgue-header-action-btn {
                min-height: 32px;
                padding: 0 10px;
                box-sizing: border-box;
                border-radius: 8px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-card);
                color: var(--cgue-text);
                appearance: none;
                -webkit-appearance: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                flex-shrink: 0;
                font-family: inherit;
            }
            .cgue-header-action-btn.cgue-header-action-btn-icon-only {
                width: 32px;
                min-width: 32px;
                min-height: 32px;
                padding: 0;
                gap: 0;
            }
            .cgue-header-action-btn:hover {
                background: var(--cgue-hover);
            }
            .cgue-header-action-btn:active {
                transform: scale(0.98);
            }
            .cgue-header-action-btn-icon {
                width: 14px;
                height: 14px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .cgue-header-action-btn-icon svg {
                width: 100%;
                height: 100%;
                display: block;
            }
            .cgue-header-action-btn-text {
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                white-space: nowrap;
            }
            .cgue-icon-btn {
                width: 32px;
                height: 32px;
                padding: 0;
                box-sizing: border-box;
                border-radius: 8px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-card);
                color: var(--cgue-text);
                appearance: none;
                -webkit-appearance: none;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                font-size: 14px;
                line-height: 1;
                font-family: inherit;
            }
            .cgue-icon-btn:hover {
                background: var(--cgue-hover);
            }
            .cgue-icon-btn:active {
                transform: scale(0.98);
            }
            .cgue-icon-btn:disabled,
            .cgue-header-action-btn:disabled {
                opacity: 0.58;
                cursor: not-allowed;
            }
            #${BACKUP_DIALOG_ID} #cgue-backup-close {
                border-radius: 12px;
                box-shadow: none;
                transition:
                    background 0.18s ease,
                    border-color 0.18s ease,
                    box-shadow 0.18s ease,
                    color 0.18s ease,
                    transform 0.18s ease;
            }
            #${BACKUP_DIALOG_ID} #cgue-backup-close:not(:hover):not(:focus-visible) {
                border-color: transparent;
                background: transparent;
                box-shadow: none;
            }
            #${BACKUP_DIALOG_ID} #cgue-backup-close:hover {
                background: rgba(148, 163, 184, 0.12);
                border-color: rgba(148, 163, 184, 0.28);
                box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
            }
            #${BACKUP_DIALOG_ID} #cgue-backup-close:focus-visible {
                background: rgba(148, 163, 184, 0.12);
                border-color: rgba(16, 163, 127, 0.28);
                box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.14);
                outline: none;
            }
            #${BACKUP_DIALOG_ID} #cgue-backup-close:active {
                transform: scale(0.96);
            }
            #${BACKUP_DIALOG_ID} #cgue-backup-close .cgue-close-icon {
                width: 16px;
                height: 16px;
                display: block;
                color: currentColor;
                flex-shrink: 0;
                pointer-events: none;
                overflow: visible;
            }
            #${BACKUP_DIALOG_ID} #cgue-backup-close .cgue-close-icon line {
                stroke: currentColor;
                stroke-width: 2.2;
                stroke-linecap: round;
            }
            @media (prefers-color-scheme: dark) {
                #${BACKUP_DIALOG_ID} #cgue-backup-close:hover {
                    background: rgba(148, 163, 184, 0.14);
                    border-color: rgba(148, 163, 184, 0.32);
                    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.24);
                }
                #${BACKUP_DIALOG_ID} #cgue-backup-close:focus-visible {
                    background: rgba(148, 163, 184, 0.14);
                    border-color: rgba(52, 211, 153, 0.34);
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.18);
                }
            }
            #${BACKUP_OVERLAY_ID} {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.12);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
            }
            #${BACKUP_DIALOG_ID} {
                --cgue-backup-scale: 1.1;
                background: var(--cgue-surface);
                color: var(--cgue-text);
                border: 1px solid var(--cgue-border);
                box-shadow: var(--cgue-shadow);
                border-radius: 12px;
                width: 460px;
                max-width: calc((100% - 32px) / var(--cgue-backup-scale));
                max-height: calc((100% - 32px) / var(--cgue-backup-scale));
                overflow: auto;
                padding: 20px;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                transform: scale(var(--cgue-backup-scale));
                transform-origin: center center;
            }
            #${BACKUP_DIALOG_ID} p {
                margin: 6px 0 0;
                color: var(--cgue-muted);
            }
            #${BACKUP_DIALOG_ID} .cgue-dialog-header {
                margin-bottom: 4px;
            }
            #${BACKUP_DIALOG_ID} .cgue-backup {
                margin-top: 12px;
            }
            .cgue-card-list {
                display: flex;
                flex-direction: column;
                gap: 14px;
                margin-top: 16px;
            }
            .cgue-step-body {
                margin-top: 16px;
            }
            .cgue-backup {
                margin-top: 16px;
                padding: 0;
                border: none;
                background: transparent;
            }
            .cgue-backup-options {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 10px;
            }
            .cgue-backup-option {
                position: relative;
                display: inline-flex;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }
            .cgue-backup-option input {
                position: absolute;
                opacity: 0;
                pointer-events: none;
            }
            .cgue-backup-option > .cgue-backup-option-shell {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                min-height: 36px;
                padding: 6px 14px;
                box-sizing: border-box;
                border-radius: 999px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-surface);
                color: var(--cgue-text);
                font-size: 12px;
                font-weight: 600;
                transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
            }
            .cgue-backup-option-text {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 24px;
                padding: 0;
                border-radius: 999px;
                color: inherit;
                line-height: 1.2;
                transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
            }
            .cgue-backup-option-icon {
                display: inline-flex;
                width: 18px;
                height: 18px;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: background 0.2s ease, box-shadow 0.2s ease;
            }
            .cgue-backup-option-icon svg {
                display: block;
                width: 100%;
                height: 100%;
            }
            .cgue-backup-option-drive > .cgue-backup-option-shell {
                gap: 10px;
                padding-left: 12px;
                padding-right: 16px;
            }
            .cgue-backup-option-local > .cgue-backup-option-shell {
                gap: 10px;
                padding-left: 12px;
                padding-right: 16px;
            }
            .cgue-backup-option input:checked + .cgue-backup-option-shell {
                background: var(--cgue-pill-active-bg, var(--cgue-primary));
                border-color: var(--cgue-pill-active-border, var(--cgue-primary));
                color: var(--cgue-pill-active-text, var(--cgue-on-primary));
                box-shadow: var(--cgue-pill-active-shadow, var(--cgue-primary-shadow));
            }
            .cgue-backup-option-local .cgue-backup-option-icon {
                width: 20px;
                height: 20px;
                opacity: 1;
            }
            .cgue-backup-option-local .cgue-backup-option-icon svg {
                width: 80%;
                height: 80%;
                transform: translateY(0.25px);
            }
            .cgue-backup-option-drive .cgue-backup-option-icon {
                border-radius: 4px;
            }
            .cgue-backup-option-drive input:checked + .cgue-backup-option-shell .cgue-backup-option-icon {
                background: rgba(255, 255, 255, 0.96);
                box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
            }
            .cgue-backup-option input:focus-visible + .cgue-backup-option-shell {
                outline: 2px solid var(--cgue-primary);
                outline-offset: 2px;
            }
            .cgue-backup-option:active > .cgue-backup-option-shell {
                transform: translateY(1px);
            }
            .cgue-btn-ghost {
                border: 1px dashed var(--cgue-border);
                background: transparent;
            }
            .cgue-drive-settings-wrap[data-visible="false"] {
                display: none;
            }
            .cgue-auto-sync[data-visible="false"] {
                display: none;
            }
            .cgue-drive-card {
                margin-top: 10px;
            }
            .cgue-drive-card .cgue-auto-task-body .cgue-drive-fields {
                padding-top: 2px;
            }
            .cgue-drive-fields {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 8px;
            }
            .cgue-drive-fields label {
                display: flex;
                flex-direction: column;
                gap: 2px;
                font-size: 11px;
                color: var(--cgue-muted);
            }
            .cgue-input-shell {
                position: relative;
                margin-top: 8px;
            }
            .cgue-input-shell .cgue-input {
                margin-top: 0;
                padding-right: 76px;
            }
            .cgue-input-toggle {
                position: absolute;
                top: 50%;
                right: 8px;
                transform: translateY(-50%);
                padding: 4px 10px;
                border-radius: 999px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-card);
                color: var(--cgue-muted);
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
            }
            .cgue-input-toggle:hover {
                color: var(--cgue-text);
                border-color: var(--cgue-primary);
            }
            .cgue-input-toggle:focus-visible {
                outline: 2px solid var(--cgue-primary);
                outline-offset: 2px;
            }
            .cgue-field-label {
                font-weight: 600;
            }
            .cgue-drive-fields .cgue-field-label {
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--cgue-muted);
            }
            .cgue-drive-fields > label > .cgue-input,
            .cgue-drive-fields > label > .cgue-input-shell {
                margin-top: 2px;
            }
            .cgue-drive-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: center;
                margin-top: 10px;
            }
            .cgue-drive-actions .cgue-btn {
                margin-left: auto;
            }
            #${BACKUP_DIALOG_ID} .cgue-drive-actions .cgue-btn,
            #${BACKUP_DIALOG_ID} .cgue-auto-sync-actions .cgue-btn,
            #${DIALOG_ID}.${BACKUP_STEP_CLASS} .cgue-drive-actions .cgue-btn,
            #${DIALOG_ID}.${BACKUP_STEP_CLASS} .cgue-auto-sync-actions .cgue-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 34px;
                padding: 6px 12px;
                border-radius: 8px;
                font-size: 12px;
                line-height: 1.2;
            }
            .cgue-drive-actions .cgue-status {
                margin-top: 0;
            }
            .cgue-status.cgue-success {
                color: #16a34a;
            }
            .cgue-auto-sync {
                margin-top: 18px;
                padding-top: 18px;
                border-top: 1px solid var(--cgue-border);
            }
            .cgue-auto-sync.cgue-auto-sync-standalone {
                padding-top: 0;
                border-top: none;
            }
            .cgue-auto-sync.cgue-auto-sync-task-only {
                margin-top: 14px;
            }
            .cgue-auto-sync.cgue-auto-sync-task-only .cgue-auto-task-detail {
                margin-top: 0;
            }
            .cgue-auto-sync.cgue-auto-sync-task-only .cgue-auto-editor {
                margin-top: 0;
            }
            .cgue-auto-sync-header {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .cgue-auto-sync-title-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                position: relative;
            }
            .cgue-auto-sync-title-main {
                display: inline-flex;
                align-items: center;
                min-width: 0;
            }
            .cgue-auto-sync-title-row h3 {
                margin: 0;
                font-size: 15px;
                font-weight: 700;
                flex-shrink: 0;
            }
            .cgue-auto-sync-desc {
                margin: 0;
                font-size: 12px;
                line-height: 1.55;
                color: var(--cgue-muted);
            }
            .cgue-auto-sync-account {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                width: 100%;
                min-height: 40px;
                box-sizing: border-box;
                padding: 8px 12px;
                border-radius: 10px;
                background: var(--cgue-hover);
                font-size: 12px;
                color: var(--cgue-muted);
                line-height: 1.45;
            }
            .cgue-auto-sync-account-main {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1 1 auto;
                min-width: 0;
            }
            .cgue-auto-sync-account-text {
                flex: 1 1 auto;
                min-width: 0;
                word-break: break-word;
            }
            .cgue-auto-sync-account-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--cgue-primary);
                flex-shrink: 0;
            }
            .cgue-auto-sync-account-dot.offline {
                background: var(--cgue-muted);
            }
            .cgue-auto-sync-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                flex-shrink: 0;
            }
            .cgue-auto-sync-actions .cgue-auto-sync-add-btn {
                width: 45px;
                min-width: 45px;
                min-height: 45px;
            }
            .cgue-auto-sync-account .cgue-auto-sync-refresh-btn {
                width: 30px;
                min-width: 30px;
                height: 30px;
                min-height: 30px;
                padding: 0;
                border-radius: 999px;
                flex: 0 0 auto;
            }
            .cgue-auto-task-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 4px;
            }
            .cgue-auto-sync-empty {
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: var(--cgue-muted);
                border: 1px dashed var(--cgue-border);
                border-radius: 10px;
                background: var(--cgue-card);
            }
            .cgue-auto-task {
                border-radius: 10px;
                border: 1px solid var(--cgue-card-border);
                background: var(--cgue-card);
                box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
                transition: box-shadow 0.2s ease, border-color 0.2s ease;
                overflow: hidden;
            }
            .cgue-auto-task:hover {
                box-shadow: 0 3px 12px rgba(15, 23, 42, 0.08);
                border-color: var(--cgue-border);
            }
            .cgue-auto-task-entry {
                width: 100%;
                padding: 0;
                text-align: left;
                appearance: none;
                cursor: pointer;
                color: inherit;
                font: inherit;
            }
            .cgue-auto-task-entry:focus-visible {
                outline: 2px solid var(--cgue-primary);
                outline-offset: 2px;
            }
            .cgue-auto-task-entry-layout {
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 14px;
            }
            .cgue-auto-task-entry-top {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 0;
            }
            .cgue-auto-task-entry-scope {
                flex: 1;
                min-width: 0;
                font-size: 13px;
                line-height: 1.45;
                color: var(--cgue-text);
                word-break: break-word;
            }
            .cgue-auto-task-entry-bottom {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 10px;
                flex-wrap: wrap;
            }
            .cgue-auto-task-entry-bottom .cgue-auto-task-status {
                margin-left: auto;
            }
            .cgue-auto-task-summary {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 14px;
                user-select: none;
            }
            .cgue-auto-task-title {
                flex: 1;
                min-width: 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .cgue-auto-task-title-icon {
                width: 22px;
                height: 22px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .cgue-auto-task-title-icon svg {
                display: block;
                width: 20px;
                height: 20px;
            }
            .cgue-auto-task-summary strong {
                flex: 1;
                min-width: 0;
                font-size: 12.5px;
                font-weight: 600;
                line-height: 1.35;
                color: var(--cgue-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .cgue-auto-task-expand {
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                padding: 0;
                border: none;
                border-radius: 6px;
                background: transparent;
                color: inherit;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            .cgue-auto-task-expand:hover {
                background: var(--cgue-hover);
            }
            .cgue-auto-task-expand:focus-visible {
                outline: 2px solid var(--cgue-primary);
                outline-offset: 2px;
            }
            .cgue-auto-task-caret {
                width: 16px;
                height: 16px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: var(--cgue-muted);
                opacity: 0.55;
                transition: transform 0.2s ease;
                font-size: 10px;
            }
            .cgue-auto-task[data-expanded="true"] .cgue-auto-task-caret {
                transform: rotate(180deg);
            }
            .cgue-auto-task-body {
                display: none;
                flex-direction: column;
                gap: 10px;
                padding: 0 14px 12px;
            }
            .cgue-auto-task[data-expanded="true"] .cgue-auto-task-body {
                display: flex;
            }
            .cgue-auto-task-body-static {
                display: flex;
            }
            .cgue-auto-task-status {
                display: inline-flex;
                align-items: center;
                gap: 5px;
                padding: 3px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                white-space: nowrap;
                letter-spacing: 0.02em;
                border: 1px solid transparent;
            }
            .cgue-auto-task-status-dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                flex-shrink: 0;
            }
            .cgue-auto-task-status[data-status="running"] {
                background: rgba(16, 163, 127, 0.12);
                color: #10a37f;
                border-color: rgba(16, 163, 127, 0.25);
            }
            .cgue-auto-task-status[data-status="running"] .cgue-auto-task-status-dot {
                background: #10a37f;
                animation: cgue-pulse 1.5s ease-in-out infinite;
            }
            .cgue-auto-task-status[data-status="scheduled"] {
                background: rgba(59, 130, 246, 0.10);
                color: #3b82f6;
                border-color: rgba(59, 130, 246, 0.22);
            }
            .cgue-auto-task-status[data-status="scheduled"] .cgue-auto-task-status-dot {
                background: #3b82f6;
            }
            .cgue-auto-task-status[data-status="paused"] {
                background: rgba(245, 158, 11, 0.10);
                color: #d97706;
                border-color: rgba(245, 158, 11, 0.22);
            }
            .cgue-auto-task-status[data-status="paused"] .cgue-auto-task-status-dot {
                background: #d97706;
            }
            @keyframes cgue-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
            .cgue-auto-task-actions {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
                gap: 6px;
            }
            .cgue-auto-task-actions .cgue-btn {
                padding: 5px 10px;
                font-size: 11px;
                border-radius: 6px;
            }
            .cgue-auto-task-actions .cgue-auto-task-status {
                margin-left: auto;
                flex: 0 0 auto;
            }
            .cgue-auto-sync-actions .cgue-auto-task-icon-btn,
            .cgue-auto-sync-account .cgue-auto-task-icon-btn,
            .cgue-auto-task-actions .cgue-auto-task-icon-btn {
                padding: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                border: 1px solid transparent;
                background: transparent;
                box-shadow: none;
                color: inherit;
                transition:
                    border-color 0.18s ease,
                    background 0.18s ease,
                    color 0.18s ease,
                    transform 0.18s ease;
            }
            .cgue-auto-task-actions .cgue-auto-task-icon-btn {
                width: 32px;
                height: 32px;
                flex: 0 0 auto;
            }
            .cgue-auto-sync-actions .cgue-auto-task-icon-btn:hover,
            .cgue-auto-sync-actions .cgue-auto-task-icon-btn:focus-visible,
            .cgue-auto-sync-actions .cgue-auto-task-icon-btn:active,
            .cgue-auto-sync-actions .cgue-auto-task-icon-btn[data-selected="true"],
            .cgue-auto-sync-account .cgue-auto-task-icon-btn:hover,
            .cgue-auto-sync-account .cgue-auto-task-icon-btn:focus-visible,
            .cgue-auto-sync-account .cgue-auto-task-icon-btn:active,
            .cgue-auto-sync-account .cgue-auto-task-icon-btn[data-selected="true"],
            .cgue-auto-task-actions .cgue-auto-task-icon-btn:hover,
            .cgue-auto-task-actions .cgue-auto-task-icon-btn:focus-visible,
            .cgue-auto-task-actions .cgue-auto-task-icon-btn:active,
            .cgue-auto-task-actions .cgue-auto-task-icon-btn[data-selected="true"] {
                background: rgba(148, 163, 184, 0.18);
                border-color: rgba(148, 163, 184, 0.42);
            }
            .cgue-auto-task-delete-btn:hover,
            .cgue-auto-task-delete-btn:focus-visible,
            .cgue-auto-task-delete-btn:active,
            .cgue-auto-task-delete-btn[data-selected="true"] {
                color: #ef4444;
                background: rgba(239, 68, 68, 0.08);
                border-color: rgba(239, 68, 68, 0.42);
            }
            .cgue-auto-task-icon-btn .cgue-auto-task-icon {
                width: 18px;
                height: 18px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }
            .cgue-auto-sync-account .cgue-auto-sync-refresh-btn .cgue-auto-task-icon {
                width: 16px;
                height: 16px;
            }
            .cgue-auto-sync-account .cgue-auto-sync-refresh-btn .cgue-auto-task-icon svg {
                transform: scale(1.08);
                transform-origin: center;
                overflow: visible;
            }
            .cgue-auto-sync-actions .cgue-auto-sync-add-btn .cgue-auto-task-icon {
                width: 18px;
                height: 18px;
            }
            .cgue-auto-task-icon-btn .cgue-auto-task-icon svg {
                display: block;
                width: 100%;
                height: 100%;
            }
            .cgue-auto-task-preview {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 0 14px 12px;
            }
            .cgue-auto-task-preview-item {
                display: inline-flex;
                align-items: center;
                min-width: 0;
                padding: 3px 8px;
                border-radius: 999px;
                background: var(--cgue-hover);
                color: var(--cgue-muted);
                font-size: 11px;
                line-height: 1.35;
                word-break: break-word;
            }
            .cgue-auto-task-detail {
                margin-top: 14px;
            }
            .cgue-auto-task-detail-card {
                margin-bottom: 14px;
            }
            .cgue-auto-task-meta {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                gap: 1px;
                border-radius: 10px;
                overflow: hidden;
                background: var(--cgue-border);
                border: 1px solid var(--cgue-border);
            }
            .cgue-auto-task-meta-item {
                display: flex;
                flex-direction: column;
                gap: 2px;
                padding: 8px 12px;
                background: var(--cgue-surface);
                min-width: 0;
            }
            .cgue-auto-task-meta-item:first-child {
                grid-column: 1 / -1;
            }
            .cgue-auto-task-meta-label {
                font-size: 10px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                color: var(--cgue-muted);
                opacity: 0.7;
            }
            .cgue-auto-task-meta-value {
                font-size: 12px;
                color: var(--cgue-text);
                line-height: 1.4;
                word-break: break-word;
            }
            .cgue-auto-editor {
                margin-top: 0;
                padding: 0;
                border: none;
                background: transparent;
                box-shadow: none;
            }
            .cgue-auto-editor-card {
                margin-bottom: 0;
            }
            .cgue-auto-editor-card .cgue-auto-task-body {
                padding-top: 16px;
            }
            .cgue-auto-editor-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                gap: 14px;
            }
            .cgue-auto-editor-grid label {
                display: flex;
                flex-direction: column;
                gap: 6px;
                font-size: 12px;
                color: var(--cgue-text);
            }
            .cgue-auto-editor-grid .cgue-input {
                margin-top: 0;
            }
            .cgue-auto-editor-options {
                margin-top: 14px;
                display: flex;
                justify-content: flex-start;
            }
            .cgue-auto-editor-options-column {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
            }
            .cgue-auto-editor-options .cgue-toggle {
                min-height: 18px;
                display: grid;
                grid-template-columns: 8ch auto;
                align-items: center;
                justify-content: flex-start;
                column-gap: 10px;
            }
            .cgue-auto-editor-options .cgue-toggle-track {
                justify-self: start;
            }
            .cgue-auto-editor-options .cgue-toggle-label {
                white-space: nowrap;
            }
            .cgue-auto-editor .cgue-drive-actions {
                margin-top: 16px;
                display: flex;
                flex-direction: column;
                align-items: stretch;
                gap: 12px;
            }
            .cgue-auto-editor .cgue-drive-actions .cgue-status {
                flex: 0 0 auto;
                margin-top: 0;
            }
            .cgue-auto-editor .cgue-drive-action-buttons {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .cgue-auto-editor .cgue-drive-action-buttons-main {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 12px;
                margin-left: auto;
            }
            .cgue-auto-editor .cgue-drive-action-buttons .cgue-btn {
                margin-left: 0;
            }
            .cgue-card-btn {
                padding: 14px;
                text-align: left;
                border: 1px solid var(--cgue-card-border);
                border-radius: 10px;
                background: var(--cgue-card);
                color: var(--cgue-text);
                cursor: pointer;
                box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
            }
            .cgue-card-btn:disabled {
                opacity: 0.58;
                cursor: not-allowed;
                box-shadow: none;
            }
            .cgue-card-icon-btn {
                display: flex;
                align-items: center;
                gap: 14px;
            }
            .cgue-card-mode-main {
                display: flex;
                align-items: center;
                gap: 14px;
                min-width: 0;
                flex: 1;
            }
            .cgue-card-icon {
                width: 40px;
                height: 40px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .cgue-card-icon svg {
                display: block;
                width: 32px;
                height: 32px;
            }
            .cgue-icon-export-all svg,
            .cgue-icon-select svg {
                width: 28px;
                height: 28px;
            }
            .cgue-card-text {
                flex: 1;
            }
            .cgue-card-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }
            .cgue-card-content {
                flex: 1;
            }
            .cgue-card-controls {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
                flex-shrink: 0;
            }
            .cgue-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                color: var(--cgue-text);
                cursor: pointer;
                user-select: none;
            }
            .cgue-toggle input {
                position: absolute;
                opacity: 0;
                width: 0;
                height: 0;
            }
            .cgue-toggle-track {
                width: 32px;
                height: 18px;
                background: var(--cgue-input-border);
                border-radius: 999px;
                position: relative;
                transition: background 0.2s ease;
            }
            .cgue-toggle-track::after {
                content: '';
                width: 14px;
                height: 14px;
                background: #ffffff;
                border-radius: 50%;
                position: absolute;
                top: 2px;
                left: 2px;
                transition: transform 0.2s ease;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
            }
            .cgue-toggle input:checked + .cgue-toggle-track {
                background: var(--cgue-primary);
            }
            .cgue-toggle input:checked + .cgue-toggle-track::after {
                transform: translateX(14px);
            }
            .cgue-toggle-label {
                font-weight: 600;
                font-size: 12px;
                color: var(--cgue-text);
            }
            @media (max-width: 640px) {
                .cgue-header-action-btn {
                    padding: 0 8px;
                    gap: 6px;
                }
                .cgue-header-action-btn-text {
                    font-size: 11px;
                }
                .cgue-step-hero {
                    gap: 12px;
                }
                .cgue-step-hero-icon {
                    width: 32px;
                    height: 32px;
                }
                .cgue-auto-sync-tip-body {
                    width: min(280px, calc(100vw - 80px));
                }
                .cgue-auto-sync-title-row {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                .cgue-auto-sync-title-main {
                    width: 100%;
                }
                .cgue-auto-sync-actions {
                    width: 100%;
                }
                .cgue-auto-sync-account {
                    align-items: flex-start;
                }
                .cgue-auto-sync-account .cgue-auto-sync-refresh-btn {
                    margin-top: 1px;
                }
                .cgue-auto-task-meta {
                    grid-template-columns: repeat(2, 1fr);
                }
                .cgue-auto-editor-grid {
                    grid-template-columns: minmax(0, 1fr);
                }
                .cgue-auto-editor-options {
                    gap: 10px;
                }
                .cgue-auto-editor .cgue-drive-actions {
                    align-items: stretch;
                }
                .cgue-auto-editor .cgue-drive-action-buttons {
                    flex-direction: column;
                    align-items: stretch;
                }
                .cgue-auto-editor .cgue-drive-action-buttons-main {
                    width: 100%;
                    flex-direction: column;
                    align-items: stretch;
                    margin-left: 0;
                }
                .cgue-auto-editor .cgue-drive-action-buttons .cgue-btn {
                    width: 100%;
                }
                .cgue-card-row {
                    flex-direction: column;
                    align-items: flex-start;
                }
                .cgue-card-mode-main {
                    width: 100%;
                }
                .cgue-card-controls {
                    flex-direction: row;
                    align-items: center;
                    justify-content: flex-start;
                }
            }
            .cgue-actions {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 12px;
                margin-top: 20px;
            }
            .cgue-actions-end {
                justify-content: flex-end;
            }
            .cgue-btn {
                padding: 10px 14px;
                border-radius: 8px;
                border: 1px solid var(--cgue-border);
                background: transparent;
                color: var(--cgue-text);
                cursor: pointer;
                font-weight: 600;
            }
            .cgue-btn.cgue-primary {
                background: var(--cgue-primary);
                color: var(--cgue-on-primary);
                border: 1px solid var(--cgue-primary);
                box-shadow: var(--cgue-primary-shadow);
            }
            .cgue-callout {
                border-radius: 10px;
                padding: 12px;
                margin-top: 16px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-card);
            }
            .cgue-callout.info {
                background: var(--cgue-callout-info-bg);
                color: var(--cgue-callout-info-text);
                border-color: var(--cgue-callout-info-border);
            }
            .cgue-callout.success {
                background: var(--cgue-callout-success-bg);
                color: var(--cgue-callout-success-text);
                border-color: var(--cgue-callout-success-border);
            }
            .cgue-callout.warning {
                background: var(--cgue-callout-warning-bg);
                color: var(--cgue-callout-warning-text);
                border-color: var(--cgue-callout-warning-border);
            }
            .cgue-callout code {
                background: var(--cgue-code-bg);
                color: var(--cgue-code-text);
                border-radius: 6px;
                padding: 4px 8px;
                border: 1px solid var(--cgue-card-border);
                display: inline-block;
                margin-top: 8px;
            }
            .cgue-workspace-restore-callout,
            .cgue-selection-loading-callout {
                margin: 0 0 16px;
            }
            .cgue-selection-loading {
                margin-top: 10px;
            }
            .cgue-workspace-restore-statusline,
            .cgue-selection-loading-statusline {
                display: block;
                color: var(--cgue-muted);
                font-size: 14px;
                line-height: 1.4;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .cgue-workspace-restore-callout[data-tone="success"] .cgue-workspace-restore-statusline,
            .cgue-selection-loading-callout[data-tone="success"] .cgue-selection-loading-statusline {
                color: var(--cgue-callout-success-text);
            }
            .cgue-workspace-restore-callout[data-tone="warning"] .cgue-workspace-restore-statusline,
            .cgue-selection-loading-callout[data-tone="warning"] .cgue-selection-loading-statusline {
                color: var(--cgue-callout-warning-text);
            }
            .cgue-workspace-restore-progress,
            .cgue-selection-loading-progress {
                flex: 1 1 auto;
                position: relative;
                height: 12px;
                overflow: hidden;
                border: 1px solid var(--cgue-border);
                border-radius: 999px;
                background: var(--cgue-input-bg);
                box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.06);
            }
            .cgue-workspace-restore-progress-row,
            .cgue-selection-loading-progress-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-top: 10px;
            }
            .cgue-workspace-restore-progress > span,
            .cgue-selection-loading-progress > span {
                display: block;
                height: 100%;
                border-radius: inherit;
                background: linear-gradient(90deg, #34d399 0%, var(--cgue-primary) 100%);
                transition: width 0.28s ease;
            }
            .cgue-workspace-restore-count,
            .cgue-selection-loading-count {
                flex: 0 0 auto;
                min-width: 32px;
                text-align: right;
                color: var(--cgue-muted);
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
            }
            .cgue-workspace-restore-callout[data-tone="success"] .cgue-workspace-restore-count,
            .cgue-selection-loading-callout[data-tone="success"] .cgue-selection-loading-count {
                color: var(--cgue-callout-success-text);
            }
            .cgue-workspace-restore-callout[data-tone="warning"] .cgue-workspace-restore-progress > span,
            .cgue-selection-loading-callout[data-tone="warning"] .cgue-selection-loading-progress > span {
                background: linear-gradient(90deg, #fbbf24 0%, var(--cgue-callout-warning-border) 100%);
            }
            .cgue-workspace-restore-callout[data-tone="warning"] .cgue-workspace-restore-count,
            .cgue-selection-loading-callout[data-tone="warning"] .cgue-selection-loading-count {
                color: var(--cgue-callout-warning-text);
            }
            .cgue-scope-summary {
                display: flex;
                align-items: center;
                gap: 12px;
                flex-wrap: wrap;
            }
            .cgue-scope-summary strong {
                display: inline-flex;
                align-items: center;
                line-height: 1;
            }
            .cgue-scope-summary code {
                margin-top: 0;
                min-width: 0;
            }
            .cgue-mode-team-panel {
                display: grid;
                grid-template-columns: 40px minmax(0, 1fr);
                column-gap: 14px;
                align-items: start;
            }
            .cgue-mode-field-label {
                display: block;
                font-size: 13px;
                font-weight: 700;
                color: currentColor;
            }
            .cgue-mode-team-icon {
                width: 40px;
                height: 40px;
                margin-top: 12px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .cgue-mode-team-icon svg {
                width: 28px;
                height: 28px;
                display: block;
            }
            .cgue-mode-team-content {
                display: flex;
                min-width: 0;
                flex-direction: column;
                gap: 10px;
            }
            .cgue-mode-team-copy {
                display: flex;
                min-width: 0;
                flex-direction: column;
                gap: 4px;
            }
            .cgue-mode-team-copy .cgue-mode-field-label,
            .cgue-mode-team-copy .cgue-mode-field-hint {
                margin: 0;
            }
            .cgue-mode-field-hint {
                margin: 0;
                font-size: 12px;
                line-height: 1.5;
                opacity: 0.82;
            }
            .cgue-mode-team-manual {
                display: flex;
                flex-direction: column;
            }
            .cgue-mode-team-manual[hidden] {
                display: none;
            }
            .cgue-mode-team-content > .cgue-input {
                margin-top: 0;
            }
            .cgue-mode-team-manual > .cgue-input {
                margin-top: 2px;
            }
            .cgue-select {
                appearance: auto;
            }
            .cgue-workspace-row {
                display: inline-flex;
                align-items: center;
                gap: 2px;
            }
            .cgue-workspace-row code {
                margin-top: 0;
            }
            .cgue-workspace-list .cgue-workspace-row {
                margin-left: 8px;
            }
            .cgue-workspace-index {
                display: inline-flex;
                align-items: baseline;
                gap: 6px;
                font-size: 12px;
                font-weight: 600;
            }
            .cgue-workspace-number {
                font-size: 16px;
                font-weight: 700;
            }
            .cgue-workspace-label {
                font-size: 16px;
                font-weight: 600;
                letter-spacing: 0.2px;
                color: currentColor;
                opacity: 0.75;
                line-height: 1;
                margin-left: 10px;
            }
            .cgue-input {
                width: 100%;
                padding: 8px 10px;
                border-radius: 8px;
                border: 1px solid var(--cgue-input-border);
                background: var(--cgue-input-bg);
                color: var(--cgue-text);
                box-sizing: border-box;
                margin-top: 8px;
            }
            .cgue-workspace-list label {
                display: block;
                margin-bottom: 8px;
                padding: 8px;
                border-radius: 8px;
                border: 1px solid var(--cgue-card-border);
                background: var(--cgue-card);
                cursor: pointer;
            }
            .cgue-select-toolbar {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 12px;
            }
            .cgue-select-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            .cgue-select-actions .cgue-btn {
                padding: 6px 10px;
                font-size: 12px;
            }
            .cgue-selection-count {
                margin-top: 6px;
                font-size: 12px;
                color: var(--cgue-muted);
            }
            .cgue-status {
                margin-top: 10px;
                font-size: 12px;
                color: var(--cgue-muted);
            }
            .cgue-status.cgue-error {
                color: #b91c1c;
            }
            .cgue-conv-list {
                margin-top: 12px;
                border: 1px solid var(--cgue-border);
                border-radius: 10px;
                background: var(--cgue-card);
                max-height: 45vh;
                overflow: auto;
                padding: 8px;
            }
            .cgue-group {
                margin-bottom: 12px;
            }
            .cgue-group-title {
                font-size: 13px;
                font-weight: 700;
                margin: 10px 6px 6px;
                color: var(--cgue-text);
            }
            .cgue-conv-item {
                list-style: none;
                margin: 4px 0;
                padding: 6px 6px;
                border-radius: 8px;
                transition: background 0.15s ease;
            }
            .cgue-conv-item:hover {
                background: var(--cgue-hover);
            }
            .cgue-conv-label {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                cursor: pointer;
            }
            .cgue-conv-label input[type="checkbox"] {
                align-self: center;
            }
            .cgue-conv-title {
                font-size: 13px;
                color: var(--cgue-text);
            }
            .cgue-conv-meta {
                font-size: 11px;
                color: var(--cgue-muted);
                margin-top: 2px;
            }
        `;
        document.head.appendChild(style);
    }
