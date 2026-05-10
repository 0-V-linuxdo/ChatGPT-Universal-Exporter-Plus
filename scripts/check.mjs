import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import './build.mjs';

const checkedFiles = [
    ...collectJavaScriptFiles('src'),
    ...collectJavaScriptFiles('scripts'),
    'ChatGPT Universal Exporter Plus.user.js'
];

let failed = false;
for (const file of checkedFiles) {
    const result = spawnSync(process.execPath, ['--check', file], {
        encoding: 'utf8'
    });
    if (result.status !== 0) {
        failed = true;
        const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
        console.error(output || `Syntax check failed: ${file}`);
    }
}

if (failed) {
    process.exitCode = 1;
} else {
    console.log(`Checked ${checkedFiles.length} JavaScript files.`);
}

function collectJavaScriptFiles(directory) {
    const files = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectJavaScriptFiles(path));
        } else if (entry.isFile() && (path.endsWith('.js') || path.endsWith('.mjs'))) {
            files.push(path);
        }
    }
    return files.sort();
}
