/* ===================== Ações ===================== */
const rerender = () => setTimeout(render, 0);
function confirmBox(title, text, okLabel, fn) {
  S._confirm = fn;
  openModal(`<header><h2>${esc(title)}</h2><button class="x" data-act="closeModal">×</button></header><div class="body"><p style="margin:0">${text}</p></div>
    <footer><button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="confirmOk">${esc(okLabel)}</button></footer>`);
}
const ACT = {
  tab(el, e) {
    e.preventDefault(); const v = el.dataset.v; if (['plan', 'dados', 'ind', 'docs'].includes(v) && !S.cur) return;
    const go = () => { S._dadosDirty = false; S.view = v; render(); window.scrollTo(0, 0); };
    if (S.view === 'dados' && v !== 'dados' && S._dadosDirty) { confirmBox('Alterações não salvas', 'Os dados do orçamento têm alterações que ainda não foram salvas. Deseja sair e descartar?', 'Descartar e sair', go); return; }
    go();
  },
  dadosDesc() { S._dadosDirty = false; render(); toast('Alterações descartadas.'); },
  editOrc(el) { const o = S.orcs.get(el.dataset.id); if (!o) return; if (norm(o.status || 'Em elaboração') !== norm('Em elaboração')) { toast('Edição disponível apenas com status Em elaboração.', 'err'); return; } openBudget(o.id); S._mfTab = 'geral'; S._dadosDirty = false; S.view = 'dados'; render(); window.scrollTo(0, 0); },
  bgClose(el, e) { if (e.target === el) closeModal(); },
  closeModal() { closeModal(); },
  confirmOk() { const f = S._confirm; closeModal(); S._confirm = null; if (f) f(); },

  /* orçamentos */
  newOrc() { modalMeta(null); },
  params() { S.view = 'dados'; render(); },
  bdiModo(el) { ['direto', 'tcu', 'unita'].forEach(k => { const x = $('#bdi-' + k); if (x) x.hidden = el.value !== k; }); updBdiRes(); },
  mfTab(el) { S._mfTab = el.dataset.v; const R = el.closest('.mf-root') || document; R.querySelectorAll('[data-mf]').forEach(x => x.hidden = x.dataset.mf !== el.dataset.v); R.querySelectorAll('[data-act="mfTab"]').forEach(b => b.classList.toggle('primary', b === el)); },
  async mfIncc() { await loadIncc(); const mes = ($('#m-inccData') || {}).value; const v = mes && inccDe(mes); if (v) { $('#m-incc').value = fmt(v, 3, 3); toast(`INCC-DI de ${mesAno(mes)}: ${fmt(v, 3, 3)}`); } else toast(mes ? 'Esse mês não está na série INCC. Cadastre na aba INCC.' : 'Informe o mês do INCC-DI base.', 'err'); },
  mfInstAdd(el) { S._mf.inst.add(el.dataset.id); $('#mf-inst-sel').innerHTML = instSel(); $('#mf-inst-res').innerHTML = instRes(($('#mf-inst-q') || {}).value || ''); },
  mfInstDel(el) { S._mf.inst.delete(el.dataset.id); $('#mf-inst-sel').innerHTML = instSel(); },
  saveMeta(el) {
    const f = readMetaForm(); if (!f.codigo || !(f.empreendimento || f.cliente)) { toast('Informe o código e o empreendimento ou o cliente.', 'err'); return; }
    let id = el.dataset.id; const now = new Date().toISOString();
    if (!id) {
      id = uid(); const src = S._dup && S.orcs.get(S._dup);
      const m = { ...(src ? clone(src) : {}), ...f, id, criado: now, atualizado: now, totais: src ? clone(src.totais || {}) : { custo: 0, venda: 0, direto: 0 } };
      if (src) { if (!f.tx && src.tx) m.tx = src.tx; if (!f.inst && src.inst) m.inst = src.inst; if (src.bdi && !f.bdi.base.length) m.bdi.base = src.bdi.base || []; }
      S.orcs.set(id, m); closeModal();
      (async () => {
        try {
          await saveDoc('orcamentos/' + id, m);
          if (src && S.db) for (const sub of ['partes', 'extras', 'projetos']) { const snap = await S.db.collection(`orcamentos/${src.id}/${sub}`).get(); for (const d of snap.docs) await saveDoc(`orcamentos/${id}/${sub}/${d.id}`, clone(d.data())); }
        } catch (e) { writeErr(e); }
        openBudget(id); S.view = 'plan'; render(); toast(src ? `Cópia de ${src.codigo} criada como ${m.codigo} ${m.revisao}.` : 'Orçamento criado.');
      })();
      return;
    }
    saveMeta(id, { ...f, atualizado: now }); S._dadosDirty = false; closeModal(); render(); touch(); toast('Dados do orçamento salvos.');
  },
  openOrc(el, e) { if (e.target.closest('button')) return; openBudget(el.dataset.id); S.view = 'plan'; render(); window.scrollTo(0, 0); },
  async revOrc(el) {
    const src = S.orcs.get(el.dataset.id); if (!src) return;
    const rv = /^R(\d+)$/i.exec(src.revisao || ''); const nrev = rv ? 'R' + String(+rv[1] + 1).padStart(rv[1].length, '0') : (src.revisao || 'R00') + '-1';
    confirmBox('Nova revisão', `Cria uma cópia completa de <b>${esc(idOrc(src))}</b> como revisão <b>${esc(nrev)}</b>, com planilha, composições e preços. A revisão atual fica preservada.`, 'Criar revisão', async () => {
      const id = uid(); const now = new Date().toISOString();
      const m = { ...clone(src), id, revisao: nrev, revisaoNum: parseInt(nrev.replace(/\D/g, ''), 10) || 0, status: 'Em elaboração', criado: now, atualizado: now }; m.nome = nomeOrc(m);
      try {
        if (S.db) for (const sub of ['partes', 'extras', 'projetos']) { const snap = await S.db.collection(`orcamentos/${src.id}/${sub}`).get(); for (const d of snap.docs) await saveDoc(`orcamentos/${id}/${sub}/${d.id}`, clone(d.data())); }
        S.orcs.set(id, m); await saveDoc('orcamentos/' + id, m); toast(`Revisão ${nrev} criada.`); render();
      } catch (e) { writeErr(e); }
    });
  },
  delOrc(el) {
    const o = S.orcs.get(el.dataset.id); if (!o) return;
    confirmBox('Excluir orçamento', `Excluir <b>${esc(idOrc(o))}</b> para toda a equipe? Esta ação não pode ser desfeita.`, 'Excluir', async () => {
      const id = o.id; S.orcs.delete(id); if (S.cur && S.cur.id === id) { if (S.cur.unsub) S.cur.unsub(); S.cur = null; }
      render();
      if (S.db) { try { await S.db.doc('orcamentos/' + id).delete(); for (const p of ['it', 'cp', 'in']) for (let i = 0; i < N_PART; i++) await S.db.doc(`${P(id)}/${p}${i}`).delete(); for (const sub of ['extras', 'projetos']) { const sn = await S.db.collection(`orcamentos/${id}/${sub}`).get(); for (const x of sn.docs) await S.db.doc(`orcamentos/${id}/${sub}/${x.id}`).delete(); } toast('Orçamento excluído.'); } catch (e) { writeErr(e); } }
    });
  },
  syncAllPrices() {
    confirmBox('Atualizar preços pela base', 'Substitui preço, data de cotação e grupo de todos os insumos deste orçamento pelos valores atuais da base. Coeficientes e composições não mudam. Insumos que não existem na base ficam como estão.', 'Atualizar preços', () => {
      const list = []; for (const x of S.cur.ins.values()) { const b = S.ins.get(x.cod); if (b) list.push({ ...x, preco: b.preco, dt: b.dt || '', grp: b.grp, enc: !!b.enc }); }
      if (list.length) putInsOrc(list); render(); toast(`${list.length} insumo(s) atualizados pela base.`);
    });
  },

  /* planilha */
  sel(el, e) { if (e.target.closest('input,select,button')) return; selectRow(el.dataset.id, true); },
  tog(el) { const id = el.dataset.id; S.collapsed.has(id) ? S.collapsed.delete(id) : S.collapsed.add(id); saveCollapsed(); render(); },
  colAll() { for (const v of S.cur.items.values()) if (v.k === 'e') S.collapsed.add(v.id); saveCollapsed(); render(); },
  expAll() { S.collapsed.clear(); saveCollapsed(); render(); },
  tipoF(el) { S.q.tipo = el.dataset.v; render(); },
  comment(el) {
    const v = S.cur.items.get(el.dataset.id); if (!v) return; S._comId = v.id;
    openModal(`<header><h2>Comentário do item</h2><button class="x" data-act="closeModal" aria-label="Fechar">×</button></header>
      <div class="body stack"><span class="muted">${esc(v.desc)}</span><textarea id="com-txt" rows="5" style="width:100%;border:1px solid var(--line-2);border-radius:3px;padding:8px;font:inherit;background:var(--surface);color:var(--ink)" placeholder="Escreva uma observação sobre este item"${dis()} autofocus>${esc(v.det || '')}</textarea></div>
      <footer>${v.det && !S.readOnly ? '<button class="btn ghost" data-act="comDel">Remover comentário</button><span class="spacer"></span>' : ''}<button class="btn" data-act="closeModal">Cancelar</button><button class="btn primary" data-act="comSave"${dis()}>Salvar</button></footer>`);
  },
  comSave() { const v = S.cur.items.get(S._comId); if (!v) return; const t = ($('#com-txt') || {}).value.trim(); closeModal(); if ((v.det || '') !== t) putItems([{ ...v, det: t }]); render(); },
  comDel() { const v = S.cur.items.get(S._comId); if (!v) return; closeModal(); putItems([{ ...v, det: '' }]); render(); },
  renum() { const list = [...S.cur.items.values()].filter(v => v.num).map(v => ({ ...v, num: null })); if (!list.length) return; confirmBox('Renumerar a planilha', `Troca a numeração herdada do arquivo importado (${list.length} itens) pela numeração sequencial automática. Os números que o cliente já recebeu vão mudar.`, 'Renumerar', () => { putItems(list); render(); toast('Planilha renumerada.'); }); },
  addEtapa() { addItem({ k: 'e', desc: 'NOVA ETAPA' }, targetFor('root')); render(); },
  addSub() { const t = targetFor('in'); addItem({ k: 'e', desc: 'Nova subetapa' }, t); render(); },
  addServ() {
    S._servTarget = null;
    openPicker({ mode: 'addServ', title: 'Adicionar serviço à planilha', sources: ['orc:cpu', 'cat:cpu'], footer: `<button class="btn" data-act="compCreate" data-new="1"${dis()}>Criar composição nova</button><button class="btn" data-act="addBlank"${dis()}>Serviço sem composição</button>` });
  },
  addBlank() { addItem({ k: 's', cod: '', desc: (S.pk && S.pk.q) || 'Novo serviço', un: 'un', qtd: 0 }, targetFor('in')); closeModal(); render(); },
  pick(el) {
    const pk = S.pk; if (!pk) return; const { scope, type, cod } = el.dataset;
    if (pk.mode === 'addServ') {
      if (scope === 'cat') copyFromBase(cod, false);
      const c = S.cur.comps.get(cod) || S.cpus.get(cod);
      addItem({ k: 's', cod, desc: c.desc, un: c.un, qtd: 0 }, targetFor('in')); S.focusNew = null; render(); toast(`Adicionado: ${cod}`);
    } else if (pk.mode === 'link') {
      if (scope === 'cat') copyFromBase(cod, false);
      const v = S.cur.items.get(S.sel); const c = S.cur.comps.get(cod) || S.cpus.get(cod);
      if (v) putItems([{ ...v, cod, desc: v.desc && v.desc !== 'Novo serviço' ? v.desc : c.desc, un: v.un || c.un }]); closeModal(); render();
    } else if (pk.mode === 'ciAdd') {
      const st = STORE[pk.kind]; const host = st.comps().get(pk.cod); if (!host) return;
      if (type === 'cpu' && (cod === pk.cod || reaches(pk.kind === 'orc' && scope === 'cat' ? S.cpus : st.comps(), cod, pk.cod))) { toast('Essa composição já usa a atual; incluir criaria uma referência circular.', 'err'); return; }
      if (pk.kind === 'orc' && scope === 'cat') { if (type === 'cpu') copyFromBase(cod, false); else if (!S.cur.ins.has(cod)) putInsOrc([clone(S.ins.get(cod))]); }
      const h = st.comps().get(pk.cod);
      st.putComps([{ ...h, itens: [...(h.itens || []), { t: type === 'cpu' ? 'c' : 'i', cod, coef: 1 }] }]); render(); toast(`Incluído: ${cod} (coeficiente 1, ajuste na tabela)`);
    }
  },
  indent() {
    const v = S.cur.items.get(S.sel); if (!v) return; const sibs = sibsOf(realPar(v)); const i = sibs.findIndex(s => s.id === v.id); const prev = sibs[i - 1];
    if (!prev || prev.k !== 'e') { toast('Para avançar, o item logo acima precisa ser uma etapa.', 'err'); return; }
    putItems([{ ...v, par: prev.id, pos: insertPos(prev.id, null) }]); S.collapsed.delete(prev.id); render();
  },
  outdent() {
    const v = S.cur.items.get(S.sel); if (!v || !realPar(v)) return; const p = S.cur.items.get(v.par); const np = realPar(p);
    putItems([{ ...v, par: np, pos: insertPos(np, p.id) }]); render();
  },
  up() { move(-1); }, down() { move(1); },
  delItem() {
    const v = S.cur.items.get(S.sel); if (!v) return; const ids = subtreeIds(v.id); const saved = ids.map(i => clone(S.cur.items.get(i)));
    const doIt = () => { delItems(ids); S.sel = null; render(); toast(ids.length > 1 ? `${ids.length} itens excluídos.` : 'Item excluído.', null, { label: 'Desfazer', fn: () => { putItems(saved); S.sel = v.id; render(); } }); };
    if (ids.length > 1) confirmBox('Excluir etapa', `Excluir <b>${esc(v.desc)}</b> e os ${ids.length - 1} itens dentro dela?`, 'Excluir', doIt); else doIt();
  },
  crumb(el) { S.compStack = S.compStack.slice(0, +el.dataset.i); render(); },
  drill(el) { if (el.dataset.ctx === 'orc') S.compStack.push(el.dataset.cod); else S.selCpu = el.dataset.cod; render(); },
  compLink() { openPicker({ mode: 'link', title: 'Vincular composição ao serviço', sources: ['orc:cpu', 'cat:cpu'] }); },
  compCreate(el) {
    const q = (S.pk && S.pk.q) || ''; const fromPicker = el.dataset.new === '1'; closeModal();
    const code = nextCode('CPU', [S.cpus, S.cur.comps]);
    const v = fromPicker ? null : S.cur.items.get(S.sel);
    const c = { cod: code, desc: (v && v.desc) || q || 'NOVA COMPOSIÇÃO', un: (v && v.un) || 'un', pref: 0, itens: [] }; putComps([c]);
    if (v) putItems([{ ...v, cod: code }]); else addItem({ k: 's', cod: code, desc: c.desc, un: c.un, qtd: 0 }, targetFor('in'));
    S.compStack = []; render(); toast(`Composição ${code} criada neste orçamento. Inclua os insumos no painel abaixo.`);
  },
  ciAdd(el) {
    const kind = el.dataset.ctx; const cod = el.dataset.cod;
    openPicker({ mode: 'ciAdd', kind, cod, title: `Adicionar item em ${cod}`, sources: kind === 'orc' ? ['orc:ins', 'orc:cpu', 'cat:ins', 'cat:cpu'] : ['cat:ins', 'cat:cpu'], footer: `<button class="btn" data-act="insNewCi" data-ctx="${kind}" data-cod="${esc(cod)}"${dis()}>Cadastrar insumo novo</button>` });
  },
  ciDel(el) { const st = STORE[el.dataset.ctx]; const c = st.comps().get(el.dataset.cod); if (!c) return; const itens = [...(c.itens || [])]; itens.splice(+el.dataset.i, 1); st.putComps([{ ...c, itens }]); render(); },
  compSync(el) {
    const cod = el.dataset.cod; const exists = S.cur.comps.has(cod);
    const go = () => { const a = copyFromBase(cod, true); render(); toast(`${a.comps.length} composição(ões) e ${a.ins.length} insumo(s) trazidos da base.`); };
    exists ? confirmBox('Atualizar pela base', `Substitui a composição <b>${esc(cod)}</b>, suas auxiliares e os preços dos insumos dela neste orçamento pelos da base. Outras composições que usam os mesmos insumos também passam a usar o preço da base.`, 'Atualizar', go) : go();
  },
  compToBase(el) {
    const cod = el.dataset.cod; const exists = S.cpus.has(cod);
    const go = () => { const a = copyToBase(cod); toast(`Base atualizada: ${a.comps.length} composição(ões) e ${a.ins.length} insumo(s).`); };
    exists ? confirmBox('Salvar na base', `A composição <b>${esc(cod)}</b> já existe na base. Salvar substitui a versão da base (e das auxiliares e insumos usados) pela deste orçamento, e isso vale para os próximos orçamentos da equipe.`, 'Substituir na base', go) : go();
  },

  /* base de insumos */
  insNew() { modalIns('cat'); },
  insNewCi(el) { const pk = S.pk; modalIns('ci', { kind: el.dataset.ctx, comp: el.dataset.cod, desc: pk ? pk.q : '' }); },
  insCreate(el) {
    const g = id => ($('#' + id) || {}).value || '';
    const cod = g('n-cod').trim(), desc = g('n-desc').trim(); const preco = parseNum(g('n-preco'));
    if (!cod || !desc) { toast('Informe código e descrição.', 'err'); return; }
    const mode = el.dataset.mode, kind = el.dataset.kind;
    const x = { cod, desc, un: g('n-un').trim() || 'un', preco: Number.isFinite(preco) ? preco : 0, grp: g('n-grp'), dt: g('n-dt'), enc: g('n-enc') === '1' };
    if (mode === 'cat') { if (S.ins.has(cod)) { toast('Já existe um insumo com esse código na base.', 'err'); return; } putCatIns([x]); closeModal(); render(); toast('Insumo cadastrado.'); return; }
    const st = STORE[kind];
    if (st.ins().has(cod)) { toast('Já existe um insumo com esse código.', 'err'); return; }
    st.putIns([x]); if (kind === 'orc' && $('#n-base') && $('#n-base').checked && !S.ins.has(cod)) putCatIns([clone(x)]);
    const h = st.comps().get(el.dataset.cod); if (h) st.putComps([{ ...h, itens: [...(h.itens || []), { t: 'i', cod, coef: 1 }] }]);
    closeModal(); render(); toast(`Insumo ${cod} criado e incluído na composição.`);
  },
  insDel(el) {
    const cod = el.dataset.cod; const users = [...S.cpus.values()].filter(c => (c.itens || []).some(it => it.t !== 'c' && it.cod === cod)).map(c => c.cod);
    if (users.length) { toast(`O insumo ${cod} é usado em ${users.length} composição(ões): ${users.slice(0, 6).join(', ')}${users.length > 6 ? '…' : ''}. Remova-o delas antes.`, 'err'); return; }
    const x = clone(S.ins.get(cod)); delCatIns(cod); render(); toast(`Insumo ${cod} excluído.`, null, { label: 'Desfazer', fn: () => { putCatIns([x]); render(); } });
  },
  insXls() { exportInsXlsx(); },
  cpuXls() { exportCpuXlsx(); },

  /* base de composições */
  cpuSel(el) { S.selCpu = el.dataset.cod; render(); },
  cpuNew() { modalCpu(); },
  cpuCreate() {
    const g = id => ($('#' + id) || {}).value || ''; const cod = g('n-cod').trim(), desc = g('n-desc').trim();
    if (!cod || !desc) { toast('Informe código e descrição.', 'err'); return; } if (S.cpus.has(cod)) { toast('Já existe uma composição com esse código.', 'err'); return; }
    putCatCpu([{ cod, desc, un: g('n-un').trim() || 'un', pref: 0, itens: [] }]); S.selCpu = cod; closeModal(); render();
  },
  cpuDup(el) { const c = S.cpus.get(el.dataset.cod); if (!c) return; const cod = nextCode('CPU', [S.cpus]); putCatCpu([{ ...clone(c), cod, desc: c.desc + ' (cópia)' }]); S.selCpu = cod; render(); toast(`Composição duplicada como ${cod}.`); },
  cpuDel(el) {
    const cod = el.dataset.cod; const users = [...S.cpus.values()].filter(c => (c.itens || []).some(it => it.t === 'c' && it.cod === cod)).map(c => c.cod);
    if (users.length) { toast(`${cod} é auxiliar de ${users.join(', ')}. Remova antes de excluir.`, 'err'); return; }
    confirmBox('Excluir composição', `Excluir <b>${esc(cod)}</b> da base? Orçamentos que já a usam mantêm a cópia deles.`, 'Excluir', () => { delCatCpu(cod); S.selCpu = null; render(); toast('Composição excluída.'); });
  },

  /* exportações */
  expFmt(el) { const E = expState(); E.fmt = el.dataset.v; expSave(); render(); },
  expAll() { const E = expState(); EXP_SEC.forEach(([k]) => E.sec.add(k)); expSave(); render(); },
  expNone() { const E = expState(); E.sec.clear(); expSave(); render(); },
  expGo() { exportarPacote(); },

  /* documentos */
  docTab(el) { S.docTab = el.dataset.v; render(); },
  prSec() { const pr = clone(S.cur.extras.premissas); pr.secoes.push({ n: String(pr.secoes.length), t: 'NOVA SEÇÃO', itens: [] }); saveExtra('premissas', pr); render(); },
  prSecDel(el) { const pr = clone(S.cur.extras.premissas); const s = pr.secoes[+el.dataset.s]; confirmBox('Excluir seção', `Excluir a seção <b>${esc(s.t)}</b> e seus ${s.itens.length} itens?`, 'Excluir', () => { pr.secoes.splice(+el.dataset.s, 1); saveExtra('premissas', pr); render(); }); },
  prItem(el) { const pr = clone(S.cur.extras.premissas); const s = pr.secoes[+el.dataset.s]; const base = String(s.n).padStart(2, '0'); s.itens.push({ n: `${base}.${String(s.itens.length + 1).padStart(2, '0')}`, t: '' }); saveExtra('premissas', pr); render(); },
  prItemDel(el) { const pr = clone(S.cur.extras.premissas); pr.secoes[+el.dataset.s].itens.splice(+el.dataset.i, 1); saveExtra('premissas', pr); render(); },
  prX() { const pr = clone(S.cur.extras.premissas); pr.exclusoes.push(''); saveExtra('premissas', pr); render(); },
  prXDel(el) { const pr = clone(S.cur.extras.premissas); pr.exclusoes.splice(+el.dataset.i, 1); saveExtra('premissas', pr); render(); },
  m3Del() { const md = { ...S.cur.extras.modelo3d, imagem: null }; saveExtra('modelo3d', md); render(); toast('Imagem removida do orçamento.'); },
  xlsCli() { exportCliente(); },
  /* INCC */
  inccAdd() { const mes = ($('#incc-mes') || {}).value, v = parseNum(($('#incc-val') || {}).value); if (!mes || !Number.isFinite(v)) { toast('Informe o mês e o índice.', 'err'); return; } const map = new Map((S.incc || []).map(p => [p[0], p[1]])); map.set(mes, v); saveIncc([...map]); render(); toast(`INCC-DI de ${mesAno(mes)} salvo.`); },
  inccDel(el) { const k = el.dataset.k; saveIncc((S.incc || []).filter(p => p[0] !== k)); render(); },
  async impOrcDo() {
    const R = S.imp.orc; if (!R) return; const codigo = ($('#io-cod') || {}).value.trim(), nome = ($('#io-nome') || {}).value.trim();
    if (!codigo || !nome) { toast('Informe código e nome do orçamento.', 'err'); return; }
    const btn = $('[data-act="impOrcDo"]'); if (btn) { btn.disabled = true; btn.textContent = 'Importando…'; }
    try {
      const assets = window.claude && window.claude.use ? await window.claude.use('assets').catch(() => null) : null;
      const id = await aplicarImportCliente(R, { codigo, nome, base: $('#io-base').checked, incc: $('#io-incc').checked, assets });
      S.imp = { target: 'orc' }; openBudget(id); S.view = 'plan'; render(); toast(`Orçamento ${codigo} importado.`);
    } catch (e) { console.error(e); toast('Falha na importação: ' + e.message, 'err'); if (btn) { btn.disabled = false; btn.textContent = 'Importar orçamento'; } }
  },
  /* importação */
  impTarget(el) { S.imp = { target: el.dataset.v }; render(); },
  impReset() { S.imp = { target: S.imp.target }; render(); },
  impTpl() { impTemplate(); },
  impDo() {
    const R = S.imp._res; if (!R) return;
    if (S.imp.target === 'ins') {
      const bad = chunkOverflow('cat_insumos', N_INS, S.ins, R.ins); if (bad.length) { toast('A base ficaria grande demais para o armazenamento atual. Importe em partes menores ou fale com o suporte.', 'err'); return; }
      putCatIns([...R.ins.values()]); toast(`${R.ins.size} insumos importados.`);
    } else {
      const comps = [...R.comps.values()];
      if (chunkOverflow('cat_cpus', N_CPU, S.cpus, R.comps).length || chunkOverflow('cat_insumos', N_INS, S.ins, R.ins).length) { toast('A base ficaria grande demais para o armazenamento atual. Importe em partes menores.', 'err'); return; }
      if (R.ins.size) putCatIns([...R.ins.values()]); putCatCpu(comps); toast(`${comps.length} composições importadas${R.ins.size ? ` e ${R.ins.size} insumos criados` : ''}.`);
    }
    S.imp = { target: S.imp.target }; render();
  }
};
/* Move o item para o número digitado na coluna Item e refaz a numeração dos ramos afetados */
function moverParaNumero(id, texto) {
  const B = computeBudget(), row = B.byId.get(id); if (!row) return;
  const t = String(texto || '').trim().replace(/\s+/g, '').replace(/,/g, '.').replace(/\.+$/, '');
  if (!t || t === row.n) { rerender(); return; }
  if (!/^\d+(\.\d+)*$/.test(t)) { toast('Número inválido. Use o formato 02.03.01.', 'err'); rerender(); return; }
  const partes = t.split('.'), ult = Math.max(1, parseInt(partes.pop(), 10) || 1), paiN = partes.join('.');
  const norm2 = n => n.split('.').map(x => String(parseInt(x, 10))).join('.');
  let paiRow = null;
  if (paiN) {
    paiRow = B.rows.find(r => r.n === paiN) || B.rows.find(r => norm2(r.n) === norm2(paiN));
    if (!paiRow) { toast(`Não existe o item ${paiN} para receber ${t}.`, 'err'); rerender(); return; }
    if (paiRow.v.k !== 'e') { toast(`${paiRow.n} é um serviço; só etapas recebem itens.`, 'err'); rerender(); return; }
    if (subtreeIds(id).includes(paiRow.v.id)) { toast('Uma etapa não pode ir para dentro dela mesma.', 'err'); rerender(); return; }
  }
  const v = S.cur.items.get(id), velhoPai = realPar(v), novoPai = paiRow ? paiRow.v.id : '';
  const sibs = sibsOf(novoPai).filter(s => s.id !== id), k = Math.min(ult - 1, sibs.length);
  const pos = !sibs.length ? 1 : k >= sibs.length ? sibs[sibs.length - 1].pos + 1 : k === 0 ? sibs[0].pos - 1 : (sibs[k - 1].pos + sibs[k].pos) / 2;
  const antes = new Map(); const guarda = x => { if (!antes.has(x.id)) antes.set(x.id, clone(x)); };
  guarda(v); S.cur.items.set(id, { ...v, par: novoPai, pos });
  // reorganiza: numeração sequencial nos grupos de origem e destino (e em tudo abaixo deles)
  const kids = childrenMap(S.cur.items), mud = new Map([[id, S.cur.items.get(id)]]);
  const limpa = par => { for (const c of kids.get(par) || []) { if (c.num) { guarda(c); mud.set(c.id, { ...(mud.get(c.id) || c), num: null }); } if (c.k === 'e') limpa(c.id); } };
  limpa(velhoPai); if (novoPai !== velhoPai) limpa(novoPai);
  const m0 = mud.get(id); if (m0.num) mud.set(id, { ...m0, num: null });
  S.cur.items.set(id, antes.get(id));
  putItems([...mud.values()]);
  let p = novoPai; while (p) { S.collapsed.delete(p); p = realPar(S.cur.items.get(p)); }
  S.sel = id; S.compStack = []; render();
  const nn = (computeBudget().byId.get(id) || {}).n || t;
  const tr = document.querySelector(`#app tr[data-id="${id}"]`); if (tr) tr.scrollIntoView({ block: 'center' });
  const salvos = [...antes.values()];
  toast(nn === t ? `Item movido para ${nn}.` : `Item movido para ${nn} (último número disponível nesse grupo).`, null, { label: 'Desfazer', fn: () => { putItems(salvos); S.sel = id; render(); } });
}
function move(d) {
  const v = S.cur.items.get(S.sel); if (!v) return; const sibs = sibsOf(realPar(v)); const i = sibs.findIndex(s => s.id === v.id); const o = sibs[i + d]; if (!o) return;
  putItems([{ ...v, pos: o.pos }, { ...o, pos: v.pos }]); render();
}
function selectRow(id, partial) {
  if (S.sel === id) return; S.sel = id; S.compStack = [];
  if (partial && S.lastB) {
    document.querySelectorAll('#app tr.sel').forEach(x => x.classList.remove('sel'));
    const tr = document.querySelector(`#app tr[data-id="${id}"]`); if (tr) tr.classList.add('sel');
    const cp = $('#comp-panel'); if (cp) cp.outerHTML = compPanel(S.lastB);
  } else render();
}

