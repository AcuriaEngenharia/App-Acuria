/* ===================== Editor de composição (orçamento e base) ===================== */
const STORE = {
  orc: { comps: () => S.cur.comps, ins: () => S.cur.ins, putComps: l => putComps(l), putIns: l => putInsOrc(l), ctx: () => (S.lastB ? S.lastB.ctx : computeBudget().ctx), enc: () => +((S.orcs.get(S.cur.id) || {}).encargos || 0) },
  cat: { comps: () => S.cpus, ins: () => S.ins, putComps: l => putCatCpu(l), putIns: l => putCatIns(l), ctx: () => catCtx(), enc: () => +(S.cfg.encargos || 0) }
};
function reaches(comps, from, target, seen = new Set()) {
  if (from === target) return true; if (seen.has(from)) return false; seen.add(from);
  const c = comps.get(from); if (!c) return false;
  return (c.itens || []).some(it => it.t === 'c' && reaches(comps, it.cod, target, seen));
}
function compEditor(kind, cod, opt = {}) {
  const st = STORE[kind], comps = st.comps(), ins = st.ins(), ctx = st.ctx();
  const idAttr = kind === 'orc' ? 'id="comp-panel"' : 'id="cpu-editor"';
  const c = comps.get(cod);
  if (!c) {
    const inBase = kind === 'orc' && S.cpus.has(cod);
    return `<section ${idAttr} class="panel${kind === 'orc' ? ' orc' : ''}"><div class="empty">A composição ${esc(cod)} não está ${kind === 'orc' ? 'neste orçamento' : 'na base'}.${inBase ? `<div style="margin-top:10px"><button class="btn primary" data-act="compSync" data-cod="${esc(cod)}"${dis()}>Trazer da base</button></div>` : ''}</div></section>`;
  }
  const unit = compUnit(ctx, cod);
  const enc = st.enc();
  const D = kind + '-' + cod;
  let crumbs = '';
  if (kind === 'orc' && opt.item) {
    const chain = [opt.item.cod, ...S.compStack];
    if (chain.length > 1) crumbs = `<div class="crumbs">${chain.map((x, i) => i < chain.length - 1 ? `<button data-act="crumb" data-i="${i}">${esc(x)}</button><span>›</span>` : `<b>${esc(x)}</b>`).join('')}</div>`;
  }
  const itens = c.itens || [];
  const trs = itens.map((it, i) => {
    const coef = `<input class="cell num" id="ci-${esc(D)}-${i}" data-f="ci.coef" data-ctx="${kind}" data-cod="${esc(cod)}" data-i="${i}" value="${fmt(+it.coef || 0, 5, 8)}" style="width:96px"${dis()}>`;
    const del = `<button class="x" data-act="ciDel" data-ctx="${kind}" data-cod="${esc(cod)}" data-i="${i}" title="Remover item"${dis()}>×</button>`;
    if (it.t === 'c') {
      const a = comps.get(it.cod); const pu = compUnit(ctx, it.cod); const sub = (+it.coef || 0) * pu;
      return `<tr><td><span class="tipo c" data-act="drill" data-ctx="${kind}" data-cod="${esc(it.cod)}" title="Abrir composição auxiliar">COMP. AUX.</span></td><td class="c-cod">${esc(it.cod)}</td>
        <td>${a ? esc(a.desc) : '<span class="warn">não encontrada</span>'}</td><td>${esc(a ? a.un : '')}</td><td>${coef}</td>
        <td class="num">${fmt(pu, 5, 5)}</td><td class="num"><b>${fmt(sub, 5, 5)}</b></td><td class="muted">Composição</td><td></td><td>${del}</td></tr>`;
    }
    const x = ins.get(it.cod); const pe = insPrice(ctx, it.cod); const sub = (+it.coef || 0) * pe;
    if (!x) return `<tr><td class="tipo">INSUMO</td><td class="c-cod">${esc(it.cod)}</td><td><span class="warn">Insumo não encontrado</span></td><td></td><td>${coef}</td><td></td><td class="num">0,00</td><td></td><td></td><td>${del}</td></tr>`;
    const old = ageDays(x.dt) > 180;
    const idb = `ins-${kind}-`;
    return `<tr><td class="tipo">INSUMO</td><td class="c-cod">${esc(x.cod)}</td><td>${esc(x.desc)}</td><td>${esc(x.un)}</td><td>${coef}</td>
      <td style="width:110px"><input class="cell num" id="${esc(idb + 'preco-' + D + '-' + i)}" data-f="ins.preco" data-ctx="${kind}" data-cod="${esc(x.cod)}" value="${fmt(+x.preco || 0, 2, 5)}"${dis()}></td>
      <td class="num"><b>${fmt(sub, 5, 5)}</b></td>
      <td class="muted" title="O grupo muda na aba Insumos">${esc(x.grp || '')}</td>
      <td class="muted" title="A cotação muda na aba Insumos">${x.dt ? fmtDate(x.dt) : '–'}${old && x.dt ? ' <span class="chip acc" title="Cotação com mais de 6 meses">antiga</span>' : ''}</td><td>${del}</td></tr>`;
  }).join('');
  const terms = itens.slice(0, 10).map(it => `${fmt(+it.coef || 0, 2, 5)} × ${fmt(it.t === 'c' ? compUnit(ctx, it.cod) : insPrice(ctx, it.cod), 2, 5)}`).join(' + ') + (itens.length > 10 ? ' + …' : '');
  const formula = itens.length ? `Custo unitário = soma de (coeficiente × preço unitário) = ${terms} = <b>${brl(unit)}</b>`
    : `Sem insumos detalhados: vale o preço de referência informado, <b>${brl(unit)}</b> por ${esc(c.un)}.`;
  const baseBtns = kind === 'orc'
    ? `${S.cpus.has(cod) ? `<button class="btn sm" data-act="compSync" data-cod="${esc(cod)}"${dis()}>Atualizar pela base</button>` : ''}<button class="btn sm" data-act="compToBase" data-cod="${esc(cod)}"${dis()}>Salvar na base</button>`
    : '';
  return `<section ${idAttr} class="panel${kind === 'orc' ? ' orc' : ''}">
    <div class="panel-head"><div class="grow">${crumbs}
      <div class="comp-hd"><span class="comp-cod">${esc(cod)}</span>
      <input class="cell plain comp-nome" id="cd-${esc(D)}" data-f="comp.desc" data-ctx="${kind}" data-cod="${esc(cod)}" value="${esc(c.desc)}" title="Nome da composição"${dis()}></div></div>
      <div class="kpis"><div class="kpi"><div class="lbl">Unidade</div>${kind === 'cat' ? `<input class="cell" id="cu-${esc(D)}" data-f="comp.un" data-ctx="${kind}" data-cod="${esc(cod)}" value="${esc(c.un)}" style="width:64px;font-size:15px;font-weight:700"${dis()}>` : `<div class="v" title="A unidade só muda na aba Composições">${esc(c.un)}</div>`}</div><div class="kpi"><div class="lbl">Custo unitário direto</div>${itens.length ? `<div class="v acc">${brl(unit)}</div>` : `<input class="cell num" id="cp-${esc(D)}" data-f="comp.pref" data-ctx="${kind}" data-cod="${esc(cod)}" value="${fmt(+c.pref || 0, 2, 5)}" style="width:140px;font-size:15px;font-weight:700" title="Sem insumos: informe o custo unitário"${dis()}>`}</div></div>
    </div>
    <div class="tbl-wrap mid"><table class="grid"><thead><tr><th>Tipo</th><th>Código</th><th>Descrição</th><th>Un</th><th class="num">Coeficiente</th><th class="num">Preço unit.</th><th class="num">Subtotal</th><th>Grupo</th><th>Cotação</th><th></th></tr></thead>
    <tbody>${trs || `<tr><td colspan="12" class="empty">Nenhum insumo nesta composição.</td></tr>`}</tbody></table></div>
    ${kind === 'orc' ? '' : `<div class="formula">${formula}</div>`}
    <div class="toolbar" style="border-top:1px solid var(--line);border-bottom:0"><button class="btn sm primary" data-act="ciAdd" data-ctx="${kind}" data-cod="${esc(cod)}"${dis()}>+ Adicionar insumo ou composição</button>
      <span class="spacer"></span>${baseBtns}</div>
  </section>`;
}

