import { build } from 'esbuild';
import { USERSCRIPT_BANNER } from '../src/config/userscript-header.js';

await build({
    entryPoints: ['src/main.js'],
    outfile: 'ChatGPT Universal Exporter Plus.user.js',
    bundle: true,
    format: 'iife',
    target: ['es2020'],
    banner: {
        js: USERSCRIPT_BANNER
    },
    legalComments: 'none',
    minify: false,
    sourcemap: false
});