/* ===================== Eventos ===================== */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act; if (el.tagName === 'A') e.preventDefault();
  if (el.disabled) return;
  const f = ACT[a]; if (f) f(el, e);
});
/* Campos numéricos: ao clicar, apaga o valor e aguarda o novo; se sair vazio, volta o anterior */
const ZERA_SEL = 'input.cell.num, input[data-bdi], #m-torres, #m-elevadores, #m-vagas, #m-uh, #m-areaConst, #m-areaPriv, #m-areaTerreno, #m-prazo, #m-incc, #n-preco, #incc-val, input[data-f="imp.hdr"]';
function isZeraCampo(el) { return !!(el && el.matches && el.matches(ZERA_SEL) && !el.disabled && !el.readOnly); }
document.addEventListener('focusin', e => {
  const el = e.target;
  if (isZeraCampo(el) && !el.dataset.cleared) { el.dataset.old = el.value; el.dataset.cleared = '1'; el.value = ''; }
  if (S.view !== 'plan' || !el.closest) return; const tr = el.closest('tr[data-act="sel"]'); if (tr) selectRow(tr.dataset.id, true);
});
document.addEventListener('focusout', e => {
  const el = e.target;
  if (isZeraCampo(el) && el.dataset.cleared) { if (el.value.trim() === '' && el.dataset.old != null) { el.value = el.dataset.old; if (el.dataset.bdi) updBdiRes(); } delete el.dataset.cleared; }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.closest && el.closest('#app .mf-root') && el.id !== 'mf-inst-q') S._dadosDirty = true;
  if (el.id === 'pk-q' && S.pk) { S.pk.q = el.value; $('#pk-list').innerHTML = pkList(); return; }
  if (el.id === 'mf-inst-q') { $('#mf-inst-res').innerHTML = instRes(el.value); return; }
  if (el.dataset && el.dataset.bdi) { updBdiRes(); return; }
  if (el.dataset && el.dataset.nome) { const p = $('#m-nome-prev'); if (p) p.textContent = nomeOrc({ empreendimento: ($('#m-empreendimento') || {}).value.trim(), cliente: ($('#m-cliente') || {}).value.trim(), revisao: ($('#m-revisao') || {}).value.trim() }) || '–'; return; }
  if (el.dataset && el.dataset.incc) { clearTimeout(S._tInc); S._tInc = setTimeout(updInccModal, 250); return; }
  const k = el.dataset && el.dataset.live; if (k) { S.q[k] = el.value; render(); }
});
document.addEventListener('keydown', e => {
  const el = e.target; if (!(el instanceof HTMLInputElement) || !el.classList.contains('cell')) return;
  if (e.key === 'Escape') { el.value = el.defaultValue; el.blur(); return; }
  if (e.key === 'Enter' || ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && el.classList.contains('num'))) {
    e.preventDefault(); const same = [...document.querySelectorAll(`#app input.cell[data-f="${el.dataset.f}"]`)]; const i = same.indexOf(el);
    const nx = same[i + (e.key === 'ArrowUp' ? -1 : 1)]; if (nx) { nx.focus(); nx.select(); } else el.blur();
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.closest && el.closest('#app .mf-root') && !(isZeraCampo(el) && !el.value.trim())) S._dadosDirty = true;
  if (el.id === 'm-dup') { modalMeta(null, el.value); return; }
  if (el.id === 'imp-file') { const f = el.files && el.files[0]; if (!f) return; if (S.imp.target === 'orc') { toast('Lendo a planilha…'); f.arrayBuffer().then(buf => lerPlanilhaCliente(buf, f.name)).then(R => { S.imp.orc = R; render(); }).catch(e => { console.error(e); toast('Não consegui ler a planilha: ' + e.message, 'err'); }); } else impLoadFile(f); return; }
  if (el.id === 'pj-file') { const f = el.files && el.files[0]; if (f) importarProjetos(f); return; }
  if (el.id === 'm3-file') { const f = el.files && el.files[0]; if (f) enviarImagem3d(f); return; }
  if (el.id === 'incc-file') { const f = el.files && el.files[0]; if (f) importarIncc(f); return; }
  if (el.dataset && el.dataset.grp !== undefined) return;
  if (isZeraCampo(el) && !el.value.trim()) { if (el.dataset.old != null) el.value = el.dataset.old; return; }
  const f = el.dataset && el.dataset.f; if (!f) return;
  const [scope, field] = f.split('.');
  if (scope === 'exp') { const E = expState(); if (field === 'sec') { el.checked ? E.sec.add(el.dataset.k) : E.sec.delete(el.dataset.k); } if (field === 'bdi') E.bdi = el.checked; expSave(); render(); return; }
  if (scope === 'q') { S.q[field] = el.type === 'checkbox' ? el.checked : el.value; render(); return; }
  if (scope === 'mf') { if (field === 'base') { el.checked ? S._mf.base.add(el.dataset.id) : S._mf.base.delete(el.dataset.id); updBdiRes(); } if (field === 'ind') S._mf.ind = el.dataset.id; return; }
  if (scope === 'pr') {
    const pr = clone(S.cur.extras.premissas); const si = +el.dataset.s, ii = +el.dataset.i;
    if (field === 'sn') pr.secoes[si].n = el.value.trim(); if (field === 'st') pr.secoes[si].t = el.value.trim(); if (field === 'in') pr.secoes[si].itens[ii].n = el.value.trim(); if (field === 'it') pr.secoes[si].itens[ii].t = el.value;
    if (field === 'xi') pr.exclusoesIntro = el.value.trim(); if (field === 'x') pr.exclusoes[ii] = el.value;
    saveExtra('premissas', pr); rerender(); return;
  }
  if (scope === 'pj') { const pj = { ...(S.cur.extras.projetos || {}), [field]: el.value.trim() }; saveExtra('projetos', pj); return; }
  if (scope === 'm3') { const md = { ...(S.cur.extras.modelo3d || {}), link: el.value.trim() }; saveExtra('modelo3d', md); return; }
  if (scope === 'incc') { const v = parseNum(el.value); if (!Number.isFinite(v)) { toast('Índice inválido.', 'err'); rerender(); return; } const map = new Map((S.incc || []).map(p => [p[0], p[1]])); map.set(el.dataset.k, v); saveIncc([...map]); rerender(); return; }
  if (scope === 'imp') {
    const I = S.imp;
    if (field === 'sheet') { I.sheet = el.value; impLoadSheet(); return; }
    if (field === 'hdr') { const n = parseInt(el.value, 10); if (n >= 1) { I.hdr = n - 1; guessMap(); } render(); return; }
    if (field === 'defGrp') { I.defGrp = el.value; render(); return; }
    if (field === 'map') { I.map[el.dataset.k] = +el.value; render(); return; }
  }
  if (scope === 'cfg') { const n = parseNum(el.value); if (!Number.isFinite(n)) { toast('Percentual inválido.', 'err'); rerender(); return; } S.cfg.encargos = n; saveDoc('config/geral', { encargos: n }); rerender(); return; }
  if (scope === 'it') {
    const v = S.cur && S.cur.items.get(el.dataset.id); if (!v) return;
    if (field === 'n') { moverParaNumero(v.id, el.value); return; }
    let val = el.value;
    if (field === 'qtd' && !String(val).trim()) return;
    if (field === 'qtd') { val = parseNum(val); if (!Number.isFinite(val)) { toast('Quantidade inválida. Use números, por exemplo 1.234,56.', 'err'); rerender(); return; } }
    else val = val.trim();
    if (v[field] === val) return; putItems([{ ...v, [field]: val }]); rerender(); return;
  }
  const st = STORE[el.dataset.ctx]; if (!st) return;
  if (scope === 'ci') {
    const c = st.comps().get(el.dataset.cod); if (!c) return; const x = parseNum(el.value);
    if (!Number.isFinite(x)) { toast('Coeficiente inválido.', 'err'); rerender(); return; }
    const itens = clone(c.itens || []); itens[+el.dataset.i].coef = x; st.putComps([{ ...c, itens }]); rerender(); return;
  }
  if (scope === 'ins') {
    const x = st.ins().get(el.dataset.cod); if (!x) return; let val;
    if (field === 'preco') { val = parseNum(el.value); if (!Number.isFinite(val)) { toast('Preço inválido.', 'err'); rerender(); return; } }
    else if (field === 'enc') val = el.checked; else val = el.value.trim();
    st.putIns([{ ...x, [field]: val }]); rerender(); return;
  }
  if (scope === 'comp') {
    const c = st.comps().get(el.dataset.cod); if (!c) return; let val = el.value.trim();
    if (field === 'pref') { val = parseNum(val); if (!Number.isFinite(val)) { toast('Valor inválido.', 'err'); rerender(); return; } }
    st.putComps([{ ...c, [field]: val }]);
    if (el.dataset.ctx === 'orc' && field === 'desc') { const ups = [...S.cur.items.values()].filter(v => v.cod === c.cod && v.desc === c.desc).map(v => ({ ...v, desc: val })); if (ups.length) putItems(ups); }
    rerender();
  }
});
const _render0 = render;
render = function () {
  _render0();
  if (S.focusNew) { const el = document.querySelector(`#app input[data-f="it.desc"][data-id="${S.focusNew}"]`); S.focusNew = null; if (el) { el.focus(); el.select(); el.closest('tr').scrollIntoView({ block: 'nearest' }); } }
};

