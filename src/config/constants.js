export const BASE_DELAY = 600;
export const JITTER = 400;
export const PAGE_LIMIT = 100;
export const EXPORT_BUTTON_ID = 'cgue-export-btn';
export const OVERLAY_ID = 'cgue-export-overlay';
export const DIALOG_ID = 'cgue-export-dialog';
export const STYLE_ID = 'cgue-export-style';
export const ICON_LABEL = '📥';
export const DRIVE_SETTINGS_KEY = 'cgue-drive-settings';
export const BACKUP_TARGETS_KEY = 'cgue-backup-targets';
export const EXPORT_OPTIONS_KEY = 'cgue-export-options';
export const INCREMENTAL_META_STORAGE_PREFIX = 'cgue_update_map_';
export const DRIVE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
export const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
export const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
export const DRIVE_ROOT_FOLDER_NAME = 'ChatGPT Universal Exporter Plus';
export const DRIVE_CONVERSATION_ID_KEY = 'cgue_conversation_id';
export const FILENAME_SEPARATOR = '｜';
export const DRIVE_FILENAME_PLACEHOLDER = '{{workspace}} {{date}} {{time}}.zip';
export const BACKUP_OVERLAY_ID = 'cgue-backup-overlay';
export const BACKUP_DIALOG_ID = 'cgue-backup-dialog';
export const BACKUP_STEP_CLASS = 'cgue-backup-shell';
export const BACKUP_BUTTON_ID = 'cgue-backup-settings-btn';
export const BACKUP_ICON_DRIVE = '☁️';
export const BACKUP_ICON_LOCAL = '💾';
export const AUTO_SYNC_PAGE_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
            <desc>Fastforward Clock Streamline Icon: https://streamlinehq.com</desc>
            <g id="fastforward-clock--time-clock-reset-stopwatch-circle-measure-loading">
                <path
                    id="Vector"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M7 3.5v4l2.6 1.3"
                    stroke-width="1"
                />
                <path
                    id="Ellipse 1115"
                    stroke="currentColor"
                    stroke-linecap="round"
                    d="M13.3261 8.5c-0.6772 2.8667 -3.2525 5 -6.3261 5C3.41015 13.5 0.5 10.5899 0.5 7 0.5 3.41015 3.41015 0.5 7 0.5c2.50772 0 4.6838 1.42011 5.7678 3.5"
                    stroke-width="1"
                />
                <path
                    id="Vector_2"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.5 2v2.5H11"
                    stroke-width="1"
                />
            </g>
        </svg>
    `;
export const AUTO_DRIVE_PAUSE_ICON = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M14 9V15M10 9V15M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
export const AUTO_DRIVE_RESUME_ICON = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            <path
                d="M10 15V9L15 12L10 15Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
export const AUTO_DRIVE_REFRESH_ICON = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M4.06189 13C4.02104 12.6724 4 12.3387 4 12C4 7.58172 7.58172 4 12 4C14.5006 4 16.7332 5.14727 18.2002 6.94416M19.9381 11C19.979 11.3276 20 11.6613 20 12C20 16.4183 16.4183 20 12 20C9.61061 20 7.46589 18.9525 6 17.2916M9 17H6V17.2916M18.2002 4V6.94416M18.2002 6.94416V6.99993L15.2002 7M6 20V17.2916"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
export const AUTO_DRIVE_RUN_NOW_ICON = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                stroke-width="2"
                stroke-miterlimit="10"
            />
            <path
                d="M6.27 9.14V14.86L11.04 12L6.27 9.14Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
            />
            <path
                d="M12 9.14V14.86L16.77 12L12 9.14Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
            />
            <path
                d="M17.73 7.23V16.77"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
            />
        </svg>
    `;
