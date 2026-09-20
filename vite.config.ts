import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

/**
 * One config, one bundle per host adapter.
 *
 * `--mode wordpress` builds `dist/wordpress/vifee-widget.js`, the module the
 * WordPress plugin enqueues (and `scripts/sync-wp-plugin.mjs` copies into it).
 * `--mode cloud` builds `dist/cloud/vifee-widget.js` the same way.
 */
const targets = {
  wordpress: { entry: 'src/adapters/wordpress/entry.ts', fileName: 'vifee-widget', outDir: 'dist/wordpress' },
  cloud: { entry: 'src/adapters/cloud/entry.ts', fileName: 'vifee-widget', outDir: 'dist/cloud' },
} as const;

type TargetName = keyof typeof targets;

const resolveTarget = (mode: string): TargetName => (mode in targets ? (mode as TargetName) : 'wordpress');

export default defineConfig(({ mode }) => {
  const alias = {
    // Host-agnostic translation layer. Every user-facing string imports
    // from here; the active host installs its own translator at boot
    // (see src/core/i18n.ts).
    '@vifee/i18n': fileURLToPath(new URL('./src/core/i18n.ts', import.meta.url)),
    // Icons and the pin mark live outside src/ so both the build and any
    // future design tooling can reach them by a stable path.
    '@assets': fileURLToPath(new URL('./assets', import.meta.url)),
  };

  // The loader is a second, much smaller build for the same `dist/cloud/`
  // output directory: a classic (non-module) IIFE script, so it can be
  // dropped into a plain `<script async src="...">` tag with no `type`
  // attribute (see the snippet in PLAN_WDROZENIA_CLOUD.md §9.2). It must not
  // wipe out the main bundle's manifest, so `emptyOutDir` and `manifest` are
  // both off here — only the `cloud` target (built first, see
  // `build:cloud`) empties the directory and writes a manifest.
  if (mode === 'cloud-loader') {
    return {
      base: './',
      plugins: [preact()],
      resolve: { alias },
      build: {
        outDir: 'dist/cloud',
        emptyOutDir: false,
        manifest: false,
        lib: {
          entry: 'src/adapters/cloud/loader.ts',
          formats: ['iife'],
          name: 'VifeeLoader',
          fileName: () => 'loader.js',
        },
        cssCodeSplit: false,
        sourcemap: false,
      },
      test: { css: true, environment: 'jsdom', globals: true, restoreMocks: true },
    };
  }

  const target = targets[resolveTarget(mode)];

  return {
    base: './',
    plugins: [preact()],
    resolve: { alias },
    server: {
      fs: {
        allow: ['..'],
      },
    },
    build: {
      assetsInlineLimit: 0,
      outDir: target.outDir,
      emptyOutDir: true,
      manifest: true,
      lib: {
        entry: target.entry,
        formats: ['es'],
        fileName: target.fileName,
      },
      cssCodeSplit: false,
      sourcemap: false,
    },
    test: {
      css: true,
      environment: 'jsdom',
      globals: true,
      restoreMocks: true,
    },
  };
});
