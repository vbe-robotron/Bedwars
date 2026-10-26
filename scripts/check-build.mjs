import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');

function fail(message) {
  console.error(`check-build: ${message}`);
  process.exit(1);
}

const scriptStart = html.indexOf('<script>');
if (scriptStart < 0) fail('インラインscriptが見つかりません');
const scriptEnd = html.indexOf('</script>', scriptStart);
if (scriptEnd < 0) fail('インラインscriptが閉じていません（<\\/script>になっていませんか）');
const script = html.slice(scriptStart + '<script>'.length, scriptEnd);
if (script.length < 1000) fail('インラインscriptの中身が小さすぎます');
try {
  new Function(script);
} catch (error) {
  fail(`インラインscriptの構文エラー: ${error.message}`);
}

const styleStart = html.lastIndexOf('<style>');
if (styleStart < 0) fail('最終的なインラインstyleが見つかりません');
const styleEnd = html.indexOf('</style>', styleStart);
if (styleEnd < 0) fail('最終的なインラインstyleが閉じていません（<\\/style>になっていませんか）');

if (!/<\/body>\s*<\/html>\s*$/i.test(html)) {
  fail('HTMLの末尾が不正です');
}

const gameDir = resolve(root, 'src/game');
const scriptDir = resolve(gameDir, 'scripts');
for (const file of await readdir(scriptDir)) {
  if (!file.endsWith('.js')) continue;
  const code = await readFile(resolve(scriptDir, file), 'utf8');
  if (/https?:\/\//i.test(code)) fail(`${file} に外部URLが残っています`);
  try {
    new Function(code);
  } catch (error) {
    fail(`${file} の構文エラー: ${error.message}`);
  }
}

for (const file of ['LegacyUI.jsx', 'legacy.css']) {
  const content = await readFile(resolve(gameDir, file), 'utf8');
  if (/https?:\/\//i.test(content)) fail(`${file} に外部URLが残っています`);
}

console.log(`check-build: OK (${html.length.toLocaleString()} bytes)`);
