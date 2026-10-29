/* ===================== Utilidades ===================== */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _nf = {};
function fmt(n, min = 2, max = min) {
  const k = min + '_' + max;
  _nf[k] = _nf[k] || new Intl.NumberFormat('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });
  return Number.isFinite(n) ? _nf[k].format(n) : '–';
}
const money = n => fmt(n, 2, 2);
const brl = n => 'R$ ' + money(n);
const pctf = (n, d = 2) => Number.isFinite(n) ? fmt(n * 100, d, d) + '%' : '–';
const round = (n, d = 2) => Math.round((+n || 0) * 10 ** d) / 10 ** d;
function parseNum(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s|R\$|%/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return Number(s);
}
function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const encK = k => encodeURIComponent(k).replace(/\./g, '%2E');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => new Date().toISOString().slice(0, 10);
const clone = o => JSON.parse(JSON.stringify(o));
function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : iso; }
function ageDays(iso) { if (!iso) return Infinity; const t = Date.parse(iso); return Number.isFinite(t) ? (Date.now() - t) / 864e5 : Infinity; }
function nextCode(prefix, maps, width = 5) {
  let max = 0; const re = new RegExp('^' + prefix + '(\\d+)$');
  for (const m of maps) for (const k of m.keys()) { const r = re.exec(k); if (r) max = Math.max(max, +r[1]); }
  return prefix + String(max + 1).padStart(width, '0');
}
function norm(s) { return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function matchQ(q, ...fields) { if (!q) return true; const n = norm(q); return fields.some(f => norm(f).includes(n)); }

const N_INS = 16, N_CPU = 24, N_PART = 4;
const GRUPOS = ['Material', 'Mão de obra', 'Equipamento', 'Serviços', 'Verbas'];
const TIPOS_ORC = ['Estudo', 'Balizador', 'Paramétrico', 'Pré-executivo', 'Executivo'];
const STATUS = ['Em elaboração', 'Enviado', 'Aprovado', 'Não aprovado'];
const YEAR = new Date().getFullYear();
const SVG = p => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  home: SVG('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>'),
  rev: SVG('<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/><path d="M14 11v6M11 14h6"/>'),
  trash: SVG('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>'),
  xls: SVG('<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 12.5l4 5M12.5 12.5l-4 5M14.5 17.5h2"/>'),
  pdf: SVG('<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M12 11v6M9.5 14.5 12 17l2.5-2.5"/>'),
  edit: SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
  com: SVG('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8 9h8M8 12h5"/>')
};
function nomeOrc(o) { const p = [o.empreendimento, o.cliente].filter(Boolean); return p.length ? p.join(' - ') : (o.nome || ''); }
const idOrc = o => [o.codigo, nomeOrc(o), o.revisao].filter(Boolean).join(' · ');
function custoDireto(B) { const tx = B.meta.tx || {}; const e0 = B.rows.filter(r => r.depth === 0); const ind = e0.find(e => e.v.id === tx.ind) || (tx.ind === '' ? null : e0.find(e => /INDIRET/i.test(e.v.desc))); return B.total - (ind ? ind.total : 0); }

