/* ===================== Formação de preço (modelo Unità) ===================== */
function precoUnita(B, m) {
  const b = (m && m.bdi) || {}; const pc = x => (+x || 0) / 100; const S1 = B.total;
  const adm = pc(b.adm) * S1, assist = pc(b.assist) * S1, S2 = S1 + adm + assist;
  const t = pc(b.ir) + pc(b.iss) + pc(b.pis) + pc(b.cofins) + pc(b.cssl);
  const base = (b.base || []).reduce((s, id) => s + ((B.byId.get(id) || {}).total || 0), 0);
  const imp = t < 1 ? t * base / (1 - t) : 0; const S3 = S2 + imp;
  const t2 = t - pc(b.iss); const imp2 = t2 < 1 ? t2 * base / (1 - t2) : 0;
  return { S1, adm, assist, S2, t, base, imp, S3, t2, imp2, desc: imp2 - imp, S4: S2 + imp2 };
}

/* ===================== Dados do orçamento (modal com abas) ===================== */
const METODOS = ['Alvenaria autoportante', 'Estrutura convencional', 'Parede de concreto', 'Misto'];
function metaForm(m, isNew) {
  const f = (id, l, v, t = 'text', ex = '') => `<label class="fld"><span class="lbl">${l}</span><input id="${id}" type="${t}" value="${esc(v ?? '')}" ${ex}></label>`;
  const s = (id, l, v, opts) => `<label class="fld"><span class="lbl">${l}</span><select id="${id}">${opts.map(o => `<option${norm(o) === norm(v) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  const nf = (v, d = 2) => v || v === 0 ? fmt(+v, 0, d) : '';
  const b = m.bdi || { modo: 'direto', valor: 0 };
  const tab = S._mfTab && S._mfTab !== 'emp' ? S._mfTab : 'geral';
  const T = (k, l) => `<button class="btn sm${tab === k ? ' primary' : ''}" data-act="mfTab" data-v="${k}">${l}</button>`;
  const sec = (k, html) => `<div data-mf="${k}"${tab === k ? '' : ' hidden'}>${html}</div>`;
  const B = !isNew && S.cur && S.cur.id === m.id ? computeBudget() : null;
  S._mf = { base: new Set(b.base || []), inst: new Set((m.inst || {}).itens || []), ind: (m.tx || {}).ind || '', B };
  const etapas = B ? B.rows.filter(r => r.depth === 0) : [];
  const indDefault = S._mf.ind || ((etapas.find(e => /INDIRET/i.test(e.v.desc)) || {}).v || {}).id || '';
  S._mf.ind = indDefault;
  const cand = B ? B.rows.filter(r => r.v.k === 's' && r.depth <= 1) : [];
  const baseList = cand.map(r => `<label class="row" style="gap:6px;flex-wrap:nowrap"><input type="checkbox" data-f="mf.base" data-id="${r.v.id}"${S._mf.base.has(r.v.id) ? ' checked' : ''}><span class="c-n">${r.n}</span><span style="flex:1">${esc(r.v.desc)}</span><span class="num">${money(r.total)}</span></label>`).join('');
  const G = t => `<h3 class="fgrp wide">${t}</h3>`;
  return `<div class="row" style="margin-bottom:12px">${T('geral', 'Geral')}${T('preco', 'Formação de preço')}${T('cli', 'Planilha do cliente')}</div>
  ${sec('geral', `<div class="form">
    ${isNew ? `<label class="fld wide"><span class="lbl">Duplicar de um orçamento existente</span><select id="m-dup"><option value="">Não, começar em branco</option>${[...S.orcs.values()].sort((x, y) => String(y.atualizado || '').localeCompare(String(x.atualizado || ''))).map(o => `<option value="${esc(o.id)}"${S._dup === o.id ? ' selected' : ''}>${esc(idOrc(o))}</option>`).join('')}</select></label>` : ''}
    ${G('Identificação')}
    ${f('m-codigo', 'Código', m.codigo, 'text', 'autofocus')}${f('m-revisao', 'Revisão', m.revisao || 'R00', 'text', 'data-nome="1"')}${s('m-tipo', 'Fase orçamentária', m.tipo || 'Executivo', TIPOS_ORC)}${s('m-status', 'Status', m.status || 'Em elaboração', STATUS)}
    ${f('m-empreendimento', 'Empreendimento', m.empreendimento, 'text', 'data-nome="1"').replace('class="fld"', 'class="fld span2"')}${f('m-cliente', 'Cliente', m.cliente, 'text', 'data-nome="1"')}${f('m-abrev', 'Nome curto nas abas', m.abrev, 'text', 'maxlength="21" title="Até 21 letras, usado nos nomes das abas da planilha do cliente"')}
    <div class="fld span3"><span class="lbl">Nome do orçamento (empreendimento - cliente)</span><div class="nome-prev" id="m-nome-prev">${esc(nomeOrc(m) || '–')}</div></div>
    ${G('Datas e prazo')}
    <label class="fld"><span class="lbl">Data-base (INCC-DI)</span><span class="row" style="flex-wrap:nowrap;gap:6px"><input id="m-dataBase" value="${esc(mmaa(m.inccData || (m.dataBase || '').slice(0, 7)))}" placeholder="MM/AA" maxlength="5" style="width:76px" data-incc="1"><input id="m-incc" value="${m.incc ? fmt(+m.incc, 3, 3) : ''}" placeholder="Índice" style="flex:1;min-width:0" title="Índice INCC-DI do mês; preenchido pela série da aba INCC"></span><span class="muted" id="m-incc-msg" style="font-size:11px"></span></label>
    ${f('m-elaboracao', 'Data de elaboração', m.elaboracao || today(), 'date')}${f('m-inicioObra', 'Início da obra', m.inicioObra || '', 'date')}${f('m-prazo', 'Prazo de execução (meses)', nf(m.prazo, 1))}
    ${G('Localização e características')}
    <label class="fld wide"><span class="lbl">Endereço</span><input id="m-endereco" value="${esc(m.endereco || '')}"></label>
    ${f('m-cidade', 'Cidade/UF', m.cidade)}${s('m-metodo', 'Método construtivo', m.metodo || 'Misto', METODOS)}${f('m-tipologia', 'Tipologia', m.tipologia)}${f('m-obra', 'Observação da obra', m.obra)}
    ${G('Quantitativos')}
    ${f('m-torres', 'Nº de torres', nf(m.torres, 0))}${f('m-elevadores', 'Nº de elevadores', nf(m.elevadores, 0))}${f('m-vagas', 'Total de vagas', nf(m.vagas, 0))}${f('m-uh', 'Unidades (UH)', nf(m.uh, 0))}
    ${f('m-areaConst', 'Área construída (m²)', nf(m.areaConst))}${f('m-areaPriv', 'Área privativa (m²)', nf(m.areaPriv))}${f('m-areaTerreno', 'Área do terreno (m²)', nf(m.areaTerreno))}
  </div>`)}
  ${sec('preco', `<div class="row" style="gap:14px">
      <label><input type="radio" name="bdimodo" value="unita" data-act="bdiModo"${b.modo === 'unita' ? ' checked' : ''}> Taxas + impostos (resumo de preço Unità)</label>
      <label><input type="radio" name="bdimodo" value="direto" data-act="bdiModo"${!b.modo || b.modo === 'direto' ? ' checked' : ''}> BDI informado</label>
      <label><input type="radio" name="bdimodo" value="tcu" data-act="bdiModo"${b.modo === 'tcu' ? ' checked' : ''}> BDI pela fórmula TCU</label></div>
    <div id="bdi-direto"${b.modo && b.modo !== 'direto' ? ' hidden' : ''} style="margin-top:12px"><div class="form">${f('b-valor', 'BDI (%)', fmt(+b.valor || 0, 2, 2), 'text', 'data-bdi="1"')}</div></div>
    <div id="bdi-tcu"${b.modo !== 'tcu' ? ' hidden' : ''} style="margin-top:12px"><div class="form">
      ${[['ac', 'Administração central (AC)'], ['s', 'Seguros (S)'], ['r', 'Riscos (R)'], ['g', 'Garantias (G)'], ['df', 'Despesas financeiras (DF)'], ['l', 'Lucro (L)'], ['i', 'Tributos (I)']].map(([k, l]) => f('b-' + k, l + ' %', fmt(+b[k] || 0, 2, 2), 'text', 'data-bdi="1"')).join('')}</div></div>
    <div id="bdi-unita"${b.modo !== 'unita' ? ' hidden' : ''} style="margin-top:12px"><div class="form">
      ${f('b-adm', 'Taxa de administração (%)', fmt(+b.adm || 0, 2, 4), 'text', 'data-bdi="1"')}${f('b-assist', 'Assistência técnica (%)', fmt(+b.assist || 0, 2, 4), 'text', 'data-bdi="1"')}
      ${[['ir', 'IR'], ['iss', 'ISS'], ['pis', 'PIS'], ['cofins', 'COFINS'], ['cssl', 'CSLL']].map(([k, l]) => f('b-' + k, l + ' (%)', fmt(+b[k] || 0, 2, 4), 'text', 'data-bdi="1"')).join('')}
      <label class="fld wide row" style="flex-direction:row;gap:8px"><input type="checkbox" id="b-beneficio"${b.beneficio ? ' checked' : ''}> Mostrar o bloco de impostos com benefício fiscal (desconto de ISS) na planilha do cliente</label>
      <label class="fld wide"><span class="lbl">Observação do benefício fiscal</span><textarea id="b-obs" rows="2">${esc(b.obs || '')}</textarea></label></div>
      <h3 style="margin:12px 0 6px">Base de incidência dos impostos</h3>
      <p class="muted" style="margin:0 0 6px;font-size:11.5px">Marque os itens de mão de obra CLT (normalmente mão de obra indireta CLT e mão de obra direta). Impostos = alíquota × base ÷ (1 − alíquota).</p>
      ${B ? `<div class="pk-list" style="max-height:220px;padding:6px 10px;display:flex;flex-direction:column;gap:4px">${baseList || '<span class="muted">Sem itens.</span>'}</div>` : '<p class="muted">Disponível depois que a planilha tiver itens.</p>'}</div>
    <div class="formula-big" id="bdi-res"></div>`)}
  ${sec('cli', B ? `<h3 style="margin-bottom:6px">Grupos do resumo de preço</h3><p class="muted" style="margin:0 0 8px;font-size:11.5px">Etapas com o mesmo nome de grupo somam numa linha de CUSTOS DIRETOS. A etapa marcada como indireta aparece item a item em CUSTOS INDIRETOS.</p>
    <div class="tbl-wrap" style="max-height:300px"><table class="grid"><thead><tr><th>Item</th><th>Etapa</th><th>Grupo no resumo</th><th>Indireta</th><th class="num">Custo</th></tr></thead><tbody>
    ${etapas.map(e => `<tr><td class="c-n">${e.n}</td><td>${esc(e.v.desc)}</td><td><input class="cell" data-grp="${e.v.id}" value="${esc(((m.tx || {}).grupos || {})[e.v.id] || e.v.desc)}"></td><td style="text-align:center"><input type="radio" name="mf-ind" data-f="mf.ind" data-id="${e.v.id}"${indDefault === e.v.id ? ' checked' : ''}></td><td class="num">${money(e.total)}</td></tr>`).join('')}
    <tr><td></td><td class="muted">Nenhuma etapa indireta</td><td></td><td style="text-align:center"><input type="radio" name="mf-ind" data-f="mf.ind" data-id=""${!indDefault ? ' checked' : ''}></td><td></td></tr></tbody></table></div>
    <h3 style="margin:14px 0 6px">Custo de instalações</h3>
    <div class="form"><label class="fld wide"><span class="lbl">Título da aba</span><input id="m-instTitulo" value="${esc((m.inst || {}).titulo || 'INFRAESTRUTURA + UNIDADES')}"></label></div>
    <div id="mf-inst-sel" style="margin-top:8px">${instSel()}</div>
    <input class="search" id="mf-inst-q" style="width:100%;margin-top:8px" placeholder="Buscar item para incluir (número ou descrição)"><div id="mf-inst-res" class="pk-list" style="max-height:200px"></div>` : '<p class="muted">Disponível depois que a planilha tiver itens.</p>')}`;
}
function instSel() {
  const B = S._mf && S._mf.B; if (!B) return '';
  const rows = [...S._mf.inst].map(id => B.byId.get(id)).filter(Boolean).sort((a, b) => a.idx - b.idx);
  return rows.length ? rows.map(r => `<div class="row" style="flex-wrap:nowrap;padding:3px 0"><span class="c-n">${r.n}</span><span style="flex:1">${esc(r.v.desc)}</span><span class="num">${money(r.total)}</span><button class="x" data-act="mfInstDel" data-id="${r.v.id}">×</button></div>`).join('') + `<div class="check" style="padding-left:0">Total ${brl(rows.reduce((s, r) => s + r.total, 0))}</div>` : '<span class="muted">Nenhum item selecionado.</span>';
}
function instRes(q) {
  const B = S._mf && S._mf.B; if (!B || !q) return '';
  return B.rows.filter(r => !S._mf.inst.has(r.v.id) && matchQ(q, r.n, r.v.desc, r.v.cod)).slice(0, 60).map(r => `<div class="pk" data-act="mfInstAdd" data-id="${r.v.id}" style="grid-template-columns:110px 1fr 120px"><span class="c-n">${r.n}</span><span class="d">${esc(r.v.desc)}</span><span class="num">${money(r.total)}</span></div>`).join('') || '<div class="empty">Nada encontrado.</div>';
}
function readMetaForm() {
  const v = id => (($('#' + id) || {}).value ?? '');
  const n = id => { const x = parseNum(v(id)); return Number.isFinite(x) ? x : 0; };
  const modo = (document.querySelector('input[name=bdimodo]:checked') || {}).value || 'direto';
  const out = {
    codigo: v('m-codigo').trim(), revisao: v('m-revisao').trim() || 'R00', empreendimento: v('m-empreendimento').trim(), cliente: v('m-cliente').trim(), abrev: v('m-abrev').trim(), obra: v('m-obra').trim(),
    tipo: v('m-tipo'), status: v('m-status'), elaboracao: v('m-elaboracao'), inicioObra: v('m-inicioObra'),
    endereco: v('m-endereco').trim(), cidade: v('m-cidade').trim(), metodo: v('m-metodo'), tipologia: v('m-tipologia').trim(), torres: n('m-torres'), elevadores: n('m-elevadores'), vagas: n('m-vagas'),
    uh: n('m-uh'), areaConst: n('m-areaConst'), areaPriv: n('m-areaPriv'), areaTerreno: n('m-areaTerreno'), prazo: n('m-prazo'), incc: n('m-incc'),
    bdi: { modo, valor: n('b-valor'), ac: n('b-ac'), s: n('b-s'), r: n('b-r'), g: n('b-g'), df: n('b-df'), l: n('b-l'), i: n('b-i'), adm: n('b-adm'), assist: n('b-assist'), ir: n('b-ir'), iss: n('b-iss'), pis: n('b-pis'), cofins: n('b-cofins'), cssl: n('b-cssl'), beneficio: !!($('#b-beneficio') || {}).checked, obs: v('b-obs'), base: S._mf ? [...S._mf.base] : [] }
  };
  out.revisaoNum = parseInt(out.revisao.replace(/\D/g, ''), 10) || 0;
  const ym = mmaaParse(v('m-dataBase')); out.inccData = ym || ''; out.dataBase = ym ? ym + '-01' : '';
  out.nome = nomeOrc(out); out.encargos = 0;
  if (S._mf && S._mf.B) {
    const grupos = {}; (document.querySelector('#modal .mf-root') || document).querySelectorAll('[data-grp]').forEach(el => { grupos[el.dataset.grp] = el.value.trim(); });
    out.tx = { grupos, ind: S._mf.ind || '' }; out.inst = { titulo: v('m-instTitulo').trim() || 'INFRAESTRUTURA + UNIDADES', itens: [...S._mf.inst] };
  }
  return out;
}
function updBdiRes() {
  const el = $('#bdi-res'); if (!el) return;
  const m = readMetaForm(); const b = m.bdi;
  if (b.modo === 'tcu') { const val = bdiValue({ bdi: b }); el.innerHTML = `BDI = [(1 + AC + S + R + G) × (1 + DF) × (1 + L) ÷ (1 − I)] − 1 = [(1 + ${fmt(b.ac)}% + ${fmt(b.s)}% + ${fmt(b.r)}% + ${fmt(b.g)}%) × (1 + ${fmt(b.df)}%) × (1 + ${fmt(b.l)}%) ÷ (1 − ${fmt(b.i)}%)] − 1 = <b>${pctf(val)}</b>`; return; }
  if (b.modo === 'direto') { el.innerHTML = `Preço de venda = custo direto × (1 + ${fmt(b.valor)}%)`; return; }
  const B = S._mf && S._mf.B; if (!B) { el.innerHTML = 'Os valores aparecem depois que a planilha tiver itens.'; return; }
  const p = precoUnita(B, { bdi: b });
  el.innerHTML = `Subtotal 01 (custo raso) = <b>${brl(p.S1)}</b><br>+ administração ${fmt(b.adm, 2, 4)}% = ${brl(p.adm)} · + assistência técnica ${fmt(b.assist, 2, 4)}% = ${brl(p.assist)} → Subtotal 02 = <b>${brl(p.S2)}</b><br>
    Impostos = ${pctf(p.t)} × base ${brl(p.base)} ÷ (1 − ${pctf(p.t)}) = ${brl(p.imp)} → Subtotal 03 (preço de venda) = <b>${brl(p.S3)}</b><br>
    Com benefício fiscal (sem ISS): impostos ${brl(p.imp2)} → Subtotal 04 = ${brl(p.S4)} · Taxa equivalente sobre o custo raso: <b>${pctf(p.S1 ? p.S3 / p.S1 - 1 : 0)}</b>`;
}
function mmaaParse(t) { const r = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(t || ''); if (!r) return ''; const mo = +r[1]; if (mo < 1 || mo > 12) return ''; const y = r[2].length === 2 ? '20' + r[2] : r[2]; return `${y}-${String(mo).padStart(2, '0')}`; }
async function updInccModal() {
  const el = $('#m-dataBase'), msg = $('#m-incc-msg'); if (!el || !msg) return;
  const ym = mmaaParse(el.value); if (!ym) { msg.textContent = el.value.trim() ? 'Use o formato MM/AA.' : ''; return; }
  await loadIncc(); const v = inccDe(ym);
  if (v) { $('#m-incc').value = fmt(v, 3, 3); msg.textContent = 'Índice da série INCC.'; } else msg.textContent = 'Mês fora da série INCC: informe o índice.';
}
function modalMeta(id, dupId) {
  const isNew = !id; S._mfTab = S._mfTab || 'geral'; if (isNew) S._mfTab = 'geral'; S._dup = isNew ? (dupId || '') : '';
  const src = dupId && S.orcs.get(dupId);
  const m = !isNew ? { ...S.orcs.get(id), id } : src ? { ...clone(src), id: undefined, codigo: src.codigo, status: 'Em elaboração' } : { codigo: '', revisao: 'R00', status: 'Em elaboração', tipo: 'Executivo', bdi: { modo: 'unita', adm: 8, assist: 1, ir: 6, iss: 0, pis: 0.65, cofins: 3, cssl: 2.88, base: [] } };
  openModal(`<header><h2>${isNew ? 'Novo orçamento' : 'Dados do orçamento'}</h2><button class="x" data-act="closeModal" aria-label="Fechar">×</button></header>
    <div class="body mf-root">${metaForm(m, isNew)}</div>
    <footer>${isNew ? '' : `<button class="btn" data-act="syncAllPrices">Atualizar preços dos insumos pela base</button><span class="spacer"></span>`}
    <button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="saveMeta" data-id="${esc(id || '')}"${dis()}>${isNew ? (src ? 'Criar cópia' : 'Criar orçamento') : 'Salvar'}</button></footer>`, true);
  updBdiRes(); if (!(m.incc)) updInccModal();
}

/* ===================== Tela: Dados do orçamento ===================== */
function vDados() {
  const id = S.cur.id, meta = S.orcs.get(id);
  if (!meta) return `<div class="card empty">Este orçamento foi excluído.</div>`;
  if (!S.cur.loaded) return loading('orçamento');
  S._mfTab = S._mfTab || 'geral';
  setTimeout(() => { updBdiRes(); if (!meta.incc) updInccModal(); }, 0);
  return `<div class="page-head"><div><h1>Dados do orçamento</h1><p>${esc(idOrc(meta))}</p></div>
    <div class="row"><button class="btn ghost" data-act="tab" data-v="orcs">← Voltar</button><button class="btn" data-act="syncAllPrices"${dis()}>Atualizar preços dos insumos pela base</button><button class="btn" data-act="dadosDesc">Descartar alterações</button><button class="btn primary" data-act="saveMeta" data-id="${esc(id)}"${dis()}>Salvar</button></div></div>
    <div class="card mf-root" data-id="${esc(id)}">${metaForm({ ...meta, id }, false)}</div>`;
}

