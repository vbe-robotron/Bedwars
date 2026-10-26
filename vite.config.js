import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inlineBuildAssets() {
  return {
    name: 'inline-build-assets',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = Object.values(bundle).find((item) => item.type === 'asset' && item.fileName.endsWith('.html'));
      if (!html) return;
      let source = String(html.source);
      for (const [fileName, asset] of Object.entries(bundle)) {
        if (fileName.endsWith('.js') && asset.type === 'chunk') {
          const pattern = new RegExp(`<script[^>]+src="(?:/|\\./)?${escapeRegExp(fileName)}"[^>]*><\\/script>`);
          const code = String(asset.code).replace(/<\/script/gi, '<\\/script');
          let replaced = false;
          source = source.replace(pattern, () => {
            replaced = true;
            return `<script>(function(){${code}\n}).call(window);</script>`;
          });
          if (!replaced) throw new Error(`インライン化対象のscriptが見つかりません: ${fileName}`);
          delete bundle[fileName];
        } else if (fileName.endsWith('.css') && asset.type === 'asset') {
          const pattern = new RegExp(`<link[^>]+href="(?:/|\\./)?${escapeRegExp(fileName)}"[^>]*>`);
          const css = String(asset.source).replace(/<\/style/gi, '<\\/style');
          let replaced = false;
          source = source.replace(pattern, () => {
            replaced = true;
            return `<style>${css}</style>`;
          });
          if (!replaced) throw new Error(`インライン化対象のstylesheetが見つかりません: ${fileName}`);
          delete bundle[fileName];
        }
      }
      html.source = source;
    }
  };
}

export default defineConfig({
  plugins: [react(), inlineBuildAssets()],
  build: {
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        codeSplitting: false,
        format: 'iife',
        name: 'BedWarsUltimate'
      }
    }
  },
  server: { host: '0.0.0.0' }
});