const LOGO_PATH = $('.brand path').getAttribute('d');
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="458" height="458" viewBox="97 92 458 458"><circle cx="326" cy="321" r="229" fill="#FE5000"/><path fill="#FFFFFF" d="${LOGO_PATH}"/></svg>`;
let _logo;
function logoPng(px = 256) {
  if (_logo) return _logo;
  _logo = new Promise(res => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = px; c.getContext('2d').drawImage(img, 0, 0, px, px); res(c.toDataURL('image/png')); };
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(LOGO_SVG);
  });
  return _logo;
}
const LIBS = {
  exceljs: 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  autotable: 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
  jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
};
const _ld = {};
function loadLib(k) {
  return _ld[k] = _ld[k] || new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = LIBS[k]; s.onload = res;
    s.onerror = () => { delete _ld[k]; rej(new Error('Não foi possível carregar a biblioteca ' + k)); };
    document.head.appendChild(s);
  });
}

/* ===================== Estado ===================== */
const S = {
  db: null, dl: null, user: null, online: false, readOnly: false,
  ins: new Map(), cpus: new Map(), orcs: new Map(), cfg: { encargos: 0 },
  loaded: { ins: false, cpus: false, orcs: false },
  view: 'orcs', cur: null, sel: null, compStack: [], collapsed: new Set(),
  q: { plan: '', ins: '', insGrp: '', insOld: false, cpu: '', orcs: '' },
  selCpu: null, imp: { target: 'orc' }, lastB: null, dirtyRender: false, pk: null
};

/* ===================== Banco (chunks) ===================== */
const queues = {};
function enqueue(path, fn) { const p = (queues[path] || Promise.resolve()).catch(() => { }).then(fn); queues[path] = p; return p; }
async function upsert(path, body) {
  if (!S.db) return;
  const ref = S.db.doc(path);
  try { await ref.update(body); }
  catch (e) {
    if (e && e.code === 'invalid_argument') { const s = await ref.get(); if (!s.exists) { await ref.set(body); return; } }
    if (e && e.code === 'unavailable') { await new Promise(r => setTimeout(r, 400 + Math.random() * 600)); await ref.update(body); return; }
    throw e;
  }
}
function writeErr(e) {
  console.warn(e);
  if (e && e.code === 'invalid_argument') toast('Não foi possível salvar. Verifique se você tem permissão de edição ou se o bloco de dados ficou grande demais.', 'err');
  else if (e && e.code === 'quota_exceeded') toast('Limite do banco atingido: ' + e.message, 'err');
  else toast('Falha ao salvar (' + ((e && e.code) || 'erro') + '). Tente de novo.', 'err');
}
function putMany(coll, prefix, n, entries) {
  const groups = {};
  for (const [k, v] of entries) { const i = hash(k) % n; (groups[i] = groups[i] || {})[encK(k)] = v; }
  return Promise.all(Object.entries(groups).map(([i, m]) => {
    const path = `${coll}/${prefix}${i}`;
    return enqueue(path, () => upsert(path, { m })).catch(writeErr);
  }));
}
function saveDoc(path, body) { return enqueue(path, () => upsert(path, body)).catch(writeErr); }
function dbErr(e) { console.warn('db', e); if (e && e.code !== 'revoked') toast('Conexão com o banco interrompida. Recarregue a página.', 'err'); }
function chunkMap(snap, key) {
  const m = new Map();
  for (const d of snap.docs) { const b = (d.data() || {}).m || {}; for (const k in b) { const v = b[k]; if (v && v[key] != null) m.set(v[key], v); } }
  return m;
}

/* catálogo */
function putCatIns(list) { list.forEach(v => S.ins.set(v.cod, v)); return putMany('cat_insumos', 'c', N_INS, list.map(v => [v.cod, v])); }
function delCatIns(cod) { S.ins.delete(cod); return putMany('cat_insumos', 'c', N_INS, [[cod, null]]); }
function putCatCpu(list) { list.forEach(v => S.cpus.set(v.cod, v)); return putMany('cat_cpus', 'c', N_CPU, list.map(v => [v.cod, v])); }
function delCatCpu(cod) { S.cpus.delete(cod); return putMany('cat_cpus', 'c', N_CPU, [[cod, null]]); }

/* orçamento aberto */
const P = id => `orcamentos/${id}/partes`;
function putItems(list) { const c = S.cur; list.forEach(v => c.items.set(v.id, v)); putMany(P(c.id), 'it', N_PART, list.map(v => [v.id, v])); touch(); }
function delItems(ids) { const c = S.cur; ids.forEach(i => c.items.delete(i)); putMany(P(c.id), 'it', N_PART, ids.map(i => [i, null])); touch(); }
function putComps(list) { const c = S.cur; list.forEach(v => c.comps.set(v.cod, v)); putMany(P(c.id), 'cp', N_PART, list.map(v => [v.cod, v])); touch(); }
function putInsOrc(list) { const c = S.cur; list.forEach(v => c.ins.set(v.cod, v)); putMany(P(c.id), 'in', N_PART, list.map(v => [v.cod, v])); touch(); }
function saveMeta(id, fields) { const m = S.orcs.get(id); if (m) S.orcs.set(id, deepMerge(clone(m), fields)); return saveDoc('orcamentos/' + id, fields); }
function deepMerge(a, b) { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]); else a[k] = b[k]; } return a; }

let tTouch;
function touch() {
  clearTimeout(tTouch); const id = S.cur && S.cur.id;
  tTouch = setTimeout(() => {
    if (!S.cur || S.cur.id !== id) return;
    const m = S.orcs.get(id); if (!m) return;
    const B = computeBudget(); const c = round(B.total), v = round(B.venda), d = round(custoDireto(B));
    if (m.totais && m.totais.custo === c && m.totais.venda === v && m.totais.direto === d) return;
    saveMeta(id, { totais: { custo: c, venda: v, direto: d }, atualizado: new Date().toISOString() });
  }, 1500);
}

function openBudget(id) {
  if (S.cur && S.cur.id === id) return;
  if (S.cur && S.cur.unsub) S.cur.unsub();
  S.cur = { id, items: new Map(), comps: new Map(), ins: new Map(), loaded: false };
  S.sel = null; S.compStack = []; S.q.plan = ''; S.q.proj = ''; S.docTab = 'prem';
  try { const c = localStorage.getItem('col_' + id); S.collapsed = new Set(c ? JSON.parse(c) : []); } catch { S.collapsed = new Set(); }
  if (S.db) {
    S.cur.unsub = S.db.collection(P(id)).onSnapshot(snap => {
      if (!S.cur || S.cur.id !== id) return;
      const it = new Map(), cp = new Map(), ins = new Map();
      for (const d of snap.docs) {
        const b = (d.data() || {}).m || {}; const t = d.id.slice(0, 2);
        for (const k in b) { const v = b[k]; if (!v) continue; if (t === 'it') it.set(v.id, v); else if (t === 'cp') cp.set(v.cod, v); else if (t === 'in') ins.set(v.cod, v); }
      }
      const first = !S.cur.loaded; Object.assign(S.cur, { items: it, comps: cp, ins, loaded: true }); if (first) touch(); schedule();
    }, dbErr);
  } else S.cur.loaded = true;
}
function saveCollapsed() { try { localStorage.setItem('col_' + S.cur.id, JSON.stringify([...S.collapsed])); } catch { } }

/* ===================== Cálculo ===================== */
function makeCtx(comps, ins, encPct) { return { comps, ins, enc: (+encPct || 0) / 100, memo: new Map() }; }
function insPrice(ctx, cod) { const i = ctx.ins.get(cod); return i ? (+i.preco || 0) : 0; }
function compUnit(ctx, cod, stack = []) {
  if (ctx.memo.has(cod)) return ctx.memo.get(cod);
  const c = ctx.comps.get(cod); if (!c || stack.includes(cod)) return 0;
  let v = 0;
  if (!c.itens || !c.itens.length) v = +c.pref || 0;
  else for (const it of c.itens) v += (+it.coef || 0) * (it.t === 'c' ? compUnit(ctx, it.cod, [...stack, cod]) : insPrice(ctx, it.cod));
  ctx.memo.set(cod, v); return v;
}
function explode(ctx, cod, f, acc, stack = []) {
  const c = ctx.comps.get(cod); if (!c || stack.includes(cod)) return;
  if (!c.itens || !c.itens.length) { const k = '§' + cod; acc.set(k, (acc.get(k) || 0) + f); return; }
  for (const it of c.itens) { const q = f * (+it.coef || 0); if (it.t === 'c') explode(ctx, it.cod, q, acc, [...stack, cod]); else acc.set(it.cod, (acc.get(it.cod) || 0) + q); }
}
function bdiValue(m) {
  const b = (m && m.bdi) || {};
  if (b.modo === 'tcu') { const f = x => (+x || 0) / 100; const I = f(b.i); if (I >= 1) return 0; return ((1 + f(b.ac) + f(b.s) + f(b.r) + f(b.g)) * (1 + f(b.df)) * (1 + f(b.l)) / (1 - I)) - 1; }
  return (+b.valor || 0) / 100;
}
function childrenMap(items) {
  const kids = new Map();
  for (const v of items.values()) { const p = v.par && items.has(v.par) ? v.par : ''; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(v); }
  for (const a of kids.values()) a.sort((x, y) => x.pos - y.pos);
  return kids;
}
function computeBudget() {
  const cur = S.cur, meta = S.orcs.get(cur.id) || {};
  const ctx = makeCtx(cur.comps, cur.ins, meta.encargos);
  const kids = childrenMap(cur.items); const rows = []; const byId = new Map();
  function walk(par, prefix, depth, parentRow) {
    const arr = kids.get(par) || []; let sum = 0;
    arr.forEach((v, i) => {
      const n = v.num || ((prefix ? prefix + '.' : '') + String(i + 1).padStart(2, '0'));
      const row = { v, n, depth, parent: parentRow, idx: rows.length }; rows.push(row); byId.set(v.id, row);
      if (v.k === 'e') { row.total = walk(v.id, n, depth + 1, row); row.count = rows.length - row.idx - 1; }
      else { row.unit = v.cod ? compUnit(ctx, v.cod) : 0; row.total = (+v.qtd || 0) * row.unit; row.missing = !!v.cod && !cur.comps.has(v.cod); }
      sum += row.total;
    });
    return sum;
  }
  const total = walk('', '', 0, null);
  const B = { rows, byId, total, ctx, kids, meta };
  if (meta.bdi && meta.bdi.modo === 'unita') { B.ps = precoUnita(B, meta); B.bdi = total ? B.ps.S3 / total - 1 : 0; B.venda = B.ps.S3; }
  else { B.bdi = bdiValue(meta); B.venda = total * (1 + B.bdi); }
  return B;
}
function catCtx() { return makeCtx(S.cpus, S.ins, S.cfg.encargos); }

/* ===================== UI base ===================== */
function toast(msg, kind, action) {
  const t = document.createElement('div'); t.className = 'toast' + (kind === 'err' ? ' err' : '');
  const sp = document.createElement('span'); sp.textContent = msg; t.appendChild(sp);
  if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { action.fn(); t.remove(); }; t.appendChild(b); }
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), action ? 8000 : kind === 'err' ? 7000 : 3500);
}
function openModal(html, wide) {
  $('#modal').innerHTML = `<div class="modal-bg" data-act="bgClose"><div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  const f = $('#modal [autofocus]') || $('#modal input, #modal select'); if (f) f.focus();
}
function closeModal() { $('#modal').innerHTML = ''; S.pk = null; }
let rq = 0;
function schedule() {
  if (rq) return;
  rq = requestAnimationFrame(() => {
    rq = 0; const a = document.activeElement;
    if (a && a.closest && a.closest('#app') && a.matches('input:not([data-live]),select,textarea')) { S.dirtyRender = true; return; }
    render();
  });
}
document.addEventListener('focusout', () => { if (S.dirtyRender) { S.dirtyRender = false; setTimeout(schedule, 0); } });
const dis = () => S.readOnly ? ' disabled' : '';

