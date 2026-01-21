// ==UserScript==
// @name         ChatGPT Universal Exporter Plus [20260121] v1.0.1
// @namespace    https://github.com/0-V-linuxdo/ChatGPT-Universal-Exporter-Plus
// @version      [20260121] v1.0.1
// @update-log   [20260121] v1.0.1 备份位置图标随本地/Drive 选择切换。
// @description  Export ChatGPT conversations to ZIP: all or selected, personal/team workspaces, root filters, local save or Google Drive backup, compact UI.
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @grant        GM_xmlhttpRequest
// @connect      oauth2.googleapis.com
// @connect      www.googleapis.com
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

// ================================================
// Fork Notice:
// Name:     ChatGPT Universal Exporter
// Authors:  Me Alexrcer
// Link:     https://greasyfork.org/scripts/538495
// Version:  8.2.0
// ================================================

(function () {
    'use strict';

    const BASE_DELAY = 600;
    const JITTER = 400;
    const PAGE_LIMIT = 100;
    const EXPORT_BUTTON_ID = 'cgue-export-btn';
    const OVERLAY_ID = 'cgue-export-overlay';
    const DIALOG_ID = 'cgue-export-dialog';
    const STYLE_ID = 'cgue-export-style';
    const ICON_LABEL = '📥';
    const DRIVE_SETTINGS_KEY = 'cgue-drive-settings';
    const BACKUP_TARGETS_KEY = 'cgue-backup-targets';
    const EXPORT_OPTIONS_KEY = 'cgue-export-options';
    const DRIVE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
    const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
    const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
    const DRIVE_ROOT_FOLDER_NAME = 'ChatGPT Universal Exporter Plus';
    const DRIVE_CONVERSATION_ID_KEY = 'cgue_conversation_id';
    const FILENAME_SEPARATOR = '｜';
    const DRIVE_FILENAME_PLACEHOLDER = '{{workspace}} {{date}} {{time}}.zip';
    const BACKUP_OVERLAY_ID = 'cgue-backup-overlay';
    const BACKUP_DIALOG_ID = 'cgue-backup-dialog';
    const BACKUP_BUTTON_ID = 'cgue-backup-settings-btn';
    const BACKUP_ICON_DRIVE = '☁️';
    const BACKUP_ICON_LOCAL = '💾';

    let accessToken = null;
    const capturedWorkspaceIds = new Set();
    let driveSettings = loadDriveSettings();
    const initialBackupTargets = loadBackupTargets(driveSettings.enabled === true);
    const initialExportOptions = loadExportOptions();

    const state = {
        scope: 'personal',
        workspaceId: null,
        index: null,
        selectedIds: new Set(),
        isExporting: false,
        stepToken: 0,
        backupTargets: { ...initialBackupTargets },
        driveSettingsExpanded: false,
        exportAllOptions: { ...initialExportOptions }
    };

    const shortLabel = (value, max = 10) => {
        const text = (value || '').trim();
        if (!text) return '';
        if (text.length <= max) return text;
        return `${text.slice(0, max)}...`;
    };

    const escapeHtml = (value) => {
        const raw = value == null ? '' : String(value);
        return raw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const getBackupTargetIcon = (targets = state.backupTargets) => (
        targets && targets.drive ? BACKUP_ICON_DRIVE : BACKUP_ICON_LOCAL
    );

    const updateBackupButtonIcon = (targets) => {
        const button = document.getElementById(BACKUP_BUTTON_ID);
        if (!button) return;
        button.textContent = getBackupTargetIcon(targets);
    };

    const I18N = {
        en: {
            exportButton: 'Export Conversations',
            dialogChooseScope: 'Space',
            personalTitle: 'Personal',
            personalDesc: 'Export your personal conversations.',
            teamTitle: 'Team',
            teamDesc: 'Export team workspace conversations.',
            cancel: 'Cancel',
            back: 'Back',
            next: 'Next',
            exportModeTitle: 'Choose export mode',
            exportModeDesc: 'Select a full export or pick specific conversations.',
            exportAllDesc: 'Export every conversation in this workspace.',
            selectDesc: 'Pick specific conversations to export.',
            exportAll: 'Export all (ZIP)',
            selectConversations: 'Select conversations',
            teamDialogTitle: 'Export Team Workspace',
            workspaceMultiPrompt: '🔎 Multiple workspaces detected. Please choose one:',
            workspaceMissingTitle: '⚠️ Unable to detect a Workspace ID.',
            workspaceMissingTip: 'Try refreshing the page or opening a team conversation, or enter it manually below.',
            workspaceManualLabel: 'Enter Team Workspace ID manually:',
            workspaceManualPlaceholder: 'Paste your Workspace ID (ws-...)',
            selectionTitle: 'Select conversations to export',
            searchPlaceholder: 'Search by title or location',
            selectAll: 'Select all',
            selectVisible: 'Select visible',
            clearAll: 'Clear',
            selectedCount: (selected, total) => `Selected ${selected} of ${total}`,
            loadingConversations: 'Loading conversations…',
            noConversations: 'No conversations found.',
            exportSelected: 'Export selected (ZIP)',
            backupTitle: 'Backup destination',
            backupDesc: 'Choose where the ZIP should be saved.',
            backupLocal: 'Local file',
            backupDrive: 'Google Drive',
            backupSettingsButton: 'Backup settings',
            close: 'Close',
            driveSettingsToggle: 'Drive settings',
            driveClientIdLabel: 'Client ID',
            driveClientSecretLabel: 'Client Secret',
            driveRefreshTokenLabel: 'Refresh Token',
            driveFieldShow: 'Show',
            driveFieldHide: 'Hide',
            driveSaveSettings: 'Save',
            driveSettingsSaved: 'Drive settings saved.',
            driveMissingConfig: 'Drive credentials are missing.',
            driveDuplicateConfirm: (title, existing, current) => (
                `Drive already has "${title}" with different updated dates.\nExisting: ${existing}\nCurrent: ${current}\nUpload current version?`
            ),
            driveUnknownDate: 'Unknown date',
            rootActiveShort: 'Active',
            rootArchivedShort: 'Archived',
            rootAllShort: 'All',
            groupRootActive: 'Root (Active)',
            groupRootArchived: 'Root (Archived)',
            groupProject: (name) => `Project: ${name}`,
            updatedAt: 'Updated',
            statusFetchingRoot: (label, page) => `📂 ${label} p${page}`,
            statusFetchingProjects: '🔍 Fetching project list…',
            statusFetchingProject: (name) => `📂 Project: ${name}`,
            statusExportRoot: (label, index, total) => `📥 ${label} (${index}/${total})`,
            statusExportProject: (name, index, total) => `📥 ${shortLabel(name)} (${index}/${total})`,
            statusGeneratingZip: '📦 Creating ZIP file…',
            statusUploadingDrive: '☁️ Uploading to Drive…',
            statusDone: '✅ Done',
            statusError: '⚠️ Error',
            alertExportDone: '✅ Export complete!',
            alertExportDoneLocal: '✅ Export complete! File saved locally.',
            alertExportDoneDrive: '✅ Export complete! Uploaded to Drive.',
            alertExportDoneBoth: '✅ Export complete! Saved locally and uploaded to Drive.',
            alertNoAccessToken: 'Unable to get Access Token. Please refresh the page or open any conversation and try again.',
            alertNoWorkspace: 'Please choose or enter a valid Team Workspace ID!',
            alertNoDeviceId: 'Unable to get oai-device-id. Please ensure you are logged in and refresh the page.',
            alertNoSelection: 'Please select at least one conversation.',
            alertNoBackupTarget: 'Please choose at least one backup destination.',
            alertDriveMissingConfig: 'Please fill in your Google Drive credentials first.',
            alertExportFailed: (message) => `Export failed: ${message}. Please check the console (F12 -> Console) for details.`,
            alertSaveCancelled: 'Save location selection was cancelled. Export aborted.',
            alertSaveFailed: (message) => `File could not be saved: ${message}`,
            alertDriveUploadFailed: (message) => `Drive upload failed: ${message}`,
            alertListFailed: (message) => `Failed to load conversations: ${message}`,
            errListRoot: (status) => `Listing root conversations failed (${status})`,
            errListProject: (status) => `Listing project conversations failed (${status})`,
            errGetConversation: (status) => `Fetching conversation failed (${status})`,
            errGetProjects: (status) => `Fetching project list failed (${status})`,
            untitledConversation: 'Untitled Conversation'
        },
        zh: {
            exportButton: '导出对话',
            dialogChooseScope: '选择空间',
            personalTitle: '个人',
            personalDesc: '导出个人空间对话。',
            teamTitle: '团队',
            teamDesc: '导出团队空间对话。',
            cancel: '取消',
            back: '返回',
            next: '下一步',
            exportModeTitle: '选择导出方式',
            exportModeDesc: '可导出全部对话或自选部分对话。',
            exportAllDesc: '导出当前空间内的全部对话。',
            selectDesc: '选择需要导出的指定对话。',
            exportAll: '导出全部 (ZIP)',
            selectConversations: '选择聊天记录',
            teamDialogTitle: '导出团队空间',
            workspaceMultiPrompt: '🔎 检测到多个 Workspace，请选择一个:',
            workspaceMissingTitle: '⚠️ 未能自动检测到 Workspace ID。',
            workspaceMissingTip: '请尝试刷新页面或打开一个团队对话，或在下方手动输入。',
            workspaceManualLabel: '手动输入 Team Workspace ID:',
            workspaceManualPlaceholder: '粘贴您的 Workspace ID (ws-...)',
            selectionTitle: '选择要导出的聊天记录',
            searchPlaceholder: '按标题或位置搜索',
            selectAll: '全选',
            selectVisible: '选中筛选结果',
            clearAll: '清空',
            selectedCount: (selected, total) => `已选择 ${selected} / ${total}`,
            loadingConversations: '加载对话列表中…',
            noConversations: '未找到对话。',
            exportSelected: '导出已选 (ZIP)',
            backupTitle: '备份位置',
            backupDesc: '选择 ZIP 备份的保存位置。',
            backupLocal: '本地文件',
            backupDrive: 'Google Drive',
            backupSettingsButton: '备份设置',
            close: '关闭',
            driveSettingsToggle: 'Drive 设置',
            driveClientIdLabel: 'Client ID',
            driveClientSecretLabel: 'Client Secret',
            driveRefreshTokenLabel: 'Refresh Token',
            driveFieldShow: '显示',
            driveFieldHide: '隐藏',
            driveSaveSettings: '保存',
            driveSettingsSaved: 'Drive 设置已保存。',
            driveMissingConfig: 'Drive 凭据未填写完整。',
            driveDuplicateConfirm: (title, existing, current) => (
                `Drive 中已存在同名聊天记录但更新日期不同：\n已存在：${existing}\n当前：${current}\n是否上传当前版本？\n取消将跳过。`
            ),
            driveUnknownDate: '未知日期',
            rootActiveShort: 'Active',
            rootArchivedShort: 'Archived',
            rootAllShort: 'All',
            groupRootActive: '根目录 (进行中)',
            groupRootArchived: '根目录 (已归档)',
            groupProject: (name) => `项目: ${name}`,
            updatedAt: '更新',
            statusFetchingRoot: (label, page) => `📂 ${label} p${page}`,
            statusFetchingProjects: '🔍 获取项目列表…',
            statusFetchingProject: (name) => `📂 项目: ${name}`,
            statusExportRoot: (label, index, total) => `📥 ${label} (${index}/${total})`,
            statusExportProject: (name, index, total) => `📥 ${shortLabel(name)} (${index}/${total})`,
            statusGeneratingZip: '📦 生成 ZIP 文件…',
            statusUploadingDrive: '☁️ 上传到 Drive…',
            statusDone: '✅ 完成',
            statusError: '⚠️ 错误',
            alertExportDone: '✅ 导出完成！',
            alertExportDoneLocal: '✅ 导出完成！已保存到本地。',
            alertExportDoneDrive: '✅ 导出完成！已上传到 Drive。',
            alertExportDoneBoth: '✅ 导出完成！已保存本地并上传到 Drive。',
            alertNoAccessToken: '无法获取 Access Token。请刷新页面或打开任意一个对话后再试。',
            alertNoWorkspace: '请选择或输入一个有效的 Team Workspace ID！',
            alertNoDeviceId: '无法获取 oai-device-id，请确保已登录并刷新页面。',
            alertNoSelection: '请至少选择一个对话。',
            alertNoBackupTarget: '请至少选择一个备份位置。',
            alertDriveMissingConfig: '请先填写 Google Drive 凭据。',
            alertExportFailed: (message) => `导出失败: ${message}。详情请查看控制台（F12 -> Console）。`,
            alertSaveCancelled: '已取消保存位置选择，未开始导出。',
            alertSaveFailed: (message) => `文件未成功保存：${message}`,
            alertDriveUploadFailed: (message) => `Drive 上传失败: ${message}`,
            alertListFailed: (message) => `加载对话列表失败：${message}`,
            errListRoot: (status) => `列举根目录对话失败 (${status})`,
            errListProject: (status) => `列举项目对话失败 (${status})`,
            errGetConversation: (status) => `获取对话详情失败 (${status})`,
            errGetProjects: (status) => `获取项目列表失败 (${status})`,
            untitledConversation: '未命名对话'
        }
    };

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

    const locale = isChineseLocale() ? 'zh' : 'en';
    const TEXT = I18N[locale] || I18N.en;
    const t = (key, ...args) => {
        const entry = TEXT[key];
        if (typeof entry === 'function') return entry(...args);
        return entry || key;
    };

    const getRootLabelFromArchived = (isArchived) => (
        isArchived ? t('rootArchivedShort') : t('rootActiveShort')
    );

    const getRootExportLabel = (includeActive, includeArchived) => {
        if (includeActive && includeArchived) return t('rootAllShort');
        if (includeArchived) return t('rootArchivedShort');
        return t('rootActiveShort');
    };

    function loadDriveSettings() {
        const fallback = {
            enabled: false,
            clientId: '',
            clientSecret: '',
            refreshToken: '',
            fileName: ''
        };
        try {
            const raw = localStorage.getItem(DRIVE_SETTINGS_KEY);
            if (!raw) return { ...fallback };
            const parsed = JSON.parse(raw);
            return { ...fallback, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
        } catch (error) {
            console.warn('[CGUE Plus] Drive settings parse failed:', error);
            return { ...fallback };
        }
    }

    function normalizeBackupTargets(targets, preferDrive) {
        const prefer = preferDrive === true;
        const local = targets?.local !== false;
        const drive = targets?.drive === true;
        if (local && drive) {
            return prefer ? { local: false, drive: true } : { local: true, drive: false };
        }
        if (!local && !drive) {
            return prefer ? { local: false, drive: true } : { local: true, drive: false };
        }
        return { local, drive };
    }

    function loadBackupTargets(defaultDriveEnabled) {
        const preferDrive = defaultDriveEnabled === true;
        const fallback = normalizeBackupTargets({ local: true, drive: preferDrive }, preferDrive);
        try {
            const raw = localStorage.getItem(BACKUP_TARGETS_KEY);
            if (!raw) return { ...fallback };
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return { ...fallback };
            const local = typeof parsed.local === 'boolean' ? parsed.local : fallback.local;
            const drive = typeof parsed.drive === 'boolean' ? parsed.drive : fallback.drive;
            return normalizeBackupTargets({ local, drive }, preferDrive);
        } catch (error) {
            console.warn('[CGUE Plus] Backup targets parse failed:', error);
            return { ...fallback };
        }
    }

    function loadExportOptions() {
        const fallback = {
            includeRootActive: true,
            includeRootArchived: true
        };
        try {
            const raw = localStorage.getItem(EXPORT_OPTIONS_KEY);
            if (!raw) return { ...fallback };
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return { ...fallback };
            const includeRootActive = typeof parsed.includeRootActive === 'boolean'
                ? parsed.includeRootActive
                : fallback.includeRootActive;
            const includeRootArchived = typeof parsed.includeRootArchived === 'boolean'
                ? parsed.includeRootArchived
                : fallback.includeRootArchived;
            return { includeRootActive, includeRootArchived };
        } catch (error) {
            console.warn('[CGUE Plus] Export options parse failed:', error);
            return { ...fallback };
        }
    }

    let driveAccessToken = '';
    let driveAccessTokenExpireAt = 0;

    const resetDriveAuthCache = () => {
        driveAccessToken = '';
        driveAccessTokenExpireAt = 0;
    };

    function persistDriveSettings(patch = {}) {
        const prev = { ...driveSettings };
        driveSettings = { ...driveSettings, ...patch };
        if (
            prev.clientId !== driveSettings.clientId ||
            prev.clientSecret !== driveSettings.clientSecret ||
            prev.refreshToken !== driveSettings.refreshToken
        ) {
            resetDriveAuthCache();
        }
        try {
            localStorage.setItem(DRIVE_SETTINGS_KEY, JSON.stringify(driveSettings));
        } catch (error) {
            console.warn('[CGUE Plus] Drive settings persist failed:', error);
        }
        return driveSettings;
    }

    function persistBackupTargets(patch = {}) {
        const next = { ...state.backupTargets, ...patch };
        const normalized = normalizeBackupTargets(next, driveSettings.enabled === true);
        state.backupTargets = normalized;
        try {
            localStorage.setItem(BACKUP_TARGETS_KEY, JSON.stringify(normalized));
        } catch (error) {
            console.warn('[CGUE Plus] Backup targets persist failed:', error);
        }
        return normalized;
    }

    function persistExportOptions(patch = {}) {
        const next = { ...state.exportAllOptions, ...patch };
        state.exportAllOptions = next;
        try {
            localStorage.setItem(EXPORT_OPTIONS_KEY, JSON.stringify(next));
        } catch (error) {
            console.warn('[CGUE Plus] Export options persist failed:', error);
        }
        return next;
    }

    const hasDriveCredentials = (settings = driveSettings) => Boolean(
        settings.clientId &&
        settings.clientSecret &&
        settings.refreshToken
    );

    const ensureZipExtension = (name) => {
        const trimmed = (name || '').trim();
        if (!trimmed) return '';
        return trimmed.toLowerCase().endsWith('.zip') ? trimmed : `${trimmed}.zip`;
    };

    const applyFilenameTemplate = (template, data) => {
        if (!template) return '';
        return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
            const value = data[key];
            return value == null ? match : String(value);
        });
    };

    const getTimestampParts = () => {
        const now = new Date();
        return {
            date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
            time: `${pad2(now.getHours())}-${pad2(now.getMinutes())}-${pad2(now.getSeconds())}`
        };
    };

    const buildDriveFilename = (mode, workspaceId) => {
        const rawTemplate = (driveSettings.fileName || '').trim();
        const scopeLabel = mode === 'team' ? 'team' : 'personal';
        const workspaceLabel = mode === 'team' ? (workspaceId || 'team') : 'personal';
        const label = mode === 'team' ? (workspaceId || 'Team') : 'Personal';
        const template = rawTemplate || DRIVE_FILENAME_PLACEHOLDER;
        const { date, time } = getTimestampParts();
        const populated = applyFilenameTemplate(template, {
            date,
            time,
            workspace: workspaceLabel,
            scope: scopeLabel
        });
        const sanitized = sanitizeFilename(populated);
        return ensureZipExtension(sanitized || buildDefaultZipName(label));
    };

    const getDriveFolderName = (mode, workspaceId) => (
        mode === 'team'
            ? (workspaceId || 'Team')
            : 'Personal'
    );

    const formatDriveUploadStatus = (label, index, total) => (
        `☁️ ${label} (${index}/${total})`
    );

    const escapeDriveQueryValue = (value) => (
        String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    );

    const resolveGMRequest = () => {
        try {
            if (typeof GM_xmlhttpRequest === 'function') {
                return GM_xmlhttpRequest;
            }
            if (typeof unsafeWindow !== 'undefined' && typeof unsafeWindow.GM_xmlhttpRequest === 'function') {
                return unsafeWindow.GM_xmlhttpRequest;
            }
            if (typeof window !== 'undefined' && typeof window.GM_xmlhttpRequest === 'function') {
                return window.GM_xmlhttpRequest;
            }
        } catch (_) {
            /* ignore resolution errors */
        }
        return null;
    };

    const resolveDriveFetch = () => {
        try {
            if (typeof fetch === 'function') {
                return fetch;
            }
            if (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function') {
                return globalThis.fetch;
            }
            if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
                return window.fetch.bind(window);
            }
        } catch (_) {
            /* ignore resolution errors */
        }
        return null;
    };

    const performDriveRequest = async ({ method = 'GET', url, headers, body } = {}) => {
        const gmRequest = resolveGMRequest();
        const fetchApi = resolveDriveFetch();
        const isBinary = body && typeof body !== 'string';
        const preference = isBinary ? ['fetch', 'gm'] : ['gm', 'fetch'];
        let lastError = null;

        for (const transport of preference) {
            try {
                if (transport === 'gm' && gmRequest) {
                    const response = await new Promise((resolve, reject) => {
                        const options = {
                            method,
                            url,
                            headers,
                            onload: (res) => {
                                resolve({
                                    status: res.status,
                                    responseText: res.responseText || ''
                                });
                            },
                            onerror: (err) => {
                                const message = err?.error || err?.message || JSON.stringify(err) || 'Unknown error';
                                reject(new Error(message));
                            }
                        };
                        if (body !== undefined && body !== null) {
                            options.data = body;
                            if (isBinary) {
                                options.binary = true;
                            }
                        }
                        gmRequest(options);
                    });
                    return response;
                }
                if (transport === 'fetch' && fetchApi) {
                    const response = await fetchApi(url, {
                        method,
                        headers,
                        body,
                        credentials: 'omit',
                        mode: 'cors',
                        cache: 'no-store'
                    });
                    return {
                        status: response.status,
                        responseText: await response.text()
                    };
                }
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('No request API available for Drive sync.');
    };

    const refreshDriveAccessToken = async () => {
        const body = [
            ['client_id', driveSettings.clientId],
            ['client_secret', driveSettings.clientSecret],
            ['refresh_token', driveSettings.refreshToken],
            ['grant_type', 'refresh_token']
        ]
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value || ''))}`)
            .join('&');
        let response;
        try {
            response = await performDriveRequest({
                method: 'POST',
                url: DRIVE_TOKEN_ENDPOINT,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body
            });
        } catch (error) {
            throw new Error(`Drive token request failed: ${error?.message || String(error)}`);
        }
        const text = response.responseText || '';
        let json = {};
        try {
            json = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error(`Drive token parse failed: ${error?.message || String(error)}`);
        }
        if (response.status >= 200 && response.status < 300) {
            if (json.error) {
                throw new Error(`Drive token error: ${JSON.stringify(json)}`);
            }
            return json;
        }
        throw new Error(`Drive token HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    async function ensureDriveAccessToken() {
        const now = Date.now();
        if (driveAccessToken && now < driveAccessTokenExpireAt - 60000) {
            return driveAccessToken;
        }
        const tokenPayload = await refreshDriveAccessToken();
        driveAccessToken = tokenPayload.access_token;
        const expiresIn = Number(tokenPayload.expires_in) || 3600;
        driveAccessTokenExpireAt = now + expiresIn * 1000;
        return driveAccessToken;
    }

    const formatDriveError = (error) => {
        if (!error) return 'Unknown error';
        if (typeof error === 'string') return error;
        if (error?.message) return error.message;
        try {
            return JSON.stringify(error);
        } catch {
            return String(error);
        }
    };

    const createDriveFolder = async (folderName, parentId) => {
        const token = await ensureDriveAccessToken();
        const metadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
        };
        if (parentId) {
            metadata.parents = [parentId];
        }
        const response = await performDriveRequest({
            method: 'POST',
            url: DRIVE_FILES_ENDPOINT,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify(metadata)
        });
        const text = response.responseText || '';
        let json = {};
        try {
            json = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error(`Drive folder parse failed: ${error?.message || String(error)}`);
        }
        if (response.status >= 200 && response.status < 300) {
            if (json.id) return json.id;
            throw new Error(`Drive folder create failed: ${text || '[empty response]'}`);
        }
        throw new Error(`Drive folder HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    const findDriveFolderId = async (folderName, parentId) => {
        const token = await ensureDriveAccessToken();
        const escaped = escapeDriveQueryValue(folderName);
        const parentFilter = parentId ? ` and '${escapeDriveQueryValue(parentId)}' in parents` : '';
        const query = encodeURIComponent(`name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentFilter}`);
        const response = await performDriveRequest({
            method: 'GET',
            url: `${DRIVE_FILES_ENDPOINT}?q=${query}&fields=files(id,name)&spaces=drive`,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const text = response.responseText || '';
        let json = {};
        try {
            json = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error(`Drive folder lookup parse failed: ${error?.message || String(error)}`);
        }
        if (response.status >= 200 && response.status < 300) {
            const files = Array.isArray(json.files) ? json.files : [];
            return files.length > 0 ? files[0].id : null;
        }
        throw new Error(`Drive folder lookup HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    const ensureDriveFolder = async (folderName, parentId) => {
        const existingId = await findDriveFolderId(folderName, parentId);
        if (existingId) return existingId;
        return createDriveFolder(folderName, parentId);
    };

    const listDriveFilesByConversationId = async (folderId, conversationId) => {
        if (!conversationId) return [];
        const token = await ensureDriveAccessToken();
        const escapedId = escapeDriveQueryValue(String(conversationId));
        const parentFilter = folderId ? ` and '${escapeDriveQueryValue(folderId)}' in parents` : '';
        const query = encodeURIComponent(
            `appProperties has { key='${DRIVE_CONVERSATION_ID_KEY}' and value='${escapedId}' }` +
            ` and mimeType='application/json' and trashed=false${parentFilter}`
        );
        const response = await performDriveRequest({
            method: 'GET',
            url: `${DRIVE_FILES_ENDPOINT}?q=${query}&fields=files(id,name)&spaces=drive`,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        const text = response.responseText || '';
        let json = {};
        try {
            json = text ? JSON.parse(text) : {};
        } catch (error) {
            throw new Error(`Drive file lookup parse failed: ${error?.message || String(error)}`);
        }
        if (response.status >= 200 && response.status < 300) {
            const files = Array.isArray(json.files) ? json.files : [];
            return files.filter((file) => file?.name);
        }
        throw new Error(`Drive file lookup HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    const getDriveExistingNamesByConversationId = async (folderId, conversationId, cache) => {
        if (!conversationId) return new Set();
        if (cache.has(conversationId)) return cache.get(conversationId);
        const files = await listDriveFilesByConversationId(folderId, conversationId);
        const names = new Set(files.map((file) => file?.name).filter(Boolean));
        cache.set(conversationId, names);
        return names;
    };

    const extractDriveDateLabel = (filename) => {
        if (!filename) return null;
        const trimmed = filename.replace(/\.json$/i, '');
        const index = trimmed.lastIndexOf(FILENAME_SEPARATOR);
        if (index === -1) return null;
        const dateLabel = trimmed.slice(index + FILENAME_SEPARATOR.length);
        return dateLabel || null;
    };

    const shouldUploadToDrive = async (folderId, fileInfo, cache) => {
        if (!fileInfo?.conversationId) {
            return { shouldUpload: true, existingNames: new Set() };
        }
        const existingNames = await getDriveExistingNamesByConversationId(folderId, fileInfo.conversationId, cache);
        if (existingNames.size === 0) {
            return { shouldUpload: true, existingNames };
        }
        let hasSameDate = false;
        const existingDates = new Set();
        existingNames.forEach((name) => {
            const dateLabel = extractDriveDateLabel(name);
            if (dateLabel && dateLabel === fileInfo.dateLabel) {
                hasSameDate = true;
            } else {
                existingDates.add(dateLabel || t('driveUnknownDate'));
            }
        });
        if (hasSameDate) {
            return { shouldUpload: false, existingNames };
        }
        const confirmed = confirm(t(
            'driveDuplicateConfirm',
            fileInfo.displayTitle,
            Array.from(existingDates).join(', '),
            fileInfo.dateLabel || t('driveUnknownDate')
        ));
        if (!confirmed) {
            return { shouldUpload: false, existingNames };
        }
        return { shouldUpload: true, existingNames };
    };

    const uploadJsonToDrive = async (content, fileInfo, folderId) => {
        const token = await ensureDriveAccessToken();
        const boundary = `cgueBoundary${Date.now()}`;
        const metadata = {
            name: fileInfo?.filename || 'conversation.json',
            mimeType: 'application/json'
        };
        if (fileInfo?.conversationId) {
            metadata.appProperties = {
                [DRIVE_CONVERSATION_ID_KEY]: String(fileInfo.conversationId)
            };
        }
        if (folderId) {
            metadata.parents = [folderId];
        }
        const multipartBody = new Blob([
            `--${boundary}\r\n`,
            'Content-Type: application/json; charset=UTF-8\r\n\r\n',
            JSON.stringify(metadata),
            '\r\n',
            `--${boundary}\r\n`,
            'Content-Type: application/json; charset=UTF-8\r\n\r\n',
            content,
            `\r\n--${boundary}--`
        ], { type: `multipart/related; boundary=${boundary}` });

        const response = await performDriveRequest({
            method: 'POST',
            url: `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        const text = response.responseText || '';
        if (response.status >= 200 && response.status < 300) {
            return text ? JSON.parse(text) : {};
        }
        throw new Error(`Drive upload HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    const uploadZipToDrive = async (blob, mode, workspaceId) => {
        if (!hasDriveCredentials()) {
            throw new Error(t('alertDriveMissingConfig'));
        }
        const token = await ensureDriveAccessToken();
        const filename = buildDriveFilename(mode, workspaceId);
        const boundary = `cgueBoundary${Date.now()}`;
        const metadata = {
            name: filename,
            mimeType: 'application/zip'
        };
        const multipartBody = new Blob([
            `--${boundary}\r\n`,
            'Content-Type: application/json; charset=UTF-8\r\n\r\n',
            JSON.stringify(metadata),
            '\r\n',
            `--${boundary}\r\n`,
            'Content-Type: application/zip\r\n\r\n',
            blob,
            `\r\n--${boundary}--`
        ], { type: `multipart/related; boundary=${boundary}` });

        const response = await performDriveRequest({
            method: 'POST',
            url: `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        const text = response.responseText || '';
        if (response.status >= 200 && response.status < 300) {
            return text ? JSON.parse(text) : {};
        }
        throw new Error(`Drive upload HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    const resolveBackupTargets = () => {
        const targets = normalizeBackupTargets(state.backupTargets, driveSettings.enabled === true);
        state.backupTargets = targets;
        if (!targets.local && !targets.drive) {
            alert(t('alertNoBackupTarget'));
            return null;
        }
        if (targets.drive && !hasDriveCredentials()) {
            if (!targets.local) {
                alert(t('alertDriveMissingConfig'));
                return null;
            }
            alert(t('alertDriveMissingConfig'));
            targets.drive = false;
        }
        return targets;
    };

    (function interceptNetwork() {
        const targetWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
        if (targetWindow && typeof targetWindow.fetch === 'function') {
            const rawFetch = targetWindow.fetch;
            targetWindow.fetch = async function (resource, options) {
                tryCaptureToken(options?.headers);
                const headerSource = options?.headers;
                let accountId = null;
                if (headerSource instanceof Headers) {
                    accountId = headerSource.get('ChatGPT-Account-Id') || headerSource.get('chatgpt-account-id');
                } else if (headerSource) {
                    accountId = headerSource['ChatGPT-Account-Id'] || headerSource['chatgpt-account-id'];
                }
                if (accountId && !capturedWorkspaceIds.has(accountId)) {
                    console.log('🎯 [Fetch] Captured Workspace ID:', accountId);
                    capturedWorkspaceIds.add(accountId);
                }
                return rawFetch.apply(this, arguments);
            };
        }

        const xhrProto = targetWindow?.XMLHttpRequest?.prototype;
        if (xhrProto && typeof xhrProto.setRequestHeader === 'function') {
            const rawSetRequestHeader = xhrProto.setRequestHeader;
            xhrProto.setRequestHeader = function (name, value) {
                const lower = String(name || '').toLowerCase();
                if (lower === 'authorization') {
                    tryCaptureToken(value);
                }
                if (lower === 'chatgpt-account-id' && value && !capturedWorkspaceIds.has(value)) {
                    console.log('🎯 [XHR] Captured Workspace ID:', value);
                    capturedWorkspaceIds.add(value);
                }
                return rawSetRequestHeader.apply(this, arguments);
            };
        }
    })();

    function tryCaptureToken(header) {
        if (!header) return;
        const h = typeof header === 'string'
            ? header
            : header instanceof Headers
                ? header.get('Authorization') || header.get('authorization')
                : header.Authorization || header.authorization;
        if (h?.startsWith('Bearer ')) {
            const token = h.slice(7);
            if (token && token.toLowerCase() !== 'dummy') {
                accessToken = token;
            }
        }
    }

    async function ensureAccessToken() {
        if (accessToken) return accessToken;
        try {
            const session = await (await fetch('/api/auth/session?unstable_client=true')).json();
            if (session.accessToken) {
                accessToken = session.accessToken;
                return accessToken;
            }
        } catch (_) {}
        alert(t('alertNoAccessToken'));
        return null;
    }

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const jitter = () => BASE_DELAY + Math.random() * JITTER;
    const sanitizeFilename = (name) => (name || '').replace(/[\/\\?%*:|"<>|\uFF5C]/g, '-').trim();

    function getOaiDeviceId() {
        const cookieString = document.cookie;
        const match = cookieString.match(/oai-did=([^;]+)/);
        return match ? match[1] : null;
    }

    const formatFilenameDateLabel = (updatedAtMs) => {
        const safeMs = typeof updatedAtMs === 'number' && !Number.isNaN(updatedAtMs)
            ? updatedAtMs
            : Date.now();
        const d = new Date(safeMs);
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
    };

    const resolveConversationUpdatedAtMs = (convData, fallbackMs) => {
        const resolved = normalizeTimestamp(
            convData?.update_time ??
            convData?.updated_time ??
            convData?.updatedAt ??
            convData?.last_message_at
        );
        if (resolved != null) return resolved;
        if (typeof fallbackMs === 'number' && !Number.isNaN(fallbackMs)) return fallbackMs;
        return Date.now();
    };

    const buildConversationFileInfo = (convData, updatedAtMs) => {
        const displayTitle = normalizeConversationTitle(convData?.title || convData?.name || convData?.display_name);
        const baseTitle = sanitizeFilename(displayTitle || t('untitledConversation')) || t('untitledConversation');
        const dateLabel = formatFilenameDateLabel(resolveConversationUpdatedAtMs(convData, updatedAtMs));
        const conversationId = extractConversationId(convData);
        return {
            filename: `${baseTitle}${FILENAME_SEPARATOR}${dateLabel}.json`,
            baseTitle,
            dateLabel,
            displayTitle,
            conversationId
        };
    };

    function generateUniqueFilename(convData, updatedAtMs) {
        return buildConversationFileInfo(convData, updatedAtMs).filename;
    }

    function downloadFile(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

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

    function buildDownloadFilename(mode, workspaceId) {
        const date = new Date().toISOString().slice(0, 10);
        if (mode === 'team') {
            return `chatgpt_team_backup_${workspaceId}_${date}.zip`;
        }
        return `chatgpt_personal_backup_${date}.zip`;
    }

    async function promptSaveHandle(defaultLabel) {
        if (typeof window.showSaveFilePicker !== 'function') return null;
        const suggestedName = buildDefaultZipName(defaultLabel);
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

    async function prepareSaveHandle(mode, workspaceId) {
        if (typeof window.showSaveFilePicker !== 'function') return null;
        const label = mode === 'team' ? workspaceId || 'Team' : 'Personal';
        try {
            return await promptSaveHandle(label);
        } catch (err) {
            if (err && err.name === 'AbortError') {
                return 'cancelled';
            }
            console.warn('[CGUE Plus] showSaveFilePicker failed:', err);
            return null;
        }
    }

    async function saveZipFile(blob, mode, workspaceId, saveHandle) {
        if (saveHandle) {
            if (!saveHandle.createWritable) {
                const err = new Error('File handle is not writable');
                err.__isSaveError = true;
                throw err;
            }
            // Use File System Access API when available (Arc fix behavior).
            try {
                const writable = await saveHandle.createWritable();
                await writable.write(blob);
                await writable.close();
            } catch (err) {
                err.__isSaveError = true;
                throw err;
            }
            return;
        }
        const filename = buildDownloadFilename(mode, workspaceId);
        downloadFile(blob, filename);
    }

    function buildHeaders(workspaceId) {
        const deviceId = getOaiDeviceId();
        if (!deviceId) {
            throw new Error(t('alertNoDeviceId'));
        }
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'oai-device-id': deviceId
        };
        if (workspaceId) {
            headers['ChatGPT-Account-Id'] = workspaceId;
        }
        return headers;
    }

    async function getProjects(workspaceId) {
        if (!workspaceId) return [];
        const headers = buildHeaders(workspaceId);
        const r = await fetch('/backend-api/gizmos/snorlax/sidebar', { headers });
        if (!r.ok) {
            throw new Error(t('errGetProjects', r.status));
        }
        const data = await r.json();
        const projects = [];
        data.items?.forEach((item) => {
            if (item?.gizmo?.id && item?.gizmo?.display?.name) {
                projects.push({ id: item.gizmo.id, title: item.gizmo.display.name });
            }
        });
        return projects;
    }

    async function collectIds(btn, workspaceId, gizmoId, options = {}) {
        const all = new Set();
        const headers = buildHeaders(workspaceId);

        if (gizmoId) {
            let cursor = '0';
            do {
                const r = await fetch(`/backend-api/gizmos/${gizmoId}/conversations?cursor=${cursor}`, { headers });
                if (!r.ok) throw new Error(t('errListProject', r.status));
                const j = await r.json();
                j.items?.forEach((it) => all.add(it.id));
                cursor = j.cursor;
                await sleep(jitter());
            } while (cursor);
        } else {
            const includeActive = options.includeActive !== false;
            const includeArchived = options.includeArchived !== false;
            const archivedStates = [];
            if (includeActive) archivedStates.push(false);
            if (includeArchived) archivedStates.push(true);
            for (const isArchived of archivedStates) {
                let offset = 0;
                let hasMore = true;
                let page = 0;
                do {
                    if (btn) {
                        btn.textContent = t('statusFetchingRoot', getRootLabelFromArchived(isArchived), ++page);
                    }
                    const r = await fetch(`/backend-api/conversations?offset=${offset}&limit=${PAGE_LIMIT}&order=updated${isArchived ? '&is_archived=true' : ''}`, { headers });
                    if (!r.ok) throw new Error(t('errListRoot', r.status));
                    const j = await r.json();
                    if (j.items && j.items.length > 0) {
                        j.items.forEach((it) => all.add(it.id));
                        hasMore = j.items.length === PAGE_LIMIT;
                        offset += j.items.length;
                    } else {
                        hasMore = false;
                    }
                    await sleep(jitter());
                } while (hasMore);
            }
        }
        return Array.from(all);
    }

    async function getConversation(id, workspaceId) {
        const headers = buildHeaders(workspaceId);
        const r = await fetch(`/backend-api/conversation/${id}`, { headers });
        if (!r.ok) throw new Error(t('errGetConversation', r.status));
        const j = await r.json();
        j.__fetched_at = new Date().toISOString();
        return j;
    }

    function normalizeTimestamp(value) {
        if (value == null) return null;
        const num = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(num)) {
            const parsed = Date.parse(value);
            return Number.isNaN(parsed) ? null : parsed;
        }
        return num > 1e12 ? num : num * 1000;
    }

    function formatDateTime(ms) {
        const d = new Date(ms);
        const year = d.getFullYear();
        const month = pad2(d.getMonth() + 1);
        const day = pad2(d.getDate());
        const hours = pad2(d.getHours());
        const minutes = pad2(d.getMinutes());
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }

    function extractConversationId(item) {
        return item?.id || item?.conversation_id || item?.conversationId || item?.uuid || null;
    }

    function normalizeConversationTitle(title) {
        const trimmed = (title || '').trim();
        if (!trimmed || trimmed.toLowerCase() === 'new chat') {
            return t('untitledConversation');
        }
        return trimmed;
    }

    async function listRootConversations(workspaceId, isArchived, onProgress) {
        const headers = buildHeaders(workspaceId);
        let offset = 0;
        let page = 0;
        const items = [];
        let hasMore = true;
        while (hasMore) {
            page += 1;
            if (onProgress) {
                onProgress({ stage: 'root', isArchived, page });
            }
            const r = await fetch(`/backend-api/conversations?offset=${offset}&limit=${PAGE_LIMIT}&order=updated${isArchived ? '&is_archived=true' : ''}`, { headers });
            if (!r.ok) throw new Error(t('errListRoot', r.status));
            const j = await r.json();
            const chunk = Array.isArray(j.items) ? j.items : [];
            items.push(...chunk);
            hasMore = chunk.length === PAGE_LIMIT;
            offset += chunk.length;
            if (hasMore) {
                await sleep(jitter());
            }
        }
        return items;
    }

    async function listProjectConversations(workspaceId, projectId, projectTitle, onProgress) {
        const headers = buildHeaders(workspaceId);
        let cursor = '0';
        let page = 0;
        const items = [];
        do {
            page += 1;
            if (onProgress) {
                onProgress({ stage: 'project', projectTitle, page });
            }
            const r = await fetch(`/backend-api/gizmos/${projectId}/conversations?cursor=${cursor}`, { headers });
            if (!r.ok) throw new Error(t('errListProject', r.status));
            const j = await r.json();
            const chunk = Array.isArray(j.items) ? j.items : [];
            items.push(...chunk);
            cursor = j.cursor;
            if (cursor) {
                await sleep(jitter());
            }
        } while (cursor);
        return items;
    }

    async function collectConversationIndex(workspaceId, onProgress) {
        const groups = [];
        const groupMap = new Map();
        const itemMap = new Map();
        const items = [];

        const ensureGroup = (key, label, projectId, projectTitle) => {
            if (groupMap.has(key)) return groupMap.get(key);
            const group = { key, label, projectId: projectId || null, projectTitle: projectTitle || null, items: [] };
            groupMap.set(key, group);
            groups.push(group);
            return group;
        };

        const addItem = (group, rawItem, options) => {
            const id = extractConversationId(rawItem);
            if (!id || itemMap.has(id)) return;
            const updatedAtMs = normalizeTimestamp(rawItem.update_time ?? rawItem.updated_time ?? rawItem.updatedAt ?? rawItem.last_message_at);
            const item = {
                id,
                title: normalizeConversationTitle(rawItem.title || rawItem.name || rawItem.display_name),
                updatedAtMs,
                groupKey: group.key,
                groupLabel: group.label,
                projectId: options.projectId || null,
                projectTitle: options.projectTitle || null
            };
            itemMap.set(id, item);
            group.items.push(item);
            items.push(item);
        };

        const rootActiveGroup = ensureGroup('root-active', t('groupRootActive'));
        const rootActiveItems = await listRootConversations(workspaceId, false, onProgress);
        rootActiveItems.forEach((item) => addItem(rootActiveGroup, item, {}));

        const rootArchivedGroup = ensureGroup('root-archived', t('groupRootArchived'));
        const rootArchivedItems = await listRootConversations(workspaceId, true, onProgress);
        rootArchivedItems.forEach((item) => addItem(rootArchivedGroup, item, {}));

        if (onProgress) {
            onProgress({ stage: 'projects' });
        }

        const projects = await getProjects(workspaceId);
        for (const project of projects) {
            const group = ensureGroup(`project:${project.id}`, t('groupProject', project.title), project.id, project.title);
            if (onProgress) {
                onProgress({ stage: 'project-header', projectTitle: project.title });
            }
            const projectItems = await listProjectConversations(workspaceId, project.id, project.title, onProgress);
            projectItems.forEach((item) => addItem(group, item, { projectId: project.id, projectTitle: project.title }));
        }

        groups.forEach((group) => {
            group.items.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
        });

        return { items, groups, itemMap };
    }

    function detectAllWorkspaceIds() {
        const foundIds = new Set(capturedWorkspaceIds);

        try {
            const data = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent || '{}');
            const accounts = data?.props?.pageProps?.user?.accounts;
            if (accounts) {
                Object.values(accounts).forEach((acc) => {
                    if (acc?.account?.id) {
                        foundIds.add(acc.account.id);
                    }
                });
            }
        } catch (_) {}

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key || (!key.includes('account') && !key.includes('workspace'))) continue;
                const value = localStorage.getItem(key);
                if (!value) continue;
                const cleaned = value.replace(/"/g, '');
                const wsMatch = cleaned.match(/ws-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
                if (wsMatch) {
                    foundIds.add(wsMatch[0]);
                } else if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(cleaned)) {
                    foundIds.add(cleaned);
                }
            }
        } catch (_) {}

        console.log('🔍 Workspace IDs detected:', Array.from(foundIds));
        return Array.from(foundIds);
    }

    function getExportButton() {
        return document.getElementById(EXPORT_BUTTON_ID);
    }

    function setButtonIdle(btn) {
        if (!btn) return;
        btn.textContent = ICON_LABEL;
        btn.title = t('exportButton');
        btn.setAttribute('aria-label', t('exportButton'));
    }

    function setButtonStatus(text) {
        const btn = getExportButton();
        if (!btn) return;
        btn.textContent = text;
    }

    function scheduleReset(statusText) {
        const btn = getExportButton();
        if (btn) {
            btn.textContent = statusText;
        }
        setTimeout(() => {
            state.isExporting = false;
            const freshBtn = getExportButton();
            if (freshBtn) {
                freshBtn.disabled = false;
                setButtonIdle(freshBtn);
            }
        }, 2500);
    }

    async function finalizeExport(blob, mode, workspaceId, saveHandle, backupTargets, driveResult) {
        const targets = backupTargets || state.backupTargets;
        const result = {
            localOk: false,
            driveOk: false,
            localError: null,
            driveError: null
        };

        if (targets.local) {
            if (!blob) {
                result.localError = new Error('ZIP blob is not available');
            } else {
                try {
                    await saveZipFile(blob, mode, workspaceId, saveHandle);
                    result.localOk = true;
                } catch (err) {
                    result.localError = err;
                }
            }
        }

        if (targets.drive) {
            if (driveResult) {
                result.driveOk = driveResult.ok === true;
                result.driveError = driveResult.error || null;
            } else {
                try {
                    setButtonStatus(t('statusUploadingDrive'));
                    await uploadZipToDrive(blob, mode, workspaceId);
                    result.driveOk = true;
                } catch (err) {
                    result.driveError = err;
                }
            }
        }

        return result;
    }

    async function exportAllConversations(mode, workspaceId, saveHandle, options = {}, backupTargets) {
        const btn = getExportButton();
        if (btn) btn.disabled = true;
        state.isExporting = true;

        if (!await ensureAccessToken()) {
            scheduleReset(t('statusError'));
            return;
        }

        let finalStatus = t('statusDone');
        try {
            const targets = backupTargets || state.backupTargets;
            const zip = targets.local ? new JSZip() : null;
            const driveCache = new Map();
            let driveFolderId = null;
            let driveError = null;

            if (targets.drive) {
                try {
                    setButtonStatus(t('statusUploadingDrive'));
                    const rootFolderId = await ensureDriveFolder(DRIVE_ROOT_FOLDER_NAME);
                    driveFolderId = await ensureDriveFolder(getDriveFolderName(mode, workspaceId), rootFolderId);
                } catch (err) {
                    driveError = err;
                }
            }

            const includeRootActive = options.includeRootActive !== false;
            const includeRootArchived = options.includeRootArchived !== false;
            const rootExportLabel = getRootExportLabel(includeRootActive, includeRootArchived);
            let rootIds = [];
            if (includeRootActive || includeRootArchived) {
                const initialArchived = includeRootActive ? false : true;
                setButtonStatus(t('statusFetchingRoot', getRootLabelFromArchived(initialArchived), 1));
                rootIds = await collectIds(btn, workspaceId, null, {
                    includeActive: includeRootActive,
                    includeArchived: includeRootArchived
                });
            }
            for (let i = 0; i < rootIds.length; i++) {
                setButtonStatus(t('statusExportRoot', rootExportLabel, i + 1, rootIds.length));
                const convData = await getConversation(rootIds[i], workspaceId);
                const fileInfo = buildConversationFileInfo(convData);
                const payload = JSON.stringify(convData, null, 2);
                if (zip) {
                    zip.file(fileInfo.filename, payload);
                }
                if (driveFolderId && !driveError) {
                    try {
                        setButtonStatus(formatDriveUploadStatus(rootExportLabel, i + 1, rootIds.length));
                        const decision = await shouldUploadToDrive(driveFolderId, fileInfo, driveCache);
                        if (decision.shouldUpload) {
                            await uploadJsonToDrive(payload, fileInfo, driveFolderId);
                            decision.existingNames.add(fileInfo.filename);
                        }
                    } catch (err) {
                        driveError = err;
                    }
                }
                await sleep(jitter());
            }

            setButtonStatus(t('statusFetchingProjects'));
            const projects = await getProjects(workspaceId);
            for (const project of projects) {
                const projectFolder = zip ? zip.folder(sanitizeFilename(project.title)) : null;
                setButtonStatus(t('statusFetchingProject', project.title));
                const projectConvIds = await collectIds(btn, workspaceId, project.id);
                if (projectConvIds.length === 0) continue;
                for (let i = 0; i < projectConvIds.length; i++) {
                    setButtonStatus(t('statusExportProject', project.title, i + 1, projectConvIds.length));
                    const convData = await getConversation(projectConvIds[i], workspaceId);
                    const fileInfo = buildConversationFileInfo(convData);
                    const payload = JSON.stringify(convData, null, 2);
                    if (projectFolder) {
                        projectFolder.file(fileInfo.filename, payload);
                    }
                    if (driveFolderId && !driveError) {
                        try {
                            setButtonStatus(formatDriveUploadStatus(shortLabel(project.title), i + 1, projectConvIds.length));
                            const decision = await shouldUploadToDrive(driveFolderId, fileInfo, driveCache);
                            if (decision.shouldUpload) {
                                await uploadJsonToDrive(payload, fileInfo, driveFolderId);
                                decision.existingNames.add(fileInfo.filename);
                            }
                        } catch (err) {
                            driveError = err;
                        }
                    }
                    await sleep(jitter());
                }
            }

            let blob = null;
            if (zip) {
                setButtonStatus(t('statusGeneratingZip'));
                blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            }
            const driveResult = targets.drive
                ? { ok: Boolean(driveFolderId && !driveError), error: driveError }
                : null;
            const backupResult = await finalizeExport(blob, mode, workspaceId, saveHandle, targets, driveResult);
            if (backupResult.localError) {
                if (backupResult.localError.__isSaveError) {
                    alert(t('alertSaveFailed', backupResult.localError?.message || String(backupResult.localError)));
                } else {
                    alert(t('alertExportFailed', backupResult.localError?.message || String(backupResult.localError)));
                }
            }
            if (backupResult.driveError) {
                alert(t('alertDriveUploadFailed', formatDriveError(backupResult.driveError)));
            }
            const completionMessage = backupResult.localOk && backupResult.driveOk
                ? t('alertExportDoneBoth')
                : backupResult.driveOk
                    ? t('alertExportDoneDrive')
                    : backupResult.localOk
                        ? t('alertExportDoneLocal')
                        : '';
            if (completionMessage) {
                alert(completionMessage);
            } else {
                finalStatus = t('statusError');
            }
        } catch (err) {
            console.error('Export failed:', err);
            if (err?.__isSaveError) {
                alert(t('alertSaveFailed', err?.message || String(err)));
            } else {
                alert(t('alertExportFailed', err?.message || String(err)));
            }
            finalStatus = t('statusError');
        } finally {
            scheduleReset(finalStatus);
        }
    }

    async function exportSelectedConversations(mode, workspaceId, index, selectedIds, saveHandle, backupTargets) {
        const btn = getExportButton();
        if (btn) btn.disabled = true;
        state.isExporting = true;

        if (!await ensureAccessToken()) {
            scheduleReset(t('statusError'));
            return;
        }

        let finalStatus = t('statusDone');
        try {
            const targets = backupTargets || state.backupTargets;
            const zip = targets.local ? new JSZip() : null;
            const driveCache = new Map();
            let driveFolderId = null;
            let driveError = null;

            if (targets.drive) {
                try {
                    setButtonStatus(t('statusUploadingDrive'));
                    const rootFolderId = await ensureDriveFolder(DRIVE_ROOT_FOLDER_NAME);
                    driveFolderId = await ensureDriveFolder(getDriveFolderName(mode, workspaceId), rootFolderId);
                } catch (err) {
                    driveError = err;
                }
            }

            const selectionSet = new Set(selectedIds);
            const projectFolders = new Map();
            const totalSelected = index.items.filter((item) => selectionSet.has(item.id));

            if (totalSelected.length === 0) {
                alert(t('alertNoSelection'));
                finalStatus = t('statusError');
                return;
            }

            let processed = 0;
            for (const group of index.groups) {
                const groupItems = group.items.filter((item) => selectionSet.has(item.id));
                if (groupItems.length === 0) continue;
                for (const item of groupItems) {
                    processed += 1;
                    if (group.projectTitle) {
                        const folderKey = group.projectId || group.key;
                        let folder = projectFolders.get(folderKey);
                        if (!folder && zip) {
                            folder = zip.folder(sanitizeFilename(group.projectTitle));
                            projectFolders.set(folderKey, folder);
                        }
                        setButtonStatus(t('statusExportProject', group.projectTitle, processed, totalSelected.length));
                        const convData = await getConversation(item.id, workspaceId);
                        const fileInfo = buildConversationFileInfo(convData, item.updatedAtMs);
                        const payload = JSON.stringify(convData, null, 2);
                        if (folder) {
                            folder.file(fileInfo.filename, payload);
                        }
                        if (driveFolderId && !driveError) {
                            try {
                                setButtonStatus(formatDriveUploadStatus(shortLabel(group.projectTitle), processed, totalSelected.length));
                                const decision = await shouldUploadToDrive(driveFolderId, fileInfo, driveCache);
                                if (decision.shouldUpload) {
                                    await uploadJsonToDrive(payload, fileInfo, driveFolderId);
                                    decision.existingNames.add(fileInfo.filename);
                                }
                            } catch (err) {
                                driveError = err;
                            }
                        }
                    } else {
                        const rootLabel = group.key === 'root-archived'
                            ? t('rootArchivedShort')
                            : t('rootActiveShort');
                        setButtonStatus(t('statusExportRoot', rootLabel, processed, totalSelected.length));
                        const convData = await getConversation(item.id, workspaceId);
                        const fileInfo = buildConversationFileInfo(convData, item.updatedAtMs);
                        const payload = JSON.stringify(convData, null, 2);
                        if (zip) {
                            zip.file(fileInfo.filename, payload);
                        }
                        if (driveFolderId && !driveError) {
                            try {
                                setButtonStatus(formatDriveUploadStatus(rootLabel, processed, totalSelected.length));
                                const decision = await shouldUploadToDrive(driveFolderId, fileInfo, driveCache);
                                if (decision.shouldUpload) {
                                    await uploadJsonToDrive(payload, fileInfo, driveFolderId);
                                    decision.existingNames.add(fileInfo.filename);
                                }
                            } catch (err) {
                                driveError = err;
                            }
                        }
                    }
                    await sleep(jitter());
                }
            }

            let blob = null;
            if (zip) {
                setButtonStatus(t('statusGeneratingZip'));
                blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
            }
            const driveResult = targets.drive
                ? { ok: Boolean(driveFolderId && !driveError), error: driveError }
                : null;
            const backupResult = await finalizeExport(blob, mode, workspaceId, saveHandle, targets, driveResult);
            if (backupResult.localError) {
                if (backupResult.localError.__isSaveError) {
                    alert(t('alertSaveFailed', backupResult.localError?.message || String(backupResult.localError)));
                } else {
                    alert(t('alertExportFailed', backupResult.localError?.message || String(backupResult.localError)));
                }
            }
            if (backupResult.driveError) {
                alert(t('alertDriveUploadFailed', formatDriveError(backupResult.driveError)));
            }
            const completionMessage = backupResult.localOk && backupResult.driveOk
                ? t('alertExportDoneBoth')
                : backupResult.driveOk
                    ? t('alertExportDoneDrive')
                    : backupResult.localOk
                        ? t('alertExportDoneLocal')
                        : '';
            if (completionMessage) {
                alert(completionMessage);
            } else {
                finalStatus = t('statusError');
            }
        } catch (err) {
            console.error('Export failed:', err);
            if (err?.__isSaveError) {
                alert(t('alertSaveFailed', err?.message || String(err)));
            } else {
                alert(t('alertExportFailed', err?.message || String(err)));
            }
            finalStatus = t('statusError');
        } finally {
            scheduleReset(finalStatus);
        }
    }

    function addStyles() {
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
            }
            .cgue-icon-btn {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-card);
                color: var(--cgue-text);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 14px;
            }
            .cgue-icon-btn:hover {
                background: var(--cgue-hover);
            }
            .cgue-icon-btn:active {
                transform: scale(0.98);
            }
            #${BACKUP_OVERLAY_ID} {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--cgue-overlay);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
            }
            #${BACKUP_DIALOG_ID} {
                background: var(--cgue-surface);
                color: var(--cgue-text);
                border: 1px solid var(--cgue-border);
                box-shadow: var(--cgue-shadow);
                border-radius: 12px;
                width: 460px;
                max-width: calc(100% - 32px);
                max-height: calc(100% - 32px);
                overflow: auto;
                padding: 20px;
                box-sizing: border-box;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            #${BACKUP_DIALOG_ID} p {
                margin: 6px 0 0;
                color: var(--cgue-muted);
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
            .cgue-backup-option span {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 6px 14px;
                border-radius: 999px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-surface);
                color: var(--cgue-text);
                font-size: 12px;
                font-weight: 600;
                transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
            }
            .cgue-backup-option input:checked + span {
                background: var(--cgue-primary);
                border-color: var(--cgue-primary);
                color: var(--cgue-on-primary);
                box-shadow: var(--cgue-primary-shadow);
            }
            .cgue-backup-option input:focus-visible + span {
                outline: 2px solid var(--cgue-primary);
                outline-offset: 2px;
            }
            .cgue-backup-option:active span {
                transform: translateY(1px);
            }
            .cgue-btn-ghost {
                border: 1px dashed var(--cgue-border);
                background: transparent;
            }
            .cgue-drive-settings-toggle {
                margin-top: 10px;
            }
            .cgue-drive-settings-wrap[data-visible="false"] {
                display: none;
            }
            .cgue-caret {
                margin-left: 6px;
                font-size: 11px;
                opacity: 0.75;
            }
            .cgue-drive-settings {
                margin-top: 10px;
                padding: 10px;
                border-radius: 10px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-surface);
                display: none;
            }
            .cgue-drive-settings[data-open="true"] {
                display: block;
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
                gap: 6px;
                font-size: 12px;
                color: var(--cgue-text);
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
            .cgue-drive-actions .cgue-status {
                margin-top: 0;
            }
            .cgue-status.cgue-success {
                color: #16a34a;
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
            .cgue-card-icon-btn {
                display: flex;
                align-items: center;
                gap: 14px;
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
                .cgue-card-row {
                    flex-direction: column;
                    align-items: flex-start;
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
            .cgue-workspace-row {
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }
            .cgue-workspace-row code {
                margin-top: 0;
            }
            .cgue-workspace-list .cgue-workspace-row {
                margin-left: 8px;
            }
            .cgue-workspace-index {
                font-size: 12px;
                font-weight: 600;
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

    function closeDialog() {
        closeBackupSettingsDialog();
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) overlay.remove();
    }

    function setScope(scope, workspaceId) {
        if (state.scope !== scope || state.workspaceId !== workspaceId) {
            state.scope = scope;
            state.workspaceId = workspaceId;
            state.index = null;
            state.selectedIds = new Set();
        }
    }

    function bindCardAction(element, handler) {
        if (!element) return;
        const shouldIgnore = (event) => {
            if (!event || !(event.target instanceof Element)) return false;
            return !!event.target.closest('.cgue-card-controls');
        };
        element.addEventListener('click', (event) => {
            if (shouldIgnore(event)) return;
            handler();
        });
        element.addEventListener('keydown', (event) => {
            if (shouldIgnore(event)) return;
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                handler();
            }
        });
    }

    function renderBackupSection() {
        const localEnabled = state.backupTargets.local !== false;
        const driveEnabled = state.backupTargets.drive === true;
        const driveOpen = state.driveSettingsExpanded === true;
        const clientId = escapeHtml(driveSettings.clientId || '');
        const clientSecret = escapeHtml(driveSettings.clientSecret || '');
        const refreshToken = escapeHtml(driveSettings.refreshToken || '');

        return `
            <section class="cgue-backup">
                <div class="cgue-backup-options" role="radiogroup" aria-label="${t('backupTitle')}">
                    <label class="cgue-backup-option">
                        <input id="cgue-backup-local" type="radio" name="cgue-backup-target" value="local" ${localEnabled ? 'checked' : ''}>
                        <span>${t('backupLocal')}</span>
                    </label>
                    <label class="cgue-backup-option">
                        <input id="cgue-backup-drive" type="radio" name="cgue-backup-target" value="drive" ${driveEnabled ? 'checked' : ''}>
                        <span>${t('backupDrive')}</span>
                    </label>
                </div>
                <div id="cgue-drive-settings-wrap" class="cgue-drive-settings-wrap" data-visible="${driveEnabled ? 'true' : 'false'}">
                    <button id="cgue-drive-settings-toggle" class="cgue-btn cgue-btn-ghost cgue-drive-settings-toggle" type="button">
                        ${t('driveSettingsToggle')}
                        <span class="cgue-caret" id="cgue-drive-settings-caret">${driveOpen ? '▲' : '▼'}</span>
                    </button>
                    <div id="cgue-drive-settings" class="cgue-drive-settings" data-open="${driveOpen ? 'true' : 'false'}">
                        <div class="cgue-drive-fields">
                            <label>
                                <span class="cgue-field-label">${t('driveClientIdLabel')}</span>
                                <input id="cgue-drive-client-id" class="cgue-input" type="text" autocomplete="off" spellcheck="false" value="${clientId}">
                            </label>
                            <label>
                                <span class="cgue-field-label">${t('driveClientSecretLabel')}</span>
                                <div class="cgue-input-shell">
                                    <input id="cgue-drive-client-secret" class="cgue-input" type="password" autocomplete="off" spellcheck="false" value="${clientSecret}">
                                    <button id="cgue-drive-client-secret-toggle" class="cgue-input-toggle" type="button" data-label="${t('driveClientSecretLabel')}" aria-pressed="false">${t('driveFieldShow')}</button>
                                </div>
                            </label>
                            <label>
                                <span class="cgue-field-label">${t('driveRefreshTokenLabel')}</span>
                                <div class="cgue-input-shell">
                                    <input id="cgue-drive-refresh-token" class="cgue-input" type="password" autocomplete="off" spellcheck="false" value="${refreshToken}">
                                    <button id="cgue-drive-refresh-token-toggle" class="cgue-input-toggle" type="button" data-label="${t('driveRefreshTokenLabel')}" aria-pressed="false">${t('driveFieldShow')}</button>
                                </div>
                            </label>
                        </div>
                        <div class="cgue-drive-actions">
                            <span id="cgue-drive-status" class="cgue-status"></span>
                            <button id="cgue-save-drive-settings" class="cgue-btn" type="button">${t('driveSaveSettings')}</button>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    function openBackupSettingsDialog() {
        if (document.getElementById(BACKUP_OVERLAY_ID)) return;
        const overlay = document.createElement('div');
        overlay.id = BACKUP_OVERLAY_ID;
        overlay.className = 'cgue-theme';
        const dialog = document.createElement('div');
        dialog.id = BACKUP_DIALOG_ID;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-label', t('backupTitle'));
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                closeBackupSettingsDialog();
            }
        });
        renderBackupDialog(dialog);
    }

    function closeBackupSettingsDialog() {
        const overlay = document.getElementById(BACKUP_OVERLAY_ID);
        if (overlay) overlay.remove();
    }

    function renderBackupDialog(dialog) {
        dialog.innerHTML = `
            <div class="cgue-dialog-header">
                <h2>${t('backupTitle')}</h2>
                <button id="cgue-backup-close" class="cgue-icon-btn" type="button" aria-label="${t('close')}">×</button>
            </div>
            <p>${t('backupDesc')}</p>
            ${renderBackupSection()}
        `;

        const closeBtn = dialog.querySelector('#cgue-backup-close');
        if (closeBtn) closeBtn.onclick = closeBackupSettingsDialog;

        bindBackupControls(dialog);
    }

    function bindBackupControls(dialog) {
        const localToggle = dialog.querySelector('#cgue-backup-local');
        const driveToggle = dialog.querySelector('#cgue-backup-drive');
        const settingsWrap = dialog.querySelector('#cgue-drive-settings-wrap');
        const settingsToggle = dialog.querySelector('#cgue-drive-settings-toggle');
        const settingsPanel = dialog.querySelector('#cgue-drive-settings');
        const settingsCaret = dialog.querySelector('#cgue-drive-settings-caret');
        const statusEl = dialog.querySelector('#cgue-drive-status');
        const saveBtn = dialog.querySelector('#cgue-save-drive-settings');
        const clientIdInput = dialog.querySelector('#cgue-drive-client-id');
        const clientSecretInput = dialog.querySelector('#cgue-drive-client-secret');
        const clientSecretToggle = dialog.querySelector('#cgue-drive-client-secret-toggle');
        const refreshTokenInput = dialog.querySelector('#cgue-drive-refresh-token');
        const refreshTokenToggle = dialog.querySelector('#cgue-drive-refresh-token-toggle');

        if (!localToggle && !driveToggle) return;

        const setDriveStatus = (type, message) => {
            if (!statusEl) return;
            statusEl.textContent = message || '';
            statusEl.classList.remove('cgue-error', 'cgue-success');
            if (type === 'error') {
                statusEl.classList.add('cgue-error');
            } else if (type === 'success') {
                statusEl.classList.add('cgue-success');
            }
        };

        const readDriveForm = () => ({
            clientId: clientIdInput ? clientIdInput.value.trim() : '',
            clientSecret: clientSecretInput ? clientSecretInput.value.trim() : '',
            refreshToken: refreshTokenInput ? refreshTokenInput.value.trim() : ''
        });

        const updateVisibilityToggle = (input, toggle) => {
            if (!input || !toggle) return;
            const fieldLabel = (toggle.dataset.label || '').trim();
            const isVisible = input.type === 'text';
            const actionLabel = isVisible ? t('driveFieldHide') : t('driveFieldShow');
            toggle.textContent = actionLabel;
            toggle.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
            const ariaLabel = fieldLabel ? `${actionLabel} ${fieldLabel}` : actionLabel;
            toggle.setAttribute('aria-label', ariaLabel);
            toggle.setAttribute('title', ariaLabel);
        };

        const bindVisibilityToggle = (input, toggle) => {
            if (!input || !toggle) return;
            updateVisibilityToggle(input, toggle);
            toggle.addEventListener('click', () => {
                const isVisible = input.type === 'text';
                input.type = isVisible ? 'password' : 'text';
                updateVisibilityToggle(input, toggle);
                input.focus();
            });
        };

        const checkDriveConfig = () => {
            if (!driveToggle || !driveToggle.checked) {
                setDriveStatus('', '');
                return;
            }
            const candidate = readDriveForm();
            if (!hasDriveCredentials(candidate)) {
                setDriveStatus('error', t('driveMissingConfig'));
            } else {
                setDriveStatus('', '');
            }
        };

        const setBackupTarget = (target) => {
            const useDrive = target === 'drive';
            if (localToggle) localToggle.checked = !useDrive;
            if (driveToggle) driveToggle.checked = useDrive;
            const targets = persistBackupTargets({ local: !useDrive, drive: useDrive });
            persistDriveSettings({ enabled: useDrive });
            updateBackupButtonIcon(targets);
            if (settingsWrap) {
                settingsWrap.dataset.visible = useDrive ? 'true' : 'false';
            }
            if (settingsPanel) {
                state.driveSettingsExpanded = useDrive;
                settingsPanel.dataset.open = useDrive ? 'true' : 'false';
                if (settingsCaret) settingsCaret.textContent = useDrive ? '▲' : '▼';
            }
            checkDriveConfig();
        };

        if (localToggle) {
            localToggle.addEventListener('change', () => {
                if (localToggle.checked) {
                    setBackupTarget('local');
                }
            });
        }

        if (driveToggle) {
            driveToggle.addEventListener('change', () => {
                if (driveToggle.checked) {
                    setBackupTarget('drive');
                }
            });
        }

        if (settingsToggle && settingsPanel) {
            settingsToggle.addEventListener('click', () => {
                state.driveSettingsExpanded = !state.driveSettingsExpanded;
                settingsPanel.dataset.open = state.driveSettingsExpanded ? 'true' : 'false';
                if (settingsCaret) settingsCaret.textContent = state.driveSettingsExpanded ? '▲' : '▼';
            });
        }

        bindVisibilityToggle(clientSecretInput, clientSecretToggle);
        bindVisibilityToggle(refreshTokenInput, refreshTokenToggle);

        [clientIdInput, clientSecretInput, refreshTokenInput].forEach((input) => {
            if (!input) return;
            input.addEventListener('input', () => {
                setDriveStatus('', '');
                if (driveToggle && driveToggle.checked) {
                    checkDriveConfig();
                }
            });
        });

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const next = readDriveForm();
                const enabled = driveToggle ? driveToggle.checked : driveSettings.enabled === true;
                persistDriveSettings({
                    enabled,
                    clientId: next.clientId,
                    clientSecret: next.clientSecret,
                    refreshToken: next.refreshToken
                });
                setDriveStatus('success', t('driveSettingsSaved'));
            });
        }

        if (state.backupTargets.drive && settingsPanel && !hasDriveCredentials(readDriveForm())) {
            state.driveSettingsExpanded = true;
            settingsPanel.dataset.open = 'true';
            if (settingsCaret) settingsCaret.textContent = '▲';
            setDriveStatus('error', t('driveMissingConfig'));
        }

        if (settingsWrap && driveToggle) {
            settingsWrap.dataset.visible = driveToggle.checked ? 'true' : 'false';
        }
    }

    function renderScopeStep(dialog) {
        dialog.innerHTML = `
            <div class="cgue-dialog-header">
                <h2>${t('dialogChooseScope')}</h2>
                <div class="cgue-header-actions">
                    <button id="${BACKUP_BUTTON_ID}" class="cgue-icon-btn" type="button" title="${t('backupSettingsButton')}" aria-label="${t('backupSettingsButton')}">${getBackupTargetIcon()}</button>
                </div>
            </div>
            <div class="cgue-card-list">
                <button id="cgue-select-personal" class="cgue-card-btn cgue-card-icon-btn">
                    <span class="cgue-card-icon cgue-icon-personal" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false"><path xmlns="http://www.w3.org/2000/svg" d="M16.585 10a6.585 6.585 0 1 0-10.969 4.912A5.65 5.65 0 0 1 10 12.835c1.767 0 3.345.81 4.383 2.077A6.57 6.57 0 0 0 16.585 10M10 14.165a4.32 4.32 0 0 0-3.305 1.53c.972.565 2.1.89 3.305.89a6.55 6.55 0 0 0 3.303-.89A4.32 4.32 0 0 0 10 14.165M11.835 8.5a1.835 1.835 0 1 0-3.67 0 1.835 1.835 0 0 0 3.67 0m6.08 1.5a7.915 7.915 0 1 1-15.83 0 7.915 7.915 0 0 1 15.83 0m-4.75-1.5a3.165 3.165 0 1 1-6.33 0 3.165 3.165 0 0 1 6.33 0"></path></svg>
                    </span>
                    <span class="cgue-card-text">
                        <strong>${t('personalTitle')}</strong>
                        <p>${t('personalDesc')}</p>
                    </span>
                </button>
                <button id="cgue-select-team" class="cgue-card-btn cgue-card-icon-btn">
                    <span class="cgue-card-icon cgue-icon-team" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" class="h-12 w-12 shrink-0" aria-hidden="true" focusable="false"><circle cx="18" cy="18" r="18" fill="#3c46ff"></circle><path fill-rule="evenodd" clip-rule="evenodd" d="m7.358 14.641 5.056-5.055A2 2 0 0 1 13.828 9h8.343a2 2 0 0 1 1.414.586l5.056 5.055a2 2 0 0 1 .055 2.771l-9.226 9.996a2 2 0 0 1-2.94 0l-9.227-9.996a2 2 0 0 1 .055-2.77Zm6.86-1.939-.426 1.281a2.07 2.07 0 0 1-1.31 1.31l-1.28.426a.296.296 0 0 0 0 .561l1.28.428a2.07 2.07 0 0 1 1.31 1.309l.427 1.28c.09.27.471.27.56 0l.428-1.28a2.07 2.07 0 0 1 1.309-1.31l1.281-.427a.296.296 0 0 0 0-.56l-1.281-.428a2.07 2.07 0 0 1-1.309-1.309l-.427-1.28a.296.296 0 0 0-.561 0z" fill="#fff"></path></svg>
                    </span>
                    <span class="cgue-card-text">
                        <strong>${t('teamTitle')}</strong>
                        <p>${t('teamDesc')}</p>
                    </span>
                </button>
            </div>
            <div class="cgue-actions cgue-actions-end">
                <button id="cgue-cancel" class="cgue-btn">${t('cancel')}</button>
            </div>
        `;

        dialog.querySelector('#cgue-select-personal').onclick = () => {
            setScope('personal', null);
            renderModeStep(dialog);
        };
        dialog.querySelector('#cgue-select-team').onclick = () => {
            setScope('team', state.workspaceId);
            renderTeamStep(dialog);
        };
        dialog.querySelector('#cgue-cancel').onclick = closeDialog;
        const backupBtn = dialog.querySelector(`#${BACKUP_BUTTON_ID}`);
        if (backupBtn) backupBtn.onclick = openBackupSettingsDialog;
    }

    function renderTeamStep(dialog) {
        const detectedIds = detectAllWorkspaceIds();
        dialog.innerHTML = `
            <h2>${t('teamDialogTitle')}</h2>
            <div id="cgue-team-body"></div>
            <div class="cgue-actions">
                <button id="cgue-back" class="cgue-btn">${t('back')}</button>
                <button id="cgue-next" class="cgue-btn cgue-primary">${t('next')}</button>
            </div>
        `;

        const body = dialog.querySelector('#cgue-team-body');
        if (detectedIds.length > 1) {
            const callout = document.createElement('div');
            callout.className = 'cgue-callout info';
            const prompt = document.createElement('p');
            prompt.textContent = t('workspaceMultiPrompt');
            callout.appendChild(prompt);

            const list = document.createElement('div');
            list.className = 'cgue-workspace-list';
            detectedIds.forEach((id, index) => {
                const label = document.createElement('label');
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = 'workspace_id';
                input.value = id;
                if (index === 0) input.checked = true;
                const row = document.createElement('span');
                row.className = 'cgue-workspace-row';
                const marker = document.createElement('span');
                marker.className = 'cgue-workspace-index';
                marker.textContent = `#${index + 1}`;
                const code = document.createElement('code');
                code.textContent = id;
                label.appendChild(input);
                row.appendChild(marker);
                row.appendChild(code);
                label.appendChild(row);
                list.appendChild(label);
            });
            callout.appendChild(list);
            body.appendChild(callout);
        } else if (detectedIds.length === 1) {
            const callout = document.createElement('div');
            callout.className = 'cgue-callout success';
            const row = document.createElement('div');
            row.className = 'cgue-workspace-row';
            const marker = document.createElement('span');
            marker.className = 'cgue-workspace-index';
            marker.textContent = '#1';
            const code = document.createElement('code');
            code.id = 'workspace-id-code';
            code.textContent = detectedIds[0];
            row.appendChild(marker);
            row.appendChild(code);
            callout.appendChild(row);
            body.appendChild(callout);
        } else {
            const callout = document.createElement('div');
            callout.className = 'cgue-callout warning';
            const title = document.createElement('p');
            title.textContent = t('workspaceMissingTitle');
            const tip = document.createElement('p');
            tip.textContent = t('workspaceMissingTip');
            callout.appendChild(title);
            callout.appendChild(tip);
            body.appendChild(callout);

            const label = document.createElement('label');
            label.textContent = t('workspaceManualLabel');
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'team-id-input';
            input.className = 'cgue-input';
            input.placeholder = t('workspaceManualPlaceholder');
            body.appendChild(label);
            body.appendChild(input);
        }

        dialog.querySelector('#cgue-back').onclick = () => renderScopeStep(dialog);
        dialog.querySelector('#cgue-next').onclick = () => {
            let workspaceId = '';
            const radioChecked = dialog.querySelector('input[name="workspace_id"]:checked');
            const codeEl = dialog.querySelector('#workspace-id-code');
            const inputEl = dialog.querySelector('#team-id-input');
            if (radioChecked) {
                workspaceId = radioChecked.value;
            } else if (codeEl) {
                workspaceId = codeEl.textContent;
            } else if (inputEl) {
                workspaceId = inputEl.value.trim();
            }
            if (!workspaceId) {
                alert(t('alertNoWorkspace'));
                return;
            }
            setScope('team', workspaceId);
            renderModeStep(dialog);
        };
    }

    function renderModeStep(dialog) {
        const scopeLabel = state.scope === 'team' && state.workspaceId
            ? `<div class="cgue-callout info"><strong>${t('teamTitle')}:</strong> <code>${state.workspaceId}</code></div>`
            : '';

        dialog.innerHTML = `
            <h2>${t('exportModeTitle')}</h2>
            <p>${t('exportModeDesc')}</p>
            ${scopeLabel}
            <div class="cgue-card-list">
                <div id="cgue-export-all" class="cgue-card-btn cgue-card-row" role="button" tabindex="0">
                    <div class="cgue-card-content">
                        <strong>${t('exportAll')}</strong>
                        <p>${t('exportAllDesc')}</p>
                    </div>
                    <div class="cgue-card-controls">
                        <label class="cgue-toggle">
                            <input type="checkbox" id="cgue-toggle-root-active" ${state.exportAllOptions.includeRootActive ? 'checked' : ''}>
                            <span class="cgue-toggle-track"></span>
                            <span class="cgue-toggle-label">${t('rootActiveShort')}</span>
                        </label>
                        <label class="cgue-toggle">
                            <input type="checkbox" id="cgue-toggle-root-archived" ${state.exportAllOptions.includeRootArchived ? 'checked' : ''}>
                            <span class="cgue-toggle-track"></span>
                            <span class="cgue-toggle-label">${t('rootArchivedShort')}</span>
                        </label>
                    </div>
                </div>
                <button id="cgue-export-select" class="cgue-card-btn">
                    <strong>${t('selectConversations')}</strong>
                    <p>${t('selectDesc')}</p>
                </button>
            </div>
            <div class="cgue-actions">
                <button id="cgue-back" class="cgue-btn">${t('back')}</button>
            </div>
        `;

        dialog.querySelector('#cgue-back').onclick = () => {
            if (state.scope === 'team') {
                renderTeamStep(dialog);
            } else {
                renderScopeStep(dialog);
            }
        };
        const exportAllCard = dialog.querySelector('#cgue-export-all');
        const activeToggle = dialog.querySelector('#cgue-toggle-root-active');
        const archivedToggle = dialog.querySelector('#cgue-toggle-root-archived');
        if (activeToggle) {
            activeToggle.addEventListener('change', () => {
                persistExportOptions({ includeRootActive: activeToggle.checked });
            });
        }
        if (archivedToggle) {
            archivedToggle.addEventListener('change', () => {
                persistExportOptions({ includeRootArchived: archivedToggle.checked });
            });
        }
        const runExportAll = async () => {
            if (state.isExporting) return;
            const backupTargets = resolveBackupTargets();
            if (!backupTargets) return;
            const saveHandle = backupTargets.local ? await prepareSaveHandle(state.scope, state.workspaceId) : null;
            if (backupTargets.local && saveHandle === 'cancelled') {
                alert(t('alertSaveCancelled'));
                return;
            }
            closeDialog();
            const exportOptions = {
                includeRootActive: activeToggle ? activeToggle.checked : state.exportAllOptions.includeRootActive,
                includeRootArchived: archivedToggle ? archivedToggle.checked : state.exportAllOptions.includeRootArchived
            };
            exportAllConversations(state.scope, state.workspaceId, saveHandle, exportOptions, backupTargets);
        };
        bindCardAction(exportAllCard, runExportAll);
        dialog.querySelector('#cgue-export-select').onclick = () => {
            renderSelectionStep(dialog);
        };
    }

    function renderSelectionStep(dialog) {
        state.stepToken += 1;
        const stepToken = state.stepToken;

        dialog.innerHTML = `
            <h2>${t('selectionTitle')}</h2>
            <div class="cgue-select-toolbar">
                <input id="cgue-search" class="cgue-input" type="text" placeholder="${t('searchPlaceholder')}" disabled>
                <div class="cgue-select-actions">
                    <button id="cgue-select-all" class="cgue-btn" disabled>${t('selectAll')}</button>
                    <button id="cgue-select-visible" class="cgue-btn" disabled>${t('selectVisible')}</button>
                    <button id="cgue-clear-all" class="cgue-btn" disabled>${t('clearAll')}</button>
                </div>
            </div>
            <div id="cgue-selection-count" class="cgue-selection-count"></div>
            <div id="cgue-list-status" class="cgue-status">${t('loadingConversations')}</div>
            <div id="cgue-conv-list" class="cgue-conv-list"></div>
            <div class="cgue-actions">
                <button id="cgue-back" class="cgue-btn">${t('back')}</button>
                <button id="cgue-export-selected" class="cgue-btn cgue-primary" disabled>${t('exportSelected')}</button>
            </div>
        `;

        const searchInput = dialog.querySelector('#cgue-search');
        const selectAllBtn = dialog.querySelector('#cgue-select-all');
        const selectVisibleBtn = dialog.querySelector('#cgue-select-visible');
        const clearAllBtn = dialog.querySelector('#cgue-clear-all');
        const exportSelectedBtn = dialog.querySelector('#cgue-export-selected');
        const statusEl = dialog.querySelector('#cgue-list-status');
        const listEl = dialog.querySelector('#cgue-conv-list');
        const countEl = dialog.querySelector('#cgue-selection-count');

        const enableControls = () => {
            searchInput.disabled = false;
            selectAllBtn.disabled = false;
            selectVisibleBtn.disabled = false;
            clearAllBtn.disabled = false;
            exportSelectedBtn.disabled = false;
        };

        const updateSelectionCount = (total) => {
            const totalCount = total ?? state.index?.items?.length ?? 0;
            countEl.textContent = t('selectedCount', state.selectedIds.size, totalCount);
        };

        const applyFilter = () => {
            const query = searchInput.value.trim().toLowerCase();
            const groups = listEl.querySelectorAll('.cgue-group');
            groups.forEach((group) => {
                let visibleCount = 0;
                group.querySelectorAll('.cgue-conv-item').forEach((item) => {
                    const searchText = item.dataset.search || '';
                    const match = !query || searchText.includes(query);
                    item.hidden = !match;
                    if (match) visibleCount += 1;
                });
                group.hidden = visibleCount === 0;
            });
        };

        const setAllSelection = (checked) => {
            state.selectedIds.clear();
            listEl.querySelectorAll('input[type="checkbox"][data-id]').forEach((input) => {
                input.checked = checked;
                if (checked) state.selectedIds.add(input.dataset.id);
            });
            updateSelectionCount();
        };

        const selectVisible = () => {
            listEl.querySelectorAll('.cgue-conv-item').forEach((item) => {
                if (item.hidden) return;
                const input = item.querySelector('input[type="checkbox"]');
                if (!input) return;
                input.checked = true;
                state.selectedIds.add(input.dataset.id);
            });
            updateSelectionCount();
        };

        searchInput.addEventListener('input', applyFilter);
        selectAllBtn.onclick = () => setAllSelection(true);
        clearAllBtn.onclick = () => setAllSelection(false);
        selectVisibleBtn.onclick = () => selectVisible();

        listEl.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            const id = target.dataset.id;
            if (!id) return;
            if (target.checked) {
                state.selectedIds.add(id);
            } else {
                state.selectedIds.delete(id);
            }
            updateSelectionCount();
        });

        dialog.querySelector('#cgue-back').onclick = () => renderModeStep(dialog);

        exportSelectedBtn.onclick = async () => {
            if (state.isExporting) return;
            if (!state.index || state.selectedIds.size === 0) {
                alert(t('alertNoSelection'));
                return;
            }
            const backupTargets = resolveBackupTargets();
            if (!backupTargets) return;
            const saveHandle = backupTargets.local ? await prepareSaveHandle(state.scope, state.workspaceId) : null;
            if (backupTargets.local && saveHandle === 'cancelled') {
                alert(t('alertSaveCancelled'));
                return;
            }
            closeDialog();
            exportSelectedConversations(state.scope, state.workspaceId, state.index, state.selectedIds, saveHandle, backupTargets);
        };

        (async () => {
            try {
                if (!await ensureAccessToken()) {
                    statusEl.textContent = t('alertNoAccessToken');
                    statusEl.classList.add('cgue-error');
                    return;
                }
                statusEl.textContent = t('loadingConversations');
                const index = state.index || await collectConversationIndex(state.workspaceId, (info) => {
                    if (state.stepToken !== stepToken) return;
                    if (info.stage === 'root') {
                        statusEl.textContent = t('statusFetchingRoot', getRootLabelFromArchived(info.isArchived), info.page);
                    } else if (info.stage === 'projects') {
                        statusEl.textContent = t('statusFetchingProjects');
                    } else if (info.stage === 'project' || info.stage === 'project-header') {
                        statusEl.textContent = t('statusFetchingProject', info.projectTitle || '');
                    }
                });

                if (state.stepToken !== stepToken) return;
                state.index = index;
                if (state.selectedIds.size === 0) {
                    state.selectedIds = new Set(index.items.map((item) => item.id));
                }

                listEl.innerHTML = '';
                if (index.items.length === 0) {
                    statusEl.textContent = t('noConversations');
                    updateSelectionCount(0);
                    return;
                }

                const fragment = document.createDocumentFragment();
                index.groups.forEach((group) => {
                    if (group.items.length === 0) return;
                    const groupWrap = document.createElement('div');
                    groupWrap.className = 'cgue-group';

                    const title = document.createElement('div');
                    title.className = 'cgue-group-title';
                    title.textContent = group.label;
                    groupWrap.appendChild(title);

                    const list = document.createElement('ul');
                    list.style.padding = '0';
                    list.style.margin = '0';
                    group.items.forEach((item) => {
                        const li = document.createElement('li');
                        li.className = 'cgue-conv-item';
                        li.dataset.search = `${item.title} ${item.groupLabel}`.toLowerCase();

                        const label = document.createElement('label');
                        label.className = 'cgue-conv-label';

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.dataset.id = item.id;
                        checkbox.checked = state.selectedIds.has(item.id);

                        const textWrap = document.createElement('div');
                        const titleEl = document.createElement('div');
                        titleEl.className = 'cgue-conv-title';
                        titleEl.textContent = item.title;

                        const metaEl = document.createElement('div');
                        metaEl.className = 'cgue-conv-meta';
                        const metaParts = [];
                        const formattedDate = item.updatedAtMs ? formatDateTime(item.updatedAtMs) : '';
                        if (formattedDate) metaParts.push(`${t('updatedAt')}: ${formattedDate}`);
                        metaEl.textContent = metaParts.join(' · ');

                        textWrap.appendChild(titleEl);
                        if (metaEl.textContent) {
                            textWrap.appendChild(metaEl);
                        }

                        label.appendChild(checkbox);
                        label.appendChild(textWrap);
                        li.appendChild(label);
                        list.appendChild(li);
                    });

                    groupWrap.appendChild(list);
                    fragment.appendChild(groupWrap);
                });

                listEl.appendChild(fragment);
                statusEl.textContent = '';
                enableControls();
                updateSelectionCount(index.items.length);
                applyFilter();
            } catch (err) {
                console.error('Conversation index failed:', err);
                statusEl.textContent = t('alertListFailed', err?.message || String(err));
                statusEl.classList.add('cgue-error');
            }
        })();
    }

    function showExportDialog() {
        if (document.getElementById(OVERLAY_ID)) return;
        const overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'cgue-theme';
        const dialog = document.createElement('div');
        dialog.id = DIALOG_ID;
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);
        renderScopeStep(dialog);
    }

    function addExportButton() {
        if (document.getElementById(EXPORT_BUTTON_ID)) return;
        const btn = document.createElement('button');
        btn.id = EXPORT_BUTTON_ID;
        setButtonIdle(btn);
        btn.onclick = showExportDialog;
        document.body.appendChild(btn);
    }

    function init() {
        addStyles();
        addExportButton();
        if (!document.body) return;
        const observer = new MutationObserver(() => {
            if (!document.getElementById(EXPORT_BUTTON_ID) && !state.isExporting) {
                addExportButton();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