/* ===================== Seletor (busca em base e orçamento) ===================== */
function openPicker(opts) {
  S.pk = { ...opts, q: opts.q || '' };
  openModal(`<header><h2>${esc(opts.title)}</h2><button class="x" data-act="closeModal" aria-label="Fechar">×</button></header>
    <div class="body"><input class="search" id="pk-q" style="width:100%" placeholder="Buscar por código ou descrição" value="${esc(S.pk.q)}" autofocus>
    <div class="pk-list" id="pk-list">${pkList()}</div><p class="muted" style="margin:8px 0 0;font-size:11.5px">Clique para adicionar. A janela fica aberta para você incluir vários itens.</p></div>
    <footer>${opts.footer || ''}<span class="spacer"></span><button class="btn primary" data-act="closeModal">Concluir</button></footer>`, true);
}
function pkList() {
  const pk = S.pk; if (!pk) return '';
  const out = []; const seen = new Set(); const q = pk.q;
  for (const src of pk.sources) {
    const [scope, type] = src.split(':');
    const map = scope === 'cat' ? (type === 'cpu' ? S.cpus : S.ins) : (type === 'cpu' ? S.cur.comps : S.cur.ins);
    const ctx = scope === 'cat' ? (pk._cc = pk._cc || catCtx()) : S.lastB.ctx;
    let n = 0;
    for (const v of map.values()) {
      if (seen.has(type + v.cod) || !matchQ(q, v.cod, v.desc)) continue;
      seen.add(type + v.cod);
      out.push(`<div class="pk" data-act="pick" data-scope="${scope}" data-type="${type}" data-cod="${esc(v.cod)}"><span class="c-cod">${esc(v.cod)}</span><span class="d">${esc(v.desc)}</span><span>${esc(v.un)}</span><span class="num">${money(type === 'cpu' ? compUnit(ctx, v.cod) : insPrice(ctx, v.cod))}</span><span class="chip${scope === 'orc' ? ' acc' : ''}">${type === 'cpu' ? 'CPU' : 'Insumo'} ${scope === 'cat' ? 'base' : 'orç.'}</span></div>`);
      if (++n >= 150) break;
    }
  }
  return out.join('') || `<div class="empty">Nada encontrado${q ? ' para "' + esc(q) + '"' : ''}.</div>`;
}
function collectFrom(src, dst, cod, overwrite, acc = { comps: [], ins: [] }, seen = new Set()) {
  if (seen.has('c:' + cod)) return acc; seen.add('c:' + cod);
  const c = src.comps.get(cod); if (!c) return acc;
  if (overwrite || !dst.comps.has(cod)) acc.comps.push(clone(c));
  for (const it of c.itens || []) {
    if (it.t === 'c') collectFrom(src, dst, it.cod, overwrite, acc, seen);
    else if (!seen.has('i:' + it.cod)) { seen.add('i:' + it.cod); if (overwrite || !dst.ins.has(it.cod)) { const x = src.ins.get(it.cod); if (x) acc.ins.push(clone(x)); } }
  }
  return acc;
}
function copyFromBase(cod, overwrite) {
  const a = collectFrom({ comps: S.cpus, ins: S.ins }, { comps: S.cur.comps, ins: S.cur.ins }, cod, overwrite);
  if (a.comps.length) putComps(a.comps); if (a.ins.length) putInsOrc(a.ins); return a;
}
function copyToBase(cod) {
  const a = collectFrom({ comps: S.cur.comps, ins: S.cur.ins }, { comps: S.cpus, ins: S.ins }, cod, true);
  if (a.ins.length) putCatIns(a.ins); if (a.comps.length) putCatCpu(a.comps); return a;
}