function renderTabs() {
  const T = [['orcs', ICON.home], ['plan', 'Orçamento', !S.cur], ['ind', 'Indicadores', !S.cur], ['docs', 'Documentos', !S.cur], ['ins', 'Insumos gerais'], ['cpus', 'Composições'], ['incc', 'INCC'], ['imp', 'Importar'], ['exp', 'Exportar']];
  $('#tabs').innerHTML = T.map(([v, l, d]) => `<button class="tab${v === 'orcs' ? ' tab-ico' : ''}" data-act="tab" data-v="${v}"${v === 'orcs' ? ' aria-label="Orçamentos" title="Orçamentos"' : ''}${S.view === v ? ' aria-current="page"' : ''}${d ? ' disabled' : ''}>${l}</button>`).join('');
  const c = $('#conn'); c.className = 'conn' + (S.online ? ' on' : '');
  c.querySelector('span').textContent = S.online ? (S.readOnly ? 'Somente leitura' : 'Banco compartilhado') : 'Modo local, sem salvar';
}
function render() {
  if (S.view === 'dados' && S._dadosDirty && document.querySelector('#app .mf-root')) { renderTabs(); return; }
  const ae = document.activeElement;
  const keep = ae && ae.id && ae.closest && ae.closest('#app') ? { id: ae.id, s: ae.selectionStart, e: ae.selectionEnd } : null;
  renderTabs();
  let h = '';
  try {
    switch (S.view) {
      case 'orcs': h = vOrcs(); break;
      case 'plan': h = S.cur ? vPlan() : vNoOrc(); break;
      case 'dados': h = S.cur ? vDados() : vNoOrc(); break;
      case 'ind': h = S.cur ? vInd() : vNoOrc(); break;
      case 'docs': h = S.cur ? vDocs() : vNoOrc(); break;
      case 'incc': h = vIncc(); break;
      case 'ins': h = vIns(); break;
      case 'cpus': h = vCpus(); break;
      case 'imp': h = vImp(); break;
      case 'exp': h = vExp(); break;
    }
  } catch (e) { console.error(e); h = `<div class="banner">Erro ao montar a tela: ${esc(e.message)}</div>`; }
  const banner = !S.online ? `<div class="banner">Sem conexão com o banco compartilhado nesta visualização. Você pode testar as telas, mas nada será salvo.</div>` : '';
  document.body.classList.toggle('fix', S.view === 'plan' && !!S.cur && S.cur.loaded);
  $('#app').innerHTML = banner + h;
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch { } } }
}
const loading = t => `<div class="card empty">Carregando ${t}…</div>`;
function vNoOrc() { return `<div class="card empty">Abra um orçamento na lista (ícone da casa) para usar esta tela.<div style="margin-top:12px"><button class="btn primary" data-act="tab" data-v="orcs">Ver orçamentos</button></div></div>`; }

