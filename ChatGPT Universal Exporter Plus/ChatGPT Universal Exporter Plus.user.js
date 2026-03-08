// ==UserScript==
// @name         ChatGPT Universal Exporter Plus [20260308] v1.2.0
// @namespace    https://github.com/0-V-linuxdo/ChatGPT-Universal-Exporter-Plus
// @version      [20260308] v1.2.0
// @update-log   [20260308] v1.2.0 修正 Backup destination 弹窗关闭逻辑；仅允许通过右上角关闭按钮关闭。
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
    const INCREMENTAL_META_STORAGE_PREFIX = 'cgue_update_map_';
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
    const AUTO_DRIVE_TASKS_STORAGE_PREFIX = 'cgue_auto_drive_tasks_';
    const AUTO_DRIVE_LEADER_STORAGE_PREFIX = 'cgue_auto_drive_leader_';
    const AUTO_DRIVE_LOCK_STORAGE_PREFIX = 'cgue_auto_drive_lock_';
    const AUTO_DRIVE_MIN_INTERVAL_MINUTES = 5;
    const AUTO_DRIVE_DEFAULT_INTERVAL_MINUTES = 15;
    const AUTO_DRIVE_LOCK_RETRY_MS = 15000;
    const AUTO_DRIVE_LEADER_TTL_MS = 45000;
    const AUTO_DRIVE_LEADER_RENEW_MS = 15000;
    const AUTO_DRIVE_LOCK_TTL_MS = 180000;
    const AUTO_DRIVE_LOCK_RENEW_MS = 45000;
    const AUTO_DRIVE_ACCOUNT_FOLDER_PREFIX = 'Account_';
    const TOAST_HOST_ID = 'cgue-toast-host';
    const TOAST_MAX_VISIBLE = 4;
    const TOAST_BASE_GAP = 16;
    const TOAST_Z_INDEX = 100002;
    const COMP_RETRY_MAX = 10;
    const COMP_RETRY_BASE_MS = 1000;
    const COMP_RETRY_FACTOR = 2;

    const readStoredValue = (key) => {
        if (typeof GM_getValue === 'function') {
            const stored = GM_getValue(key, null);
            if (stored !== null && stored !== undefined) return stored;
            return null;
        }
        try {
            return localStorage.getItem(key);
        } catch (_) {
            return null;
        }
    };

    const writeStoredValue = (key, value) => {
        if (typeof GM_setValue === 'function') {
            GM_setValue(key, value);
            return;
        }
        try {
            localStorage.setItem(key, value);
        } catch (_) {}
    };

    const readStoredJsonValue = (key, fallback) => {
        try {
            const raw = readStoredValue(key);
            if (raw == null || raw === '') return fallback;
            if (typeof raw === 'string') {
                const parsed = JSON.parse(raw);
                return parsed == null ? fallback : parsed;
            }
            if (typeof raw === 'object') {
                return raw;
            }
        } catch (error) {
            console.warn('[CGUE Plus] Stored JSON parse failed:', key, error);
        }
        return fallback;
    };

    const writeStoredJsonValue = (key, value) => {
        try {
            writeStoredValue(key, JSON.stringify(value));
        } catch (error) {
            console.warn('[CGUE Plus] Stored JSON persist failed:', key, error);
        }
    };

    const createDefaultAutoTaskForm = (input = {}) => ({
        mode: input.mode === 'team' ? 'team' : 'personal',
        workspaceId: typeof input.workspaceId === 'string' ? input.workspaceId.trim() : '',
        label: typeof input.label === 'string' ? input.label.trim() : '',
        intervalMinutes: Math.max(
            AUTO_DRIVE_MIN_INTERVAL_MINUTES,
            Math.floor(Number(input.intervalMinutes) || AUTO_DRIVE_DEFAULT_INTERVAL_MINUTES)
        ),
        includeRootActive: input.includeRootActive !== false,
        includeRootArchived: input.includeRootArchived !== false,
        enabled: input.enabled !== false,
        runOnStartup: input.runOnStartup !== false
    });

    const createInitialAutoDriveState = () => ({
        accountStatus: 'idle',
        accountKey: '',
        accountHash: '',
        accountLabel: '',
        accountError: '',
        tasks: [],
        expandedTaskIds: [],
        editorOpen: false,
        editingId: '',
        form: createDefaultAutoTaskForm(),
        loading: false,
        runningTaskId: '',
        runningTaskIds: []
    });

    const getLegacyIncrementalStorageKey = (mode, workspaceId) => {
        if (mode === 'team') {
            const trimmedWorkspaceId = (workspaceId || '').trim();
            return `${INCREMENTAL_META_STORAGE_PREFIX}team_${trimmedWorkspaceId || 'unknown'}`;
        }
        return `${INCREMENTAL_META_STORAGE_PREFIX}personal`;
    };

    const getIncrementalStorageKey = (accountKey, mode, workspaceId) => {
        const accountSegment = (accountKey || 'anonymous').trim() || 'anonymous';
        const scopeSegment = mode === 'team'
            ? `team_${(workspaceId || '').trim() || 'unknown'}`
            : 'personal';
        return `${INCREMENTAL_META_STORAGE_PREFIX}${accountSegment}_${scopeSegment}`;
    };

    const loadIncrementalUpdateMap = (accountKey, mode, workspaceId) => {
        const key = getIncrementalStorageKey(accountKey, mode, workspaceId);
        try {
            const parsed = readStoredJsonValue(key, null);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
            const legacyKey = getLegacyIncrementalStorageKey(mode, workspaceId);
            const raw = localStorage.getItem(legacyKey);
            if (!raw) return {};
            const legacyParsed = JSON.parse(raw);
            if (legacyParsed && typeof legacyParsed === 'object' && !Array.isArray(legacyParsed)) {
                writeStoredJsonValue(key, legacyParsed);
                return legacyParsed;
            }
        } catch (error) {
            console.warn('[CGUE Plus] Incremental baseline parse failed:', error);
        }
        return {};
    };

    const saveIncrementalUpdateMap = (accountKey, mode, workspaceId, map) => {
        const key = getIncrementalStorageKey(accountKey, mode, workspaceId);
        writeStoredJsonValue(key, map || {});
    };

    const isIncrementalByUpdateTime = (id, prevMap, currMap) => {
        const newTime = currMap && currMap[id];
        const oldTime = prevMap && prevMap[id];
        if (!newTime) return !oldTime;
        if (!oldTime) return true;
        return newTime !== oldTime;
    };

    let accessToken = null;
    const capturedWorkspaceIds = new Set();
    let driveSettings = loadDriveSettings();
    const initialBackupTargets = loadBackupTargets(driveSettings.enabled === true);
    const initialExportOptions = loadExportOptions();
    const activeToasts = [];
    let toastCounter = 0;
    let toastHost = null;
    let toastEventsBound = false;

    const state = {
        scope: 'personal',
        workspaceId: null,
        index: null,
        selectedIds: new Set(),
        isExporting: false,
        stepToken: 0,
        backupTargets: { ...initialBackupTargets },
        driveSettingsExpanded: false,
        exportAllOptions: { ...initialExportOptions },
        autoDrive: createInitialAutoDriveState()
    };

    const TAB_INSTANCE_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    let sessionSnapshot = null;
    let accountContextCache = null;
    let personalAccountIdCache = '';
    let autoDriveSchedulerTimer = null;
    let autoDriveLeaderRenewTimer = null;
    let autoDriveCurrentRunPromise = null;
    let autoDriveLockRenewTimer = null;
    let autoDriveLeaderAccountKey = '';
    let autoDriveHeldLockKey = '';
    let autoDriveObservedAccountKey = '';
    let autoDriveTasksListenerId = null;
    let autoDriveLeaderListenerId = null;

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
            exportTargetLocal: 'ZIP',
            exportTargetDrive: 'Google Drive',
            exportAll: (target = 'ZIP') => `Export all (${target})`,
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
            exportSelected: (target = 'ZIP') => `Export selected (${target})`,
            backupTitle: 'Backup destination',
            backupDesc: 'Choose where the history should be saved.',
            backupDescCompact: 'Choose where the history should be saved.',
            backupLocal: 'Local file',
            backupDrive: 'Google Drive',
            backupSettingsButton: 'Backup settings',
            close: 'Close',
            toastClose: 'Close notification',
            toastTypeSuccess: 'Success',
            toastTypeWarning: 'Warning',
            toastTypeError: 'Error',
            toastTypeInfo: 'Notice',
            driveSettingsToggle: 'Drive settings',
            driveSettingsExpand: 'Expand Drive settings',
            driveSettingsCollapse: 'Collapse Drive settings',
            driveClientIdLabel: 'Client ID',
            driveClientSecretLabel: 'Client Secret',
            driveRefreshTokenLabel: 'Refresh Token',
            driveFieldShow: 'Show',
            driveFieldHide: 'Hide',
            driveSaveSettings: 'Save',
            driveSettingsSaved: 'Drive settings saved.',
            driveMissingConfig: 'Drive credentials are missing.',
            autoSyncTitle: 'Auto Drive sync',
            autoSyncDescSummary: 'How it works',
            autoSyncDesc: 'Run incremental Drive sync while this page is open. Tasks are isolated by ChatGPT account and shared across tabs/domains for the same account.',
            autoSyncAccountLoading: 'Resolving current ChatGPT account…',
            autoSyncAccountMissing: 'Auto sync needs a signed-in ChatGPT account. Open any logged-in conversation first.',
            autoSyncRefreshAccount: 'Refresh account',
            autoSyncTaskListTitle: 'Saved tasks',
            autoSyncNoTasks: 'No auto sync tasks for this account yet.',
            autoSyncAddTask: 'New task',
            autoSyncCreateTask: 'Create task',
            autoSyncEditTask: 'Edit task',
            autoSyncDeleteTask: 'Delete',
            autoSyncDeleteConfirm: (name) => `Delete auto sync task "${name}"?`,
            autoSyncRunNow: 'Run now',
            autoSyncPause: 'Pause',
            autoSyncResume: 'Resume',
            autoSyncEnable: 'Enable',
            autoSyncDisable: 'Disable',
            autoSyncTaskMode: 'Scope',
            autoSyncTaskModePersonal: 'Personal',
            autoSyncTaskModeTeam: 'Team workspace',
            autoSyncTaskWorkspace: 'Workspace ID',
            autoSyncTaskLabel: 'Label',
            autoSyncTaskLabelPlaceholder: 'Optional label',
            autoSyncTaskInterval: 'Interval (minutes)',
            autoSyncTaskEnabled: 'Enabled',
            autoSyncRunOnStartup: 'Run once after startup',
            autoSyncSaveTask: 'Save task',
            autoSyncCancelEdit: 'Cancel',
            autoSyncCurrentAccount: (value) => `Current account: ${value}`,
            autoSyncTaskNextRun: 'Next',
            autoSyncTaskLastSuccess: 'Last success',
            autoSyncTaskLastError: 'Last error',
            autoSyncTaskRoots: 'Roots',
            autoSyncTaskStatusPaused: 'Paused',
            autoSyncTaskStatusDisabled: 'Disabled',
            autoSyncTaskStatusScheduled: 'Scheduled',
            autoSyncTaskStatusRunning: 'Running',
            autoSyncTaskExpand: 'Expand task',
            autoSyncTaskCollapse: 'Collapse task',
            autoSyncTaskSaved: 'Auto sync task saved.',
            autoSyncTaskExists: 'A task already exists for this scope.',
            autoSyncTaskDeleted: 'Auto sync task deleted.',
            autoSyncTaskStarted: (value) => `Auto sync started: ${value}`,
            autoSyncTaskRecovered: (value) => `Auto sync recovered: ${value}`,
            autoSyncTaskFailed: (name, message) => `Auto sync failed (${name}): ${message}`,
            autoSyncTaskPausedByError: (name, message) => `Auto sync paused (${name}): ${message}`,
            autoSyncTaskBusy: 'Another export is already running for this account.',
            autoSyncWorkspaceRequired: 'Team tasks require a Workspace ID.',
            autoSyncIntervalInvalid: (value) => `Interval must be at least ${value} minutes.`,
            autoSyncAccountRequired: 'Unable to resolve the current ChatGPT account for auto sync.',
            autoSyncDefaultTeamLabel: (workspaceId) => `Team ${workspaceId}`,
            autoSyncDefaultPersonalLabel: 'Personal',
            rootActiveShort: 'Active',
            rootArchivedShort: 'Archived',
            rootAllShort: 'All',
            rootNoneShort: 'None',
            toggleOn: 'On',
            toggleOff: 'Off',
            toastSpace: (value) => `space: ${value}`,
            toastWorkspace: (value) => `workspace: ${value}`,
            toastRootFilter: (value) => `root: ${value}`,
            toastDetailsSummary: 'details',
            toastUploadTime: (value) => `upload duration: ${value}`,
            toastDriveUpdatedCount: (value) => `updated chats: ${value}`,
            toastIncrementalSummary: (kept, listed, skipped) => `incremental: kept ${kept} / listed ${listed}, skipped ${skipped}`,
            groupRootActive: 'Root (Active)',
            groupRootArchived: 'Root (Archived)',
            groupProject: (name) => `Project: ${name}`,
            updatedAt: 'Updated',
            statusFetchingRoot: (label, page) => `📂 ${label} p${page}`,
            statusFetchingProjects: '🔍 Fetching project list…',
            statusFetchingProject: (name) => `📂 Project: ${name}`,
            statusExportRoot: (label, index, total) => `📥 ${label} (${index}/${total})`,
            statusExportProject: (name, index, total) => `📥 ${shortLabel(name)} (${index}/${total})`,
            statusCompRetry: (label, index, total, attempt, max) => `🔁 Retry ${shortLabel(label, 16)} (${index}/${total}) ${attempt}/${max}`,
            statusGeneratingZip: '📦 Creating ZIP file…',
            statusUploadingDrive: '☁️ Uploading to Drive…',
            statusDone: '✅ Done',
            statusError: '⚠️ Error',
            alertExportSummary: (total, success, failed) => (
                failed > 0
                    ? `Conversations: ${success}/${total} succeeded, ${failed} failed.`
                    : `Conversations: ${success}/${total} succeeded.`
            ),
            alertExportDone: '✅ Done!',
            alertExportDoneLocal: '✅ location: local file.',
            alertExportDoneDrive: '✅ location: Drive.',
            alertNoAccessToken: 'Unable to get Access Token. Please refresh the page or open any conversation and try again.',
            alertNoWorkspace: 'Please choose or enter a valid Team Workspace ID!',
            alertNoDeviceId: 'Unable to get oai-device-id. Please ensure you are logged in and refresh the page.',
            alertNoSelection: 'Please select at least one conversation.',
            alertNoBackupTarget: 'Please choose at least one backup destination.',
            alertDriveMissingConfig: 'Please fill in your Google Drive credentials first.',
            alertExportBusy: 'Another export or auto sync is already running for this account.',
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
            exportTargetLocal: 'ZIP',
            exportTargetDrive: 'Google Drive',
            exportAll: (target = 'ZIP') => `导出全部 (${target})`,
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
            exportSelected: (target = 'ZIP') => `导出已选 (${target})`,
            backupTitle: '备份位置',
            backupDesc: '选择 ZIP 备份的保存位置。',
            backupDescCompact: '选择 ZIP 备份的保存位置。',
            backupLocal: '本地文件',
            backupDrive: 'Google Drive',
            backupSettingsButton: '备份设置',
            close: '关闭',
            toastClose: '关闭提示',
            toastTypeSuccess: '成功',
            toastTypeWarning: '警告',
            toastTypeError: '错误',
            toastTypeInfo: '提示',
            driveSettingsToggle: 'Drive 设置',
            driveSettingsExpand: '展开 Drive 设置',
            driveSettingsCollapse: '折叠 Drive 设置',
            driveClientIdLabel: 'Client ID',
            driveClientSecretLabel: 'Client Secret',
            driveRefreshTokenLabel: 'Refresh Token',
            driveFieldShow: '显示',
            driveFieldHide: '隐藏',
            driveSaveSettings: '保存',
            driveSettingsSaved: 'Drive 设置已保存。',
            driveMissingConfig: 'Drive 凭据未填写完整。',
            autoSyncTitle: '自动 Drive 同步',
            autoSyncDescSummary: '查看说明',
            autoSyncDesc: '页面保持打开时按任务执行 Drive 增量同步。任务按 ChatGPT 账号隔离，同账号跨标签页和跨域共享。',
            autoSyncAccountLoading: '正在识别当前 ChatGPT 账号…',
            autoSyncAccountMissing: '自动同步需要已登录的 ChatGPT 账号。请先打开任意已登录对话。',
            autoSyncRefreshAccount: '刷新账号',
            autoSyncTaskListTitle: '已保存任务',
            autoSyncNoTasks: '当前账号还没有自动同步任务。',
            autoSyncAddTask: '新建任务',
            autoSyncCreateTask: '创建任务',
            autoSyncEditTask: '编辑任务',
            autoSyncDeleteTask: '删除',
            autoSyncDeleteConfirm: (name) => `确定删除自动同步任务“${name}”吗？`,
            autoSyncRunNow: '立即执行',
            autoSyncPause: '暂停',
            autoSyncResume: '恢复',
            autoSyncEnable: '启用',
            autoSyncDisable: '停用',
            autoSyncTaskMode: '范围',
            autoSyncTaskModePersonal: '个人',
            autoSyncTaskModeTeam: '团队空间',
            autoSyncTaskWorkspace: 'Workspace ID',
            autoSyncTaskLabel: '标签',
            autoSyncTaskLabelPlaceholder: '可选任务名称',
            autoSyncTaskInterval: '间隔（分钟）',
            autoSyncTaskEnabled: '启用任务',
            autoSyncRunOnStartup: '启动后执行一次',
            autoSyncSaveTask: '保存任务',
            autoSyncCancelEdit: '取消',
            autoSyncCurrentAccount: (value) => `当前账号：${value}`,
            autoSyncTaskNextRun: '下次',
            autoSyncTaskLastSuccess: '上次成功',
            autoSyncTaskLastError: '最近错误',
            autoSyncTaskRoots: '根目录',
            autoSyncTaskStatusPaused: '已暂停',
            autoSyncTaskStatusDisabled: '已停用',
            autoSyncTaskStatusScheduled: '已计划',
            autoSyncTaskStatusRunning: '运行中',
            autoSyncTaskExpand: '展开任务卡片',
            autoSyncTaskCollapse: '折叠任务卡片',
            autoSyncTaskSaved: '自动同步任务已保存。',
            autoSyncTaskExists: '该范围已有对应任务。',
            autoSyncTaskDeleted: '自动同步任务已删除。',
            autoSyncTaskStarted: (value) => `自动同步已开始：${value}`,
            autoSyncTaskRecovered: (value) => `自动同步已恢复：${value}`,
            autoSyncTaskFailed: (name, message) => `自动同步失败（${name}）：${message}`,
            autoSyncTaskPausedByError: (name, message) => `自动同步已暂停（${name}）：${message}`,
            autoSyncTaskBusy: '当前账号已有其他导出或自动同步任务在运行。',
            autoSyncWorkspaceRequired: '团队任务必须填写 Workspace ID。',
            autoSyncIntervalInvalid: (value) => `间隔分钟数不能小于 ${value}。`,
            autoSyncAccountRequired: '当前无法识别 ChatGPT 账号，不能启动自动同步。',
            autoSyncDefaultTeamLabel: (workspaceId) => `团队 ${workspaceId}`,
            autoSyncDefaultPersonalLabel: '个人',
            rootActiveShort: 'Active',
            rootArchivedShort: 'Archived',
            rootAllShort: 'All',
            rootNoneShort: '无',
            toggleOn: '开',
            toggleOff: '关',
            toastSpace: (value) => `空间: ${value}`,
            toastWorkspace: (value) => `工作区: ${value}`,
            toastRootFilter: (value) => `根目录: ${value}`,
            toastDetailsSummary: 'details',
            toastUploadTime: (value) => `上传耗时: ${value}`,
            toastDriveUpdatedCount: (value) => `更新聊天数: ${value}`,
            toastIncrementalSummary: (kept, listed, skipped) => `增量: 保留 ${kept} / 列表 ${listed}, 跳过 ${skipped}`,
            groupRootActive: '根目录 (进行中)',
            groupRootArchived: '根目录 (已归档)',
            groupProject: (name) => `项目: ${name}`,
            updatedAt: '更新',
            statusFetchingRoot: (label, page) => `📂 ${label} p${page}`,
            statusFetchingProjects: '🔍 获取项目列表…',
            statusFetchingProject: (name) => `📂 项目: ${name}`,
            statusExportRoot: (label, index, total) => `📥 ${label} (${index}/${total})`,
            statusExportProject: (name, index, total) => `📥 ${shortLabel(name)} (${index}/${total})`,
            statusCompRetry: (label, index, total, attempt, max) => `🔁 补偿重试 ${shortLabel(label, 16)} (${index}/${total}) ${attempt}/${max}`,
            statusGeneratingZip: '📦 生成 ZIP 文件…',
            statusUploadingDrive: '☁️ 上传到 Drive…',
            statusDone: '✅ 完成',
            statusError: '⚠️ 错误',
            alertExportSummary: (total, success, failed) => (
                failed > 0
                    ? `会话导出统计：成功 ${success}/${total}，失败 ${failed}。`
                    : `会话导出统计：成功 ${success}/${total}。`
            ),
            alertExportDone: '✅ 完成！',
            alertExportDoneLocal: '✅ location: 本地文件。',
            alertExportDoneDrive: '✅ location: Drive。',
            alertNoAccessToken: '无法获取 Access Token。请刷新页面或打开任意一个对话后再试。',
            alertNoWorkspace: '请选择或输入一个有效的 Team Workspace ID！',
            alertNoDeviceId: '无法获取 oai-device-id，请确保已登录并刷新页面。',
            alertNoSelection: '请至少选择一个对话。',
            alertNoBackupTarget: '请至少选择一个备份位置。',
            alertDriveMissingConfig: '请先填写 Google Drive 凭据。',
            alertExportBusy: '当前账号已有其他导出或自动同步任务在运行。',
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

    const normalizeToastType = (type) => (
        ['success', 'warning', 'error', 'info'].includes(type) ? type : 'info'
    );

    const normalizeToastMessage = (message) => {
        if (message == null) return '';
        return String(message).trim();
    };

    const TOAST_LEADING_MARKERS = ['✅', '⚠️', '⚠', '❌', 'ℹ️', 'ℹ', '🔔'];

    const stripLeadingStatusEmoji = (message) => {
        let text = normalizeToastMessage(message);
        if (!text) return '';
        while (text) {
            const previous = text;
            for (const marker of TOAST_LEADING_MARKERS) {
                if (text.startsWith(marker)) {
                    text = text.slice(marker.length).trimStart();
                    break;
                }
            }
            if (previous === text) break;
        }
        return text.trim();
    };

    const splitToastText = (message, detail) => {
        const primaryText = stripLeadingStatusEmoji(message);
        const secondaryText = stripLeadingStatusEmoji(detail);
        if (!primaryText && !secondaryText) {
            return { primary: '', secondary: '' };
        }
        if (secondaryText) {
            if (!primaryText) {
                return { primary: secondaryText, secondary: '' };
            }
            return { primary: primaryText, secondary: secondaryText };
        }
        if (!primaryText) {
            return { primary: '', secondary: '' };
        }
        const newlineIndex = primaryText.indexOf('\n');
        if (newlineIndex >= 0) {
            const headline = primaryText.slice(0, newlineIndex).trim();
            const body = primaryText.slice(newlineIndex + 1).trim();
            if (headline && body) {
                return { primary: headline, secondary: body };
            }
        }
        const sentenceMatch = primaryText.match(/^(.+?[。！？.!?])(?:\s+|$)([\s\S]+)$/u);
        if (sentenceMatch) {
            const headline = sentenceMatch[1].trim();
            const body = sentenceMatch[2].trim();
            if (headline && body) {
                return { primary: headline, secondary: body };
            }
        }
        return { primary: primaryText, secondary: '' };
    };

    const getToastTypeTitle = (type) => {
        if (type === 'success') return t('toastTypeSuccess');
        if (type === 'warning') return t('toastTypeWarning');
        if (type === 'error') return t('toastTypeError');
        return t('toastTypeInfo');
    };

    function syncToastAnchor() {
        if (!toastHost) return;
        let bottom = TOAST_BASE_GAP;
        const exportButton = getExportButton();
        if (exportButton && typeof exportButton.getBoundingClientRect === 'function') {
            const rect = exportButton.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
            const isVisible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < viewportHeight;
            if (isVisible) {
                const clearGap = 12;
                const buttonHeightFromBottom = Math.max(0, viewportHeight - rect.top);
                bottom = Math.max(bottom, buttonHeightFromBottom + clearGap);
            }
        }
        toastHost.style.bottom = `${Math.ceil(bottom)}px`;
    }

    function ensureToastHost() {
        if (!document.body) return null;
        if (!toastHost) {
            toastHost = document.createElement('div');
            toastHost.id = TOAST_HOST_ID;
            toastHost.className = 'cgue-toast-host cgue-theme';
        }
        if (!toastHost.parentNode) {
            document.body.appendChild(toastHost);
        }
        if (!toastEventsBound) {
            window.addEventListener('resize', syncToastAnchor, { passive: true });
            window.addEventListener('scroll', syncToastAnchor, { passive: true });
            toastEventsBound = true;
        }
        syncToastAnchor();
        return toastHost;
    }

    function dismissToast(toastId) {
        const index = activeToasts.findIndex((toast) => toast.id === toastId);
        if (index === -1) return;
        const [toast] = activeToasts.splice(index, 1);
        if (toast?.element?.parentNode) {
            toast.element.parentNode.removeChild(toast.element);
        }
        if (activeToasts.length === 0 && toastHost?.parentNode) {
            toastHost.parentNode.removeChild(toastHost);
            toastHost = null;
            return;
        }
        syncToastAnchor();
    }

    function showToast({
        type = 'info',
        message,
        detail,
        collapsedSummary,
        collapsedDetail,
        collapsedDividerAfterLine,
        detailAfterCollapsed,
        secondaryCollapsedSummary,
        secondaryCollapsedDetail,
        dedupeKey
    } = {}) {
        const { primary, secondary } = splitToastText(message, detail);
        if (!primary) return null;
        const host = ensureToastHost();
        if (!host) return null;

        const resolvedType = normalizeToastType(type);
        const foldedSummary = normalizeToastMessage(collapsedSummary);
        const foldedDetail = normalizeToastMessage(collapsedDetail);
        const foldedDividerAfterLine = normalizeToastMessage(collapsedDividerAfterLine);
        const foldedAfterDetail = normalizeToastMessage(detailAfterCollapsed);
        const foldedSecondarySummary = normalizeToastMessage(secondaryCollapsedSummary);
        const foldedSecondaryDetail = normalizeToastMessage(secondaryCollapsedDetail);
        const key = dedupeKey || `${resolvedType}:${primary}::${secondary}::${foldedSummary}::${foldedDetail}::${foldedDividerAfterLine}::${foldedAfterDetail}::${foldedSecondarySummary}::${foldedSecondaryDetail}`;
        const existing = activeToasts.find((toast) => toast.key === key);
        if (existing?.element) {
            existing.element.classList.remove('cgue-toast-pulse');
            void existing.element.offsetWidth;
            existing.element.classList.add('cgue-toast-pulse');
            return existing.id;
        }

        const id = ++toastCounter;
        const toast = document.createElement('div');
        toast.className = `cgue-toast cgue-toast--${resolvedType}`;
        toast.setAttribute('data-toast-id', String(id));
        toast.setAttribute('role', resolvedType === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-live', resolvedType === 'error' ? 'assertive' : 'polite');
        toast.setAttribute('aria-label', getToastTypeTitle(resolvedType));

        const main = document.createElement('div');
        main.className = 'cgue-toast-main';

        const content = document.createElement('div');
        content.className = 'cgue-toast-content';

        const headlineEl = document.createElement('div');
        headlineEl.className = 'cgue-toast-headline';

        const prefixEl = document.createElement('span');
        prefixEl.className = 'cgue-toast-prefix';
        prefixEl.textContent = `${getToastTypeTitle(resolvedType)}:`;

        const messageEl = document.createElement('div');
        messageEl.className = 'cgue-toast-message';
        messageEl.textContent = primary;

        headlineEl.appendChild(prefixEl);
        headlineEl.appendChild(messageEl);
        content.appendChild(headlineEl);
        if (secondary) {
            const detailEl = document.createElement('div');
            detailEl.className = 'cgue-toast-detail';
            detailEl.textContent = secondary;
            content.appendChild(detailEl);
        }
        const appendExtraBodyLines = (bodyEl, rawText, dividerAfterLine = '') => {
            const lines = normalizeToastMessage(rawText)
                .split(/\r?\n/u)
                .map((line) => line.trim())
                .filter(Boolean);
            if (lines.length === 0) return;
            const dividerAnchor = normalizeToastMessage(dividerAfterLine);
            let dividerInserted = false;
            lines.forEach((line) => {
                const lineEl = document.createElement('div');
                lineEl.className = 'cgue-toast-extra-line';
                lineEl.textContent = line;
                bodyEl.appendChild(lineEl);
                if (!dividerInserted && dividerAnchor && line === dividerAnchor) {
                    const dividerEl = document.createElement('div');
                    dividerEl.className = 'cgue-toast-extra-inline-divider';
                    bodyEl.appendChild(dividerEl);
                    dividerInserted = true;
                }
            });
        };
        if (foldedSummary && foldedDetail) {
            const extraDetailsEl = document.createElement('details');
            extraDetailsEl.className = 'cgue-toast-extra';

            const summaryEl = document.createElement('summary');
            summaryEl.className = 'cgue-toast-extra-summary';
            summaryEl.textContent = foldedSummary;

            const bodyEl = document.createElement('div');
            bodyEl.className = 'cgue-toast-extra-body';
            appendExtraBodyLines(bodyEl, foldedDetail, foldedDividerAfterLine);

            extraDetailsEl.appendChild(summaryEl);
            extraDetailsEl.appendChild(bodyEl);
            content.appendChild(extraDetailsEl);
        }
        if (foldedAfterDetail) {
            const afterDetailEl = document.createElement('div');
            afterDetailEl.className = 'cgue-toast-detail';
            afterDetailEl.textContent = foldedAfterDetail;
            content.appendChild(afterDetailEl);
        }
        if (foldedSecondarySummary && foldedSecondaryDetail) {
            const secondaryDetailsEl = document.createElement('details');
            secondaryDetailsEl.className = 'cgue-toast-extra';

            const secondarySummaryEl = document.createElement('summary');
            secondarySummaryEl.className = 'cgue-toast-extra-summary';
            secondarySummaryEl.textContent = foldedSecondarySummary;

            const secondaryBodyEl = document.createElement('div');
            secondaryBodyEl.className = 'cgue-toast-extra-body';
            appendExtraBodyLines(secondaryBodyEl, foldedSecondaryDetail);

            secondaryDetailsEl.appendChild(secondarySummaryEl);
            secondaryDetailsEl.appendChild(secondaryBodyEl);
            content.appendChild(secondaryDetailsEl);
        }
        main.appendChild(content);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'cgue-toast-close';
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.setAttribute('aria-label', t('toastClose'));
        closeBtn.setAttribute('title', t('toastClose'));
        closeBtn.addEventListener('click', () => dismissToast(id));

        toast.appendChild(main);
        toast.appendChild(closeBtn);
        host.appendChild(toast);
        activeToasts.push({ id, key, element: toast });

        while (activeToasts.length > TOAST_MAX_VISIBLE) {
            dismissToast(activeToasts[0].id);
        }

        syncToastAnchor();
        return id;
    }

    const notify = (type, message, dedupeKeyOrOptions) => {
        if (dedupeKeyOrOptions && typeof dedupeKeyOrOptions === 'object' && !Array.isArray(dedupeKeyOrOptions)) {
            return showToast({
                type,
                message,
                detail: dedupeKeyOrOptions.detail,
                collapsedSummary: dedupeKeyOrOptions.collapsedSummary,
                collapsedDetail: dedupeKeyOrOptions.collapsedDetail,
                collapsedDividerAfterLine: dedupeKeyOrOptions.collapsedDividerAfterLine,
                detailAfterCollapsed: dedupeKeyOrOptions.detailAfterCollapsed,
                secondaryCollapsedSummary: dedupeKeyOrOptions.secondaryCollapsedSummary,
                secondaryCollapsedDetail: dedupeKeyOrOptions.secondaryCollapsedDetail,
                dedupeKey: dedupeKeyOrOptions.dedupeKey
            });
        }
        return showToast({ type, message, dedupeKey: dedupeKeyOrOptions });
    };

    const normalizeStringValue = (value, lowerCase = false) => {
        if (typeof value !== 'string') return '';
        const trimmed = value.trim();
        if (!trimmed) return '';
        return lowerCase ? trimmed.toLowerCase() : trimmed;
    };

    const firstNonEmptyValue = (...values) => {
        for (const value of values) {
            const normalized = normalizeStringValue(value, false);
            if (normalized) return normalized;
        }
        return '';
    };

    const hashString = (value) => {
        const source = String(value || '');
        let hash = 2166136261;
        for (let i = 0; i < source.length; i++) {
            hash ^= source.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(16).padStart(8, '0');
    };

    const safeJsonParse = (text, fallback = null) => {
        try {
            const parsed = JSON.parse(text);
            return parsed == null ? fallback : parsed;
        } catch (_) {
            return fallback;
        }
    };

    const EXACT_ACCOUNT_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    const EXACT_WORKSPACE_ID_PATTERN = /^ws-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    const ACCOUNT_ID_PATTERN = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
    const WORKSPACE_ID_PATTERN = /ws-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

    const normalizeExplicitAccountId = (value) => {
        const raw = normalizeStringValue(typeof value === 'string' ? value.replace(/"/g, '') : '', false);
        if (!raw) return '';
        if (EXACT_ACCOUNT_ID_PATTERN.test(raw) || EXACT_WORKSPACE_ID_PATTERN.test(raw)) {
            return raw;
        }
        return '';
    };

    const extractAccountUuid = (value) => {
        const raw = normalizeStringValue(typeof value === 'string' ? value.replace(/"/g, '') : '', false);
        if (!raw) return '';
        const match = raw.match(ACCOUNT_ID_PATTERN);
        return match ? match[0] : '';
    };

    const extractWorkspaceOrAccountId = (value) => {
        const raw = normalizeStringValue(typeof value === 'string' ? value.replace(/"/g, '') : '', false);
        if (!raw) return '';
        const workspaceMatch = raw.match(WORKSPACE_ID_PATTERN);
        if (workspaceMatch) return workspaceMatch[0];
        const accountMatch = raw.match(ACCOUNT_ID_PATTERN);
        return accountMatch ? accountMatch[0] : '';
    };

    const decodeJwtPayload = (token) => {
        const raw = normalizeStringValue(token, false);
        if (!raw || raw.split('.').length < 2) return {};
        try {
            const base64 = raw.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
            return JSON.parse(atob(padded));
        } catch (_) {
            return {};
        }
    };

    const normalizeAccountsPayloadEntry = (key, value) => {
        const account = value?.account || value || {};
        const id = firstNonEmptyValue(
            account?.account_id,
            account?.id,
            value?.account_id,
            value?.id,
            key
        );
        const structure = normalizeStringValue(
            firstNonEmptyValue(
                account?.structure,
                value?.structure,
                account?.workspace_type,
                value?.workspace_type
            ),
            true
        );
        const type = normalizeStringValue(
            firstNonEmptyValue(
                account?.type,
                value?.type,
                account?.plan_type,
                value?.plan_type
            ),
            true
        );
        const name = normalizeStringValue(
            firstNonEmptyValue(
                account?.name,
                account?.display_name,
                value?.name,
                value?.display_name
            ),
            true
        );
        return {
            key: normalizeStringValue(key, false),
            id: normalizeExplicitAccountId(id) || extractAccountUuid(id),
            isPersonal: Boolean(
                account?.is_personal ||
                account?.isPersonal ||
                value?.is_personal ||
                value?.isPersonal ||
                structure.includes('personal') ||
                /\bpersonal\b/.test(`${type} ${name}`)
            ),
            isDefault: Boolean(
                account?.is_default ||
                account?.isDefault ||
                value?.is_default ||
                value?.isDefault ||
                normalizeStringValue(key, true) === 'default'
            )
        };
    };

    const readAccountsPayloadItems = (payload) => {
        const accountsObj =
            payload?.accounts ||
            payload?.data?.accounts ||
            payload?.result?.accounts ||
            payload?.props?.pageProps?.user?.accounts ||
            payload?.user?.accounts ||
            null;
        if (!accountsObj || typeof accountsObj !== 'object') return [];
        return Object.entries(accountsObj)
            .map(([key, value]) => normalizeAccountsPayloadEntry(key, value))
            .filter((item) => item.id);
    };

    const pickPreferredAccountId = (items) => {
        const preferred =
            items.find((item) => item.isPersonal && item.id) ||
            items.find((item) => item.isDefault && item.id) ||
            items.find((item) => item.id) ||
            null;
        return preferred?.id || '';
    };

    const getPersonalAccountIdFromNextData = () => {
        const nextData = safeJsonParse(document.getElementById('__NEXT_DATA__')?.textContent || '{}', {}) || {};
        return pickPreferredAccountId(readAccountsPayloadItems(nextData));
    };

    const getPersonalAccountIdFromStorage = () => {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const normalizedKey = normalizeStringValue(key, true);
                if (!normalizedKey || (!normalizedKey.includes('account') && !normalizedKey.includes('workspace'))) continue;
                const value = localStorage.getItem(key) || '';
                const accountId = extractAccountUuid(value);
                if (accountId) return accountId;
                const fallbackId = extractWorkspaceOrAccountId(value);
                if (fallbackId) return fallbackId;
            }
        } catch (_) {}
        return '';
    };

    const getPersonalAccountIdFromAccountsApi = async (token) => {
        const bearerToken = normalizeStringValue(token || accessToken, false);
        if (!bearerToken) return '';

        const headers = { Authorization: `Bearer ${bearerToken}` };
        const deviceId = getOaiDeviceId();
        if (deviceId) {
            headers['oai-device-id'] = deviceId;
        }

        const endpoints = [
            '/backend-api/accounts/check/v4-2023-04-27',
            '/backend-api/accounts/check',
            '/backend-api/accounts'
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    headers,
                    credentials: 'same-origin',
                    cache: 'no-store'
                });
                if (!response.ok) continue;
                const data = await response.json().catch(() => null);
                const accountId = pickPreferredAccountId(readAccountsPayloadItems(data));
                if (accountId) {
                    return accountId;
                }
            } catch (_) {}
        }
        return '';
    };

    const resolvePersonalAccountId = async (session) => {
        if (personalAccountIdCache) {
            return personalAccountIdCache;
        }

        const payloadCandidates = [session, session?.data, session?.result, session?.user];
        for (const payload of payloadCandidates) {
            const accountId = pickPreferredAccountId(readAccountsPayloadItems(payload));
            if (accountId) {
                personalAccountIdCache = accountId;
                return accountId;
            }
        }

        const accountIdFromApi = await getPersonalAccountIdFromAccountsApi(session?.accessToken);
        if (accountIdFromApi) {
            personalAccountIdCache = accountIdFromApi;
            return accountIdFromApi;
        }

        const accountIdFromNextData = getPersonalAccountIdFromNextData();
        if (accountIdFromNextData) {
            personalAccountIdCache = accountIdFromNextData;
            return accountIdFromNextData;
        }

        const accountIdFromStorage = getPersonalAccountIdFromStorage();
        if (accountIdFromStorage) {
            personalAccountIdCache = accountIdFromStorage;
            return accountIdFromStorage;
        }

        return '';
    };

    const buildAccountContextFromSession = async (session) => {
        const token = normalizeStringValue(session?.accessToken || accessToken, false);
        const payload = decodeJwtPayload(token);
        const personalAccountId = await resolvePersonalAccountId(session || {});
        const stableId = firstNonEmptyValue(
            session?.user?.id,
            session?.user?.sub,
            session?.user_id,
            session?.sub,
            payload?.sub
        );
        const email = normalizeStringValue(
            firstNonEmptyValue(
                session?.user?.email,
                session?.user?.emailAddress,
                session?.user?.email_address,
                session?.email,
                payload?.email
            ),
            true
        );
        const legacyIdentity = stableId
            ? `id:${stableId}`
            : email
                ? `email:${email}`
                : '';
        const hashSource = legacyIdentity || (personalAccountId ? `account:${personalAccountId}` : '');
        if (!hashSource) return null;
        const accountHash = hashString(hashSource);
        const accountFolderKey = personalAccountId || accountHash;
        return {
            accountKey: accountHash,
            accountHash,
            accountFolderName: `${AUTO_DRIVE_ACCOUNT_FOLDER_PREFIX}${accountFolderKey}`,
            legacyAccountFolderName: `${AUTO_DRIVE_ACCOUNT_FOLDER_PREFIX}${accountHash}`,
            label: email || personalAccountId || `User ${accountHash}`,
            personalAccountId,
            stableId,
            email
        };
    };

    const removeAutoDriveValueListeners = () => {
        if (typeof GM_removeValueChangeListener === 'function') {
            if (autoDriveTasksListenerId != null) {
                GM_removeValueChangeListener(autoDriveTasksListenerId);
            }
            if (autoDriveLeaderListenerId != null) {
                GM_removeValueChangeListener(autoDriveLeaderListenerId);
            }
        }
        autoDriveObservedAccountKey = '';
        autoDriveTasksListenerId = null;
        autoDriveLeaderListenerId = null;
    };

    const ensureAutoDriveValueListeners = (accountKey) => {
        if (!accountKey || typeof GM_addValueChangeListener !== 'function') return;
        if (
            autoDriveObservedAccountKey === accountKey &&
            autoDriveTasksListenerId != null &&
            autoDriveLeaderListenerId != null
        ) {
            return;
        }

        removeAutoDriveValueListeners();
        autoDriveObservedAccountKey = accountKey;

        autoDriveTasksListenerId = GM_addValueChangeListener(
            getAutoDriveTasksStorageKey(accountKey),
            (_name, _oldValue, _newValue, remote) => {
                if (!remote) return;
                const tasks = primeAutoDriveTaskSchedules(accountKey, loadAutoDriveTasks(accountKey));
                if (state.autoDrive.accountKey === accountKey) {
                    state.autoDrive.tasks = tasks;
                }
                refreshAutoDriveUi();
                scheduleAutoDriveEvaluation('tasks-remote', 0);
            }
        );

        autoDriveLeaderListenerId = GM_addValueChangeListener(
            getAutoDriveLeaderStorageKey(accountKey),
            (_name, _oldValue, _newValue, remote) => {
                if (!remote) return;
                scheduleAutoDriveEvaluation('leader-remote', 250);
            }
        );
    };

    const syncAutoDriveAccountState = (context, errorMessage = '') => {
        const previousAccountKey = state.autoDrive.accountKey;
        if (context?.accountKey) {
            ensureAutoDriveValueListeners(context.accountKey);
            state.autoDrive.accountStatus = 'ready';
            state.autoDrive.accountKey = context.accountKey;
            state.autoDrive.accountHash = context.accountHash || context.accountKey;
            state.autoDrive.accountLabel = context.label || context.accountKey;
            state.autoDrive.accountError = '';
            if (previousAccountKey && previousAccountKey !== context.accountKey) {
                state.autoDrive.expandedTaskIds = [];
            }
            state.autoDrive.tasks = loadAutoDriveTasks(context.accountKey);
            return;
        }
        removeAutoDriveValueListeners();
        state.autoDrive.accountStatus = errorMessage ? 'error' : 'idle';
        state.autoDrive.accountKey = '';
        state.autoDrive.accountHash = '';
        state.autoDrive.accountLabel = '';
        state.autoDrive.accountError = errorMessage || '';
        state.autoDrive.tasks = [];
        state.autoDrive.expandedTaskIds = [];
    };

    async function fetchSessionSnapshot(options = {}) {
        const { notifyOnError = true, force = false } = options;
        if (sessionSnapshot && !force) {
            return sessionSnapshot;
        }
        if (force) {
            personalAccountIdCache = '';
        }
        try {
            const response = await fetch('/api/auth/session?unstable_client=true', {
                credentials: 'same-origin',
                cache: 'no-store'
            });
            const session = await response.json();
            sessionSnapshot = session && typeof session === 'object' ? session : {};
            if (sessionSnapshot?.accessToken) {
                accessToken = sessionSnapshot.accessToken;
            }
            return sessionSnapshot;
        } catch (error) {
            if (notifyOnError) {
                notify('error', t('alertNoAccessToken'));
            }
            return null;
        }
    }

    async function ensureAccountContext(options = {}) {
        const { notifyOnError = false, force = false } = options;
        if (accountContextCache?.accountKey && !force) {
            syncAutoDriveAccountState(accountContextCache);
            return accountContextCache;
        }
        const session = await fetchSessionSnapshot({ notifyOnError, force });
        const nextContext = await buildAccountContextFromSession(session || {});
        accountContextCache = nextContext;
        if (nextContext?.accountKey) {
            syncAutoDriveAccountState(nextContext);
            return nextContext;
        }
        syncAutoDriveAccountState(null, t('autoSyncAccountMissing'));
        if (notifyOnError) {
            notify('warning', t('autoSyncAccountRequired'));
        }
        return null;
    }

    async function ensureCurrentAccountContextForExport() {
        const resolved = await ensureAccountContext({ notifyOnError: false });
        if (resolved?.accountKey) {
            return resolved;
        }
        const fallback = await buildAccountContextFromSession({ accessToken });
        if (fallback?.accountKey) {
            accountContextCache = fallback;
            syncAutoDriveAccountState(fallback);
            return fallback;
        }
        return null;
    }

    const getAutoDriveTasksStorageKey = (accountKey) => `${AUTO_DRIVE_TASKS_STORAGE_PREFIX}${accountKey}`;
    const getAutoDriveLeaderStorageKey = (accountKey) => `${AUTO_DRIVE_LEADER_STORAGE_PREFIX}${accountKey}`;
    const getAutoDriveLockStorageKey = (accountKey) => `${AUTO_DRIVE_LOCK_STORAGE_PREFIX}${accountKey}`;

    const buildAutoDriveTaskId = (mode, workspaceId) => (
        mode === 'team'
            ? `team:${normalizeStringValue(workspaceId, false) || 'unknown'}`
            : 'personal'
    );

    const buildAutoDriveTaskFolderName = (mode, workspaceId) => (
        mode === 'team'
            ? `Team_${normalizeStringValue(workspaceId, false) || 'unknown'}`
            : 'Personal'
    );

    const buildDefaultAutoTaskLabel = (mode, workspaceId) => (
        mode === 'team'
            ? t('autoSyncDefaultTeamLabel', normalizeStringValue(workspaceId, false) || 'unknown')
            : t('autoSyncDefaultPersonalLabel')
    );

    const normalizeAutoDriveTaskTimestamp = (value) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    };

    const getAutoDriveTaskScheduledNextRunAt = (task) => (
        normalizeAutoDriveTaskTimestamp(task?.pausedNextRunAt) ??
        normalizeAutoDriveTaskTimestamp(task?.nextRunAt)
    );

    const resolveAutoDriveResumeNextRunAt = (task, now = Date.now()) => {
        const preservedNextRunAt = getAutoDriveTaskScheduledNextRunAt(task);
        if (preservedNextRunAt != null && preservedNextRunAt > now) {
            return preservedNextRunAt;
        }
        return now + getAutoDriveIntervalMs(task);
    };

    const normalizeAutoDriveTask = (input = {}) => {
        const form = createDefaultAutoTaskForm(input);
        const mode = form.mode;
        const workspaceId = mode === 'team' ? normalizeStringValue(form.workspaceId, false) : '';
        const id = buildAutoDriveTaskId(mode, workspaceId);
        const nextRunAt = normalizeAutoDriveTaskTimestamp(input.nextRunAt);
        const pausedNextRunAt = normalizeAutoDriveTaskTimestamp(input.pausedNextRunAt);
        const lastRunAt = Number(input.lastRunAt);
        const lastSuccessAt = Number(input.lastSuccessAt);
        const createdAt = Number(input.createdAt);
        const updatedAt = Number(input.updatedAt);
        const task = {
            id,
            mode,
            workspaceId,
            label: normalizeStringValue(form.label, false) || buildDefaultAutoTaskLabel(mode, workspaceId),
            intervalMinutes: form.intervalMinutes,
            includeRootActive: form.includeRootActive !== false,
            includeRootArchived: form.includeRootArchived !== false,
            enabled: form.enabled !== false,
            runOnStartup: form.runOnStartup !== false,
            nextRunAt,
            pausedNextRunAt,
            lastRunAt: Number.isFinite(lastRunAt) && lastRunAt > 0 ? lastRunAt : null,
            lastSuccessAt: Number.isFinite(lastSuccessAt) && lastSuccessAt > 0 ? lastSuccessAt : null,
            lastError: normalizeStringValue(input.lastError, false),
            consecutiveFailures: Math.max(0, Math.floor(Number(input.consecutiveFailures) || 0)),
            paused: input.paused === true,
            createdAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
            updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : Date.now()
        };
        if (!task.enabled) {
            task.nextRunAt = null;
            task.pausedNextRunAt = null;
        } else if (task.paused === true) {
            task.pausedNextRunAt = task.pausedNextRunAt != null ? task.pausedNextRunAt : task.nextRunAt;
            task.nextRunAt = null;
        } else {
            task.pausedNextRunAt = null;
        }
        return task;
    };

    const sortAutoDriveTasks = (tasks) => (
        [...tasks].sort((a, b) => {
            if (a.mode !== b.mode) return a.mode === 'personal' ? -1 : 1;
            return (a.workspaceId || '').localeCompare(b.workspaceId || '');
        })
    );

    const normalizeAutoDriveTasks = (tasks = []) => {
        const deduped = new Map();
        const source = Array.isArray(tasks) ? tasks : [];
        source.forEach((item) => {
            const task = normalizeAutoDriveTask(item);
            deduped.set(task.id, task);
        });
        return sortAutoDriveTasks(Array.from(deduped.values()));
    };

    const loadAutoDriveTasks = (accountKey) => {
        if (!accountKey) return [];
        const key = getAutoDriveTasksStorageKey(accountKey);
        const parsed = readStoredJsonValue(key, []);
        return normalizeAutoDriveTasks(parsed);
    };

    const saveAutoDriveTasks = (accountKey, tasks) => {
        if (!accountKey) return [];
        const normalized = normalizeAutoDriveTasks(tasks);
        writeStoredJsonValue(getAutoDriveTasksStorageKey(accountKey), normalized);
        if (state.autoDrive.accountKey === accountKey) {
            state.autoDrive.tasks = normalized;
        }
        return normalized;
    };

    const saveSingleAutoDriveTask = (accountKey, task) => {
        if (!accountKey || !task) return null;
        const tasks = loadAutoDriveTasks(accountKey).filter((item) => item.id !== task.id);
        tasks.push(normalizeAutoDriveTask({
            ...task,
            updatedAt: Date.now()
        }));
        const saved = saveAutoDriveTasks(accountKey, tasks);
        return saved.find((item) => item.id === task.id) || null;
    };

    const deleteAutoDriveTask = (accountKey, taskId) => {
        if (!accountKey || !taskId) return [];
        return saveAutoDriveTasks(
            accountKey,
            loadAutoDriveTasks(accountKey).filter((item) => item.id !== taskId)
        );
    };

    const getAutoTaskById = (accountKey, taskId) => {
        const tasks = loadAutoDriveTasks(accountKey);
        return tasks.find((task) => task.id === taskId) || null;
    };

    const readLeaseRecord = (key) => {
        const raw = readStoredJsonValue(key, null);
        return raw && typeof raw === 'object' ? raw : null;
    };

    const claimLeaseRecord = (key, ttlMs, payload = {}) => {
        const now = Date.now();
        const current = readLeaseRecord(key);
        if (current?.ownerId && current.ownerId !== TAB_INSTANCE_ID && Number(current.expiresAt || 0) > now) {
            return null;
        }
        const next = {
            ownerId: TAB_INSTANCE_ID,
            expiresAt: now + ttlMs,
            updatedAt: now,
            ...payload
        };
        writeStoredJsonValue(key, next);
        const verified = readLeaseRecord(key);
        return verified?.ownerId === TAB_INSTANCE_ID ? verified : null;
    };

    const renewLeaseRecord = (key, ttlMs, patch = {}) => {
        const current = readLeaseRecord(key);
        if (!current || current.ownerId !== TAB_INSTANCE_ID) return null;
        const now = Date.now();
        const next = {
            ...current,
            ...patch,
            ownerId: TAB_INSTANCE_ID,
            updatedAt: now,
            expiresAt: now + ttlMs
        };
        writeStoredJsonValue(key, next);
        return next;
    };

    const releaseLeaseRecord = (key) => {
        const current = readLeaseRecord(key);
        if (!current || current.ownerId !== TAB_INSTANCE_ID) return;
        writeStoredValue(key, '');
    };

    const createExportStats = () => ({
        total: 0,
        success: 0,
        failed: 0,
        driveUpdatedCount: 0,
        driveUploadStartedAtMs: null,
        driveUploadDurationMs: null,
        driveUploadCompletedAtMs: null,
        compRetryAttempts: 0,
        failures: []
    });

    const recordExportFailure = (stats, item, error, compRetryAttempts = 0) => {
        if (!stats) return;
        const errorMessage = error?.message || (error ? String(error) : 'Unknown error');
        stats.failed += 1;
        stats.failures.push({
            id: item?.id || '',
            title: item?.title || item?.id || t('untitledConversation'),
            groupLabel: item?.groupLabel || '',
            compRetryAttempts: Number(compRetryAttempts) || 0,
            errorMessage
        });
    };

    const appendToastDetailLine = (detail, line) => {
        const base = normalizeToastMessage(detail);
        const extra = normalizeToastMessage(line);
        if (!extra) return base;
        return base ? `${base}\n${extra}` : extra;
    };

    const formatSpaceSummary = (context = {}) => {
        const mode = context?.mode === 'team' ? 'team' : 'personal';
        if (mode === 'team') {
            const workspaceId = normalizeToastMessage(context?.workspaceId);
            return {
                summary: t('teamTitle'),
                detail: workspaceId ? t('toastWorkspace', workspaceId) : ''
            };
        }
        return {
            summary: t('personalTitle'),
            detail: ''
        };
    };

    const getRootModeSummary = (includeRootActive, includeRootArchived) => {
        if (includeRootActive && includeRootArchived) return t('rootAllShort');
        if (includeRootActive) return t('rootActiveShort');
        if (includeRootArchived) return t('rootArchivedShort');
        return '';
    };

    const buildFinalExportNotification = (backupResult, targets, stats, context = {}) => {
        const localEnabled = targets?.local === true;
        const driveEnabled = targets?.drive === true;
        const localOk = backupResult?.localOk === true;
        const driveOk = backupResult?.driveOk === true;
        const localError = backupResult?.localError || null;
        const driveError = backupResult?.driveError || null;
        const localErrorMessage = localError?.message || (localError ? String(localError) : 'Unknown error');
        const driveErrorMessage = driveError ? formatDriveError(driveError) : 'Unknown error';
        const hasRootFilterContext = (
            typeof context?.includeRootActive === 'boolean' ||
            typeof context?.includeRootArchived === 'boolean'
        );
        const includeRootActive = hasRootFilterContext ? context.includeRootActive !== false : true;
        const includeRootArchived = hasRootFilterContext ? context.includeRootArchived !== false : true;
        const spaceInfo = formatSpaceSummary(context);

        let baseNotification = { type: 'error', message: t('alertNoBackupTarget') };
        if (driveEnabled) {
            baseNotification = driveOk
                ? { type: 'success', message: t('alertExportDoneDrive') }
                : { type: 'error', message: t('alertDriveUploadFailed', driveErrorMessage) };
        } else if (localEnabled) {
            if (localOk) {
                baseNotification = { type: 'success', message: t('alertExportDoneLocal') };
            } else if (localError?.__isSaveError) {
                baseNotification = { type: 'error', message: t('alertSaveFailed', localErrorMessage) };
            } else {
                baseNotification = { type: 'error', message: t('alertExportFailed', localErrorMessage) };
            }
        }

        if (!stats) {
            return {
                type: baseNotification.type,
                message: baseNotification.message || '',
                detail: ''
            };
        }
        const total = Math.max(0, Number(stats.total) || 0);
        const success = Math.max(0, Number(stats.success) || 0);
        const failed = Math.max(0, Number(stats.failed) || Math.max(0, total - success));
        const summary = `${success}/${total}`;
        const mergedType = (failed > 0 && baseNotification.type === 'success')
            ? 'warning'
            : baseNotification.type;
        const driveUpdatedCount = Math.max(0, Number(stats.driveUpdatedCount) || 0);
        const driveUploadDurationMs = typeof stats.driveUploadDurationMs === 'number' &&
            !Number.isNaN(stats.driveUploadDurationMs)
            ? Math.max(0, stats.driveUploadDurationMs)
            : null;
        const driveUploadStartedAtMs = typeof stats.driveUploadStartedAtMs === 'number' &&
            !Number.isNaN(stats.driveUploadStartedAtMs)
            ? stats.driveUploadStartedAtMs
            : null;
        const driveUploadCompletedAtMs = typeof stats.driveUploadCompletedAtMs === 'number' &&
            !Number.isNaN(stats.driveUploadCompletedAtMs)
            ? stats.driveUploadCompletedAtMs
            : null;
        const incrementalStats = context?.incrementalStats && typeof context.incrementalStats === 'object'
            ? context.incrementalStats
            : null;
        const incrementalListed = incrementalStats
            ? Math.max(0, Number(incrementalStats.totalListed) || 0)
            : 0;
        const incrementalKept = incrementalStats
            ? Math.max(0, Number(incrementalStats.incrementalKept) || 0)
            : 0;
        const incrementalSkipped = incrementalStats
            ? Math.max(0, Number(incrementalStats.skipped) || 0)
            : 0;
        const rootFilterSummary = hasRootFilterContext
            ? getRootModeSummary(includeRootActive, includeRootArchived)
            : '';
        const rootLine = rootFilterSummary ? t('toastRootFilter', rootFilterSummary) : '';
        const locationLine = stripLeadingStatusEmoji(baseNotification.message || '');
        const detail = '';
        let collapsedSummary = '';
        let collapsedDetail = '';
        collapsedDetail = appendToastDetailLine(collapsedDetail, spaceInfo.summary ? t('toastSpace', spaceInfo.summary) : '');
        collapsedDetail = appendToastDetailLine(collapsedDetail, spaceInfo.detail);
        collapsedDetail = appendToastDetailLine(collapsedDetail, rootLine);
        collapsedDetail = appendToastDetailLine(collapsedDetail, locationLine);
        if (driveEnabled) {
            const resolvedDurationMs = (
                driveUploadDurationMs != null
                    ? driveUploadDurationMs
                    : (driveUploadStartedAtMs != null && driveUploadCompletedAtMs != null
                        ? Math.max(0, driveUploadCompletedAtMs - driveUploadStartedAtMs)
                        : null)
            );
            if (resolvedDurationMs != null) {
                collapsedDetail = appendToastDetailLine(collapsedDetail, t('toastUploadTime', formatDuration(resolvedDurationMs)));
            }
            collapsedDetail = appendToastDetailLine(collapsedDetail, t('toastDriveUpdatedCount', driveUpdatedCount));
            if (incrementalStats) {
                collapsedDetail = appendToastDetailLine(
                    collapsedDetail,
                    t('toastIncrementalSummary', incrementalKept, incrementalListed, incrementalSkipped)
                );
            }
        }
        if (collapsedDetail) {
            collapsedSummary = t('toastDetailsSummary');
        }
        return {
            type: mergedType,
            message: summary,
            detail,
            collapsedSummary,
            collapsedDetail,
            collapsedDividerAfterLine: rootLine
        };
    };

    const getExportTargetLabel = (targets = state.backupTargets) => (
        targets && targets.drive ? t('exportTargetDrive') : t('exportTargetLocal')
    );

    const getRootLabelFromArchived = (isArchived) => (
        isArchived ? t('rootArchivedShort') : t('rootActiveShort')
    );

    const getRootExportLabel = (includeActive, includeArchived) => {
        if (includeActive && includeArchived) return t('rootAllShort');
        if (!includeActive && !includeArchived) return t('rootNoneShort');
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
            const raw = readStoredValue(DRIVE_SETTINGS_KEY);
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
            const raw = readStoredValue(BACKUP_TARGETS_KEY);
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
            const raw = readStoredValue(EXPORT_OPTIONS_KEY);
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
            writeStoredValue(DRIVE_SETTINGS_KEY, JSON.stringify(driveSettings));
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
            writeStoredValue(BACKUP_TARGETS_KEY, JSON.stringify(normalized));
        } catch (error) {
            console.warn('[CGUE Plus] Backup targets persist failed:', error);
        }
        return normalized;
    }

    function persistExportOptions(patch = {}) {
        const next = { ...state.exportAllOptions, ...patch };
        state.exportAllOptions = next;
        try {
            writeStoredValue(EXPORT_OPTIONS_KEY, JSON.stringify(next));
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

    const renameDriveFile = async (fileId, nextName) => {
        if (!fileId || !nextName) {
            throw new Error('Drive rename target is missing.');
        }
        const token = await ensureDriveAccessToken();
        const response = await performDriveRequest({
            method: 'PATCH',
            url: `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(String(fileId))}?fields=id,name`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify({ name: nextName })
        });
        const text = response.responseText || '';
        if (response.status >= 200 && response.status < 300) {
            try {
                return text ? JSON.parse(text) : {};
            } catch (error) {
                throw new Error(`Drive rename parse failed: ${error?.message || String(error)}`);
            }
        }
        throw new Error(`Drive rename HTTP ${response.status}: ${text || '[empty response]'}`);
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
            url: `${DRIVE_FILES_ENDPOINT}?q=${query}&fields=files(id,name,modifiedTime)&spaces=drive`,
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
            return files
                .filter((file) => file?.id)
                .map((file) => {
                    const name = typeof file.name === 'string' ? file.name : '';
                    return {
                        id: String(file.id),
                        name,
                        modifiedTime: file?.modifiedTime || null,
                        updatedAtMs: parseDriveDateLabelMs(extractDriveDateLabel(name))
                    };
                });
        }
        throw new Error(`Drive file lookup HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    const getDriveExistingFilesByConversationId = async (folderId, conversationId, cache) => {
        if (!conversationId) return [];
        const cacheKey = String(conversationId);
        if (cache.has(cacheKey)) return cache.get(cacheKey);
        const files = await listDriveFilesByConversationId(folderId, cacheKey);
        cache.set(cacheKey, files);
        return files;
    };

    const extractDriveDateLabel = (filename) => {
        if (!filename) return null;
        const trimmed = filename.replace(/\.json$/i, '');
        const index = trimmed.lastIndexOf(FILENAME_SEPARATOR);
        if (index === -1) return null;
        const dateLabel = trimmed.slice(index + FILENAME_SEPARATOR.length);
        return dateLabel || null;
    };

    const parseDriveDateLabelMs = (dateLabel) => {
        if (!dateLabel) return null;
        const match = String(dateLabel).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const [, year, month, day, hour, minute, second] = match;
        const parsed = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second)
        ).getTime();
        return Number.isNaN(parsed) ? null : parsed;
    };

    const parseDriveModifiedTimeMs = (modifiedTime) => {
        if (!modifiedTime) return null;
        const parsed = Date.parse(modifiedTime);
        return Number.isNaN(parsed) ? null : parsed;
    };

    const toUnixSecondBucket = (timestampMs) => {
        if (typeof timestampMs !== 'number' || Number.isNaN(timestampMs)) return null;
        return Math.floor(timestampMs / 1000);
    };

    const getDriveFileSortMs = (file) => {
        const modifiedMs = parseDriveModifiedTimeMs(file?.modifiedTime);
        if (modifiedMs != null) return modifiedMs;
        return parseDriveDateLabelMs(extractDriveDateLabel(file?.name));
    };

    const pickPrimaryDriveFile = (files) => {
        if (!Array.isArray(files) || files.length === 0) return null;
        let primary = files[0];
        let primaryMs = getDriveFileSortMs(primary);
        for (let i = 1; i < files.length; i++) {
            const current = files[i];
            const currentMs = getDriveFileSortMs(current);
            if (currentMs != null && (primaryMs == null || currentMs > primaryMs)) {
                primary = current;
                primaryMs = currentMs;
            }
        }
        return primary;
    };

    const normalizeDriveFileMeta = (file, fallbackName) => {
        if (!file?.id) return null;
        const name = typeof file.name === 'string' && file.name ? file.name : (fallbackName || '');
        const updatedAtMs = typeof file?.updatedAtMs === 'number' && !Number.isNaN(file.updatedAtMs)
            ? file.updatedAtMs
            : parseDriveDateLabelMs(extractDriveDateLabel(name));
        return {
            id: String(file.id),
            name,
            modifiedTime: file?.modifiedTime || null,
            updatedAtMs: updatedAtMs != null ? updatedAtMs : null
        };
    };

    const buildDriveJsonMultipartBody = (content, fileInfo, folderId) => {
        const boundary = `cgueBoundary${Date.now()}${Math.floor(Math.random() * 1000)}`;
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
        return { boundary, multipartBody };
    };

    const uploadJsonToDrive = async (content, fileInfo, folderId) => {
        const token = await ensureDriveAccessToken();
        const { boundary, multipartBody } = buildDriveJsonMultipartBody(content, fileInfo, folderId);
        const response = await performDriveRequest({
            method: 'POST',
            url: `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,name,modifiedTime`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        const text = response.responseText || '';
        if (response.status >= 200 && response.status < 300) {
            try {
                return text ? JSON.parse(text) : {};
            } catch (error) {
                throw new Error(`Drive upload parse failed: ${error?.message || String(error)}`);
            }
        }
        throw new Error(`Drive upload HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    const overwriteJsonInDrive = async (content, fileInfo, fileId) => {
        if (!fileId) {
            throw new Error('Drive overwrite file id is missing.');
        }
        const token = await ensureDriveAccessToken();
        const { boundary, multipartBody } = buildDriveJsonMultipartBody(content, fileInfo, null);
        const response = await performDriveRequest({
            method: 'PATCH',
            url: `${DRIVE_UPLOAD_ENDPOINT}/${encodeURIComponent(String(fileId))}?uploadType=multipart&fields=id,name,modifiedTime`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
        });

        const text = response.responseText || '';
        if (response.status >= 200 && response.status < 300) {
            try {
                return text ? JSON.parse(text) : {};
            } catch (error) {
                throw new Error(`Drive overwrite parse failed: ${error?.message || String(error)}`);
            }
        }
        throw new Error(`Drive overwrite HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    const deleteDriveFileById = async (fileId) => {
        if (!fileId) return;
        const token = await ensureDriveAccessToken();
        const response = await performDriveRequest({
            method: 'DELETE',
            url: `${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(String(fileId))}`,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        if (response.status >= 200 && response.status < 300) return;
        if (response.status === 404) return;
        const text = response.responseText || '';
        throw new Error(`Drive delete HTTP ${response.status}: ${text || '[empty response]'}`);
    };

    const deleteDriveFileWithRetry = async (fileId, retries = 2) => {
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                await deleteDriveFileById(fileId);
                return true;
            } catch (error) {
                lastError = error;
                if (attempt >= retries) break;
                const delay = 300 * (attempt + 1) + Math.floor(Math.random() * 120);
                await sleep(delay);
            }
        }
        console.warn(`[CGUE Plus] Drive duplicate cleanup failed (${fileId}): ${formatDriveError(lastError)}`);
        return false;
    };

    const syncConversationToDrive = async (content, fileInfo, folderId, cache) => {
        if (!fileInfo?.conversationId) {
            await uploadJsonToDrive(content, fileInfo, folderId);
            return { action: 'created', changed: true };
        }
        const conversationId = String(fileInfo.conversationId);
        const existingFiles = await getDriveExistingFilesByConversationId(folderId, conversationId, cache);
        if (!Array.isArray(existingFiles) || existingFiles.length === 0) {
            const created = await uploadJsonToDrive(content, fileInfo, folderId);
            const createdMeta = normalizeDriveFileMeta(created, fileInfo?.filename || 'conversation.json');
            cache.set(conversationId, createdMeta ? [createdMeta] : []);
            return { action: 'created', changed: true };
        }

        const primary = pickPrimaryDriveFile(existingFiles);
        if (!primary?.id) {
            const created = await uploadJsonToDrive(content, fileInfo, folderId);
            const createdMeta = normalizeDriveFileMeta(created, fileInfo?.filename || 'conversation.json');
            cache.set(conversationId, createdMeta ? [createdMeta] : []);
            return { action: 'created', changed: true };
        }

        const currentUpdatedAtMs = typeof fileInfo?.updatedAtMs === 'number' && !Number.isNaN(fileInfo.updatedAtMs)
            ? fileInfo.updatedAtMs
            : parseDriveDateLabelMs(fileInfo?.dateLabel || extractDriveDateLabel(fileInfo?.filename));
        const primaryUpdatedAtMs = typeof primary?.updatedAtMs === 'number' && !Number.isNaN(primary.updatedAtMs)
            ? primary.updatedAtMs
            : parseDriveDateLabelMs(extractDriveDateLabel(primary?.name));
        const currentUpdatedAtSec = toUnixSecondBucket(currentUpdatedAtMs);
        const primaryUpdatedAtSec = toUnixSecondBucket(primaryUpdatedAtMs);
        const shouldOverwrite = !(
            currentUpdatedAtSec != null &&
            primaryUpdatedAtSec != null &&
            currentUpdatedAtSec === primaryUpdatedAtSec
        );

        let primaryMeta = null;
        let action = 'unchanged';
        if (shouldOverwrite) {
            const overwritten = await overwriteJsonInDrive(content, fileInfo, primary.id);
            primaryMeta = normalizeDriveFileMeta({
                id: primary.id,
                name: overwritten?.name || fileInfo?.filename || primary?.name || 'conversation.json',
                modifiedTime: overwritten?.modifiedTime || primary?.modifiedTime || null,
                updatedAtMs: currentUpdatedAtMs
            }, fileInfo?.filename || primary?.name || 'conversation.json');
            action = 'updated';
        } else {
            primaryMeta = normalizeDriveFileMeta({
                id: primary.id,
                name: primary?.name || fileInfo?.filename || 'conversation.json',
                modifiedTime: primary?.modifiedTime || null,
                updatedAtMs: primaryUpdatedAtMs != null ? primaryUpdatedAtMs : currentUpdatedAtMs
            }, fileInfo?.filename || primary?.name || 'conversation.json');
        }
        const nextFiles = primaryMeta ? [primaryMeta] : [];

        for (const file of existingFiles) {
            if (!file?.id || String(file.id) === String(primary.id)) continue;
            const deleted = await deleteDriveFileWithRetry(file.id, 2);
            if (!deleted) {
                const staleMeta = normalizeDriveFileMeta(file, fileInfo?.filename || file?.name || 'conversation.json');
                if (staleMeta) nextFiles.push(staleMeta);
            }
        }

        cache.set(conversationId, nextFiles);
        return { action, changed: action !== 'unchanged' };
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
            notify('warning', t('alertNoBackupTarget'));
            return null;
        }
        if (targets.drive && !hasDriveCredentials()) {
            if (!targets.local) {
                notify('warning', t('alertDriveMissingConfig'));
                return null;
            }
            notify('warning', t('alertDriveMissingConfig'));
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

    async function ensureAccessToken(options = {}) {
        const { notifyOnError = true, force = false } = options;
        if (accessToken) return accessToken;
        const session = await fetchSessionSnapshot({ notifyOnError, force });
        if (session?.accessToken) {
            accessToken = session.accessToken;
            if (!accountContextCache) {
                accountContextCache = await buildAccountContextFromSession(session);
                if (accountContextCache?.accountKey) {
                    syncAutoDriveAccountState(accountContextCache);
                }
            }
            return accessToken;
        }
        if (notifyOnError) {
            notify('error', t('alertNoAccessToken'));
        }
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
        const resolvedUpdatedAtMs = resolveConversationUpdatedAtMs(convData, updatedAtMs);
        const dateLabel = formatFilenameDateLabel(resolvedUpdatedAtMs);
        const conversationId = extractConversationId(convData);
        return {
            filename: `${baseTitle}${FILENAME_SEPARATOR}${dateLabel}.json`,
            baseTitle,
            dateLabel,
            displayTitle,
            conversationId,
            updatedAtMs: resolvedUpdatedAtMs
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

    function shouldPatchSetImmediate() {
        try {
            if (typeof GM_xmlhttpRequest !== 'function') return false;
        } catch (_) {
            return false;
        }
        try {
            if (typeof unsafeWindow === 'undefined') return false;
            return unsafeWindow !== window;
        } catch (_) {
            return false;
        }
    }

    function patchSetImmediate() {
        const root = typeof globalThis !== 'undefined' ? globalThis : window;
        const originalSetImmediate = root.setImmediate;
        const originalClearImmediate = root.clearImmediate;
        root.setImmediate = (callback, ...args) => setTimeout(callback, 0, ...args);
        root.clearImmediate = (id) => clearTimeout(id);
        return () => {
            if (originalSetImmediate) {
                root.setImmediate = originalSetImmediate;
            } else {
                try {
                    delete root.setImmediate;
                } catch (_) {}
            }
            if (originalClearImmediate) {
                root.clearImmediate = originalClearImmediate;
            } else {
                try {
                    delete root.clearImmediate;
                } catch (_) {}
            }
        };
    }

    async function generateZipBlob(zip) {
        if (!zip) return null;
        let restore = null;
        if (shouldPatchSetImmediate()) {
            // Avoid userscript sandbox setImmediate stalls in JSZip.
            restore = patchSetImmediate();
        }
        try {
            return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        } finally {
            if (restore) restore();
        }
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
        const label = mode === 'team' ? (workspaceId || 'Team') : 'Personal';
        return buildDefaultZipName(label);
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
        const metaStore = options?.metaStore && typeof options.metaStore === 'object'
            ? options.metaStore
            : null;

        if (gizmoId) {
            let cursor = '0';
            do {
                const r = await fetch(`/backend-api/gizmos/${gizmoId}/conversations?cursor=${cursor}`, { headers });
                if (!r.ok) throw new Error(t('errListProject', r.status));
                const j = await r.json();
                j.items?.forEach((it) => {
                    all.add(it.id);
                    if (metaStore && it?.id && it.update_time) {
                        metaStore[it.id] = it.update_time;
                    }
                });
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
                        j.items.forEach((it) => {
                            all.add(it.id);
                            if (metaStore && it?.id && it.update_time) {
                                metaStore[it.id] = it.update_time;
                            }
                        });
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

    const getCompRetryDelayMs = (retryIndex) => {
        const index = Math.max(1, Number(retryIndex) || 1);
        return COMP_RETRY_BASE_MS * (COMP_RETRY_FACTOR ** (index - 1));
    };

    const isConversationNetworkError = (error) => {
        const message = error?.message || String(error || '');
        return error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(message);
    };

    async function getConversation(id, workspaceId, options = {}) {
        const headers = buildHeaders(workspaceId);
        const retries = Number.isFinite(options.retries)
            ? Math.max(0, Math.floor(options.retries))
            : 2;
        const retryBaseDelayMs = Number.isFinite(options.retryBaseDelayMs)
            ? Math.max(0, Number(options.retryBaseDelayMs))
            : 400;
        const retryJitterMs = Number.isFinite(options.retryJitterMs)
            ? Math.max(0, Number(options.retryJitterMs))
            : 200;
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const r = await fetch(`/backend-api/conversation/${id}`, {
                    headers,
                    cache: 'no-store'
                });
                if (!r.ok) {
                    const retryableStatus = r.status === 429 || r.status >= 500;
                    if (retryableStatus && attempt < retries) {
                        const delay = retryBaseDelayMs * (attempt + 1) + (retryJitterMs > 0 ? Math.floor(Math.random() * retryJitterMs) : 0);
                        await sleep(delay);
                        continue;
                    }
                    throw new Error(t('errGetConversation', r.status));
                }
                const j = await r.json();
                j.__fetched_at = new Date().toISOString();
                return j;
            } catch (error) {
                lastError = error;
                const message = error?.message || String(error);
                const isNetworkError = isConversationNetworkError(error);
                if (!isNetworkError || attempt >= retries) {
                    throw error;
                }
                const delay = retryBaseDelayMs * (attempt + 1) + (retryJitterMs > 0 ? Math.floor(Math.random() * retryJitterMs) : 0);
                if (retries > 0) {
                    console.warn(`[CGUE Plus] getConversation retry ${attempt + 1}/${retries} for ${id}: ${message}`);
                }
                await sleep(delay);
            }
        }
        throw lastError || new Error(t('errGetConversation', 'unknown'));
    }

    async function runCompensationRetry(item, workspaceId, options = {}) {
        const maxRetries = Number.isFinite(options.maxRetries)
            ? Math.max(1, Math.floor(options.maxRetries))
            : COMP_RETRY_MAX;
        const onAttemptStart = typeof options.onAttemptStart === 'function'
            ? options.onAttemptStart
            : null;
        if (!item?.id) {
            return {
                ok: false,
                error: new Error('Conversation id is missing.'),
                compRetryAttempts: 0
            };
        }
        let lastError = null;
        for (let retryIndex = 1; retryIndex <= maxRetries; retryIndex++) {
            if (onAttemptStart) {
                onAttemptStart({ item, retryIndex, maxRetries });
            }
            await sleep(getCompRetryDelayMs(retryIndex));
            try {
                const convData = await getConversation(item.id, workspaceId, {
                    retries: 0,
                    retryBaseDelayMs: 0,
                    retryJitterMs: 0
                });
                return {
                    ok: true,
                    convData,
                    compRetryAttempts: retryIndex
                };
            } catch (error) {
                lastError = error;
                if (retryIndex >= maxRetries) break;
            }
        }
        return {
            ok: false,
            error: lastError || new Error(t('errGetConversation', 'unknown')),
            compRetryAttempts: maxRetries
        };
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

    function formatDateTime(ms, options = {}) {
        const d = new Date(ms);
        const year = d.getFullYear();
        const month = pad2(d.getMonth() + 1);
        const day = pad2(d.getDate());
        const hours = pad2(d.getHours());
        const minutes = pad2(d.getMinutes());
        if (options?.includeSeconds !== true) {
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
        const seconds = pad2(d.getSeconds());
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    function formatDuration(ms) {
        const safeMs = Math.max(0, Number(ms) || 0);
        const totalSeconds = Math.round(safeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${pad2(seconds)}`;
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
            const data = safeJsonParse(document.getElementById('__NEXT_DATA__')?.textContent || '{}', {}) || {};
            readAccountsPayloadItems(data).forEach((item) => {
                if (item?.id && !item.isPersonal) {
                    foundIds.add(item.id);
                }
            });
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

    function setButtonBusy(text) {
        const btn = getExportButton();
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = text;
    }

    function resetButtonNow() {
        const btn = getExportButton();
        if (!btn) return;
        btn.disabled = false;
        setButtonIdle(btn);
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

    function stopAccountExecutionLockHeartbeat() {
        if (autoDriveLockRenewTimer) {
            clearInterval(autoDriveLockRenewTimer);
            autoDriveLockRenewTimer = null;
        }
        autoDriveHeldLockKey = '';
    }

    function startAccountExecutionLockHeartbeat(lockKey, accountKey, source, taskId = '') {
        stopAccountExecutionLockHeartbeat();
        if (!lockKey) return;
        autoDriveHeldLockKey = lockKey;
        autoDriveLockRenewTimer = setInterval(() => {
            renewLeaseRecord(lockKey, AUTO_DRIVE_LOCK_TTL_MS, {
                accountKey,
                source,
                taskId
            });
        }, AUTO_DRIVE_LOCK_RENEW_MS);
    }

    async function acquireAccountExecutionLock(accountKey, source, taskId = '') {
        if (!accountKey) {
            return async () => {};
        }
        const lockKey = getAutoDriveLockStorageKey(accountKey);
        const claimed = claimLeaseRecord(lockKey, AUTO_DRIVE_LOCK_TTL_MS, {
            accountKey,
            source,
            taskId
        });
        if (!claimed) return null;
        startAccountExecutionLockHeartbeat(lockKey, accountKey, source, taskId);
        return async () => {
            if (autoDriveHeldLockKey === lockKey) {
                stopAccountExecutionLockHeartbeat();
            }
            releaseLeaseRecord(lockKey);
        };
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

    async function appendConversationToTargets(convData, item, context) {
        if (!convData || !context) {
            return {
                driveAttempted: false,
                driveOk: false,
                driveChanged: false
            };
        }
        const fileInfo = buildConversationFileInfo(convData, item?.updatedAtMs);
        const payload = JSON.stringify(convData, null, 2);
        let driveAttempted = false;
        let driveOk = false;
        let driveChanged = false;

        if (context.zip) {
            if (item?.zipFolder) {
                item.zipFolder.file(fileInfo.filename, payload);
            } else {
                context.zip.file(fileInfo.filename, payload);
            }
        }

        if (context.driveFolderId && !context.driveState?.error) {
            driveAttempted = true;
            try {
                if (item?.driveStatusLabel && item?.driveStatusIndex && item?.driveStatusTotal) {
                    setButtonStatus(formatDriveUploadStatus(item.driveStatusLabel, item.driveStatusIndex, item.driveStatusTotal));
                }
                const syncResult = await syncConversationToDrive(payload, fileInfo, context.driveFolderId, context.driveCache);
                driveOk = true;
                driveChanged = syncResult?.changed === true;
                if (syncResult?.changed && context.exportStats) {
                    context.exportStats.driveUpdatedCount += 1;
                }
            } catch (error) {
                if (context.driveState) {
                    context.driveState.error = error;
                }
            }
        }
        return {
            driveAttempted,
            driveOk,
            driveChanged
        };
    }

    async function exportAllConversations(mode, workspaceId, saveHandle, options = {}, backupTargets) {
        const btn = getExportButton();
        if (btn) btn.disabled = true;
        state.isExporting = true;

        if (!await ensureAccessToken()) {
            scheduleReset(t('statusError'));
            return;
        }

        const accountContext = await ensureCurrentAccountContextForExport();
        const accountKey = accountContext?.accountKey || '';
        let releaseLock = null;
        if (accountKey) {
            releaseLock = await acquireAccountExecutionLock(
                accountKey,
                'manual-export-all',
                mode === 'team' ? (workspaceId || 'team') : 'personal'
            );
            if (!releaseLock) {
                notify('warning', t('alertExportBusy'));
                scheduleReset(t('statusError'));
                return;
            }
        }

        const targets = backupTargets || state.backupTargets;
        const incrementalEnabled = targets.drive === true && Boolean(accountKey);
        const baselineSuccessIds = new Set();
        const incrementalStats = incrementalEnabled
            ? { totalListed: 0, incrementalKept: 0, skipped: 0 }
            : null;
        const prevMeta = incrementalEnabled
            ? loadIncrementalUpdateMap(accountKey, mode, workspaceId)
            : {};
        const currMeta = incrementalEnabled ? {} : null;

        let finalStatus = t('statusDone');
        try {
            const zip = targets.local ? new JSZip() : null;
            const driveCache = new Map();
            const driveState = { error: null };
            const exportStats = createExportStats();
            const deferredQueue = [];
            const exportContext = {
                zip,
                driveFolderId: null,
                driveCache,
                driveState,
                exportStats
            };

            const queueForCompensation = (item, error) => {
                deferredQueue.push({ ...item, lastError: error || null });
                console.warn(`[CGUE Plus] Deferred conversation ${item.id}:`, error?.message || String(error || 'Unknown error'));
            };

            const markBaselineSuccess = (id, appendResult) => {
                if (!incrementalEnabled) return;
                if (appendResult?.driveAttempted === true && appendResult?.driveOk === true) {
                    baselineSuccessIds.add(id);
                }
            };

            if (targets.drive) {
                exportStats.driveUploadStartedAtMs = Date.now();
                try {
                    setButtonStatus(t('statusUploadingDrive'));
                    const rootFolderId = await ensureDriveFolder(DRIVE_ROOT_FOLDER_NAME);
                    exportContext.driveFolderId = await ensureDriveFolder(getDriveFolderName(mode, workspaceId), rootFolderId);
                } catch (err) {
                    driveState.error = err;
                }
            }

            const includeRootActive = options.includeRootActive !== false;
            const includeRootArchived = options.includeRootArchived !== false;
            const rootExportLabel = getRootExportLabel(includeRootActive, includeRootArchived);
            let rootIdsRaw = [];
            if (includeRootActive || includeRootArchived) {
                const initialArchived = includeRootActive ? false : true;
                setButtonStatus(t('statusFetchingRoot', getRootLabelFromArchived(initialArchived), 1));
                rootIdsRaw = await collectIds(btn, workspaceId, null, {
                    includeActive: includeRootActive,
                    includeArchived: includeRootArchived,
                    metaStore: currMeta
                });
            }
            const rootIds = incrementalEnabled
                ? rootIdsRaw.filter((id) => isIncrementalByUpdateTime(id, prevMeta, currMeta))
                : rootIdsRaw;
            if (incrementalStats) {
                incrementalStats.totalListed += rootIdsRaw.length;
                incrementalStats.incrementalKept += rootIds.length;
                incrementalStats.skipped += Math.max(0, rootIdsRaw.length - rootIds.length);
            }
            exportStats.total += rootIds.length;
            for (let i = 0; i < rootIds.length; i++) {
                setButtonStatus(t('statusExportRoot', rootExportLabel, i + 1, rootIds.length));
                const queueItem = {
                    id: rootIds[i],
                    title: rootIds[i],
                    groupLabel: rootExportLabel,
                    updatedAtMs: null,
                    zipFolder: null,
                    driveStatusLabel: rootExportLabel,
                    driveStatusIndex: i + 1,
                    driveStatusTotal: rootIds.length
                };
                try {
                    const convData = await getConversation(queueItem.id, workspaceId);
                    const appendResult = await appendConversationToTargets(convData, queueItem, exportContext);
                    markBaselineSuccess(queueItem.id, appendResult);
                    exportStats.success += 1;
                } catch (err) {
                    queueForCompensation(queueItem, err);
                }
                await sleep(jitter());
            }

            setButtonStatus(t('statusFetchingProjects'));
            const projects = await getProjects(workspaceId);
            for (const project of projects) {
                const projectFolder = zip ? zip.folder(sanitizeFilename(project.title)) : null;
                setButtonStatus(t('statusFetchingProject', project.title));
                const projectConvIdsRaw = await collectIds(btn, workspaceId, project.id, {
                    metaStore: currMeta
                });
                const projectConvIds = incrementalEnabled
                    ? projectConvIdsRaw.filter((id) => isIncrementalByUpdateTime(id, prevMeta, currMeta))
                    : projectConvIdsRaw;
                if (incrementalStats) {
                    incrementalStats.totalListed += projectConvIdsRaw.length;
                    incrementalStats.incrementalKept += projectConvIds.length;
                    incrementalStats.skipped += Math.max(0, projectConvIdsRaw.length - projectConvIds.length);
                }
                if (projectConvIds.length === 0) continue;
                exportStats.total += projectConvIds.length;
                for (let i = 0; i < projectConvIds.length; i++) {
                    setButtonStatus(t('statusExportProject', project.title, i + 1, projectConvIds.length));
                    const queueItem = {
                        id: projectConvIds[i],
                        title: projectConvIds[i],
                        groupLabel: t('groupProject', project.title),
                        updatedAtMs: null,
                        zipFolder: projectFolder,
                        driveStatusLabel: shortLabel(project.title),
                        driveStatusIndex: i + 1,
                        driveStatusTotal: projectConvIds.length
                    };
                    try {
                        const convData = await getConversation(queueItem.id, workspaceId);
                        const appendResult = await appendConversationToTargets(convData, queueItem, exportContext);
                        markBaselineSuccess(queueItem.id, appendResult);
                        exportStats.success += 1;
                    } catch (err) {
                        queueForCompensation(queueItem, err);
                    }
                    await sleep(jitter());
                }
            }

            for (let i = 0; i < deferredQueue.length; i++) {
                const queueItem = deferredQueue[i];
                const retryResult = await runCompensationRetry(queueItem, workspaceId, {
                    maxRetries: COMP_RETRY_MAX,
                    onAttemptStart: ({ retryIndex, maxRetries }) => {
                        const label = queueItem.groupLabel || queueItem.title || queueItem.id;
                        setButtonStatus(t('statusCompRetry', label, i + 1, deferredQueue.length, retryIndex, maxRetries));
                    }
                });
                exportStats.compRetryAttempts += Number(retryResult.compRetryAttempts) || 0;
                if (retryResult.ok) {
                    const retryQueueItem = {
                        ...queueItem,
                        driveStatusLabel: queueItem.driveStatusLabel || shortLabel(queueItem.groupLabel || queueItem.id),
                        driveStatusIndex: i + 1,
                        driveStatusTotal: deferredQueue.length
                    };
                    const appendResult = await appendConversationToTargets(
                        retryResult.convData,
                        retryQueueItem,
                        exportContext
                    );
                    markBaselineSuccess(queueItem.id, appendResult);
                    exportStats.success += 1;
                    continue;
                }
                recordExportFailure(
                    exportStats,
                    queueItem,
                    retryResult.error || queueItem.lastError,
                    retryResult.compRetryAttempts
                );
            }

            if (exportStats.failures.length > 0) {
                console.warn('[CGUE Plus] Conversations failed after compensation retries:', exportStats.failures);
            }
            if (exportStats.compRetryAttempts > 0) {
                console.info(`[CGUE Plus] Compensation retries used: ${exportStats.compRetryAttempts}`);
            }

            let blob = null;
            if (zip) {
                setButtonStatus(t('statusGeneratingZip'));
                blob = await generateZipBlob(zip);
            }
            const driveResult = targets.drive
                ? { ok: Boolean(exportContext.driveFolderId && !driveState.error), error: driveState.error }
                : null;
            const backupResult = await finalizeExport(blob, mode, workspaceId, saveHandle, targets, driveResult);
            if (targets.drive) {
                exportStats.driveUploadCompletedAtMs = Date.now();
                if (typeof exportStats.driveUploadStartedAtMs === 'number' && !Number.isNaN(exportStats.driveUploadStartedAtMs)) {
                    exportStats.driveUploadDurationMs = Math.max(0, exportStats.driveUploadCompletedAtMs - exportStats.driveUploadStartedAtMs);
                }
            }
            const finalNotification = buildFinalExportNotification(backupResult, targets, exportStats, {
                mode,
                workspaceId,
                includeRootActive,
                includeRootArchived,
                incrementalStats: incrementalEnabled ? incrementalStats : null
            });
            if (finalNotification?.message) {
                notify(finalNotification.type, finalNotification.message, {
                    detail: finalNotification.detail,
                    collapsedSummary: finalNotification.collapsedSummary,
                    collapsedDetail: finalNotification.collapsedDetail,
                    collapsedDividerAfterLine: finalNotification.collapsedDividerAfterLine,
                    detailAfterCollapsed: finalNotification.detailAfterCollapsed,
                    secondaryCollapsedSummary: finalNotification.secondaryCollapsedSummary,
                    secondaryCollapsedDetail: finalNotification.secondaryCollapsedDetail
                });
            }
            if (!finalNotification || finalNotification.type === 'error') {
                finalStatus = t('statusError');
            }
        } catch (err) {
            console.error('Export failed:', err);
            if (err?.__isSaveError) {
                notify('error', t('alertSaveFailed', err?.message || String(err)));
            } else {
                notify('error', t('alertExportFailed', err?.message || String(err)));
            }
            finalStatus = t('statusError');
        } finally {
            if (incrementalEnabled && currMeta) {
                const nextMeta = { ...prevMeta };
                baselineSuccessIds.forEach((id) => {
                    if (currMeta[id]) {
                        nextMeta[id] = currMeta[id];
                    }
                });
                saveIncrementalUpdateMap(accountKey, mode, workspaceId, nextMeta);
            }
            if (releaseLock) {
                await releaseLock();
            }
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

        const accountContext = await ensureCurrentAccountContextForExport();
        const accountKey = accountContext?.accountKey || '';
        let releaseLock = null;
        if (accountKey) {
            releaseLock = await acquireAccountExecutionLock(
                accountKey,
                'manual-export-selected',
                mode === 'team' ? (workspaceId || 'team') : 'personal'
            );
            if (!releaseLock) {
                notify('warning', t('alertExportBusy'));
                scheduleReset(t('statusError'));
                return;
            }
        }

        let finalStatus = t('statusDone');
        try {
            const targets = backupTargets || state.backupTargets;
            const zip = targets.local ? new JSZip() : null;
            const driveCache = new Map();
            const driveState = { error: null };
            const exportStats = createExportStats();
            const deferredQueue = [];
            const exportContext = {
                zip,
                driveFolderId: null,
                driveCache,
                driveState,
                exportStats
            };

            const queueForCompensation = (item, error) => {
                deferredQueue.push({ ...item, lastError: error || null });
                console.warn(`[CGUE Plus] Deferred conversation ${item.id}:`, error?.message || String(error || 'Unknown error'));
            };

            if (targets.drive) {
                exportStats.driveUploadStartedAtMs = Date.now();
                try {
                    setButtonStatus(t('statusUploadingDrive'));
                    const rootFolderId = await ensureDriveFolder(DRIVE_ROOT_FOLDER_NAME);
                    exportContext.driveFolderId = await ensureDriveFolder(getDriveFolderName(mode, workspaceId), rootFolderId);
                } catch (err) {
                    driveState.error = err;
                }
            }

            const selectionSet = new Set(selectedIds);
            const projectFolders = new Map();
            const totalSelected = index.items.filter((item) => selectionSet.has(item.id));

            if (totalSelected.length === 0) {
                notify('warning', t('alertNoSelection'));
                finalStatus = t('statusError');
                return;
            }
            exportStats.total = totalSelected.length;

            let processed = 0;
            for (const group of index.groups) {
                const groupItems = group.items.filter((item) => selectionSet.has(item.id));
                if (groupItems.length === 0) continue;
                for (const item of groupItems) {
                    processed += 1;
                    let queueItem = null;
                    if (group.projectTitle) {
                        const folderKey = group.projectId || group.key;
                        let folder = projectFolders.get(folderKey);
                        if (!folder && zip) {
                            folder = zip.folder(sanitizeFilename(group.projectTitle));
                            projectFolders.set(folderKey, folder);
                        }
                        queueItem = {
                            id: item.id,
                            title: item.title || item.id,
                            groupLabel: t('groupProject', group.projectTitle),
                            updatedAtMs: item.updatedAtMs,
                            zipFolder: folder,
                            driveStatusLabel: shortLabel(group.projectTitle),
                            driveStatusIndex: processed,
                            driveStatusTotal: totalSelected.length
                        };
                        setButtonStatus(t('statusExportProject', group.projectTitle, processed, totalSelected.length));
                    } else {
                        const rootLabel = group.key === 'root-archived'
                            ? t('rootArchivedShort')
                            : t('rootActiveShort');
                        queueItem = {
                            id: item.id,
                            title: item.title || item.id,
                            groupLabel: rootLabel,
                            updatedAtMs: item.updatedAtMs,
                            zipFolder: null,
                            driveStatusLabel: rootLabel,
                            driveStatusIndex: processed,
                            driveStatusTotal: totalSelected.length
                        };
                        setButtonStatus(t('statusExportRoot', rootLabel, processed, totalSelected.length));
                    }

                    try {
                        const convData = await getConversation(queueItem.id, workspaceId);
                        await appendConversationToTargets(convData, queueItem, exportContext);
                        exportStats.success += 1;
                    } catch (err) {
                        queueForCompensation(queueItem, err);
                    }
                    await sleep(jitter());
                }
            }

            for (let i = 0; i < deferredQueue.length; i++) {
                const queueItem = deferredQueue[i];
                const retryResult = await runCompensationRetry(queueItem, workspaceId, {
                    maxRetries: COMP_RETRY_MAX,
                    onAttemptStart: ({ retryIndex, maxRetries }) => {
                        const label = queueItem.groupLabel || queueItem.title || queueItem.id;
                        setButtonStatus(t('statusCompRetry', label, i + 1, deferredQueue.length, retryIndex, maxRetries));
                    }
                });
                exportStats.compRetryAttempts += Number(retryResult.compRetryAttempts) || 0;
                if (retryResult.ok) {
                    await appendConversationToTargets(
                        retryResult.convData,
                        {
                            ...queueItem,
                            driveStatusLabel: queueItem.driveStatusLabel || shortLabel(queueItem.groupLabel || queueItem.id),
                            driveStatusIndex: i + 1,
                            driveStatusTotal: deferredQueue.length
                        },
                        exportContext
                    );
                    exportStats.success += 1;
                    continue;
                }
                recordExportFailure(
                    exportStats,
                    queueItem,
                    retryResult.error || queueItem.lastError,
                    retryResult.compRetryAttempts
                );
            }

            if (exportStats.failures.length > 0) {
                console.warn('[CGUE Plus] Selected conversations failed after compensation retries:', exportStats.failures);
            }
            if (exportStats.compRetryAttempts > 0) {
                console.info(`[CGUE Plus] Compensation retries used: ${exportStats.compRetryAttempts}`);
            }

            let blob = null;
            if (zip) {
                setButtonStatus(t('statusGeneratingZip'));
                blob = await generateZipBlob(zip);
            }
            const driveResult = targets.drive
                ? { ok: Boolean(exportContext.driveFolderId && !driveState.error), error: driveState.error }
                : null;
            const backupResult = await finalizeExport(blob, mode, workspaceId, saveHandle, targets, driveResult);
            if (targets.drive) {
                exportStats.driveUploadCompletedAtMs = Date.now();
                if (typeof exportStats.driveUploadStartedAtMs === 'number' && !Number.isNaN(exportStats.driveUploadStartedAtMs)) {
                    exportStats.driveUploadDurationMs = Math.max(0, exportStats.driveUploadCompletedAtMs - exportStats.driveUploadStartedAtMs);
                }
            }
            const finalNotification = buildFinalExportNotification(backupResult, targets, exportStats, {
                mode,
                workspaceId
            });
            if (finalNotification?.message) {
                notify(finalNotification.type, finalNotification.message, {
                    detail: finalNotification.detail,
                    collapsedSummary: finalNotification.collapsedSummary,
                    collapsedDetail: finalNotification.collapsedDetail,
                    collapsedDividerAfterLine: finalNotification.collapsedDividerAfterLine,
                    detailAfterCollapsed: finalNotification.detailAfterCollapsed,
                    secondaryCollapsedSummary: finalNotification.secondaryCollapsedSummary,
                    secondaryCollapsedDetail: finalNotification.secondaryCollapsedDetail
                });
            }
            if (!finalNotification || finalNotification.type === 'error') {
                finalStatus = t('statusError');
            }
        } catch (err) {
            console.error('Export failed:', err);
            if (err?.__isSaveError) {
                notify('error', t('alertSaveFailed', err?.message || String(err)));
            } else {
                notify('error', t('alertExportFailed', err?.message || String(err)));
            }
            finalStatus = t('statusError');
        } finally {
            if (releaseLock) {
                await releaseLock();
            }
            scheduleReset(finalStatus);
        }
    }

    function refreshAutoDriveUi() {
        const dialog = document.getElementById(BACKUP_DIALOG_ID);
        if (dialog && typeof dialog.__refreshAutoDriveSection === 'function') {
            dialog.__refreshAutoDriveSection();
        }
    }

    const getAutoDriveTaskLabel = (task) => (
        normalizeStringValue(task?.label, false) ||
        buildDefaultAutoTaskLabel(task?.mode, task?.workspaceId)
    );

    const getAutoDriveIntervalMs = (task) => (
        Math.max(
            AUTO_DRIVE_MIN_INTERVAL_MINUTES,
            Math.floor(Number(task?.intervalMinutes) || AUTO_DRIVE_DEFAULT_INTERVAL_MINUTES)
        ) * 60 * 1000
    );

    const getAutoDriveFailureDelayMs = (task, failureCount) => {
        const intervalMs = getAutoDriveIntervalMs(task);
        const failures = Math.max(1, Math.floor(Number(failureCount) || 1));
        if (failures >= 5) return Math.max(intervalMs * 4, 60 * 60 * 1000);
        if (failures >= 3) return Math.max(intervalMs * 2, 30 * 60 * 1000);
        return intervalMs;
    };

    const getAutoDriveErrorMessage = (error) => {
        if (!error) return 'Unknown error';
        return error?.message || formatDriveError(error) || String(error);
    };

    const shouldPauseAutoDriveTask = (error) => {
        const message = getAutoDriveErrorMessage(error);
        if (!hasDriveCredentials()) return true;
        return /invalid_grant|invalid_client|unauthorized_client|refresh token|drive token/i.test(message);
    };

    const updateAutoDriveTaskState = (accountKey, taskId, patch) => {
        if (!accountKey || !taskId) return null;
        const currentTask = getAutoTaskById(accountKey, taskId);
        if (!currentTask) return null;
        const nextPatch = typeof patch === 'function' ? patch(currentTask) : patch;
        const nextTask = normalizeAutoDriveTask({
            ...currentTask,
            ...(nextPatch || {}),
            updatedAt: Date.now()
        });
        return saveSingleAutoDriveTask(accountKey, nextTask);
    };

    const setAutoDriveTaskRunning = (taskId, running) => {
        const runningIds = new Set(state.autoDrive.runningTaskIds || []);
        if (running) {
            runningIds.add(taskId);
        } else {
            runningIds.delete(taskId);
        }
        state.autoDrive.runningTaskIds = Array.from(runningIds);
        state.autoDrive.runningTaskId = state.autoDrive.runningTaskIds[0] || '';
        refreshAutoDriveUi();
    };

    async function ensureAutoDriveTaskFolder(accountContext, task) {
        if (!accountContext?.accountFolderName) {
            throw new Error(t('autoSyncAccountRequired'));
        }
        const rootFolderId = await ensureDriveFolder(DRIVE_ROOT_FOLDER_NAME);
        let accountFolderId = await findDriveFolderId(accountContext.accountFolderName, rootFolderId);
        if (!accountFolderId) {
            const legacyFolderName = normalizeStringValue(accountContext.legacyAccountFolderName, false);
            if (legacyFolderName && legacyFolderName !== accountContext.accountFolderName) {
                const legacyFolderId = await findDriveFolderId(legacyFolderName, rootFolderId);
                if (legacyFolderId) {
                    try {
                        await renameDriveFile(legacyFolderId, accountContext.accountFolderName);
                    } catch (error) {
                        console.warn(
                            `[CGUE Plus] Drive account folder rename failed (${legacyFolderName} -> ${accountContext.accountFolderName}):`,
                            formatDriveError(error)
                        );
                    }
                    accountFolderId = legacyFolderId;
                }
            }
        }
        if (!accountFolderId) {
            accountFolderId = await createDriveFolder(accountContext.accountFolderName, rootFolderId);
        }
        return ensureDriveFolder(buildAutoDriveTaskFolderName(task.mode, task.workspaceId), accountFolderId);
    }

    function buildAutoDriveQueueItem(id, label, updatedAtValue, index, total) {
        const updatedAtMs = normalizeTimestamp(updatedAtValue);
        return {
            id,
            title: id,
            groupLabel: label,
            updatedAtMs: updatedAtMs != null ? updatedAtMs : null,
            driveStatusLabel: shortLabel(label || id),
            driveStatusIndex: index,
            driveStatusTotal: total
        };
    }

    async function syncAutoDriveQueueItem(queueItem, workspaceId, driveFolderId, driveCache, exportStats) {
        const convData = await getConversation(queueItem.id, workspaceId);
        const fileInfo = buildConversationFileInfo(convData, queueItem.updatedAtMs);
        const payload = JSON.stringify(convData, null, 2);
        if (queueItem.driveStatusLabel && queueItem.driveStatusIndex && queueItem.driveStatusTotal) {
            setButtonStatus(formatDriveUploadStatus(queueItem.driveStatusLabel, queueItem.driveStatusIndex, queueItem.driveStatusTotal));
        }
        const syncResult = await syncConversationToDrive(payload, fileInfo, driveFolderId, driveCache);
        if (syncResult?.changed && exportStats) {
            exportStats.driveUpdatedCount += 1;
        }
        return syncResult;
    }

    async function runDriveIncrementalSync(task, accountContext, source = 'auto') {
        if (!task) {
            throw new Error('Auto sync task is missing.');
        }
        if (!accountContext?.accountKey) {
            throw new Error(t('autoSyncAccountRequired'));
        }
        if (!hasDriveCredentials()) {
            throw new Error(t('alertDriveMissingConfig'));
        }
        const mode = task.mode === 'team' ? 'team' : 'personal';
        const workspaceId = mode === 'team'
            ? normalizeStringValue(task.workspaceId, false)
            : null;
        if (mode === 'team' && !workspaceId) {
            throw new Error(t('autoSyncWorkspaceRequired'));
        }

        await ensureDriveAccessToken();
        const ensuredToken = await ensureAccessToken({ notifyOnError: false, force: true });
        if (!ensuredToken) {
            throw new Error(t('alertNoAccessToken'));
        }

        const driveFolderId = await ensureAutoDriveTaskFolder(accountContext, task);
        const driveCache = new Map();
        const exportStats = createExportStats();
        const deferredQueue = [];
        const baselineSuccessIds = new Set();
        const incrementalStats = {
            totalListed: 0,
            incrementalKept: 0,
            skipped: 0
        };
        const prevMeta = loadIncrementalUpdateMap(accountContext.accountKey, mode, workspaceId);
        const currMeta = {};
        const queuedIds = new Set();

        const queueForCompensation = (item, error) => {
            deferredQueue.push({ ...item, lastError: error || null });
            console.warn(`[CGUE Plus] Auto sync deferred conversation ${item.id}:`, getAutoDriveErrorMessage(error));
        };

        const processQueue = async (ids, label) => {
            const uniqueIds = ids.filter((id) => {
                if (queuedIds.has(id)) return false;
                queuedIds.add(id);
                return true;
            });
            exportStats.total += uniqueIds.length;
            for (let i = 0; i < uniqueIds.length; i++) {
                const queueItem = buildAutoDriveQueueItem(
                    uniqueIds[i],
                    label,
                    currMeta[uniqueIds[i]],
                    i + 1,
                    uniqueIds.length
                );
                try {
                    await syncAutoDriveQueueItem(queueItem, workspaceId, driveFolderId, driveCache, exportStats);
                    baselineSuccessIds.add(queueItem.id);
                    exportStats.success += 1;
                } catch (error) {
                    queueForCompensation(queueItem, error);
                }
                await sleep(jitter());
            }
        };

        exportStats.driveUploadStartedAtMs = Date.now();

        const includeRootActive = task.includeRootActive !== false;
        const includeRootArchived = task.includeRootArchived !== false;
        if (includeRootActive || includeRootArchived) {
            const rootLabel = getRootExportLabel(includeRootActive, includeRootArchived);
            const rootIdsRaw = await collectIds(null, workspaceId, null, {
                includeActive: includeRootActive,
                includeArchived: includeRootArchived,
                metaStore: currMeta
            });
            const rootIds = rootIdsRaw.filter((id) => isIncrementalByUpdateTime(id, prevMeta, currMeta));
            incrementalStats.totalListed += rootIdsRaw.length;
            incrementalStats.incrementalKept += rootIds.length;
            incrementalStats.skipped += Math.max(0, rootIdsRaw.length - rootIds.length);
            await processQueue(rootIds, rootLabel);
        }

        const projects = await getProjects(workspaceId);
        for (const project of projects) {
            const projectIdsRaw = await collectIds(null, workspaceId, project.id, {
                metaStore: currMeta
            });
            const projectIds = projectIdsRaw.filter((id) => isIncrementalByUpdateTime(id, prevMeta, currMeta));
            incrementalStats.totalListed += projectIdsRaw.length;
            incrementalStats.incrementalKept += projectIds.length;
            incrementalStats.skipped += Math.max(0, projectIdsRaw.length - projectIds.length);
            await processQueue(projectIds, t('groupProject', project.title));
        }

        for (let i = 0; i < deferredQueue.length; i++) {
            const queueItem = deferredQueue[i];
            const retryResult = await runCompensationRetry(queueItem, workspaceId, {
                maxRetries: COMP_RETRY_MAX,
                onAttemptStart: ({ retryIndex, maxRetries }) => {
                    const label = queueItem.groupLabel || queueItem.title || queueItem.id;
                    setButtonStatus(t('statusCompRetry', label, i + 1, deferredQueue.length, retryIndex, maxRetries));
                }
            });
            exportStats.compRetryAttempts += Number(retryResult.compRetryAttempts) || 0;
            if (retryResult.ok) {
                try {
                    await syncAutoDriveQueueItem({
                        ...queueItem,
                        driveStatusIndex: i + 1,
                        driveStatusTotal: deferredQueue.length
                    }, workspaceId, driveFolderId, driveCache, exportStats);
                    baselineSuccessIds.add(queueItem.id);
                    exportStats.success += 1;
                    continue;
                } catch (error) {
                    recordExportFailure(
                        exportStats,
                        queueItem,
                        error,
                        retryResult.compRetryAttempts
                    );
                    continue;
                }
            }
            recordExportFailure(
                exportStats,
                queueItem,
                retryResult.error || queueItem.lastError,
                retryResult.compRetryAttempts
            );
        }

        exportStats.driveUploadCompletedAtMs = Date.now();
        exportStats.driveUploadDurationMs = Math.max(
            0,
            exportStats.driveUploadCompletedAtMs - exportStats.driveUploadStartedAtMs
        );

        const nextMeta = { ...prevMeta };
        baselineSuccessIds.forEach((id) => {
            if (currMeta[id]) {
                nextMeta[id] = currMeta[id];
            }
        });
        saveIncrementalUpdateMap(accountContext.accountKey, mode, workspaceId, nextMeta);

        return {
            source,
            mode,
            workspaceId,
            driveFolderId,
            exportStats,
            incrementalStats
        };
    }

    const isRunnableAutoDriveTask = (task) => Boolean(task?.enabled && task?.paused !== true);

    const sortAutoDriveRunQueue = (tasks = []) => (
        [...tasks].sort((a, b) => {
            const aNext = Number(a?.nextRunAt) || 0;
            const bNext = Number(b?.nextRunAt) || 0;
            if (aNext !== bNext) return aNext - bNext;
            if ((a?.mode || '') !== (b?.mode || '')) {
                return a?.mode === 'personal' ? -1 : 1;
            }
            return (a?.workspaceId || '').localeCompare(b?.workspaceId || '');
        })
    );

    const primeAutoDriveTaskSchedules = (accountKey, tasks, now = Date.now()) => {
        if (!accountKey) return [];
        let changed = false;
        const nextTasks = (Array.isArray(tasks) ? tasks : []).map((task) => {
            if (!task) return task;
            if (!isRunnableAutoDriveTask(task)) {
                if (task.nextRunAt != null) {
                    changed = true;
                    return normalizeAutoDriveTask({
                        ...task,
                        nextRunAt: null
                    });
                }
                return task;
            }
            if (Number(task.nextRunAt) > 0) {
                return task;
            }
            changed = true;
            return normalizeAutoDriveTask({
                ...task,
                nextRunAt: task.runOnStartup && !task.lastRunAt
                    ? now
                    : now + getAutoDriveIntervalMs(task)
            });
        });
        const normalizedTasks = normalizeAutoDriveTasks(nextTasks);
        return changed ? saveAutoDriveTasks(accountKey, normalizedTasks) : normalizedTasks;
    };

    const getNextAutoDriveWakeDelayMs = (tasks, now = Date.now()) => {
        const runnableTasks = (Array.isArray(tasks) ? tasks : []).filter(isRunnableAutoDriveTask);
        if (runnableTasks.length === 0) return null;
        let earliest = null;
        for (const task of runnableTasks) {
            const nextRunAt = Number(task.nextRunAt) || now;
            if (nextRunAt <= now) return 0;
            if (earliest == null || nextRunAt < earliest) {
                earliest = nextRunAt;
            }
        }
        return earliest == null ? null : Math.max(1000, earliest - now);
    };

    function clearAutoDriveSchedulerTimer() {
        if (autoDriveSchedulerTimer) {
            clearTimeout(autoDriveSchedulerTimer);
            autoDriveSchedulerTimer = null;
        }
    }

    function stopAutoDriveLeaderHeartbeat() {
        if (autoDriveLeaderRenewTimer) {
            clearInterval(autoDriveLeaderRenewTimer);
            autoDriveLeaderRenewTimer = null;
        }
    }

    function startAutoDriveLeaderHeartbeat(accountKey) {
        stopAutoDriveLeaderHeartbeat();
        if (!accountKey) return;
        autoDriveLeaderAccountKey = accountKey;
        const leaderKey = getAutoDriveLeaderStorageKey(accountKey);
        autoDriveLeaderRenewTimer = setInterval(() => {
            const renewed = renewLeaseRecord(leaderKey, AUTO_DRIVE_LEADER_TTL_MS, {
                accountKey
            });
            if (!renewed) {
                stopAutoDriveLeaderHeartbeat();
                if (autoDriveLeaderAccountKey === accountKey) {
                    autoDriveLeaderAccountKey = '';
                }
                scheduleAutoDriveEvaluation('leader-lost', AUTO_DRIVE_LOCK_RETRY_MS);
            }
        }, AUTO_DRIVE_LEADER_RENEW_MS);
    }

    function releaseAutoDriveLeader(accountKey = autoDriveLeaderAccountKey) {
        if (!accountKey) return;
        if (autoDriveLeaderAccountKey === accountKey) {
            stopAutoDriveLeaderHeartbeat();
            autoDriveLeaderAccountKey = '';
        }
        releaseLeaseRecord(getAutoDriveLeaderStorageKey(accountKey));
    }

    function ensureAutoDriveLeader(accountKey) {
        if (!accountKey) return false;
        if (autoDriveLeaderAccountKey && autoDriveLeaderAccountKey !== accountKey) {
            releaseAutoDriveLeader(autoDriveLeaderAccountKey);
        }
        const leaderKey = getAutoDriveLeaderStorageKey(accountKey);
        const current = readLeaseRecord(leaderKey);
        if (current?.ownerId === TAB_INSTANCE_ID) {
            renewLeaseRecord(leaderKey, AUTO_DRIVE_LEADER_TTL_MS, { accountKey });
            if (!autoDriveLeaderRenewTimer || autoDriveLeaderAccountKey !== accountKey) {
                startAutoDriveLeaderHeartbeat(accountKey);
            }
            autoDriveLeaderAccountKey = accountKey;
            return true;
        }
        const claimed = claimLeaseRecord(leaderKey, AUTO_DRIVE_LEADER_TTL_MS, { accountKey });
        if (!claimed) return false;
        startAutoDriveLeaderHeartbeat(accountKey);
        autoDriveLeaderAccountKey = accountKey;
        return true;
    }

    function scheduleAutoDriveEvaluation(reason = 'timer', delayMs = null) {
        clearAutoDriveSchedulerTimer();
        const accountKey = state.autoDrive.accountKey || accountContextCache?.accountKey || '';
        if (!accountKey) return;
        const tasks = loadAutoDriveTasks(accountKey);
        const runnableTasks = tasks.filter(isRunnableAutoDriveTask);
        if (runnableTasks.length === 0) return;
        const resolvedDelay = typeof delayMs === 'number'
            ? Math.max(0, Math.floor(delayMs))
            : getNextAutoDriveWakeDelayMs(runnableTasks, Date.now());
        if (resolvedDelay == null) return;
        autoDriveSchedulerTimer = setTimeout(() => {
            autoDriveSchedulerTimer = null;
            void evaluateAutoDriveTasks(reason);
        }, resolvedDelay);
    }

    async function executeAutoDriveTask(taskId, options = {}) {
        const source = options.source === 'manual' ? 'manual' : 'auto';
        const accountContext = options.accountContext || await ensureAccountContext({
            notifyOnError: source === 'manual',
            force: source !== 'auto'
        });
        if (!accountContext?.accountKey) {
            if (source === 'manual') {
                notify('warning', t('autoSyncAccountRequired'));
            }
            return {
                status: 'error',
                error: new Error(t('autoSyncAccountRequired'))
            };
        }
        const accountKey = accountContext.accountKey;
        let task = getAutoTaskById(accountKey, taskId);
        if (!task) {
            return {
                status: 'missing',
                error: new Error('Auto sync task not found.')
            };
        }

        const taskLabel = getAutoDriveTaskLabel(task);
        if (source === 'manual') {
            notify('info', t('autoSyncTaskStarted', taskLabel));
        }

        const busyUntil = Date.now() + AUTO_DRIVE_LOCK_RETRY_MS;
        if (state.isExporting) {
            updateAutoDriveTaskState(accountKey, task.id, { nextRunAt: busyUntil });
            if (source === 'manual') {
                notify('warning', t('alertExportBusy'));
            }
            return { status: 'busy' };
        }

        const releaseLock = await acquireAccountExecutionLock(
            accountKey,
            source === 'manual' ? 'manual-auto-drive' : 'auto-drive',
            task.id
        );
        if (!releaseLock) {
            updateAutoDriveTaskState(accountKey, task.id, { nextRunAt: busyUntil });
            if (source === 'manual') {
                notify('warning', t('alertExportBusy'));
            }
            return { status: 'busy' };
        }

        const startedAt = Date.now();
        const previousError = normalizeStringValue(task.lastError, false);
        const wasPaused = task.paused === true;
        setAutoDriveTaskRunning(task.id, true);
        state.isExporting = true;
        setButtonBusy(t('autoSyncTaskStatusRunning'));
        updateAutoDriveTaskState(accountKey, task.id, {
            lastRunAt: startedAt,
            nextRunAt: startedAt + getAutoDriveIntervalMs(task)
        });

        try {
            const result = await runDriveIncrementalSync(task, accountContext, source);
            task = updateAutoDriveTaskState(accountKey, task.id, {
                lastRunAt: startedAt,
                lastSuccessAt: Date.now(),
                lastError: '',
                consecutiveFailures: 0,
                paused: false,
                nextRunAt: Date.now() + getAutoDriveIntervalMs(task)
            }) || task;
            if (previousError || wasPaused) {
                notify('success', t('autoSyncTaskRecovered', getAutoDriveTaskLabel(task)));
            }
            return {
                status: 'success',
                task,
                result
            };
        } catch (error) {
            const message = getAutoDriveErrorMessage(error);
            const pauseTask = shouldPauseAutoDriveTask(error);
            const failureCount = Math.max(0, Number(task.consecutiveFailures) || 0) + 1;
            task = updateAutoDriveTaskState(accountKey, task.id, {
                lastRunAt: startedAt,
                lastError: message,
                consecutiveFailures: failureCount,
                paused: pauseTask,
                nextRunAt: pauseTask || task.enabled === false
                    ? null
                    : Date.now() + getAutoDriveFailureDelayMs(task, failureCount)
            }) || task;
            if (pauseTask) {
                notify('warning', t('autoSyncTaskPausedByError', getAutoDriveTaskLabel(task), message));
            } else if (!previousError || previousError !== message) {
                notify('warning', t('autoSyncTaskFailed', getAutoDriveTaskLabel(task), message));
            }
            return {
                status: 'error',
                task,
                error
            };
        } finally {
            await releaseLock();
            state.isExporting = false;
            resetButtonNow();
            setAutoDriveTaskRunning(taskId, false);
            refreshAutoDriveUi();
        }
    }

    async function evaluateAutoDriveTasks(reason = 'timer') {
        if (autoDriveCurrentRunPromise) {
            return autoDriveCurrentRunPromise;
        }
        autoDriveCurrentRunPromise = (async () => {
            const accountContext = await ensureAccountContext({
                notifyOnError: false,
                force: reason !== 'timer'
            });
            if (!accountContext?.accountKey) {
                clearAutoDriveSchedulerTimer();
                releaseAutoDriveLeader(autoDriveLeaderAccountKey);
                refreshAutoDriveUi();
                return null;
            }

            const accountKey = accountContext.accountKey;
            let tasks = primeAutoDriveTaskSchedules(accountKey, loadAutoDriveTasks(accountKey));
            if (state.autoDrive.accountKey === accountKey) {
                state.autoDrive.tasks = tasks;
            }
            refreshAutoDriveUi();

            const runnableTasks = tasks.filter(isRunnableAutoDriveTask);
            if (runnableTasks.length === 0) {
                clearAutoDriveSchedulerTimer();
                releaseAutoDriveLeader(accountKey);
                return null;
            }

            if (!ensureAutoDriveLeader(accountKey)) {
                scheduleAutoDriveEvaluation('leader-retry', AUTO_DRIVE_LEADER_RENEW_MS);
                return null;
            }

            const now = Date.now();
            const dueTasks = sortAutoDriveRunQueue(
                runnableTasks.filter((task) => !task.nextRunAt || task.nextRunAt <= now)
            );
            if (dueTasks.length === 0) {
                scheduleAutoDriveEvaluation('wait', getNextAutoDriveWakeDelayMs(runnableTasks, now));
                return null;
            }

            for (const dueTask of dueTasks) {
                const result = await executeAutoDriveTask(dueTask.id, {
                    source: 'auto',
                    accountContext
                });
                if (result?.status === 'busy') {
                    break;
                }
                tasks = primeAutoDriveTaskSchedules(accountKey, loadAutoDriveTasks(accountKey));
                if (state.autoDrive.accountKey === accountKey) {
                    state.autoDrive.tasks = tasks;
                }
            }

            const refreshedTasks = primeAutoDriveTaskSchedules(accountKey, loadAutoDriveTasks(accountKey));
            if (state.autoDrive.accountKey === accountKey) {
                state.autoDrive.tasks = refreshedTasks;
            }
            const nextDelay = getNextAutoDriveWakeDelayMs(refreshedTasks, Date.now());
            if (nextDelay != null) {
                scheduleAutoDriveEvaluation('post-run', nextDelay);
            }
            return null;
        })().finally(() => {
            autoDriveCurrentRunPromise = null;
            refreshAutoDriveUi();
        });
        return autoDriveCurrentRunPromise;
    }

    async function refreshAutoDriveAccountState(options = {}) {
        const context = await ensureAccountContext({
            notifyOnError: false,
            force: options.force === true
        });
        if (!context?.accountKey) {
            clearAutoDriveSchedulerTimer();
            releaseAutoDriveLeader(autoDriveLeaderAccountKey);
            refreshAutoDriveUi();
            return null;
        }
        const tasks = primeAutoDriveTaskSchedules(context.accountKey, loadAutoDriveTasks(context.accountKey));
        if (state.autoDrive.accountKey === context.accountKey) {
            state.autoDrive.tasks = tasks;
        }
        refreshAutoDriveUi();
        if (options.schedule !== false) {
            scheduleAutoDriveEvaluation('account-refresh', 0);
        }
        return context;
    }

    function stopAutoDriveAutomation(options = {}) {
        clearAutoDriveSchedulerTimer();
        if (options.releaseLeader !== false) {
            releaseAutoDriveLeader(autoDriveLeaderAccountKey);
        } else {
            stopAutoDriveLeaderHeartbeat();
        }
        refreshAutoDriveUi();
    }

    async function runAutoDriveTaskNow(taskId) {
        const accountContext = await refreshAutoDriveAccountState({
            force: true,
            schedule: false
        });
        if (!accountContext?.accountKey) return null;
        const task = getAutoTaskById(accountContext.accountKey, taskId);
        if (!task) return null;
        return executeAutoDriveTask(taskId, {
            source: 'manual',
            accountContext
        });
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
                background: var(--cgue-pill-active-bg, var(--cgue-primary));
                border-color: var(--cgue-pill-active-border, var(--cgue-primary));
                color: var(--cgue-pill-active-text, var(--cgue-on-primary));
                box-shadow: var(--cgue-pill-active-shadow, var(--cgue-primary-shadow));
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
            #${BACKUP_DIALOG_ID} .cgue-auto-sync-actions .cgue-btn {
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
                gap: 8px;
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
            .cgue-auto-sync-tip {
                margin: 0;
                position: static;
            }
            .cgue-auto-sync-tip summary {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 22px;
                border-radius: 999px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-card);
                list-style: none;
                cursor: pointer;
                user-select: none;
                font-size: 13px;
                font-weight: 700;
                line-height: 1;
                color: var(--cgue-muted);
                transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
            }
            .cgue-auto-sync-tip summary::-webkit-details-marker {
                display: none;
            }
            .cgue-auto-sync-tip summary:hover {
                color: var(--cgue-text);
                border-color: var(--cgue-primary);
            }
            .cgue-auto-sync-tip summary:focus-visible {
                outline: 2px solid var(--cgue-primary);
                outline-offset: 2px;
            }
            .cgue-auto-sync-tip[open] summary {
                color: var(--cgue-primary);
                border-color: rgba(16, 163, 127, 0.28);
                background: rgba(16, 163, 127, 0.08);
                box-shadow: 0 4px 14px rgba(16, 163, 127, 0.12);
            }
            .cgue-auto-sync-tip-body {
                position: absolute;
                top: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%);
                z-index: 2;
                width: min(320px, calc(100vw - 96px));
                padding: 10px 12px;
                border-radius: 10px;
                border: 1px solid var(--cgue-border);
                background: var(--cgue-surface);
                box-shadow: var(--cgue-shadow);
                font-size: 12px;
                line-height: 1.55;
                color: var(--cgue-muted);
                white-space: normal;
            }
            .cgue-auto-sync-account {
                display: flex;
                align-items: center;
                gap: 8px;
                width: 100%;
                min-height: 40px;
                box-sizing: border-box;
                margin-top: 4px;
                padding: 8px 12px;
                border-radius: 10px;
                background: var(--cgue-hover);
                font-size: 12px;
                color: var(--cgue-muted);
                line-height: 1.45;
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
            .cgue-auto-task-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-top: 14px;
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
            .cgue-auto-task-summary {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 14px;
                user-select: none;
            }
            .cgue-auto-task-summary strong {
                flex: 1;
                font-size: 12.5px;
                font-weight: 600;
                line-height: 1.35;
                color: var(--cgue-text);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                min-width: 0;
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
            .cgue-auto-task-status[data-status="disabled"] {
                background: var(--cgue-hover);
                color: var(--cgue-muted);
                border-color: var(--cgue-border);
            }
            .cgue-auto-task-status[data-status="disabled"] .cgue-auto-task-status-dot {
                background: var(--cgue-muted);
                opacity: 0.5;
            }
            @keyframes cgue-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }
            .cgue-auto-task-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
            .cgue-auto-task-actions .cgue-btn {
                padding: 5px 10px;
                font-size: 11px;
                border-radius: 6px;
            }
            .cgue-auto-task-actions .cgue-btn-danger {
                color: #ef4444;
                border-color: rgba(239, 68, 68, 0.3);
            }
            .cgue-auto-task-actions .cgue-btn-danger:hover {
                background: rgba(239, 68, 68, 0.08);
                border-color: rgba(239, 68, 68, 0.5);
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
                margin-top: 14px;
                padding: 18px;
                border-radius: 12px;
                border: 1px solid var(--cgue-primary);
                background: var(--cgue-surface);
                box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.08);
            }
            .cgue-auto-editor h3 {
                margin: 0 0 16px;
                font-size: 15px;
                font-weight: 700;
            }
            .cgue-auto-editor-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
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
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px 28px;
                align-items: start;
            }
            .cgue-auto-editor-options-column {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .cgue-auto-editor-options .cgue-toggle {
                min-height: 18px;
            }
            .cgue-auto-editor .cgue-drive-actions {
                margin-top: 16px;
            }
            .cgue-auto-editor .cgue-drive-actions .cgue-status {
                flex: 1 1 auto;
            }
            .cgue-auto-editor .cgue-drive-actions .cgue-btn {
                margin-left: 0;
            }
            .cgue-auto-editor .cgue-drive-actions #cgue-auto-task-save {
                margin-left: auto;
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
                .cgue-auto-sync-title-row {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                .cgue-auto-sync-title-main {
                    width: 100%;
                }
                .cgue-auto-sync-tip-body {
                    left: 50%;
                    transform: translateX(-50%);
                    width: min(280px, calc(100vw - 72px));
                }
                .cgue-auto-sync-actions {
                    width: 100%;
                }
                .cgue-auto-task-meta {
                    grid-template-columns: repeat(2, 1fr);
                }
                .cgue-auto-editor-grid {
                    grid-template-columns: minmax(0, 1fr);
                }
                .cgue-auto-editor-options {
                    grid-template-columns: minmax(0, 1fr);
                    gap: 10px;
                }
                .cgue-auto-editor .cgue-drive-actions {
                    align-items: stretch;
                }
                .cgue-auto-editor .cgue-drive-actions #cgue-auto-task-save {
                    margin-left: 0;
                }
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

    const formatAutoDriveTaskDateTime = (value) => {
        const ms = Number(value);
        if (!Number.isFinite(ms) || ms <= 0) return '-';
        return formatDateTime(ms);
    };

    const getAutoDriveTaskScopeLabel = (task) => (
        task?.mode === 'team'
            ? `${t('autoSyncTaskModeTeam')}: ${task?.workspaceId || '-'}`
            : t('autoSyncTaskModePersonal')
    );

    const getAutoDriveTaskStatusLabel = (task) => {
        if ((state.autoDrive.runningTaskIds || []).includes(task?.id)) {
            return t('autoSyncTaskStatusRunning');
        }
        if (task?.enabled === false) {
            return t('autoSyncTaskStatusDisabled');
        }
        if (task?.paused === true) {
            return t('autoSyncTaskStatusPaused');
        }
        return t('autoSyncTaskStatusScheduled');
    };

    const getAutoDriveTaskStatusKey = (task) => {
        if ((state.autoDrive.runningTaskIds || []).includes(task?.id)) return 'running';
        if (task?.enabled === false) return 'disabled';
        if (task?.paused === true) return 'paused';
        return 'scheduled';
    };

    const getAutoDriveTaskToggleLabel = (task) => {
        if (task?.enabled === false) return t('autoSyncEnable');
        if (task?.paused === true) return t('autoSyncResume');
        return t('autoSyncPause');
    };

    const getAvailableAutoDriveWorkspaceIds = (editingTaskId = state.autoDrive.editingId) => {
        const currentEditingId = normalizeStringValue(editingTaskId, false);
        const currentEditingTask = currentEditingId
            ? (state.autoDrive.tasks || []).find((task) => task?.id === currentEditingId) || null
            : null;
        const currentEditingWorkspaceId = currentEditingTask?.mode === 'team'
            ? normalizeStringValue(currentEditingTask.workspaceId, false)
            : '';
        const usedWorkspaceIds = new Set();
        const availableWorkspaceIds = [];
        const seenWorkspaceIds = new Set();
        const pushWorkspaceId = (workspaceId) => {
            const normalizedWorkspaceId = normalizeStringValue(workspaceId, false);
            if (!normalizedWorkspaceId || usedWorkspaceIds.has(normalizedWorkspaceId) || seenWorkspaceIds.has(normalizedWorkspaceId)) {
                return;
            }
            seenWorkspaceIds.add(normalizedWorkspaceId);
            availableWorkspaceIds.push(normalizedWorkspaceId);
        };

        (state.autoDrive.tasks || []).forEach((task) => {
            if (!task || task.mode !== 'team' || task.id === currentEditingId) return;
            const workspaceId = normalizeStringValue(task.workspaceId, false);
            if (workspaceId) {
                usedWorkspaceIds.add(workspaceId);
            }
        });

        if (currentEditingWorkspaceId) {
            pushWorkspaceId(currentEditingWorkspaceId);
        }
        pushWorkspaceId(state.workspaceId);
        detectAllWorkspaceIds().forEach((workspaceId) => {
            pushWorkspaceId(workspaceId);
        });
        return availableWorkspaceIds;
    };

    const getSuggestedAutoDriveWorkspaceId = (editingTaskId = state.autoDrive.editingId) => (
        getAvailableAutoDriveWorkspaceIds(editingTaskId)[0] || ''
    );

    const getAvailableAutoDriveModes = (editingTaskId = state.autoDrive.editingId) => {
        const currentEditingId = normalizeStringValue(editingTaskId, false);
        const personalAvailable = !(state.autoDrive.tasks || []).some((task) => (
            task?.mode === 'personal' && task.id !== currentEditingId
        ));
        const availableWorkspaceIds = getAvailableAutoDriveWorkspaceIds(editingTaskId);
        return {
            personalAvailable,
            teamAvailable: availableWorkspaceIds.length > 0,
            availableWorkspaceIds
        };
    };

    const resolveAutoDriveFormWorkspaceId = (form) => {
        const mode = form?.mode === 'team' ? 'team' : 'personal';
        if (mode !== 'team') return '';
        return normalizeStringValue(form?.workspaceId, false) || getSuggestedAutoDriveWorkspaceId();
    };

    function openAutoDriveTaskEditor(task = null) {
        const availableModes = getAvailableAutoDriveModes(task?.id || '');
        if (!task && !availableModes.personalAvailable && !availableModes.teamAvailable) {
            return;
        }
        const initialTask = task || (
            state.scope === 'team' && availableModes.teamAvailable
                ? { mode: 'team', workspaceId: getSuggestedAutoDriveWorkspaceId('') }
                : (!availableModes.personalAvailable && availableModes.teamAvailable
                    ? { mode: 'team', workspaceId: getSuggestedAutoDriveWorkspaceId('') }
                    : {})
        );
        state.autoDrive.editorOpen = true;
        state.autoDrive.editingId = task?.id || '';
        state.autoDrive.form = createDefaultAutoTaskForm(initialTask);
        state.autoDrive._skipFormRead = true;
        refreshAutoDriveUi();
    }

    function closeAutoDriveTaskEditor() {
        state.autoDrive.editorOpen = false;
        state.autoDrive.editingId = '';
        state.autoDrive.form = createDefaultAutoTaskForm();
        refreshAutoDriveUi();
    }

    const isAutoDriveTaskExpanded = (taskId) => (
        normalizeStringValue(taskId, false) !== '' &&
        (state.autoDrive.expandedTaskIds || []).includes(normalizeStringValue(taskId, false))
    );

    const setAutoDriveTaskExpanded = (taskId, expanded) => {
        const normalizedTaskId = normalizeStringValue(taskId, false);
        if (!normalizedTaskId) return;
        const nextExpandedTaskIds = new Set(state.autoDrive.expandedTaskIds || []);
        if (expanded) {
            nextExpandedTaskIds.add(normalizedTaskId);
        } else {
            nextExpandedTaskIds.delete(normalizedTaskId);
        }
        state.autoDrive.expandedTaskIds = Array.from(nextExpandedTaskIds);
    };

    function renderAutoDriveTaskItem(task) {
        if (!task) return '';
        const taskId = escapeHtml(task.id);
        const label = escapeHtml(getAutoDriveTaskLabel(task));
        const expanded = isAutoDriveTaskExpanded(task.id);
        const statusKey = getAutoDriveTaskStatusKey(task);
        const statusText = escapeHtml(getAutoDriveTaskStatusLabel(task));
        const scope = escapeHtml(getAutoDriveTaskScopeLabel(task));
        const rootLabel = escapeHtml(getRootExportLabel(task.includeRootActive, task.includeRootArchived));
        const nextRun = escapeHtml(formatAutoDriveTaskDateTime(getAutoDriveTaskScheduledNextRunAt(task)));
        const lastSuccess = escapeHtml(formatAutoDriveTaskDateTime(task.lastSuccessAt));
        const lastError = normalizeStringValue(task.lastError, false);
        const expandLabel = expanded ? t('autoSyncTaskCollapse') : t('autoSyncTaskExpand');
        const lastErrorMeta = lastError
            ? `<div class="cgue-auto-task-meta-item"><span class="cgue-auto-task-meta-label">${escapeHtml(t('autoSyncTaskLastError'))}</span><span class="cgue-auto-task-meta-value">${escapeHtml(lastError)}</span></div>`
            : '';
        const intervalMinutes = Math.max(
            AUTO_DRIVE_MIN_INTERVAL_MINUTES,
            Math.floor(Number(task.intervalMinutes) || AUTO_DRIVE_DEFAULT_INTERVAL_MINUTES)
        );
        return `
            <article class="cgue-auto-task" data-task-id="${taskId}" data-expanded="${expanded ? 'true' : 'false'}">
                <div class="cgue-auto-task-summary">
                    <strong title="${label}">${label}</strong>
                    <span class="cgue-auto-task-status" data-status="${statusKey}"><span class="cgue-auto-task-status-dot"></span>${statusText}</span>
                    <button class="cgue-auto-task-expand" type="button" data-auto-drive-action="toggle-expand" data-task-id="${taskId}" aria-expanded="${expanded ? 'true' : 'false'}" aria-label="${escapeHtml(expandLabel)}" title="${escapeHtml(expandLabel)}">
                        <span class="cgue-auto-task-caret">▼</span>
                    </button>
                </div>
                <div class="cgue-auto-task-body">
                    <div class="cgue-auto-task-actions">
                        <button class="cgue-btn cgue-btn-ghost" type="button" data-auto-drive-action="run" data-task-id="${taskId}">${t('autoSyncRunNow')}</button>
                        <button class="cgue-btn cgue-btn-ghost" type="button" data-auto-drive-action="edit" data-task-id="${taskId}">${t('autoSyncEditTask')}</button>
                        <button class="cgue-btn cgue-btn-ghost" type="button" data-auto-drive-action="toggle" data-task-id="${taskId}">${getAutoDriveTaskToggleLabel(task)}</button>
                        <button class="cgue-btn cgue-btn-ghost cgue-btn-danger" type="button" data-auto-drive-action="delete" data-task-id="${taskId}">${t('autoSyncDeleteTask')}</button>
                    </div>
                    <div class="cgue-auto-task-meta">
                        <div class="cgue-auto-task-meta-item"><span class="cgue-auto-task-meta-label">${escapeHtml(t('autoSyncTaskMode'))}</span><span class="cgue-auto-task-meta-value">${scope}</span></div>
                        <div class="cgue-auto-task-meta-item"><span class="cgue-auto-task-meta-label">${escapeHtml(t('autoSyncTaskInterval'))}</span><span class="cgue-auto-task-meta-value">${escapeHtml(String(intervalMinutes))}</span></div>
                        <div class="cgue-auto-task-meta-item"><span class="cgue-auto-task-meta-label">${escapeHtml(t('autoSyncTaskRoots'))}</span><span class="cgue-auto-task-meta-value">${rootLabel}</span></div>
                        <div class="cgue-auto-task-meta-item"><span class="cgue-auto-task-meta-label">${escapeHtml(t('autoSyncTaskLastSuccess'))}</span><span class="cgue-auto-task-meta-value">${lastSuccess}</span></div>
                        <div class="cgue-auto-task-meta-item"><span class="cgue-auto-task-meta-label">${escapeHtml(t('autoSyncTaskNextRun'))}</span><span class="cgue-auto-task-meta-value">${nextRun}</span></div>
                        ${lastErrorMeta}
                    </div>
                </div>
            </article>
        `;
    }

    function renderAutoDriveTaskEditor() {
        if (state.autoDrive.editorOpen !== true) return '';
        const availableModes = getAvailableAutoDriveModes(state.autoDrive.editingId);
        if (!availableModes.personalAvailable && !availableModes.teamAvailable) {
            return '';
        }
        const form = createDefaultAutoTaskForm(state.autoDrive.form || {});
        let mode = form.mode === 'team' ? 'team' : 'personal';
        if (mode === 'team' && !availableModes.teamAvailable && availableModes.personalAvailable) {
            mode = 'personal';
        } else if (mode === 'personal' && !availableModes.personalAvailable && availableModes.teamAvailable) {
            mode = 'team';
        }
        const isTeam = mode === 'team';
        const accountReady = state.autoDrive.accountStatus === 'ready' && !!state.autoDrive.accountKey;
        const heading = state.autoDrive.editingId ? t('autoSyncEditTask') : t('autoSyncCreateTask');
        const availableWorkspaceIds = availableModes.availableWorkspaceIds;
        const resolvedWorkspaceId = isTeam
            ? (normalizeStringValue(form.workspaceId, false) || getSuggestedAutoDriveWorkspaceId(state.autoDrive.editingId))
            : '';
        const showModeSelector = Number(availableModes.personalAvailable) + Number(availableModes.teamAvailable) > 1;
        const scopePreview = isTeam
            ? `${t('autoSyncTaskWorkspace')}: ${resolvedWorkspaceId || '-'}`
            : t('autoSyncTaskModePersonal');
        const statusText = accountReady
            ? scopePreview
            : `${scopePreview} · ${state.autoDrive.accountError || t('autoSyncAccountMissing')}`;
        const workspaceListId = 'cgue-auto-task-workspace-options';
        const workspaceOptions = availableWorkspaceIds.length > 0
            ? `
                <datalist id="${workspaceListId}">
                    ${availableWorkspaceIds.map((workspaceId) => (
                        `<option value="${escapeHtml(workspaceId)}"></option>`
                    )).join('')}
                </datalist>
            `
            : '';
        return `
            <div class="cgue-auto-editor">
                <h3>${heading}</h3>
                <div class="cgue-auto-editor-grid">
                    ${showModeSelector ? `
                        <label>
                            <span class="cgue-field-label">${t('autoSyncTaskMode')}</span>
                            <select id="cgue-auto-task-mode" class="cgue-input">
                                ${availableModes.personalAvailable ? `<option value="personal" ${!isTeam ? 'selected' : ''}>${t('autoSyncTaskModePersonal')}</option>` : ''}
                                ${availableModes.teamAvailable ? `<option value="team" ${isTeam ? 'selected' : ''}>${t('autoSyncTaskModeTeam')}</option>` : ''}
                            </select>
                        </label>
                    ` : `<input id="cgue-auto-task-mode" type="hidden" value="${escapeHtml(mode)}">`}
                    ${isTeam ? `
                        <label>
                            <span class="cgue-field-label">${t('autoSyncTaskWorkspace')}</span>
                            <input id="cgue-auto-task-workspace" class="cgue-input" type="text" autocomplete="off" spellcheck="false" value="${escapeHtml(resolvedWorkspaceId || '')}" placeholder="${escapeHtml(t('workspaceManualPlaceholder'))}" ${availableWorkspaceIds.length > 0 ? `list="${workspaceListId}"` : ''}>
                            ${workspaceOptions}
                        </label>
                    ` : ''}
                    <label>
                        <span class="cgue-field-label">${t('autoSyncTaskLabel')}</span>
                        <input id="cgue-auto-task-label" class="cgue-input" type="text" autocomplete="off" spellcheck="false" placeholder="${t('autoSyncTaskLabelPlaceholder')}" value="${escapeHtml(form.label || '')}">
                    </label>
                    <label>
                        <span class="cgue-field-label">${t('autoSyncTaskInterval')}</span>
                        <input id="cgue-auto-task-interval" class="cgue-input" type="number" min="${AUTO_DRIVE_MIN_INTERVAL_MINUTES}" step="1" value="${escapeHtml(String(form.intervalMinutes))}">
                    </label>
                </div>
                <div class="cgue-auto-editor-options">
                    <div class="cgue-auto-editor-options-column">
                        <label class="cgue-toggle">
                            <input id="cgue-auto-task-root-active" type="checkbox" ${form.includeRootActive ? 'checked' : ''}>
                            <span class="cgue-toggle-track"></span>
                            <span class="cgue-toggle-label">${t('rootActiveShort')}</span>
                        </label>
                        <label class="cgue-toggle">
                            <input id="cgue-auto-task-root-archived" type="checkbox" ${form.includeRootArchived ? 'checked' : ''}>
                            <span class="cgue-toggle-track"></span>
                            <span class="cgue-toggle-label">${t('rootArchivedShort')}</span>
                        </label>
                    </div>
                    <div class="cgue-auto-editor-options-column">
                        <label class="cgue-toggle">
                            <input id="cgue-auto-task-enabled" type="checkbox" ${form.enabled ? 'checked' : ''}>
                            <span class="cgue-toggle-track"></span>
                            <span class="cgue-toggle-label">${t('autoSyncTaskEnabled')}</span>
                        </label>
                        <label class="cgue-toggle">
                            <input id="cgue-auto-task-run-on-startup" type="checkbox" ${form.runOnStartup ? 'checked' : ''}>
                            <span class="cgue-toggle-track"></span>
                            <span class="cgue-toggle-label">${t('autoSyncRunOnStartup')}</span>
                        </label>
                    </div>
                </div>
                <div class="cgue-drive-actions">
                    <span id="cgue-auto-task-status" class="cgue-status">${escapeHtml(statusText)}</span>
                    <button id="cgue-auto-task-cancel" class="cgue-btn cgue-btn-ghost" type="button">${t('autoSyncCancelEdit')}</button>
                    <button id="cgue-auto-task-save" class="cgue-btn cgue-primary" type="button" ${accountReady ? '' : 'disabled'}>${t('autoSyncSaveTask')}</button>
                </div>
            </div>
        `;
    }

    function renderAutoDriveSection() {
        const accountReady = state.autoDrive.accountStatus === 'ready' && !!state.autoDrive.accountKey;
        const accountLoading = state.autoDrive.accountStatus === 'loading';
        const driveEnabled = state.backupTargets.drive === true;
        const availableModes = getAvailableAutoDriveModes('');
        const canAddTask = availableModes.personalAvailable || availableModes.teamAvailable;
        const accountText = accountLoading
            ? t('autoSyncAccountLoading')
            : accountReady
                ? t('autoSyncCurrentAccount', state.autoDrive.accountLabel || state.autoDrive.accountHash || state.autoDrive.accountKey)
                : (state.autoDrive.accountError || t('autoSyncAccountMissing'));
        const dotClass = accountReady ? '' : ' offline';
        const tasks = sortAutoDriveTasks(state.autoDrive.tasks || []);
        const taskList = tasks.length > 0
            ? tasks.map((task) => renderAutoDriveTaskItem(task)).join('')
            : `<div class="cgue-auto-sync-empty">${t('autoSyncNoTasks')}</div>`;
        return `
            <section id="cgue-auto-drive-section" class="cgue-backup cgue-auto-sync" data-visible="${driveEnabled ? 'true' : 'false'}">
                <div class="cgue-auto-sync-header">
                    <div class="cgue-auto-sync-title-row">
                        <div class="cgue-auto-sync-title-main">
                            <h3>${t('autoSyncTitle')}</h3>
                            <details class="cgue-auto-sync-tip">
                                <summary aria-label="${escapeHtml(t('autoSyncDescSummary'))}">?</summary>
                                <div class="cgue-auto-sync-tip-body">${escapeHtml(t('autoSyncDesc'))}</div>
                            </details>
                        </div>
                        <div class="cgue-auto-sync-actions">
                            <button id="cgue-auto-drive-refresh" class="cgue-btn cgue-btn-ghost" type="button">${t('autoSyncRefreshAccount')}</button>
                            ${canAddTask ? `<button id="cgue-auto-drive-add-task" class="cgue-btn cgue-btn-ghost" type="button">${t('autoSyncAddTask')}</button>` : ''}
                        </div>
                    </div>
                    <div class="cgue-auto-sync-account"><span class="cgue-auto-sync-account-dot${dotClass}"></span>${escapeHtml(accountText)}</div>
                </div>
                <div class="cgue-auto-task-list">
                    ${taskList}
                </div>
                ${renderAutoDriveTaskEditor()}
            </section>
        `;
    }

    function renderBackupSection() {
        const localEnabled = state.backupTargets.local !== false;
        const driveEnabled = state.backupTargets.drive === true;
        const driveOpen = state.driveSettingsExpanded === true;
        const driveToggleLabel = driveOpen ? t('driveSettingsCollapse') : t('driveSettingsExpand');
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
                    <article class="cgue-auto-task cgue-drive-card" data-expanded="${driveOpen ? 'true' : 'false'}">
                        <div class="cgue-auto-task-summary">
                            <strong>${t('driveSettingsToggle')}</strong>
                            <button id="cgue-drive-settings-toggle" class="cgue-auto-task-expand" type="button" aria-expanded="${driveOpen ? 'true' : 'false'}" aria-label="${escapeHtml(driveToggleLabel)}" title="${escapeHtml(driveToggleLabel)}">
                                <span class="cgue-auto-task-caret" id="cgue-drive-settings-caret">▼</span>
                            </button>
                        </div>
                        <div class="cgue-auto-task-body" id="cgue-drive-settings">
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
                    </article>
                </div>
            </section>
            ${renderAutoDriveSection()}
        `;
    }

    function readAutoDriveTaskFormFromSection(section) {
        if (!section) {
            const fallbackForm = createDefaultAutoTaskForm(state.autoDrive.form || {});
            if (fallbackForm.mode === 'team' && !fallbackForm.workspaceId) {
                fallbackForm.workspaceId = resolveAutoDriveFormWorkspaceId(fallbackForm);
            }
            return fallbackForm;
        }
        const form = createDefaultAutoTaskForm({
            mode: section.querySelector('#cgue-auto-task-mode')?.value || state.autoDrive.form?.mode,
            workspaceId: section.querySelector('#cgue-auto-task-workspace')?.value || '',
            label: section.querySelector('#cgue-auto-task-label')?.value || '',
            intervalMinutes: section.querySelector('#cgue-auto-task-interval')?.value || AUTO_DRIVE_DEFAULT_INTERVAL_MINUTES,
            includeRootActive: section.querySelector('#cgue-auto-task-root-active')?.checked !== false,
            includeRootArchived: section.querySelector('#cgue-auto-task-root-archived')?.checked !== false,
            enabled: section.querySelector('#cgue-auto-task-enabled')?.checked !== false,
            runOnStartup: section.querySelector('#cgue-auto-task-run-on-startup')?.checked !== false
        });
        if (form.mode === 'team' && !form.workspaceId) {
            form.workspaceId = resolveAutoDriveFormWorkspaceId(form);
        }
        return form;
    }

    function saveAutoDriveTaskFromDialog(dialog) {
        const section = dialog.querySelector('#cgue-auto-drive-section');
        if (!section) return null;
        const accountKey = state.autoDrive.accountKey;
        if (!accountKey) {
            notify('warning', t('autoSyncAccountRequired'));
            return null;
        }

        const form = readAutoDriveTaskFormFromSection(section);
        state.autoDrive.form = form;
        if (form.mode === 'team' && !form.workspaceId) {
            notify('warning', t('autoSyncWorkspaceRequired'));
            return null;
        }
        if (form.intervalMinutes < AUTO_DRIVE_MIN_INTERVAL_MINUTES) {
            notify('warning', t('autoSyncIntervalInvalid', AUTO_DRIVE_MIN_INTERVAL_MINUTES));
            return null;
        }

        const now = Date.now();
        const previousTask = state.autoDrive.editingId
            ? getAutoTaskById(accountKey, state.autoDrive.editingId)
            : null;
        const targetId = buildAutoDriveTaskId(form.mode, form.workspaceId);
        const targetTask = getAutoTaskById(accountKey, targetId);
        if (targetTask && targetTask.id !== previousTask?.id) {
            notify('warning', t('autoSyncTaskExists'));
            return null;
        }
        const baseTask = targetTask || previousTask || {};
        const preservedNextRunAt = getAutoDriveTaskScheduledNextRunAt(baseTask);
        const previousTaskExpanded = previousTask?.id ? isAutoDriveTaskExpanded(previousTask.id) : false;
        const nextTask = normalizeAutoDriveTask({
            ...baseTask,
            ...form,
            paused: form.enabled !== false ? baseTask.paused === true : false,
            nextRunAt: form.enabled !== false
                ? (preservedNextRunAt != null
                    ? preservedNextRunAt
                    : (form.runOnStartup && !baseTask.lastRunAt
                        ? now
                        : now + getAutoDriveIntervalMs(form)))
                : null,
            createdAt: baseTask.createdAt || now,
            lastRunAt: baseTask.lastRunAt || null,
            lastSuccessAt: baseTask.lastSuccessAt || null,
            lastError: baseTask.lastError || '',
            consecutiveFailures: baseTask.consecutiveFailures || 0
        });

        if (previousTask?.id && previousTask.id !== nextTask.id) {
            deleteAutoDriveTask(accountKey, previousTask.id);
            setAutoDriveTaskExpanded(previousTask.id, false);
            if (previousTaskExpanded) {
                setAutoDriveTaskExpanded(nextTask.id, true);
            }
        }
        saveSingleAutoDriveTask(accountKey, nextTask);
        state.autoDrive.tasks = primeAutoDriveTaskSchedules(accountKey, loadAutoDriveTasks(accountKey));
        state.autoDrive.editorOpen = false;
        state.autoDrive.editingId = '';
        state.autoDrive.form = createDefaultAutoTaskForm();
        notify('success', t('autoSyncTaskSaved'));
        refreshAutoDriveUi();
        scheduleAutoDriveEvaluation('task-save', 0);
        return nextTask;
    }

    function bindAutoDriveControls(dialog) {
        const section = dialog.querySelector('#cgue-auto-drive-section');
        if (!section) return;

        dialog.__refreshAutoDriveSection = () => {
            const current = dialog.querySelector('#cgue-auto-drive-section');
            if (!current) return;
            if (state.autoDrive.editorOpen === true && !state.autoDrive._skipFormRead) {
                const editorPresent = current.querySelector('#cgue-auto-task-mode');
                if (editorPresent) {
                    state.autoDrive.form = readAutoDriveTaskFormFromSection(current);
                }
            }
            state.autoDrive._skipFormRead = false;
            current.outerHTML = renderAutoDriveSection();
            bindAutoDriveControls(dialog);
        };

        if (dialog.dataset.autoDriveBootstrapped !== 'true') {
            dialog.dataset.autoDriveBootstrapped = 'true';
            if (state.autoDrive.accountStatus !== 'ready') {
                state.autoDrive.accountStatus = 'loading';
                refreshAutoDriveUi();
            }
            void refreshAutoDriveAccountState({
                force: true,
                schedule: false
            });
        }

        const refreshBtn = section.querySelector('#cgue-auto-drive-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                state.autoDrive.accountStatus = 'loading';
                state.autoDrive.accountError = '';
                refreshAutoDriveUi();
                void refreshAutoDriveAccountState({
                    force: true,
                    schedule: true
                });
            });
        }

        const addBtn = section.querySelector('#cgue-auto-drive-add-task');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                openAutoDriveTaskEditor();
            });
        }

        const modeInput = section.querySelector('#cgue-auto-task-mode');
        if (modeInput) {
            modeInput.addEventListener('change', () => {
                const nextForm = readAutoDriveTaskFormFromSection(section);
                if (nextForm.mode === 'team' && !nextForm.workspaceId) {
                    nextForm.workspaceId = resolveAutoDriveFormWorkspaceId(nextForm);
                }
                state.autoDrive.form = createDefaultAutoTaskForm(nextForm);
                refreshAutoDriveUi();
            });
        }

        const workspaceInput = section.querySelector('#cgue-auto-task-workspace');
        if (workspaceInput instanceof HTMLInputElement) {
            const form = createDefaultAutoTaskForm(state.autoDrive.form || {});
            const resolvedWorkspaceId = resolveAutoDriveFormWorkspaceId(form);
            if (form.mode === 'team' && resolvedWorkspaceId && workspaceInput.value !== resolvedWorkspaceId) {
                workspaceInput.value = resolvedWorkspaceId;
                state.autoDrive.form = createDefaultAutoTaskForm({
                    ...form,
                    workspaceId: resolvedWorkspaceId
                });
            }
        }

        [
            '#cgue-auto-task-workspace',
            '#cgue-auto-task-label',
            '#cgue-auto-task-interval',
            '#cgue-auto-task-root-active',
            '#cgue-auto-task-root-archived',
            '#cgue-auto-task-enabled',
            '#cgue-auto-task-run-on-startup'
        ].forEach((selector) => {
            const input = section.querySelector(selector);
            if (!input) return;
            const eventName = input instanceof HTMLInputElement && input.type === 'text'
                ? 'input'
                : 'change';
            input.addEventListener(eventName, () => {
                state.autoDrive.form = readAutoDriveTaskFormFromSection(section);
            });
        });

        const cancelBtn = section.querySelector('#cgue-auto-task-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                closeAutoDriveTaskEditor();
            });
        }

        const saveBtn = section.querySelector('#cgue-auto-task-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                saveAutoDriveTaskFromDialog(dialog);
            });
        }

        section.querySelectorAll('[data-auto-drive-action]').forEach((button) => {
            button.addEventListener('click', async () => {
                const action = button.getAttribute('data-auto-drive-action') || '';
                const taskId = button.getAttribute('data-task-id') || '';
                const accountKey = state.autoDrive.accountKey;
                if (!accountKey || !taskId) return;
                const task = getAutoTaskById(accountKey, taskId);
                if (!task) return;

                if (action === 'toggle-expand') {
                    setAutoDriveTaskExpanded(taskId, !isAutoDriveTaskExpanded(taskId));
                    refreshAutoDriveUi();
                    return;
                }

                if (action === 'edit') {
                    openAutoDriveTaskEditor(task);
                    return;
                }

                if (action === 'delete') {
                    const confirmed = window.confirm(t('autoSyncDeleteConfirm', getAutoDriveTaskLabel(task)));
                    if (!confirmed) return;
                    deleteAutoDriveTask(accountKey, taskId);
                    setAutoDriveTaskExpanded(taskId, false);
                    if (state.autoDrive.editingId === taskId) {
                        closeAutoDriveTaskEditor();
                    } else {
                        state.autoDrive.tasks = primeAutoDriveTaskSchedules(accountKey, loadAutoDriveTasks(accountKey));
                        refreshAutoDriveUi();
                    }
                    notify('success', t('autoSyncTaskDeleted'));
                    scheduleAutoDriveEvaluation('task-delete', 0);
                    return;
                }

                if (action === 'toggle') {
                    const now = Date.now();
                    if (task.enabled === false) {
                        updateAutoDriveTaskState(accountKey, taskId, {
                            enabled: true,
                            paused: false,
                            pausedNextRunAt: null,
                            nextRunAt: now
                        });
                    } else if (task.paused === true) {
                        updateAutoDriveTaskState(accountKey, taskId, {
                            paused: false,
                            pausedNextRunAt: null,
                            nextRunAt: resolveAutoDriveResumeNextRunAt(task, now)
                        });
                    } else {
                        updateAutoDriveTaskState(accountKey, taskId, {
                            paused: true,
                            pausedNextRunAt: getAutoDriveTaskScheduledNextRunAt(task),
                            nextRunAt: null
                        });
                    }
                    state.autoDrive.tasks = primeAutoDriveTaskSchedules(accountKey, loadAutoDriveTasks(accountKey));
                    refreshAutoDriveUi();
                    scheduleAutoDriveEvaluation('task-toggle', 0);
                    return;
                }

                if (action === 'run') {
                    await runAutoDriveTaskNow(taskId);
                    scheduleAutoDriveEvaluation('task-run', 0);
                }
            });
        });
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
        const driveCard = dialog.querySelector('.cgue-drive-card');
        const settingsToggle = dialog.querySelector('#cgue-drive-settings-toggle');
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

        const syncDriveSettingsExpandedUi = (expanded) => {
            const nextExpanded = expanded === true;
            state.driveSettingsExpanded = nextExpanded;
            if (driveCard) {
                driveCard.dataset.expanded = nextExpanded ? 'true' : 'false';
            }
            if (settingsToggle) {
                const label = nextExpanded ? t('driveSettingsCollapse') : t('driveSettingsExpand');
                settingsToggle.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
                settingsToggle.setAttribute('aria-label', label);
                settingsToggle.setAttribute('title', label);
            }
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
            const autoDriveSection = dialog.querySelector('#cgue-auto-drive-section');
            if (autoDriveSection) {
                autoDriveSection.dataset.visible = useDrive ? 'true' : 'false';
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

        if (settingsToggle && driveCard) {
            settingsToggle.addEventListener('click', () => {
                syncDriveSettingsExpandedUi(!state.driveSettingsExpanded);
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

        syncDriveSettingsExpandedUi(state.driveSettingsExpanded === true);

        if (state.backupTargets.drive && driveCard && !hasDriveCredentials(readDriveForm())) {
            setDriveStatus('error', t('driveMissingConfig'));
        }

        if (settingsWrap && driveToggle) {
            settingsWrap.dataset.visible = driveToggle.checked ? 'true' : 'false';
        }

        bindAutoDriveControls(dialog);
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
                const number = document.createElement('span');
                number.className = 'cgue-workspace-number';
                number.textContent = `#${index + 1}`;
                const labelText = document.createElement('span');
                labelText.className = 'cgue-workspace-label';
                labelText.textContent = 'ID：';
                marker.appendChild(number);
                marker.appendChild(labelText);
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
            const number = document.createElement('span');
            number.className = 'cgue-workspace-number';
            number.textContent = '#1';
            const labelText = document.createElement('span');
            labelText.className = 'cgue-workspace-label';
            labelText.textContent = 'ID：';
            marker.appendChild(number);
            marker.appendChild(labelText);
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
                notify('warning', t('alertNoWorkspace'));
                return;
            }
            setScope('team', workspaceId);
            renderModeStep(dialog);
        };
    }

    function renderModeStep(dialog) {
        const scopeLabel = state.scope === 'team' && state.workspaceId
            ? `<div class="cgue-callout info cgue-scope-summary"><strong>${t('teamTitle')}:</strong><code>${state.workspaceId}</code></div>`
            : '';
        const exportTargetLabel = getExportTargetLabel();
        const exportAllLabel = t('exportAll', exportTargetLabel);

        dialog.innerHTML = `
            <h2>${t('exportModeTitle')}</h2>
            <p>${t('exportModeDesc')}</p>
            ${scopeLabel}
            <div class="cgue-card-list">
                <div id="cgue-export-all" class="cgue-card-btn cgue-card-row" role="button" tabindex="0">
                    <div class="cgue-card-content">
                        <strong>${exportAllLabel}</strong>
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
                notify('warning', t('alertSaveCancelled'));
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
        const exportTargetLabel = getExportTargetLabel();
        const exportSelectedLabel = t('exportSelected', exportTargetLabel);

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
                <button id="cgue-export-selected" class="cgue-btn cgue-primary" disabled>${exportSelectedLabel}</button>
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
                notify('warning', t('alertNoSelection'));
                return;
            }
            const backupTargets = resolveBackupTargets();
            if (!backupTargets) return;
            const saveHandle = backupTargets.local ? await prepareSaveHandle(state.scope, state.workspaceId) : null;
            if (backupTargets.local && saveHandle === 'cancelled') {
                notify('warning', t('alertSaveCancelled'));
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
        syncToastAnchor();
    }

    function releaseAutoDriveResourcesOnUnload() {
        removeAutoDriveValueListeners();
        stopAccountExecutionLockHeartbeat();
        if (autoDriveHeldLockKey) {
            releaseLeaseRecord(autoDriveHeldLockKey);
            autoDriveHeldLockKey = '';
        }
        stopAutoDriveAutomation({ releaseLeader: true });
    }

    function init() {
        addStyles();
        addExportButton();
        if (!document.body) return;
        void refreshAutoDriveAccountState({
            force: true,
            schedule: true
        });
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                void refreshAutoDriveAccountState({
                    force: false,
                    schedule: true
                });
            }
        });
        window.addEventListener('focus', () => {
            void refreshAutoDriveAccountState({
                force: false,
                schedule: true
            });
        });
        window.addEventListener('online', () => {
            void refreshAutoDriveAccountState({
                force: true,
                schedule: true
            });
        });
        window.addEventListener('beforeunload', releaseAutoDriveResourcesOnUnload, { once: true });
        window.addEventListener('pagehide', releaseAutoDriveResourcesOnUnload, { once: true });
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
