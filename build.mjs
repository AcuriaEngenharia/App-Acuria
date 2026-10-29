// Monta o app a partir de src/ e gera dist/.
//   node build.mjs
// Saídas:
//   dist/index.html        corpo da página para publicar como Artifact (sem <html>/<head>; o claude.ai adiciona o esqueleto)
//   dist/local.html        mesma página com esqueleto completo e o runtime simulado (dev/mock-claude.js) para teste local
//   dist/modelo-cliente.txt  modelo da planilha do cliente em base64 (o app busca este arquivo em tempo de execução)
//   dist/Inter-*.ttf, dist/mock-claude.js
//   dist/site/             versão web publicada na Vercel (login e banco no Supabase)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const r = (...p) => path.join(root, ...p);
const read = p => fs.readFileSync(r(p), 'utf8');

const jsFiles = fs.readdirSync(r('src/js')).filter(f => f.endsWith('.js')).sort();
const js = jsFiles.map(f => read(path.join('src/js', f))).join('');
fs.mkdirSync(r('dist'), { recursive: true });
fs.writeFileSync(r('dist/app.js'), js);
execFileSync(process.execPath, ['--check', r('dist/app.js')], { stdio: 'inherit' });

const page = read('src/shell.html') + '<script>\n' + js + '</script>\n';
fs.writeFileSync(r('dist/index.html'), page);
fs.writeFileSync(r('dist/local.html'),
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' +
  '<script src="mock-claude.js"></script>\n' + page + '</body></html>\n');

fs.writeFileSync(r('dist/modelo-cliente.txt'), fs.readFileSync(r('assets/modelo-cliente.xlsx')).toString('base64'));
for (const f of ['Inter-Regular.ttf', 'Inter-Bold.ttf']) fs.copyFileSync(r('assets', f), r('dist', f));
fs.copyFileSync(r('dev/mock-claude.js'), r('dist/mock-claude.js'));

// versão web (Vercel + Supabase): página completa com login e banco no Supabase (web/supabase-claude.js)
const site = r('dist/site');
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(path.join(site, 'vendor'), { recursive: true });
fs.writeFileSync(path.join(site, 'index.html'),
  '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' +
  '<script src="vendor/supabase.js"></script>\n<script src="config.js"></script>\n<script src="supabase-claude.js"></script>\n' + page + '</body></html>\n');
for (const f of ['config.js', 'supabase-claude.js', 'importar.html', 'vendor/supabase.js']) fs.copyFileSync(r('web', f), path.join(site, f));
for (const f of ['modelo-cliente.txt', 'Inter-Regular.ttf', 'Inter-Bold.ttf']) fs.copyFileSync(r('dist', f), path.join(site, f));
execFileSync(process.execPath, ['--check', r('web/supabase-claude.js')], { stdio: 'inherit' });

const kb = n => (n / 1024).toFixed(0) + ' KB';
console.log(`ok: ${jsFiles.length} módulos, index.html ${kb(Buffer.byteLength(page))}`);
