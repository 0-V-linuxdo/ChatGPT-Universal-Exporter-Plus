export const readStoredValue = (key) => {
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

export const writeStoredValue = (key, value) => {
        if (typeof GM_setValue === 'function') {
            GM_setValue(key, value);
            return;
        }
        try {
            localStorage.setItem(key, value);
        } catch (_) {}
    };

export const readStoredJsonValue = (key, fallback) => {
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

export const writeStoredJsonValue = (key, value) => {
        try {
            writeStoredValue(key, JSON.stringify(value));
        } catch (error) {
            console.warn('[CGUE Plus] Stored JSON persist failed:', key, error);
        }
    };