export const AUTO_DRIVE_EDIT_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M11.331 3.568a3.61 3.61 0 0 1 4.973.128l.128.135a3.61 3.61 0 0 1 0 4.838l-.128.135-6.292 6.29c-.324.324-.558.561-.79.752l-.235.177q-.309.21-.65.36l-.23.093c-.181.066-.369.114-.585.159l-.765.135-2.394.399c-.142.024-.294.05-.422.06-.1.007-.233.01-.378-.026l-.149-.049a1.1 1.1 0 0 1-.522-.474l-.046-.094a1.1 1.1 0 0 1-.074-.526c.01-.129.035-.28.06-.423l.398-2.394.134-.764a4 4 0 0 1 .16-.586l.093-.23q.15-.342.36-.65l.176-.235c.19-.232.429-.466.752-.79l6.291-6.292zm-5.485 7.36c-.35.35-.533.535-.66.688l-.11.147a2.7 2.7 0 0 0-.24.433l-.062.155c-.04.11-.072.225-.106.394l-.127.717-.398 2.393-.001.002h.003l2.393-.399.717-.126c.169-.034.284-.065.395-.105l.153-.062q.228-.1.433-.241l.148-.11c.153-.126.338-.31.687-.66l4.988-4.988-3.226-3.226zm9.517-6.291a2.28 2.28 0 0 0-3.053-.157l-.173.157-.364.363L15 8.226l.363-.363.157-.174a2.28 2.28 0 0 0 0-2.878z"
                fill="currentColor"
            />
        </svg>
    `;
export const AUTO_DRIVE_ADD_TASK_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M2.669 11.333V8.667c0-.922 0-1.655.048-2.244.048-.597.15-1.106.387-1.571l.155-.276a4 4 0 0 1 1.593-1.472l.177-.083c.418-.179.872-.263 1.395-.305.589-.048 1.32-.048 2.243-.048h.5a.665.665 0 0 1 0 1.33h-.5c-.944 0-1.613 0-2.135.043-.386.032-.66.085-.876.162l-.2.086a2.67 2.67 0 0 0-1.064.982l-.102.184c-.126.247-.206.562-.248 1.076-.043.523-.043 1.192-.043 2.136v2.666c0 .944 0 1.613.043 2.136.042.514.122.829.248 1.076l.102.184c.257.418.624.758 1.064.982l.2.086c.217.077.49.13.876.161.522.043 1.19.044 2.135.044h2.667c.944 0 1.612-.001 2.135-.044.514-.042.829-.121 1.076-.247l.184-.104c.418-.256.759-.623.983-1.062l.086-.2c.077-.217.13-.49.16-.876.043-.523.044-1.192.044-2.136v-.5a.665.665 0 0 1 1.33 0v.5c0 .922.001 1.655-.047 2.244-.043.522-.127.977-.306 1.395l-.083.176a4 4 0 0 1-1.471 1.593l-.276.154c-.466.238-.975.34-1.572.39-.59.047-1.321.047-2.243.047H8.667c-.923 0-1.654 0-2.243-.048-.523-.043-.977-.126-1.395-.305l-.177-.084a4 4 0 0 1-1.593-1.471l-.155-.276c-.237-.465-.339-.974-.387-1.57-.049-.59-.048-1.322-.048-2.245m10.796-8.22a2.43 2.43 0 0 1 3.255.167l.167.185c.727.892.727 2.18 0 3.071l-.168.185-5.046 5.048a4 4 0 0 1-1.945 1.072l-.317.058-1.817.26a.665.665 0 0 1-.752-.753l.26-1.816.058-.319a4 4 0 0 1 1.072-1.944L13.28 3.28zm2.314 1.108a1.103 1.103 0 0 0-1.476-.076l-.084.076-5.046 5.048a2.67 2.67 0 0 0-.716 1.296l-.04.212-.134.939.94-.134.211-.039a2.67 2.67 0 0 0 1.298-.716L15.78 5.78l.076-.084c.33-.404.33-.988 0-1.392z"
                fill="currentColor"
            />
        </svg>
    `;