/* ===================== Operações na EAP ===================== */
function sibsOf(par) { return childrenMap(S.cur.items).get(par || '') || []; }
function realPar(v) { return v && v.par && S.cur.items.has(v.par) ? v.par : ''; }
function insertPos(par, afterId) {
  const sibs = sibsOf(par);
  if (afterId) { const i = sibs.findIndex(s => s.id === afterId); if (i >= 0) { const a = sibs[i].pos, b = sibs[i + 1] ? sibs[i + 1].pos : a + 2; return (a + b) / 2; } }
  return sibs.length ? sibs[sibs.length - 1].pos + 1 : 1;
}
function targetFor(kind) {
  const s = S.cur.items.get(S.sel);
  if (kind === 'root') { let r = s; while (r && realPar(r)) r = S.cur.items.get(r.par); return { par: '', after: r ? r.id : null }; }
  if (!s) return { par: '', after: null };
  if (s.k === 'e') return { par: s.id, after: null };
  return { par: realPar(s), after: s.id };
}
function addItem(v, tgt) {
  const it = { id: uid(), par: tgt.par || '', pos: insertPos(tgt.par, tgt.after), det: '', ...v };
  putItems([it]); S.sel = it.id; S.compStack = []; if (tgt.par) S.collapsed.delete(tgt.par);
  S.focusNew = it.id; return it;
}
function subtreeIds(id) { const kids = childrenMap(S.cur.items); const out = []; (function w(x) { out.push(x); for (const c of kids.get(x) || []) w(c.id); })(id); return out; }

