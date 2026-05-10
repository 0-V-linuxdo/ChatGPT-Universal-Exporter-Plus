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

export async function generateZipBlob(zip) {
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