export const AUTO_DRIVE_DELETE_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M10.63 1.335c1.403 0 2.64.925 3.036 2.271l.215.729H17l.134.014a.665.665 0 0 1 0 1.302L17 5.665h-.346l-.797 9.326a3.165 3.165 0 0 1-3.153 2.897H7.296a3.166 3.166 0 0 1-3.113-2.594l-.04-.303-.796-9.326H3a.665.665 0 0 1 0-1.33h3.12l.214-.729.084-.248A3.165 3.165 0 0 1 9.37 1.335zM5.468 14.878l.023.176a1.835 1.835 0 0 0 1.805 1.504h5.408c.953 0 1.747-.73 1.828-1.68l.787-9.213H4.682zm2.2-2.05V8.66a.665.665 0 0 1 1.33 0v4.167a.665.665 0 0 1-1.33 0m3.334 0V8.66a.665.665 0 1 1 1.33 0v4.167a.665.665 0 0 1-1.33 0M9.37 2.664c-.763 0-1.44.47-1.712 1.173l-.049.143-.103.354h4.988l-.103-.354a1.835 1.835 0 0 0-1.761-1.316z"
                fill="currentColor"
            />
        </svg>
    `;
export const LOCAL_FILE_OPTION_ICON = `
        <svg viewBox="1 2 34 34" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M34 21.08L30.86 8.43A2 2 0 0 0 28.94 7H7.06A2 2 0 0 0 5.13 8.47L2 21.08a1 1 0 0 0 0 .24V29a2 2 0 0 0 2 2h28a2 2 0 0 0 2-2v-7.69a1 1 0 0 0 0-.23ZM4 29v-7.56L7.06 9h21.87L32 21.44V29Z"
                fill="currentColor"
            />
            <path d="M6 20h24v2H6z" fill="currentColor"/>
            <path d="M26 24h4v2h-4z" fill="currentColor"/>
        </svg>
    `;
export const GOOGLE_DRIVE_OPTION_ICON = `
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
            <path d="M16.0019 12.4507L12.541 6.34297C12.6559 6.22598 12.7881 6.14924 12.9203 6.09766C11.8998 6.43355 11.4315 7.57961 11.4315 7.57961L5.10895 18.7345C5.01999 19.0843 4.99528 19.4 5.0064 19.6781H11.9072L16.0019 12.4507Z" fill="#34A853"/>
            <path d="M16.002 12.4507L20.0967 19.6781H26.9975C27.0086 19.4 26.9839 19.0843 26.8949 18.7345L20.5724 7.57961C20.5724 7.57961 20.1029 6.43355 19.0835 6.09766C19.2145 6.14924 19.3479 6.22598 19.4628 6.34297L16.002 12.4507Z" fill="#FBBC05"/>
            <path d="M16.0019 12.4514L19.4628 6.34371C19.3479 6.22671 19.2144 6.14997 19.0835 6.09839C18.9327 6.04933 18.7709 6.01662 18.5954 6.00781H18.4125H13.5913H13.4084C13.2342 6.01536 13.0711 6.04807 12.9203 6.09839C12.7894 6.14997 12.6559 6.22671 12.541 6.34371L16.0019 12.4514Z" fill="#188038"/>
            <path d="M11.9082 19.6782L8.48687 25.7168C8.48687 25.7168 8.3732 25.6614 8.21875 25.5469C8.70434 25.9206 9.17633 25.9998 9.17633 25.9998H22.6134C23.3547 25.9998 23.5092 25.7168 23.5092 25.7168C23.5116 25.7155 23.5129 25.7142 23.5153 25.713L20.0965 19.6782H11.9082Z" fill="#4285F4"/>
            <path d="M11.9086 19.6782H5.00781C5.04241 20.4985 5.39826 20.9778 5.39826 20.9778L5.65773 21.4281C5.67627 21.4546 5.68739 21.4697 5.68739 21.4697L6.25205 22.461L7.51976 24.6676C7.55683 24.7569 7.60008 24.8386 7.6458 24.9166C7.66309 24.9431 7.67915 24.972 7.69769 24.9972C7.70263 25.0047 7.70757 25.0123 7.71252 25.0198C7.86944 25.2412 8.04489 25.4123 8.22034 25.5469C8.37479 25.6627 8.48847 25.7168 8.48847 25.7168L11.9086 19.6782Z" fill="#1967D2"/>
            <path d="M20.0967 19.6782H26.9974C26.9628 20.4985 26.607 20.9778 26.607 20.9778L26.3475 21.4281C26.329 21.4546 26.3179 21.4697 26.3179 21.4697L25.7532 22.461L24.4855 24.6676C24.4484 24.7569 24.4052 24.8386 24.3595 24.9166C24.3422 24.9431 24.3261 24.972 24.3076 24.9972C24.3026 25.0047 24.2977 25.0123 24.2927 25.0198C24.1358 25.2412 23.9604 25.4123 23.7849 25.5469C23.6305 25.6627 23.5168 25.7168 23.5168 25.7168L20.0967 19.6782Z" fill="#EA4335"/>
        </svg>
    `;
export const PERSONAL_TITLE_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M16.585 10a6.585 6.585 0 1 0-10.969 4.912A5.65 5.65 0 0 1 10 12.835c1.767 0 3.345.81 4.383 2.077A6.57 6.57 0 0 0 16.585 10M10 14.165a4.32 4.32 0 0 0-3.305 1.53c.972.565 2.1.89 3.305.89a6.55 6.55 0 0 0 3.303-.89A4.32 4.32 0 0 0 10 14.165M11.835 8.5a1.835 1.835 0 1 0-3.67 0 1.835 1.835 0 0 0 3.67 0m6.08 1.5a7.915 7.915 0 1 1-15.83 0 7.915 7.915 0 0 1 15.83 0m-4.75-1.5a3.165 3.165 0 1 1-6.33 0 3.165 3.165 0 0 1 6.33 0"/>
        </svg>
    `;