async function importarProjetos(file) {
  try {
    await loadLib('xlsx'); const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    let best = null;
    for (const n of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' });
      const h = rows.findIndex(r => r.some(c => /^c[oó]digo$/i.test(String(c).trim())) && r.some(c => /extens/i.test(String(c))));
      if (h < 0) continue; const c0 = rows[h].findIndex(c => /^c[oó]digo$/i.test(String(c).trim()));
      const data = rows.slice(h + 1).map(r => r.slice(c0, c0 + 11).map(x => String(x ?? '').trim())).filter(r => r.some(Boolean));
      const txt = rows.slice(0, h).flat().map(x => String(x || '').trim()).filter(Boolean);
      const pick = re => { const t = txt.find(x => re.test(x)); return t ? t.replace(re, '').trim() : ''; };
      best = { rows: data, info: { plataforma: pick(/^plataforma:\s*/i) || (S.cur.extras.projetos || {}).plataforma || '', dataIni: pick(/^data inicial:\s*/i), dataFim: pick(/^data final:\s*/i), emissor: pick(/^emissor:\s*/i), emissao: pick(/^data de emiss[aã]o:\s*/i), titulo: txt.find(x => /relat[oó]rio/i.test(x)) || '' } };
      break;
    }
    if (!best) { toast('Não achei a tabela com as colunas Código e Extensão.', 'err'); return; }
    const old = (S.cur.extras.projetos || {})._n || 0;
    await saveProjetosRows(S.cur.id, best.rows, best.info, old);
    S.cur.extras.projetos = { ...best.info, _n: Math.ceil(best.rows.length / 500), total: best.rows.length }; S.cur.extras.projetosRows = best.rows; render();
    toast(`${best.rows.length} documentos importados.`);
  } catch (e) { console.error(e); toast('Falha ao importar o relatório: ' + e.message, 'err'); }
}
async function enviarImagem3d(file) {
  const assets = window.claude && window.claude.use ? await window.claude.use('assets').catch(() => null) : null;
  if (!assets) { toast('O envio de imagens não está disponível nesta visualização.', 'err'); return; }
  try { const a = await assets.upload(file); saveExtra('modelo3d', { ...(S.cur.extras.modelo3d || {}), imagem: { id: a.id, url: a.url } }); render(); toast('Imagem do modelo salva.'); }
  catch (e) { console.error(e); toast('Não foi possível enviar a imagem (' + ((e && e.code) || 'erro') + ').', 'err'); }
}
async function importarIncc(file) {
  try {
    await loadLib('xlsx'); const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); const map = new Map((S.incc || []).map(p => [p[0], p[1]])); let n = 0;
    for (const sn of wb.SheetNames) { const rows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' }); for (const r of rows) for (let c = 0; c < r.length - 1; c++) { const d = r[c], v = r[c + 1]; if (typeof d === 'number' && d > 20000 && d < 80000 && typeof v === 'number' && v > 50 && v < 100000) { map.set(serialISO(d).slice(0, 7), v); n++; break; } } }
    if (!n) { toast('Não encontrei colunas de data e índice.', 'err'); return; }
    await saveIncc([...map]); render(); toast(`${n} meses de INCC-DI importados.`);
  } catch (e) { console.error(e); toast('Falha ao importar o INCC: ' + e.message, 'err'); }
}

