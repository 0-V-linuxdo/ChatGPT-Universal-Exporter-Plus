export function createZipArchive() {
    const ZipArchive = globalThis.JSZip;
    if (typeof ZipArchive !== 'function') {
        throw new Error('JSZip is not available. Check the userscript @require metadata.');
    }
    return new ZipArchive();
}