export const TEAM_TITLE_ICON = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none" aria-hidden="true" focusable="false">
            <circle cx="18" cy="18" r="18" fill="#3c46ff"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="m7.358 14.641 5.056-5.055A2 2 0 0 1 13.828 9h8.343a2 2 0 0 1 1.414.586l5.056 5.055a2 2 0 0 1 .055 2.771l-9.226 9.996a2 2 0 0 1-2.94 0l-9.227-9.996a2 2 0 0 1 .055-2.77Zm6.86-1.939-.426 1.281a2.07 2.07 0 0 1-1.31 1.31l-1.28.426a.296.296 0 0 0 0 .561l1.28.428a2.07 2.07 0 0 1 1.31 1.309l.427 1.28c.09.27.471.27.56 0l.428-1.28a2.07 2.07 0 0 1 1.309-1.31l1.281-.427a.296.296 0 0 0 0-.56l-1.281-.428a2.07 2.07 0 0 1-1.309-1.309l-.427-1.28a.296.296 0 0 0-.561 0z" fill="#fff"/>
        </svg>
    `;
export const SPACE_TITLE_ICON = `
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M16.002 8.333c0-.553-.449-1.002-1.002-1.002h-2.668v8.67h3.67zm-5-3.333c0-.553-.449-1.002-1.002-1.002H5c-.553 0-1.001.45-1.001 1.002v11.001h2.836v-1.835a.666.666 0 0 1 1.33 0v1.835h2.837zm1.33 1.001H15a2.33 2.33 0 0 1 2.332 2.332v7.668h1.002l.134.014a.666.666 0 0 1 0 1.303l-.134.013H1.667a.665.665 0 0 1 0-1.33h1.002v-11a2.33 2.33 0 0 1 2.33-2.333h5A2.33 2.33 0 0 1 12.333 5z"/>
        </svg>
    `;
export const STORAGE_TITLE_ICON = `
        <svg viewBox="0 0 56 56" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M15.1444 49.5742L40.8788 49.5742C45.4725 49.5742 47.9334 47.1836 47.9334 42.5899L47.9334 19.2461C50.2072 18.8711 51.4259 17.1602 51.4259 14.6523L51.4259 11.0898C51.4259 8.2305 49.8553 6.4258 46.9724 6.4258L9.0272 6.4258C6.285 6.4258 4.5741 8.2305 4.5741 11.0898L4.5741 14.6523C4.5741 17.1602 5.8163 18.8711 8.0663 19.2461L8.0663 42.5899C8.0663 47.207 10.5507 49.5742 15.1444 49.5742ZM9.9882 15.7774C8.8163 15.7774 8.3476 15.2852 8.3476 14.1133L8.3476 11.6289C8.3476 10.4571 8.8163 9.9649 9.9882 9.9649L46.035 9.9649C47.2302 9.9649 47.6521 10.4571 47.6521 11.6289L47.6521 14.1133C47.6521 15.2852 47.2302 15.7774 46.035 15.7774ZM15.121 46.0352C13.0116 46.0352 11.8397 44.8867 11.8397 42.7774L11.8397 19.3164L44.1601 19.3164L44.1601 42.7774C44.1601 44.8867 42.9882 46.0352 40.9023 46.0352ZM20.2772 28.7617L35.7694 28.7617C36.7304 28.7617 37.4335 28.082 37.4335 27.0508L37.4335 26.3008C37.4335 25.2696 36.7304 24.6133 35.7694 24.6133L20.2772 24.6133C19.2928 24.6133 18.6132 25.2696 18.6132 26.3008L18.6132 27.0508C18.6132 28.082 19.2928 28.7617 20.2772 28.7617Z"
                fill="currentColor"
            />
        </svg>
    `;
export const EXPORT_ALL_OPTION_ICON = `
        <svg viewBox="0 0 512 512" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M256 85.3333H426.666667V128H256V85.3333ZM256 234.666667H426.666667V277.333333H256V234.666667ZM256 384H426.666667V426.666667H256V384ZM189.815977 46.12562L215.179945 65.6363643L139.147354 164.478733L70.530593 104.439068L91.6027405 80.3566134L134.570667 117.930666L189.815977 46.12562ZM189.815977 195.458953L215.179945 214.969698L139.147354 313.812066L70.530593 253.772401L91.6027405 229.689947L134.570667 267.264L189.815977 195.458953ZM189.815977 344.792287L215.179945 364.303031L139.147354 463.1454L70.530593 403.105734L91.6027405 379.02328L134.570667 416.597333L189.815977 344.792287Z"
                fill="currentColor"
            />
        </svg>
    `;
export const TEAM_WORKSPACE_FIELD_ICON = `
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false">
            <path d="M16.002 8.333c0-.553-.449-1.002-1.002-1.002h-2.668v8.67h3.67zm-5-3.333c0-.553-.449-1.002-1.002-1.002H5c-.553 0-1.001.45-1.001 1.002v11.001h2.836v-1.835a.666.666 0 0 1 1.33 0v1.835h2.837zm1.33 1.001H15a2.33 2.33 0 0 1 2.332 2.332v7.668h1.002l.134.014a.666.666 0 0 1 0 1.303l-.134.013H1.667a.665.665 0 0 1 0-1.33h1.002v-11a2.33 2.33 0 0 1 2.33-2.333h5A2.33 2.33 0 0 1 12.333 5z"/>
        </svg>
    `;
export const SELECT_CONVERSATIONS_OPTION_ICON = `
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path
                d="M8 12L11 15L16 9M4 16.8002V7.2002C4 6.08009 4 5.51962 4.21799 5.0918C4.40973 4.71547 4.71547 4.40973 5.0918 4.21799C5.51962 4 6.08009 4 7.2002 4H16.8002C17.9203 4 18.4796 4 18.9074 4.21799C19.2837 4.40973 19.5905 4.71547 19.7822 5.0918C20 5.5192 20 6.07899 20 7.19691V16.8036C20 17.9215 20 18.4805 19.7822 18.9079C19.5905 19.2842 19.2837 19.5905 18.9074 19.7822C18.48 20 17.921 20 16.8031 20H7.19691C6.07899 20 5.5192 20 5.0918 19.7822C4.71547 19.5905 4.40973 19.2842 4.21799 18.9079C4 18.4801 4 17.9203 4 16.8002Z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
