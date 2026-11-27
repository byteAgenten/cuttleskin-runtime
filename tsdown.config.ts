import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsdown';

/** The configuration format (`config/`) is part of the runtime and bundled into both files. */
const alias = {
  '@cuttleskin/config': fileURLToPath(new URL('config/index.ts', import.meta.url)),
};

/**
 * Builds the files in `dist/` from the sources in `src/` and `config/`:
 * - `cuttleskin.mjs` + `cuttleskin.d.ts`: ES module, readable (not minified)
 * - `cuttleskin.min.js`: minified script for a classic `<script>` tag, global `cuttleskin`
 */
export default defineConfig([
  {
    entry: { cuttleskin: 'src/index.ts' },
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    outDir: 'dist',
    alias,
    dts: true,
    sourcemap: false,
    outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
  },
  {
    entry: { cuttleskin: 'src/index.ts' },
    format: 'iife',
    globalName: 'cuttleskin',
    platform: 'browser',
    target: 'es2022',
    outDir: 'dist',
    alias,
    minify: true,
    dts: false,
    sourcemap: false,
    // Keeps the ES module of the first build
    clean: false,
    outputOptions: { entryFileNames: 'cuttleskin.min.js' },
  },
]);