/* ===================== Tela: Orçamentos ===================== */
function statusChip(s) { const cls = s === 'Aprovado' ? 'solid' : s === 'Não aprovado' ? 'dark' : s === 'Enviado' ? 'acc' : ''; return `<span class="chip ${cls}">${esc(s || 'Em elaboração')}</span>`; }
function vOrcs() {
  if (!S.loaded.orcs) return loading('orçamentos');
  const all = [...S.orcs.values()];
  const tf = S.q.tipo || '';
  const list = all.filter(o => (!tf || norm(o.tipo) === norm(tf)) && matchQ(S.q.orcs, o.codigo, nomeOrc(o), o.obra, o.cliente, o.empreendimento))
    .sort((a, b) => String(b.atualizado || '').localeCompare(String(a.atualizado || '')));
  const cnt = t => all.filter(o => !t || norm(o.tipo) === norm(t)).length;
  const opt = t => `<option value="${esc(t)}"${tf === t ? ' selected' : ''}>${t || 'Todos os tipos'} (${cnt(t)})</option>`;
  const filtro = `<label class="sel-btn${tf ? ' on' : ''}" title="Filtrar por tipo de orçamento"><span class="lbl">Tipo</span><select id="f-tipo" data-f="q.tipo" aria-label="Tipo de orçamento">${['', ...TIPOS_ORC].map(opt).join('')}</select></label>`;
  const rows = list.map(o => {
    const T = o.totais || {}; const dir = T.direto ?? T.custo ?? 0;
    const podeEditar = norm(o.status || 'Em elaboração') === norm('Em elaboração') && !S.readOnly;
    return `<tr class="clk" data-act="openOrc" data-id="${esc(o.id)}">
      <td>${esc(o.codigo)}</td><td class="c-orc"><b>${esc(nomeOrc(o))}</b></td><td>${esc(o.revisao || '')}</td><td>${esc(o.tipo || '')}</td><td>${statusChip(o.status)}</td>
      <td class="num">${money(dir)}</td><td class="num"><b>${money(T.custo || 0)}</b></td>
      <td class="muted">${o.atualizado ? fmtDate(o.atualizado) : ''}</td>
      <td class="acts"><button class="ib" data-act="editOrc" data-id="${esc(o.id)}" title="${podeEditar ? 'Editar orçamento' : 'Edição disponível apenas com status Em elaboração'}" aria-label="Editar orçamento"${podeEditar ? '' : ' disabled'}>${ICON.edit}</button><button class="ib" data-act="revOrc" data-id="${esc(o.id)}" title="Nova revisão" aria-label="Nova revisão"${dis()}>${ICON.rev}</button><button class="ib danger" data-act="delOrc" data-id="${esc(o.id)}" title="Excluir" aria-label="Excluir"${dis()}>${ICON.trash}</button></td></tr>`;
  }).join('');
  return `<div class="page-head"><div class="row">${filtro}</div>
    <div class="row"><input class="search" id="q-orcs" data-live="orcs" placeholder="Buscar por código, empreendimento, cliente…" value="${esc(S.q.orcs)}"><button class="btn primary" data-act="newOrc"${dis()}>Novo orçamento</button></div></div>
    <div class="card"><div class="tbl-wrap"><table class="grid orcs-tbl"><thead><tr><th>Código</th><th class="c-orc">Orçamento</th><th>Revisão</th><th>Tipo</th><th>Status</th><th title="Sem a etapa de custos indiretos">Custo direto (R$)</th><th title="Custo raso: direto + indireto">Custo total (R$)</th><th>Última atualização</th><th>Ações</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="9" class="empty">${all.length ? 'Nenhum orçamento com esse filtro.' : 'Nenhum orçamento ainda. Crie o primeiro em "Novo orçamento".'}</td></tr>`}</tbody></table></div></div>`;
}
/* ===================== Tela: Planilha ===================== */
function vPlan() {
  const cur = S.cur; if (!cur.loaded) return loading('orçamento');
  const meta = S.orcs.get(cur.id); if (!meta) return `<div class="card empty">Este orçamento foi excluído.</div>`;
  const B = computeBudget(); S.lastB = B;
  let rows = B.rows;
  const q = S.q.plan;
  if (q) { const keep = new Set(); for (const r of rows) if (matchQ(q, r.v.desc, r.v.cod, r.n)) { let p = r; while (p) { keep.add(p.v.id); p = p.parent; } } rows = rows.filter(r => keep.has(r.v.id)); }
  else rows = rows.filter(r => { let p = r.parent; while (p) { if (S.collapsed.has(p.v.id)) return false; p = p.parent; } return true; });
  const com = v => `<td class="c-com"><button class="ib com${v.det ? ' on' : ''}" data-act="comment" data-id="${v.id}" title="${esc(v.det || 'Adicionar comentário')}" aria-label="${v.det ? 'Ver comentário' : 'Adicionar comentário'}"${S.readOnly && !v.det ? ' disabled' : ''}>${ICON.com}</button></td>`;
  const body = rows.map(r => {
    const v = r.v, e = v.k === 'e', sel = S.sel === v.id ? ' sel' : '';
    const pad = 6 + r.depth * 14;
    const tog = e ? `<button class="tog" data-act="tog" data-id="${v.id}" aria-label="Recolher ou expandir">${S.collapsed.has(v.id) && !q ? '▸' : '▾'}</button>` : '<span class="tog"></span>';
    if (e) return `<tr class="e${Math.min(r.depth, 3)}${sel}" data-id="${v.id}" data-act="sel">
      <td class="c-n">${tog}<input class="cell plain nin" id="c-n-${v.id}" data-f="it.n" data-id="${v.id}" value="${esc(r.n)}" title="Altere o número para mover o item" inputmode="decimal" autocomplete="off"${dis()}></td><td class="c-cod">Etapa</td>
      <td class="c-desc"><input class="cell plain" id="c-desc-${v.id}" style="padding-left:${pad}px;font-weight:inherit" data-f="it.desc" data-id="${v.id}" value="${esc(v.desc)}"${dis()}></td>
      <td></td><td></td><td></td><td class="num">${money(r.total)}</td>${com(v)}</tr>`;
    const c = v.cod && cur.comps.get(v.cod); const un = (c && c.un) || v.un || '';
    return `<tr class="${sel.trim()}" data-id="${v.id}" data-act="sel">
      <td class="c-n"><span class="tog"></span><input class="cell plain nin" id="c-n-${v.id}" data-f="it.n" data-id="${v.id}" value="${esc(r.n)}" title="Altere o número para mover o item" inputmode="decimal" autocomplete="off"${dis()}></td><td class="c-cod">${esc(v.cod || '')}${r.missing ? ' <span class="warn" title="Composição não encontrada no orçamento">!</span>' : ''}</td>
      <td class="c-desc"><input class="cell plain" id="c-desc-${v.id}" style="padding-left:${pad}px" data-f="it.desc" data-id="${v.id}" value="${esc(v.desc)}"${dis()}></td>
      <td class="c-un" title="A unidade é a da composição e só muda na aba Composições">${esc(un)}</td>
      <td style="width:110px"><input class="cell num" id="c-qtd-${v.id}" data-f="it.qtd" data-id="${v.id}" value="${fmt(+v.qtd || 0, 2, 5)}"${dis()}></td>
      <td class="num">${money(r.unit)}</td><td class="num">${money(r.total)}</td>${com(v)}</tr>`;
  }).join('');
  return `<div class="plan">
  <div class="docbar"><div class="ttl"><b>${esc(nomeOrc(meta))}${meta.revisao ? ` (${esc(meta.revisao)})` : ''}</b></div></div>
  <div class="card grid-card">
    <div class="toolbar">
      <button class="btn sm" data-act="addEtapa"${dis()}>+ Etapa</button><button class="btn sm" data-act="addSub"${dis()}>+ Subetapa</button><button class="btn sm" data-act="addServ"${dis()}>+ Serviço</button>
      <span class="sep"></span>
      <button class="btn sm ghost" data-act="outdent" title="Subir um nível"${dis()}>← Recuar</button><button class="btn sm ghost" data-act="indent" title="Descer um nível (entra na etapa acima)"${dis()}>Avançar →</button>
      <button class="btn sm ghost" data-act="up" title="Mover para cima"${dis()}>↑</button><button class="btn sm ghost" data-act="down" title="Mover para baixo"${dis()}>↓</button>
      <button class="btn sm ghost" data-act="delItem"${dis()}>Excluir</button>
      <span class="sep"></span><button class="btn sm ghost" data-act="colAll">Recolher tudo</button><button class="btn sm ghost" data-act="expAll">Expandir tudo</button>${[...cur.items.values()].some(v => v.num) ? `<button class="btn sm ghost" data-act="renum" title="A numeração veio do arquivo importado"${dis()}>Renumerar</button>` : ''}
      <span class="spacer"></span><input class="search" id="q-plan" data-live="plan" placeholder="Filtrar itens…" value="${esc(q)}">
    </div>
    <div class="tbl-wrap tall"><table class="grid"><thead><tr><th>Item</th><th>Código</th><th>Descrição</th><th>Un</th><th class="num">Qtde</th><th class="num">Custo unit.</th><th class="num">Custo total</th><th class="c-com" title="Comentário do item">${ICON.com}</th></tr></thead>
    <tbody>${body || `<tr><td colspan="8" class="empty">Orçamento vazio. Comece com "+ Etapa" e depois "+ Serviço".</td></tr>`}</tbody>
    <tfoot><tr class="tot"><td colspan="6">TOTAL GERAL (custo raso)</td><td class="num">${money(B.total)}</td><td></td></tr></tfoot></table></div>
  </div>
  ${compPanel(B)}
  </div>`;
}
function mmaa(ym) { if (!ym) return ''; const [y, m] = String(ym).split('-'); return `${m}/${String(y).slice(2)}`; }
function compPanel(B) {
  const v = S.cur.items.get(S.sel);
  if (!v) return `<section id="comp-panel" class="panel"><div class="empty">Selecione um serviço na planilha para ver e editar a composição de custos.</div></section>`;
  const row = B.byId.get(v.id);
  if (v.k === 'e') {
    const T = B.total || 0;
    return `<section id="comp-panel" class="panel"><div class="panel-head"><div class="grow"><span class="lbl">Etapa ${row ? row.n : ''}</span><h2>${esc(v.desc)}</h2></div>
      <div class="kpis"><div class="kpi"><div class="lbl">Custo direto</div><div class="v">${brl(row ? row.total : 0)}</div></div><div class="kpi"><div class="lbl">Peso no orçamento</div><div class="v">${T && row ? pctf(row.total / T) : '–'}</div></div><div class="kpi"><div class="lbl">Itens</div><div class="v">${row ? row.count : 0}</div></div></div></div>
      <div class="empty">Etapas somam os serviços abaixo delas. Selecione um serviço para ver a composição.</div></section>`;
  }
  if (!v.cod) return `<section id="comp-panel" class="panel"><div class="panel-head"><div class="grow"><span class="lbl">Serviço ${row ? row.n : ''}</span><h2>${esc(v.desc)}</h2></div></div>
    <div class="empty">Este serviço ainda não tem composição.<div class="row" style="justify-content:center;margin-top:10px"><button class="btn" data-act="compLink"${dis()}>Vincular composição existente</button><button class="btn primary" data-act="compCreate"${dis()}>Criar composição neste orçamento</button></div></div></section>`;
  const code = S.compStack.length ? S.compStack[S.compStack.length - 1] : v.cod;
  return compEditor('orc', code, { item: v, row, B });
}