/* ===================== Inicialização ===================== */
async function init() {
  $('#copy').textContent = `© ${YEAR} Unità Engenharia. Todos os direitos reservados.`;
  render();
  const cl = window.claude;
  const done = () => { S.loaded = { ins: true, cpus: true, orcs: true }; render(); };
  if (!cl || !cl.use) return done();
  const safe = p => Promise.resolve(p).catch(() => null);
  const [db, dl, user] = await Promise.all([safe(cl.use('db')), safe(cl.use('downloads')), safe(cl.use('user'))]);
  S.db = db; S.dl = dl; S.user = user; S.online = !!db;
  if (user && user.can) { try { if ((await user.can('data.write')) === false) S.readOnly = true; } catch { } }
  if (!db) return done();
  db.collection('cat_insumos').onSnapshot(s => { S.ins = chunkMap(s, 'cod'); S.loaded.ins = true; schedule(); }, dbErr);
  db.collection('cat_cpus').onSnapshot(s => { S.cpus = chunkMap(s, 'cod'); S.loaded.cpus = true; schedule(); }, dbErr);
  db.collection('orcamentos').onSnapshot(s => { const m = new Map(); for (const d of s.docs) m.set(d.id, { ...d.data(), id: d.id }); S.orcs = m; S.loaded.orcs = true; schedule(); }, dbErr);
  db.doc('config/incc').onSnapshot(s => { S.incc = (s.exists && s.data().serie) || []; if (S.view === 'incc') schedule(); }, dbErr);
  db.doc('config/geral').onSnapshot(s => { S.cfg = { encargos: 0, ...(s.exists ? s.data() : {}) }; schedule(); }, dbErr);
  render();
}
init();