export const AUTO_DRIVE_TASKS_STORAGE_PREFIX = 'cgue_auto_drive_tasks_';
export const AUTO_DRIVE_LEADER_STORAGE_PREFIX = 'cgue_auto_drive_leader_';
export const AUTO_DRIVE_LOCK_STORAGE_PREFIX = 'cgue_auto_drive_lock_';
export const AUTO_DRIVE_MIN_INTERVAL_MINUTES = 5;
export const AUTO_DRIVE_DEFAULT_INTERVAL_MINUTES = 15;
export const AUTO_DRIVE_LOCK_RETRY_MS = 15000;
export const AUTO_DRIVE_LEADER_TTL_MS = 45000;
export const AUTO_DRIVE_LEADER_RENEW_MS = 15000;
export const AUTO_DRIVE_LOCK_TTL_MS = 180000;
export const AUTO_DRIVE_LOCK_RENEW_MS = 45000;
export const AUTO_DRIVE_ACCOUNT_FOLDER_PREFIX = 'Account_';
export const TOAST_HOST_ID = 'cgue-toast-host';
export const TOAST_MAX_VISIBLE = 4;
export const TOAST_BASE_GAP = 16;
export const TOAST_Z_INDEX = 100002;
export const COMP_RETRY_MAX = 10;
export const COMP_RETRY_BASE_MS = 1000;
export const COMP_RETRY_FACTOR = 2;
export const BACKEND_AUTH_RETRY_MAX = 1;
export const BACKEND_LIST_RETRY_MAX = 1;
export const AUTO_DRIVE_IMMEDIATE_RETRY_MAX = 1;
export const TEAM_WORKSPACE_MANUAL_OPTION = '__manual__';
export const TEAM_WORKSPACE_LOADING_OPTION = '__loading__';