/* ===================== Tela: Insumos (base) ===================== */
function vIns() {
  if (!S.loaded.ins) return loading('insumos');
  const usage = new Map(); for (const c of S.cpus.values()) for (const it of c.itens || []) if (it.t !== 'c') usage.set(it.cod, (usage.get(it.cod) || 0) + 1);
  const all = [...S.ins.values()];
  const nOld = all.filter(x => ageDays(x.dt) > 180).length;
  let list = all.filter(x => matchQ(S.q.ins, x.cod, x.desc) && (!S.q.insGrp || x.grp === S.q.insGrp) && (!S.q.insOld || ageDays(x.dt) > 180))
    .sort((a, b) => a.cod.localeCompare(b.cod, 'pt-BR', { numeric: true }));
  const total = list.length; list = list.slice(0, 400);
  const rows = list.map(x => {
    const I = 'bi-' + x.cod;
    return `<tr><td class="c-cod">${esc(x.cod)}</td>
    <td class="c-desc"><input class="cell plain" id="${esc(I)}-d" data-f="ins.desc" data-ctx="cat" data-cod="${esc(x.cod)}" value="${esc(x.desc)}"${dis()}></td>
    <td style="width:64px"><input class="cell" id="${esc(I)}-u" data-f="ins.un" data-ctx="cat" data-cod="${esc(x.cod)}" value="${esc(x.un)}" style="width:56px"${dis()}></td>
    <td style="width:120px"><input class="cell num" id="${esc(I)}-p" data-f="ins.preco" data-ctx="cat" data-cod="${esc(x.cod)}" value="${fmt(+x.preco || 0, 2, 5)}"${dis()}></td>
    <td><select class="cell" data-f="ins.grp" data-ctx="cat" data-cod="${esc(x.cod)}"${dis()}>${GRUPOS.map(g => `<option${g === x.grp ? ' selected' : ''}>${g}</option>`).join('')}</select></td>
    <td><input class="cell" type="date" data-f="ins.dt" data-ctx="cat" data-cod="${esc(x.cod)}" value="${esc(x.dt || '')}" style="width:130px"${dis()}> ${ageDays(x.dt) > 180 ? `<span class="chip acc">${x.dt ? 'antiga' : 'sem data'}</span>` : ''}</td>
    <td><button class="x" data-act="insDel" data-cod="${esc(x.cod)}" title="Excluir insumo"${dis()}>×</button></td></tr>`;
  }).join('');
  return `<div class="page-head"><div><h1>Insumos gerais</h1><p>${S.ins.size} insumos · ${nOld} com cotação acima de 6 meses ou sem data</p></div>
    <div class="row"><button class="btn primary" data-act="insNew"${dis()}>Novo insumo</button></div></div>
    <div class="card"><div class="toolbar"><input class="search" id="q-ins" data-live="ins" placeholder="Buscar código ou descrição…" value="${esc(S.q.ins)}">
      <select class="search" style="width:auto" data-f="q.insGrp"><option value="">Todos os grupos</option>${GRUPOS.map(g => `<option${g === S.q.insGrp ? ' selected' : ''}>${g}</option>`).join('')}</select>
      <label class="row" style="gap:6px"><input type="checkbox" data-f="q.insOld"${S.q.insOld ? ' checked' : ''}> Só cotações antigas</label></div>
    <div class="tbl-wrap tall"><table class="grid"><thead><tr><th>Código</th><th>Descrição</th><th>Un</th><th class="num">Preço unit. (R$)</th><th>Grupo</th><th>Data da cotação</th><th></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="9" class="empty">${S.ins.size ? 'Nenhum insumo com esse filtro.' : 'A base está vazia. Cadastre insumos ou use a aba Importar.'}</td></tr>`}</tbody></table></div>
    ${total > 400 ? `<div class="check">Mostrando 400 de ${total}. Refine a busca para ver os demais.</div>` : ''}</div>`;
}
function modalIns(mode, extra = {}) {
  const maps = [S.ins]; if (S.cur) maps.push(S.cur.ins);
  const cod = nextCode('IM', maps);
  openModal(`<header><h2>Novo insumo</h2><button class="x" data-act="closeModal">×</button></header><div class="body"><div class="form">
    <label class="fld"><span class="lbl">Código</span><input id="n-cod" value="${esc(cod)}"></label>
    <label class="fld wide"><span class="lbl">Descrição</span><input id="n-desc" value="${esc(extra.desc || '')}" autofocus></label>
    <label class="fld"><span class="lbl">Unidade</span><input id="n-un" value="un"></label>
    <label class="fld"><span class="lbl">Preço unitário (R$)</span><input id="n-preco" value="0,00"></label>
    <label class="fld"><span class="lbl">Grupo</span><select id="n-grp">${GRUPOS.map(g => `<option>${g}</option>`).join('')}</select></label>
    <label class="fld"><span class="lbl">Data da cotação</span><input id="n-dt" type="date" value="${today()}"></label>
    ${mode === 'ci' && extra.kind === 'orc' ? `<label class="fld wide row" style="flex-direction:row;gap:8px"><input type="checkbox" id="n-base" checked> Também cadastrar na base de insumos</label>` : ''}
  </div></div><footer><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="insCreate" data-mode="${mode}" data-kind="${extra.kind || ''}" data-cod="${esc(extra.comp || '')}">Salvar insumo</button></footer>`);
}

/* ===================== Tela: Composições (base) ===================== */
function vCpus() {
  if (!S.loaded.cpus) return loading('composições');
  const ctx = catCtx();
  let list = [...S.cpus.values()].filter(c => matchQ(S.q.cpu, c.cod, c.desc)).sort((a, b) => a.cod.localeCompare(b.cod, 'pt-BR', { numeric: true }));
  const total = list.length; list = list.slice(0, 300);
  const left = list.map(c => `<div class="list-row${S.selCpu === c.cod ? ' on' : ''}" data-act="cpuSel" data-cod="${esc(c.cod)}"><span class="c-cod">${esc(c.cod)}</span><span class="d">${esc(c.desc)}</span><span class="num">${money(compUnit(ctx, c.cod))}<span class="muted">/${esc(c.un)}</span></span></div>`).join('');
  let right = `<div class="panel"><div class="empty">Selecione uma composição à esquerda ou crie uma nova.</div></div>`;
  if (S.selCpu && S.cpus.has(S.selCpu)) {
    const users = [...S.cpus.values()].filter(c => (c.itens || []).some(it => it.t === 'c' && it.cod === S.selCpu)).map(c => c.cod);
    right = `<div class="stack"><div class="row"><span class="muted">${users.length ? 'Usada como auxiliar em: ' + users.map(esc).join(', ') : 'Não é usada como auxiliar em outras composições.'}</span><span class="spacer"></span>
      <button class="btn sm" data-act="cpuDup" data-cod="${esc(S.selCpu)}"${dis()}>Duplicar</button><button class="btn sm danger" data-act="cpuDel" data-cod="${esc(S.selCpu)}"${dis()}>Excluir</button></div>
      ${compEditor('cat', S.selCpu)}</div>`;
  }
  return `<div class="page-head"><div><h1>Base de composições</h1><p>${S.cpus.size} composições (CPU)</p></div>
    <div class="row"><button class="btn primary" data-act="cpuNew"${dis()}>Nova composição</button></div></div>
    <div class="split"><div class="card"><div class="toolbar"><input class="search" id="q-cpu" data-live="cpu" placeholder="Buscar composição…" value="${esc(S.q.cpu)}" style="width:100%"></div>
      <div style="max-height:70vh;overflow:auto">${left || `<div class="empty">${S.cpus.size ? 'Nada encontrado.' : 'Nenhuma composição cadastrada.'}</div>`}</div>${total > 300 ? `<div class="check">Mostrando 300 de ${total}.</div>` : ''}</div>
    <div>${right}</div></div>`;
}
function modalCpu() {
  const maps = [S.cpus]; if (S.cur) maps.push(S.cur.comps);
  openModal(`<header><h2>Nova composição</h2><button class="x" data-act="closeModal">×</button></header><div class="body"><div class="form">
    <label class="fld"><span class="lbl">Código</span><input id="n-cod" value="${esc(nextCode('CPU', maps))}"></label>
    <label class="fld wide"><span class="lbl">Descrição</span><input id="n-desc" autofocus></label>
    <label class="fld"><span class="lbl">Unidade</span><input id="n-un" value="un"></label></div></div>
    <footer><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="cpuCreate">Criar</button></footer>`);
}

/* ===================== Tela: Indicadores ===================== */
function abc(list) {
  const tot = list.reduce((s, x) => s + x.total, 0); const l = [...list].sort((a, b) => b.total - a.total); let acc = 0;
  l.forEach(x => { const p = tot ? x.total / tot : 0; x.p = p; x.before = acc; acc += p; x.acc = acc; x.cls = x.before < 0.8 - 1e-9 ? 'A' : x.before < 0.95 - 1e-9 ? 'B' : 'C'; });
  l.tot = tot; return l;
}
function indicators(B) {
  const ctx = B.ctx; const acc = new Map(); const servs = [];
  for (const r of B.rows) if (r.v.k === 's') { servs.push({ n: r.n, cod: r.v.cod || '', desc: r.v.desc, un: r.v.un, q: +r.v.qtd || 0, pu: r.unit, total: r.total }); if (r.v.cod) explode(ctx, r.v.cod, +r.v.qtd || 0, acc); }
  const insl = [];
  for (const [k, q] of acc) {
    if (k[0] === '§') { const c = ctx.comps.get(k.slice(1)) || {}; const pu = +c.pref || 0; insl.push({ cod: k.slice(1), desc: (c.desc || '') + ' (preço de referência)', un: c.un || '', q, pu, total: q * pu, grp: 'Sem detalhamento' }); }
    else { const x = ctx.ins.get(k) || {}; const pu = insPrice(ctx, k); insl.push({ cod: k, desc: x.desc || '(insumo não cadastrado)', un: x.un || '', q, pu, total: q * pu, grp: x.grp || 'Sem cadastro' }); }
  }
  const grp = new Map(); insl.forEach(x => grp.set(x.grp, (grp.get(x.grp) || 0) + x.total));
  return { servs: abc(servs), ins: abc(insl), grp: [...grp].sort((a, b) => b[1] - a[1]), sumIns: insl.reduce((s, x) => s + x.total, 0) };
}
function abcCurve(l) {
  if (!l.length) return '';
  const W = 640, H = 170, pl = 40, pr = 10, pt = 10, pb = 24; const n = l.length;
  const x = i => pl + (n === 1 ? (W - pl - pr) : (i / (n - 1)) * (W - pl - pr)); const y = p => pt + (1 - p) * (H - pt - pb);
  const pts = l.map((d, i) => `${x(i).toFixed(1)},${y(d.acc).toFixed(1)}`).join(' ');
  const grid = [0, .5, .8, .95, 1].map(p => `<line x1="${pl}" x2="${W - pr}" y1="${y(p)}" y2="${y(p)}" stroke="var(--line-2)" stroke-dasharray="${p === .8 || p === .95 ? '4 3' : '0'}" stroke-width="1"/>` + (p === .95 ? '' : `<text x="${pl - 6}" y="${y(p) + 3.5}" text-anchor="end" font-size="10" fill="var(--muted)">${Math.round(p * 100)}%</text>`)).join('') + `<text x="${W - pr}" y="${y(.95) + 11}" text-anchor="end" font-size="10" fill="var(--muted)">95% (limite B)</text><text x="${W - pr}" y="${y(.8) + 11}" text-anchor="end" font-size="10" fill="var(--muted)">80% (limite A)</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;display:block" role="img" aria-label="Curva ABC acumulada">${grid}
    <polyline points="${pl},${y(0)} ${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/><circle cx="${x(n - 1)}" cy="${y(1)}" r="3" fill="var(--accent)"/>
    <text x="${pl}" y="${H - 6}" font-size="10" fill="var(--muted)">1º item</text><text x="${W - pr}" y="${H - 6}" font-size="10" fill="var(--muted)" text-anchor="end">${n}º item</text></svg>`;
}
function abcTable(l, kind) {
  const sum = { A: [0, 0], B: [0, 0], C: [0, 0] }; l.forEach(x => { sum[x.cls][0]++; sum[x.cls][1] += x.p; });
  const rows = l.slice(0, 60).map((x, i) => `<tr><td class="num">${i + 1}</td>${kind === 's' ? `<td class="c-n">${x.n}</td>` : ''}<td class="c-cod">${esc(x.cod)}</td><td class="c-desc" style="white-space:normal">${esc(x.desc)}</td><td>${esc(x.un)}</td><td class="num">${fmt(x.q, 2, 4)}</td><td class="num">${money(x.pu)}</td><td class="num">${money(x.total)}</td><td class="num">${pctf(x.p)}</td><td class="num">${pctf(x.acc)}</td><td><span class="cls ${x.cls}">${x.cls}</span></td></tr>`).join('');
  return `<div class="row" style="padding:10px 14px;gap:18px">${['A', 'B', 'C'].map(c => `<span><span class="cls ${c}">${c}</span> ${sum[c][0]} itens · ${pctf(sum[c][1], 1)} do custo</span>`).join('')}</div>
    <div style="padding:0 14px 10px">${abcCurve(l)}</div>
    <div class="tbl-wrap mid"><table class="grid"><thead><tr><th class="num">#</th>${kind === 's' ? '<th>Item</th>' : ''}<th>Código</th><th>Descrição</th><th>Un</th><th class="num">Qtde</th><th class="num">${kind === 's' ? 'Custo unit.' : 'Preço unit.'}</th><th class="num">Total</th><th class="num">%</th><th class="num">% acum.</th><th>Classe</th></tr></thead><tbody>${rows || `<tr><td colspan="11" class="empty">Sem dados.</td></tr>`}</tbody></table></div>
    ${l.length > 60 ? `<div class="check">Mostrando os 60 primeiros de ${l.length}. O Excel traz a lista completa.</div>` : ''}`;
}
function vInd() {
  if (!S.cur.loaded) return loading('indicadores');
  const B = computeBudget(); S.lastB = B; const m = B.meta; const I = indicators(B); const T = B.total;
  const ac = +m.areaConst || 0, ap = +m.areaPriv || 0, uh = +m.uh || 0, pz = +m.prazo || 0, at = +m.areaTerreno || 0;
  const kb = (l, v, s) => `<div class="kbox"><div class="lbl">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  const etapas = B.rows.filter(r => r.depth === 0); const maxE = Math.max(...etapas.map(r => r.total), 0);
  const bars = etapas.map((r, i) => `<div class="bar${i === etapas.reduce((bi, x, j) => x.total > etapas[bi].total ? j : bi, 0) ? ' lead' : ''}"><span class="n">${r.n} ${esc(r.v.desc)}</span><span class="t"><i style="width:${maxE ? (r.total / maxE * 100).toFixed(2) : 0}%"></i></span><span class="num">${brl(r.total)}</span><span class="num p">${T ? pctf(r.total / T, 1) : '–'}</span></div>`).join('');
  const maxG = Math.max(...I.grp.map(g => g[1]), 0);
  const gbars = I.grp.map(([g, v], i) => `<div class="bar${i === 0 ? ' lead' : ''}"><span class="n">${esc(g)}</span><span class="t"><i style="width:${maxG ? (v / maxG * 100).toFixed(2) : 0}%"></i></span><span class="num">${brl(v)}</span><span class="num p">${T ? pctf(v / T, 1) : '–'}</span></div>`).join('');
  const diff = I.sumIns - T;
  return `<div class="page-head"><div><h1>Indicadores</h1><p>${esc(idOrc(m))}</p></div></div>
  <div class="stack">
  <div class="kgrid">
    ${kb('Custo direto', brl(T), `BDI de ${pctf(B.bdi)}`)}${kb('Preço de venda', brl(B.venda), 'Custo direto × (1 + BDI)')}
    ${kb('Custo por m² de área construída', ac ? brl(T / ac) : '–', ac ? `${fmt(ac)} m² · venda ${brl(B.venda / ac)}/m²` : 'Informe a área em Dados e BDI')}
    ${kb('Custo por m² de área privativa', ap ? brl(T / ap) : '–', ap ? `${fmt(ap)} m² · venda ${brl(B.venda / ap)}/m²` : 'Informe a área em Dados e BDI')}
    ${kb('Custo por unidade (UH)', uh ? brl(T / uh) : '–', uh ? `${fmt(uh, 0, 0)} unidades` : 'Informe as UH em Dados e BDI')}
    ${kb('Relação AP / AC', ac && ap ? pctf(ap / ac, 1) : '–', ac && at ? `Área construída / terreno: ${fmt(ac / at, 2, 2)}` : '')}
    ${kb('Preço de venda médio mensal', pz ? brl(B.venda / pz) : '–', pz ? `Prazo de ${fmt(pz, 0, 1)} meses` : 'Informe o prazo em Dados e BDI')}
  </div>
  <div class="two"><div class="card pad"><h2 style="margin-bottom:12px">Custo por etapa</h2><div class="bars">${bars || '<span class="muted">Sem etapas.</span>'}</div></div>
    <div class="card pad"><h2 style="margin-bottom:12px">Custo por grupo de insumo</h2><div class="bars">${gbars || '<span class="muted">Sem insumos.</span>'}</div>
    <p class="muted" style="font-size:11.5px;margin:10px 0 0">Grupos a partir da explosão das composições (quantidade do serviço × coeficientes, incluindo auxiliares).</p></div></div>
  <div class="card"><div class="pad" style="padding-bottom:0"><h2>Curva ABC de serviços</h2></div>${abcTable(I.servs, 's')}</div>
  <div class="card"><div class="pad" style="padding-bottom:0"><h2>Curva ABC de insumos</h2></div>${abcTable(I.ins, 'i')}
    <div class="check">Conferência: soma dos insumos explodidos = ${brl(I.sumIns)} · custo direto da planilha = ${brl(T)} · diferença ${brl(diff)} ${Math.abs(diff) < 0.01 ? '(confere)' : '<span class="warn">(verificar composições sem insumo cadastrado)</span>'}</div></div>
  </div>`;
}
